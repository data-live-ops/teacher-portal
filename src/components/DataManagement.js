import React, { useState } from 'react';
import Navbar from './Navbar';
import { Database, Users, Settings, Shield, RefreshCw, Bell, FileText } from 'lucide-react';
import TeacherLevelingManagement from './TeacherLevelingManagement';
import TeachersManagement from './TeachersManagement';
import UserAccessManagement from './UserAccessManagement';
import SyncSchedulerManagement from './SyncSchedulerManagement';
import NotificationManagement from './NotificationManagement';
import AssignmentLogsManagement from './AssignmentLogsManagement';
import '../styles/DataManagement.css';

const DataManagement = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('leveling');

    const tabs = [
        { id: 'leveling', label: 'Teacher Leveling', icon: Settings },
        { id: 'teachers', label: 'Teachers', icon: Users },
        { id: 'access', label: 'User Access', icon: Shield },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'sync', label: 'Sync Scheduler', icon: RefreshCw },
        { id: 'logs', label: 'Assignment Logs', icon: FileText }
    ];

    return (
        <>
            <Navbar userEmail={user} onLogoutClick={onLogout} />
            <div className="data-management-container">
                <div className="page-header">
                    <div className="header-content-data-management">
                        <Database size={32} className="header-icon" />
                        <div>
                            <h1>Data Management</h1>
                            <p>Manage teacher leveling definitions and teacher data</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="dm-tab-navigation">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {activeTab === 'leveling' && <TeacherLevelingManagement />}
                    {activeTab === 'teachers' && <TeachersManagement />}
                    {activeTab === 'access' && <UserAccessManagement currentUserEmail={user?.email} />}
                    {activeTab === 'notifications' && <NotificationManagement currentUserEmail={user} />}
                    {activeTab === 'sync' && <SyncSchedulerManagement />}
                    {activeTab === 'logs' && <AssignmentLogsManagement />}
                </div>
            </div>
        </>
    );
};

export default DataManagement;
