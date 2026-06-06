import { Response } from 'express';
import { query, withTransaction } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { geocode } from '../utils/geocoder';
import { validateHospital } from '../utils/hospitalValidator';

export const getHospitals = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM hospitals WHERE is_deleted = false ORDER BY name ASC'
    );
    
    // Fetch active executives to map comma-separated IDs to names
    const execsResult = await query("SELECT id, name FROM users WHERE role = 'Executive' AND is_deleted = false");
    const execMap = new Map<number, string>();
    execsResult.rows.forEach((r: any) => execMap.set(r.id, r.name));

    const enrichedHospitals = result.rows.map((hosp: any) => {
      let execList: any[] = [];
      if (hosp.assigned_executives) {
        const ids = hosp.assigned_executives.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
        execList = ids.map((id: number) => ({ id, name: execMap.get(id) || `User #${id}` }));
      }
      return {
        ...hosp,
        legacyHospitalId: hosp.legacy_hospital_id,
        assigned_executives_list: execList,
        assigned_executives_names: execList.map(e => e.name).join(', ')
      };
    });

    // Sort by VVF UID suffix numerically in ascending order
    enrichedHospitals.sort((a: any, b: any) => {
      const getNum = (uid: string) => {
        if (!uid || !uid.startsWith('VVF-')) return 999999;
        const num = parseInt(uid.replace('VVF-', ''), 10);
        return isNaN(num) ? 999999 : num;
      };
      return getNum(a.hospital_uid) - getNum(b.hospital_uid);
    });

    return res.status(200).json({
      success: true,
      data: { hospitals: enrichedHospitals },
      hospitals: enrichedHospitals
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};

export const getHospitalById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM hospitals WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found.',
        errorCode: 'HOSPITAL_NOT_FOUND',
        error: 'Hospital not found.'
      });
    }

    const hosp = result.rows[0];
    
    // Fetch active executives to map comma-separated IDs to names
    const execsResult = await query("SELECT id, name FROM users WHERE role = 'Executive' AND is_deleted = false");
    const execMap = new Map<number, string>();
    execsResult.rows.forEach((r: any) => execMap.set(r.id, r.name));

    let execList: any[] = [];
    if (hosp.assigned_executives) {
      const ids = hosp.assigned_executives.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
      execList = ids.map((id: number) => ({ id, name: execMap.get(id) || `User #${id}` }));
    }
    
    const enrichedHospital = {
      ...hosp,
      legacyHospitalId: hosp.legacy_hospital_id,
      assigned_executives_list: execList,
      assigned_executives_names: execList.map(e => e.name).join(', ')
    };

    return res.status(200).json({
      success: true,
      data: { hospital: enrichedHospital },
      hospital: enrichedHospital
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};

export const geocodeHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const address = req.query.address as string || '';
    const googleMapsLink = req.query.google_maps_link as string || '';
    
    if (!address && !googleMapsLink) {
      return res.status(400).json({
        success: false,
        message: 'Address or Google Maps Link is required.'
      });
    }
    
    const result = await geocode(address, googleMapsLink);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Geocoding failed.'
    });
  }
};

