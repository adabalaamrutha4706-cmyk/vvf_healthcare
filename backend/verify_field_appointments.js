const { query } = require('./dist/config/db');

async function testFieldAppointments() {
  console.log('--- STARTING FIELD APPOINTMENTS DB VERIFICATION ---');
  try {
    // 1. Verify table exists
    console.log('Step 1: Checking field_appointments table structure...');
    const tableCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'field_appointments'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('Notice: field_appointments table not found in Postgres schema. Attempting to check local JSON database or manual check.');
    } else {
      console.log('SUCCESS: Table exists in Postgres with columns:');
      tableCheck.rows.forEach(col => {
        console.log(` - ${col.column_name}: ${col.data_type}`);
      });
    }

    // 2. Perform mock lead creation
    console.log('\nStep 2: Performing test lead insertion...');
    const patientLeadId = `PL-TEST-${Math.floor(100000 + Math.random() * 900000)}`;
    const insertRes = await query(`
      INSERT INTO field_appointments (
        patient_lead_id, full_name, age, gender, phone_number,
        appointment_type, medical_history, executive_id, executive_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'New Lead') RETURNING *
    `, [
      patientLeadId,
      'Test Patient Lead',
      35,
      'Male',
      '9999999999',
      'Doctor Consultation',
      'Allergy to penicillin. Dynamic test run.',
      6, // Rohan Verma executive id
      'Rohan Verma'
    ]);

    const lead = insertRes.rows[0];
    if (!lead || lead.patient_lead_id !== patientLeadId) {
      throw new Error('Verification failed: Insertion failed or lead ID mismatch.');
    }
    console.log(`SUCCESS: Test lead inserted. ID: ${lead.id}, Lead ID: ${lead.patient_lead_id}`);

    // 3. Retrieve lead and verify details
    console.log('\nStep 3: Querying the inserted lead...');
    const queryRes = await query(`
      SELECT * FROM field_appointments WHERE id = $1
    `, [lead.id]);

    const retrievedLead = queryRes.rows[0];
    if (!retrievedLead || retrievedLead.full_name !== 'Test Patient Lead') {
      throw new Error('Verification failed: Failed to retrieve inserted lead or name mismatch.');
    }
    console.log(`SUCCESS: Lead details fetched and verified correctly.`);

    // 4. Update status
    console.log('\nStep 4: Transitioning lead status to "Contacted"...');
    const updateRes = await query(`
      UPDATE field_appointments SET status = 'Contacted' WHERE id = $1 RETURNING *
    `, [lead.id]);

    const updatedLead = updateRes.rows[0];
    if (!updatedLead || updatedLead.status !== 'Contacted') {
      throw new Error('Verification failed: Status transition failed.');
    }
    console.log('SUCCESS: Status transitioned successfully.');

    // 5. Clean up the test lead
    console.log('\nStep 5: Cleaning up verification test records...');
    await query(`
      DELETE FROM field_appointments WHERE id = $1
    `, [lead.id]);
    console.log('SUCCESS: Cleanup completed.');

    console.log('\n--- FIELD APPOINTMENTS DB VERIFICATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('\n--- VERIFICATION FAILED ---');
    console.error(err);
    process.exit(1);
  }
}

testFieldAppointments();
