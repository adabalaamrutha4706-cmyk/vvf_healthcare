const { Client } = require('pg');

const projectRef = 'skbikcqrqyoxezflxshx';
const password = 'Venkateswara_healthcare';
const host = 'aws-1-ap-south-1.pooler.supabase.com';

async function testWithAws1() {
  console.log(`Testing connection to ${host} on port 5432 (Session Mode)...`);
  const client = new Client({
    host,
    port: 5432,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log('SUCCESS: Connected successfully to aws-1!');
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




