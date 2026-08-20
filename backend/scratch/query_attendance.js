const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:lms_password@localhost:5432/vvf_healthcare';

async function checkAttendance() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to DB");
    const res = await client.query(`
      SELECT a.id, a.user_id, u.name, u.role, a.punch_in, a.punch_out, a.status, a.date, a.close_reason 
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.is_deleted = false
      ORDER BY a.punch_in DESC
      LIMIT 30
    `);
    console.table(res.rows);
    await client.end();
  } catch (err) {
    console.error(err);
  }
}

checkAttendance();
