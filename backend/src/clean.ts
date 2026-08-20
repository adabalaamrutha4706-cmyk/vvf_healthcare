import * as fs from 'fs';
import * as path from 'path';
import { query, checkPostgresConnection } from './config/db';
import { seedDatabase } from './config/seed';

const initialData: Record<string, any[]> = {
  users: [],
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

const tablesToDrop = [
  'audit_logs',
  'notifications',
  'visit_photos',
  'visits',
  'leads',
  'payments',
  'appointments',
  'attendance',
  'hospitals',
  'users',
  'field_appointments',
  'auto_redistribution_log',
  'appointment_edit_history',
  'therapy_hbot',
  'therapy_ozone',
  'therapy_physiotherapy',
  'therapy_dental',
  'therapy_pelvic_chair',
  'therapy_sipcd',
  'therapy_zero_gravity',
  'therapy_hydrogen_inhalation',
  'therapy_lab',
  'therapy_sessions'
];

const clearDir = (dirPath: string) => {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmSync(curPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(curPath);
      }
    }
    console.log(`Cleared directory: ${dirPath}`);
  }
};

async function clean() {
  console.log('=== STARTING APPLICATION DATA CLEANUP ===');

  // 1. Clear PostgreSQL Tables if connected
  const isPostgresConnected = await checkPostgresConnection();
  if (isPostgresConnected) {
    console.log('PostgreSQL database is connected. Dropping all tables...');
    try {
      const dropQuery = `DROP TABLE IF EXISTS ${tablesToDrop.join(', ')} CASCADE;`;
      await query(dropQuery);
      console.log('Successfully dropped all PostgreSQL tables.');
    } catch (err: any) {
      console.error('Error dropping PostgreSQL tables:', err.message || err);
    }
  } else {
    console.log('PostgreSQL not active or connected. Skipping PostgreSQL drop.');
  }

  // 2. Clear Local JSON Database file
  const localDbPath = path.join(__dirname, '../data/local_db.json');
  console.log(`Resetting local database file at: ${localDbPath}`);
  try {
    fs.writeFileSync(localDbPath, JSON.stringify(initialData, null, 2), 'utf8');
    console.log('Successfully reset local JSON database to empty.');
  } catch (err: any) {
    console.error('Error resetting local JSON database:', err.message || err);
  }

  // 3. Clear Uploads
  console.log('Clearing uploaded profiles and visits assets...');
  try {
    clearDir(path.join(__dirname, '../uploads/profiles'));
    clearDir(path.join(__dirname, '../uploads/visits'));
    console.log('Uploads directories cleared.');
  } catch (err: any) {
    console.error('Error clearing upload directories:', err.message || err);
  }

  // 4. Run Seed Routine to Recreate schemas & Seed Default Users
  console.log('Re-initializing schemas and seeding default admin users...');
  try {
    await seedDatabase();
    console.log('Schemas re-initialized and seeded successfully!');
  } catch (err: any) {
    console.error('Error seeding default users/schemas:', err.message || err);
  }

  console.log('=== APPLICATION DATA CLEANUP COMPLETED ===');
  process.exit(0);
}

clean().catch(err => {
  console.error('Cleanup process failed:', err);
  process.exit(1);
});
