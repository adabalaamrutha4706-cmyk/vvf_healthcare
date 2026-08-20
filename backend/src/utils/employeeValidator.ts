export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const countChar = (str: string, char: string): number => {
  return str.split(char).length - 1;
};

export const validateEmployee = (data: any): ValidationResult => {
  const errors: Record<string, string> = {};

  // 1. Full Name
  const name = data.name !== undefined ? data.name : '';
  
  if (name === null || name === undefined || name === '') {
    errors.name = 'Full Name is required.';
  } else {
    // Check length (minimum 3, maximum 100 characters)
    if (name.length < 3 || name.length > 100) {
      errors.name = 'Full Name must be between 3 and 100 characters.';
    }
    // Check characters (only alphabets, spaces, and full stops)
    else if (!/^[a-zA-Z\s\.]+$/.test(name)) {
      errors.name = 'Only alphabets and full stops are allowed in Full Name.';
    }
    // Numbers-only check (even though already checked by regex, explicitly check or block numbers)
    else if (/^\d+$/.test(name.trim())) {
      errors.name = 'Numbers-only values are not allowed in Full Name.';
    }
    // Max 2 full stops
    else if (countChar(name, '.') > 2) {
      errors.name = 'Maximum 2 full stops are only allowed in Full Name.';
    }
    // Full stop cannot appear continuously
    else if (/\.\./.test(name)) {
      errors.name = 'Full stops cannot appear continuously in Full Name.';
    }
    // Should not start or end with full stop or spaces
    else if (name.startsWith('.') || name.endsWith('.')) {
      errors.name = 'Full Name should not start or end with a full stop.';
    }
    else if (name.startsWith(' ') || name.endsWith(' ')) {
      errors.name = 'Full Name should not start or end with spaces.';
    }
  }

  // 2. Phone Number (mandatory)
  const phone = data.phone !== undefined ? data.phone : '';
  if (phone === null || phone === undefined || phone === '') {
    errors.phone = 'Phone Number is required.';
  } else if (!/^\d+$/.test(phone)) {
    errors.phone = 'Phone Number must contain only numeric digits.';
  } else if (phone.length !== 10) {
    errors.phone = 'Phone Number must be exactly 10 digits.';
  }

  // 3. Date of Birth (mandatory)
  const dob = data.date_of_birth !== undefined ? data.date_of_birth : '';
  if (dob === null || dob === undefined || dob === '') {
    errors.date_of_birth = 'Date of Birth is required.';
  } else {
    const selectedDate = new Date(dob);
    const today = new Date();
    if (selectedDate > today) {
      errors.date_of_birth = 'Date of Birth cannot be in the future.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
