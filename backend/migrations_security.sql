-- VVF Healthcare Security Auditing and Database Hardening Script
-- This script adds audit fields, soft deletes, and RLS policies on all tables.

-- =========================================================================
-- 1. ADD SOFT DELETE & AUDIT TRACKING FIELDS
-- =========================================================================

-- Critical tables: soft delete is_deleted and deleted_at columns
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Audit Tracking Fields (created_by, created_at, updated_by, updated_at) where missing
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.visit_photos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.visit_photos ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.visit_photos ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.appointment_edit_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.appointment_edit_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.appointment_edit_history ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.appointment_edit_history ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_sessions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_sessions ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_hbot ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_hbot ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_ozone ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_ozone ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_physiotherapy ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_physiotherapy ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_dental ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_dental ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_pelvic_chair ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_pelvic_chair ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_sipcd ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_sipcd ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_zero_gravity ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_zero_gravity ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_hydrogen_inhalation ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_hydrogen_inhalation ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.therapy_lab ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.therapy_lab ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.field_appointments ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.field_appointments ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.auto_redistribution_log ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.auto_redistribution_log ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.auto_redistribution_log ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;


-- =========================================================================
-- 2. CREATE AUTO-UPDATE TIMESTAMPS FUNCTION & TRIGGERS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper to apply trigger helper safely
CREATE OR REPLACE FUNCTION public.create_updated_at_trigger(tbl_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS tr_%I_updated_at ON %I', tbl_name, tbl_name);
  EXECUTE format('CREATE TRIGGER tr_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', tbl_name, tbl_name);
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
SELECT public.create_updated_at_trigger('users');
SELECT public.create_updated_at_trigger('hospitals');
SELECT public.create_updated_at_trigger('attendance');
SELECT public.create_updated_at_trigger('appointments');
SELECT public.create_updated_at_trigger('payments');
SELECT public.create_updated_at_trigger('leads');
SELECT public.create_updated_at_trigger('visits');
SELECT public.create_updated_at_trigger('visit_photos');
SELECT public.create_updated_at_trigger('notifications');
SELECT public.create_updated_at_trigger('audit_logs');
SELECT public.create_updated_at_trigger('appointment_edit_history');
SELECT public.create_updated_at_trigger('therapy_sessions');
SELECT public.create_updated_at_trigger('therapy_hbot');
SELECT public.create_updated_at_trigger('therapy_ozone');
SELECT public.create_updated_at_trigger('therapy_physiotherapy');
SELECT public.create_updated_at_trigger('therapy_dental');
SELECT public.create_updated_at_trigger('therapy_pelvic_chair');
SELECT public.create_updated_at_trigger('therapy_sipcd');
SELECT public.create_updated_at_trigger('therapy_zero_gravity');
SELECT public.create_updated_at_trigger('therapy_hydrogen_inhalation');
SELECT public.create_updated_at_trigger('therapy_lab');
SELECT public.create_updated_at_trigger('field_appointments');
SELECT public.create_updated_at_trigger('auto_redistribution_log');


-- =========================================================================
-- 3. ACTIVATE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- =========================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_hbot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_ozone ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_physiotherapy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_dental ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_pelvic_chair ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sipcd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_zero_gravity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_hydrogen_inhalation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_lab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_redistribution_log ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- 4. DEFINE USER ROLE RESOLVER FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  -- Retrieve email from Supabase JWT claims
  IF auth.jwt() ->> 'email' IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role 
  FROM public.users 
  WHERE email = auth.jwt() ->> 'email' 
    AND is_deleted = false 
    AND is_active = true 
  LIMIT 1;
  
  RETURN v_role;
END;
$$;


-- =========================================================================
-- 5. DEFINE ROLE-BASED ACCESS POLICIES
-- =========================================================================

-- Helper function to generate default Admin & Superadmin bypass policies
CREATE OR REPLACE FUNCTION public.apply_admin_policies(tbl_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS admin_policy ON %I', tbl_name);
  EXECUTE format('CREATE POLICY admin_policy ON %I TO authenticated USING (public.get_user_role() IN (''Admin'', ''Superadmin'')) WITH CHECK (public.get_user_role() IN (''Admin'', ''Superadmin''))', tbl_name);
END;
$$ LANGUAGE plpgsql;

-- Apply Admin full-access policies to all tables
SELECT public.apply_admin_policies('users');
SELECT public.apply_admin_policies('hospitals');
SELECT public.apply_admin_policies('attendance');
SELECT public.apply_admin_policies('appointments');
SELECT public.apply_admin_policies('payments');
SELECT public.apply_admin_policies('leads');
SELECT public.apply_admin_policies('visits');
SELECT public.apply_admin_policies('visit_photos');
SELECT public.apply_admin_policies('notifications');
SELECT public.apply_admin_policies('audit_logs');
SELECT public.apply_admin_policies('appointment_edit_history');
SELECT public.apply_admin_policies('therapy_sessions');
SELECT public.apply_admin_policies('therapy_hbot');
SELECT public.apply_admin_policies('therapy_ozone');
SELECT public.apply_admin_policies('therapy_physiotherapy');
SELECT public.apply_admin_policies('therapy_dental');
SELECT public.apply_admin_policies('therapy_pelvic_chair');
SELECT public.apply_admin_policies('therapy_sipcd');
SELECT public.apply_admin_policies('therapy_zero_gravity');
SELECT public.apply_admin_policies('therapy_hydrogen_inhalation');
SELECT public.apply_admin_policies('therapy_lab');
SELECT public.apply_admin_policies('field_appointments');
SELECT public.apply_admin_policies('auto_redistribution_log');


-- 5.1 Users Table Policies
DROP POLICY IF EXISTS user_self_policy ON public.users;
CREATE POLICY user_self_policy ON public.users TO authenticated
  USING (email = auth.jwt() ->> 'email')
  WITH CHECK (email = auth.jwt() ->> 'email');

-- 5.2 Hospitals Table Policies
DROP POLICY IF EXISTS authenticated_read ON public.hospitals;
CREATE POLICY authenticated_read ON public.hospitals TO authenticated
  USING (public.get_user_role() IS NOT NULL);

-- 5.3 Attendance Table Policies
DROP POLICY IF EXISTS user_self_policy ON public.attendance;
CREATE POLICY user_self_policy ON public.attendance TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'));

-- 5.4 Appointments Table Policies
DROP POLICY IF EXISTS reception_policy ON public.appointments;
DROP POLICY IF EXISTS doctor_policy ON public.appointments;

CREATE POLICY reception_policy ON public.appointments TO authenticated
  USING (public.get_user_role() = 'Reception')
  WITH CHECK (public.get_user_role() = 'Reception');

CREATE POLICY doctor_policy ON public.appointments TO authenticated
  USING (doctor_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (doctor_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'));

-- 5.5 Payments Table Policies
DROP POLICY IF EXISTS reception_policy ON public.payments;
DROP POLICY IF EXISTS doctor_policy ON public.payments;

CREATE POLICY reception_policy ON public.payments TO authenticated
  USING (public.get_user_role() = 'Reception')
  WITH CHECK (public.get_user_role() = 'Reception');

CREATE POLICY doctor_policy ON public.payments TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.id = appointment_id 
      AND a.doctor_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email')
  ));

-- 5.6 Leads Table Policies
DROP POLICY IF EXISTS telecaller_policy ON public.leads;
CREATE POLICY telecaller_policy ON public.leads TO authenticated
  USING (assigned_to = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (assigned_to = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'));

-- 5.7 Visits Table Policies
DROP POLICY IF EXISTS executive_policy ON public.visits;
CREATE POLICY executive_policy ON public.visits TO authenticated
  USING (executive_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (executive_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'));

-- 5.8 Visit Photos Table Policies
DROP POLICY IF EXISTS executive_policy ON public.visit_photos;
CREATE POLICY executive_policy ON public.visit_photos TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.visits v 
    WHERE v.id = visit_id 
      AND v.executive_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.visits v 
    WHERE v.id = visit_id 
      AND v.executive_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email')
  ));

-- 5.9 Notifications Table Policies
DROP POLICY IF EXISTS user_self_policy ON public.notifications;
CREATE POLICY user_self_policy ON public.notifications TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email') OR user_id IS NULL)
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'));

-- 5.10 Therapy Sessions Table Policies
DROP POLICY IF EXISTS technician_policy ON public.therapy_sessions;
CREATE POLICY technician_policy ON public.therapy_sessions TO authenticated
  USING (
    op_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email') 
    OR sop_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email')
  )
  WITH CHECK (
    op_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email') 
    OR sop_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email')
  );

-- Helper function to generate session link policy for therapy sub-tables
CREATE OR REPLACE FUNCTION public.apply_therapy_policy(tbl_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS technician_policy ON %I', tbl_name);
  EXECUTE format('CREATE POLICY technician_policy ON %I TO authenticated USING (EXISTS (SELECT 1 FROM public.therapy_sessions s WHERE s.id = session_id AND (s.op_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> ''email'') OR s.sop_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> ''email'')))) WITH CHECK (EXISTS (SELECT 1 FROM public.therapy_sessions s WHERE s.id = session_id AND (s.op_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> ''email'') OR s.sop_technician_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> ''email''))))', tbl_name);
END;
$$ LANGUAGE plpgsql;

SELECT public.apply_therapy_policy('therapy_hbot');
SELECT public.apply_therapy_policy('therapy_ozone');
SELECT public.apply_therapy_policy('therapy_physiotherapy');
SELECT public.apply_therapy_policy('therapy_dental');
SELECT public.apply_therapy_policy('therapy_pelvic_chair');
SELECT public.apply_therapy_policy('therapy_sipcd');
SELECT public.apply_therapy_policy('therapy_zero_gravity');
SELECT public.apply_therapy_policy('therapy_hydrogen_inhalation');
SELECT public.apply_therapy_policy('therapy_lab');


-- 5.11 Field Appointments Table Policies
DROP POLICY IF EXISTS executive_policy ON public.field_appointments;
DROP POLICY IF EXISTS telecaller_policy ON public.field_appointments;

CREATE POLICY executive_policy ON public.field_appointments TO authenticated
  USING (executive_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (executive_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY telecaller_policy ON public.field_appointments TO authenticated
  USING (assigned_telecaller_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (assigned_telecaller_id = (SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email'));


-- =========================================================================
-- 6. STORAGE BUCKET PROTECTION POLICIES
-- =========================================================================

-- Read access to storage buckets for authenticated users
DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
CREATE POLICY "Authenticated users can read photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('photos', 'profile-photos'));

-- Upload access: only authenticated users
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('photos', 'profile-photos'));

-- Delete access: only Admin can delete
DROP POLICY IF EXISTS "Only Admin can delete photos" ON storage.objects;
CREATE POLICY "Only Admin can delete photos" ON storage.objects FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('Admin', 'Superadmin'));
