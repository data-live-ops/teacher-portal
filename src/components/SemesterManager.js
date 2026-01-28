import React, { useState, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, Check, Calendar, Copy, AlertCircle, Clock, Moon } from 'lucide-react';
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

  // Time Adjustment states
  const [timeAdjustments, setTimeAdjustments] = useState([]);
  const [showTimeAdjustmentForm, setShowTimeAdjustmentForm] = useState(false);
  const [editingTimeAdjustment, setEditingTimeAdjustment] = useState(null);
  const [timeAdjustmentFormData, setTimeAdjustmentFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    description: '',
    mappings: [{ original_time: '', adjusted_time: '' }]
  });

  useEffect(() => {
    if (isOpen) {
      loadSemesters();
      loadTimeAdjustments();
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

  // ==================== TIME ADJUSTMENT FUNCTIONS ====================

  const loadTimeAdjustments = async () => {
    try {
      const { data: adjustments, error } = await supabase
        .from('time_adjustments')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Load mappings for each adjustment
      const adjustmentsWithMappings = await Promise.all(
        (adjustments || []).map(async (adj) => {
          const { data: mappings } = await supabase
            .from('time_adjustment_mappings')
            .select('*')
            .eq('adjustment_id', adj.id);
          return { ...adj, mappings: mappings || [] };
        })
      );

      setTimeAdjustments(adjustmentsWithMappings);
    } catch (error) {
      console.error('Error loading time adjustments:', error);
    }
  };

  const handleTimeAdjustmentSubmit = async (e) => {
    e.preventDefault();

    if (!timeAdjustmentFormData.name || !timeAdjustmentFormData.start_date || !timeAdjustmentFormData.end_date) {
      alert('Please fill all required fields');
      return;
    }

    // Validate mappings
    const validMappings = timeAdjustmentFormData.mappings.filter(
      m => m.original_time.trim() && m.adjusted_time.trim()
    );

    if (validMappings.length === 0) {
      alert('Please add at least one time mapping');
      return;
    }

    try {
      setLoading(true);

      if (editingTimeAdjustment) {
        // Update existing
        const { error: updateError } = await supabase
          .from('time_adjustments')
          .update({
            name: timeAdjustmentFormData.name,
            start_date: timeAdjustmentFormData.start_date,
            end_date: timeAdjustmentFormData.end_date,
            description: timeAdjustmentFormData.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTimeAdjustment.id);

        if (updateError) throw updateError;

        // Delete old mappings and insert new ones
        await supabase
          .from('time_adjustment_mappings')
          .delete()
          .eq('adjustment_id', editingTimeAdjustment.id);

        const { error: mappingsError } = await supabase
          .from('time_adjustment_mappings')
          .insert(validMappings.map(m => ({
            adjustment_id: editingTimeAdjustment.id,
            original_time: m.original_time.trim(),
            adjusted_time: m.adjusted_time.trim()
          })));

        if (mappingsError) throw mappingsError;

        alert('Time adjustment updated successfully!');
      } else {
        // Create new
        const { data: newAdjustment, error: insertError } = await supabase
          .from('time_adjustments')
          .insert({
            name: timeAdjustmentFormData.name,
            start_date: timeAdjustmentFormData.start_date,
            end_date: timeAdjustmentFormData.end_date,
            description: timeAdjustmentFormData.description,
            is_active: true,
            created_by: currentUser?.email
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert mappings
        const { error: mappingsError } = await supabase
          .from('time_adjustment_mappings')
          .insert(validMappings.map(m => ({
            adjustment_id: newAdjustment.id,
            original_time: m.original_time.trim(),
            adjusted_time: m.adjusted_time.trim()
          })));

        if (mappingsError) throw mappingsError;

        alert('Time adjustment created successfully!');
      }

      resetTimeAdjustmentForm();
      loadTimeAdjustments();
    } catch (error) {
      console.error('Error saving time adjustment:', error);
      alert('Failed to save time adjustment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTimeAdjustmentActive = async (adjustment) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('time_adjustments')
        .update({ is_active: !adjustment.is_active })
        .eq('id', adjustment.id);

      if (error) throw error;
      loadTimeAdjustments();
    } catch (error) {
      console.error('Error toggling time adjustment:', error);
      alert('Failed to update: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTimeAdjustment = async (adjustment) => {
    if (!window.confirm(`Delete "${adjustment.name}"?\n\nThis will remove all time mappings for this period.`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('time_adjustments')
        .delete()
        .eq('id', adjustment.id);

      if (error) throw error;
      alert('Time adjustment deleted successfully!');
      loadTimeAdjustments();
    } catch (error) {
      console.error('Error deleting time adjustment:', error);
      alert('Failed to delete: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTimeAdjustment = (adjustment) => {
    setEditingTimeAdjustment(adjustment);
    setTimeAdjustmentFormData({
      name: adjustment.name,
      start_date: adjustment.start_date,
      end_date: adjustment.end_date,
      description: adjustment.description || '',
      mappings: adjustment.mappings.length > 0
        ? adjustment.mappings.map(m => ({ original_time: m.original_time, adjusted_time: m.adjusted_time }))
        : [{ original_time: '', adjusted_time: '' }]
    });
    setShowTimeAdjustmentForm(true);
  };

  const resetTimeAdjustmentForm = () => {
    setTimeAdjustmentFormData({
      name: '',
      start_date: '',
      end_date: '',
      description: '',
      mappings: [{ original_time: '', adjusted_time: '' }]
    });
    setEditingTimeAdjustment(null);
    setShowTimeAdjustmentForm(false);
  };

  const addTimeMapping = () => {
    setTimeAdjustmentFormData(prev => ({
      ...prev,
      mappings: [...prev.mappings, { original_time: '', adjusted_time: '' }]
    }));
  };

  const removeTimeMapping = (index) => {
    setTimeAdjustmentFormData(prev => ({
      ...prev,
      mappings: prev.mappings.filter((_, i) => i !== index)
    }));
  };

  const updateTimeMapping = (index, field, value) => {
    setTimeAdjustmentFormData(prev => ({
      ...prev,
      mappings: prev.mappings.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      )
    }));
  };

  // ==================== END TIME ADJUSTMENT FUNCTIONS ====================

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

          /* Time Adjustment Styles */
          .section-divider {
            margin: 40px 0 24px;
            border-top: 2px solid #e2e8f0;
            padding-top: 24px;
          }

          .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
          }

          .section-title {
            font-size: 20px;
            font-weight: 600;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
          }

          .section-title-icon {
            color: #8b5cf6;
          }

          .add-adjustment-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .add-adjustment-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }

          .time-adjustment-form {
            background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            border: 2px solid #c4b5fd;
          }

          .time-mappings-section {
            margin-top: 20px;
          }

          .time-mappings-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          }

          .time-mappings-label {
            font-weight: 500;
            color: #475569;
            font-size: 14px;
          }

          .add-mapping-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            background: #8b5cf6;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .add-mapping-btn:hover {
            background: #7c3aed;
          }

          .time-mapping-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
          }

          .time-mapping-row input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
          }

          .time-mapping-arrow {
            color: #8b5cf6;
            font-weight: bold;
          }

          .remove-mapping-btn {
            padding: 6px;
            background: #fee2e2;
            color: #dc2626;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .remove-mapping-btn:hover {
            background: #fecaca;
          }

          .time-adjustment-item {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 20px;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            margin-bottom: 12px;
            transition: all 0.2s;
          }

          .time-adjustment-item:hover {
            border-color: #c4b5fd;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }

          .time-adjustment-item.active {
            border-color: #8b5cf6;
            background: #faf5ff;
          }

          .time-adjustment-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .time-adjustment-info h4 {
            margin: 0 0 8px 0;
            font-size: 16px;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .time-adjustment-dates {
            font-size: 13px;
            color: #64748b;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .time-adjustment-actions {
            display: flex;
            gap: 8px;
          }

          .time-mappings-display {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .time-mapping-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #f1f5f9;
            border-radius: 20px;
            font-size: 12px;
            color: #475569;
          }

          .time-mapping-badge .arrow {
            color: #8b5cf6;
            font-weight: bold;
          }

          .status-badge-active {
            background: #dcfce7;
            color: #166534;
          }

          .status-badge-inactive {
            background: #f1f5f9;
            color: #64748b;
          }

          .action-btn-toggle {
            background: #f0fdf4;
            color: #166534;
          }

          .action-btn-toggle:hover {
            background: #dcfce7;
          }

          .action-btn-toggle.inactive {
            background: #f1f5f9;
            color: #64748b;
          }

          .action-btn-toggle.inactive:hover {
            background: #e2e8f0;
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

          {/* Time Adjustments Section */}
          <div className="section-divider">
            <div className="section-header">
              <h3 className="section-title">
                <Moon size={22} className="section-title-icon" />
                Time Adjustments (Ramadhan, etc.)
              </h3>
              {!showTimeAdjustmentForm && (
                <button
                  onClick={() => setShowTimeAdjustmentForm(true)}
                  className="add-adjustment-btn"
                >
                  <Plus size={16} />
                  Add Time Adjustment
                </button>
              )}
            </div>

            {showTimeAdjustmentForm && (
              <div className="time-adjustment-form">
                <h3 className="form-title">
                  {editingTimeAdjustment ? 'Edit Time Adjustment' : 'Create Time Adjustment'}
                </h3>
                <form onSubmit={handleTimeAdjustmentSubmit}>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Name <span className="required">*</span></label>
                      <input
                        type="text"
                        value={timeAdjustmentFormData.name}
                        onChange={(e) => setTimeAdjustmentFormData({ ...timeAdjustmentFormData, name: e.target.value })}
                        placeholder="e.g., Ramadhan 2026"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Start Date <span className="required">*</span></label>
                      <input
                        type="date"
                        value={timeAdjustmentFormData.start_date}
                        onChange={(e) => setTimeAdjustmentFormData({ ...timeAdjustmentFormData, start_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>End Date <span className="required">*</span></label>
                      <input
                        type="date"
                        value={timeAdjustmentFormData.end_date}
                        onChange={(e) => setTimeAdjustmentFormData({ ...timeAdjustmentFormData, end_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Description (Optional)</label>
                      <input
                        type="text"
                        value={timeAdjustmentFormData.description}
                        onChange={(e) => setTimeAdjustmentFormData({ ...timeAdjustmentFormData, description: e.target.value })}
                        placeholder="e.g., Penyesuaian waktu kelas selama bulan Ramadhan"
                      />
                    </div>
                  </div>

                  <div className="time-mappings-section">
                    <div className="time-mappings-header">
                      <span className="time-mappings-label">Time Mappings <span className="required">*</span></span>
                      <button type="button" onClick={addTimeMapping} className="add-mapping-btn">
                        <Plus size={14} />
                        Add Mapping
                      </button>
                    </div>

                    {timeAdjustmentFormData.mappings.map((mapping, index) => (
                      <div key={index} className="time-mapping-row">
                        <input
                          type="text"
                          value={mapping.original_time}
                          onChange={(e) => updateTimeMapping(index, 'original_time', e.target.value)}
                          placeholder="Original (e.g., 17:15-18:15)"
                        />
                        <span className="time-mapping-arrow">→</span>
                        <input
                          type="text"
                          value={mapping.adjusted_time}
                          onChange={(e) => updateTimeMapping(index, 'adjusted_time', e.target.value)}
                          placeholder="Adjusted (e.g., 16:15-17:15)"
                        />
                        {timeAdjustmentFormData.mappings.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTimeMapping(index)}
                            className="remove-mapping-btn"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="form-actions" style={{ marginTop: '20px' }}>
                    <button type="button" onClick={resetTimeAdjustmentForm} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      <Check size={16} />
                      {editingTimeAdjustment ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Time Adjustments List */}
            <div className="time-adjustments-list">
              {timeAdjustments.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 20px' }}>
                  <Clock size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                  <p style={{ margin: 0 }}>No time adjustments configured</p>
                </div>
              ) : (
                timeAdjustments.map(adjustment => (
                  <div key={adjustment.id} className={`time-adjustment-item ${adjustment.is_active ? 'active' : ''}`}>
                    <div className="time-adjustment-header">
                      <div className="time-adjustment-info">
                        <h4>
                          {adjustment.is_active && '🌙 '}
                          {adjustment.name}
                        </h4>
                        <div className="time-adjustment-dates">
                          <Calendar size={14} />
                          {new Date(adjustment.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' - '}
                          {new Date(adjustment.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {adjustment.description && ` • ${adjustment.description}`}
                        </div>
                      </div>
                      <div className="time-adjustment-actions">
                        <span className={`status-badge ${adjustment.is_active ? 'status-badge-active' : 'status-badge-inactive'}`}>
                          {adjustment.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => handleToggleTimeAdjustmentActive(adjustment)}
                          className={`action-btn action-btn-toggle ${!adjustment.is_active ? 'inactive' : ''}`}
                          disabled={loading}
                        >
                          {adjustment.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleEditTimeAdjustment(adjustment)}
                          className="action-btn action-btn-edit"
                          disabled={loading}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTimeAdjustment(adjustment)}
                          className="action-btn action-btn-delete"
                          disabled={loading}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="time-mappings-display">
                      {adjustment.mappings.map((m, idx) => (
                        <span key={idx} className="time-mapping-badge">
                          <Clock size={12} />
                          {m.original_time}
                          <span className="arrow">→</span>
                          {m.adjusted_time}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SemesterManager;
