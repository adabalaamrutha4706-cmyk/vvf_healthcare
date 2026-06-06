import bcrypt from 'bcryptjs';
import { query, localDb } from './db';
import * as fs from 'fs';
import * as path from 'path';
import { standardizeHospitalUIDs } from '../migrations/standardizeHospitals';

const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);

export const seedDatabase = async () => {
  // Read and run schema.sql to ensure tables exist in Postgres
  try {
    const schemaPath = path.join(__dirname, '../../schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await query(schemaSql);
    }

    // Dynamic Alterations for Visit Verification Feature Columns
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;").catch(() => {});
    
    // Core Location Fields
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS address TEXT;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS landmark VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS google_maps_link VARCHAR(500);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS allowed_radius INTEGER DEFAULT 200;").catch(() => {});

    // Hospital Metadata
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_type VARCHAR(100) DEFAULT 'Clinic';").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS branch_code VARCHAR(50);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS visiting_hours VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS territory_zone VARCHAR(100);").catch(() => {});

    // Contact Information
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS reception_phone VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS email VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_admin_name VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS department VARCHAR(100);").catch(() => {});

    // Executive Assignment
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS assigned_executives TEXT;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS visit_frequency VARCHAR(100) DEFAULT 'Weekly';").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 0;").catch(() => {});

    // Geo-Verification Settings
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS require_gps_validation BOOLEAN DEFAULT TRUE;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS require_live_photo BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS require_checkout BOOLEAN DEFAULT TRUE;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS allow_remote_completion BOOLEAN DEFAULT TRUE;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS geofencing_enabled BOOLEAN DEFAULT TRUE;").catch(() => {});

    // Status & Audit Fields
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS created_by INTEGER;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_uid VARCHAR(50) UNIQUE;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS geo_verification_status VARCHAR(100) DEFAULT 'MANUAL_REVIEW_REQUIRED';").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS updated_by INTEGER;").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS legacy_hospital_id VARCHAR(100);").catch(() => {});

    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkin_latitude DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkin_longitude DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS geo_verification_status VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkin_time TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkout_time TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_status VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS distance_from_hospital_meters DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS device_info TEXT;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_mock_location BOOLEAN DEFAULT FALSE;").catch(() => {});
    
    await query("ALTER TABLE visit_photos ADD COLUMN IF NOT EXISTS captured_latitude DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visit_photos ADD COLUMN IF NOT EXISTS captured_longitude DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visit_photos ADD COLUMN IF NOT EXISTS captured_by INTEGER;").catch(() => {});

    // Checkout coordinates & accuracies (additional requirements)
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkout_latitude DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkout_longitude DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkout_accuracy DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkin_accuracy DOUBLE PRECISION;").catch(() => {});

    // Completion, status tracking, timestamps, reminders, and snapshots
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS evidence_uploaded BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS summary_submitted BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS observations_submitted BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS completion_progress INTEGER DEFAULT 0;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS photo_uploaded_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS summary_submitted_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS observations_submitted_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS reopened_by INTEGER;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS reminder_6h_sent BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS reminder_30m_sent BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkin_hospital_lat DOUBLE PRECISION;").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS checkin_hospital_lng DOUBLE PRECISION;").catch(() => {});

    // Users login tracking columns
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device TEXT;").catch(() => {});

    // Database indexing for dashboard performance (additional requirements)
    await query("CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_visits_executive_id ON visits(executive_id);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_visits_checkin_time ON visits(checkin_time);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);").catch(() => {});

    // Create appointment_edit_history if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS appointment_edit_history (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        edited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        edited_by_name VARCHAR(255) NOT NULL,
        edited_by_designation VARCHAR(100),
        edited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        old_values JSONB NOT NULL,
        new_values JSONB NOT NULL,
        change_summary TEXT NOT NULL
      );
    `).catch((err) => console.error('Failed to create appointment_edit_history table in Postgres:', err));

    await query("CREATE INDEX IF NOT EXISTS idx_appointment_edit_history_appointment ON appointment_edit_history(appointment_id);").catch(() => {});

    // Run VVF UID Standardization & Backfill migration
    await standardizeHospitalUIDs();

    console.log('Database schema checked/initialized successfully in Postgres.');
  } catch (err: any) {
    console.error('Failed to run schema migrations:', err.message);
  }

  const users = [
    {
      id: 999,
      name: 'VVF Super Administrator',
      email: process.env.INITIAL_SUPERADMIN_EMAIL || 'superadmin@vvf.org',
      password_hash: hashPassword(process.env.INITIAL_SUPERADMIN_PASSWORD || 'superadmin123'),
      role: 'Superadmin',
      phone: '+91 9999999990',
      is_active: true,
      is_deleted: false
    },
    {
      id: 1,
      name: 'VVF Administrator',
      email: 'admin@vvf.org',
      password_hash: hashPassword('admin123'),
      role: 'Admin',
      phone: '+91 9999999991',
      is_active: true,
      is_deleted: false
    },
    {
      id: 2,
      name: 'Dr. Venkat S. (Chief)',
      email: 'chief@vvf.org',
      password_hash: hashPassword('chief123'),
      role: 'Chief Doctor',
      phone: '+91 9999999992',
      is_active: true,
      is_deleted: false
    },
    {
      id: 3,
      name: 'Dr. Rajesh Kumar',
      email: 'doctor@vvf.org',
      password_hash: hashPassword('doctor123'),
      role: 'Doctor',
      phone: '+91 9999999993',
      is_active: true,
      is_deleted: false
    },
    {
      id: 4,
      name: 'Priya Sharma',
      email: 'reception@vvf.org',
      password_hash: hashPassword('reception123'),
      role: 'Reception',
      phone: '+91 9999999994',
      is_active: true,
      is_deleted: false
    },
    {
      id: 5,
      name: 'Amit Patel',
      email: 'telecaller@vvf.org',
      password_hash: hashPassword('telecaller123'),
      role: 'Telecaller',
      phone: '+91 9999999995',
      is_active: true,
      is_deleted: false
    },
    {
      id: 6,
      name: 'Rohan Verma',
      email: 'executive@vvf.org',
      password_hash: hashPassword('executive123'),
      role: 'Executive',
      phone: '+91 9999999996',
      is_active: true,
      is_deleted: false
    }
  ];

  const hospitals = [
    {
      id: 1,
      name: 'City Heart & Vascular Center',
      city: 'Hyderabad',
      state: 'Telangana',
      contact_person: 'Mr. K. Rao',
      phone: '+91 9876543210',
      status: 'Active',
      latitude: 17.385044,
      longitude: 78.486671,
      is_deleted: false,
      hospital_uid: 'VVF-001'
    },
    {
      id: 2,
      name: 'Metro General Hospital',
      city: 'Secunderabad',
      state: 'Telangana',
      contact_person: 'Dr. Srinivas',
      phone: '+91 9876543211',
      status: 'Active',
      latitude: 17.448293,
      longitude: 78.508544,
      is_deleted: false,
      hospital_uid: 'VVF-002'
    },
    {
      id: 3,
      name: 'Vascular Care Clinic',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      contact_person: 'Mrs. Lakshmi',
      phone: '+91 9876543212',
      status: 'Active',
      latitude: 16.506174,
      longitude: 80.648015,
      is_deleted: false,
      hospital_uid: 'VVF-003'
    },
    {
      id: 4,
      name: 'Apollo Vascular Wing',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      contact_person: 'Mr. Ramesh',
      phone: '+91 9876543213',
      status: 'Pending',
      latitude: 17.686816,
      longitude: 83.218482,
      is_deleted: false,
      geofencing_enabled: false,
      hospital_uid: 'VVF-004'
    }
  ];

  const appointments = [
    {
      id: 1,
      patient_name: 'Satish Goud',
      age: 58,
      gender: 'Male',
      contact_number: '+91 9123456780',
      hospital_id: 1,
      doctor_id: 3,
      appointment_date: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // in 2 hours
      notes: 'Varicose veins initial evaluation.',
      total_amount: 1500.00,
      paid_amount: 1500.00,
      payment_status: 'Completed',
      created_by: 4,
      is_deleted: false
    },
    {
      id: 2,
      patient_name: 'Anjali Devi',
      age: 47,
      gender: 'Female',
      contact_number: '+91 9123456781',
      hospital_id: 1,
      doctor_id: 2,
      appointment_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // tomorrow
      notes: 'Deep Vein Thrombosis follow-up check.',
      total_amount: 2000.00,
      paid_amount: 500.00,
      payment_status: 'Partially Paid',
      created_by: 4,
      is_deleted: false
    },
    {
      id: 3,
      patient_name: 'K. Jagannadhan',
      age: 65,
      gender: 'Male',
      contact_number: '+91 9123456782',
      hospital_id: 2,
      doctor_id: 3,
      appointment_date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
      notes: 'Diabetic foot ulcer consultation.',
      total_amount: 1200.00,
      paid_amount: 0.00,
      payment_status: 'Unpaid',
      created_by: 4,
      is_deleted: false
    }
  ];

  const payments = [
    {
      id: 1,
      appointment_id: 1,
      amount: 1500.00,
      payment_method: 'UPI/GPay',
      transaction_ref: 'TXN9090123',
      notes: 'Full payment received at desk',
      created_by: 4,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString()
    },
    {
      id: 2,
      appointment_id: 2,
      amount: 500.00,
      payment_method: 'Cash',
      transaction_ref: 'CASH-REC-102',
      notes: 'Registration fee paid',
      created_by: 4,
      created_at: new Date().toISOString()
    }
  ];

  const leads = [
    {
      id: 1,
      patient_name: 'Suresh Kumar',
      contact_number: '+91 9345678901',
      status: 'Interested',
      notes: 'Enquired about vascular screening package.',
      callback_time: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      assigned_to: 5,
      is_deleted: false
    },
    {
      id: 2,
      patient_name: 'Mary Kom',
      contact_number: '+91 9345678902',
      status: 'Follow-up',
      notes: 'Requested callback after consulting family.',
      callback_time: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      assigned_to: 5,
      is_deleted: false
    }
  ];

  const visits = [
    {
      id: 1,
      executive_id: 6,
      hospital_id: 1,
      start_time: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      end_time: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      summary: 'Delivered vein laser machinery parts.',
      notes: 'Maintenance checklist completed. Manager signature taken.',
      status: 'Completed',
      gps_lat: 17.385044,
      gps_lng: 78.486671,
      city: 'Hyderabad',
      state: 'Telangana',
      is_deleted: false
    },
    {
      id: 2,
      executive_id: 6,
      hospital_id: 2,
      start_time: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
      end_time: null,
      summary: 'Routine doctor meeting',
      notes: 'Discussing medicine order collection.',
      status: 'In Progress',
      gps_lat: 17.448293,
      gps_lng: 78.508544,
      city: 'Secunderabad',
      state: 'Telangana',
      is_deleted: false
    }
  ];

  const visit_photos = [
    {
      id: 1,
      visit_id: 1,
      photo_url: '/uploads/visits/sample-equipment.jpg',
      gps_lat: 17.385044,
      gps_lng: 78.486671,
      city: 'Hyderabad',
      state: 'Telangana',
      captured_at: new Date(Date.now() - 1000 * 60 * 60 * 4.5).toISOString()
    }
  ];

  const notifications = [
    {
      id: 1,
      user_id: 1,
      title: 'New Visit Registered',
      message: 'Rohan Verma started a visit at Metro General Hospital.',
      is_read: false,
      created_at: new Date().toISOString()
    }
  ];

  // Try seed local file database
  localDb.seed({
    users,
    hospitals,
    appointments,
    payments,
    leads,
    visits,
    visit_photos,
    notifications
  });

  // Try seed PostgreSQL database
  try {
    for (const u of users) {
      await query(`
        INSERT INTO users (id, name, email, password_hash, role, phone, is_active, is_deleted)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [u.id, u.name, u.email, u.password_hash, u.role, u.phone, u.is_active, u.is_deleted]);
    }
    for (const h of hospitals) {
      await query(`
        INSERT INTO hospitals (id, name, city, state, contact_person, phone, status, latitude, longitude, is_deleted, geofencing_enabled, hospital_uid)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET 
          latitude = EXCLUDED.latitude, 
          longitude = EXCLUDED.longitude, 
          geofencing_enabled = EXCLUDED.geofencing_enabled,
          hospital_uid = COALESCE(hospitals.hospital_uid, EXCLUDED.hospital_uid)
      `, [h.id, h.name, h.city, h.state, h.contact_person, h.phone, h.status, h.latitude, h.longitude, h.is_deleted, h.geofencing_enabled !== undefined ? h.geofencing_enabled : true, h.hospital_uid]);
    }
    // Set serial sequences correctly in postgres
    await query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))").catch(() => {});
    await query("SELECT setval('hospitals_id_seq', (SELECT MAX(id) FROM hospitals))").catch(() => {});
  } catch (err) {
    // Suppress pg query issues as fallback takes care of it
  }
};
