-- VVF Healthcare Management Web Application Database Schema
-- Run this script in standard PostgreSQL to initialize the database tables.

-- Drop tables if they already exist (Uncomment if you want a clean reset)
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS visit_photos CASCADE;
-- DROP TABLE IF EXISTS visits CASCADE;
-- DROP TABLE IF EXISTS leads CASCADE;
-- DROP TABLE IF EXISTS payments CASCADE;
-- DROP TABLE IF EXISTS appointments CASCADE;
-- DROP TABLE IF EXISTS attendance CASCADE;
-- DROP TABLE IF EXISTS hospitals CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    phone VARCHAR(100),
    personal_email VARCHAR(255),
    age INTEGER,
    date_of_birth DATE,
    gender VARCHAR(50),
    about TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    photo_url TEXT,
    password_change_count INTEGER DEFAULT 0,
    password_change_limit INTEGER DEFAULT 3,
    password_change_locked BOOLEAN DEFAULT FALSE,
    staff_type VARCHAR(50) DEFAULT 'in-staff',
    assigned_hospital_id INTEGER,
    qualification TEXT,
    aadhar_number VARCHAR(100),
    date_of_joining DATE,
    assigned_therapy VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(100),
    status VARCHAR(100) DEFAULT 'ACTIVE',
    hospital_uid VARCHAR(50) UNIQUE,
    geo_verification_status VARCHAR(100) DEFAULT 'MANUAL_REVIEW_REQUIRED',
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- Core Location Fields
    address TEXT,
    landmark VARCHAR(255),
    pincode VARCHAR(20),
    google_maps_link VARCHAR(500),
    allowed_radius INTEGER DEFAULT 200,

    -- Hospital Metadata
    clinic_category VARCHAR(50) DEFAULT 'Hospital',
    parent_hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
    hospital_type VARCHAR(100) DEFAULT 'Hospital',
    branch_code VARCHAR(50),
    visiting_hours VARCHAR(255),
    territory_zone VARCHAR(100),

    -- Contact Information
    reception_phone VARCHAR(100),
    alternate_phone VARCHAR(100),
    email VARCHAR(255),
    hospital_admin_name VARCHAR(255),
    department VARCHAR(100),

    -- Executive Assignment
    assigned_executives TEXT,
    visit_frequency VARCHAR(100) DEFAULT 'Weekly',
    last_visit_date TIMESTAMP WITH TIME ZONE,
    total_visits INTEGER DEFAULT 0,

    -- Geo-Verification Settings
    require_gps_validation BOOLEAN DEFAULT TRUE,
    require_live_photo BOOLEAN DEFAULT FALSE,
    require_checkout BOOLEAN DEFAULT TRUE,
    allow_remote_completion BOOLEAN DEFAULT TRUE,
    geofencing_enabled BOOLEAN DEFAULT TRUE,

    -- Status & Audit Fields
    temporarily_closed BOOLEAN DEFAULT FALSE,
    created_by INTEGER,
    legacy_hospital_id VARCHAR(100)
);

-- 3. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    punch_in TIMESTAMP WITH TIME ZONE NOT NULL,
    punch_out TIMESTAMP WITH TIME ZONE,
    status VARCHAR(100) DEFAULT 'active',
    close_reason VARCHAR(255),
    date VARCHAR(100),
    device_info VARCHAR(255),
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    geo_address TEXT,
    location_status VARCHAR(100) DEFAULT 'pending'
);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    gender VARCHAR(50) NOT NULL,
    contact_number VARCHAR(100) NOT NULL,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
    doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    total_amount DECIMAL(12, 2) DEFAULT 0.00,
    paid_amount DECIMAL(12, 2) DEFAULT 0.00,
    payment_status VARCHAR(100) DEFAULT 'Unpaid',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_user_id INTEGER,
    created_by_name VARCHAR(255),
    created_by_role VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    telecalling_status VARCHAR(50),
    telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    callback_date TIMESTAMP WITH TIME ZONE,
    outbound_notes TEXT,
    moved_to_telecalling BOOLEAN DEFAULT FALSE,
    moved_to_telecalling_at TIMESTAMP WITH TIME ZONE,
    
    -- New Fields
    co_relation VARCHAR(255),
    date_of_birth DATE,
    blood_group VARCHAR(50),
    city VARCHAR(255),
    address TEXT,
    diagnosis TEXT,
    reference VARCHAR(255),
    consultation_charges DECIMAL(12, 2) DEFAULT 0.00,
    tests_charges DECIMAL(12, 2) DEFAULT 0.00,
    medicine_charges DECIMAL(12, 2) DEFAULT 0.00,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(100),
    transaction_ref VARCHAR(255),
    upi_app VARCHAR(100),
    payer_upi_id VARCHAR(255),
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_splits JSONB DEFAULT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(100) NOT NULL,
    status VARCHAR(100) DEFAULT 'Interested',
    notes TEXT,
    callback_time TIMESTAMP WITH TIME ZONE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Visits Table
