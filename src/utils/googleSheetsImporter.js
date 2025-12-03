export const fetchGoogleSheetData = async (spreadsheetId, sheetName) => {
  try {
    const apiKey = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;

    if (!apiKey) {
      throw new Error('Google Sheets API key not found in environment variables. Please add REACT_APP_GOOGLE_SHEETS_API_KEY to .env file');
    }

    const encodedSheetName = encodeURIComponent(sheetName);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}?key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 403) {
        throw new Error('Access denied. Please check:\n1. API key is valid\n2. Spreadsheet is shared publicly or with the service account\n3. Google Sheets API is enabled');
      } else if (response.status === 404) {
        throw new Error(`Spreadsheet or sheet not found. Please check:\n1. Spreadsheet ID is correct\n2. Sheet name "${sheetName}" exists\n3. Spreadsheet is accessible`);
      } else {
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }
    }

    const data = await response.json();

    if (!data.values || data.values.length === 0) {
      throw new Error('No data found in the specified sheet');
    }

    return {
      values: data.values,
      range: data.range
    };
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    throw error;
  }
};

export const parseSheetDataToAssignments = (rawData, teachers) => {
  if (!rawData || rawData.length === 0) {
    throw new Error('No data found in spreadsheet');
  }

  const headers = rawData[0];
  const dataRows = rawData.slice(1);

  const getColumnIndex = (headerName) => {
    const index = headers.findIndex(h =>
      h && h.toString().toLowerCase().trim() === headerName.toLowerCase()
    );
    return index;
  };

  const columnMap = {
    grade: getColumnIndex('grade'),
    subject: getColumnIndex('subject'),
    slot_name: getColumnIndex('slot name'),
    rules: getColumnIndex('rules'),
    days: getColumnIndex('days'),
    time_range: getColumnIndex('time range'),
    duration: getColumnIndex('duration'),
    status: getColumnIndex('status'),
    guru_juara_name: getColumnIndex('guru juara name'),
    mentor_name: getColumnIndex('mentor name'),
    notes: getColumnIndex('notes'),
    class_capacity: getColumnIndex('class capacity'),
    curriculum: getColumnIndex('curriculum'),
    batch_start_date: getColumnIndex('batch start date'),
    slot_start_date: getColumnIndex('slot start date'),
    slot_end_date: getColumnIndex('slot end date'),
    class_rule: getColumnIndex('class rule')
  };

  const requiredColumns = ['grade', 'subject', 'slot_name'];
  const missingColumns = requiredColumns.filter(col => columnMap[col] === -1);

  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  // Build teacher name to ID lookup map
  // Use Set to track unique teacher IDs (teachers array may have duplicates per subject)
  const teacherNameToId = {};
  const seenIds = new Set();

  teachers.forEach(teacher => {
    // Skip if we've already processed this teacher ID
    if (seenIds.has(teacher.id)) return;
    seenIds.add(teacher.id);

    // Normalize name: lowercase, trim, and remove extra spaces
    const normalizedName = teacher.name.toLowerCase().trim().replace(/\s+/g, ' ');
    teacherNameToId[normalizedName] = teacher.id;
  });

  console.log(`Teacher lookup map created with ${Object.keys(teacherNameToId).length} unique teachers`);

  const assignments = dataRows
    .filter(row => {
      if (!row || row.length === 0) return false;
      const grade = row[columnMap.grade];
      const subject = row[columnMap.subject];
      const slotName = row[columnMap.slot_name];
      return grade && subject && slotName;
    })
    .map((row, index) => {
      const assignment = {};

      const gradeValue = row[columnMap.grade];
      assignment.grade = gradeValue ? parseInt(gradeValue) : null;
      if (assignment.grade && (assignment.grade < 1 || assignment.grade > 12)) {
        console.warn(`Row ${index + 2}: Invalid grade value ${assignment.grade}`);
      }

      assignment.subject = row[columnMap.subject] ? row[columnMap.subject].toString().trim() : null;

      assignment.slot_name = row[columnMap.slot_name] ? row[columnMap.slot_name].toString().trim() : null;

      assignment.rules = columnMap.rules !== -1 && row[columnMap.rules]
        ? row[columnMap.rules].toString().trim()
        : null;

      if (columnMap.days !== -1 && row[columnMap.days]) {
        const daysStr = row[columnMap.days].toString().trim();
        assignment.days = daysStr
          .split(/[,;|]/)
          .map(d => d.trim())
          .filter(d => d.length > 0);
      } else {
        assignment.days = [];
      }

      // Normalize time_range: remove spaces around "-" (e.g., "14:30 - 15:30" -> "14:30-15:30")
      if (columnMap.time_range !== -1 && row[columnMap.time_range]) {
        assignment.time_range = row[columnMap.time_range]
          .toString()
          .trim()
          .replace(/\s*-\s*/g, '-'); // Remove spaces around dash
      } else {
        assignment.time_range = null;
      }

      const durationValue = columnMap.duration !== -1 ? row[columnMap.duration] : null;
      assignment.duration = durationValue ? parseInt(durationValue) : null;

      // IMPORTANT: Always set status to 'Pending' for imported data
      // regardless of what's in the spreadsheet (Open, Upcoming, etc.)
      assignment.status = 'Pending';

      // Helper function to normalize teacher name for lookup
      const normalizeTeacherName = (name) => {
        if (!name) return '';
        return name.toString().toLowerCase().trim().replace(/\s+/g, ' ');
      };

      // Lookup Guru Juara by name -> ID from teachers_new table
      if (columnMap.guru_juara_name !== -1 && row[columnMap.guru_juara_name]) {
        const rawGuruName = row[columnMap.guru_juara_name].toString().trim();
        const normalizedGuruName = normalizeTeacherName(rawGuruName);
        assignment.guru_juara_id = teacherNameToId[normalizedGuruName] || null;
        if (!assignment.guru_juara_id && rawGuruName) {
          console.warn(`Row ${index + 2}: Guru Juara "${rawGuruName}" not found in teachers_new table`);
        }
      } else {
        assignment.guru_juara_id = null;
      }

      // Lookup Mentor by name -> ID from teachers_new table
      if (columnMap.mentor_name !== -1 && row[columnMap.mentor_name]) {
        const rawMentorName = row[columnMap.mentor_name].toString().trim();
        const normalizedMentorName = normalizeTeacherName(rawMentorName);
        assignment.mentor_id = teacherNameToId[normalizedMentorName] || null;
        if (!assignment.mentor_id && rawMentorName) {
          console.warn(`Row ${index + 2}: Mentor "${rawMentorName}" not found in teachers_new table`);
        }
      } else {
        assignment.mentor_id = null;
      }

      // Parse notes (text)
      assignment.notes = columnMap.notes !== -1 && row[columnMap.notes]
        ? row[columnMap.notes].toString().trim()
        : '';

      // Parse class_capacity (integer, default 20)
      const capacityValue = columnMap.class_capacity !== -1 ? row[columnMap.class_capacity] : null;
      assignment.class_capacity = capacityValue ? parseInt(capacityValue) : 20;

      // Parse curriculum (text)
      assignment.curriculum = columnMap.curriculum !== -1 && row[columnMap.curriculum]
        ? row[columnMap.curriculum].toString().trim()
        : null;

      // Parse dates
      const parseDateValue = (value) => {
        if (!value) return null;
        // Try to parse date - handle various formats
        const dateStr = value.toString().trim();
        if (!dateStr) return null;

        // Try ISO format first (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }

        // Try parsing as date and convert to YYYY-MM-DD
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }

        return null;
      };

      assignment.batch_start_date = columnMap.batch_start_date !== -1
        ? parseDateValue(row[columnMap.batch_start_date])
        : null;

      assignment.slot_start_date = columnMap.slot_start_date !== -1
        ? parseDateValue(row[columnMap.slot_start_date])
        : null;

      assignment.slot_end_date = columnMap.slot_end_date !== -1
        ? parseDateValue(row[columnMap.slot_end_date])
        : null;

      // Parse class_rule (text, default 'Mandatory')
      assignment.class_rule = columnMap.class_rule !== -1 && row[columnMap.class_rule]
        ? row[columnMap.class_rule].toString().trim()
        : 'Mandatory';

      return assignment;
    });

  return assignments;
};

