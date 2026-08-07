import React, { useState } from 'react';
import { LayoutDashboard, BarChart3, SlidersHorizontal } from 'lucide-react';
import '../styles/TeacherAssignment.css';
import '../styles/InClassAssessment.css';
import Navbar from './Navbar';
import ICADashboardTab from './ICADashboardTab';
import ICAAnalyticsTab from './ICAAnalyticsTab';
import ThresholdConfigManager from './ThresholdConfigManager';

const MAIN_TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const InClassAssessment = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showThresholdManager, setShowThresholdManager] = useState(false);
    // Bumped after saving the global threshold config, forcing both tabs to
    // remount and re-fetch instead of showing stale pre-save classification.
    const [thresholdRefreshKey, setThresholdRefreshKey] = useState(0);

    return (
        <>
            <Navbar userEmail={user} onLogoutClick={onLogout} />

            {/* ica-page-tabs-clearance clears the fixed 75px navbar via padding-top
                (not margin-top: this div is the first in-flow element on the page,
                since Navbar is position:fixed and out of flow - a margin-top here
                would collapse with the ancestor chain up to <body> and render as 0,
                which is exactly what was happening). Reuses the app-wide
                underline-tab convention (.tab-navigation/.tab-button) from
                TeacherAssignment.css for the tabs themselves.

                "Ambang Batas" lives here (not inside a specific tab) because it's
                a single global setting that affects both Dashboard and Analytics -
                it needs to be reachable no matter which tab is currently open. */}
            <div className="ica-page-tabs-clearance">
                <div className="tab-navigation" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex' }}>
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
                    <button
                        className="dropdown-button"
                        style={{ alignSelf: 'center', marginRight: 12 }}
                        onClick={() => setShowThresholdManager(true)}
                        title="Atur ambang batas Below/Optimal/Above untuk semua user"
                    >
                        <SlidersHorizontal size={16} />
                        Ambang Batas
                    </button>
                </div>
            </div>

            {activeTab === 'dashboard' && <ICADashboardTab key={`dashboard-${thresholdRefreshKey}`} user={user} />}
            {activeTab === 'analytics' && <ICAAnalyticsTab key={`analytics-${thresholdRefreshKey}`} />}

            <ThresholdConfigManager
                isOpen={showThresholdManager}
                onClose={() => setShowThresholdManager(false)}
                userEmail={user}
                onSaved={() => setThresholdRefreshKey(k => k + 1)}
            />
        </>
    );
};

export default InClassAssessment;
