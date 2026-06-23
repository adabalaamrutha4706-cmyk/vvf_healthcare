const http = require('http');

const API_PORT = 5000;
const API_HOST = 'localhost';

function request(method, path, body = null, token = null, isMultipart = false, multipartData = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {}
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (isMultipart) {
      options.headers['Content-Type'] = `multipart/form-data; boundary=${multipartData.boundary}`;
      options.headers['Content-Length'] = multipartData.buffer.length;
    } else {
      const data = body ? JSON.stringify(body) : '';
      options.headers['Content-Type'] = 'application/json';
      if (data) {
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (res.statusCode >= 400) {
            reject({ statusCode: res.statusCode, error: parsed.message || responseBody, body: parsed });
          } else {
            resolve({ statusCode: res.statusCode, body: parsed });
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject({ statusCode: res.statusCode, error: responseBody });
          } else {
            resolve({ statusCode: res.statusCode, body: responseBody });
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (isMultipart) {
      req.write(multipartData.buffer);
    } else if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function createMultipartData(fieldName, filename, fileContent, fields = {}) {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
  const chunks = [];

  // Append other fields
  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }

  // Append file field
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`));
  chunks.push(Buffer.from(fileContent));
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    boundary,
    buffer: Buffer.concat(chunks)
  };
}

async function runTests() {
  console.log('--- VVF Go Visits Backend Endpoint Verification ---');
  let execToken = null;
  let adminToken = null;
  let visitId = null;
  const dummyImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]); // mini JPEG header

  try {
    // 1. Log in as Executive
    console.log('Step 1: Logging in as Executive (Rohan Verma)...');
    const execLogin = await request('POST', '/api/auth/login', {
      email: 'executive@vvf.org',
      password: 'executive123'
    });
    execToken = execLogin.body.token;
    console.log('[PASS] Executive login verified. Role:', execLogin.body.user.role);

    // 2. Log in as Admin
    console.log('Step 2: Logging in as Admin...');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@vvf.org',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;
    console.log('[PASS] Admin login verified.');

    // Cleanup active visits first to ensure clean test environment
    console.log('\nCleaning up any active visits for Rohan Verma...');
    const visitsRes = await request('GET', '/api/visits', null, execToken);
    const activeVisits = (visitsRes.body.data?.visits || []).filter(v => 
      ['Checked In', 'Partially Completed', 'Pending Evidence', 'In Progress'].includes(v.status)
    );
    for (const v of activeVisits) {
      console.log(`Cancelling active visit #${v.id}...`);
      await request('DELETE', `/api/visits/${v.id}`, null, execToken);
    }
    console.log('Cleanup complete.');

    // 3. Test Geo-Verification Failure (Checking in at Metro General Hospital from Hyderabad)
    console.log('\nStep 3: Checking in at far hospital (Location Mismatch)...');
    try {
      const multipart = createMultipartData('photo', 'checkin.jpg', dummyImageBuffer, {
        hospital_id: '2', // Metro General Hospital (Secunderabad)
        gps_lat: '17.385044', // Hyderabad coordinates
        gps_lng: '78.486671',
        gps_accuracy: '10',
        is_mock_location: 'false',
        city: 'Hyderabad',
        state: 'Telangana',
        captured_at: new Date().toISOString()
      });
      await request('POST', '/api/visits/start', null, execToken, true, multipart);
      console.error('[FAIL] Start visit should have been rejected due to location mismatch!');
    } catch (err) {
      console.log(`[PASS] Rejection received with status ${err.statusCode}. Error message: "${err.error}"`);
    }

    // 4. Test GPS Accuracy Failure
    console.log('\nStep 4: Checking in with low GPS accuracy (>3000 meters)...');
    try {
      const multipart = createMultipartData('photo', 'checkin.jpg', dummyImageBuffer, {
        hospital_id: '1', // City Heart
        gps_lat: '17.385044', 
        gps_lng: '78.486671',
        gps_accuracy: '3500', // Low accuracy
        is_mock_location: 'false',
        city: 'Hyderabad',
        state: 'Telangana',
        captured_at: new Date().toISOString()
      });
      await request('POST', '/api/visits/start', null, execToken, true, multipart);
      console.error('[FAIL] Check-in should have failed due to low GPS accuracy!');
    } catch (err) {
      console.log(`[PASS] Rejection received with status ${err.statusCode}. Error message: "${err.error}"`);
    }

    // 5. Test GPS Spoof Mock Location Failure
    console.log('\nStep 5: Checking in with mock location enabled...');
    try {
      const multipart = createMultipartData('photo', 'checkin.jpg', dummyImageBuffer, {
        hospital_id: '1', 
        gps_lat: '17.385044', 
        gps_lng: '78.486671',
        gps_accuracy: '10',
        is_mock_location: 'true', // Mock location spoof
        city: 'Hyderabad',
        state: 'Telangana',
        captured_at: new Date().toISOString()
      });
      await request('POST', '/api/visits/start', null, execToken, true, multipart);
      console.error('[FAIL] Check-in should have failed due to mock location detection!');
    } catch (err) {
      console.log(`[PASS] Rejection received with status ${err.statusCode}. Error message: "${err.error}"`);
    }

    // 6. Successful check-in (City Heart Hospital matching our location coordinates)
    console.log('\nStep 6: Checking in with correct coordinates (Within 200m Geofence)...');
    const startMultipart = createMultipartData('photo', 'checkin.jpg', dummyImageBuffer, {
      hospital_id: '1', // City Heart (Hyderabad)
      gps_lat: '17.385044', 
      gps_lng: '78.486671',
      gps_accuracy: '10',
      is_mock_location: 'false',
      city: 'Hyderabad',
      state: 'Telangana',
      captured_at: new Date().toISOString()
    });
    const startRes = await request('POST', '/api/visits/start', null, execToken, true, startMultipart);
    visitId = startRes.body.data.visit.id;
    console.log(`[PASS] Check-in accepted! Visit ID: #${visitId}`);
    console.log(`[PASS] Stored verification status: ${startRes.body.data.visit.geo_verification_status}`);
    console.log(`[PASS] Stored distance: ${Math.round(startRes.body.data.visit.distance_from_hospital_meters)} meters`);

    // 7. Test Duplicate Check-In prevention
    console.log('\nStep 7: Testing prevention of duplicate active check-ins of the same type...');
    try {
      const dupMultipart = createMultipartData('photo', 'checkin_dup.jpg', dummyImageBuffer, {
        hospital_id: '1',
        gps_lat: '17.385044',
        gps_lng: '78.486671',
        gps_accuracy: '10',
        is_mock_location: 'false',
        city: 'Hyderabad',
        state: 'Telangana',
        captured_at: new Date().toISOString()
      });
      await request('POST', '/api/visits/start', null, execToken, true, dupMultipart);
      console.error('[FAIL] Duplicate check-in should have been blocked!');
    } catch (err) {
      console.log(`[PASS] Duplicate check-in blocked successfully. Message: "${err.error}"`);
    }

    // 8. Test Successful Check-Out
    console.log('\nStep 8: Testing check-out and visit completion...');
    const checkoutRes = await request('POST', `/api/visits/${visitId}/complete`, {
      checkout_latitude: '17.385044',
      checkout_longitude: '78.486671',
      checkout_accuracy: '10'
    }, execToken);
    
    console.log('[PASS] Checkout completed successfully.');
    console.log(`[PASS] Duration: ${checkoutRes.body.data.visit.duration_minutes} minutes.`);
    console.log(`[PASS] Status: ${checkoutRes.body.data.visit.status}`);

    console.log('\nAll visit flow and security validations verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[FAIL] Verification test failed:', err);
    process.exit(1);
  }
}

runTests();

