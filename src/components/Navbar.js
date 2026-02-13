import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import NotificationBell from './NotificationBell';

const chevronDownIcon = 'https://media.sessions.colearn.id/assets/other/images/2025-06-25T20:32:01.647Z-Chevron Down.png';
const chevronUpIcon = 'https://media.sessions.colearn.id/assets/other/images/2025-06-25T21:02:44.917Z-Chevron Up.png';

const Navbar = ({ userEmail, onLoginClick, isLoggedIn, onLogoutClick }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [userAvatar, setUserAvatar] = useState(null);
    const menuRef = useRef();
    const navigate = useNavigate();
    const { canView } = usePermissions();

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        }

        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    useEffect(() => {
        if (!userEmail) return;

        supabase
            .from('avatars')
            .select('first_name, last_name, url')
            .eq('email', userEmail)
            .single()
            .then(({ data }) => setUserAvatar(data));
    }, [userEmail]);

    return (
        <nav className="navbar">
            <div className="navbar-left" onClick={() => { navigate('/'); setShowMenu(false); }}>
                <img
                    src="https://media.sessions.colearn.id/assets/other/images/2025-06-30T03:14:43.279Z-unnamed-4.png"
                    alt="Logo"
                    className="navbar-logo"
                />
                <span className="navbar-title">Teacher Portal</span>
            </div>
            <div className="navbar-right">
                <NotificationBell userEmail={userEmail} />
                <span className="navbar-user">{userAvatar ? `Halo, ${userAvatar.last_name || userAvatar.first_name || userEmail}` : `Halo, Kak ${userEmail?.displayName}!`}</span>
                <img className='user-profile-photo' src={userAvatar ? userAvatar.url : userEmail?.photoURL} />
                <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                        className='navbar-profile'
                        src={showMenu ? chevronUpIcon : chevronDownIcon}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowMenu(prev => !prev)}
                    />
                    {showMenu && (
                        <ul className="navbar-dropdown-menu">
                            <li onClick={() => { navigate('/'); setShowMenu(false); }}>Home</li>
                            {canView('individual_schedule') && (
                                <li onClick={() => { navigate('/individual-schedule'); setShowMenu(false); }}>Individual Schedule</li>
                            )}
                            {canView('piket_schedule') && (
                                <li onClick={() => { navigate('/piket-schedule'); setShowMenu(false); }}>Piket Schedule</li>
                            )}
                            {canView('teacher_assignment') && (
                                <li onClick={() => { navigate('/teacher-assignment'); setShowMenu(false); }}>Teacher Assignment</li>
                            )}
                            {canView('teacher_utilization') && (
                                <li onClick={() => { navigate('/teacher-utilization'); setShowMenu(false); }}>Teacher Utilization</li>
                            )}
                            {canView('in_class_assessment') && (
                                <li onClick={() => { navigate('/in-class-assessment'); setShowMenu(false); }}>In Class Assessment</li>
                            )}
                            {canView('data_management') && (
                                <li onClick={() => { navigate('/data-management'); setShowMenu(false); }}>Data Management</li>
                            )}
                            <li onClick={onLogoutClick}>Log Out</li>
                        </ul>
                    )}
                </div>
            </div>
        </nav >
    );
}

export default Navbar;