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

// Simple multipart helper for file uploads in Node.js
function uploadFileRequest(path, fields, fileBuffer, fileName, fileMime, token = null) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    let payload = [];

    // Add fields
    for (const [key, value] of Object.entries(fields)) {
      payload.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }

    // Add file
    payload.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${fileName}"\r\nContent-Type: ${fileMime}\r\n\r\n`));
    payload.push(fileBuffer);
    payload.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const totalLength = payload.reduce((acc, buf) => acc + buf.length, 0);
    options.headers['Content-Length'] = totalLength;

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

    payload.forEach(part => req.write(part));
    req.end();
  });
}

async function runTests() {
  console.log('=== VVF Healthcare visit Flow & Coordinates Validation Test ===');
  let execToken = null;
  let adminToken = null;
  let activeVisitId = null;

  try {
    // 1. Logins
    console.log('\nStep 1: Authenticating roles...');
    const execLogin = await request('POST', '/api/auth/login', {
      email: 'executive@vvf.org',
      password: 'executive123'
    });
    if (execLogin.statusCode !== 200) {
      throw new Error(`Executive login failed: ${JSON.stringify(execLogin.body)}`);
    }
    execToken = execLogin.body.token || execLogin.body.data.token;
    console.log('[PASS] Executive authenticated.');

    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@vvf.org',
      password: 'admin123'
    });
    if (adminLogin.statusCode !== 200) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
    }
    adminToken = adminLogin.body.token || adminLogin.body.data.token;
    console.log('[PASS] Admin authenticated.');

    // 2. Google Maps URL coordinates extraction test via Geocoding API
    console.log('\nStep 2: Testing geocoder on search/place URLs...');
    // Search link
    const searchUrl = 'https://www.google.com/maps/search/Bangaramma+Hospitals/@17.719152,83.298287,15z';
    const searchRes = await request('GET', `/api/hospitals/geocode-address?address=Visakhapatnam&google_maps_link=${encodeURIComponent(searchUrl)}`, null, adminToken);
    if (searchRes.statusCode !== 200 || searchRes.body.data.latitude !== 17.719152 || searchRes.body.data.longitude !== 83.298287) {
      throw new Error(`Failed to extract coordinates from search URL: ${JSON.stringify(searchRes.body)}`);
    }
    console.log(`[PASS] Search URL coords extracted successfully: Lat=${searchRes.body.data.latitude}, Lng=${searchRes.body.data.longitude}`);

    // Place link
    const placeUrl = 'https://www.google.com/maps/place/Bangaramma+Hospitals/@17.719152,83.298287,15z/data=!4m6!3m5!1s0x3a39434dec59a585:0x1ff2619cd09a6568!8m2!3d17.719152!4d83.298287!16s%2Fg%2F11b7zdzl0r?entry=ttu';
    const placeRes = await request('GET', `/api/hospitals/geocode-address?address=Visakhapatnam&google_maps_link=${encodeURIComponent(placeUrl)}`, null, adminToken);
    if (placeRes.statusCode !== 200 || placeRes.body.data.latitude !== 17.719152 || placeRes.body.data.longitude !== 83.298287) {
      throw new Error(`Failed to extract coordinates from place URL: ${JSON.stringify(placeRes.body)}`);
    }
    console.log(`[PASS] Place URL coords extracted successfully: Lat=${placeRes.body.data.latitude}, Lng=${placeRes.body.data.longitude}`);

    // 3. Hospital dynamic coordinates fetch verification
    console.log('\nStep 3: Checking coordinates for Bangaramma Hospitals (VVF-005)...');
    const hospitalsRes = await request('GET', '/api/hospitals', null, adminToken);
    const hospitals = hospitalsRes.body.hospitals || hospitalsRes.body.data.hospitals;
    const bangaramma = hospitals.find(h => h.hospital_uid === 'VVF-005');
    if (!bangaramma) {
      throw new Error('Bangaramma Hospitals (VVF-005) not found in directory.');
    }
    console.log(`Bangaramma Hospitals coordinates are Lat: ${bangaramma.latitude}, Lng: ${bangaramma.longitude}, Allowed Radius: ${bangaramma.allowed_radius}m`);
    if (Math.abs(Number(bangaramma.latitude) - 17.719152) > 0.001 || Math.abs(Number(bangaramma.longitude) - 83.298287) > 0.001) {
      throw new Error(`Incorrect coordinates for Bangaramma. Expected Visakhapatnam coordinates near 17.719152, 83.298287 but found ${bangaramma.latitude}, ${bangaramma.longitude}`);
    }
    console.log('[PASS] Bangaramma Hospitals coordinates verified at Visakhapatnam!');

    // 4. Start visit check-in without a photo
    console.log('\nStep 4: Checking in to visit without check-in photo evidence...');
    // Clear any previous active visits of this executive to allow check-in
    const activeRes = await request('GET', '/api/visits?type=field', null, execToken);
    const activeVisits = (activeRes.body.visits || activeRes.body.data.visits || []).filter(
      v => ['Checked In', 'Partially Completed', 'Pending Evidence', 'In Progress'].includes(v.status)
    );
    for (const active of activeVisits) {
      console.log(`Discarding previous active visit #${active.id}`);
      await request('DELETE', `/api/visits/${active.id}`, null, execToken);
    }

    const checkInPayload = {
      hospital_id: bangaramma.id.toString(),
      gps_lat: '17.719152',
      gps_lng: '83.298287',
      gps_accuracy: '10',
      device_info: 'Node.js Test Agent',
      is_mock_location: 'false',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      captured_at: new Date().toISOString(),
      visit_type: 'Field Visit'
    };

    const checkInRes = await uploadFileRequest(
      '/api/visits/start',
      checkInPayload,
      Buffer.from(''),
      '',
      'application/octet-stream',
      execToken
    );

    if (checkInRes.statusCode !== 201) {
      throw new Error(`Check-in failed: ${JSON.stringify(checkInRes.body)}`);
    }

    const visit = checkInRes.body.visit || checkInRes.body.data.visit;
    activeVisitId = visit.id;
    console.log(`[PASS] Checked in successfully! Visit ID: ${activeVisitId}, Status: ${visit.status}`);

    // 4b. Test checkout validation blocks when notes are empty
    console.log('\nStep 4b: Attempting to complete visit with no notes...');
    const failComplete = await uploadFileRequest(
      `/api/visits/${activeVisitId}/complete`,
      { notes: '', summary: '' },
      Buffer.from(''),
      '',
      'application/octet-stream',
      execToken
    );
    if (failComplete.statusCode === 400 && failComplete.body.message.includes('note')) {
      console.log('[PASS] Blocked completing visit without notes successfully!');
    } else {
      throw new Error(`Failed to block checkout without notes. Status: ${failComplete.statusCode}, Body: ${JSON.stringify(failComplete.body)}`);
    }

    // 5. Save notes observations PUT /api/visits/:id/notes
    console.log('\nStep 5: Updating visit notes observations...');
    const notesPayload = {
      notes: 'Met hospital administrator. Discussed diagnostic packages. Collected 3 new leads.',
      summary: 'Observational Checklist Complete'
    };
    const notesRes = await request('PUT', `/api/visits/${activeVisitId}/notes`, notesPayload, execToken);
    if (notesRes.statusCode !== 200 || !notesRes.body.success) {
      throw new Error(`Notes update failed: ${JSON.stringify(notesRes.body)}`);
    }
    console.log(`[PASS] Notes saved successfully. Visit Progress: ${notesRes.body.visit.completion_progress}%`);

    // 6. Test photo upload with dynamic geofence checks
    console.log('\nStep 6: Uploading photo evidence inside allowed radius...');
    const dummyJpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
      0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08,
      0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9
    ]);

    const uploadPayload = {
      gps_lat: '17.719152',
      gps_lng: '83.298287',
      gps_accuracy: '10',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      captured_at: new Date().toISOString()
    };

    const uploadRes = await uploadFileRequest(
      `/api/visits/${activeVisitId}/photos`,
      uploadPayload,
      dummyJpg,
      'test_photo.jpg',
      'image/jpeg',
      execToken
    );

    if (uploadRes.statusCode !== 201) {
      throw new Error(`Photo upload failed: ${JSON.stringify(uploadRes.body)}`);
    }
    console.log(`[PASS] Photo uploaded successfully. Inside geofence: ${uploadRes.body.data.is_inside_geofence}`);

    // 7. Test photo query contains collector user's name
    console.log('\nStep 7: Checking get visit response includes u.name as captured_by_name...');
    const detailsRes = await request('GET', `/api/visits/${activeVisitId}`, null, execToken);
    const visitDetails = detailsRes.body.visit || detailsRes.body.data.visit;
    if (!visitDetails.photos || visitDetails.photos.length === 0) {
      throw new Error('No photos returned in details payload.');
    }
    const uploadedPhoto = visitDetails.photos[0];
    console.log(`Photo upload meta: URL=${uploadedPhoto.photo_url}, Collector=${uploadedPhoto.captured_by_name}`);
    if (!uploadedPhoto.captured_by_name) {
      throw new Error('captured_by_name is missing or null on the visit photo object.');
    }
    console.log('[PASS] captured_by_name successfully resolved on visit photo!');

    // 8. Test checkout completion succeeds when notes are filled
    console.log('\nStep 8: Completing visit with notes filled...');
    const completeRes = await uploadFileRequest(
      `/api/visits/${activeVisitId}/complete`,
      { notes: 'Final observations notes', summary: 'Checklist summary' },
      Buffer.from(''),
      '',
      'application/octet-stream',
      execToken
    );
    if (completeRes.statusCode !== 200) {
      throw new Error(`Failed to complete visit: ${JSON.stringify(completeRes.body)}`);
    }
    console.log('[PASS] Visit completed successfully with notes!');

    console.log('\nAll visit workflow and coordinate validation tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] Test step failed:', err.message || err);
    process.exit(1);
  }
}

runTests();
