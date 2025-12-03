import React, { useState } from 'react';
import { X, Download, AlertCircle, Loader } from 'lucide-react';
import '../styles/ImportAssignmentModal.css'; // Reuse the same styles

const ExportAssignmentModal = ({
  isOpen,
  onClose,
  onExport,
  isExporting,
  assignmentCount
}) => {
  // Get default Web App URL from environment
  const defaultWebAppUrl = process.env.REACT_APP_EXPORT_WEB_APP_URL || '';

  const [webAppUrl, setWebAppUrl] = useState(defaultWebAppUrl);
  const [sheetName, setSheetName] = useState('');
  const [clearExisting, setClearExisting] = useState(true);
  const [errors, setErrors] = useState([]);

  const handleExport = () => {
    const validationErrors = [];

    if (!webAppUrl.trim()) {
      validationErrors.push('Web App URL is required');
    }

    if (!sheetName.trim()) {
      validationErrors.push('Sheet Name is required');
    }

    // Validate URL format
    if (webAppUrl.trim() && !webAppUrl.includes('script.google.com') && !webAppUrl.includes('script.googleusercontent.com')) {
      validationErrors.push('Invalid Web App URL format');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Clear errors and trigger export
    setErrors([]);
    onExport(webAppUrl.trim(), sheetName.trim(), clearExisting);
  };

  const handleClose = () => {
    if (!isExporting) {
      setWebAppUrl(defaultWebAppUrl);
      setSheetName('');
      setClearExisting(true);
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
            <Download size={20} />
            Export Teacher Assignments to Google Spreadsheet
          </h3>
          <button
            onClick={handleClose}
            className="import-modal-close"
            disabled={isExporting}
          >
            <X size={20} />
          </button>
        </div>

        <div className="import-modal-body">
          {/* Instructions */}
          <div className="import-instructions">
            <AlertCircle size={16} />
            <div>
              <p><strong>Export Information:</strong></p>
              <ul>
                <li>This will export {assignmentCount} assignment(s) from the current semester</li>
                <li>Data will be formatted with proper column headers</li>
                <li>Teacher IDs will be converted to teacher names</li>
                <li>Default Web App URL is pre-configured (you can change it if needed)</li>
              </ul>
            </div>
          </div>

          {/* Form Fields */}
          <div className="import-form">
            <div className="form-group">
              <label htmlFor="webAppUrl">
                Google Apps Script Web App URL <span className="required-star">*</span>
              </label>
              <input
                id="webAppUrl"
                type="text"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                disabled={isExporting}
                className="import-input"
              />
              <small className="input-help">
                Default URL is pre-configured. You can change it if you want to export to a different spreadsheet.
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
                placeholder="e.g., Semester_1_2024_Assignments"
                disabled={isExporting}
                className="import-input"
              />
              <small className="input-help">
                The sheet will be created if it doesn't exist
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  disabled={isExporting}
                />
                <span>Clear existing data before export</span>
              </label>
              <small className="input-help">
                If checked, all existing data in the sheet will be cleared before exporting
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

          {/* Export Status */}
          {isExporting && (
            <div className="import-status">
              <Loader size={16} className="spinning" />
              <span>Exporting data... Please wait.</span>
            </div>
          )}
        </div>

        <div className="import-modal-footer">
          <button
            onClick={handleClose}
            className="import-button cancel"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="import-button primary"
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader size={16} className="spinning" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportAssignmentModal;
