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
          added_latitude DOUBLE PRECISION,
          added_longitude DOUBLE PRECISION,
          added_location_address TEXT,
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
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION;").catch(() => {});
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION;").catch(() => {});
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS geo_address TEXT;").catch(() => {});
      await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location_status VARCHAR(100) DEFAULT 'pending';").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS assigned_telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS assigned_telecaller_name VARCHAR(255);").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS last_followup_date TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMP WITH TIME ZONE;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS telecaller_notes TEXT;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS lead_status VARCHAR(100) DEFAULT 'New Lead';").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS added_latitude DOUBLE PRECISION;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS added_longitude DOUBLE PRECISION;").catch(() => {});
      await query("ALTER TABLE field_appointments ADD COLUMN IF NOT EXISTS added_location_address TEXT;").catch(() => {});

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
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_type VARCHAR(100) DEFAULT 'Hospital';").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS clinic_category VARCHAR(50) DEFAULT 'Hospital';").catch(() => {});
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS parent_hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL;").catch(() => {});
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

    // Migrate old Partner Clinic / In-House Clinic values to Hospitals
    await query("UPDATE hospitals SET clinic_category = 'Hospital' WHERE clinic_category IN ('Partner Clinic', 'Partner Hospital');").catch(() => {});
    await query("UPDATE hospitals SET clinic_category = 'In-House Hospital' WHERE clinic_category IN ('In-House Clinic', 'In-house Clinic');").catch(() => {});

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
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_type VARCHAR(50) DEFAULT 'in-staff';").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_hospital_id INTEGER;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device TEXT;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification TEXT;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(100);").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_joining DATE;").catch(() => {});
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_therapy VARCHAR(100);").catch(() => {});
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

    // New appointment details columns
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS co_relation VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS date_of_birth DATE;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS blood_group VARCHAR(50);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS city VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS address TEXT;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS diagnosis TEXT;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reference VARCHAR(255);").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_charges DECIMAL(12, 2) DEFAULT 0.00;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tests_charges DECIMAL(12, 2) DEFAULT 0.00;").catch(() => {});
    await query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS medicine_charges DECIMAL(12, 2) DEFAULT 0.00;").catch(() => {});

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
    await query("ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS diagnosis TEXT;").catch(() => {});
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
        diagnosis TEXT,
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
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
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
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 2,
      name: 'Dr. Ramesh Kumar',
      email: 'doctor@vvf.org',
      password_hash: hashPassword('doctor123'),
      role: 'Doctor',
      phone: '+91 9876543201',
      personal_email: 'ramesh.doctor@vvf.org',
      age: 44,
      date_of_birth: '1981-03-15',
      gender: 'Male',
      about: 'Senior Clinician.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 3,
      name: 'Dr. Anita Dental',
      email: 'dental@vvf.org',
      password_hash: hashPassword('dental123'),
      role: 'Dental Doctor',
      phone: '+91 9876543202',
      personal_email: 'anita.dental@vvf.org',
      age: 36,
      date_of_birth: '1989-06-25',
      gender: 'Female',
      about: 'Senior Dental Surgeon.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 4,
      name: 'Dr. Vivek Dentist Jr',
      email: 'dentistjr@vvf.org',
      password_hash: hashPassword('dentistjr123'),
      role: 'Dentist Junior',
      phone: '+91 9876543203',
      personal_email: 'vivek.dentistjr@vvf.org',
      age: 29,
      date_of_birth: '1996-09-10',
      gender: 'Male',
      about: 'Junior Dentist.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 5,
      name: 'Pooja Dental Asst',
      email: 'dentalasst@vvf.org',
      password_hash: hashPassword('dentalasst123'),
      role: 'Dental Assistant',
      phone: '+91 9876543204',
      personal_email: 'pooja.dentalasst@vvf.org',
      age: 26,
      date_of_birth: '1999-12-05',
      gender: 'Female',
      about: 'Dental Clinical Assistant.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 6,
      name: 'Sravani Reception',
      email: 'reception@vvf.org',
      password_hash: hashPassword('reception123'),
      role: 'Reception',
      phone: '+91 9876543205',
      personal_email: 'sravani.reception@vvf.org',
      age: 27,
      date_of_birth: '1998-02-14',
      gender: 'Female',
      about: 'Front Desk & Patient Registrar.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 7,
      name: 'Sarah Telecaller',
      email: 'tc@vvf.org',
      password_hash: hashPassword('tc123'),
      role: 'Telecaller',
      phone: '+91 9876543206',
      personal_email: 'sarah.tc@vvf.org',
      age: 25,
      date_of_birth: '2000-05-20',
      gender: 'Female',
      about: 'Telecaller Outreach Specialist.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 8,
      name: 'John Executive',
      email: 'exec@vvf.org',
      password_hash: hashPassword('exec123'),
      role: 'Executive',
      phone: '+91 9876543207',
      personal_email: 'john.exec@vvf.org',
      age: 28,
      date_of_birth: '1997-10-18',
      gender: 'Male',
      about: 'Field Executive.',
      is_active: true,
      is_deleted: false,
      staff_type: 'field-staff',
      assigned_hospital_id: null,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 9,
      name: 'Karthik OP Tech',
      email: 'optech@vvf.org',
      password_hash: hashPassword('optech123'),
      role: 'OP Technician',
      phone: '+91 9876543208',
      personal_email: 'karthik.optech@vvf.org',
      age: 31,
      date_of_birth: '1994-07-22',
      gender: 'Male',
      about: 'OP Therapy Technician.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    },
    {
      id: 10,
      name: 'Meena SOP Tech',
      email: 'soptech@vvf.org',
      password_hash: hashPassword('soptech123'),
      role: 'SOP Technician',
      phone: '+91 9876543209',
      personal_email: 'meena.soptech@vvf.org',
      age: 33,
      date_of_birth: '1992-11-30',
      gender: 'Female',
      about: 'SOP Therapy Technician.',
      is_active: true,
      is_deleted: false,
      staff_type: 'in-staff',
      assigned_hospital_id: 801,
      password_change_count: 0,
      password_change_limit: 3,
      password_change_locked: false
    }
  ];

  const hospitals: any[] = [
    {
      id: 801,
      name: 'Venkateswara Vascular Foundation',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      contact_person: 'Dr. Harivadan Lukka',
      phone: '+91 79975 92222',
      status: 'ACTIVE',
      latitude: 17.714300198610253,
      longitude: 83.3124937377078,
      address: 'Door No: 14-1-128, First Floor, Nowroji Road, Maharanipeta, Visakhapatnam, Andhra Pradesh',
      landmark: 'Near PJ Scan Centre, Pandimetta Junction',
      pincode: '530002',
      google_maps_link: 'https://maps.app.goo.gl/SLdF9c2U2Rm2X7jA6',
      allowed_radius: 250,
      clinic_category: 'Hospital',
      hospital_uid: 'VVF-001',
      is_deleted: false,
      geofencing_enabled: true
    },
    {
      id: 802,
      name: 'VVF Inhouse Clinic - Venkateswara Vascular Foundation',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      contact_person: 'Dr. Harivadan Lukka',
      phone: '+91 79975 92222',
      status: 'ACTIVE',
      latitude: 17.714300198610253,
      longitude: 83.3124937377078,
      address: 'First Floor, Nowroji Road, Maharanipeta, Visakhapatnam, Andhra Pradesh',
      landmark: 'Inside Venkateswara Vascular Foundation Complex',
      pincode: '530002',
      google_maps_link: 'https://maps.app.goo.gl/SLdF9c2U2Rm2X7jA6',
      allowed_radius: 250,
      clinic_category: 'In-House Hospital',
      parent_hospital_id: 801,
      hospital_uid: 'VVF-002',
      is_deleted: false,
      geofencing_enabled: true
    }
  ];

  const appointments: any[] = [];
  const payments: any[] = [];
  const leads: any[] = [];
  const visits: any[] = [];
  const visit_photos: any[] = [];
  const notifications: any[] = [];
  const therapy_sessions: any[] = [];
  const therapy_hbot: any[] = [];
  const therapy_lab: any[] = [];
  const therapy_hydrogen_inhalation: any[] = [];

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
      for (const h of hospitals) {
        await query(`
          INSERT INTO hospitals (id, name, city, state, contact_person, phone, status, latitude, longitude, address, landmark, pincode, allowed_radius, clinic_category, parent_hospital_id, is_deleted, geofencing_enabled, hospital_uid)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            contact_person = EXCLUDED.contact_person,
            phone = EXCLUDED.phone,
            latitude = EXCLUDED.latitude, 
            longitude = EXCLUDED.longitude, 
            address = EXCLUDED.address,
            landmark = EXCLUDED.landmark,
            pincode = EXCLUDED.pincode,
            allowed_radius = EXCLUDED.allowed_radius,
            clinic_category = EXCLUDED.clinic_category,
            parent_hospital_id = EXCLUDED.parent_hospital_id,
            geofencing_enabled = EXCLUDED.geofencing_enabled,
            hospital_uid = COALESCE(hospitals.hospital_uid, EXCLUDED.hospital_uid)
        `, [h.id, h.name, h.city, h.state, h.contact_person, h.phone, h.status, h.latitude, h.longitude, h.address || '', h.landmark || '', h.pincode || '', h.allowed_radius || 200, h.clinic_category || 'Hospital', h.parent_hospital_id || null, h.is_deleted || false, h.geofencing_enabled !== undefined ? h.geofencing_enabled : true, h.hospital_uid]);
      }
      for (const u of users) {
        await query(`
          INSERT INTO users (id, name, email, password_hash, role, phone, personal_email, age, date_of_birth, gender, about, is_active, is_deleted, staff_type, assigned_hospital_id, password_change_count, password_change_limit, password_change_locked)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            phone = EXCLUDED.phone,
            staff_type = EXCLUDED.staff_type,
            assigned_hospital_id = EXCLUDED.assigned_hospital_id,
            personal_email = COALESCE(users.personal_email, EXCLUDED.personal_email),
            age = COALESCE(users.age, EXCLUDED.age),
            date_of_birth = COALESCE(users.date_of_birth, EXCLUDED.date_of_birth),
            gender = COALESCE(users.gender, EXCLUDED.gender),
            about = COALESCE(users.about, EXCLUDED.about)
        `, [u.id, u.name, u.email, u.password_hash, u.role, u.phone, u.personal_email, u.age, u.date_of_birth, u.gender, u.about, u.is_active, u.is_deleted, u.staff_type || 'in-staff', u.assigned_hospital_id || null, u.password_change_count || 0, u.password_change_limit || 3, u.password_change_locked || false]);
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