CREATE TABLE IF NOT EXISTS visits (
    id SERIAL PRIMARY KEY,
    executive_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    summary TEXT,
    notes TEXT,
    visit_type VARCHAR(100) DEFAULT 'Field Visit',
    duration_minutes INTEGER,
    status VARCHAR(100) DEFAULT 'In Progress',
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    city VARCHAR(255),
    state VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Verification metrics
    checkin_latitude DOUBLE PRECISION,
    checkin_longitude DOUBLE PRECISION,
    geo_verification_status VARCHAR(100),
    checkin_time TIMESTAMP WITH TIME ZONE,
    checkout_time TIMESTAMP WITH TIME ZONE,
    visit_status VARCHAR(100),
    distance_from_hospital_meters DOUBLE PRECISION,
    device_info TEXT,
    is_mock_location BOOLEAN DEFAULT FALSE,
    checkout_latitude DOUBLE PRECISION,
    checkout_longitude DOUBLE PRECISION,
    checkout_accuracy DOUBLE PRECISION,
    checkin_accuracy DOUBLE PRECISION,
    
    -- Completion & workflow enhancements
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    evidence_uploaded BOOLEAN DEFAULT FALSE,
    summary_submitted BOOLEAN DEFAULT FALSE,
    observations_submitted BOOLEAN DEFAULT FALSE,
    completion_progress INTEGER DEFAULT 0,
    photo_uploaded_at TIMESTAMP WITH TIME ZONE,
    summary_submitted_at TIMESTAMP WITH TIME ZONE,
    observations_submitted_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopened_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reminder_6h_sent BOOLEAN DEFAULT FALSE,
    reminder_2h_sent BOOLEAN DEFAULT FALSE,
    reminder_30m_sent BOOLEAN DEFAULT FALSE,
    checkin_hospital_lat DOUBLE PRECISION,
    checkin_hospital_lng DOUBLE PRECISION
);

-- 8. Visit Photos Table
CREATE TABLE IF NOT EXISTS visit_photos (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER REFERENCES visits(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    city VARCHAR(255),
    state VARCHAR(255),
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_attendance_user_status ON attendance(user_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_hospital ON appointments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_visits_executive ON visits(executive_id);
CREATE INDEX IF NOT EXISTS idx_visits_hospital ON visits(hospital_id);
CREATE INDEX IF NOT EXISTS idx_visit_photos_visit ON visit_photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- 11. Appointment Edit History Table
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

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_appointment_edit_history_appointment ON appointment_edit_history(appointment_id);

-- 12. Therapy Sessions Table
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
    op_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sop_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    op_verified BOOLEAN DEFAULT FALSE,
    sop_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(100) DEFAULT 'Pending Verification',
    remarks TEXT,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Therapy HBOT Details
CREATE TABLE IF NOT EXISTS therapy_hbot (
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

-- 14. Therapy Ozone Details
CREATE TABLE IF NOT EXISTS therapy_ozone (
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

-- 15. Therapy Physiotherapy Details
CREATE TABLE IF NOT EXISTS therapy_physiotherapy (
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

-- 16. Therapy Dental Details
CREATE TABLE IF NOT EXISTS therapy_dental (
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

-- 17. Therapy Pelvic Chair Details
CREATE TABLE IF NOT EXISTS therapy_pelvic_chair (
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

-- 18. Therapy SIPCD Details
CREATE TABLE IF NOT EXISTS therapy_sipcd (
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

-- 19. Therapy Zero Gravity Details
CREATE TABLE IF NOT EXISTS therapy_zero_gravity (
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

-- 20. Therapy Hydrogen Inhalation Details
CREATE TABLE IF NOT EXISTS therapy_hydrogen_inhalation (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. Therapy Lab Details
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

-- Indices for therapy sessions
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_patient ON therapy_sessions(patient_name);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_date ON therapy_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_hospital ON therapy_sessions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_op ON therapy_sessions(op_technician_id);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_sop ON therapy_sessions(sop_technician_id);

-- 22. Field Appointments Table
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

CREATE INDEX IF NOT EXISTS idx_field_appointments_lead_id ON field_appointments(patient_lead_id);
CREATE INDEX IF NOT EXISTS idx_field_appointments_executive ON field_appointments(executive_id);
CREATE INDEX IF NOT EXISTS idx_field_appointments_telecaller ON field_appointments(assigned_telecaller_id);

CREATE TABLE IF NOT EXISTS auto_redistribution_log (
    id SERIAL PRIMARY KEY,
    redistribution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trigger_reason VARCHAR(255) NOT NULL,
    leads_moved INTEGER NOT NULL,
    active_telecallers INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safe column additions
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_type VARCHAR(50) DEFAULT 'in-staff';
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_hospital_id INTEGER;

-- Circular Reference Constraint Fixes
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_assigned_hospital') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_assigned_hospital FOREIGN KEY (assigned_hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hospitals_created_by') THEN
    ALTER TABLE hospitals ADD CONSTRAINT fk_hospitals_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hospitals_updated_by') THEN
    ALTER TABLE hospitals ADD CONSTRAINT fk_hospitals_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;



