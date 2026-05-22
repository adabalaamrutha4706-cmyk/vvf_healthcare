import bcrypt from 'bcryptjs';
import { query, localDb } from './db';

const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);

export const seedDatabase = async () => {
  const users = [
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
      is_deleted: false
    },
    {
      id: 2,
      name: 'Metro General Hospital',
      city: 'Secunderabad',
      state: 'Telangana',
      contact_person: 'Dr. Srinivas',
      phone: '+91 9876543211',
      status: 'Active',
      is_deleted: false
    },
    {
      id: 3,
      name: 'Vascular Care Clinic',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      contact_person: 'Mrs. Lakshmi',
      phone: '+91 9876543212',
      status: 'Active',
      is_deleted: false
    },
    {
      id: 4,
      name: 'Apollo Vascular Wing',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      contact_person: 'Mr. Ramesh',
      phone: '+91 9876543213',
      status: 'Pending',
      is_deleted: false
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
        INSERT INTO hospitals (id, name, city, state, contact_person, phone, status, is_deleted)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [h.id, h.name, h.city, h.state, h.contact_person, h.phone, h.status, h.is_deleted]);
    }
    // Set serial sequences correctly in postgres
    await query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))").catch(() => {});
    await query("SELECT setval('hospitals_id_seq', (SELECT MAX(id) FROM hospitals))").catch(() => {});
  } catch (err) {
    // Suppress pg query issues as fallback takes care of it
  }
};
