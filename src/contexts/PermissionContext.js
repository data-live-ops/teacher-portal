import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.mjs';

const PermissionContext = createContext();

// Feature keys for permission merging
const FEATURE_KEYS = [
    'home',
    'individual_schedule',
    'piket_schedule',
    'teacher_assignment',
    'teacher_utilization',
    'in_class_assessment',
    'data_management'
];

// Default permissions for users NOT in piket_editors
const DEFAULT_PERMISSIONS = {
    home: { view: true },
    individual_schedule: { view: true },
    piket_schedule: { view: true, edit: false },
    teacher_assignment: { view: false, edit: false },
    teacher_utilization: { view: false, edit: false },
    in_class_assessment: { view: false, edit: false },
    data_management: { view: false, edit: false }
};

// Merge permissions using OR logic (MAX permissions from all sources)
const mergePermissions = (individual, ...groupPermissions) => {
    const merged = {};
    for (const featureKey of FEATURE_KEYS) {
        merged[featureKey] = {
            view: individual[featureKey]?.view ||
                  groupPermissions.some(g => g?.[featureKey]?.view),
            edit: individual[featureKey]?.edit ||
                  groupPermissions.some(g => g?.[featureKey]?.edit)
        };
    }
    return merged;
};

export const PermissionProvider = ({ children, userEmail }) => {
    const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
    const [individualPermissions, setIndividualPermissions] = useState(DEFAULT_PERMISSIONS);
    const [groupPermissions, setGroupPermissions] = useState([]);
    const [userGroups, setUserGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRegisteredUser, setIsRegisteredUser] = useState(false);

    useEffect(() => {
        loadUserPermissions();
    }, [userEmail]);

    const loadUserPermissions = async () => {
        if (!userEmail) {
            setPermissions(DEFAULT_PERMISSIONS);
            setIndividualPermissions(DEFAULT_PERMISSIONS);
            setGroupPermissions([]);
            setUserGroups([]);
            setIsRegisteredUser(false);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Fetch user data including group_ids
            const { data: userData, error: userError } = await supabase
                .from('piket_editors')
                .select('email, permissions, group_ids')
                .eq('email', userEmail)
                .single();

            if (userError) {
                // User not in piket_editors - use default permissions
                console.log('User not in piket_editors, using default permissions');
                setPermissions(DEFAULT_PERMISSIONS);
                setIndividualPermissions(DEFAULT_PERMISSIONS);
                setGroupPermissions([]);
                setUserGroups([]);
                setIsRegisteredUser(false);
            } else {
                // User found - load individual permissions
                const userIndividualPerms = userData.permissions || DEFAULT_PERMISSIONS;
                setIndividualPermissions(userIndividualPerms);
                setIsRegisteredUser(true);

                // Check if user has groups assigned
                const groupIds = userData.group_ids || [];
                setUserGroups(groupIds);

                if (groupIds.length > 0) {
                    // Fetch group permissions
                    const { data: groupsData, error: groupsError } = await supabase
                        .from('permission_groups')
                        .select('id, name, permissions')
                        .in('id', groupIds);

                    if (groupsError) {
                        console.error('Error loading groups:', groupsError);
                        setGroupPermissions([]);
                        setPermissions(userIndividualPerms);
                    } else {
                        const groupPerms = groupsData.map(g => g.permissions);
                        setGroupPermissions(groupPerms);

                        // Merge individual + all group permissions
                        const effectivePerms = mergePermissions(userIndividualPerms, ...groupPerms);
                        setPermissions(effectivePerms);
                        console.log('Effective permissions (merged):', effectivePerms);
                    }
                } else {
                    setGroupPermissions([]);
                    setPermissions(userIndividualPerms);
                    console.log('Loaded permissions for', userEmail, ':', userIndividualPerms);
                }
            }
        } catch (error) {
            console.error('Error loading permissions:', error);
            setPermissions(DEFAULT_PERMISSIONS);
            setIndividualPermissions(DEFAULT_PERMISSIONS);
            setGroupPermissions([]);
            setUserGroups([]);
            setIsRegisteredUser(false);
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (feature, action = 'view') => {
        if (!permissions[feature]) return false;
        return permissions[feature][action] === true;
    };

    const canView = (feature) => hasPermission(feature, 'view');
    const canEdit = (feature) => hasPermission(feature, 'edit');

    const value = {
        permissions,           // Effective (merged) permissions
        individualPermissions, // User's individual permissions only
        groupPermissions,      // Array of group permissions
        userGroups,           // User's assigned group IDs
        loading,
        isRegisteredUser,
        hasPermission,
        canView,
        canEdit,
        reload: loadUserPermissions,
        mergePermissions       // Export for UI preview calculations
    };

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error('usePermissions must be used within PermissionProvider');
    }
    return context;
};
