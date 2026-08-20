import { query } from '../config/db';

/**
 * Migration: Add staff_type classification to users and GPS tracking to attendance.
 *
 * Users table:
 *   - staff_type: 'in-staff' (default) or 'field-staff'
 *   - assigned_hospital_id: required for in-staff, references hospitals(id)
 *
 * Attendance table:
 *   - gps_latitude / gps_longitude: captured on login
 *   - geo_address: reverse-geocoded label (optional)
 *   - location_status: 'within_range', 'out_of_range', 'no_gps', 'field_location', 'pending'
 */
async function migrate() {
  console.log('Running migration: add_staff_type...');

  // --- Users table ---
  const userCols = [
    {
      name: 'staff_type',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_type VARCHAR(50) DEFAULT 'in-staff'`,
    },
    {
      name: 'assigned_hospital_id',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL`,
    },
  ];

  for (const col of userCols) {
    try {
      await query(col.sql);
      console.log(`  ✓ users.${col.name}`);
    } catch (err: any) {
      if (err.code === '42701') {
        console.log(`  – users.${col.name} already exists, skipping`);
      } else {
        throw err;
      }
    }
  }

  // --- Attendance table ---
  const attendanceCols = [
    {
      name: 'gps_latitude',
      sql: `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION`,
    },
    {
      name: 'gps_longitude',
      sql: `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION`,
    },
    {
      name: 'geo_address',
      sql: `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS geo_address TEXT`,
    },
    {
      name: 'location_status',
      sql: `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location_status VARCHAR(100) DEFAULT 'pending'`,
    },
  ];

  for (const col of attendanceCols) {
    try {
      await query(col.sql);
      console.log(`  ✓ attendance.${col.name}`);
    } catch (err: any) {
      if (err.code === '42701') {
        console.log(`  – attendance.${col.name} already exists, skipping`);
      } else {
        throw err;
      }
    }
  }

  // --- Index ---
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_users_staff_type ON users(staff_type)`);
    console.log('  ✓ index idx_users_staff_type');
  } catch (err: any) {
    console.log('  – index idx_users_staff_type skipped:', err.message);
  }

  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_users_assigned_hospital ON users(assigned_hospital_id)`);
    console.log('  ✓ index idx_users_assigned_hospital');
  } catch (err: any) {
    console.log('  – index idx_users_assigned_hospital skipped:', err.message);
  }

  console.log('Migration complete: add_staff_type');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
