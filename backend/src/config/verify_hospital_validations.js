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
  console.log('=== VVF Healthcare Hospital Registry Enterprise Verification ===');
  let token = null;

  try {
    // 1. Admin Login
    console.log('\nStep 1: Admin Login...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'admin@vvf.org',
      password: 'admin123'
    });
    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed with status ${loginRes.statusCode}`);
    }
    token = loginRes.body.token || loginRes.body.data.token;
    console.log(`[PASS] Logged in successfully. Token length: ${token.length}`);

    // 2. Test Geocoding Endpoint
    console.log('\nStep 2: Geocoding Endpoint GET /api/hospitals/geocode-address...');
    const geoRes = await request('GET', `/api/hospitals/geocode-address?address=${encodeURIComponent('Jubilee Hills, Hyderabad')}`, null, token);
    if (geoRes.statusCode !== 200 || !geoRes.body.success) {
      throw new Error(`Geocoding request failed: ${JSON.stringify(geoRes.body)}`);
    }
    console.log(`[PASS] Coordinates resolved: Lat = ${geoRes.body.data.latitude}, Lng = ${geoRes.body.data.longitude}, Status = ${geoRes.body.data.status}`);

    // 3. Create Valid Hospital
    const rand = Math.floor(1000 + Math.random() * 9000);
    const uniquePhone = '98765' + Math.floor(10000 + Math.random() * 90000);
    const validHospData = {
      name: `Delta Vascular Clinic ${rand}`,
      city: 'Hyderabad',
      state: 'Telangana',
      contact_person: 'Dr. John Doe',
      hospital_admin_name: 'Mr. Admin',
      email: 'clinic@gmail.com',
      phone: uniquePhone,
      status: 'ACTIVE',
      address: `Plot ${rand}, Road No 2, Jubilee Hills`,
      pincode: '500033',
      google_maps_link: 'https://google.com/maps?q=17.432,78.389',
      allowed_radius: 200,
      hospital_type: 'Clinic',
      visiting_hours_start: '09:00',
      visiting_hours_end: '18:00',
      territory_zone: 'West Zone',
      assigned_executives: '6',
      visit_frequency: 'Weekly'
    };

    const createRes = await request('POST', '/api/hospitals', validHospData, token);
    if (createRes.statusCode !== 201) {
      throw new Error(`Create hospital failed with status ${createRes.statusCode}: ${JSON.stringify(createRes.body)}`);
    }
    const createdHosp = createRes.body.hospital || createRes.body.data.hospital;
    const createdId = createdHosp.id;
    console.log(`[PASS] Hospital registered. ID: ${createdId}`);
    console.log(`[PASS] Hospital UID generated: ${createdHosp.hospital_uid}`);
    console.log(`[PASS] Geo status: ${createdHosp.geo_verification_status}`);
    console.log(`[PASS] Assigned executive resolved names: ${createdHosp.assigned_executives_names}`);

    // 4. Test Duplicate Clinic Prevention (Name + Address)
    console.log('\nStep 4: Re-registering clinic with duplicate Name and Address...');
    const dupRes = await request('POST', '/api/hospitals', {
      ...validHospData,
      phone: '9999999999' // different phone to isolate duplicate name+address check
    }, token);
    if (dupRes.statusCode === 400 && dupRes.body.errorCode === 'DUPLICATE_HOSPITAL') {
      console.log('[PASS] Rejected duplicate clinic registration successfully!');
    } else {
      throw new Error(`Duplicate clinic check failed! Status: ${dupRes.statusCode}, body: ${JSON.stringify(dupRes.body)}`);
    }

    // 5. Test Duplicate Phone Prevention
    console.log('\nStep 5: Testing duplicate phone number prevention...');
    const dupPhoneRes = await request('POST', '/api/hospitals', {
      ...validHospData,
      name: 'Beta Vascular Clinic', // different name
      address: 'Plot 99, Gachibowli' // different address
    }, token);
    if (dupPhoneRes.statusCode === 400 && dupPhoneRes.body.errorCode === 'DUPLICATE_PHONE') {
      console.log('[PASS] Rejected duplicate contact number successfully!');
    } else {
      throw new Error(`Duplicate phone check failed! Status: ${dupPhoneRes.statusCode}, body: ${JSON.stringify(dupPhoneRes.body)}`);
    }

    // 6. Test Input Validations and Validation Warnings
    console.log('\nStep 6: Testing allowed radius, contact numbers, POC name, admin name, and email validation limits...');
    
    // Invalid Radius & Phone
    const invalidRes = await request('POST', '/api/hospitals', {
      ...validHospData,
      allowed_radius: 1200, // Invalid: exceeds 1000m max
      phone: '123456789012' // Invalid: exceeds 10 digits
    }, token);
    if (invalidRes.statusCode === 400 && invalidRes.body.errorCode === 'VALIDATION_ERROR') {
      console.log('[PASS] Blocked invalid allowed radius and too long phone correctly.');
    } else {
      throw new Error(`Strict validation failed to block invalid allowed radius. Status: ${invalidRes.statusCode}, body: ${JSON.stringify(invalidRes.body)}`);
    }

    // Invalid Email Domain (Not @gmail.com)
    const invalidEmailRes = await request('POST', '/api/hospitals', {
      ...validHospData,
      email: 'test@yahoo.com'
    }, token);
    if (invalidEmailRes.statusCode === 400 && invalidEmailRes.body.errorCode === 'VALIDATION_ERROR') {
      console.log('[PASS] Blocked non-gmail address domain successfully.');
    } else {
      throw new Error(`Strict validation failed to block non-gmail email. Status: ${invalidEmailRes.statusCode}`);
    }

    // Invalid POC Name (exceeds 2 full stops)
    const invalidPocRes = await request('POST', '/api/hospitals', {
      ...validHospData,
      contact_person: 'Dr. J. R. D. Tata' // 4 full stops
    }, token);
    if (invalidPocRes.statusCode === 400 && invalidPocRes.body.errorCode === 'VALIDATION_ERROR') {
      console.log('[PASS] Blocked POC name with more than two full stops successfully.');
    } else {
      throw new Error(`Strict validation failed to block POC name with extra full stops. Status: ${invalidPocRes.statusCode}`);
    }

    // Invalid Admin Name (contains numbers)
    const invalidAdminRes = await request('POST', '/api/hospitals', {
      ...validHospData,
      hospital_admin_name: 'Admin123'
    }, token);
    if (invalidAdminRes.statusCode === 400 && invalidAdminRes.body.errorCode === 'VALIDATION_ERROR') {
      console.log('[PASS] Blocked admin name containing numbers successfully.');
    } else {
      throw new Error(`Strict validation failed to block admin name containing numbers. Status: ${invalidAdminRes.statusCode}`);
    }

    // Check Warning trigger (>300m)
    console.log('Testing warning trigger for check-in radius > 300m...');
    const warnPhone = '98765' + Math.floor(10000 + Math.random() * 90000);
    const warnRes = await request('POST', '/api/hospitals', {
      ...validHospData,
      name: `Gamma Vascular Clinic ${rand + 1}`,
      address: `Plot ${rand + 1}, Road No 5, Jubilee Hills`,
      phone: warnPhone,
      allowed_radius: 400 // Valid but triggers warning (> 300m)
    }, token);
    if (warnRes.statusCode === 201) {
      const warnings = warnRes.body.warnings || warnRes.body.data.warnings;
      if (warnings && warnings.allowed_radius) {
        console.log(`[PASS] Warning message captured: "${warnings.allowed_radius}"`);
      } else {
        throw new Error(`Failed to return warnings: ${JSON.stringify(warnRes.body)}`);
      }
    } else {
      throw new Error(`Creation failed for warning test: ${JSON.stringify(warnRes.body)}`);
    }

    // 7. Soft-Delete and Listing Verification
    console.log('\nStep 7: Testing soft-delete and list exclusions...');
    const deleteRes = await request('DELETE', `/api/hospitals/${createdId}`, null, token);
    if (deleteRes.statusCode !== 200 || !deleteRes.body.success) {
      throw new Error(`Deletion failed: ${JSON.stringify(deleteRes.body)}`);
    }
    console.log('[PASS] Hospital soft deleted successfully.');

    // Fetch list and check if deleted hospital is excluded
    console.log('Fetching active hospitals directory...');
    const listRes = await request('GET', '/api/hospitals', null, token);
    const directory = listRes.body.hospitals || listRes.body.data.hospitals;
    const isExcluded = !directory.some(h => h.id === createdId);
    if (isExcluded) {
      console.log('[PASS] Soft-deleted hospital successfully excluded from active directory list.');
    } else {
      throw new Error('Soft-deleted hospital is still visible in active list!');
    }

    console.log('\nAll hospital validations and automated test scenarios passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] Test step failed:', err.message || err);
    process.exit(1);
  }
}

runTests();
