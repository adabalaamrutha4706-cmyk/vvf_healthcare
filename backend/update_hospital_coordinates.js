const { Client } = require('pg');

const projectRef = 'skbikcqrqyoxezflxshx';
const password = 'Venkateswara_healthcare';
const host = 'aws-1-ap-south-1.pooler.supabase.com';

async function updateCoords() {
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
