export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

// Check count of specific character in a string
const countChar = (str: string, char: string): number => {
  return str.split(char).length - 1;
};

// Check if string contains only numbers
const isOnlyNumbers = (str: string): boolean => {
  return /^\d+$/.test(str);
};

// Parse time string in "HH:MM" 24h format and return minutes
const timeToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

export const validateHospital = (data: any): ValidationResult => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // 1. Clinic Name
  const name = (data.name || '').trim();
  if (!name) {
    errors.name = 'Clinic name is required.';
  } else if (name.length < 3 || name.length > 100) {
    errors.name = 'Clinic name must be between 3 and 100 characters.';
  } else if (!/^[a-zA-Z0-9\s\-&\.]+$/.test(name)) {
    errors.name = 'Clinic name can contain only letters, numbers, spaces, hyphens, ampersands, and full stops.';
  } else if (isOnlyNumbers(name)) {
    errors.name = 'Clinic name cannot contain only numbers.';
  } else if (countChar(name, '.') > 1) {
    errors.name = 'Clinic name can contain at most one full stop.';
  }

  // 2. Branch Code (if provided)
  const branchCode = (data.branch_code || '').trim();
  if (branchCode) {
    if (!/^[A-Z0-9\-]+$/.test(branchCode)) {
      errors.branch_code = 'Branch code must contain only uppercase letters, numbers, and hyphens.';
    }
  }

  // 3. Visiting Hours (start / end times comparison)
  const startTime = data.visiting_hours_start;
  const endTime = data.visiting_hours_end;
  if (startTime && endTime) {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    if (startMins !== null && endMins !== null && endMins <= startMins) {
      errors.visiting_hours = 'Visiting hours end time must be greater than start time.';
    }
  }

  // 4. Territory / Zone
  const territory = (data.territory_zone || '').trim();
  if (territory) {
    if (!/^[a-zA-Z\s]+$/.test(territory)) {
      errors.territory_zone = 'Territory/Zone must contain only letters and spaces.';
    }
  }

  // 5. Full Address
  const address = (data.address || '').trim();
  if (!address) {
    errors.address = 'Full address is required.';
  } else if (address.length < 10) {
    errors.address = 'Full address must be at least 10 characters long.';
  } else if (!/^[a-zA-Z0-9\s,\/\-]+$/.test(address)) {
    errors.address = 'Full address contains invalid characters. Only letters, numbers, commas, slashes, hyphens, and spaces allowed.';
  }

  // 6. City
  const city = (data.city || '').trim();
  if (!city) {
    errors.city = 'City is required.';
  } else if (!/^[a-zA-Z\s]+$/.test(city)) {
    errors.city = 'City must contain only letters and spaces.';
  }

  // 7. Pincode
  const pincode = (data.pincode || '').trim();
  if (pincode) {
    if (!/^\d{6}$/.test(pincode)) {
      errors.pincode = 'Pincode must contain exactly 6 numeric digits.';
    }
  }

  // 8. Landmark
  const landmark = (data.landmark || '').trim();
  if (landmark) {
    if (!/^[a-zA-Z0-9\s,\-]+$/.test(landmark)) {
      errors.landmark = 'Landmark must contain only letters, numbers, commas, spaces, and hyphens.';
    }
  }

  // 9. Google Maps Link
  const mapsLink = (data.google_maps_link || '').trim();
  if (mapsLink) {
    if (!/(google\.com\/maps|maps\.app\.goo\.gl)/.test(mapsLink)) {
      errors.google_maps_link = 'Invalid Google Maps link. Must contain google.com/maps or maps.app.goo.gl.';
    }
  }

  // 10. Allowed Radius
  if (data.allowed_radius !== undefined && data.allowed_radius !== null && data.allowed_radius !== '') {
    const radius = parseInt(data.allowed_radius, 10);
    if (isNaN(radius) || radius < 50 || radius > 1000) {
      errors.allowed_radius = 'Allowed check-in radius must be a number between 50 and 1000 meters.';
    } else if (radius > 300) {
      warnings.allowed_radius = 'Check-in radius exceeds the recommended 300 meters limit. Verify geofencing zone accuracy.';
    }
  }

  // 11. Primary POC Name
  const pocName = (data.contact_person || '').trim();
  if (pocName) {
    if (pocName.length < 3 || pocName.length > 100) {
      errors.contact_person = 'Primary POC Name must be between 3 and 100 characters.';
    } else if (!/^[a-zA-Z\s\.]+$/.test(pocName)) {
      errors.contact_person = 'Primary POC Name must contain only letters, spaces, and full stops.';
    } else if (!/[a-zA-Z]/.test(pocName)) {
      errors.contact_person = 'Primary POC Name must contain alphabets.';
    } else if (countChar(pocName, '.') > 2) {
      errors.contact_person = 'Primary POC Name can contain at most two full stops.';
    }
  }

  // 12. Admin Name
  const adminName = (data.hospital_admin_name || '').trim();
  if (adminName) {
    if (adminName.length < 3 || adminName.length > 100) {
      errors.hospital_admin_name = 'Hospital Admin Name must be between 3 and 100 characters.';
    } else if (!/^[a-zA-Z\s\.]+$/.test(adminName)) {
      errors.hospital_admin_name = 'Hospital Admin Name must contain only letters, spaces, and full stops.';
    } else if (!/[a-zA-Z]/.test(adminName)) {
      errors.hospital_admin_name = 'Hospital Admin Name must contain alphabets.';
    } else if (countChar(adminName, '.') > 2) {
      errors.hospital_admin_name = 'Hospital Admin Name can contain at most two full stops.';
    }
  }

  // 13. Phones (Primary, Reception, Alternate)
  const phone = (data.phone || '').trim();
  if (phone) {
    if (!/^\d+$/.test(phone)) {
      errors.phone = 'Primary Contact Number must contain only numeric digits.';
    } else if (phone.length > 10) {
      errors.phone = 'Primary Contact Number must not exceed 10 digits.';
    }
  }

  const reception = (data.reception_phone || '').trim();
  if (reception) {
    if (!/^\d+$/.test(reception)) {
      errors.reception_phone = 'Reception Contact Number must contain only numeric digits.';
    } else if (reception.length > 10) {
      errors.reception_phone = 'Reception Contact Number must not exceed 10 digits.';
    }
  }

  const alternate = (data.alternate_phone || '').trim();
  if (alternate) {
    if (!/^\d+$/.test(alternate)) {
      errors.alternate_phone = 'Alternate Contact Number must contain only numeric digits.';
    } else if (alternate.length > 10) {
      errors.alternate_phone = 'Alternate Contact Number must not exceed 10 digits.';
    }
  }

  // 14. Email
  const email = (data.email || '').trim();
  if (email) {
    if (!/^[^\s@]+@gmail\.com$/.test(email.toLowerCase())) {
      errors.email = 'Email Address must contain @gmail.com.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
};