export const createHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    // Only Admin & Superadmin can add hospitals
    if (req.user?.role !== 'Admin' && req.user?.role !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const validation = validateHospital(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: Object.values(validation.errors)[0],
        errors: validation.errors,
        warnings: validation.warnings,
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const { 
      name, city, state, contact_person, phone, status,
      address, landmark, pincode, google_maps_link, allowed_radius,
      hospital_type, branch_code, visiting_hours, territory_zone,
      reception_phone, alternate_phone, email, hospital_admin_name, department,
      assigned_executives, visit_frequency,
      require_gps_validation, require_live_photo, require_checkout, allow_remote_completion, geofencing_enabled,
      temporarily_closed
    } = req.body;

    const legacyHospitalIdInput = req.body.legacyHospitalId !== undefined ? req.body.legacyHospitalId : req.body.legacy_hospital_id;
    const legacyHospitalId = legacyHospitalIdInput ? legacyHospitalIdInput.trim() : null;

    // Run geocoder (OSM Nominatim with fallback)
    const geoResult = await geocode(address || `${city}, ${state}`, google_maps_link);

    const hospital = await withTransaction(async (client) => {
      // Concurrency lock to prevent race conditions during sequential generation
      await client.query('LOCK TABLE hospitals IN SHARE ROW EXCLUSIVE MODE').catch(() => {
        // Suppress lock table command exceptions for local fallbacks/mock databases
      });

      // Duplicate check on name + address
      const dupCheck = await client.query(
        'SELECT id FROM hospitals WHERE name = $1 AND address = $2 AND is_deleted = false',
        [name, address]
      );
      if (dupCheck.rows.length > 0) {
        throw {
          status: 400,
          message: 'A hospital with this name and address is already registered.',
          errorCode: 'DUPLICATE_HOSPITAL'
        };
      }

      // Duplicate phone checks
      const phoneFields = [phone, reception_phone, alternate_phone].filter(p => p && p.trim() !== '');
      if (phoneFields.length > 0) {
        const phoneCheck = await client.query(
          `SELECT id, name FROM hospitals 
           WHERE (phone = ANY($1) OR reception_phone = ANY($1) OR alternate_phone = ANY($1)) 
             AND is_deleted = false`,
          [phoneFields]
        );
        if (phoneCheck.rows.length > 0) {
          throw {
            status: 400,
            message: `Contact number is already registered to another hospital: ${phoneCheck.rows[0].name}.`,
            errorCode: 'DUPLICATE_PHONE'
          };
        }
      }

      // Auto-generate sequential UID in VVF-XXX format
      const uidsRes = await client.query('SELECT hospital_uid FROM hospitals WHERE hospital_uid IS NOT NULL');
      let maxNum = 0;
      for (const row of uidsRes.rows) {
        const uid = row.hospital_uid;
        if (uid && uid.startsWith('VVF-')) {
          const numStr = uid.substring(4);
          if (/^\d+$/.test(numStr)) {
            const num = parseInt(numStr, 10);
            if (num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
      const nextNum = maxNum + 1;
      const hospitalUid = `VVF-${nextNum.toString().padStart(3, '0')}`;

      // Auto-generate branch code if not provided
      const finalBranchCode = branch_code || `BR-HOSP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const insertResult = await client.query(
        `INSERT INTO hospitals (
          name, city, state, contact_person, phone, status,
          latitude, longitude, address, landmark, pincode, google_maps_link, allowed_radius,
          hospital_type, branch_code, visiting_hours, territory_zone,
          reception_phone, alternate_phone, email, hospital_admin_name, department,
          assigned_executives, visit_frequency,
          require_gps_validation, require_live_photo, require_checkout, allow_remote_completion, geofencing_enabled,
          temporarily_closed, created_by, hospital_uid, geo_verification_status, legacy_hospital_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34) RETURNING *`,
        [
          name, city, state, contact_person || '', phone || '', status || 'ACTIVE',
          geoResult.latitude,
          geoResult.longitude,
          address || '',
          landmark || '',
          pincode || '',
          google_maps_link || '',
          allowed_radius !== undefined && allowed_radius !== null && allowed_radius !== '' ? parseInt(allowed_radius, 10) : 200,
          hospital_type || 'Clinic',
          finalBranchCode,
          visiting_hours || '',
          territory_zone || '',
          reception_phone || '',
          alternate_phone || '',
          email || '',
          hospital_admin_name || '',
          department || '',
          assigned_executives || '', // comma-separated executive IDs
          visit_frequency || 'Weekly',
          require_gps_validation !== undefined ? (require_gps_validation === true || require_gps_validation === 'true') : true,
          require_live_photo !== undefined ? (require_live_photo === true || require_live_photo === 'true') : false,
          require_checkout !== undefined ? (require_checkout === true || require_checkout === 'true') : true,
          allow_remote_completion !== undefined ? (allow_remote_completion === true || allow_remote_completion === 'true') : true,
          geofencing_enabled !== undefined ? (geofencing_enabled === true || geofencing_enabled === 'true') : true,
          temporarily_closed !== undefined ? (temporarily_closed === true || temporarily_closed === 'true') : false,
          userId || null,
          hospitalUid,
          geoResult.status,
          legacyHospitalId
        ]
      );

      return insertResult.rows[0];
    });

    const hospitalUid = hospital.hospital_uid;

    await logAudit(
      userId || null,
      'CREATE_HOSPITAL',
      'hospitals',
      hospital.id,
      `Hospital '${name}' (${hospitalUid}) created by ${userName}`
    );

    // Resolve executives for return payload
    const execsResult = await query("SELECT id, name FROM users WHERE role = 'Executive' AND is_deleted = false");
    const execMap = new Map<number, string>();
    execsResult.rows.forEach((r: any) => execMap.set(r.id, r.name));
    
    let execList: any[] = [];
    if (hospital.assigned_executives) {
      const ids = hospital.assigned_executives.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
      execList = ids.map((id: number) => ({ id, name: execMap.get(id) || `User #${id}` }));
    }
    
    const enrichedHospital = {
      ...hospital,
      legacyHospitalId: hospital.legacy_hospital_id,
      assigned_executives_list: execList,
      assigned_executives_names: execList.map(e => e.name).join(', ')
    };

    const payload = {
      message: 'Hospital created successfully.',
      hospital: enrichedHospital,
      warnings: validation.warnings
    };

    return res.status(201).json({
      success: true,
      data: payload,
      ...payload
    });
  } catch (err: any) {
    if (err.status && err.message) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        errorCode: err.errorCode,
        error: err.message
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};

export const updateHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    // Only Admin & Superadmin can update hospitals
    if (req.user?.role !== 'Admin' && req.user?.role !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { id } = req.params;
    const existingResult = await query(
      'SELECT * FROM hospitals WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found.',
        errorCode: 'HOSPITAL_NOT_FOUND'
      });
    }

    const validation = validateHospital(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: Object.values(validation.errors)[0],
        errors: validation.errors,
        warnings: validation.warnings,
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const hospital = existingResult.rows[0];
    const { 
      name, city, state, contact_person, phone, status,
      address, landmark, pincode, google_maps_link, allowed_radius,
      hospital_type, branch_code, visiting_hours, territory_zone,
      reception_phone, alternate_phone, email, hospital_admin_name, department,
      assigned_executives, visit_frequency,
      require_gps_validation, require_live_photo, require_checkout, allow_remote_completion, geofencing_enabled,
      temporarily_closed
    } = req.body;

    const legacyHospitalIdInput = req.body.legacyHospitalId !== undefined ? req.body.legacyHospitalId : req.body.legacy_hospital_id;
    const newLegacyHospitalId = legacyHospitalIdInput !== undefined ? (legacyHospitalIdInput ? legacyHospitalIdInput.trim() : null) : hospital.legacy_hospital_id;

    // Duplicate check on name + address (excluding current id)
    const dupCheck = await query(
      'SELECT id FROM hospitals WHERE name = $1 AND address = $2 AND id != $3 AND is_deleted = false',
      [name || hospital.name, address || hospital.address, id]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A hospital with this name and address is already registered.',
        errorCode: 'DUPLICATE_HOSPITAL'
      });
    }

    // Duplicate phone checks (excluding current id)
    const phoneFields = [phone, reception_phone, alternate_phone].filter(p => p && p.trim() !== '');
    if (phoneFields.length > 0) {
      const phoneCheck = await query(
        `SELECT id, name FROM hospitals 
         WHERE (phone = ANY($1) OR reception_phone = ANY($1) OR alternate_phone = ANY($1)) 
           AND id != $2 AND is_deleted = false`,
        [phoneFields, id]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Contact number is already registered to another hospital: ${phoneCheck.rows[0].name}.`,
          errorCode: 'DUPLICATE_PHONE'
        });
      }
    }

    const newName = name !== undefined ? name : hospital.name;
    const newCity = city !== undefined ? city : hospital.city;
    const newState = state !== undefined ? state : hospital.state;
    const newContact = contact_person !== undefined ? contact_person : hospital.contact_person;
    const newPhone = phone !== undefined ? phone : hospital.phone;
    const newStatus = status !== undefined ? status : hospital.status;
    const newAddress = address !== undefined ? address : hospital.address;
    const newLandmark = landmark !== undefined ? landmark : hospital.landmark;
    const newPincode = pincode !== undefined ? pincode : hospital.pincode;
    const newGmaps = google_maps_link !== undefined ? google_maps_link : hospital.google_maps_link;
    const newRadius = allowed_radius !== undefined ? (allowed_radius !== null && allowed_radius !== '' ? parseInt(allowed_radius, 10) : null) : hospital.allowed_radius;
    const newType = hospital_type !== undefined ? hospital_type : hospital.hospital_type;
    const newBranch = branch_code !== undefined ? branch_code : hospital.branch_code;
    const newHours = visiting_hours !== undefined ? visiting_hours : hospital.visiting_hours;
    const newZone = territory_zone !== undefined ? territory_zone : hospital.territory_zone;
    const newRecPhone = reception_phone !== undefined ? reception_phone : hospital.reception_phone;
    const newAltPhone = alternate_phone !== undefined ? alternate_phone : hospital.alternate_phone;
    const newEmail = email !== undefined ? email : hospital.email;
    const newAdminName = hospital_admin_name !== undefined ? hospital_admin_name : hospital.hospital_admin_name;
    const newDept = department !== undefined ? department : hospital.department;
    const newAssigned = assigned_executives !== undefined ? assigned_executives : hospital.assigned_executives;
    const newFreq = visit_frequency !== undefined ? visit_frequency : hospital.visit_frequency;
    const newGpsVal = require_gps_validation !== undefined ? (require_gps_validation === true || require_gps_validation === 'true' || require_gps_validation === 'TRUE') : hospital.require_gps_validation;
    const newLivePhoto = require_live_photo !== undefined ? (require_live_photo === true || require_live_photo === 'true' || require_live_photo === 'TRUE') : hospital.require_live_photo;
    const newCheckOut = require_checkout !== undefined ? (require_checkout === true || require_checkout === 'true' || require_checkout === 'TRUE') : hospital.require_checkout;
    const newRemote = allow_remote_completion !== undefined ? (allow_remote_completion === true || allow_remote_completion === 'true' || allow_remote_completion === 'TRUE') : hospital.allow_remote_completion;
    const newGeofence = geofencing_enabled !== undefined ? (geofencing_enabled === true || geofencing_enabled === 'true' || geofencing_enabled === 'TRUE') : hospital.geofencing_enabled;
    const newClosed = temporarily_closed !== undefined ? (temporarily_closed === true || temporarily_closed === 'true' || temporarily_closed === 'TRUE') : hospital.temporarily_closed;

    // Run geocoder if address or link is changed
    let resolvedLat = hospital.latitude;
    let resolvedLng = hospital.longitude;
    let resolvedStatus = hospital.geo_verification_status || 'MANUAL_REVIEW_REQUIRED';

    if (address !== undefined || google_maps_link !== undefined) {
      const geoResult = await geocode(newAddress, newGmaps);
      resolvedLat = geoResult.latitude;
      resolvedLng = geoResult.longitude;
      resolvedStatus = geoResult.status;
    }

    const result = await query(
      `UPDATE hospitals SET
        name = $1, city = $2, state = $3, contact_person = $4, phone = $5, status = $6,
        latitude = $7, longitude = $8, address = $9, landmark = $10, pincode = $11, google_maps_link = $12, allowed_radius = $13,
        hospital_type = $14, branch_code = $15, visiting_hours = $16, territory_zone = $17,
        reception_phone = $18, alternate_phone = $19, email = $20, hospital_admin_name = $21, department = $22,
        assigned_executives = $23, visit_frequency = $24,
        require_gps_validation = $25, require_live_photo = $26, require_checkout = $27, allow_remote_completion = $28, geofencing_enabled = $29,
        temporarily_closed = $30, updated_by = $31, geo_verification_status = $32, legacy_hospital_id = $33, updated_at = CURRENT_TIMESTAMP
       WHERE id = $34 AND is_deleted = false RETURNING *`,
      [
        newName, newCity, newState, newContact, newPhone, newStatus,
        resolvedLat, resolvedLng, newAddress, newLandmark, newPincode, newGmaps, newRadius,
        newType, newBranch, newHours, newZone,
        newRecPhone, newAltPhone, newEmail, newAdminName, newDept,
        newAssigned, newFreq,
        newGpsVal, newLivePhoto, newCheckOut, newRemote, newGeofence,
        newClosed, userId || null, resolvedStatus, newLegacyHospitalId, id
      ]
    );

    const updatedHospital = result.rows[0];

    await logAudit(
      userId || null,
      'EDIT_HOSPITAL',
      'hospitals',
      updatedHospital.id,
      `Hospital '${newName}' (${hospital.hospital_uid}) updated by ${userName}`,
      { changes: req.body }
    );

    // Resolve executives for return payload
    const execsResult = await query("SELECT id, name FROM users WHERE role = 'Executive' AND is_deleted = false");
    const execMap = new Map<number, string>();
    execsResult.rows.forEach((r: any) => execMap.set(r.id, r.name));
    
    let execList: any[] = [];
    if (updatedHospital.assigned_executives) {
      const ids = updatedHospital.assigned_executives.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
      execList = ids.map((id: number) => ({ id, name: execMap.get(id) || `User #${id}` }));
    }
    
    const enrichedHospital = {
      ...updatedHospital,
      legacyHospitalId: updatedHospital.legacy_hospital_id,
      assigned_executives_list: execList,
      assigned_executives_names: execList.map(e => e.name).join(', ')
    };

    const payload = {
      message: 'Hospital updated successfully.',
      hospital: enrichedHospital,
      warnings: validation.warnings
    };

    return res.status(200).json({
      success: true,
      data: payload,
      ...payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const deleteHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    // Only Admin & Superadmin can delete hospitals
    if (req.user?.role !== 'Admin' && req.user?.role !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { id } = req.params;

    const checkResult = await query(
      'SELECT id, name, hospital_uid FROM hospitals WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found.',
        errorCode: 'HOSPITAL_NOT_FOUND'
      });
    }

    const hospitalName = checkResult.rows[0].name;
    const hospitalUid = checkResult.rows[0].hospital_uid;

    await query(
      `UPDATE hospitals SET is_deleted = true, deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    await logAudit(
      userId || null,
      'DELETE_HOSPITAL',
      'hospitals',
      parseInt(id, 10),
      `Hospital '${hospitalName}' (${hospitalUid}) soft deleted by ${userName}`
    );

    return res.status(200).json({
      success: true,
      message: 'Hospital deleted successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
