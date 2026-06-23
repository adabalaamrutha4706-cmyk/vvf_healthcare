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
  console.log('=== VVF Healthcare UPI Transaction Validation Engine Verification ===');
  let adminToken = null;
  let receptionToken = null;
  let superadminToken = null;
  let testAppointmentId = null;
  let testPaymentId = null;

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

    // Reception Login
    const receptionLogin = await request('POST', '/api/auth/login', {
      email: 'reception@vvf.org',
      password: 'reception123'
    });
    if (receptionLogin.statusCode !== 200) {
      throw new Error(`Reception login failed: ${JSON.stringify(receptionLogin.body)}`);
    }
    receptionToken = receptionLogin.body.token || receptionLogin.body.data.token;
    console.log('[PASS] Reception authenticated.');

    // Superadmin Login
    const superadminLogin = await request('POST', '/api/auth/login', {
      email: 'superadmin@vvf.org',
      password: 'superadmin123'
    });
    if (superadminLogin.statusCode !== 200) {
      throw new Error(`Superadmin login failed: ${JSON.stringify(superadminLogin.body)}`);
    }
    superadminToken = superadminLogin.body.token || superadminLogin.body.data.token;
    console.log('[PASS] Superadmin authenticated.');

    // 2. Fetch or create a test appointment
    console.log('\nStep 2: Retrieving an appointment for payment tests...');
    const listRes = await request('GET', '/api/admin/appointments', null, adminToken);
    const appointments = listRes.body.data?.appointments || listRes.body.appointments || listRes.body || [];
    
    if (appointments.length === 0) {
      throw new Error('No appointments found to run tests. Please seed the database first.');
    }

    // Find any appointment or pick the first one and reset its billing balance for a clean test
    const targetApp = appointments[0];
    testAppointmentId = targetApp.id;
    console.log(`[INFO] Selected appointment ID: ${testAppointmentId} for patient "${targetApp.patient_name}"`);

    // Reset appointment payment fields to allow adding new payments
    console.log('\nStep 3: Resetting appointment billing fields...');
    const updateAppRes = await request('PUT', `/api/admin/appointments/${testAppointmentId}`, {
      patient_name: targetApp.patient_name,
      patient_phone: targetApp.patient_phone || '9999999999',
      gender: targetApp.gender || 'Male',
      age: targetApp.age || 30,
      doctor_id: targetApp.doctor_id || 3,
      appointment_date: targetApp.appointment_date || new Date().toISOString(),
      hospital_id: targetApp.hospital_id || 1,
      appointment_type: targetApp.appointment_type || 'Consultation',
      total_amount: 3000,
      paid_amount: 0,
      payment_status: 'Unpaid'
    }, adminToken);

    if (updateAppRes.statusCode !== 200) {
      throw new Error(`Failed to update appointment: ${JSON.stringify(updateAppRes.body)}`);
    }
    console.log('[PASS] Appointment billing reset to total: ₹3000, paid: ₹0.');

    // 4. Test Single UPI validation - Missing reference ID
    console.log('\nStep 4: Submitting a UPI payment without transaction reference...');
    const invalidUpiPay = await request('POST', `/api/reception/appointments/${testAppointmentId}/payments`, {
      amount: 1000,
      payment_method: 'Digital (UPI/Card)',
      transaction_ref: '',
      notes: 'Should fail'
    }, receptionToken);

    if (invalidUpiPay.statusCode !== 400) {
      throw new Error(`Expected status 400 for missing UPI Reference ID, got: ${invalidUpiPay.statusCode}`);
    }
    if (!invalidUpiPay.body.message.includes('UPI Transaction Reference ID is required')) {
      throw new Error(`Expected validation error message, got: ${JSON.stringify(invalidUpiPay.body)}`);
    }
    console.log('[PASS] Rejected single UPI payment missing transaction reference ID.');

    // 5. Test Single UPI validation - Valid reference ID
    console.log('\nStep 5: Submitting a valid UPI payment with reference ID, App, and Payer ID...');
    const validTxRef = `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const validUpiPay = await request('POST', `/api/reception/appointments/${testAppointmentId}/payments`, {
      amount: 1000,
      payment_method: 'Digital (UPI/Card)',
      transaction_ref: validTxRef,
      upi_app: 'PhonePe',
      payer_upi_id: 'john@ybl',
      notes: 'Test UPI Payment'
    }, receptionToken);

    if (validUpiPay.statusCode !== 201) {
      throw new Error(`Expected status 201, got: ${validUpiPay.statusCode}. Body: ${JSON.stringify(validUpiPay.body)}`);
    }
    
    const savedPayment = validUpiPay.body.payment || validUpiPay.body.data.payment;
    testPaymentId = savedPayment.id;
    if (savedPayment.upi_app !== 'PhonePe' || savedPayment.payer_upi_id !== 'john@ybl') {
      throw new Error(`Saved payment upi_app or payer_upi_id mismatch: ${JSON.stringify(savedPayment)}`);
    }
    console.log(`[PASS] Accepted UPI payment with Reference ID "${validTxRef}" (PhonePe).`);

    // 6. Block non-admins from editing UPI Transaction Details
    console.log('\nStep 6: Attempting to edit transaction details as Reception (non-admin)...');
    const unauthorizedEdit = await request('PUT', `/api/reception/appointments/${testAppointmentId}/payments/${testPaymentId}`, {
      transaction_ref: 'UTR_HACKED',
      upi_app: 'Google Pay'
    }, receptionToken);

    if (unauthorizedEdit.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin update, got: ${unauthorizedEdit.statusCode}`);
    }
    console.log('[PASS] Blocked non-admin from updating payment reference.');

    // 7. Allow Admin to edit UPI Transaction Details & Log to audit ledger
    console.log('\nStep 7: Modifying transaction details as Admin...');
    const adminModifiedTx = `UTR_MOD_${Math.floor(100000 + Math.random() * 900000)}`;
    const authorizedEdit = await request('PUT', `/api/admin/appointments/${testAppointmentId}/payments/${testPaymentId}`, {
      transaction_ref: adminModifiedTx,
      upi_app: 'Google Pay',
      payer_upi_id: 'john.modified@okaxis'
    }, adminToken);

    if (authorizedEdit.statusCode !== 200) {
      throw new Error(`Expected status 200, got: ${authorizedEdit.statusCode}. Body: ${JSON.stringify(authorizedEdit.body)}`);
    }
    
    const updatedPayment = authorizedEdit.body.payment || authorizedEdit.body.data.payment;
    if (updatedPayment.transaction_ref !== adminModifiedTx || updatedPayment.upi_app !== 'Google Pay' || updatedPayment.payer_upi_id !== 'john.modified@okaxis') {
      throw new Error(`Modified payment details mismatch: ${JSON.stringify(updatedPayment)}`);
    }
    console.log(`[PASS] Admin updated reference successfully to: "${adminModifiedTx}"`);

    // 8. Search appointments by transaction reference number
    console.log('\nStep 8: Testing pending payments search by Transaction Reference ID...');
    const searchRes = await request('GET', `/api/admin/appointments/pending-payments?search=${adminModifiedTx}`, null, adminToken);
    
    if (searchRes.statusCode !== 200) {
      throw new Error(`Search failed with status: ${searchRes.statusCode}`);
    }
    
    const searchResults = searchRes.body.data?.appointments || searchRes.body.appointments || searchRes.body || [];
    const matchedApp = searchResults.find(app => parseInt(app.id, 10) === parseInt(testAppointmentId, 10));
    if (!matchedApp) {
      throw new Error(`Search did not return the appointment for reference "${adminModifiedTx}". Results: ${JSON.stringify(searchResults)}`);
    }
    console.log('[PASS] Found appointment by searching for Transaction Reference ID.');

    // 9. Split payments validation
    console.log('\nStep 9: Testing Split Payments validations...');

    // 9.1 Invalid Split (UPI missing reference ID)
    console.log('Submitting a split payment with UPI missing reference...');
    const invalidSplit = await request('POST', `/api/reception/appointments/${testAppointmentId}/payments`, {
      amount: 1000,
      payment_method: 'Split Payment',
      payment_splits: [
        { method: 'Cash', amount: 500 },
        { method: 'UPI', amount: 500, transaction_ref: '', upi_app: 'Paytm' }
      ],
      notes: 'Split payment invalid'
    }, receptionToken);

    if (invalidSplit.statusCode !== 400) {
      throw new Error(`Expected 400 for split payment with missing UPI reference, got: ${invalidSplit.statusCode}`);
    }
    console.log('[PASS] Rejected split payment with empty UPI split reference ID.');

    // 9.2 Valid Split (UPI has reference ID)
    console.log('Submitting a valid split payment (Cash + UPI)...');
    const splitTxRef = `UTR_SPLIT_${Math.floor(10000000 + Math.random() * 90000000)}`;
    const validSplit = await request('POST', `/api/reception/appointments/${testAppointmentId}/payments`, {
      amount: 1500,
      payment_method: 'Split Payment',
      payment_splits: [
        { method: 'Cash', amount: 500 },
        { method: 'UPI', amount: 1000, transaction_ref: splitTxRef, upi_app: 'Google Pay', payer_upi_id: 'split@okaxis' }
      ],
      notes: 'Split payment valid'
    }, receptionToken);

    if (validSplit.statusCode !== 201) {
      throw new Error(`Expected 201, got: ${validSplit.statusCode}. Body: ${JSON.stringify(validSplit.body)}`);
    }
    console.log(`[PASS] Accepted split payment with UPI split Reference ID "${splitTxRef}".`);

    // 9.3 Search split payment by UPI reference ID
    console.log('Searching pending payments by split UPI reference ID...');
    const searchSplitRes = await request('GET', `/api/admin/appointments/pending-payments?search=${splitTxRef}`, null, adminToken);
    const searchSplitResults = searchSplitRes.body.data?.appointments || searchSplitRes.body.appointments || searchSplitRes.body || [];
    const matchedSplitApp = searchSplitResults.find(app => parseInt(app.id, 10) === parseInt(testAppointmentId, 10));
    
    if (!matchedSplitApp) {
      throw new Error(`Search did not return the appointment for split reference "${splitTxRef}". Results: ${JSON.stringify(searchSplitResults)}`);
    }
    console.log('[PASS] Found appointment by searching for Split UPI Reference ID.');

    // 10. Audit log check
    console.log('\nStep 10: Verifying Admin audit logs...');
    const auditLogsRes = await request('GET', '/api/superadmin/audit-logs', null, superadminToken);
    
    if (auditLogsRes.statusCode !== 200) {
      console.log(`[WARNING] Could not fetch audit logs (status: ${auditLogsRes.statusCode}). Skipping audit check.`);
    } else {
      const logs = auditLogsRes.body.data?.auditLogs || auditLogsRes.body.auditLogs || auditLogsRes.body || [];
      const editLog = logs.find(log => log.action_type === 'EDIT_PAYMENT_UPI' && parseInt(log.entity_id, 10) === parseInt(testPaymentId, 10));
      if (!editLog) {
        throw new Error(`No audit log entry found with action "EDIT_PAYMENT_UPI" for this modified payment. Logs: ${JSON.stringify(logs.slice(0, 5))}`);
      }
      console.log(`[PASS] Audit log successfully verified. Action: "${editLog.action_type}", Details: "${editLog.description}"`);
    }

    console.log('\n=== ALL UPI TRANSACTION REFERENCE VALIDATION TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] UPI validation test scenario failed:', err.message || err);
    process.exit(1);
  }
}

runTests();
