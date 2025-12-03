import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { Plus, Edit2, Trash2, Save, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import '../styles/DataManagement.css';

const TeacherLevelingManagement = () => {
    const { canEdit } = usePermissions();
    const hasEditPermission = canEdit('data_management');
    const [levelings, setLevelings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        level: '',
        responsibility: '',
        teaching_minimum_hour: 0,
        teaching_maximum_hour: 0,
        mentoring_minimum_hour: 0,
        mentoring_maximum_hour: 0
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        loadLevelings();
    }, []);

    const loadLevelings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('teacher_leveling')
                .select('*')
                .order('level');

            if (error) throw error;
            setLevelings(data);
        } catch (error) {
            console.error('Error loading levelings:', error);
            alert('Failed to load teacher leveling data');
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.level.trim()) {
            newErrors.level = 'Level is required';
        }

        if (!formData.responsibility.trim()) {
            newErrors.responsibility = 'Responsibility is required';
        }

        if (formData.teaching_maximum_hour < formData.teaching_minimum_hour) {
            newErrors.teaching_maximum_hour = 'Maximum must be >= minimum';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleOpenModal = (leveling = null) => {
        if (leveling) {
            setEditingId(leveling.id);
            setFormData({
                level: leveling.level,
                responsibility: leveling.responsibility,
                teaching_minimum_hour: leveling.teaching_minimum_hour,
                teaching_maximum_hour: leveling.teaching_maximum_hour,
                mentoring_minimum_hour: leveling.mentoring_minimum_hour,
                mentoring_maximum_hour: leveling.mentoring_maximum_hour
            });
        } else {
            setEditingId(null);
            setFormData({
                level: '',
                responsibility: '',
                teaching_minimum_hour: 0,
                teaching_maximum_hour: 0,
                mentoring_minimum_hour: 0,
                mentoring_maximum_hour: 0
            });
        }
        setErrors({});
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData({
            level: '',
            responsibility: '',
            teaching_minimum_hour: 0,
            teaching_maximum_hour: 0,
            mentoring_minimum_hour: 0,
            mentoring_maximum_hour: 0
        });
        setErrors({});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from('teacher_leveling')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingId);

                if (error) throw error;
                alert('Teacher leveling updated successfully');
            } else {
                // Create new
                const { error } = await supabase
                    .from('teacher_leveling')
                    .insert([formData]);

                if (error) throw error;
                alert('Teacher leveling created successfully');
            }

            handleCloseModal();
            loadLevelings();
        } catch (error) {
            console.error('Error saving leveling:', error);
            alert(`Failed to save: ${error.message}`);
        }
    };

    const handleDelete = async (id, level) => {
        if (!window.confirm(`Are you sure you want to delete "${level}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('teacher_leveling')
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('Teacher leveling deleted successfully');
            loadLevelings();
        } catch (error) {
            console.error('Error deleting leveling:', error);
            alert(`Failed to delete: ${error.message}`);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    if (loading) {
        return (
            <div className="dm-loading-container">
                <div className="dm-loading-spinner"></div>
                <div className="dm-loading-text">Loading teacher leveling data...</div>
            </div>
        );
    }

    return (
        <div className="management-section">
            <div className="section-header">
                <h2>Teacher Leveling Definitions</h2>
                {hasEditPermission && (
                    <button className="dm-btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={18} />
                        Add New Leveling
                    </button>
                )}
            </div>

            <div className="table-wrapper">
                <table className="management-table">
                    <thead>
                        <tr>
                            <th>Level</th>
                            <th>Responsibility</th>
                            <th>Teaching Hours (Min-Max)</th>
                            <th>Mentoring Hours (Min-Max)</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {levelings.map(leveling => (
                            <tr key={leveling.id}>
                                <td className="font-semibold">{leveling.level}</td>
                                <td>{leveling.responsibility}</td>
                                <td>{leveling.teaching_minimum_hour} - {leveling.teaching_maximum_hour} hours</td>
                                <td>{leveling.mentoring_minimum_hour} - {leveling.mentoring_maximum_hour} hours</td>
                                <td>
                                    {hasEditPermission && (
                                        <div className="dm-action-buttons">
                                            <button
                                                className="dm-btn-icon dm-btn-edit"
                                                onClick={() => handleOpenModal(leveling)}
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="dm-btn-icon dm-btn-delete"
                                                onClick={() => handleDelete(leveling.id, leveling.level)}
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {levelings.length === 0 && (
                    <div className="empty-state">
                        <AlertCircle size={48} />
                        <p>No teacher leveling data found</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="data-mgmt-modal-overlay" onClick={handleCloseModal}>
                    <div className="data-mgmt-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="data-mgmt-modal-header">
                            <h3>{editingId ? 'Edit Teacher Leveling' : 'Add New Teacher Leveling'}</h3>
                            <button className="dm-btn-icon" onClick={handleCloseModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="dm-form-group full-width">
                                    <label>Level *</label>
                                    <input
                                        type="text"
                                        value={formData.level}
                                        onChange={(e) => handleInputChange('level', e.target.value)}
                                        placeholder="e.g., Guru Juara I"
                                        className={errors.level ? 'error' : ''}
                                    />
                                    {errors.level && <span className="error-message">{errors.level}</span>}
                                </div>

                                <div className="dm-form-group full-width">
                                    <label>Responsibility *</label>
                                    <input
                                        type="text"
                                        value={formData.responsibility}
                                        onChange={(e) => handleInputChange('responsibility', e.target.value)}
                                        placeholder="e.g., Guru Juara I"
                                        className={errors.responsibility ? 'error' : ''}
                                    />
                                    {errors.responsibility && <span className="error-message">{errors.responsibility}</span>}
                                </div>

                                <div className="dm-form-group">
                                    <label>Teaching Minimum Hour *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.teaching_minimum_hour}
                                        onChange={(e) => handleInputChange('teaching_minimum_hour', parseInt(e.target.value) || 0)}
                                    />
                                </div>

                                <div className="dm-form-group">
                                    <label>Teaching Maximum Hour *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.teaching_maximum_hour}
                                        onChange={(e) => handleInputChange('teaching_maximum_hour', parseInt(e.target.value) || 0)}
                                        className={errors.teaching_maximum_hour ? 'error' : ''}
                                    />
                                    {errors.teaching_maximum_hour && <span className="error-message">{errors.teaching_maximum_hour}</span>}
                                </div>

                                <div className="dm-form-group">
                                    <label>Mentoring Minimum Hour *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.mentoring_minimum_hour}
                                        onChange={(e) => handleInputChange('mentoring_minimum_hour', parseInt(e.target.value) || 0)}
                                    />
                                </div>

                                <div className="dm-form-group">
                                    <label>Mentoring Maximum Hour *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.mentoring_maximum_hour}
                                        onChange={(e) => handleInputChange('mentoring_maximum_hour', parseInt(e.target.value) || 0)}
                                        className={errors.mentoring_maximum_hour ? 'error' : ''}
                                    />
                                    {errors.mentoring_maximum_hour && <span className="error-message">{errors.mentoring_maximum_hour}</span>}
                                </div>
                            </div>

                            <div className="data-mgmt-modal-actions">
                                <button type="button" className="dm-btn-secondary" onClick={handleCloseModal}>
                                    <X size={18} />
                                    Cancel
                                </button>
                                <button type="submit" className="dm-btn-primary">
                                    <Save size={18} />
                                    {editingId ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherLevelingManagement;
