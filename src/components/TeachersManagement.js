import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './Navbar';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import '../styles/DataManagement.css';

const TeachersManagement = () => {
    const { canEdit } = usePermissions();
    const hasEditPermission = canEdit('data_management');
    const [teachers, setTeachers] = useState([]);
    const [levelings, setLevelings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [teacherSubjects, setTeacherSubjects] = useState({});

    const [formData, setFormData] = useState({
        name: '',
        teacher_leveling_id: '',
        is_active: true,
        subjects: []  // Array of {subject, level, grade, is_active}
    });
    const [errors, setErrors] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    // Filtered teachers based on search query
    const filteredTeachers = useMemo(() => {
        if (!searchQuery.trim()) return teachers;
        const query = searchQuery.toLowerCase().trim();
        return teachers.filter(teacher =>
            teacher.name.toLowerCase().includes(query)
        );
    }, [teachers, searchQuery]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load teachers
            const { data: teachersData, error: teachersError } = await supabase
                .from('teachers_new')
                .select(`
                    *,
                    teacher_leveling:teacher_leveling_id(
                        id,
                        level,
                        responsibility
                    )
                `)
                .order('name');

            if (teachersError) throw teachersError;

            // Load levelings for dropdown
            const { data: levelingsData, error: levelingsError } = await supabase
                .from('teacher_leveling')
                .select('*')
                .order('level');

            if (levelingsError) throw levelingsError;

            // Load all teacher subjects
            const { data: subjectsData, error: subjectsError } = await supabase
                .from('teacher_subjects')
                .select('*')
                .order('subject, grade');

            if (subjectsError) throw subjectsError;

            // Group subjects by teacher_id
            const subjectsByTeacher = {};
            subjectsData?.forEach(subject => {
                if (!subjectsByTeacher[subject.teacher_id]) {
                    subjectsByTeacher[subject.teacher_id] = [];
                }
                subjectsByTeacher[subject.teacher_id].push(subject);
            });

            setTeachers(teachersData);
            setLevelings(levelingsData);
            setTeacherSubjects(subjectsByTeacher);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        if (!formData.teacher_leveling_id) {
            newErrors.teacher_leveling_id = 'Leveling is required';
        }

        // Check if it's a Mentor level
        const selectedLeveling = levelings.find(l => l.id === formData.teacher_leveling_id);
        const isMentor = selectedLeveling?.level.toLowerCase().includes('mentor');

        // Validate subjects only for non-Mentor levels
        if (!isMentor) {
            formData.subjects.forEach((subject, index) => {
                if (!subject.subject?.trim()) {
                    newErrors[`subject_${index}`] = 'Subject is required';
                }
                if (!subject.level?.trim()) {
                    newErrors[`level_${index}`] = 'Level is required';
                }
                if (!subject.grade || subject.grade < 1 || subject.grade > 12) {
                    newErrors[`grade_${index}`] = 'Valid grade (1-12) is required';
                }
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleOpenModal = async (teacher = null) => {
        if (teacher) {
            setEditingId(teacher.id);

            // Load teacher subjects
            const subjects = teacherSubjects[teacher.id] || [];

            setFormData({
                name: teacher.name,
                teacher_leveling_id: teacher.teacher_leveling_id,
                is_active: teacher.is_active,
                subjects: subjects.map(s => ({
                    id: s.id,
                    subject: s.subject,
                    level: s.level,
                    grade: s.grade,
                    is_active: s.is_active
                }))
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                teacher_leveling_id: '',
                is_active: true,
                subjects: []
            });
        }
        setErrors({});
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData({
            name: '',
            teacher_leveling_id: '',
            is_active: true,
            subjects: []
        });
        setErrors({});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            // Get leveling info
            const leveling = levelings.find(l => l.id === formData.teacher_leveling_id);
            const isMentor = leveling.level.toLowerCase().includes('mentor');

            if (editingId) {
                // Update teacher
                const { error: teacherError } = await supabase
                    .from('teachers_new')
                    .update({
                        name: formData.name,
                        teacher_leveling_id: formData.teacher_leveling_id,
                        teacher_leveling: leveling.level,
                        teacher_responsibility: leveling.responsibility,
                        is_active: formData.is_active,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingId);

                if (teacherError) throw teacherError;

                // Delete old subjects
                await supabase
                    .from('teacher_subjects')
                    .delete()
                    .eq('teacher_id', editingId);

                // For Mentor level: auto-create "All Grade & All Subject"
                if (isMentor) {
                    const { error: subjectsError } = await supabase
                        .from('teacher_subjects')
                        .insert([{
                            teacher_id: editingId,
                            subject: 'All Subject',
                            level: 'All',
                            grade: 0,  // 0 represents "All Grade" for Mentors
                            is_active: true
                        }]);

                    if (subjectsError) throw subjectsError;
                } else {
                    // Insert updated subjects for non-Mentor
                    if (formData.subjects.length > 0) {
                        const subjectsToInsert = formData.subjects.map(s => ({
                            teacher_id: editingId,
                            subject: s.subject,
                            level: s.level,
                            grade: s.grade,
                            is_active: s.is_active
                        }));

                        const { error: subjectsError } = await supabase
                            .from('teacher_subjects')
                            .insert(subjectsToInsert);

                        if (subjectsError) throw subjectsError;
                    }
                }

                alert('Teacher updated successfully');
            } else {
                // Create new teacher
                const { data: newTeacher, error: teacherError } = await supabase
                    .from('teachers_new')
                    .insert([{
                        name: formData.name,
                        teacher_leveling_id: formData.teacher_leveling_id,
                        teacher_leveling: leveling.level,
                        teacher_responsibility: leveling.responsibility,
                        is_active: formData.is_active
                    }])
                    .select()
                    .single();

                if (teacherError) throw teacherError;

                // For Mentor level: auto-create "All Grade & All Subject"
                if (isMentor) {
                    const { error: subjectsError } = await supabase
                        .from('teacher_subjects')
                        .insert([{
                            teacher_id: newTeacher.id,
                            subject: 'All Subject',
                            level: 'All',
                            grade: 0,  // 0 represents "All Grade" for Mentors
                            is_active: true
                        }]);

                    if (subjectsError) throw subjectsError;
                } else {
                    // Insert subjects for non-Mentor
                    if (formData.subjects.length > 0) {
                        const subjectsToInsert = formData.subjects.map(s => ({
                            teacher_id: newTeacher.id,
                            subject: s.subject,
                            level: s.level,
                            grade: s.grade,
                            is_active: s.is_active
                        }));

                        const { error: subjectsError } = await supabase
                            .from('teacher_subjects')
                            .insert(subjectsToInsert);

                        if (subjectsError) throw subjectsError;
                    }
                }

                alert('Teacher created successfully');
            }

            handleCloseModal();
            loadData();
        } catch (error) {
            console.error('Error saving teacher:', error);
            alert(`Failed to save: ${error.message}`);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete teacher "${name}"? This will also delete all their subject capabilities.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('teachers_new')
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('Teacher deleted successfully');
            loadData();
        } catch (error) {
            console.error('Error deleting teacher:', error);
            alert(`Failed to delete: ${error.message}`);
        }
    };

    const addSubject = () => {
        setFormData(prev => ({
            ...prev,
            subjects: [...prev.subjects, { subject: '', level: '', grade: 1, is_active: true }]
        }));
    };

    const removeSubject = (index) => {
        setFormData(prev => ({
            ...prev,
            subjects: prev.subjects.filter((_, i) => i !== index)
        }));
    };

    const updateSubject = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            subjects: prev.subjects.map((s, i) =>
                i === index ? { ...s, [field]: value } : s
            )
        }));
    };

    if (loading) {
        return (
            <div className="dm-loading-container">
                <div className="dm-loading-spinner"></div>
                <div className="dm-loading-text">Loading teachers data...</div>
            </div>
        );
    }

    return (
        <div className="management-section">
            <div className="section-header">
                <h2>Teachers Management</h2>
                <div className="section-header-actions">
                    <div className="dm-search-container">
                        <Search size={18} className="dm-search-icon" />
                        <input
                            type="text"
                            className="dm-search-input"
                            placeholder="Search teacher name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="dm-search-clear"
                                onClick={() => setSearchQuery('')}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {hasEditPermission && (
                        <button className="dm-btn-primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} />
                            Add New Teacher
                        </button>
                    )}
                </div>
            </div>

            <div className="table-wrapper">
                <table className="management-table teachers-table">
                    <thead>
                        <tr>
                            <th>Teacher Name</th>
                            <th>Responsibility</th>
                            <th>Status</th>
                            <th>Subjects</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTeachers.map(teacher => {
                            const subjects = teacherSubjects[teacher.id] || [];

                            return (
                                <tr key={teacher.id}>
                                    <td className="font-semibold">{teacher.name}</td>
                                    <td>{teacher.teacher_leveling?.responsibility}</td>
                                    <td>
                                        <span className={`dm-status-badge ${teacher.is_active ? 'active' : 'inactive'}`}>
                                            {teacher.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        {subjects.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {subjects.map((subject, idx) => {
                                                    // Display "All Grade" for grade = 0 (Mentors)
                                                    const gradeDisplay = subject.grade === 0 ? 'All Grade' : subject.grade;
                                                    return (
                                                        <span
                                                            key={idx}
                                                            style={{
                                                                padding: '4px 10px',
                                                                background: '#f0f4ff',
                                                                border: '1px solid #d1d5db',
                                                                borderRadius: '12px',
                                                                fontSize: '0.8rem',
                                                                color: '#4c51bf',
                                                                fontWeight: '500'
                                                            }}
                                                        >
                                                            {gradeDisplay} - {subject.subject}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#999', fontStyle: 'italic' }}>No subjects</span>
                                        )}
                                    </td>
                                    <td>
                                        {hasEditPermission && (
                                            <div className="dm-action-buttons">
                                                <button
                                                    className="dm-btn-icon dm-btn-edit"
                                                    onClick={() => handleOpenModal(teacher)}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="dm-btn-icon dm-btn-delete"
                                                    onClick={() => handleDelete(teacher.id, teacher.name)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredTeachers.length === 0 && (
                    <div className="empty-state">
                        <AlertCircle size={48} />
                        <p>
                            {searchQuery
                                ? `No teachers found for "${searchQuery}"`
                                : 'No teachers found'
                            }
                        </p>
                        {searchQuery && (
                            <button
                                className="dm-btn-secondary"
                                onClick={() => setSearchQuery('')}
                                style={{ marginTop: '1rem' }}
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="data-mgmt-modal-overlay" onClick={handleCloseModal}>
                    <div className="data-mgmt-modal-content data-mgmt-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="data-mgmt-modal-header">
                            <h3>{editingId ? 'Edit Teacher' : 'Add New Teacher'}</h3>
                            <button className="dm-btn-icon" onClick={handleCloseModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Basic Info */}
                            <div className="form-section">
                                <h4>Basic Information</h4>
                                <div className="form-grid">
                                    <div className="dm-form-group full-width">
                                        <label>Teacher Name *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g., Pranitha Septiana Budi"
                                            className={errors.name ? 'error' : ''}
                                        />
                                        {errors.name && <span className="error-message">{errors.name}</span>}
                                    </div>

                                    <div className="dm-form-group">
                                        <label>Teacher Leveling *</label>
                                        <select
                                            value={formData.teacher_leveling_id}
                                            onChange={(e) => setFormData(prev => ({ ...prev, teacher_leveling_id: e.target.value }))}
                                            className={errors.teacher_leveling_id ? 'error' : ''}
                                        >
                                            <option value="">Select Leveling</option>
                                            {levelings.map(leveling => (
                                                <option key={leveling.id} value={leveling.id}>
                                                    {leveling.level} - {leveling.responsibility}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.teacher_leveling_id && <span className="error-message">{errors.teacher_leveling_id}</span>}
                                    </div>

                                    <div className="dm-form-group">
                                        <label>Status</label>
                                        <select
                                            value={formData.is_active}
                                            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                                        >
                                            <option value="true">Active</option>
                                            <option value="false">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Subject Capabilities - Only show for non-Mentor levels */}
                            {(() => {
                                const selectedLeveling = levelings.find(l => l.id === formData.teacher_leveling_id);
                                const isMentor = selectedLeveling?.level.toLowerCase().includes('mentor');

                                if (isMentor) {
                                    return (
                                        <div className="form-section">
                                            <h4>Subject Capabilities</h4>
                                            <p className="text-muted" style={{
                                                padding: '15px',
                                                background: '#f0f4ff',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                color: '#4c51bf',
                                                fontWeight: '500'
                                            }}>
                                                ℹ️ Mentor level teachers automatically have access to <strong>All Grades</strong> and <strong>All Subjects</strong>.
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="form-section">
                                        <div className="section-header-inline">
                                            <h4>Subject Capabilities</h4>
                                            <button type="button" className="dm-btn-secondary dm-btn-sm" onClick={addSubject}>
                                                <Plus size={16} />
                                                Add Subject
                                            </button>
                                        </div>

                                        {formData.subjects.length === 0 && (
                                            <p className="text-muted">No subjects added yet. Click "Add Subject" to add teaching capabilities.</p>
                                        )}

                                {formData.subjects.map((subject, index) => (
                                    <div key={index} className="subject-form-row">
                                        <div className="form-grid">
                                            <div className="dm-form-group">
                                                <label>Subject *</label>
                                                <input
                                                    type="text"
                                                    value={subject.subject}
                                                    onChange={(e) => updateSubject(index, 'subject', e.target.value)}
                                                    placeholder="e.g., Math SMP"
                                                    className={errors[`subject_${index}`] ? 'error' : ''}
                                                />
                                                {errors[`subject_${index}`] && <span className="error-message">{errors[`subject_${index}`]}</span>}
                                            </div>

                                            <div className="dm-form-group">
                                                <label>Level *</label>
                                                <select
                                                    value={subject.level}
                                                    onChange={(e) => updateSubject(index, 'level', e.target.value)}
                                                    className={errors[`level_${index}`] ? 'error' : ''}
                                                >
                                                    <option value="">Select</option>
                                                    <option value="SD">SD</option>
                                                    <option value="SMP">SMP</option>
                                                    <option value="SMA">SMA</option>
                                                </select>
                                                {errors[`level_${index}`] && <span className="error-message">{errors[`level_${index}`]}</span>}
                                            </div>

                                            <div className="dm-form-group">
                                                <label>Grade *</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="12"
                                                    value={subject.grade}
                                                    onChange={(e) => updateSubject(index, 'grade', parseInt(e.target.value) || 1)}
                                                    className={errors[`grade_${index}`] ? 'error' : ''}
                                                />
                                                {errors[`grade_${index}`] && <span className="error-message">{errors[`grade_${index}`]}</span>}
                                            </div>

                                            <div className="dm-form-group">
                                                <label>Status</label>
                                                <select
                                                    value={subject.is_active}
                                                    onChange={(e) => updateSubject(index, 'is_active', e.target.value === 'true')}
                                                >
                                                    <option value="true">Active</option>
                                                    <option value="false">Inactive</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className="dm-btn-icon dm-btn-delete"
                                            onClick={() => removeSubject(index)}
                                            title="Remove subject"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                    </div>
                                );
                            })()}

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

export default TeachersManagement;
