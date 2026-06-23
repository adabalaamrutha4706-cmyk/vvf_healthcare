const http = require('http');

const API_PORT = 5000;
const API_HOST = 'localhost';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== VVF Healthcare Simplified Lead Assignment Engine Verification ===');
  let adminToken = null;
  let execToken = null;
  let testTcId = null;
  const createdLeadIds = [];
  let otherActiveTelecallers = [];

  try {
    // 1. Logins
    console.log('\nStep 1: Authenticating roles...');
    
    // Admin Login
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@vvf.org',
      password: 'admin123'
    });
    if (adminLogin.statusCode !== 200) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    }
    adminToken = adminLogin.body.token || adminLogin.body.data.token;
    console.log('[PASS] Admin authenticated.');

    // Executive Login
    const execLogin = await request('POST', '/api/auth/login', {
      email: 'executive@vvf.org',
      password: 'executive123'
    });
    if (execLogin.statusCode !== 200) {
      throw new Error(`Executive login failed: ${JSON.stringify(execLogin.body)}`);
    }
    execToken = execLogin.body.token || execLogin.body.data.token;
    console.log('[PASS] Executive authenticated.');

    // 2. Clear out any pre-existing active leads to get a clean test bed
    console.log('\nStep 2: Cleaning up existing active leads...');
    const listRes = await request('GET', '/api/admin/field-appointments', null, adminToken);
    const existingLeads = listRes.body.data || listRes.body || [];
    const activeStatuses = ['New Lead', 'Contacted', 'Follow-up Pending', 'Appointment Scheduled'];
    
    for (const lead of existingLeads) {
      if (activeStatuses.includes(lead.lead_status || lead.status)) {
        await request('PUT', `/api/admin/field-appointments/${lead.id}/status`, { status: 'Closed' }, adminToken);
      }
    }
    console.log('[PASS] Existing active leads set to Closed.');

    // 2.5 Deactivate other active telecallers temporarily (except Amit Patel, ID 5)
    console.log('\nStep 2.5: Deactivating other active telecallers temporarily...');
    const usersRes = await request('GET', '/api/users', null, adminToken);
    const usersList = usersRes.body.users || usersRes.body.data?.users || [];
    otherActiveTelecallers = usersList.filter(u => u.role === 'Telecaller' && u.id !== 5 && u.is_active && !u.is_deleted);
    
    for (const tc of otherActiveTelecallers) {
      await request('PUT', `/api/users/${tc.id}`, { is_active: false }, adminToken);
    }
    console.log('[PASS] Other active telecallers temporarily deactivated.');

    // 3. Create 3 active leads for Amit Patel (ID 5)
    console.log('\nStep 3: Creating 3 initial active leads for Amit Patel...');
    const initialLeads = [
      { full_name: 'Amit Lead One', age: 30, gender: 'Male', phone_number: '1112223330', appointment_type: 'Doctor Consultation' },
      { full_name: 'Amit Lead Two', age: 35, gender: 'Female', phone_number: '1112223331', appointment_type: 'Dental Consultation' },
      { full_name: 'Amit Lead Three', age: 40, gender: 'Male', phone_number: '1112223332', appointment_type: 'Therapy Services' }
    ];

    for (const temp of initialLeads) {
      const createRes = await request('POST', '/api/executive/field-appointments', temp, execToken);
      if (createRes.statusCode !== 201) {
        throw new Error(`Failed to create initial lead: ${JSON.stringify(createRes.body)}`);
      }
      const newLead = createRes.body.data || createRes.body;
      createdLeadIds.push(newLead.id);
      
      if (newLead.assigned_telecaller_id !== 5) {
        throw new Error(`Expected initial lead to be assigned to Amit Patel (ID 5), got ${newLead.assigned_telecaller_id}`);
      }
    }
    console.log('[PASS] 3 initial leads created and assigned to Amit Patel.');

    // 4. Create a new active Telecaller B
    console.log('\nStep 4: Registering a new active Telecaller B (should have 0 leads)...');
    const rand = Math.floor(100 + Math.random() * 900);
    const newTcRes = await request('POST', '/api/admin/users', {
      name: 'Telecaller Test B',
      email: `tc_b_${rand}@vvf.org`,
      password: 'telecaller123',
      role: 'Telecaller',
      phone: `9999990${rand}`
    }, adminToken);
    
    if (newTcRes.statusCode !== 201) {
      throw new Error(`Failed to create Telecaller B: ${JSON.stringify(newTcRes.body)}`);
    }
    const newTc = newTcRes.body.data.user || newTcRes.body.user;
    testTcId = newTc.id;
    console.log(`[PASS] Telecaller B created. ID: ${testTcId}`);

    // 5. Create 3 new leads as Rohan Verma (Executive)
    // With redistribution enabled, when Telecaller B joins, the 3 initial leads
    // are rebalanced (Amit gets 2, B gets 1).
    // The incoming leads will be assigned in rotation:
    // Lead 1: Amit = 2, B = 1 -> B gets it (Amit = 2, B = 2)
    // Lead 2: Amit = 2, B = 2 -> Amit gets it (Amit = 3, B = 2)
    // Lead 3: Amit = 3, B = 2 -> B gets it (Amit = 3, B = 3)
    console.log('\nStep 5: Creating 3 new leads. Expected assignments in rotation...');
    const testLeads = [
      { full_name: 'Test Lead One', age: 25, gender: 'Male', phone_number: '9991112220', appointment_type: 'Doctor Consultation' },
      { full_name: 'Test Lead Two', age: 26, gender: 'Female', phone_number: '9991112221', appointment_type: 'Dental Consultation' },
      { full_name: 'Test Lead Three', age: 27, gender: 'Other', phone_number: '9991112222', appointment_type: 'Therapy Services' }
    ];

    const expectedAssignments = [testTcId, 5, testTcId];

    for (let i = 0; i < testLeads.length; i++) {
      const temp = testLeads[i];
      const createRes = await request('POST', '/api/executive/field-appointments', temp, execToken);
      if (createRes.statusCode !== 201) {
        throw new Error(`Failed to create lead: ${JSON.stringify(createRes.body)}`);
      }
      const newLead = createRes.body.data || createRes.body;
      createdLeadIds.push(newLead.id);
      
      console.log(`Lead ${newLead.patient_lead_id} assigned to telecaller ID: ${newLead.assigned_telecaller_id}`);
      if (newLead.assigned_telecaller_id !== expectedAssignments[i]) {
        throw new Error(`Expected lead to be assigned to ID ${expectedAssignments[i]}, got: ${newLead.assigned_telecaller_id}`);
      }
    }
    console.log('[PASS] All 3 new leads successfully assigned in correct round-robin sequence.');

    // 6. Create a 4th lead (both Amit and B have 3 active leads, so it should go to one of them)
    console.log('\nStep 6: Creating a 4th lead (counts equal at 3). Checking assignment...');
    const leadFour = { full_name: 'Test Lead Four', age: 28, gender: 'Female', phone_number: '9991112223', appointment_type: 'Doctor Consultation' };
    const createResFour = await request('POST', '/api/executive/field-appointments', leadFour, execToken);
    if (createResFour.statusCode !== 201) {
      throw new Error(`Failed to create 4th lead: ${JSON.stringify(createResFour.body)}`);
    }
    const newLeadFour = createResFour.body.data || createResFour.body;
    createdLeadIds.push(newLeadFour.id);
    
    console.log(`4th Lead ${newLeadFour.patient_lead_id} assigned to telecaller ID: ${newLeadFour.assigned_telecaller_id}`);
    if (newLeadFour.assigned_telecaller_id !== 5 && newLeadFour.assigned_telecaller_id !== testTcId) {
      throw new Error(`Expected 4th lead to be assigned to Amit (ID 5) or Telecaller B (ID ${testTcId}), got: ${newLeadFour.assigned_telecaller_id}`);
    }
    console.log('[PASS] 4th lead successfully assigned to an active telecaller.');

    // 7. Cleanup
    console.log('\nStep 7: Cleaning up test data...');
    await request('DELETE', `/api/users/${testTcId}`, null, adminToken);
    console.log('[PASS] Soft-deleted test telecaller B.');

    if (otherActiveTelecallers.length > 0) {
      console.log('Restoring temporarily deactivated telecallers...');
      for (const tc of otherActiveTelecallers) {
        await request('PUT', `/api/users/${tc.id}`, { is_active: true }, adminToken);
      }
      console.log('[PASS] Temporarily deactivated telecallers restored.');
    }

    console.log('\n=== ALL SIMPLIFIED LEAD ASSIGNMENT TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    if (otherActiveTelecallers.length > 0 && adminToken) {
      console.log('Restoring temporarily deactivated telecallers after error...');
      for (const tc of otherActiveTelecallers) {
        try {
          await request('PUT', `/api/users/${tc.id}`, { is_active: true }, adminToken);
        } catch (restoreErr) {
          console.error(`Failed to restore telecaller ${tc.id}:`, restoreErr.message);
        }
      }
    }
    console.error('\n[FAIL] Simplified lead assignment test scenario failed:', err.message || err);
    process.exit(1);
  }
}

runTests();
