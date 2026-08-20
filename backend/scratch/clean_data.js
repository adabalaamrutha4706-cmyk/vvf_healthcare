const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const cleanPostgres = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('No DATABASE_URL found. Skipping Postgres cleanup.');
    return;
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    // List of all tables to truncate
    const tablesToTruncate = [
      'audit_logs',
      'notifications',
      'visit_photos',
      'visits',
      'leads',
      'payments',
      'appointments',
      'attendance',
      'hospitals',
      'field_appointments',
      'auto_redistribution_log',
      'appointment_edit_history',
      'therapy_sessions',
      'therapy_hbot',
      'therapy_ozone',
      'therapy_physiotherapy',
      'therapy_dental',
      'therapy_pelvic_chair',
      'therapy_sipcd',
      'therapy_zero_gravity',
      'therapy_hydrogen_inhalation',
      'therapy_lab'
    ];

    console.log('Truncating tables...');
    for (const table of tablesToTruncate) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE;`);
      console.log(`Truncated table: ${table}`);
    }

    // Clean users table (keep only Superadmin and Admin)
    console.log('Cleaning users table (keeping only default admin accounts)...');
    await client.query('DELETE FROM users WHERE id NOT IN (1, 999);');

    // Reset sequences
    console.log('Resetting database sequences...');
    const sequences = [
      'users_id_seq',
      'hospitals_id_seq',
      'attendance_id_seq',
      'appointments_id_seq',
      'payments_id_seq',
      'leads_id_seq',
      'visits_id_seq',
      'visit_photos_id_seq',
      'notifications_id_seq',
      'audit_logs_id_seq',
      'field_appointments_id_seq',
      'auto_redistribution_log_id_seq',
      'appointment_edit_history_id_seq',
      'therapy_sessions_id_seq',
      'therapy_hbot_id_seq',
      'therapy_ozone_id_seq',
      'therapy_physiotherapy_id_seq',
      'therapy_dental_id_seq',
      'therapy_pelvic_chair_id_seq',
      'therapy_sipcd_id_seq',
      'therapy_zero_gravity_id_seq',
      'therapy_hydrogen_inhalation_id_seq',
      'therapy_lab_id_seq'
    ];

    for (const seq of sequences) {
      try {
        // Reset sequence to max id or 1
        const tableName = seq.replace('_id_seq', '');
        if (tableName === 'users') {
          await client.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${tableName}), 1), true);`);
        } else {
          await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1;`);
        }
        console.log(`Reset sequence: ${seq}`);
      } catch (e) {
        console.warn(`Could not reset sequence ${seq}: ${e.message}`);
      }
    }

    console.log('PostgreSQL database cleaned successfully!');
  } catch (err) {
    console.error('Error cleaning PostgreSQL database:', err);
  } finally {
    await client.end();
  }
};

const cleanLocalDb = () => {
  const localDbPath = path.join(__dirname, '../data/local_db.json');
  if (!fs.existsSync(localDbPath)) {
    console.log('No local_db.json found. Skipping local DB cleanup.');
    return;
  }

  try {
    const rawData = fs.readFileSync(localDbPath, 'utf8');
    const data = JSON.parse(rawData);

    // Filter users to keep only Superadmin (999) and Admin (1)
    const cleanUsers = (data.users || []).filter(u => u.id === 1 || u.id === 999);

    const cleanData = {
      users: cleanUsers,
      attendance: [],
      hospitals: [],
      appointments: [],
      payments: [],
      leads: [],
      visits: [],
      visit_photos: [],
      notifications: [],
      audit_logs: [],
      appointment_edit_history: [],
      field_appointments: [],
      auto_redistribution_log: [],
      therapy_sessions: [],
      therapy_hbot: [],
      therapy_ozone: [],
      therapy_physiotherapy: [],
      therapy_dental: [],
      therapy_pelvic_chair: [],
      therapy_sipcd: [],
      therapy_zero_gravity: [],
      therapy_hydrogen_inhalation: [],
      therapy_lab: []
    };

    fs.writeFileSync(localDbPath, JSON.stringify(cleanData, null, 2), 'utf8');
    console.log('local_db.json cleaned successfully!');
  } catch (err) {
    console.error('Error cleaning local_db.json:', err);
  }
};

const run = async () => {
  await cleanPostgres();
  cleanLocalDb();
  console.log('All data cleaned successfully!');
};

run();
