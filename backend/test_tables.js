const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:lms_password@localhost:5432/vvf_healthcare';

async function listTables() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log('Connected to database!');
    const res = await client.query(`
      SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';
    `);
    console.log('Tables found:', res.rows.map(r => r.tablename));
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    try { await client.end(); } catch (e) {}
  }
}

listTables();
