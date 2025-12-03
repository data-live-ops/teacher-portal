import React, { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import '../styles/ImportAssignmentModal.css';

const ImportAssignmentModal = ({
  isOpen,
  onClose,
  onImport,
  isImporting
}) => {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [errors, setErrors] = useState([]);

  const handleImport = () => {
    const validationErrors = [];

    if (!spreadsheetId.trim()) {
      validationErrors.push('Spreadsheet ID is required');
    }

    if (!sheetName.trim()) {
      validationErrors.push('Sheet Name is required');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Clear errors and trigger import
    setErrors([]);
    onImport(spreadsheetId.trim(), sheetName.trim());
  };

  const handleClose = () => {
    if (!isImporting) {
      setSpreadsheetId('');
      setSheetName('');
      setErrors([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-content">
        <div className="import-modal-header">
          <h3 className="import-modal-title">
            <Upload size={20} />
            Import Teacher Assignments from Google Spreadsheet
          </h3>
          <button
            onClick={handleClose}
            className="import-modal-close"
            disabled={isImporting}
          >
            <X size={20} />
          </button>
        </div>

        <div className="import-modal-body">
          {/* Instructions */}
          <div className="import-instructions">
            <AlertCircle size={16} />
            <div>
              <p><strong>Before importing:</strong></p>
              <ul>
                <li>All existing assignments for the current semester will be <strong>deleted</strong></li>
                <li>All imported data will have status set to <strong>"Pending"</strong> (regardless of spreadsheet value)</li>
                <li>Teacher names (Guru Juara & Mentor) must <strong>exactly match</strong> names in database</li>
                <li>Unmatched teacher names will be imported with empty assignment</li>
              </ul>
            </div>
          </div>

          {/* Expected Columns Info */}
          <div className="import-columns-info">
            <p><strong>Expected Columns:</strong></p>
            <div className="columns-list">
              <span className="column-badge required">Grade*</span>
              <span className="column-badge required">Subject*</span>
              <span className="column-badge required">Slot Name*</span>
              <span className="column-badge">Rules</span>
              <span className="column-badge">Days</span>
              <span className="column-badge">Time Range</span>
              <span className="column-badge">Duration</span>
              <span className="column-badge">Status</span>
              <span className="column-badge">Guru Juara Name</span>
              <span className="column-badge">Mentor Name</span>
              <span className="column-badge">Notes</span>
              <span className="column-badge">Class Capacity</span>
              <span className="column-badge">Curriculum</span>
              <span className="column-badge">Batch Start Date</span>
              <span className="column-badge">Slot Start Date</span>
              <span className="column-badge">Slot End Date</span>
              <span className="column-badge">Class Rule</span>
            </div>
            <p className="columns-note">* Required fields</p>
          </div>

          {/* Form Fields */}
          <div className="import-form">
            <div className="form-group">
              <label htmlFor="spreadsheetId">
                Google Spreadsheet ID <span className="required-star">*</span>
              </label>
              <input
                id="spreadsheetId"
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                disabled={isImporting}
                className="import-input"
              />
              <small className="input-help">
                Find this in your spreadsheet URL after /d/
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="sheetName">
                Sheet Name <span className="required-star">*</span>
              </label>
              <input
                id="sheetName"
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="e.g., Sheet1 or Assignments"
                disabled={isImporting}
                className="import-input"
              />
              <small className="input-help">
                The exact name of the sheet tab in your spreadsheet
              </small>
            </div>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="import-errors">
              <AlertCircle size={16} />
              <div>
                <p><strong>Please fix the following errors:</strong></p>
                <ul>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Import Status */}
          {isImporting && (
            <div className="import-status">
              <Loader size={16} className="spinning" />
              <span>Importing data... Please wait.</span>
            </div>
          )}
        </div>

        <div className="import-modal-footer">
          <button
            onClick={handleClose}
            className="import-button cancel"
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="import-button primary"
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <Loader size={16} className="spinning" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Import Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportAssignmentModal;
