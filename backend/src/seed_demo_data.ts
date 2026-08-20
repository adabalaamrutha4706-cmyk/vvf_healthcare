import { query } from './config/db';
import { seedDatabase } from './config/seed';
import * as bcrypt from 'bcryptjs';

const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);

async function runSeed() {
  console.log('Seeding custom demo data for testing...');
  await seedDatabase();

  // 1. Seed demo executive and telecaller users
  const execPasswordHash = hashPassword('exec123');
  const tcPasswordHash = hashPassword('tc123');

  // Insert Executive
  await query(`
    INSERT INTO users (id, name, email, password_hash, role, phone, personal_email, age, date_of_birth, gender, about, is_active, is_deleted, staff_type)
    VALUES (15, 'John Executive', 'exec@vvf.org', $1, 'Executive', '+91 9876543210', 'exec.personal@vvf.org', 28, '1998-05-15', 'Male', 'Field Executive for outreach.', true, false, 'field-staff')
    ON CONFLICT (id) DO UPDATE SET password_hash = $1, role = 'Executive', staff_type = 'field-staff'
  `, [execPasswordHash]);

  // Insert Telecaller
  await query(`
    INSERT INTO users (id, name, email, password_hash, role, phone, personal_email, age, date_of_birth, gender, about, is_active, is_deleted, staff_type, assigned_hospital_id)
    VALUES (16, 'Sarah Telecaller', 'tc@vvf.org', $1, 'Telecaller', '+91 9876543211', 'tc.personal@vvf.org', 25, '2001-11-22', 'Female', 'Telecaller agent.', true, false, 'in-staff', 801)
    ON CONFLICT (id) DO UPDATE SET password_hash = $1, role = 'Telecaller', staff_type = 'in-staff', assigned_hospital_id = 801
  `, [tcPasswordHash]);

  // Insert Sowshee (in-staff user of Care Hospital)
  const sowsheePasswordHash = hashPassword('sowshee123');
  await query(`
    INSERT INTO users (id, name, email, password_hash, role, phone, personal_email, age, date_of_birth, gender, about, is_active, is_deleted, staff_type, assigned_hospital_id)
    VALUES (17, 'Sowshee', 'sowshee@vvf.org', $1, 'Telecaller', '+91 9876543212', 'sowshee.personal@vvf.org', 24, '2002-04-10', 'Female', 'In-Staff Telecaller.', true, false, 'in-staff', 801)
    ON CONFLICT (id) DO UPDATE SET password_hash = $1, role = 'Telecaller', staff_type = 'in-staff', assigned_hospital_id = 801
  `, [sowsheePasswordHash]);

  console.log('Users John Executive, Sarah Telecaller, and Sowshee (sowshee@vvf.org / sowshee123) seeded.');

  // 2. Seed hospitals (Hospital and In-House Hospital)
  // Let's create a main hospital (Hospital) in Daba Gardens (17.71905170045877, 83.2982754973378)
  await query(`
    INSERT INTO hospitals (id, name, city, state, contact_person, phone, status, latitude, longitude, address, landmark, pincode, google_maps_link, allowed_radius, clinic_category, hospital_uid)
    VALUES (801, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO UPDATE SET name = $1, clinic_category = $14, latitude = $7, longitude = $8, address = $9, landmark = $10, pincode = $11
  `, [
    'Care Hospital - Daba Gardens', 'Visakhapatnam', 'Andhra Pradesh', 'Dr. Ramesh', '+91 8899889988', 'ACTIVE',
    17.71905170045877, 83.2982754973378, 'Bangaramma Metta Daba Gardens, Allipuram, Visakhapatnam, Andhra Pradesh', 'Near', '530020',
    'https://maps.google.com/?q=17.71905170045877,83.2982754973378', 250, 'Hospital', 'HOSP-CARE-VSP'
  ]);

  // Let's create an In-house hospital belonging to Care Hospital
  await query(`
    INSERT INTO hospitals (id, name, city, state, contact_person, phone, status, latitude, longitude, address, landmark, pincode, google_maps_link, allowed_radius, clinic_category, parent_hospital_id, hospital_uid)
    VALUES (802, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (id) DO UPDATE SET clinic_category = $14, parent_hospital_id = $15, latitude = $7, longitude = $8, address = $9, landmark = $10, pincode = $11
  `, [
    'VVF Inhouse Clinic - Care Hospital', 'Visakhapatnam', 'Andhra Pradesh', 'Dr. Suresh', '+91 8899889989', 'ACTIVE',
    17.71905170045877, 83.2982754973378, 'Bangaramma Metta Daba Gardens, Allipuram, Visakhapatnam, Andhra Pradesh', 'Near', '530020',
    'https://maps.google.com/?q=17.71905170045877,83.2982754973378', 250, 'In-House Hospital', 801, 'HOSP-VVF-CARE'
  ]);

  console.log('Hospitals: Care Hospital - Daba Gardens (Hospital) and VVF Inhouse Clinic (In-house) seeded as Hospitals.');

  // 3. Seed Attendance Records
  await query(`
    DELETE FROM attendance WHERE user_id = 15;
  `);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateStr = yesterday.toISOString().split('T')[0];
  const yesterdayPunchIn = new Date(yesterday);
  yesterdayPunchIn.setHours(yesterdayPunchIn.getHours() - 8);
  const yesterdayPunchOut = yesterday;

  await query(`
    INSERT INTO attendance (user_id, date, status, punch_in, punch_out, gps_latitude, gps_longitude, geo_address)
    VALUES (15, $1, 'Present', $2, $3, 17.7125, 83.3103, 'Care Hospital Gate, Visakhapatnam')
  `, [yesterdayDateStr, yesterdayPunchIn.toISOString(), yesterdayPunchOut.toISOString()]);

  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];
  const todayPunchIn = new Date();
  todayPunchIn.setHours(todayPunchIn.getHours() - 2);

  await query(`
    INSERT INTO attendance (user_id, date, status, punch_in, gps_latitude, gps_longitude, geo_address)
    VALUES (15, $1, 'Present', $2, 17.7122, 83.3100, 'Care Hospital Parking, Visakhapatnam')
  `, [todayDateStr, todayPunchIn.toISOString()]);

  console.log('John Executive attendance records seeded.');

  // 4. Seed Field Lead Registrations
  await query(`
    DELETE FROM field_appointments WHERE executive_id = 15;
  `);

  await query(`
    INSERT INTO field_appointments (patient_lead_id, full_name, age, gender, phone_number, appointment_type, medical_history, executive_id, executive_name, status, lead_status, added_latitude, added_longitude, added_location_address)
    VALUES ('PL-101101', 'Kalyan Kumar', 45, 'Male', '9848022338', 'Doctor Consultation', 'Hypertension for 5 years.', 15, 'John Executive', 'New Lead', 'New Lead', 17.7118, 83.3085, 'Daba Gardens, Visakhapatnam, Andhra Pradesh')
  `);

  await query(`
    INSERT INTO field_appointments (patient_lead_id, full_name, age, gender, phone_number, appointment_type, medical_history, executive_id, executive_name, status, lead_status, added_latitude, added_longitude, added_location_address)
    VALUES ('PL-101102', 'Latha Sri', 38, 'Female', '9848022339', 'Dental Consultation', 'Severe toothache.', 15, 'John Executive', 'New Lead', 'New Lead', 17.7312, 83.3315, 'MVP Colony Sector 3, Visakhapatnam, Andhra Pradesh')
  `);

  console.log('Geolocated field leads for John Executive seeded.');

  // 5. Seed Field Hospital Visits
  await query(`
    DELETE FROM visits WHERE executive_id = 15;
  `);

  const visit1Start = new Date();
  visit1Start.setDate(visit1Start.getDate() - 1);
  visit1Start.setHours(visit1Start.getHours() - 4);
  const visit1End = new Date(visit1Start);
  visit1End.setHours(visit1End.getHours() + 1);

  await query(`
    INSERT INTO visits (executive_id, hospital_id, start_time, end_time, visit_type, status, checkin_latitude, checkin_longitude, checkin_time, checkout_latitude, checkout_longitude, checkout_time, geo_verification_status, distance_from_hospital_meters)
    VALUES (15, 801, $1, $2, 'Field Visit', 'Completed', 17.7124, 83.3102, $3, 17.7125, 83.3103, $4, 'VERIFIED', 15.4)
  `, [visit1Start.toISOString(), visit1End.toISOString(), visit1Start.toISOString(), visit1End.toISOString()]);

  const visit2Start = new Date();
  visit2Start.setMinutes(visit2Start.getMinutes() - 30);

  await query(`
    INSERT INTO visits (executive_id, hospital_id, start_time, visit_type, status, checkin_latitude, checkin_longitude, checkin_time, geo_verification_status, distance_from_hospital_meters)
    VALUES (15, 802, $1, 'Field Visit', 'In Progress', 17.7126, 83.3104, $2, 'VERIFIED', 25.8)
  `, [visit2Start.toISOString(), visit2Start.toISOString()]);

  console.log('Field hospital visits for John Executive seeded.');
  console.log('All custom demo data successfully seeded!');
  process.exit(0);
}

runSeed().catch(err => {
  console.error('Custom seeding failed:', err);
  process.exit(1);
});
