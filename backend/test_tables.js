const { Client } = require('pg');

const projectRef = 'skbikcqrqyoxezflxshx';
const password = 'Venkateswara_healthcare';
const host = 'aws-1-ap-south-1.pooler.supabase.com';

async function listTables() {
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
    console.log('Connected to Supabase!');
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
