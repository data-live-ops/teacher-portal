import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Check, Edit3, Trash2, Users, User } from 'lucide-react';
import DateInput from './DateInput';

const DaysSelector = ({ selectedDays, onChange, disabled = false }) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="days-selector">
      {days.map(day => (
        <button
          key={day}
          type="button"
          disabled={disabled}
          onClick={() => onChange(day)}
          className={`day-button ${selectedDays.includes(day) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
        >
          {day.slice(0, 3)}
        </button>
      ))}
    </div>
  );
};

const EditableCell = ({ value, onChange, type = 'text', options = [], placeholder = '', required = false }) => {
  if (type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`editable-select ${required && !value ? 'required' : ''}`}
      >
        <option value="">Select...</option>
        {options.map(option => (
          <option key={typeof option === 'string' ? option : option.value}
            value={typeof option === 'string' ? option : option.value}>
            {typeof option === 'string' ? option : option.label}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'number') {
    return (
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`editable-input ${required && !value ? 'required' : ''}`}
      />
    );
  }

  if (type === 'date') {
    return (
      <div className='date-input-container"'>
        <DateInput
          value={value}
          onChange={onChange}
          placeholder="Pilih Tanggal.."
          required={required}
        />
      </div>
    );
  }

  const handleChange = (e) => onChange(e.target.value);
  return (
    <input
      type="text"
      value={value || ''}
      onChange={handleChange}
      placeholder={placeholder}
      className={`editable-input ${required && !value ? 'required' : ''}`}
    />
  );
};

const AssignmentModal = ({
  isOpen,
  onClose,
  assignment,
  onSave,
  subjects,
  timeRanges,
  isEditing = false
}) => {
  const [formData, setFormData] = useState({
    grade: '',
    subject: '',
    slot_name: '',
    rules: '',
    days: [],
    time_range: '',
    status: '',
    notes: '',
    class_capacity: '',
    curriculum: '',
    batch_start_date: '',
    slot_start_date: '',
    slot_end_date: '',
    class_rule: ''
  });

  useEffect(() => {
    if (assignment) {
      setFormData({
        grade: assignment?.grade || '',
        subject: assignment?.subject || '',
        slot_name: assignment?.slot_name || '',
        rules: assignment?.rules || '',
        days: assignment?.days || [],
        time_range: assignment?.time_range || '',
        status: assignment?.status || '',
        notes: assignment?.notes || '',
        class_capacity: assignment?.class_capacity || '',
        curriculum: assignment?.curriculum || '',
        batch_start_date: assignment?.batch_start_date || '',
        slot_start_date: assignment?.slot_start_date || '',
        slot_end_date: assignment?.slot_end_date || '',
        class_rule: assignment?.class_rule || ''
      })
    } else {
      setFormData({
        grade: '',
        subject: '',
        slot_name: '',
        rules: '',
        days: [],
        time_range: '',
        status: '',
        notes: '',
        class_capacity: '',
        curriculum: '',
        batch_start_date: '',
        slot_start_date: '',
        slot_end_date: '',
        class_rule: ''
      })
    }
  }, [assignment]);

  const handleDayToggle = (day) => {
    const currentDays = formData.days || [];
    if (currentDays.includes(day)) {
      setFormData({
        ...formData,
        days: currentDays.filter(d => d !== day)
      });
    } else {
      setFormData({
        ...formData,
        days: [...currentDays, day]
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Assignment' : 'Add New Assignment'}</h3>
          <button onClick={onClose} className="modal-close-button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Grade *</label>
              <EditableCell
                type="number"
                value={formData.grade}
                onChange={(value) => setFormData({ ...formData, grade: value })}
                placeholder="Grade 4 - 12"
                required
              />
            </div>

            <div className="form-group">
              <label>Subject *</label>
              <EditableCell
                type="select"
                value={formData.subject}
                onChange={(value) => setFormData({ ...formData, subject: value })}
                options={subjects?.map(s => ({ value: s.name, label: s.name })) || []}
                required
              />
            </div>

            <div className="form-group">
              <label>Slot Name *</label>
              <EditableCell
                value={formData.slot_name}
                onChange={(value) => setFormData({ ...formData, slot_name: value })}
                placeholder="Slot name"
                required
              />
            </div>

            <div className="form-group">
              <label>Rules</label>
              <EditableCell
                type="select"
                value={formData.rules}
                onChange={(value) => setFormData({ ...formData, rules: value })}
                options={['Concept', 'Science', 'TKA', 'CoLearn+']}
              />
            </div>

            <div className="form-group full-width">
              <label>Days</label>
              <DaysSelector
                selectedDays={formData.days || []}
                onChange={handleDayToggle}
              />
            </div>

            <div className="form-group">
              <label>Time Range</label>
              <EditableCell
                type="select"
                value={formData.time_range}
                onChange={(value) => setFormData({ ...formData, time_range: value })}
                options={timeRanges || []}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <EditableCell
                type="select"
                value={formData.status}
                onChange={(value) => setFormData({ ...formData, status: value })}
                options={['Open', 'Pending', 'Upcoming']}
              />
            </div>

            <div className="form-group">
              <label>Capacity</label>
              <EditableCell
                type="number"
                value={formData.class_capacity}
                onChange={(value) => setFormData({ ...formData, class_capacity: value })}
                placeholder="Class capacity"
              />
            </div>

            <div className="form-group">
              <label>Curriculum</label>
              <EditableCell
                type="select"
                value={formData.curriculum}
                onChange={(value) => setFormData({ ...formData, curriculum: value })}
                options={['Kurikulum Merdeka', 'Kurikulum 2013']}
              />
            </div>

            <div className="form-group">
              <label>Batch Start Date</label>
              <EditableCell
                type="date"
                value={formData.batch_start_date}
                onChange={(value) => setFormData({ ...formData, batch_start_date: value })}
              />
            </div>

            <div className="form-group">
              <label>Slot Start Date</label>
              <EditableCell
                type="date"
                value={formData.slot_start_date}
                onChange={(value) => setFormData({ ...formData, slot_start_date: value })}
              />
            </div>

            <div className="form-group">
              <label>Slot End Date</label>
              <EditableCell
                type="date"
                value={formData.slot_end_date}
                onChange={(value) => setFormData({ ...formData, slot_end_date: value })}
              />
            </div>

            <div className="form-group">
              <label>Class Rule</label>
              <EditableCell
                type="select"
                value={formData.class_rule}
                onChange={(value) => setFormData({ ...formData, class_rule: value })}
                options={['Mandatory', 'Non Mandatory']}
              />
            </div>

            <div className="form-group full-width">
              <label>Notes</label>
              <EditableCell
                value={formData.notes}
                onChange={(value) => setFormData({ ...formData, notes: value })}
                placeholder="Additional notes"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button">
              {isEditing ? 'Update' : 'Save'} Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TeacherAssignmentTable = ({
  assignments = [],
  subjects = [],
  teachers = [],
  timeRanges = [],
  editingRow,
  setEditingRow,
  hoveredRowIndex,
  setHoveredRowIndex,
  isAddingRow,
  showAddRowId,
  handleShowAddRow,
  handleDeleteAssignment,
  handleUpdateAssignment,
  handleAddAssignment,
  handleCancelAdd,
  newAssignment,
  setNewAssignment,
  handleShowRecommendations,
  columnWidths = {},
  startResizing,
  filters,
  filteredAssignments = assignments
}) => {
  const tableRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const defaultColumnWidths = {
    actions: 120,
    grade: 80,
    subject: 150,
    slot_name: 150,
    rules: 120,
    days: 180,
    time: 150,
    status: 100,
    guru_juara: 150,
    mentor: 150,
    notes: 200,
    capacity: 100,
    curriculum: 150,
    batch_start_date: 120,
    slot_start_date: 120,
    slot_end_date: 120,
    class_rule: 120
  };

  const mergedColumnWidths = { ...defaultColumnWidths, ...columnWidths };

  const handleEditClick = (assignment, index) => {
    setEditingAssignment({ ...assignment });
    setIsEditMode(true);
    setModalOpen(true);
  };

  const handleAddClick = (afterAssignmentId = null) => {
    setEditingAssignment({
      grade: '',
      subject: '',
      slot_name: '',
      rules: '',
      days: [],
      time_range: '',
      status: '',
      notes: '',
      class_capacity: '',
      curriculum: '',
      batch_start_date: '',
      slot_start_date: '',
      slot_end_date: '',
      class_rule: '',
      afterAssignmentId
    });
    setIsEditMode(false);
    setModalOpen(true);
  };

  const handleModalSave = (formData) => {
    if (isEditMode && editingAssignment.id) {
      if (handleUpdateAssignment) {
        const { id, afterAssignmentId, ...updateData } =
          formData;
        handleUpdateAssignment(editingAssignment.id,
          updateData);
      }
    } else {
      if (handleAddAssignment) {
        handleAddAssignment(formData.afterAssignmentId, formData);
      }
    }
    setModalOpen(false);
    setEditingAssignment(null);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingAssignment(null);
    if (handleCancelAdd) {
      handleCancelAdd();
    }
  };

  return (
    <div className="table-container">
      <style jsx>{`
        .table-container {
          position: relative;
        }

        .table-scroll-container {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .assignment-row:hover {
          background: #f9fafb;
        }

        .actions-cell {
          position: relative;
        }

        .action-buttons {
          display: flex;
          gap: 4px;
        }

        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .edit-button {
          background: #dbeafe;
          color: #1e40af;
        }

        .edit-button:hover {
          background: #bfdbfe;
        }

        .delete-button {
          background: #fee2e2;
          color: #dc2626;
        }

        .delete-button:hover {
          background: #fecaca;
        }

        .cell-data {
          min-height: 20px;
        }

        .days-display {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .day-chip {
          background: #e0e7ff;
          color: #3730a3;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-open {
          background: #dcfce7;
          color: #166534;
        }

        .status-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-upcoming {
          background: #e0e7ff;
          color: #3730a3;
        }

        .teacher-assignment {
          min-height: 32px;
          display: flex;
          align-items: left;
        }

        .assigned-teacher {
          font-weight: 500;
          color: #374151;
        }

        .days-selector {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .day-button {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          color: #6b7280;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .day-button:hover:not(.disabled) {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .day-button.selected {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .day-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .editable-input, .editable-select {
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        .editable-input:focus, .editable-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .required {
          border-color: #ef4444;
        }

        .resize-handle {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          cursor: col-resize;
          background: #e9e9e9;
          transition: background-color 0.2s;
        }

        .resize-handle:hover {
          background: #3b82f6;
        }

        .modal-container {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          flex: 1;
        }

        .modal-close-button {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #6b7280;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .modal-close-button:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .modal-form {
          padding: 24px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          font-weight: 500;
          color: #374151;
          font-size: 14px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .cancel-button {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .cancel-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .save-button {
          padding: 8px 16px;
          border: none;
          background: #3b82f6;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .save-button:hover {
          background: #2563eb;
        }
      `}</style>

      <div className="table-scroll-container">
        <table className="assignment-table" ref={tableRef}>
          <thead>
            <tr>
              <th className="col-actions" style={{ width: `${mergedColumnWidths.actions}px` }}>
                Actions
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('actions', e)}></div>}
              </th>
              <th className="col-grade" style={{ width: `${mergedColumnWidths.grade}px` }}>
                Grade
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('grade', e)}></div>}
              </th>
              <th className="col-subject" style={{ width: `${mergedColumnWidths.subject}px` }}>
                Subject
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('subject', e)}></div>}
              </th>
              <th className="col-slot-name" style={{ width: `${mergedColumnWidths.slot_name}px` }}>
                Slot Name
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('slot_name', e)}></div>}
              </th>
              <th className="col-rules" style={{ width: `${mergedColumnWidths.rules}px` }}>
                Rules
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('rules', e)}></div>}
              </th>
              <th className="col-days" style={{ width: `${mergedColumnWidths.days}px` }}>
                Days
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('days', e)}></div>}
              </th>
              <th className="col-time" style={{ width: `${mergedColumnWidths.time}px` }}>
                Time
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('time', e)}></div>}
              </th>
              <th className="col-status" style={{ width: `${mergedColumnWidths.status}px` }}>
                Status
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('status', e)}></div>}
              </th>
              <th className="col-guru-juara" style={{ width: `${mergedColumnWidths.guru_juara}px` }}>
                Guru Juara
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('guru_juara', e)}></div>}
              </th>
              <th className="col-mentor" style={{ width: `${mergedColumnWidths.mentor}px` }}>
                Mentor
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('mentor', e)}></div>}
              </th>
              <th className="col-notes" style={{ width: `${mergedColumnWidths.notes}px` }}>
                Notes
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('notes', e)}></div>}
              </th>
              <th className="col-capacity" style={{ width: `${mergedColumnWidths.capacity}px` }}>
                Capacity
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('capacity', e)}></div>}
              </th>
              <th className="col-curriculum" style={{ width: `${mergedColumnWidths.curriculum}px` }}>
                Curriculum
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('curriculum', e)}></div>}
              </th>
              <th className="col-batch-start-date" style={{ width: `${mergedColumnWidths.batch_start_date}px` }}>
                Batch Start
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('batch_start_date', e)}></div>}
              </th>
              <th className="col-slot-start-date" style={{ width: `${mergedColumnWidths.slot_start_date}px` }}>
                Slot Start
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('slot_start_date', e)}></div>}
              </th>
              <th className="col-slot-end-date" style={{ width: `${mergedColumnWidths.slot_end_date}px` }}>
                Slot End
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('slot_end_date', e)}></div>}
              </th>
              <th className="col-class-rule" style={{ width: `${mergedColumnWidths.class_rule}px` }}>
                Class Rule
                {startResizing && <div className="resize-handle" onMouseDown={(e) => startResizing('class_rule', e)}></div>}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.map((assignment, index) => (
              <tr
                key={assignment.id}
                className="assignment-row"
                onMouseEnter={() => setHoveredRowIndex && setHoveredRowIndex(index)}
                onMouseLeave={() => setHoveredRowIndex && setHoveredRowIndex(null)}
              >
                <td className="actions-cell">
                  <div className="action-buttons">
                    <button
                      onClick={() => handleEditClick(assignment, index)}
                      className="action-button edit-button"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteAssignment && handleDeleteAssignment(assignment.id)}
                      className="action-button delete-button"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {hoveredRowIndex === index && (
                    <button
                      onClick={() => handleAddClick(assignment.id)}
                      className="floating-add-button"
                      title="Add new record after this row"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </td>

                <td><div className="cell-data">{assignment.grade}</div></td>
                <td><div className="cell-data">{assignment.subject}</div></td>
                <td><div className="cell-data">{assignment.slot_name}</div></td>
                <td><div className="cell-data">{assignment.rules}</div></td>

                <td>
                  <div className="days-display">
                    {assignment.days?.map(day => (
                      <span key={day} className="day-chip">
                        {day}
                      </span>
                    ))}
                  </div>
                </td>

                <td><div className="cell-data">{assignment.time_range}</div></td>

                <td>
                  <span className={`status-badge status-${assignment.status?.toLowerCase()}`}>
                    {assignment.status}
                  </span>
                </td>

                <td>
                  <div className="teacher-assignment">
                    {assignment.guru_juara_id ? (
                      <div className="teacher-info-cell">
                        <span className="assigned-teacher">
                          {teachers.find(t => t.id === assignment.guru_juara_id)?.name}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleShowRecommendations && handleShowRecommendations(index, 'guru_juara')}
                        className="recommendation-button guru-button"
                      >
                        <Users size={12} />
                        Assign Guru
                      </button>
                    )}
                  </div>
                </td>

                <td>
                  <div className="teacher-assignment">
                    {assignment.mentor_id ? (
                      <div className="teacher-info-cell">
                        <span className="assigned-teacher">
                          {teachers.find(t => t.id === assignment.mentor_id)?.name}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleShowRecommendations && handleShowRecommendations(index, 'mentor')}
                        className="recommendation-button mentor-button"
                      >
                        <User size={12} />
                        Assign Mentor
                      </button>
                    )}
                  </div>
                </td>

                <td><div className="cell-data">{assignment.notes || '-'}</div></td>
                <td><div className="cell-data">{assignment.class_capacity}</div></td>
                <td><div className="cell-data">{assignment.curriculum}</div></td>
                <td><div className="cell-data">{assignment.batch_start_date}</div></td>
                <td><div className="cell-data">{assignment.slot_start_date}</div></td>
                <td><div className="cell-data">{assignment.slot_end_date}</div></td>
                <td><div className="cell-data">{assignment.class_rule}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignmentModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        assignment={editingAssignment}
        onSave={handleModalSave}
        subjects={subjects}
        timeRanges={timeRanges}
        isEditing={isEditMode}
      />
    </div>
  );
};

export default TeacherAssignmentTable;