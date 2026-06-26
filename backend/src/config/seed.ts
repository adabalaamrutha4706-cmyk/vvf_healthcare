import bcrypt from 'bcryptjs';
import { query, localDb, checkPostgresConnection } from './db';
import * as fs from 'fs';
import * as path from 'path';
import { standardizeHospitalUIDs } from '../migrations/standardizeHospitals';

const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);

export const seedDatabase = async () => {
  const isPostgresConnected = await checkPostgresConnection();

  if (isPostgresConnected) {
    // Read and run schema.sql to ensure tables exist in Postgres
    try {
      const schemaPath = path.join(__dirname, '../../schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await query(schemaSql);
      }

      // Dynamic Alterations for Field Appointments
      await query(`
        CREATE TABLE IF NOT EXISTS field_appointments (
          id SERIAL PRIMARY KEY,
          patient_lead_id VARCHAR(100) UNIQUE NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          age INTEGER NOT NULL,
          gender VARCHAR(50) NOT NULL,
          phone_number VARCHAR(100) NOT NULL,
          appointment_type VARCHAR(255) NOT NULL,
          medical_history TEXT,
          executive_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          executive_name VARCHAR(255) NOT NULL,
          status VARCHAR(100) DEFAULT 'New Lead',
          assigned_telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          assigned_telecaller_name VARCHAR(255),
          assigned_at TIMESTAMP WITH TIME ZONE,
          last_followup_date TIMESTAMP WITH TIME ZONE,
          next_followup_date TIMESTAMP WITH TIME ZONE,
          telecaller_notes TEXT,
          lead_status VARCHAR(100) DEFAULT 'New Lead',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `).catch((err) => console.error('Error creating field_appointments table:', err));
      await query(`CREATE INDEX IF NOT EXISTS idx_field_appointments_lead_id ON field_appointments(patient_lead_id);`).catch(() => {});
      await query(`CREATE INDEX IF NOT EXISTS idx_field_appointments_executive ON field_appointments(executive_id);`).catch(() => {});
      await query(`CREATE INDEX IF NOT EXISTS idx_field_appointments_telecaller ON field_appointments(assigned_telecaller_id);`).catch(() => {});

      await query(`
        CREATE TABLE IF NOT EXISTS auto_redistribution_log (
          id SERIAL PRIMARY KEY,
          redistribution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          trigger_reason VARCHAR(255) NOT NULL,
          leads_moved INTEGER NOT NULL,
          active_telecallers INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `).catch((err) => console.error('Error creating auto_redistribution_log table:', err));

      // Add columns if they do not exist
      await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_splits JSONB DEFAULT NULL;").catch(() => {});
      await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;").catch(() => {});
      await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;").catch(() => {});
      await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_by INTEGER;").catch(() => {});
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;").catch(() => {});
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_by INTEGER;").catch(() => {});
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_by INTEGER;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS assigned_telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS assigned_telecaller_name VARCHAR(255);").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS last_followup_date TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS telecaller_notes TEXT;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS lead_status VARCHAR(100) DEFAULT 'New Lead';").catch(() => {});

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
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_type VARCHAR(100) DEFAULT 'Field Visit';").catch(() => {});
    await query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;").catch(() => {});
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
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device TEXT;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS about TEXT;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_count INTEGER DEFAULT 0;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_limit INTEGER DEFAULT 3;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_locked BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_target INTEGER DEFAULT 0;").catch(() => {});


    // Telecalling workflow columns for appointments
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telecalling_status VARCHAR(50);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS callback_date TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS outbound_notes TEXT;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS moved_to_telecalling BOOLEAN DEFAULT FALSE;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS moved_to_telecalling_at TIMESTAMP WITH TIME ZONE;").catch(() => {});

    // Restructured appointment portal columns
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(100) DEFAULT 'doctor';").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'Scheduled';").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_name VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS department VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS visit_type VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chief_complaint TEXT;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS dental_concern TEXT;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS treatment_type VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS technician_id INTEGER;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS number_of_sessions INTEGER;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS session_duration INTEGER;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS package_type VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_remarks TEXT;").catch(() => {});
    await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_splits JSONB DEFAULT NULL;").catch(() => {});
    await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS upi_app VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_upi_id VARCHAR(255);").catch(() => {});

    await query("UPDATE appointments SET appointment_type = 'doctor' WHERE appointment_type IS NULL;").catch(() => {});
    await query("UPDATE appointments SET status = 'Scheduled' WHERE status IS NULL;").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_appointments_technician ON appointments(technician_id);").catch(() => {});

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

    // Create therapy tables
    await query(`
      CREATE TABLE IF NOT EXISTS therapy_sessions (
        id SERIAL PRIMARY KEY,
        patient_name VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(100) NOT NULL,
        therapy_type VARCHAR(100) NOT NULL, -- 'HBOT', 'Ozone', 'Physiotherapy', etc.
        timings VARCHAR(255),
        rescheduled VARCHAR(50) DEFAULT 'No',
        rescheduled_date VARCHAR(100),
        rescheduled_time VARCHAR(100),
        actual_start VARCHAR(100),
        session_date DATE NOT NULL,
        end_time VARCHAR(100),
        op_technician_id INTEGER,
        sop_technician_id INTEGER,
        op_verified BOOLEAN DEFAULT FALSE,
        sop_verified BOOLEAN DEFAULT FALSE,
        verification_date TIMESTAMP WITH TIME ZONE,
        status VARCHAR(100) DEFAULT 'Pending Verification',
        remarks TEXT,
        hospital_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => console.error('Failed to create therapy_sessions table in Postgres:', err));

    const specificTables = [
      'therapy_hbot', 'therapy_ozone', 'therapy_physiotherapy', 'therapy_dental', 
      'therapy_pelvic_chair', 'therapy_sipcd', 'therapy_zero_gravity'
    ];

    for (const tbl of specificTables) {
      await query(`
        CREATE TABLE IF NOT EXISTS ${tbl} (
          id SERIAL PRIMARY KEY,
          session_id INTEGER NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
          dive_surface_timings VARCHAR(255),
          pressure_type VARCHAR(100),
          pressure_value INTEGER,
          next_session_date VARCHAR(100),
          next_session_time VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `).catch((err) => console.error(`Failed to create ${tbl} table in Postgres:`, err));
    }

    await query(`
      CREATE TABLE IF NOT EXISTS therapy_hydrogen_inhalation (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => console.error('Failed to create therapy_hydrogen_inhalation table in Postgres:', err));

    await query(`
      CREATE TABLE IF NOT EXISTS therapy_lab (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
        tests TEXT,
        reported VARCHAR(50) DEFAULT 'No',
        report_printed VARCHAR(50) DEFAULT 'No',
        whatsapp_report VARCHAR(50) DEFAULT 'Not Sent',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `).catch((err) => console.error('Failed to create therapy_lab table in Postgres:', err));

    await query("CREATE INDEX IF NOT EXISTS idx_therapy_sessions_patient ON therapy_sessions(patient_name);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_therapy_sessions_date ON therapy_sessions(session_date);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_therapy_sessions_hospital ON therapy_sessions(hospital_id);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_therapy_sessions_op ON therapy_sessions(op_technician_id);").catch(() => {});
    await query("CREATE INDEX IF NOT EXISTS idx_therapy_sessions_sop ON therapy_sessions(sop_technician_id);").catch(() => {});

    // Run VVF UID Standardization & Backfill migration
    await standardizeHospitalUIDs();


    console.log('Database schema checked/initialized successfully in Postgres.');
  } catch (err: any) {
    console.error('Failed to run schema migrations:', err.message);
  }
  } else {
    console.log('Postgres database is not reachable. Skipping migrations.');
  }


  const users = [
    {
      id: 999,
      name: 'VVF Super Administrator',
      email: process.env.INITIAL_SUPERADMIN_EMAIL || 'superadmin@vvf.org',
      password_hash: hashPassword(process.env.INITIAL_SUPERADMIN_PASSWORD || 'superadmin123'),
      role: 'Superadmin',
      phone: '+91 9999999990',
      personal_email: 'superadmin.personal@vvf.org',
      age: 42,
      date_of_birth: '1983-04-12',
      gender: 'Male',
      about: 'Oversees platform governance, security policies, and organization-wide system configuration.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 1,
      name: 'VVF Administrator',
      email: 'admin@vvf.org',
      password_hash: hashPassword('admin123'),
      role: 'Admin',
      phone: '+91 9999999991',
      personal_email: 'admin.personal@vvf.org',
      age: 38,
      date_of_birth: '1987-08-20',
      gender: 'Male',
      about: 'Manages hospital operations, staff coordination, and daily clinical workflow oversight.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 2,
      name: 'Dr. Venkat S. (Dental)',
      email: 'dental@vvf.org',
      password_hash: hashPassword('dental123'),
      role: 'Dental Doctor',
      phone: '+91 9999999992',
      personal_email: 'venkat.personal@vvf.org',
      age: 52,
      date_of_birth: '1973-01-15',
      gender: 'Male',
      about: 'Lead dentist guiding clinical standards, dental teams, and treatment protocols.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 3,
      name: 'Dr. Rajesh Kumar',
      email: 'doctor@vvf.org',
      password_hash: hashPassword('doctor123'),
      role: 'Doctor',
      phone: '+91 9999999993',
      personal_email: 'rajesh.personal@vvf.org',
      age: 41,
      date_of_birth: '1984-11-03',
      gender: 'Male',
      about: 'Consultant physician handling patient appointments, diagnostics, and vascular care plans.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 4,
      name: 'Priya Sharma',
      email: 'reception@vvf.org',
      password_hash: hashPassword('reception123'),
      role: 'Reception',
      phone: '+91 9999999994',
      personal_email: 'priya.personal@vvf.org',
      age: 29,
      date_of_birth: '1996-06-28',
      gender: 'Female',
      about: 'Front-desk receptionist managing patient check-ins, billing support, and appointment scheduling.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 5,
      name: 'Amit Patel',
      email: 'telecaller@vvf.org',
      password_hash: hashPassword('telecaller123'),
      role: 'Telecaller',
      phone: '+91 9999999995',
      personal_email: 'amit.personal@vvf.org',
      age: 27,
      date_of_birth: '1998-09-10',
      gender: 'Male',
      about: 'Outbound telecaller coordinating patient follow-ups, lead nurturing, and callback scheduling.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 6,
      name: 'Rohan Verma',
      email: 'executive@vvf.org',
      password_hash: hashPassword('executive123'),
      role: 'Executive',
      phone: '+91 9999999996',
      personal_email: 'rohan.personal@vvf.org',
      age: 31,
      date_of_birth: '1994-12-05',
      gender: 'Male',
      about: 'Field executive conducting partner hospital visits, GPS check-ins, and on-site audits.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 7,
      name: 'Ramesh OP Tech',
      email: 'optech@vvf.org',
      password_hash: hashPassword('optech123'),
      role: 'OP Technician',
      phone: '+91 9999999997',
      personal_email: 'ramesh.personal@vvf.org',
      age: 28,
      date_of_birth: '1998-05-14',
      gender: 'Male',
      about: 'Operative technician managing clinical therapy machinery and patient dive sessions.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 8,
      name: 'Suresh SOP Tech',
      email: 'soptech@vvf.org',
      password_hash: hashPassword('soptech123'),
      role: 'SOP Technician',
      phone: '+91 9999999998',
      personal_email: 'suresh.personal@vvf.org',
      age: 34,
      date_of_birth: '1992-10-19',
      gender: 'Male',
      about: 'Senior operative technician reviewing technician logs and verifying sessions safety compliance.',
      is_active: true,
      is_deleted: false,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
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
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
      payment_splits: null
    },
    {
      id: 2,
      appointment_id: 2,
      amount: 500.00,
      payment_method: 'Cash',
      transaction_ref: 'CASH-REC-102',
      notes: 'Registration fee paid',
      created_by: 4,
      created_at: new Date().toISOString(),
      payment_splits: null
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

  const therapy_sessions = [
    {
      id: 1,
      patient_name: 'Harish Rao',
      mobile_number: '9848022338',
      therapy_type: 'HBOT',
      timings: '09:00 AM - 10:00 AM',
      rescheduled: 'No',
      actual_start: '09:05 AM',
      session_date: '2026-06-15',
      end_time: '10:05 AM',
      op_technician_id: 7,
      sop_technician_id: 8,
      op_verified: true,
      sop_verified: false,
      status: 'Pending Verification',
      hospital_id: 1
    },
    {
      id: 2,
      patient_name: 'Lakshmi K.',
      mobile_number: '9123456789',
      therapy_type: 'Lab',
      timings: '10:00 AM - 11:00 AM',
      rescheduled: 'No',
      actual_start: '10:00 AM',
      session_date: '2026-06-15',
      end_time: '10:30 AM',
      op_technician_id: 7,
      sop_technician_id: 8,
      op_verified: false,
      sop_verified: false,
      status: 'Pending Verification',
      hospital_id: 1
    },
    {
      id: 3,
      patient_name: 'Anand Kumar',
      mobile_number: '9440123456',
      therapy_type: 'Hydrogen Inhalation',
      timings: '11:00 AM - 11:30 AM',
      rescheduled: 'No',
      actual_start: '',
      session_date: '2026-06-15',
      end_time: '',
      op_technician_id: 7,
      sop_technician_id: 8,
      op_verified: false,
      sop_verified: false,
      status: 'Pending Verification',
      hospital_id: 2
    }
  ];

  const therapy_hbot = [
    {
      id: 1,
      session_id: 1,
      dive_surface_timings: 'Dive: 09:00 AM\nSurface: 10:15 AM',
      pressure_type: 'Cylinder Pressure',
      pressure_value: 120,
      next_session_date: '2026-06-20',
      next_session_time: '09:00 AM'
    }
  ];

  const therapy_lab = [
    {
      id: 1,
      session_id: 2,
      tests: 'CBC, LFT, Blood Sugar',
      reported: 'Yes',
      report_printed: 'No',
      whatsapp_report: 'Not Sent'
    }
  ];

  const therapy_hydrogen_inhalation = [
    {
      id: 1,
      session_id: 3
    }
  ];

  const therapy_ozone: any[] = [];
  const therapy_physiotherapy: any[] = [];
  const therapy_dental: any[] = [];
  const therapy_pelvic_chair: any[] = [];
  const therapy_sipcd: any[] = [];
  const therapy_zero_gravity: any[] = [];

  // Try seed local file database
  localDb.seed({
    users,
    hospitals,
    appointments,
    payments,
    leads,
    visits,
    visit_photos,
    notifications,
    therapy_sessions,
    therapy_hbot,
    therapy_ozone,
    therapy_physiotherapy,
    therapy_dental,
    therapy_pelvic_chair,
    therapy_sipcd,
    therapy_zero_gravity,
    therapy_hydrogen_inhalation,
    therapy_lab
  });

  // Try seed PostgreSQL database
  if (isPostgresConnected) {
    try {
      for (const u of users) {
        await query(`
          INSERT INTO users (id, name, email, password_hash, role, phone, personal_email, age, date_of_birth, gender, about, is_active, is_deleted, password_change_count, password_change_limit, password_change_locked)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            personal_email = COALESCE(users.personal_email, EXCLUDED.personal_email),
            age = COALESCE(users.age, EXCLUDED.age),
            date_of_birth = COALESCE(users.date_of_birth, EXCLUDED.date_of_birth),
            gender = COALESCE(users.gender, EXCLUDED.gender),
            about = COALESCE(users.about, EXCLUDED.about)
        `, [u.id, u.name, u.email, u.password_hash, u.role, u.phone, u.personal_email, u.age, u.date_of_birth, u.gender, u.about, u.is_active, u.is_deleted, u.password_change_count, u.password_change_limit, u.password_change_locked]);
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
      for (const s of therapy_sessions) {
        await query(`
          INSERT INTO therapy_sessions (id, patient_name, mobile_number, therapy_type, timings, rescheduled, actual_start, session_date, end_time, op_technician_id, sop_technician_id, op_verified, sop_verified, status, hospital_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING
        `, [s.id, s.patient_name, s.mobile_number, s.therapy_type, s.timings, s.rescheduled, s.actual_start || null, s.session_date, s.end_time || null, s.op_technician_id, s.sop_technician_id, s.op_verified, s.sop_verified, s.status, s.hospital_id]);
      }
      for (const h of therapy_hbot) {
        await query(`
          INSERT INTO therapy_hbot (id, session_id, dive_surface_timings, pressure_type, pressure_value, next_session_date, next_session_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `, [h.id, h.session_id, h.dive_surface_timings, h.pressure_type, h.pressure_value, h.next_session_date, h.next_session_time]);
      }
      for (const l of therapy_lab) {
        await query(`
          INSERT INTO therapy_lab (id, session_id, tests, reported, report_printed, whatsapp_report)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [l.id, l.session_id, l.tests, l.reported, l.report_printed, l.whatsapp_report]);
      }
      for (const hy of therapy_hydrogen_inhalation) {
        await query(`
          INSERT INTO therapy_hydrogen_inhalation (id, session_id)
          VALUES ($1, $2)
          ON CONFLICT (id) DO NOTHING
        `, [hy.id, hy.session_id]);
      }
      // Set serial sequences correctly in postgres
      await query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))").catch(() => {});
      await query("SELECT setval('hospitals_id_seq', (SELECT MAX(id) FROM hospitals))").catch(() => {});
      await query("SELECT setval('therapy_sessions_id_seq', (SELECT MAX(id) FROM therapy_sessions))").catch(() => {});
      await query("SELECT setval('therapy_hbot_id_seq', (SELECT MAX(id) FROM therapy_hbot))").catch(() => {});
      await query("SELECT setval('therapy_lab_id_seq', (SELECT MAX(id) FROM therapy_lab))").catch(() => {});
      await query("SELECT setval('therapy_hydrogen_inhalation_id_seq', (SELECT MAX(id) FROM therapy_hydrogen_inhalation))").catch(() => {});
    } catch (err) {
      // Suppress pg query issues as fallback takes care of it
      console.error('Postgres seeding error for therapies:', err);
    }
  }

  // Local JSON Database Backfill Migration
  try {
    const localDbPath = path.join(__dirname, '../../data/local_db.json');
    if (fs.existsSync(localDbPath)) {
      const rawData = fs.readFileSync(localDbPath, 'utf8');
      const data = JSON.parse(rawData);
      if (data.appointments && data.appointments.length > 0) {
        let updated = false;
        data.appointments.forEach((app: any) => {
          if (!app.appointment_type) {
            app.appointment_type = 'doctor';
            updated = true;
          }
          if (!app.status) {
            app.status = 'Scheduled';
            updated = true;
          }
          const fields = [
            'patient_id', 'service_name', 'department', 'visit_type', 
            'chief_complaint', 'dental_concern', 'treatment_type', 
            'technician_id', 'number_of_sessions', 'session_duration', 
            'package_type', 'service_remarks'
          ];
          fields.forEach(f => {
            if (app[f] === undefined) {
              app[f] = null;
              updated = true;
            }
          });
        });
        if (updated) {
          fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2), 'utf8');
          console.log('Seeded / Backfilled local JSON database with appointment restructure fields.');
        }
      }
    }
  } catch (err: any) {
    console.error('Failed to backfill local database:', err.message);
  }
};
