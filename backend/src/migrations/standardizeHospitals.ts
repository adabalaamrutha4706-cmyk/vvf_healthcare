import { query } from '../config/db';
import { logAudit } from '../config/audit';

export const standardizeHospitalUIDs = async () => {
  try {
    console.log('[MIGRATION] Starting Hospital UID standardization & backfill...');
    
    // Ensure the legacy_hospital_id column exists
    await query("ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS legacy_hospital_id VARCHAR(100);").catch(() => {});

    // Fetch all hospitals (including soft-deleted ones)
    const result = await query("SELECT * FROM hospitals");
    const hospitals = result.rows;

    const conforming: any[] = [];
    const nonConforming: any[] = [];

    // Categorize hospitals
    for (const h of hospitals) {
      const uid = h.hospital_uid;
      if (uid && uid.startsWith('VVF-') && /^\d+$/.test(uid.substring(4))) {
        conforming.push(h);
      } else {
        nonConforming.push(h);
      }
    }

    // Determine max VVF suffix
    let maxVvfNum = 0;
    for (const h of conforming) {
      const num = parseInt(h.hospital_uid.substring(4), 10);
      if (num > maxVvfNum) {
        maxVvfNum = num;
      }
    }
    console.log(`[MIGRATION] Conforming VVF UIDs found: ${conforming.length}. Highest suffix: ${maxVvfNum}`);
    console.log(`[MIGRATION] Non-conforming/missing UID records to migrate: ${nonConforming.length}`);

    if (nonConforming.length === 0) {
      console.log('[MIGRATION] All hospitals already have conforming UIDs. No action required.');
      return;
    }

    // Sort non-conforming by database ID to assign sequentially
    nonConforming.sort((a, b) => a.id - b.id);

    // Migrate each record
    for (const h of nonConforming) {
      maxVvfNum += 1;
      const nextVvfUid = `VVF-${maxVvfNum.toString().padStart(3, '0')}`;
      
      // Preserve old ID in legacy_hospital_id if not already set, and if current uid exists
      let legacyId = h.legacy_hospital_id;
      if (!legacyId && h.hospital_uid) {
        const trimmed = h.hospital_uid.trim();
        const lowerUid = trimmed.toLowerCase();
        if (trimmed !== '' && lowerUid !== 'pending' && lowerUid !== 'uid pending') {
          legacyId = h.hospital_uid;
        }
      }

      console.log(`[MIGRATION] Migrating hospital ID ${h.id} (${h.name}): UID ${h.hospital_uid || 'NULL'} -> ${nextVvfUid}, legacy ID -> ${legacyId || 'NULL'}`);

      // Update database
      await query(
        "UPDATE hospitals SET hospital_uid = $1, legacy_hospital_id = $2 WHERE id = $3",
        [nextVvfUid, legacyId || null, h.id]
      );

      // Log to audit table
      await logAudit(
        null, // System action
        'MIGRATE_HOSPITAL_UID',
        'hospitals',
        h.id,
        `System migrated hospital '${h.name}' UID from '${h.hospital_uid || 'NULL'}' to '${nextVvfUid}' (legacy: '${legacyId || 'NULL'}')`
      );
    }

    console.log('[MIGRATION] Hospital UID standardization & backfill completed successfully.');
  } catch (err: any) {
    console.error('[MIGRATION] Error standardizing hospital UIDs:', err);
  }
};
