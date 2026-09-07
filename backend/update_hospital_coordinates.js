const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vvf_healthcare';

async function updateCoords() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    // Update coordinates for Bangaramma Hospitals (VVF-005)
    const res = await client.query(
      `UPDATE hospitals 
       SET latitude = 17.719152, 
           longitude = 83.298287, 
           geo_verification_status = 'VERIFIED',
           updated_at = NOW() 
       WHERE id = 5 RETURNING *`
    );
    console.log('Updated Hospital Details:', JSON.stringify(res.rows[0], null, 2));
    await client.end();
  } catch (err) {
    console.error('Error updating coords:', err);
    try { client.end(); } catch (e) {}
  }
}

updateCoords();
