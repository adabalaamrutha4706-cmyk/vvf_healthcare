const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:lms_password@localhost:5432/vvf_healthcare';

async function testWithAws1() {
  console.log(`Testing connection to database...`);
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log('SUCCESS: Connected successfully to database!');
    const res = await client.query('SELECT NOW()');
    console.log('Time:', res.rows[0].now);
    await client.end();
  } catch (err) {
    console.log('FAIL:', err.message);
    try {
      await client.end();
    } catch (e) {}
  }
}

testWithAws1();




