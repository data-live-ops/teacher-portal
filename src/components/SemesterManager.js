import React, { useState, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, Check, Calendar, Copy, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';

const SemesterManager = ({ isOpen, onClose, onSemesterChange, currentUser }) => {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSemester, setEditingSemester] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '',
    semester_number: 1,
    start_date: '',
    end_date: '',
    clone_from: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadSemesters();
    }
  }, [isOpen]);

  const loadSemesters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('semesters')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setSemesters(data || []);
    } catch (error) {
      console.error('Error loading semesters:', error);
      alert('Failed to load semesters: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.academic_year || !formData.start_date || !formData.end_date) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);

      if (editingSemester) {
        const { error } = await supabase
          .from('semesters')
          .update({
            name: formData.name,
            academic_year: formData.academic_year,
            semester_number: formData.semester_number,
            start_date: formData.start_date,
            end_date: formData.end_date,
            updated_at: new Date().toISOString(),
            updated_by: currentUser?.email
          })
          .eq('id', editingSemester.id);

        if (error) throw error;
        alert('Semester updated successfully!');
      } else {
        const { data: newSemester, error } = await supabase
          .from('semesters')
          .insert({
            name: formData.name,
            academic_year: formData.academic_year,
            semester_number: formData.semester_number,
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: 'draft',
            is_active: false,
            created_by: currentUser?.email
          })
          .select()
          .single();

        if (error) throw error;

        // Clone assignments if selected
        if (formData.clone_from) {
          await cloneAssignments(formData.clone_from, newSemester.id);
        }

        alert('Semester created successfully!');
      }

      resetForm();
      loadSemesters();
      if (onSemesterChange) onSemesterChange();
    } catch (error) {
      console.error('Error saving semester:', error);
      alert('Failed to save semester: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const cloneAssignments = async (sourceSemesterId, targetSemesterId) => {
    try {
      // Get all assignments from source semester
      const { data: sourceAssignments, error: fetchError } = await supabase
        .from('teacher_assignment_slots')
        .select('*')
        .eq('semester_id', sourceSemesterId);

      if (fetchError) throw fetchError;

      if (!sourceAssignments || sourceAssignments.length === 0) {
        console.log('No assignments to clone');
        return;
      }

      // Clone assignments to new semester
      // Only include fields that are safe to copy
      // Status is set to 'Pending' for all cloned assignments
      const newAssignments = sourceAssignments.map(assignment => {
        return {
          grade: assignment.grade,
          subject: assignment.subject,
          slot_name: assignment.slot_name,
          rules: assignment.rules,
          days: assignment.days,
          time_range: assignment.time_range,
          duration: assignment.duration,
          status: 'Pending', // Always set to Pending for new semester
          guru_juara_id: assignment.guru_juara_id,
          mentor_id: assignment.mentor_id,
          notes: assignment.notes,
          class_capacity: assignment.class_capacity,
          curriculum: assignment.curriculum,
          batch_start_date: assignment.batch_start_date,
          slot_start_date: assignment.slot_start_date,
          slot_end_date: assignment.slot_end_date,
          class_rule: assignment.class_rule,
          semester_id: targetSemesterId,
          created_by: currentUser?.email,
          created_at: new Date().toISOString()
        };
      });

      // Insert assignments one by one to better handle errors
      let successCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const assignment of newAssignments) {
        const { error: insertError } = await supabase
          .from('teacher_assignment_slots')
          .insert([assignment]);

        if (insertError) {
          console.error('Error cloning assignment:', insertError, assignment);
          failedCount++;
          errors.push({
            assignment: `${assignment.grade} - ${assignment.slot_name}`,
            error: insertError.message
          });
        } else {
          successCount++;
        }
      }

      if (failedCount > 0) {
        console.error('Clone summary:', { successCount, failedCount, errors });
        alert(
          `Cloning completed with issues:\n` +
          `✓ ${successCount} assignments cloned successfully\n` +
          `✗ ${failedCount} assignments failed\n\n` +
          `First error: ${errors[0]?.error || 'Unknown error'}\n\n` +
          `Check console for details.`
        );
      } else {
        console.log(`Successfully cloned ${successCount} assignments to new semester`);
      }
    } catch (error) {
      console.error('Error cloning assignments:', error);
      alert('Warning: Semester created but failed to clone assignments: ' + error.message);
    }
  };

  const handleSetActive = async (semester) => {
    // Find currently active semester
    const currentlyActive = semesters.find(s => s.is_active);

    // Build confirmation message
    let confirmMessage = `Set "${semester.name}" as active semester?\n\n`;

    if (currentlyActive) {
      confirmMessage += `⚠️ WARNING: This will deactivate the currently active semester:\n`;
      confirmMessage += `   "${currentlyActive.name}"\n\n`;
      confirmMessage += `All new data from Ajar will be assigned to "${semester.name}".\n\n`;
      confirmMessage += `Do you want to proceed?`;
    } else {
      confirmMessage += `All new data from Ajar will be assigned to this semester.\n\n`;
      confirmMessage += `Do you want to proceed?`;
    }

    if (!window.confirm(confirmMessage)) return;

    try {
      setLoading(true);

      // Deactivate ALL other semesters first
      const { error: deactivateError } = await supabase
        .from('semesters')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

      if (deactivateError) throw deactivateError;

      // Activate the selected semester
      const { error: activateError } = await supabase
        .from('semesters')
        .update({
          is_active: true,
          status: 'active',
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.email
        })
        .eq('id', semester.id);

      if (activateError) throw activateError;

      // Verify only one semester is active
      const { data: activeSemesters, error: verifyError } = await supabase
        .from('semesters')
        .select('id, name')
        .eq('is_active', true);

      if (verifyError) {
        console.error('Error verifying active semesters:', verifyError);
      } else if (activeSemesters && activeSemesters.length > 1) {
        // This should never happen, but if it does, alert the user
        console.error('CRITICAL: Multiple active semesters detected:', activeSemesters);
        alert('⚠️ WARNING: System detected multiple active semesters. Please contact administrator.');
        loadSemesters();
        return;
      }

      // Update semester_id in class_schedules and re-sync with active semester assignments
      console.log('Updating class_schedules to use new active semester...');
      const { error: syncError } = await supabase.rpc('sync_all_raw_sessions_to_class_schedules');

      if (syncError) {
        console.error('Error syncing class_schedules:', syncError);
        alert(`⚠️ Semester activated, but failed to sync schedules: ${syncError.message}\n\nPlease resync manually.`);
      } else {
        console.log('Successfully synced class_schedules with new semester');
      }

      alert(`✅ Semester "${semester.name}" is now active!\n\nAll class schedules have been updated to this semester.`);
      loadSemesters();
      if (onSemesterChange) onSemesterChange();
    } catch (error) {
      console.error('Error activating semester:', error);
      alert('❌ Failed to activate semester: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (semester) => {
    const assignmentCount = await getAssignmentCount(semester.id);

    const confirmMsg = assignmentCount > 0
      ? `Delete "${semester.name}"?\n\nThis will also DELETE ${assignmentCount} assignments!\n\nThis action cannot be undone.`
      : `Delete "${semester.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('semesters')
        .delete()
        .eq('id', semester.id);

      if (error) throw error;

      alert('Semester deleted successfully!');
      loadSemesters();
      if (onSemesterChange) onSemesterChange();
    } catch (error) {
      console.error('Error deleting semester:', error);
      alert('Failed to delete semester: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getAssignmentCount = async (semesterId) => {
    const { count, error } = await supabase
      .from('teacher_assignment_slots')
      .select('*', { count: 'exact', head: true })
      .eq('semester_id', semesterId);

    return error ? 0 : count || 0;
  };

  const handleEdit = (semester) => {
    setEditingSemester(semester);
    setFormData({
      name: semester.name,
      academic_year: semester.academic_year,
      semester_number: semester.semester_number,
      start_date: semester.start_date,
      end_date: semester.end_date,
      clone_from: ''
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      academic_year: '',
      semester_number: 1,
      start_date: '',
      end_date: '',
      clone_from: ''
    });
    setEditingSemester(null);
    setShowAddForm(false);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active': return 'status-active';
      case 'completed': return 'status-completed';
      case 'draft': return 'status-draft';
      case 'archived': return 'status-archived';
      default: return 'status-draft';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="semester-modal-container">
        <style jsx>{`
          .semester-modal-container {
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 1000px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          }

          .semester-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px;
            border-bottom: 2px solid #e5e7eb;
            background: linear-gradient(to right, #3b82f6, #2563eb);
            color: white;
            border-radius: 12px 12px 0 0;
          }

          .semester-modal-header h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .close-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            color: white;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: rgba(255, 255, 255, 0.3);
          }

          .semester-modal-content {
            padding: 24px;
          }

          .add-semester-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            margin-bottom: 20px;
          }

          .add-semester-btn:hover {
            background: #2563eb;
            transform: translateY(-1px);
          }

          .semester-form {
            background: #f8fafc;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            border: 2px solid #e2e8f0;
          }

          .form-title {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 20px;
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
            color: #475569;
            font-size: 14px;
          }

          .form-group input,
          .form-group select {
            padding: 10px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
            transition: all 0.2s;
          }

          .form-group input:focus,
          .form-group select:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .form-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }

          .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .btn-primary {
            background: #3b82f6;
            color: white;
          }

          .btn-primary:hover {
            background: #2563eb;
          }

          .btn-secondary {
            background: #e2e8f0;
            color: #475569;
          }

          .btn-secondary:hover {
            background: #cbd5e1;
          }

          .semesters-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .semester-item {
            display: grid;
            grid-template-columns: 1fr auto auto auto auto;
            gap: 16px;
            align-items: center;
            padding: 20px;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            transition: all 0.2s;
          }

          .semester-item:hover {
            border-color: #cbd5e1;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }

          .semester-item.active {
            border-color: #3b82f6;
            background: #eff6ff;
          }

          .semester-info h3 {
            margin: 0 0 8px 0;
            font-size: 18px;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .semester-details {
            display: flex;
            gap: 16px;
            font-size: 13px;
            color: #64748b;
          }

          .detail-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }

          .status-active {
            background: #dcfce7;
            color: #166534;
          }

          .status-completed {
            background: #dbeafe;
            color: #1e40af;
          }

          .status-draft {
            background: #fef3c7;
            color: #92400e;
          }

          .status-archived {
            background: #f1f5f9;
            color: #475569;
          }

          .action-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
          }

          .action-btn-active {
            background: #dcfce7;
            color: #166534;
          }

          .action-btn-active:hover {
            background: #bbf7d0;
          }

          .action-btn-edit {
            background: #dbeafe;
            color: #1e40af;
          }

          .action-btn-edit:hover {
            background: #bfdbfe;
          }

          .action-btn-delete {
            background: #fee2e2;
            color: #dc2626;
          }

          .action-btn-delete:hover {
            background: #fecaca;
          }

          .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            z-index: 10;
          }

          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #64748b;
          }

          .empty-state-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 16px;
            color: #cbd5e1;
          }

          .required {
            color: #dc2626;
          }
        `}</style>

        <div className="semester-modal-header">
          <h2>
            <Calendar size={28} />
            Semester Management
          </h2>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="semester-modal-content" style={{ position: 'relative' }}>
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}

          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="add-semester-btn">
              <Plus size={20} />
              Add New Semester
            </button>
          )}

          {showAddForm && (
            <div className="semester-form">
              <h3 className="form-title">
                {editingSemester ? 'Edit Semester' : 'Create New Semester'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Semester Name <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Semester 1 2025/2026"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Academic Year <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.academic_year}
                      onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                      placeholder="e.g., 2025/2026"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Semester Number <span className="required">*</span></label>
                    <select
                      value={formData.semester_number}
                      onChange={(e) => setFormData({ ...formData, semester_number: parseInt(e.target.value) })}
                      required
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Start Date <span className="required">*</span></label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>End Date <span className="required">*</span></label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>

                  {!editingSemester && semesters.length > 0 && (
                    <div className="form-group full-width">
                      <label>Clone Assignments From (Optional)</label>
                      <select
                        value={formData.clone_from}
                        onChange={(e) => setFormData({ ...formData, clone_from: e.target.value })}
                      >
                        <option value="">Start with empty assignments</option>
                        {semesters.map(sem => (
                          <option key={sem.id} value={sem.id}>{sem.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    <Check size={16} />
                    {editingSemester ? 'Update Semester' : 'Create Semester'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="semesters-list">
            {semesters.length === 0 ? (
              <div className="empty-state">
                <AlertCircle className="empty-state-icon" size={80} />
                <h3>No Semesters Yet</h3>
                <p>Create your first semester to get started</p>
              </div>
            ) : (
              semesters.map(semester => (
                <div key={semester.id} className={`semester-item ${semester.is_active ? 'active' : ''}`}>
                  <div className="semester-info">
                    <h3>
                      {semester.name}
                      {semester.is_active && ' ⭐'}
                    </h3>
                    <div className="semester-details">
                      <span className="detail-item">
                        <Calendar size={14} />
                        {new Date(semester.start_date).toLocaleDateString()} - {new Date(semester.end_date).toLocaleDateString()}
                      </span>
                      <span className="detail-item">
                        {semester.academic_year} | Semester {semester.semester_number}
                      </span>
                    </div>
                  </div>

                  <span className={`status-badge ${getStatusBadgeClass(semester.is_active ? 'active' : 'draft')}`}>
                    {semester.is_active ? 'active' : 'draft'}
                  </span>

                  <button
                    onClick={() => handleSetActive(semester)}
                    className="action-btn action-btn-active"
                    disabled={semester.is_active || loading}
                  >
                    <Check size={16} />
                    {semester.is_active ? 'Active' : 'Set Active'}
                  </button>

                  <button
                    onClick={() => handleEdit(semester)}
                    className="action-btn action-btn-edit"
                    disabled={loading}
                  >
                    <Edit3 size={16} />
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(semester)}
                    className="action-btn action-btn-delete"
                    disabled={semester.is_active || loading}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SemesterManager;
