import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext';

const ProtectedRoute = ({ children, feature, requireEdit = false, isLoggedIn }) => {
    const { canView, canEdit, loading } = usePermissions();

    // Wait for permissions to load
    if (loading) {
        return (
            <div className="dm-loading-container">
                <div className="dm-loading-spinner"></div>
                <div className="dm-loading-text">Loading permissions...</div>
            </div>
        );
    }

    // Check if user is logged in first
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }

    // Check permissions
    const hasViewPermission = canView(feature);
    const hasEditPermission = canEdit(feature);

    // If requires edit permission
    if (requireEdit && !hasEditPermission) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>Access Denied</h2>
                <p>You don't have edit permission for this feature.</p>
            </div>
        );
    }

    // If requires view permission
    if (!hasViewPermission) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>Access Denied</h2>
                <p>You don't have permission to view this page.</p>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
