const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const projectRef = 'skbikcqrqyoxezflxshx';
const password = 'Venkateswara_healthcare';
const host = 'aws-1-ap-south-1.pooler.supabase.com';

async function runMigrations() {
  console.log(`Connecting to ${host}...`);
  const client = new Client({
    host,
    port: 5432,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    const sqlPath = path.join(__dirname, 'migrations_security.sql');
    console.log(`Reading SQL from ${sqlPath}...`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration script (this might take a few seconds)...');
    await client.query(sql);
    console.log('SUCCESS: Migration completed successfully!');
  } catch (err) {
    console.error('FAIL:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