/**
 * Validate parsed assignments before import
 * @param {Array} assignments - Parsed assignments to validate
 * @returns {Object} - { valid: boolean, errors: Array }
 */
export const validateAssignments = (assignments) => {
  const errors = [];

  assignments.forEach((assignment, index) => {
    const rowNum = index + 2; // +2 because index 0 is row 2 (after header)

    // Required fields
    if (!assignment.grade) {
      errors.push(`Row ${rowNum}: Missing grade`);
    }
    if (!assignment.subject) {
      errors.push(`Row ${rowNum}: Missing subject`);
    }
    if (!assignment.slot_name) {
      errors.push(`Row ${rowNum}: Missing slot name`);
    }

    // Validate grade range
    if (assignment.grade && (assignment.grade < 1 || assignment.grade > 12)) {
      errors.push(`Row ${rowNum}: Grade must be between 1 and 12`);
    }

    // Validate date constraints
    if (assignment.batch_start_date && assignment.slot_start_date) {
      if (new Date(assignment.slot_start_date) < new Date(assignment.batch_start_date)) {
        errors.push(`Row ${rowNum}: Slot start date must be after batch start date`);
      }
    }

    if (assignment.slot_start_date && assignment.slot_end_date) {
      if (new Date(assignment.slot_end_date) < new Date(assignment.slot_start_date)) {
        errors.push(`Row ${rowNum}: Slot end date must be after slot start date`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
