import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.mjs';

const PermissionContext = createContext();

// Default permissions for users NOT in piket_editors
const DEFAULT_PERMISSIONS = {
    home: { view: true },
    individual_schedule: { view: true },
    piket_schedule: { view: true, edit: false },
    teacher_assignment: { view: false, edit: false },
    teacher_utilization: { view: false, edit: false },
    data_management: { view: false, edit: false }
};

export const PermissionProvider = ({ children, userEmail }) => {
    const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
    const [loading, setLoading] = useState(true);
    const [isRegisteredUser, setIsRegisteredUser] = useState(false);

    useEffect(() => {
        loadUserPermissions();
    }, [userEmail]);

    const loadUserPermissions = async () => {
        if (!userEmail) {
            setPermissions(DEFAULT_PERMISSIONS);
            setIsRegisteredUser(false);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('piket_editors')
                .select('email, permissions')
                .eq('email', userEmail)
                .single();

            if (error) {
                // User not in piket_editors - use default permissions
                console.log('User not in piket_editors, using default permissions');
                setPermissions(DEFAULT_PERMISSIONS);
                setIsRegisteredUser(false);
            } else {
                // User found - use their custom permissions
                console.log('Loaded permissions for', userEmail, ':', data.permissions);
                setPermissions(data.permissions || DEFAULT_PERMISSIONS);
                setIsRegisteredUser(true);
            }
        } catch (error) {
            console.error('Error loading permissions:', error);
            setPermissions(DEFAULT_PERMISSIONS);
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
        permissions,
        loading,
        isRegisteredUser,
        hasPermission,
        canView,
        canEdit,
        reload: loadUserPermissions
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
