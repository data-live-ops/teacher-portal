/**
 * Sanitize assignment data before sending to database
 * Converts empty strings to null for date fields and handles other edge cases
 */

/**
 * List of date fields in teacher_assignment_slots table
 */
const DATE_FIELDS = [
  'batch_start_date',
  'slot_start_date',
  'slot_end_date'
];

/**
 * Sanitize assignment data
 * - Converts empty strings to null for date fields
 * - Removes undefined values
 * - Trims string values
 *
 * @param {Object} data - Assignment data to sanitize
 * @returns {Object} Sanitized data
 */
export const sanitizeAssignmentData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = {};

  Object.keys(data).forEach(key => {
    let value = data[key];

    // Skip undefined values
    if (value === undefined) {
      return;
    }

    // Convert empty strings to null for date fields
    if (DATE_FIELDS.includes(key)) {
      if (value === '' || value === null) {
        sanitized[key] = null;
      } else if (typeof value === 'string') {
        // Ensure it's a valid date string, otherwise set to null
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date value for ${key}: "${value}". Setting to null.`);
          sanitized[key] = null;
        } else {
          sanitized[key] = value;
        }
      } else {
        sanitized[key] = value;
      }
      return;
    }

    // Trim string values (except for arrays and objects)
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
      return;
    }

    // Keep other values as-is
    sanitized[key] = value;
  });

  return sanitized;
};

/**
 * Sanitize date field specifically
 * @param {string|null} value - Date value to sanitize
 * @returns {string|null} Sanitized date value
 */
export const sanitizeDateField = (value) => {
  if (!value || value === '' || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date value: "${value}". Returning null.`);
      return null;
    }
  }

  return value;
};

/**
 * Validate assignment data before save
 * @param {Object} data - Assignment data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export const validateAssignmentData = (data) => {
  const errors = [];

  // Check required fields
  if (!data.grade) {
    errors.push('Grade is required');
  }

  if (!data.slot_name || data.slot_name.trim() === '') {
    errors.push('Slot name is required');
  }

  if (!data.days || !Array.isArray(data.days) || data.days.length === 0) {
    errors.push('At least one day must be selected');
  }

  // Validate date fields if provided
  DATE_FIELDS.forEach(field => {
    if (data[field] && data[field] !== '') {
      const date = new Date(data[field]);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid ${field.replace(/_/g, ' ')}: "${data[field]}"`);
      }
    }
  });

  // Validate date logic: slot_end_date >= slot_start_date
  if (data.slot_start_date && data.slot_end_date) {
    const startDate = new Date(data.slot_start_date);
    const endDate = new Date(data.slot_end_date);

    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      if (endDate < startDate) {
        errors.push('Slot end date must be after or equal to start date');
      }
    }
  }

  // Validate date logic: slot dates must be after batch_start_date
  if (data.batch_start_date && data.slot_start_date) {
    const batchDate = new Date(data.batch_start_date);
    const slotDate = new Date(data.slot_start_date);

    if (!isNaN(batchDate.getTime()) && !isNaN(slotDate.getTime())) {
      if (slotDate < batchDate) {
        errors.push('Slot start date must be after or equal to batch start date');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Prepare assignment data for database insert/update
 * Combines sanitization and validation
 *
 * @param {Object} data - Raw assignment data
 * @param {boolean} validateOnly - If true, only validate without sanitizing
 * @returns {Object} { data: Object, isValid: boolean, errors: string[] }
 */
export const prepareAssignmentData = (data, validateOnly = false) => {
  // Sanitize first
  const sanitized = validateOnly ? data : sanitizeAssignmentData(data);

  // Then validate
  const validation = validateAssignmentData(sanitized);

  return {
    data: sanitized,
    isValid: validation.isValid,
    errors: validation.errors
  };
};

export default sanitizeAssignmentData;
