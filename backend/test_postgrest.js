const https = require('https');

const supabaseUrl = 'https://skbikcqrqyoxezflxshx.supabase.co';
const anonKey = 'sb_publishable_vXCrFD6xjcev6-0f7WgOcw_3kRQbd0p';

function makeRequest(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, supabaseUrl);
    const options = {
      method,
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('Starting Supabase PostgREST RLS Verification Tests...\n');

  // Test 1: Try reading users table anonymously
  console.log('Test 1: Read public.users using Anon Key (should return empty or error)...');
  try {
    const res = await makeRequest('/rest/v1/users?select=*');
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response Body: ${res.body}`);
    if (res.statusCode === 200) {
      const users = JSON.parse(res.body);
      console.log(`Result: ${users.length === 0 ? 'PASSED (0 rows returned due to RLS)' : 'FAILED (Rows visible to anonymous!)'}\n`);
    } else {
      console.log(`Result: PASSED/BLOCKED (Status: ${res.statusCode})\n`);
    }
  } catch (e) {
    console.error('Test 1 Error:', e.message);
  }

  // Test 2: Try reading appointments table anonymously
  console.log('Test 2: Read public.appointments using Anon Key...');
  try {
    const res = await makeRequest('/rest/v1/appointments?select=*');
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response Body: ${res.body}`);
    if (res.statusCode === 200) {
      const rows = JSON.parse(res.body);
      console.log(`Result: ${rows.length === 0 ? 'PASSED (0 rows returned due to RLS)' : 'FAILED (Rows visible!)'}\n`);
    } else {
      console.log(`Result: PASSED/BLOCKED (Status: ${res.statusCode})\n`);
    }
  } catch (e) {
    console.error('Test 2 Error:', e.message);
  }

  // Test 3: Try inserting into public.payments anonymously
  console.log('Test 3: Insert into public.payments using Anon Key (should be blocked)...');
  try {
    const res = await makeRequest('/rest/v1/payments', 'POST', {}, {
      appointment_id: 9999,
      amount: 100.00,
      payment_method: 'Cash'
    });
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response Body: ${res.body}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Result: FAILED (Anonymous insert allowed!)\n');
    } else {
      console.log('Result: PASSED (Insert blocked by RLS policies)\n');
    }
  } catch (e) {
    console.error('Test 3 Error:', e.message);
  }
}

runTests();
