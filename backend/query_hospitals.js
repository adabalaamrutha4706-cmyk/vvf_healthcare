const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vvf_healthcare';

async function queryHospitalDetails() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false }
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
