import React, { useState } from 'react';
import { LayoutDashboard, BarChart3 } from 'lucide-react';
import '../styles/TeacherAssignment.css';
import '../styles/InClassAssessment.css';
import Navbar from './Navbar';
import ICADashboardTab from './ICADashboardTab';
import ICAAnalyticsTab from './ICAAnalyticsTab';

const MAIN_TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const InClassAssessment = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <>
            <Navbar userEmail={user} onLogoutClick={onLogout} />

            {/* ica-page-tabs-clearance clears the fixed 75px navbar via padding-top
                (not margin-top: this div is the first in-flow element on the page,
                since Navbar is position:fixed and out of flow - a margin-top here
                would collapse with the ancestor chain up to <body> and render as 0,
                which is exactly what was happening). Reuses the app-wide
                underline-tab convention (.tab-navigation/.tab-button) from
                TeacherAssignment.css for the tabs themselves. */}
            <div className="ica-page-tabs-clearance">
                <div className="tab-navigation">
                    {MAIN_TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeTab === 'dashboard' && <ICADashboardTab user={user} />}
            {activeTab === 'analytics' && <ICAAnalyticsTab />}
        </>
    );
};

export default InClassAssessment;
