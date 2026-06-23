const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const usersRes = await pool.query(
      "SELECT id, name, role, is_active, is_deleted FROM users WHERE role = 'Telecaller' ORDER BY id ASC"
    );
    console.log('=== Telecallers in Database ===');
    console.table(usersRes.rows);

    const leadsRes = await pool.query(
      "SELECT id, patient_lead_id, full_name, status, lead_status, assigned_telecaller_id, assigned_telecaller_name FROM field_appointments ORDER BY id ASC"
    );
    console.log('\n=== Field Appointment Leads ===');
    console.table(leadsRes.rows.map(row => ({
      id: row.id,
      patient_lead_id: row.patient_lead_id,
      name: row.full_name,
      status: row.status,
      lead_status: row.lead_status,
      tc_id: row.assigned_telecaller_id,
      tc_name: row.assigned_telecaller_name
    })));

    // Counts per telecaller
    console.log('\n=== Active Lead Counts per Telecaller (statuses: New Lead, Contacted, Follow-up Pending, Appointment Scheduled) ===');
    const activeStatuses = ['New Lead', 'Contacted', 'Follow-up Pending', 'Appointment Scheduled'];
    
    const counts = {};
    usersRes.rows.forEach(u => {
      counts[u.name] = { total: 0, active: 0 };
    });

    leadsRes.rows.forEach(l => {
      const tcName = l.assigned_telecaller_name || 'Unassigned';
      if (!counts[tcName]) {
        counts[tcName] = { total: 0, active: 0 };
      }
      counts[tcName].total++;
      if (activeStatuses.includes(l.lead_status || l.status)) {
        counts[tcName].active++;
      }
    });

    console.table(Object.keys(counts).map(name => ({
      name,
      total_leads: counts[name].total,
      active_leads: counts[name].active
    })));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
