import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Shield, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import '../styles/DataManagement.css';

const FEATURES = [
    { key: 'home', label: 'Home', description: 'Dashboard & overview' },
    { key: 'individual_schedule', label: 'Individual Schedule', description: 'Personal class schedules' },
    { key: 'piket_schedule', label: 'Piket Schedule', description: 'Piket duty schedules' },
    { key: 'teacher_assignment', label: 'Teacher Assignment', description: 'Assign teachers to classes' },
    { key: 'teacher_utilization', label: 'Teacher Utilization', description: 'View utilization metrics' },
    { key: 'data_management', label: 'Data Management', description: 'Manage master data' }
];

const UserAccessManagement = ({ currentUserEmail }) => {
    const { canEdit, reload: reloadPermissions } = usePermissions();
    const hasEditPermission = canEdit('data_management');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: '',
        permissions: {}
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('piket_editors')
                .select('*')
                .order('email');

            if (error) throw error;
            setUsers(data);
        } catch (error) {
            console.error('Error loading users:', error);
            alert('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const getDefaultPermissions = () => {
        const defaultPerms = {};
        FEATURES.forEach(feature => {
            defaultPerms[feature.key] = { view: false, edit: false };
        });
        // Set defaults for basic features
        defaultPerms.home = { view: true };
        defaultPerms.individual_schedule = { view: true };
        defaultPerms.piket_schedule = { view: true, edit: false };
        return defaultPerms;
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name,
                email: user.email,
                role: user.role,
                permissions: user.permissions || getDefaultPermissions()
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                email: '',
                role: 'Editor',
                permissions: getDefaultPermissions()
            });
        }
        setErrors({});
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', role: '', permissions: {} });
        setErrors({});
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (!formData.role.trim()) {
            newErrors.role = 'Role is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            const updatedEmail = formData.email;

            if (editingUser) {
                // Update
                const { error } = await supabase
                    .from('piket_editors')
                    .update({
                        name: formData.name,
                        email: formData.email,
                        role: formData.role,
                        permissions: formData.permissions,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingUser.id);

                if (error) throw error;

                // If current user edited their own permissions, reload immediately
                if (currentUserEmail && updatedEmail === currentUserEmail) {
                    console.log('Reloading permissions for current user...');
                    await reloadPermissions();
                    alert('✅ Your permissions have been updated and reloaded successfully!');
                } else {
                    // Edited another user - they need to logout/login
                    alert('✅ User updated successfully!\n\n⚠️ Note: The user must logout and login again for changes to take effect.');
                }
            } else {
                // Create
                const { error } = await supabase
                    .from('piket_editors')
                    .insert([{
                        name: formData.name,
                        email: formData.email,
                        role: formData.role,
                        permissions: formData.permissions
                    }]);

                if (error) throw error;
                alert('User created successfully');
            }

            handleCloseModal();
            loadUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            alert(`Failed to save: ${error.message}`);
        }
    };

    const handleDelete = async (id, email) => {
        // Warn if deleting self
        if (currentUserEmail && email === currentUserEmail) {
            if (!window.confirm(`⚠️ WARNING: You are about to delete your own account!\n\nThis will remove all your permissions and you will lose access to this system.\n\nAre you absolutely sure?`)) {
                return;
            }
        } else {
            if (!window.confirm(`Are you sure you want to delete user "${email}"?`)) {
                return;
            }
        }

        try {
            const { error } = await supabase
                .from('piket_editors')
                .delete()
                .eq('id', id);

            if (error) throw error;

            if (currentUserEmail && email === currentUserEmail) {
                alert('⚠️ Your account has been deleted. You will be logged out shortly.\n\nPlease contact an administrator to regain access.');
                // Give user time to read the message, then logout
                setTimeout(() => {
                    window.location.href = '/login';
                }, 3000);
            } else {
                alert('✅ User deleted successfully!\n\n⚠️ Note: If the user is currently logged in, they will lose access on their next page reload.');
            }

            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert(`Failed to delete: ${error.message}`);
        }
    };

    const togglePermission = (featureKey, action) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [featureKey]: {
                    ...prev.permissions[featureKey],
                    [action]: !prev.permissions[featureKey]?.[action]
                }
            }
        }));
    };

    const setAllPermissions = (enabled) => {
        const newPerms = {};
        FEATURES.forEach(feature => {
            newPerms[feature.key] = { view: enabled, edit: enabled };
        });
        setFormData(prev => ({ ...prev, permissions: newPerms }));
    };

    const countPermissions = (userPermissions) => {
        if (!userPermissions) return 0;
        let count = 0;
        Object.values(userPermissions).forEach(perm => {
            if (perm.view) count++;
            if (perm.edit) count++;
        });
        return count;
    };

    if (loading) {
        return (
            <div className="dm-loading-container">
                <div className="dm-loading-spinner"></div>
                <div className="dm-loading-text">Loading users...</div>
            </div>
        );
    }

    return (
        <div className="management-section">
            <div className="section-header">
                <h2>User Access Management</h2>
                {hasEditPermission && (
                    <button className="dm-btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={18} />
                        Add New User
                    </button>
                )}
            </div>

            <div className="table-wrapper">
                <table className="management-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Permissions</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="font-semibold">{user.name}</td>
                                <td>{user.email}</td>
                                <td>{user.role}</td>
                                <td>
                                    <span className="permission-count">
                                        <Shield size={14} />
                                        {countPermissions(user.permissions)} permissions
                                    </span>
                                </td>
                                <td>
                                    {hasEditPermission && (
                                        <div className="dm-action-buttons">
                                            <button
                                                className="dm-btn-icon dm-btn-edit"
                                                onClick={() => handleOpenModal(user)}
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="dm-btn-icon dm-btn-delete"
                                                onClick={() => handleDelete(user.id, user.email)}
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

                {users.length === 0 && (
                    <div className="empty-state">
                        <AlertCircle size={48} />
                        <p>No users found</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="data-mgmt-modal-overlay" onClick={handleCloseModal}>
                    <div className="data-mgmt-modal-content data-mgmt-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="data-mgmt-modal-header">
                            <h3>{editingUser ? 'Edit User Access' : 'Add New User'}</h3>
                            <button className="dm-btn-icon" onClick={handleCloseModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Basic Info */}
                            <div className="form-section">
                                <h4>User Information</h4>
                                <div className="form-grid">
                                    <div className="dm-form-group full-width">
                                        <label>Name *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g., John Doe"
                                            className={errors.name ? 'error' : ''}
                                        />
                                        {errors.name && <span className="error-message">{errors.name}</span>}
                                    </div>

                                    <div className="dm-form-group">
                                        <label>Email *</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="e.g., john@colearn.id"
                                            className={errors.email ? 'error' : ''}
                                            disabled={!!editingUser}
                                        />
                                        {errors.email && <span className="error-message">{errors.email}</span>}
                                    </div>

                                    <div className="dm-form-group">
                                        <label>Role *</label>
                                        <input
                                            type="text"
                                            value={formData.role}
                                            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                            placeholder="e.g., Editor, Admin"
                                            className={errors.role ? 'error' : ''}
                                        />
                                        {errors.role && <span className="error-message">{errors.role}</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Permissions */}
                            <div className="form-section">
                                <div className="section-header-inline">
                                    <h4>Feature Permissions</h4>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button type="button" className="dm-btn-secondary dm-btn-sm" onClick={() => setAllPermissions(true)}>
                                            Grant All
                                        </button>
                                        <button type="button" className="dm-btn-secondary dm-btn-sm" onClick={() => setAllPermissions(false)}>
                                            Revoke All
                                        </button>
                                    </div>
                                </div>

                                <div className="permissions-grid">
                                    {FEATURES.map(feature => (
                                        <div key={feature.key} className="permission-card">
                                            <div className="permission-header">
                                                <strong>{feature.label}</strong>
                                                <p>{feature.description}</p>
                                            </div>
                                            <div className="permission-actions">
                                                <label className="permission-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions[feature.key]?.view || false}
                                                        onChange={() => togglePermission(feature.key, 'view')}
                                                    />
                                                    <Eye size={14} />
                                                    <span>View</span>
                                                </label>
                                                <label className="permission-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions[feature.key]?.edit || false}
                                                        onChange={() => togglePermission(feature.key, 'edit')}
                                                    />
                                                    <Edit2 size={14} />
                                                    <span>Edit</span>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="data-mgmt-modal-actions">
                                <button type="button" className="dm-btn-secondary" onClick={handleCloseModal}>
                                    <X size={18} />
                                    Cancel
                                </button>
                                <button type="submit" className="dm-btn-primary">
                                    <Save size={18} />
                                    {editingUser ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserAccessManagement;
