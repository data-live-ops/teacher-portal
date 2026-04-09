import React, { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from './Navbar';
import PICSelector from './PICSelector';
import { supabase } from '../lib/supabaseClient.mjs';
import { ExternalLink, AlertTriangle, Users, X, Phone, LogOut, Eye, CheckCircle, Loader } from 'lucide-react';
import '../styles/TeacherMonitoring.css';

// Helper function to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Status tabs configuration
const TABS = [
    { key: 'need_replacement', label: 'Need Replacement', color: '#7C3AED', bgColor: '#EDE9FE', icon: '🚨' },
    { key: 'not_started', label: 'Class Not Started', color: '#DC2626', bgColor: '#FEE2E2' },
    { key: 'left', label: 'Left', color: '#EA580C', bgColor: '#FFEDD5' },
    { key: 'joining', label: 'Joining', color: '#CA8A04', bgColor: '#FEF9C3' },
    { key: 'joined', label: 'Joined', color: '#16A34A', bgColor: '#DCFCE7' },
];

const DUMMY_CLASSES = [
    { id: 1146652, session_id: 'a9eff481-d4ab-46f1-9959-cfd116e5cd7c', subject: 'IPA', session_topic: 'Usaha dan Energi', slot_name: 'IPA 1', teacher_name: 'Iftita Selviana', grade: '10', class_time: '16:00-17:00' },
    { id: 1146480, session_id: '5e8f054e-8e6a-4faa-a4c6-8c6d10f19764', subject: 'IPA', session_topic: 'Usaha dan Energi', slot_name: 'IPA 6', teacher_name: 'Nurfadila', grade: '10', class_time: '17:15-18:15' },
    { id: 1146733, session_id: 'cc0e6aa9-e006-4f30-a224-6b36418e628a', subject: 'IPA', session_topic: 'Usaha dan Energi', slot_name: 'IPA 8', teacher_name: 'Iftita Selviana', grade: '10', class_time: '19:00-20:00' },
    { id: 1146402, session_id: '3cd39ab9-ca9e-4a0d-a4c4-6fb0d2f3c2a5', subject: 'Matematika', session_topic: 'Persiapan PTS', slot_name: 'Matematika 1 (1x)', teacher_name: 'Devi Claudia', grade: '10', class_time: '16:00-17:00' },
    { id: 1146597, session_id: '9349111e-8c78-4ccd-8161-71291224ceff', subject: 'Matematika', session_topic: 'Persiapan PTS', slot_name: 'Matematika 11 (1x)', teacher_name: 'Sinatrya Nisa Budikusuma', grade: '10', class_time: '17:15-18:15' },
    { id: 1146280, session_id: '03426fe4-e4ec-4079-80c9-6e05212753af', subject: 'Matematika', session_topic: 'Persiapan PTS', slot_name: 'Matematika 2 (2x)', teacher_name: 'Indra Setiawan', grade: '10', class_time: '17:15-18:15' },
    { id: 1146359, session_id: '2be389db-d029-4269-ac95-bf471ea3c6fd', subject: 'Matematika', session_topic: 'Persiapan PTS', slot_name: 'Matematika 6 (1x)', teacher_name: 'Maya Annisa', grade: '10', class_time: '19:00-20:00' },
    { id: 1146335, session_id: '1fbb7997-05b5-48f3-b4e8-220ac0531ca5', subject: 'Matematika', session_topic: 'Persiapan PTS', slot_name: 'Matematika 6 (2x)', teacher_name: 'Meicheil Yohansa', grade: '10', class_time: '19:00-20:00' },
    { id: 1146946, session_id: '42498d77-c47e-4065-963e-252761c136d9', subject: 'Fisika', session_topic: 'Persiapan PTS', slot_name: 'Fisika 2', teacher_name: 'Luthfi Yuliyanthi Suryadi', grade: '11', class_time: '19:00-20:00' },
    { id: 1147041, session_id: '7a604cc1-f609-4210-bbbd-6f53f37a7b58', subject: 'Kimia', session_topic: 'Persiapan PTS', slot_name: 'Kimia 4', teacher_name: 'Indah Permatasari', grade: '11', class_time: '17:15-18:15' },
    { id: 1147195, session_id: 'd1097158-9b64-408a-991a-b6adceffc0f6', subject: 'Matematika', session_topic: 'Statistika Regresi', slot_name: 'Matematika 1 (1x)', teacher_name: 'Devi Claudia', grade: '11', class_time: '17:15-18:15' },
    { id: 1147166, session_id: 'bd7122ff-3623-4fad-9a07-a863c44ab04c', subject: 'Matematika', session_topic: 'Statistika Regresi', slot_name: 'Matematika 2 (2x)', teacher_name: 'Mohamad Handri Tuloli', grade: '11', class_time: '17:15-18:15' },
    { id: 1146993, session_id: '61e129e3-0890-48e9-a510-84c2916b3973', subject: 'Matematika', session_topic: 'Statistika Regresi', slot_name: 'Matematika 4 (2x)', teacher_name: 'Benedictus Aditya Kurniawan', grade: '11', class_time: '19:00-20:00' },
    { id: 1147211, session_id: 'd9233811-fcb2-4e7d-b95d-f35db8732d31', subject: 'Matematika', session_topic: 'Statistika Regresi', slot_name: 'Matematika 6 (1x)', teacher_name: 'Razieq Ilham Amali', grade: '11', class_time: '19:00-20:00' },
    { id: 1147226, session_id: 'e3f83c7c-880c-461a-beee-a191c8cca229', subject: 'Matematika', session_topic: 'Statistika Regresi', slot_name: 'Matematika 6 (2x)', teacher_name: 'Muhamad Ijharudin', grade: '11', class_time: '19:00-20:00' },
    { id: 1147358, session_id: 'caa64291-e506-4710-8b00-25364499a4b6', subject: 'Matematika', session_topic: 'Persiapan US', slot_name: 'Matematika 1', teacher_name: 'Levi Lawrence', grade: '12', class_time: '17:15-18:15' },
    { id: 1147292, session_id: '1f8ca010-dead-4f5f-8b5c-57e6f091b97b', subject: 'Matematika', session_topic: 'Persiapan US', slot_name: 'Matematika 3', teacher_name: 'Mohamad Handri Tuloli', grade: '12', class_time: '19:00-20:00' },
    { id: 1142503, session_id: 'd5c526c7-f302-41e6-8490-e922363332b9', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 1', teacher_name: 'Ainun Widyawati', grade: '4', class_time: '14:30-15:30' },
    { id: 1142405, session_id: 'ac3df436-612b-469b-829a-742cadd0063a', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 12', teacher_name: 'Eka Kartika Damayanti', grade: '4', class_time: '17:15-18:15' },
    { id: 1142462, session_id: 'c2ff1cff-6bd0-493c-9495-89befd4b20e0', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 19', teacher_name: 'Windi Getti Nurasti Dewik', grade: '4', class_time: '19:00-20:00' },
    { id: 1142589, session_id: 'f9d69c5e-ba3d-47cf-8cd2-3795463d2845', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 23', teacher_name: 'Meilysa Ajeng Kartika Putri', grade: '4', class_time: '19:00-20:00' },
    { id: 1142472, session_id: 'c67fb0f6-b260-4001-8c19-83d18bcd065f', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 27', teacher_name: 'Siti Nurazizah', grade: '4', class_time: '16:00-17:00' },
    { id: 1142453, session_id: 'bf041ede-22ec-4b08-b718-c1d33c3d3455', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 32', teacher_name: 'Alfi Fani Supardi', grade: '4', class_time: '17:15-18:15' },
    { id: 1142538, session_id: 'e711101a-56e4-457b-a87e-7d68e70a699b', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 35', teacher_name: 'Fahkriani Hanif', grade: '4', class_time: '16:00-17:00' },
    { id: 1142237, session_id: '6972a8bc-c4e9-4b5f-b492-518f6501b95b', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 38', teacher_name: 'Siti Nurazizah', grade: '4', class_time: '19:00-20:00' },
    { id: 1142054, session_id: '1f947b4b-51f2-4db8-b49a-2126eb63337d', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 41', teacher_name: 'Siti Nurazizah', grade: '4', class_time: '17:15-18:15' },
    { id: 1142571, session_id: 'f3e6771a-bed1-48f0-94a3-ce6f2299e942', subject: 'Matematika', session_topic: 'Bangun Datar', slot_name: 'Matematika 7', teacher_name: 'Yufrida Septi Nindya', grade: '4', class_time: '16:00-17:00' },
    { id: 1143210, session_id: 'c93f6c21-7963-4a26-ae58-5fc29c500f55', subject: 'Matematika', session_topic: 'Bangun Ruang', slot_name: 'Matematika 1', teacher_name: 'Gracia Evelyn Setyaputri', grade: '5', class_time: '16:00-17:00' },
    { id: 1143200, session_id: 'c7591936-2838-45de-8366-ade8afe2bc6d', subject: 'Matematika', session_topic: 'Bangun Ruang', slot_name: 'Matematika 13', teacher_name: 'Adelina Savitri', grade: '5', class_time: '14:30-15:30' },
    { id: 1142772, session_id: '3af1e78d-3892-4b99-9f06-bc35744f1fce', subject: 'Matematika', session_topic: 'Bangun Ruang', slot_name: 'Matematika 18', teacher_name: 'Katherine Himawati Kosim', grade: '5', class_time: '19:00-20:00' },
];

// Initial statuses for demo - will change dynamically
// 'stuck' is a special marker for joining with >5 min duration (will be converted to 'joining')
const INITIAL_STATUSES = [
    'not_started', 'not_started', 'not_started', 'not_started', 'not_started',  // 5 not started
    'stuck', 'stuck', 'stuck',  // 3 stuck join (joining > 5 min)
    'joining', 'joining',  // 2 normal joining
    'joined', 'joined', 'joined', 'joined', 'joined', 'joined', 'joined', 'joined',  // 8 joined
    'left', 'left', 'left',  // 3 left
    'not_started', 'stuck', 'joining', 'joined', 'joined', 'joined', 'left', 'joined', 'joined'  // rest
];

// Generate initial data for the simulation
const generateInitialData = () => {
    const now = new Date();

    return DUMMY_CLASSES.map((cls, index) => {
        const statusMarker = INITIAL_STATUSES[index] || 'joined';
        // Convert 'stuck' marker to actual 'joining' status
        const status = statusMarker === 'stuck' ? 'joining' : statusMarker;
        const isStuckJoin = statusMarker === 'stuck';

        const [startTime, endTime] = cls.class_time.split('-');

        // Parse class time
        const classStartTime = new Date(now);
        const [startHour, startMin] = startTime.split(':').map(Number);
        classStartTime.setHours(startHour, startMin, 0, 0);

        const classEndTime = new Date(now);
        const [endHour, endMin] = endTime.split(':').map(Number);
        classEndTime.setHours(endHour, endMin, 0, 0);

        // Joining time - set based on stuck status
        const joiningTime = new Date(now);
        if (isStuckJoin) {
            // Stuck: joining time 6-12 minutes ago (definitely > 5 min threshold)
            joiningTime.setMinutes(joiningTime.getMinutes() - (6 + Math.floor(Math.random() * 7)));
        } else if (status === 'joining') {
            // Normal joining: 1-3 minutes ago
            joiningTime.setMinutes(joiningTime.getMinutes() - (1 + Math.floor(Math.random() * 3)));
        } else {
            // Other statuses: random time
            joiningTime.setMinutes(joiningTime.getMinutes() - Math.floor(Math.random() * 10));
        }

        // Generate teacher email from name
        const teacherEmail = cls.teacher_name.toLowerCase().replace(/\s+/g, '.') + '@colearn.id';

        return {
            id: `class-${cls.id}`,
            live_class_id: cls.session_id,
            teacher_name: cls.teacher_name,
            teacher_email: teacherEmail,
            teacher_phone: `0812${String(cls.id).slice(-8).padStart(8, '0')}`,
            slot_name: cls.slot_name,
            session_topic: cls.session_topic,
            class_subject: cls.subject,
            class_grade: cls.grade,
            class_time: cls.class_time,
            class_start_time: classStartTime.toISOString(),
            class_end_time: classEndTime.toISOString(),
            zoom_link: `https://zoom.us/j/${cls.id}`,
            status: status,
            joining_time: status !== 'not_started' ? joiningTime.toISOString() : null,
            need_replacement: false,
            replacement_reason: null,
            replacement_requested_at: null,
            replacement_requested_by: null,
        };
    });
};

// Simulate status changes for demo
const simulateStatusChange = (currentData) => {
    const now = new Date();

    return currentData.map(item => {
        // Skip items that need replacement (handled separately)
        if (item.need_replacement) return item;

        // Random chance to change status (25% chance per item per cycle)
        if (Math.random() > 0.25) return item;

        let newStatus = item.status;
        let newJoiningTime = item.joining_time;

        // Check if currently stuck (> 5 minutes in joining)
        const joiningDuration = item.joining_time ?
            (now - new Date(item.joining_time)) / 60000 : 0;
        const isCurrentlyStuck = item.status === 'joining' && joiningDuration > 5;

        switch (item.status) {
            case 'not_started':
                // 60% chance to start joining, 40% stay not_started
                if (Math.random() < 0.6) {
                    newStatus = 'joining';
                    newJoiningTime = now.toISOString();
                }
                break;

            case 'joining':
                if (isCurrentlyStuck) {
                    // Stuck join - lower chance to resolve (30%), keeps it visible longer
                    const rand = Math.random();
                    if (rand < 0.2) {
                        newStatus = 'joined';  // 20% finally joined
                    } else if (rand < 0.3) {
                        newStatus = 'left';    // 10% gave up/disconnected
                    }
                    // 70% stays stuck - visible for demo
                } else {
                    // Normal joining - 50% chance to join, 50% stay joining (may become stuck)
                    if (Math.random() < 0.5) {
                        newStatus = 'joined';
                    }
                    // Staying in 'joining' will eventually become stuck after 5 min
                }
                break;

            case 'joined':
                // 10% chance to leave (teacher disconnected, etc.)
                if (Math.random() < 0.1) {
                    newStatus = 'left';
                }
                break;

            case 'left':
                // 50% chance to rejoin
                if (Math.random() < 0.5) {
                    newStatus = 'joining';
                    newJoiningTime = now.toISOString();
                }
                break;

            default:
                break;
        }

        return {
            ...item,
            status: newStatus,
            joining_time: newJoiningTime,
        };
    });
};

const TeacherMonitoring = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('not_started');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [showPICSelector, setShowPICSelector] = useState(false);
    const [currentPIC, setCurrentPIC] = useState(null);
    const [activePICs, setActivePICs] = useState([]);
    const [checkingPIC, setCheckingPIC] = useState(true);

    // Modal states
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    const [emergencyReason, setEmergencyReason] = useState('');
    const [showPiketModal, setShowPiketModal] = useState(false);
    const [piketTeachers, setPiketTeachers] = useState([]);
    const [loadingPiket, setLoadingPiket] = useState(false);

    // Active visits state - to prevent double visits
    const [activeVisits, setActiveVisits] = useState({});
    const [visitingClass, setVisitingClass] = useState(null); // Currently claiming visit

    const userEmail = user?.email;
    const userName = user?.displayName || userEmail;

    const [sessionDate, setSessionDate] = useState(getLocalDateString());

    useEffect(() => {
        checkPICSession();
        loadActivePICs();
    }, [userEmail]);

    // Auto-check for date change every minute (session expiry)
    useEffect(() => {
        const checkDateChange = () => {
            const today = getLocalDateString();
            if (today !== sessionDate) {
                console.log('Date changed, session expired. Redirecting to PIC selector...');
                setSessionDate(today);
                setCurrentPIC(null);
                setShowPICSelector(true);
                loadActivePICs();
            }
        };

        // Check every minute
        const interval = setInterval(checkDateChange, 60000);

        // Also check immediately on mount
        checkDateChange();

        return () => clearInterval(interval);
    }, [sessionDate]);

    // Load and subscribe to active visits (real-time)
    useEffect(() => {
        const today = getLocalDateString();

        // Load initial active visits
        const loadActiveVisits = async () => {
            const { data: visits, error } = await supabase
                .from('active_visits')
                .select('*')
                .eq('visit_date', today)
                .eq('is_active', true);

            if (!error && visits) {
                const visitsMap = {};
                visits.forEach(v => {
                    visitsMap[v.live_class_id] = {
                        pic_number: v.pic_number,
                        pic_name: v.pic_name,
                        visited_at: v.visited_at
                    };
                });
                setActiveVisits(visitsMap);
            }
        };

        loadActiveVisits();

        // Subscribe to real-time changes
        const subscription = supabase
            .channel('active_visits_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'active_visits',
                filter: `visit_date=eq.${today}`
            }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const visit = payload.new;
                    if (visit.is_active) {
                        setActiveVisits(prev => ({
                            ...prev,
                            [visit.live_class_id]: {
                                pic_number: visit.pic_number,
                                pic_name: visit.pic_name,
                                visited_at: visit.visited_at
                            }
                        }));
                    } else {
                        // Visit ended
                        setActiveVisits(prev => {
                            const updated = { ...prev };
                            delete updated[visit.live_class_id];
                            return updated;
                        });
                    }
                } else if (payload.eventType === 'DELETE') {
                    const visit = payload.old;
                    setActiveVisits(prev => {
                        const updated = { ...prev };
                        delete updated[visit.live_class_id];
                        return updated;
                    });
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const checkPICSession = async () => {
        if (!userEmail) return;

        setCheckingPIC(true);
        try {
            const today = getLocalDateString();

            const { data: session, error } = await supabase
                .from('pic_sessions')
                .select('*')
                .eq('user_email', userEmail)
                .eq('session_date', today)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error checking PIC session:', error);
            }

            if (session) {
                setCurrentPIC(session.pic_number);
                setShowPICSelector(false);
            } else {
                setShowPICSelector(true);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setCheckingPIC(false);
        }
    };

    const loadActivePICs = async () => {
        try {
            const today = getLocalDateString();

            const { data: sessions, error } = await supabase
                .from('pic_sessions')
                .select('*')
                .eq('session_date', today)
                .order('pic_number', { ascending: true });

            if (error) {
                console.error('Error loading active PICs:', error);
                return;
            }

            setActivePICs(sessions || []);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handlePICSelect = async (picNumber) => {
        if (!userEmail) return;

        try {
            const today = getLocalDateString();

            const { error } = await supabase
                .from('pic_sessions')
                .upsert({
                    user_email: userEmail,
                    user_name: user?.displayName || userEmail,
                    pic_number: picNumber,
                    session_date: today,
                    joined_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_email,session_date'
                });

            if (error) {
                console.error('Error saving PIC session:', error);
                return;
            }

            setCurrentPIC(picNumber);
            setShowPICSelector(false);
            loadActivePICs();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleEndPICSession = async () => {
        if (!userEmail) return;
        if (!window.confirm('Apakah Anda yakin ingin mengakhiri sesi PIC?')) return;

        try {
            const today = getLocalDateString();

            const { error } = await supabase
                .from('pic_sessions')
                .delete()
                .eq('user_email', userEmail)
                .eq('session_date', today);

            if (error) {
                console.error('Error ending PIC session:', error);
                alert('Gagal mengakhiri sesi. Silakan coba lagi.');
                return;
            }

            setCurrentPIC(null);
            setShowPICSelector(true);
            loadActivePICs();
        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan. Silakan coba lagi.');
        }
    };

    // Ref to store emergency map for preserving emergency status during simulation
    const emergencyMapRef = useRef({});

    useEffect(() => {
        const loadDataWithEmergencies = async () => {
            setLoading(true);
            try {
                // Fetch pending emergencies from database
                const { data: emergencies, error } = await supabase
                    .from('emergency_replacements')
                    .select('live_class_id, reason, requested_by_name, created_at')
                    .eq('status', 'pending');

                // Create a map of emergency class IDs
                const emergencyMap = {};
                if (!error && emergencies) {
                    emergencies.forEach(e => {
                        emergencyMap[e.live_class_id] = {
                            reason: e.reason,
                            requested_by: e.requested_by_name,
                            requested_at: e.created_at
                        };
                    });
                }
                emergencyMapRef.current = emergencyMap;

                // Generate initial data with emergency status
                const initialData = generateInitialData().map(item => {
                    const emergency = emergencyMap[item.live_class_id];
                    if (emergency) {
                        return {
                            ...item,
                            need_replacement: true,
                            replacement_reason: emergency.reason,
                            replacement_requested_by: emergency.requested_by,
                            replacement_requested_at: emergency.requested_at
                        };
                    }
                    return item;
                });

                setData(initialData);
            } catch (err) {
                console.error('Error:', err);
                setData(generateInitialData());
            } finally {
                setLoading(false);
                setLastRefresh(new Date());
            }
        };

        loadDataWithEmergencies();

        // Dynamic simulation: update statuses every 3 seconds for demo
        const simulationInterval = setInterval(() => {
            setData(prevData => {
                // Simulate status changes
                const simulatedData = simulateStatusChange(prevData);

                // Preserve emergency status from database
                return simulatedData.map(item => {
                    const emergency = emergencyMapRef.current[item.live_class_id];
                    if (emergency) {
                        return {
                            ...item,
                            need_replacement: true,
                            replacement_reason: emergency.reason,
                            replacement_requested_by: emergency.requested_by,
                            replacement_requested_at: emergency.requested_at
                        };
                    }
                    return item;
                });
            });
            setLastRefresh(new Date());
        }, 3000);

        return () => clearInterval(simulationInterval);
    }, []);

    const filteredData = useMemo(() => {
        if (activeTab === 'need_replacement') {
            return data.filter(item => item.need_replacement);
        }
        return data.filter(item => item.status === activeTab && !item.need_replacement);
    }, [data, activeTab]);

    const statusCounts = useMemo(() => {
        const counts = {};
        TABS.forEach(tab => {
            if (tab.key === 'need_replacement') {
                counts[tab.key] = data.filter(item => item.need_replacement).length;
            } else {
                counts[tab.key] = data.filter(item => item.status === tab.key && !item.need_replacement).length;
            }
        });
        return counts;
    }, [data]);

    // Calculate duration for stuck detection
    const getDuration = (timestamp) => {
        if (!timestamp) return '-';
        const diff = new Date() - new Date(timestamp);
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    };

    const isStuck = (item) => {
        if (item.status !== 'joining' || !item.joining_time) return false;
        const diff = new Date() - new Date(item.joining_time);
        return diff > 5 * 60 * 1000; // > 5 minutes
    };

    const formatTime = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    // Check if action buttons should be shown
    const shouldShowActions = (item) => {
        return item.status === 'not_started' ||
            item.status === 'left' ||
            isStuck(item);
    };

    // Check if a class is being visited by another PIC
    const getActiveVisit = (liveClassId) => {
        return activeVisits[liveClassId] || null;
    };

    // Check if current user is the one visiting
    const isMyVisit = (liveClassId) => {
        const visit = activeVisits[liveClassId];
        return visit && visit.pic_number === currentPIC;
    };

    const handleVisitClass = async (item) => {
        // Check if already being visited by another PIC
        const existingVisit = getActiveVisit(item.live_class_id);
        if (existingVisit && existingVisit.pic_number !== currentPIC) {
            alert(`Kelas ini sedang dikunjungi oleh PIC ${existingVisit.pic_number} (${existingVisit.pic_name})`);
            return;
        }

        // Set loading state for this specific class
        setVisitingClass(item.live_class_id);

        try {
            const today = getLocalDateString();
            const visitReason = item.status === 'not_started' ? 'class_not_started' :
                isStuck(item) ? 'stuck_join' : 'teacher_left';

            // Try to claim the visit (race condition prevention)
            // Using upsert with unique constraint on (live_class_id, visit_date, is_active)
            const { data: claimResult, error: claimError } = await supabase
                .from('active_visits')
                .upsert({
                    live_class_id: item.live_class_id,
                    visit_date: today,
                    pic_number: currentPIC,
                    pic_name: userName,
                    pic_email: userEmail,
                    slot_name: item.slot_name,
                    teacher_name: item.teacher_name,
                    visit_reason: visitReason,
                    visited_at: new Date().toISOString(),
                    is_active: true
                }, {
                    onConflict: 'live_class_id,visit_date',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            // Check if we successfully claimed (or if someone else claimed first)
            if (claimError) {
                // Check who has the claim
                const { data: currentClaim } = await supabase
                    .from('active_visits')
                    .select('*')
                    .eq('live_class_id', item.live_class_id)
                    .eq('visit_date', today)
                    .eq('is_active', true)
                    .single();

                if (currentClaim && currentClaim.pic_number !== currentPIC) {
                    alert(`Kelas ini sudah diklaim oleh PIC ${currentClaim.pic_number} (${currentClaim.pic_name})`);
                    setVisitingClass(null);
                    return;
                }
            }

            // If we got here, we successfully claimed or already own the claim
            // Update local state immediately
            setActiveVisits(prev => ({
                ...prev,
                [item.live_class_id]: {
                    pic_number: currentPIC,
                    pic_name: userName,
                    visited_at: new Date().toISOString()
                }
            }));

            // Log to class_visits for history
            await supabase
                .from('class_visits')
                .insert({
                    live_class_id: item.live_class_id,
                    slot_name: item.slot_name,
                    session_topic: item.session_topic,
                    teacher_name: item.teacher_name,
                    teacher_email: item.teacher_email,
                    visited_by_email: userEmail,
                    visited_by_name: userName,
                    pic_number: currentPIC,
                    visit_reason: visitReason,
                    zoom_link: item.zoom_link,
                });

            // Open Zoom link in new tab
            window.open(item.zoom_link, '_blank');

        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setVisitingClass(null);
        }
    };

    // End visit - release the claim
    const handleEndVisit = async (liveClassId) => {
        try {
            const today = getLocalDateString();

            await supabase
                .from('active_visits')
                .update({ is_active: false, ended_at: new Date().toISOString() })
                .eq('live_class_id', liveClassId)
                .eq('visit_date', today)
                .eq('pic_number', currentPIC);

            // Update local state
            setActiveVisits(prev => {
                const updated = { ...prev };
                delete updated[liveClassId];
                return updated;
            });

        } catch (error) {
            console.error('Error ending visit:', error);
        }
    };

    const handleEmergencyClick = (item) => {
        setSelectedClass(item);
        setEmergencyReason('');
        setShowEmergencyModal(true);
    };

    const handleEmergencySubmit = async () => {
        if (!selectedClass || !emergencyReason.trim()) return;
        try {
            const { error } = await supabase
                .from('emergency_replacements')
                .insert({
                    live_class_id: selectedClass.live_class_id,
                    slot_name: selectedClass.slot_name,
                    session_topic: selectedClass.session_topic,
                    class_subject: selectedClass.class_subject,
                    class_grade: selectedClass.class_grade,
                    class_start_time: selectedClass.class_start_time,
                    class_end_time: selectedClass.class_end_time,
                    class_time: selectedClass.class_time,
                    teacher_name: selectedClass.teacher_name,
                    teacher_email: selectedClass.teacher_email,
                    teacher_phone: selectedClass.teacher_phone,
                    reason: emergencyReason,
                    requested_by_email: userEmail,
                    requested_by_name: userName,
                    pic_number: currentPIC,
                    status: 'pending',
                    zoom_link: selectedClass.zoom_link,
                });

            if (error) {
                console.error('Error logging emergency:', error);
                alert('Gagal menyimpan data emergency. Silakan coba lagi.');
                return;
            }

            // Update emergencyMapRef to preserve status during simulation
            emergencyMapRef.current[selectedClass.live_class_id] = {
                reason: emergencyReason,
                requested_by: userName,
                requested_at: new Date().toISOString()
            };

            // Update local data to mark as need_replacement
            setData(prevData => prevData.map(item =>
                item.id === selectedClass.id
                    ? {
                        ...item,
                        need_replacement: true,
                        replacement_reason: emergencyReason,
                        replacement_requested_at: new Date().toISOString(),
                        replacement_requested_by: userName,
                    }
                    : item
            ));

            setShowEmergencyModal(false);
            setSelectedClass(null);
            setEmergencyReason('');

            setActiveTab('need_replacement');

        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan. Silakan coba lagi.');
        }
    };

    const handleViewPiketTeachers = async (item) => {
        setSelectedClass(item);
        setLoadingPiket(true);
        setShowPiketModal(true);

        try {
            const today = new Date(2026, 2, 30);
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const currentDay = days[today.getDay()];

            // Get current time in HH:MM format
            const currentHour = today.getHours();
            const classStartHour = new Date(item.class_start_time).getHours();
            const { data: piketData, error } = await supabase
                .from('piket_schedule')
                .select('*')
                .eq('grade', item.class_grade)
                .eq('subject', item.class_subject)
                .eq('time', item.class_time)
                .eq('day', currentDay)
                .order('time', { ascending: true });

            if (error) {
                console.error('Error loading piket teachers:', error);
                setPiketTeachers([]);
            } else {
                setPiketTeachers(piketData || []);
            }
        } catch (error) {
            console.error('Error:', error);
            setPiketTeachers([]);
        } finally {
            setLoadingPiket(false);
        }
    };

    // Resolve emergency (mark as resolved)
    const handleResolveEmergency = async (item) => {
        if (!window.confirm('Apakah Anda yakin kelas ini sudah ditangani?')) return;

        try {
            // Update emergency status in database
            const { error } = await supabase
                .from('emergency_replacements')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString(),
                    resolved_by_email: userEmail,
                    resolved_by_name: userName,
                })
                .eq('live_class_id', item.live_class_id)
                .eq('status', 'pending');

            if (error) {
                console.error('Error resolving emergency:', error);
            }

            // Remove from emergencyMapRef
            delete emergencyMapRef.current[item.live_class_id];

            // Update local data
            setData(prevData => prevData.map(d =>
                d.id === item.id
                    ? { ...d, need_replacement: false, replacement_reason: null, replacement_requested_by: null, replacement_requested_at: null }
                    : d
            ));

        } catch (error) {
            console.error('Error:', error);
        }
    };

    if (checkingPIC) {
        return (
            <div className="tm-page">
                <Navbar userEmail={user} onLogoutClick={onLogout} />
                <div className="tm-loading">
                    <div className="tm-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (showPICSelector) {
        return (
            <div className="tm-page">
                <Navbar userEmail={user} onLogoutClick={onLogout} />
                <PICSelector
                    onSelect={handlePICSelect}
                    userEmail={userEmail}
                    activePICs={activePICs}
                />
            </div>
        );
    }

    return (
        <div className="tm-page">
            <Navbar userEmail={user} onLogoutClick={onLogout} />

            <div className="tm-container">
                {/* Header */}
                <div className="tm-header">
                    <div className="tm-header-left">
                        <h1>Teacher Monitoring</h1>
                        <div className="tm-pic-info">
                            <span className="tm-pic-badge">PIC {currentPIC}</span>
                            <button
                                className="tm-end-session-btn"
                                onClick={handleEndPICSession}
                                title="Akhiri Sesi PIC"
                            >
                                <LogOut size={14} />
                                Akhiri Sesi
                            </button>
                        </div>
                    </div>
                    <div className="tm-header-right">
                        <div className="tm-active-pics">
                            <span className="tm-active-pics-label">Active PICs:</span>
                            {activePICs.map(pic => (
                                <span
                                    key={pic.id}
                                    className={`tm-pic-chip ${pic.user_email === userEmail ? 'current' : ''}`}
                                    title={pic.user_name || pic.user_email}
                                >
                                    PIC {pic.pic_number}
                                </span>
                            ))}
                        </div>
                        <div className="tm-refresh-info">
                            Last update: {lastRefresh.toLocaleTimeString('id-ID')}
                            {loading && <span className="tm-refreshing"> (refreshing...)</span>}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tm-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`tm-tab ${activeTab === tab.key ? 'active' : ''} ${tab.key === 'need_replacement' ? 'emergency' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                '--tab-color': tab.color,
                                '--tab-bg': tab.bgColor,
                            }}
                        >
                            {tab.icon && <span className="tm-tab-icon">{tab.icon}</span>}
                            {tab.label}
                            <span className="tm-tab-badge">{statusCounts[tab.key]}</span>
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="tm-table-container">
                    <table className="tm-table">
                        <thead>
                            <tr>
                                <th>Teacher Name</th>
                                <th>Phone</th>
                                <th>Grade</th>
                                <th>Slot Name</th>
                                <th>Class Time</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th>Last Update</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="tm-empty">
                                        {activeTab === 'need_replacement'
                                            ? 'Tidak ada kelas yang membutuhkan pengganti'
                                            : `No teachers with status "${TABS.find(t => t.key === activeTab)?.label}"`
                                        }
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map(item => (
                                    <tr key={item.id} className={`${isStuck(item) ? 'stuck' : ''} ${item.need_replacement ? 'need-replacement' : ''}`}>
                                        <td>
                                            <div className="tm-teacher-info">
                                                <span className="tm-teacher-name">{item.teacher_name}</span>
                                                <span className="tm-teacher-email">{item.teacher_email}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <a href={`tel:${item.teacher_phone}`} className="tm-phone">
                                                {item.teacher_phone}
                                            </a>
                                        </td>
                                        <td className="tm-grade">
                                            <span className="tm-grade-badge">{item.class_grade}</span>
                                        </td>
                                        <td className="tm-slot">
                                            <div className="tm-slot-info">
                                                <span className="tm-slot-name">{item.slot_name}</span>
                                                <span className="tm-session-topic">{item.session_topic}</span>
                                            </div>
                                            {item.need_replacement && item.replacement_reason && (
                                                <div className="tm-replacement-reason">
                                                    <AlertTriangle size={12} />
                                                    {item.replacement_reason}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {formatTime(item.class_start_time)} - {formatTime(item.class_end_time)}
                                        </td>
                                        <td>
                                            <span
                                                className={`tm-status-badge ${item.status} ${isStuck(item) ? 'stuck' : ''} ${item.need_replacement ? 'replacement' : ''}`}
                                            >
                                                {item.need_replacement
                                                    ? 'Need Replacement'
                                                    : isStuck(item)
                                                        ? 'Stuck Join'
                                                        : item.status.replace('_', ' ')
                                                }
                                            </span>
                                        </td>
                                        <td>
                                            {item.status === 'not_started'
                                                ? getDuration(item.class_start_time)
                                                : getDuration(item.joining_time)
                                            }
                                        </td>
                                        <td className="tm-last-update">
                                            {formatTime(lastRefresh.toISOString())}
                                        </td>
                                        <td>
                                            <div className="tm-actions">
                                                {/* Check if class is being visited */}
                                                {(() => {
                                                    const activeVisit = getActiveVisit(item.live_class_id);
                                                    const isVisitedByMe = isMyVisit(item.live_class_id);
                                                    const isVisitedByOther = activeVisit && !isVisitedByMe;
                                                    const isClaimingThis = visitingClass === item.live_class_id;

                                                    // Show "being visited" indicator
                                                    if (isVisitedByOther) {
                                                        return (
                                                            <div className="tm-visit-info">
                                                                <Eye size={14} />
                                                                <span>Dikunjungi PIC {activeVisit.pic_number}</span>
                                                            </div>
                                                        );
                                                    }

                                                    // Show "end visit" button if I'm visiting
                                                    if (isVisitedByMe) {
                                                        return (
                                                            <>
                                                                <span className="tm-visiting-badge">
                                                                    <Eye size={12} />
                                                                    Anda sedang mengunjungi
                                                                </span>
                                                                <button
                                                                    className="tm-action-btn end-visit"
                                                                    onClick={() => handleEndVisit(item.live_class_id)}
                                                                    title="Selesai Visit"
                                                                >
                                                                    <CheckCircle size={14} />
                                                                    Selesai
                                                                </button>
                                                                {item.need_replacement && (
                                                                    <>
                                                                        <button
                                                                            className="tm-action-btn piket"
                                                                            onClick={() => handleViewPiketTeachers(item)}
                                                                            title="View Piket Teachers"
                                                                        >
                                                                            <Users size={14} />
                                                                            Piket
                                                                        </button>
                                                                        <button
                                                                            className="tm-action-btn resolve"
                                                                            onClick={() => handleResolveEmergency(item)}
                                                                            title="Mark as Resolved"
                                                                        >
                                                                            ✓ Resolved
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </>
                                                        );
                                                    }

                                                    // Normal actions
                                                    if (item.need_replacement) {
                                                        return (
                                                            <>
                                                                <button
                                                                    className="tm-action-btn visit"
                                                                    onClick={() => handleVisitClass(item)}
                                                                    disabled={isClaimingThis}
                                                                    title="Visit Class"
                                                                >
                                                                    {isClaimingThis ? <Loader size={14} className="spinning" /> : <ExternalLink size={14} />}
                                                                    {isClaimingThis ? 'Claiming...' : 'Visit'}
                                                                </button>
                                                                <button
                                                                    className="tm-action-btn piket"
                                                                    onClick={() => handleViewPiketTeachers(item)}
                                                                    title="View Piket Teachers"
                                                                >
                                                                    <Users size={14} />
                                                                    Piket
                                                                </button>
                                                                <button
                                                                    className="tm-action-btn resolve"
                                                                    onClick={() => handleResolveEmergency(item)}
                                                                    title="Mark as Resolved"
                                                                >
                                                                    ✓ Resolved
                                                                </button>
                                                            </>
                                                        );
                                                    } else if (shouldShowActions(item)) {
                                                        return (
                                                            <>
                                                                <button
                                                                    className="tm-action-btn visit"
                                                                    onClick={() => handleVisitClass(item)}
                                                                    disabled={isClaimingThis}
                                                                    title="Visit Class"
                                                                >
                                                                    {isClaimingThis ? <Loader size={14} className="spinning" /> : <ExternalLink size={14} />}
                                                                    {isClaimingThis ? 'Claiming...' : 'Visit'}
                                                                </button>
                                                                <button
                                                                    className="tm-action-btn emergency"
                                                                    onClick={() => handleEmergencyClick(item)}
                                                                    title="Request Replacement"
                                                                >
                                                                    <AlertTriangle size={14} />
                                                                    Emergency
                                                                </button>
                                                            </>
                                                        );
                                                    } else {
                                                        return <span className="tm-no-action">-</span>;
                                                    }
                                                })()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer info */}
                <div className="tm-footer">
                    <p className="tm-note">
                        <strong>Jangan terkejut</strong>. Cuma data dummy yummy Mr DIY jangan lupa bersyukur ini. Mas Anthony dkk lagi sibuk.
                    </p>
                </div>
            </div>

            {/* Emergency Modal */}
            {showEmergencyModal && selectedClass && (
                <div className="tm-modal-overlay" onClick={() => setShowEmergencyModal(false)}>
                    <div className="tm-modal" onClick={e => e.stopPropagation()}>
                        <div className="tm-modal-header">
                            <h3>
                                <AlertTriangle size={20} />
                                Request Replacement
                            </h3>
                            <button className="tm-modal-close" onClick={() => setShowEmergencyModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="tm-modal-body">
                            <div className="tm-modal-info">
                                <p><strong>Teacher:</strong> {selectedClass.teacher_name}</p>
                                <p><strong>Slot:</strong> {selectedClass.slot_name} (Grade {selectedClass.class_grade})</p>
                                <p><strong>Topic:</strong> {selectedClass.session_topic}</p>
                                <p><strong>Time:</strong> {formatTime(selectedClass.class_start_time)} - {formatTime(selectedClass.class_end_time)}</p>
                            </div>
                            <div className="tm-form-group">
                                <label>Alasan Emergency *</label>
                                <textarea
                                    value={emergencyReason}
                                    onChange={(e) => setEmergencyReason(e.target.value)}
                                    placeholder="Contoh: Teacher mati lampu, tidak bisa dihubungi"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="tm-modal-footer">
                            <button
                                className="tm-btn secondary"
                                onClick={() => setShowEmergencyModal(false)}
                            >
                                Batal
                            </button>
                            <button
                                className="tm-btn primary emergency"
                                onClick={handleEmergencySubmit}
                                disabled={!emergencyReason.trim()}
                            >
                                <AlertTriangle size={16} />
                                Butuh Pengganti
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Piket Teachers Modal */}
            {showPiketModal && selectedClass && (
                <div className="tm-modal-overlay" onClick={() => setShowPiketModal(false)}>
                    <div className="tm-modal piket-modal" onClick={e => e.stopPropagation()}>
                        <div className="tm-modal-header">
                            <h3>
                                <Users size={20} />
                                Guru Piket Tersedia
                            </h3>
                            <button className="tm-modal-close" onClick={() => setShowPiketModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="tm-modal-body">
                            <div className="tm-modal-info">
                                <p><strong>Slot:</strong> {selectedClass.slot_name}</p>
                                <p><strong>Topic:</strong> {selectedClass.session_topic}</p>
                                <p><strong>Grade:</strong> {selectedClass.class_grade} | <strong>Subject:</strong> {selectedClass.class_subject}</p>
                            </div>

                            {loadingPiket ? (
                                <div className="tm-piket-loading">
                                    <div className="tm-spinner small"></div>
                                    <p>Loading piket teachers...</p>
                                </div>
                            ) : piketTeachers.length === 0 ? (
                                <div className="tm-piket-empty">
                                    <p>Tidak ada guru piket yang tersedia untuk grade {selectedClass.class_grade} - {selectedClass.class_subject} hari ini.</p>
                                </div>
                            ) : (
                                <div className="tm-piket-list">
                                    {piketTeachers.map(teacher => (
                                        <div key={teacher.id} className="tm-piket-card">
                                            <div className="tm-piket-info">
                                                <span className="tm-piket-name">{teacher.teacher_name}</span>
                                                <span className="tm-piket-time">Piket: {teacher.time}</span>
                                                {teacher.note && (
                                                    <span className="tm-piket-note">{teacher.note}</span>
                                                )}
                                            </div>
                                            <div className="tm-piket-actions">
                                                {teacher.email && (
                                                    <a
                                                        href={`mailto:${teacher.email}`}
                                                        className="tm-piket-contact email"
                                                        title={teacher.email}
                                                    >
                                                        Slack
                                                    </a>
                                                )}
                                                <a
                                                    href={`https://wa.me/62${teacher.email?.replace('@colearn.id', '') || ''}`}
                                                    className="tm-piket-contact wa"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Phone size={12} />
                                                    Contact
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="tm-modal-footer">
                            <button
                                className="tm-btn secondary"
                                onClick={() => setShowPiketModal(false)}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherMonitoring;
