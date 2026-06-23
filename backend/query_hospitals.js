const { Client } = require('pg');

const projectRef = 'skbikcqrqyoxezflxshx';
const password = 'Venkateswara_healthcare';
const host = 'aws-1-ap-south-1.pooler.supabase.com';

async function queryHospitalDetails() {
  const client = new Client({
    host,
    port: 5432,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    const res = await client.query('SELECT * FROM hospitals WHERE id = 5');
    console.log('Hospital 5 Details:', JSON.stringify(res.rows[0], null, 2));
    await client.end();
  } catch (err) {
    console.error('Error:', err);
    try { client.end(); } catch (e) {}
  }
}

queryHospitalDetails();
