const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:lms_password@localhost:5432/vvf_healthcare';

async function checkHospitals() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to DB");
    
    // Check columns
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'hospitals'
    `);
    console.log("Hospitals Columns:");
    console.table(columnsRes.rows);

    // Try executing SELECT * FROM hospitals
    const res = await client.query("SELECT * FROM hospitals WHERE is_deleted = false LIMIT 5");
    console.log("Select successful, row count:", res.rows.length);
    
    await client.end();
  } catch (err) {
    console.error("Error executing query:", err);
  }
}

checkHospitals();
