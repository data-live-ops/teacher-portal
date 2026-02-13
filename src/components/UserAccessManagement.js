import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Shield, Eye, EyeOff, Check, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import '../styles/DataManagement.css';

const FEATURES = [
    { key: 'home', label: 'Home', description: 'Dashboard & overview' },
    { key: 'individual_schedule', label: 'Individual Schedule', description: 'Personal class schedules' },
    { key: 'piket_schedule', label: 'Piket Schedule', description: 'Piket duty schedules' },
    { key: 'teacher_assignment', label: 'Teacher Assignment', description: 'Assign teachers to classes' },
    { key: 'teacher_utilization', label: 'Teacher Utilization', description: 'View utilization metrics' },
    { key: 'in_class_assessment', label: 'In Class Assessment', description: 'View student understanding per session' },
    { key: 'data_management', label: 'Data Management', description: 'Manage master data' }
];

// Merge permissions using OR logic (MAX permissions from all sources)
const mergePermissions = (individual, ...groupPermissions) => {
    const merged = {};
    for (const feature of FEATURES) {
        merged[feature.key] = {
            view: individual[feature.key]?.view ||
                  groupPermissions.some(g => g?.[feature.key]?.view),
            edit: individual[feature.key]?.edit ||
                  groupPermissions.some(g => g?.[feature.key]?.edit)
        };
    }
    return merged;
};

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
        permissions: {},
        group_ids: []
    });
    const [errors, setErrors] = useState({});

    // Permission Groups state
    const [groups, setGroups] = useState([]);
    const [showGroupsSection, setShowGroupsSection] = useState(true);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [groupFormData, setGroupFormData] = useState({
        name: '',
        description: '',
        permissions: {},
        memberIds: []  // Track which users are in this group
    });
    const [groupErrors, setGroupErrors] = useState({});

    useEffect(() => {
        loadUsers();
        loadGroups();
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

    const loadGroups = async () => {
        try {
            const { data, error } = await supabase
                .from('permission_groups')
                .select('*')
                .order('name');

            if (error) throw error;
            setGroups(data || []);
        } catch (error) {
            console.error('Error loading groups:', error);
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
                permissions: user.permissions || getDefaultPermissions(),
                group_ids: user.group_ids || []
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                email: '',
                role: 'Editor',
                permissions: getDefaultPermissions(),
                group_ids: []
            });
        }
        setErrors({});
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', role: '', permissions: {}, group_ids: [] });
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
                        group_ids: formData.group_ids,
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
                        permissions: formData.permissions,
                        group_ids: formData.group_ids
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

    // Calculate effective permissions for a user (individual + groups)
    const getEffectivePermissions = (user) => {
        const individualPerms = user.permissions || getDefaultPermissions();
        const userGroupIds = user.group_ids || [];

        if (userGroupIds.length === 0) {
            return individualPerms;
        }

        const userGroups = groups.filter(g => userGroupIds.includes(g.id));
        const groupPerms = userGroups.map(g => g.permissions);

        return mergePermissions(individualPerms, ...groupPerms);
    };

    // Get group names for a user
    const getUserGroupNames = (user) => {
        const userGroupIds = user.group_ids || [];
        if (userGroupIds.length === 0) return [];
        return groups.filter(g => userGroupIds.includes(g.id)).map(g => g.name);
    };

    // === Permission Groups CRUD ===
    const handleOpenGroupModal = (group = null) => {
        if (group) {
            // Find users who are members of this group
            const memberIds = users
                .filter(u => (u.group_ids || []).includes(group.id))
                .map(u => u.id);

            setEditingGroup(group);
            setGroupFormData({
                name: group.name,
                description: group.description || '',
                permissions: group.permissions || getDefaultPermissions(),
                memberIds: memberIds
            });
        } else {
            setEditingGroup(null);
            setGroupFormData({
                name: '',
                description: '',
                permissions: getDefaultPermissions(),
                memberIds: []
            });
        }
        setGroupErrors({});
        setShowGroupModal(true);
    };

    const handleCloseGroupModal = () => {
        setShowGroupModal(false);
        setEditingGroup(null);
        setGroupFormData({ name: '', description: '', permissions: {}, memberIds: [] });
        setGroupErrors({});
    };

    const validateGroupForm = () => {
        const newErrors = {};
        if (!groupFormData.name.trim()) {
            newErrors.name = 'Group name is required';
        }
        setGroupErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleGroupSubmit = async (e) => {
        e.preventDefault();
        if (!validateGroupForm()) return;

        try {
            let groupId = editingGroup?.id;

            if (editingGroup) {
                // Update group
                const { error } = await supabase
                    .from('permission_groups')
                    .update({
                        name: groupFormData.name,
                        description: groupFormData.description,
                        permissions: groupFormData.permissions,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingGroup.id);

                if (error) throw error;
            } else {
                // Create new group
                const { data, error } = await supabase
                    .from('permission_groups')
                    .insert([{
                        name: groupFormData.name,
                        description: groupFormData.description,
                        permissions: groupFormData.permissions
                    }])
                    .select()
                    .single();

                if (error) throw error;
                groupId = data.id;
            }

            // Update user memberships
            const selectedMemberIds = groupFormData.memberIds || [];

            // Get current members (users who have this group in their group_ids)
            const currentMemberIds = editingGroup
                ? users.filter(u => (u.group_ids || []).includes(editingGroup.id)).map(u => u.id)
                : [];

            // Users to add to group (newly selected)
            const usersToAdd = selectedMemberIds.filter(id => !currentMemberIds.includes(id));
            // Users to remove from group (deselected)
            const usersToRemove = currentMemberIds.filter(id => !selectedMemberIds.includes(id));

            // Add group to newly selected users
            for (const userId of usersToAdd) {
                const user = users.find(u => u.id === userId);
                if (user) {
                    const newGroupIds = [...(user.group_ids || []), groupId];
                    await supabase
                        .from('piket_editors')
                        .update({ group_ids: newGroupIds, updated_at: new Date().toISOString() })
                        .eq('id', userId);
                }
            }

            // Remove group from deselected users
            for (const userId of usersToRemove) {
                const user = users.find(u => u.id === userId);
                if (user) {
                    const newGroupIds = (user.group_ids || []).filter(gid => gid !== groupId);
                    await supabase
                        .from('piket_editors')
                        .update({ group_ids: newGroupIds, updated_at: new Date().toISOString() })
                        .eq('id', userId);
                }
            }

            alert(editingGroup ? 'Group updated successfully' : 'Group created successfully');

            handleCloseGroupModal();
            loadGroups();
            loadUsers(); // Reload users to reflect membership changes

            // Reload current user permissions if they might be affected
            if (currentUserEmail) {
                await reloadPermissions();
            }
        } catch (error) {
            console.error('Error saving group:', error);
            alert(`Failed to save group: ${error.message}`);
        }
    };

    const handleDeleteGroup = async (id, name) => {
        // Check if any users are using this group
        const usersWithGroup = users.filter(u => (u.group_ids || []).includes(id));

        let confirmMessage = `Are you sure you want to delete the group "${name}"?`;
        if (usersWithGroup.length > 0) {
            confirmMessage += `\n\n⚠️ Warning: ${usersWithGroup.length} user(s) are currently assigned to this group. They will lose permissions from this group.`;
        }

        if (!window.confirm(confirmMessage)) return;

        try {
            const { error } = await supabase
                .from('permission_groups')
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('Group deleted successfully');
            loadGroups();

            // Reload permissions if current user might be affected
            if (currentUserEmail) {
                await reloadPermissions();
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            alert(`Failed to delete group: ${error.message}`);
        }
    };

    const toggleGroupPermission = (featureKey, action) => {
        setGroupFormData(prev => ({
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

    const setAllGroupPermissions = (enabled) => {
        const newPerms = {};
        FEATURES.forEach(feature => {
            newPerms[feature.key] = { view: enabled, edit: enabled };
        });
        setGroupFormData(prev => ({ ...prev, permissions: newPerms }));
    };

    // Toggle member selection in group form
    const toggleMemberSelection = (userId) => {
        setGroupFormData(prev => {
            const currentMembers = prev.memberIds || [];
            const isSelected = currentMembers.includes(userId);

            return {
                ...prev,
                memberIds: isSelected
                    ? currentMembers.filter(id => id !== userId)
                    : [...currentMembers, userId]
            };
        });
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
            {/* Permission Groups Section */}
            <div className="collapsible-section">
                <div
                    className="collapsible-header"
                    onClick={() => setShowGroupsSection(!showGroupsSection)}
                >
                    <div className="collapsible-title">
                        <Users size={20} />
                        <h3>Permission Groups</h3>
                        <span className="group-count-badge">{groups.length} groups</span>
                    </div>
                    <div className="collapsible-actions">
                        {hasEditPermission && (
                            <button
                                className="dm-btn-primary dm-btn-sm"
                                onClick={(e) => { e.stopPropagation(); handleOpenGroupModal(); }}
                            >
                                <Plus size={16} />
                                Add Group
                            </button>
                        )}
                        {showGroupsSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>

                {showGroupsSection && (
                    <div className="collapsible-content">
                        {groups.length > 0 ? (
                            <div className="groups-grid">
                                {groups.map(group => (
                                    <div key={group.id} className="group-card">
                                        <div className="group-card-header">
                                            <h4>{group.name}</h4>
                                            {hasEditPermission && (
                                                <div className="dm-action-buttons">
                                                    <button
                                                        className="dm-btn-icon dm-btn-edit"
                                                        onClick={() => handleOpenGroupModal(group)}
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        className="dm-btn-icon dm-btn-delete"
                                                        onClick={() => handleDeleteGroup(group.id, group.name)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {group.description && (
                                            <p className="group-description">{group.description}</p>
                                        )}
                                        <div className="group-stats">
                                            <span className="permission-count">
                                                <Shield size={12} />
                                                {countPermissions(group.permissions)} permissions
                                            </span>
                                            <span className="users-in-group">
                                                <Users size={12} />
                                                {users.filter(u => (u.group_ids || []).includes(group.id)).length} users
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state-small">
                                <p>No permission groups created yet.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Users Section */}
            <div className="section-header" style={{ marginTop: '30px' }}>
                <h2>Users</h2>
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
                            <th>Groups</th>
                            <th>Permissions</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => {
                            const userGroupNames = getUserGroupNames(user);
                            const effectivePerms = getEffectivePermissions(user);
                            const individualCount = countPermissions(user.permissions);
                            const effectiveCount = countPermissions(effectivePerms);

                            return (
                                <tr key={user.id}>
                                    <td className="font-semibold">{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>{user.role}</td>
                                    <td>
                                        {userGroupNames.length > 0 ? (
                                            <div className="group-badges">
                                                {userGroupNames.map((name, idx) => (
                                                    <span key={idx} className="group-badge">{name}</span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-muted">None</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className="permission-count" title={`Individual: ${individualCount}, Effective: ${effectiveCount}`}>
                                            <Shield size={14} />
                                            {effectiveCount} {effectiveCount !== individualCount && <span className="effective-label">(effective)</span>}
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
                            );
                        })}
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

                            {/* Individual Permissions */}
                            <div className="form-section">
                                <div className="section-header-inline">
                                    <h4>Individual Permissions</h4>
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

            {/* Group Modal */}
            {showGroupModal && (
                <div className="data-mgmt-modal-overlay" onClick={handleCloseGroupModal}>
                    <div className="data-mgmt-modal-content data-mgmt-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="data-mgmt-modal-header">
                            <h3>{editingGroup ? 'Edit Permission Group' : 'Create Permission Group'}</h3>
                            <button className="dm-btn-icon" onClick={handleCloseGroupModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleGroupSubmit}>
                            {/* Group Info */}
                            <div className="form-section">
                                <h4>Group Information</h4>
                                <div className="form-grid">
                                    <div className="dm-form-group">
                                        <label>Group Name *</label>
                                        <input
                                            type="text"
                                            value={groupFormData.name}
                                            onChange={(e) => setGroupFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g., Admin, Viewer, Editor"
                                            className={groupErrors.name ? 'error' : ''}
                                        />
                                        {groupErrors.name && <span className="error-message">{groupErrors.name}</span>}
                                    </div>

                                    <div className="dm-form-group">
                                        <label>Description</label>
                                        <input
                                            type="text"
                                            value={groupFormData.description}
                                            onChange={(e) => setGroupFormData(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="e.g., Full access to all features"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Group Permissions */}
                            <div className="form-section">
                                <div className="section-header-inline">
                                    <h4>Group Permissions</h4>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button type="button" className="dm-btn-secondary dm-btn-sm" onClick={() => setAllGroupPermissions(true)}>
                                            Grant All
                                        </button>
                                        <button type="button" className="dm-btn-secondary dm-btn-sm" onClick={() => setAllGroupPermissions(false)}>
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
                                                        checked={groupFormData.permissions[feature.key]?.view || false}
                                                        onChange={() => toggleGroupPermission(feature.key, 'view')}
                                                    />
                                                    <Eye size={14} />
                                                    <span>View</span>
                                                </label>
                                                <label className="permission-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={groupFormData.permissions[feature.key]?.edit || false}
                                                        onChange={() => toggleGroupPermission(feature.key, 'edit')}
                                                    />
                                                    <Edit2 size={14} />
                                                    <span>Edit</span>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Group Members */}
                            <div className="form-section">
                                <div className="section-header-inline">
                                    <h4>
                                        <Users size={16} />
                                        Members
                                        <span className="member-count-badge">
                                            {(groupFormData.memberIds || []).length} selected
                                        </span>
                                    </h4>
                                </div>
                                <p className="form-section-description">
                                    Select users to add to this group. They will receive all permissions defined above.
                                </p>

                                {users.length > 0 ? (
                                    <div className="members-selection-grid">
                                        {users.map(user => (
                                            <label
                                                key={user.id}
                                                className={`member-selection-card ${(groupFormData.memberIds || []).includes(user.id) ? 'selected' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={(groupFormData.memberIds || []).includes(user.id)}
                                                    onChange={() => toggleMemberSelection(user.id)}
                                                />
                                                <div className="member-selection-info">
                                                    <strong>{user.name}</strong>
                                                    <span>{user.email}</span>
                                                </div>
                                                <Check size={18} className="check-icon" />
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state-small">
                                        <p>No users available. Create users first.</p>
                                    </div>
                                )}
                            </div>

                            <div className="data-mgmt-modal-actions">
                                <button type="button" className="dm-btn-secondary" onClick={handleCloseGroupModal}>
                                    <X size={18} />
                                    Cancel
                                </button>
                                <button type="submit" className="dm-btn-primary">
                                    <Save size={18} />
                                    {editingGroup ? 'Update Group' : 'Create Group'}
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
