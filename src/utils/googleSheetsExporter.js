/**
 * Export teacher assignment data to Google Sheets
 */

/**
 * Format assignment data for spreadsheet export
 * @param {Array} assignments - Assignments to export
 * @param {Array} teachers - All teachers data
 * @returns {Array} - 2D array formatted for spreadsheet
 */
export const formatAssignmentsForExport = (assignments, teachers) => {
  // Create teacher ID to name mapping
  const teacherIdToName = {};
  teachers.forEach(teacher => {
    teacherIdToName[teacher.id] = teacher.name;
  });

  // Define column headers (must match import format)
  const headers = [
    'Grade',
    'Subject',
    'Slot Name',
    'Rules',
    'Days',
    'Time Range',
    'Duration',
    'Status',
    'Guru Juara Name',
    'Mentor Name',
    'Notes',
    'Class Capacity',
    'Curriculum',
    'Batch Start Date',
    'Slot Start Date',
    'Slot End Date',
    'Class Rule'
  ];

  // Format date to YYYY-MM-DD
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  // Convert assignments to rows
  const rows = assignments.map(assignment => {
    return [
      assignment.grade || '',
      assignment.subject || '',
      assignment.slot_name || '',
      assignment.rules || '',
      Array.isArray(assignment.days) ? assignment.days.join(', ') : '',
      assignment.time_range || '',
      assignment.duration || '',
      assignment.status || '',
      assignment.guru_juara_id ? (teacherIdToName[assignment.guru_juara_id] || assignment.guru_juara_name || '') : '',
      assignment.mentor_id ? (teacherIdToName[assignment.mentor_id] || assignment.mentor_name || '') : '',
      assignment.notes || '',
      assignment.class_capacity || 20,
      assignment.curriculum || '',
      formatDate(assignment.batch_start_date),
      formatDate(assignment.slot_start_date),
      formatDate(assignment.slot_end_date),
      assignment.class_rule || ''
    ];
  });

  // Return headers + rows
  return [headers, ...rows];
};

/**
 * Export data to Google Spreadsheet using Apps Script Web App
 * @param {String} webAppUrl - Google Apps Script Web App URL
 * @param {String} sheetName - Target sheet name
 * @param {Array} data - 2D array of data (including headers)
 * @param {Boolean} clearExisting - Whether to clear existing data first
 * @returns {Promise} - Result of the export operation
 */
export const exportToGoogleSheet = async (webAppUrl, sheetName, data, clearExisting = true) => {
  try {
    if (!webAppUrl) {
      throw new Error('Google Apps Script Web App URL is required');
    }

    if (!sheetName) {
      throw new Error('Sheet Name is required');
    }

    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Validate Web App URL format
    if (!webAppUrl.includes('script.google.com') && !webAppUrl.includes('script.googleusercontent.com')) {
      throw new Error('Invalid Web App URL. Please use the URL from Apps Script deployment.');
    }

    // Send data to Apps Script Web App
    const response = await fetch(webAppUrl, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requires no-cors
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'writeData',
        sheetName: sheetName,
        data: data,
        clearExisting: clearExisting
      })
    });

    // Note: With no-cors mode, we can't read the response
    // But we can assume success if no error was thrown
    return {
      success: true,
      message: 'Data sent to spreadsheet successfully'
    };
  } catch (error) {
    console.error('Error exporting to Google Sheet:', error);
    throw error;
  }
};

/**
 * Generate Google Apps Script code for the Web App
 * This function returns the script that users need to deploy in their spreadsheet
 * @returns {String} - Apps Script code
 */
export const getAppsScriptCode = () => {
  return `function doPost(e) {
  try {
    // Parse incoming JSON data
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var sheetName = requestData.sheetName;
    var data = requestData.data;
    var clearExisting = requestData.clearExisting;

    // Get active spreadsheet
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Get or create sheet
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    // Clear existing data if requested
    if (clearExisting) {
      sheet.clear();
    }

    // Write data to sheet
    if (data && data.length > 0) {
      var range = sheet.getRange(1, 1, data.length, data[0].length);
      range.setValues(data);

      // Format header row
      var headerRange = sheet.getRange(1, 1, 1, data[0].length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');

      // Auto-resize columns
      for (var i = 1; i <= data[0].length; i++) {
        sheet.autoResizeColumn(i);
      }
    }

    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      rowsWritten: data.length,
      message: 'Data written successfully'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
};
