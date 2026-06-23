import { query } from '../config/db';
import { logAudit } from '../config/audit';

/**
 * Assigns a single field appointment lead to the active telecaller with the fewest pending unworked leads.
 * Pending unworked leads are those with status = 'New Lead', lead_status = 'New Lead',
 * last_followup_date is null, and telecaller_notes is null/empty.
 */
export const assignSingleLeadToTelecaller = async (leadId: number): Promise<any> => {
  try {
    // 1. Get all active, non-deleted telecallers
    const telecallersRes = await query(
      "SELECT id, name FROM users WHERE role = 'Telecaller' AND is_active = true AND is_deleted = false ORDER BY id ASC"
    );

    const telecallers = telecallersRes.rows;
    if (telecallers.length === 0) {
      console.log(`No active telecallers available to assign lead ${leadId}.`);
      return null;
    }

    // 2. Count pending unworked leads for each telecaller
    const activeLeadsCountRes = await query(`
      SELECT assigned_telecaller_id, COUNT(*)::int as count 
      FROM field_appointments 
      WHERE assigned_telecaller_id IS NOT NULL 
        AND status = 'New Lead'
        AND lead_status = 'New Lead'
        AND last_followup_date IS NULL
        AND (telecaller_notes IS NULL OR telecaller_notes = '')
      GROUP BY assigned_telecaller_id
    `);

    const countsMap: Record<number, number> = {};
    activeLeadsCountRes.rows.forEach((row: any) => {
      countsMap[row.assigned_telecaller_id] = row.count;
    });

    // 3. Find the telecaller with the minimum number of pending leads
    let targetTelecaller = telecallers[0];
    let minCount = countsMap[targetTelecaller.id] || 0;

    for (let i = 1; i < telecallers.length; i++) {
      const tc = telecallers[i];
      const count = countsMap[tc.id] || 0;
      if (count < minCount) {
        minCount = count;
        targetTelecaller = tc;
      }
    }

    // 4. Assign the lead
    const assignedAt = new Date().toISOString();
    const updateRes = await query(`
      UPDATE field_appointments 
      SET 
        assigned_telecaller_id = $1,
        assigned_telecaller_name = $2,
        assigned_at = $3
      WHERE id = $4 
      RETURNING *
    `, [targetTelecaller.id, targetTelecaller.name, assignedAt, leadId]);

    console.log(`Assigned lead ${leadId} to telecaller ${targetTelecaller.name} (ID: ${targetTelecaller.id}) with current pending count: ${minCount}`);
    return updateRes.rows[0];
  } catch (error) {
    console.error(`Error in assignSingleLeadToTelecaller for lead ${leadId}:`, error);
    throw error;
  }
};

/**
 * Rebalances all active pending/unworked leads across all currently active telecallers.
 * A lead is eligible for redistribution only when:
 * Status = Pending/New Lead, No visit done, No follow-up completed, No conversion, No closure.
 */
export const rebalanceLeadsAcrossTelecallers = async (
  triggerReason: string = 'System Setup',
  userId: number | null = null
): Promise<void> => {
  try {
    console.log(`[REDISTRIBUTION] Starting lead rebalancing. Trigger: ${triggerReason}`);

    // 1. Get all active, non-deleted telecallers
    const telecallersRes = await query(
      "SELECT id, name FROM users WHERE role = 'Telecaller' AND is_active = true AND is_deleted = false ORDER BY id ASC"
    );
    const activeTelecallers = telecallersRes.rows;
    const totalTCs = activeTelecallers.length;

    // 2. Fetch all eligible (pending unworked) leads
    const leadsRes = await query(
      `SELECT id, patient_lead_id, assigned_telecaller_id, assigned_telecaller_name 
       FROM field_appointments 
       WHERE status = 'New Lead' 
         AND lead_status = 'New Lead'
         AND last_followup_date IS NULL 
         AND (telecaller_notes IS NULL OR telecaller_notes = '')
       ORDER BY id ASC`
    );
    const eligibleLeads = leadsRes.rows;
    const totalLeads = eligibleLeads.length;

    if (totalTCs === 0) {
      console.log(`[REDISTRIBUTION] No active telecallers found. Cannot distribute ${totalLeads} pending leads.`);
      return;
    }

    // 3. Calculate target distribution counts (Math.floor and remainder)
    const baseLeads = Math.floor(totalLeads / totalTCs);
    const remaining = totalLeads % totalTCs;

    const targets = activeTelecallers.map((tc, idx) => {
      const targetCount = baseLeads + (idx < remaining ? 1 : 0);
      return {
        tc,
        targetCount,
        assignedLeads: [] as string[]
      };
    });

    let leadsMovedCount = 0;
    const assignedAt = new Date().toISOString();

    // 4. Assign leads to the telecallers to meet targets
    let leadIdx = 0;
    for (const target of targets) {
      const tc = target.tc;
      for (let i = 0; i < target.targetCount; i++) {
        const lead = eligibleLeads[leadIdx++];
        if (lead.assigned_telecaller_id !== tc.id) {
          leadsMovedCount++;
          // Update database record
          await query(
            `UPDATE field_appointments 
             SET assigned_telecaller_id = $1, 
                 assigned_telecaller_name = $2, 
                 assigned_at = $3
             WHERE id = $4`,
            [tc.id, tc.name, assignedAt, lead.id]
          );
        }
        target.assignedLeads.push(lead.patient_lead_id);
      }
    }

    // 5. Log redistribution information (Rule 6 requirements)
    console.log(`=== LEAD REDISTRIBUTION LOG ===`);
    console.log(`Trigger Reason: ${triggerReason}`);
    console.log(`Total Active Telecallers: ${totalTCs}`);
    console.log(`Total Pending Leads: ${totalLeads}`);
    console.log(`Leads Moved: ${leadsMovedCount}`);
    console.log(`Final Counts per Telecaller:`);
    targets.forEach(t => {
      console.log(` - ${t.tc.name} (ID: ${t.tc.id}): ${t.targetCount} leads [${t.assignedLeads.join(', ')}]`);
    });
    console.log(`================================`);

    // 6. Insert log into auto_redistribution_log table
    await query(
      `INSERT INTO auto_redistribution_log (trigger_reason, leads_moved, active_telecallers) 
       VALUES ($1, $2, $3)`,
      [triggerReason, leadsMovedCount, totalTCs]
    );

    // 7. Log audit log
    await logAudit(
      userId,
      'LEAD_REDISTRIBUTION',
      'field_appointments',
      null,
      `Lead redistribution triggered by "${triggerReason}". Moved ${leadsMovedCount} leads across ${totalTCs} active telecallers.`
    );

  } catch (error) {
    console.error('Error in rebalanceLeadsAcrossTelecallers:', error);
    throw error;
  }
};

