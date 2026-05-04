import React, { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from './Navbar';
import PICSelector from './PICSelector';
import { supabase } from '../lib/supabaseClient.mjs';
import { ExternalLink, AlertTriangle, Users, X, Phone, LogOut, Eye, CheckCircle, Loader, MessageSquare, Pencil } from 'lucide-react';
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
    { key: 'ongoing', label: 'Ongoing Classes', color: '#16A34A', bgColor: '#DCFCE7' },
];

// Helper function to parse class time string (e.g., "16:00-17:00") to start/end Date objects
const parseClassTime = (classDate, timeString) => {
    const [startTime, endTime] = timeString.split('-');
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const start = new Date(classDate);
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date(classDate);
    end.setHours(endHour, endMin, 0, 0);

    return { start, end };
};

// Calculate teacher status from zoom events
const calculateStatusFromEvents = (scheduleId, teacherEmail, zoomEvents, classEndTime) => {
    const classEvents = zoomEvents.filter(e => e.live_class_id === scheduleId);

    // 1. Check meeting.started
    const meetingStarted = classEvents.find(e => e.event_name === 'meeting.started');
    if (!meetingStarted) {
        return { status: 'not_started', joining_time: null, rejoined_after_left: false };
    }

    // 2. Check teacher participant_joined (latest)
    const teacherJoined = classEvents
        .filter(e => e.event_name === 'meeting.participant_joined' && e.participant_email === teacherEmail)
        .sort((a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp))[0];

    // 3. Check if there was ANY left event DURING class time
    const endTime = new Date(classEndTime);
    const teacherLeftDuringClass = classEvents
        .filter(e =>
            e.event_name === 'meeting.participant_left' &&
            e.participant_email === teacherEmail &&
            new Date(e.event_timestamp) < endTime
        )
        .sort((a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp))[0];

    // 4. Determine status
    if (!teacherJoined) {
        return { status: 'joining', joining_time: meetingStarted.event_timestamp, rejoined_after_left: false };
    }

    // 5. If teacher left during class time, status = 'left' (even if they rejoined)
    if (teacherLeftDuringClass) {
        const leftTime = new Date(teacherLeftDuringClass.event_timestamp);
        const latestJoinTime = new Date(teacherJoined.event_timestamp);

        // Check if teacher rejoined after leaving (latest join is after latest left during class)
        const rejoinedAfterLeft = latestJoinTime > leftTime;

        return {
            status: 'left',
            joining_time: teacherJoined.event_timestamp,
            rejoined_after_left: rejoinedAfterLeft
        };
    }

    return { status: 'joined', joining_time: teacherJoined.event_timestamp, rejoined_after_left: false };
};

// Load today's classes from class_schedules
const loadTodayClasses = async (supabaseClient) => {
    const today = getLocalDateString();

    // Get active semester
    const { data: semester, error: semesterError } = await supabaseClient
        .from('semesters')
        .select('id')
        .eq('is_active', true)
        .single();

    if (semesterError || !semester) {
        console.error('Error loading active semester:', semesterError);
        return [];
    }

    // Load classes for today
    const { data: classes, error: classError } = await supabaseClient
        .from('class_schedules')
        .select(`
            schedule_id,
            teacher_name,
            teacher_email,
            slot_name,
            subject,
            grade,
            time,
            class_date
        `)
        .eq('class_date', today)
        .eq('semester_id', semester.id)
        .eq('is_available', true);

    if (classError) {
        console.error('Error loading classes:', classError);
        return [];
    }

    if (!classes || classes.length === 0) {
        return [];
    }

    // Load session_topic from raw_sessions
    const scheduleIds = classes.map(c => c.schedule_id);
    const { data: sessions } = await supabaseClient
        .from('raw_sessions')
        .select('session_id, session_topic')
        .in('session_id', scheduleIds);

    // Load teacher phones from user_emails (if available)
    const teacherEmails = [...new Set(classes.map(c => c.teacher_email).filter(Boolean))];
    let phonesMap = {};
    if (teacherEmails.length > 0) {
        const { data: phones } = await supabaseClient
            .from('user_emails')
            .select('email, phone')
            .in('email', teacherEmails);
        if (phones) {
            phonesMap = Object.fromEntries(phones.filter(p => p.phone).map(p => [p.email, p.phone]));
        }
    }

    // Create lookup maps
    const sessionsMap = sessions ? Object.fromEntries(sessions.map(s => [s.session_id, s.session_topic])) : {};

    // Map to UI format
    return classes.map(cls => {
        const { start, end } = parseClassTime(cls.class_date, cls.time);
        return {
            ...cls,
            session_topic: sessionsMap[cls.schedule_id] || cls.slot_name,
            teacher_phone: phonesMap[cls.teacher_email] || null,
            zoom_link: `https://zoom.us/j/${cls.schedule_id}`, // Dummy link for now
            class_start_time: start.toISOString(),
            class_end_time: end.toISOString(),
        };
    });
};

// Load zoom events for given schedule IDs
const loadZoomEvents = async (supabaseClient, scheduleIds) => {
    if (!scheduleIds || scheduleIds.length === 0) {
        return [];
    }

    const { data: events, error } = await supabaseClient
        .from('zoom_event_logs')
        .select('*')
        .in('live_class_id', scheduleIds)
        .order('event_timestamp', { ascending: true });

    if (error) {
        console.error('Error loading zoom events:', error);
        return [];
    }

    return events || [];
};

// Map class data to UI format with status
const mapToUIFormat = (classSchedule, status, joiningTime, rejoinedAfterLeft, emergencyMap) => {
    const emergency = emergencyMap[classSchedule.schedule_id];
    return {
        id: `class-${classSchedule.schedule_id}`,
        live_class_id: classSchedule.schedule_id,
        teacher_name: classSchedule.teacher_name,
        teacher_email: classSchedule.teacher_email,
        teacher_phone: classSchedule.teacher_phone,
        slot_name: classSchedule.slot_name,
        session_topic: classSchedule.session_topic,
        class_subject: classSchedule.subject,
        class_grade: classSchedule.grade,
        class_time: classSchedule.time,
        class_start_time: classSchedule.class_start_time,
        class_end_time: classSchedule.class_end_time,
        zoom_link: classSchedule.zoom_link,
        status: status,
        joining_time: joiningTime,
        rejoined_after_left: rejoinedAfterLeft,
        need_replacement: !!emergency,
        replacement_reason: emergency?.reason || null,
        replacement_requested_at: emergency?.requested_at || null,
        replacement_requested_by: emergency?.requested_by || null,
    };
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

    // Notes state
    const [classNotes, setClassNotes] = useState({});
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [noteText, setNoteText] = useState('');

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

    // Load and subscribe to class notes (real-time)
    useEffect(() => {
        const today = getLocalDateString();

        // Load initial notes
        const loadClassNotes = async () => {
            const { data: notes, error } = await supabase
                .from('class_notes')
                .select('*')
                .eq('note_date', today);

            if (!error && notes) {
                const notesMap = {};
                notes.forEach(n => {
                    notesMap[n.live_class_id] = {
                        note_text: n.note_text,
                        created_by_name: n.created_by_name,
                        pic_number: n.pic_number,
                        created_at: n.created_at
                    };
                });
                setClassNotes(notesMap);
            }
        };

        loadClassNotes();

        // Subscribe to real-time changes
        const subscription = supabase
            .channel('class_notes_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'class_notes',
                filter: `note_date=eq.${today}`
            }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const note = payload.new;
                    setClassNotes(prev => ({
                        ...prev,
                        [note.live_class_id]: {
                            note_text: note.note_text,
                            created_by_name: note.created_by_name,
                            pic_number: note.pic_number,
                            created_at: note.created_at
                        }
                    }));
                } else if (payload.eventType === 'DELETE') {
                    const note = payload.old;
                    setClassNotes(prev => {
                        const updated = { ...prev };
                        delete updated[note.live_class_id];
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

    // Ref to store emergency map for preserving emergency status
    const emergencyMapRef = useRef({});
    // Ref to store classes data for zoom event updates
    const classesRef = useRef([]);
    // Ref to store zoom events
    const zoomEventsRef = useRef([]);

    // Function to recalculate all statuses from current zoom events
    const recalculateStatuses = (classes, zoomEvents, emergencyMap) => {
        return classes.map(cls => {
            const { status, joining_time, rejoined_after_left } = calculateStatusFromEvents(
                cls.schedule_id,
                cls.teacher_email,
                zoomEvents,
                cls.class_end_time
            );
            return mapToUIFormat(cls, status, joining_time, rejoined_after_left, emergencyMap);
        });
    };

    // Load real data from database
    useEffect(() => {
        const loadRealData = async () => {
            setLoading(true);
            try {
                // 1. Load today's classes
                const classes = await loadTodayClasses(supabase);
                classesRef.current = classes;

                if (classes.length === 0) {
                    setData([]);
                    setLoading(false);
                    setLastRefresh(new Date());
                    return;
                }

                // 2. Fetch pending emergencies
                const { data: emergencies, error: emergencyError } = await supabase
                    .from('emergency_replacements')
                    .select('live_class_id, reason, requested_by_name, created_at')
                    .eq('status', 'pending');

                const emergencyMap = {};
                if (!emergencyError && emergencies) {
                    emergencies.forEach(e => {
                        emergencyMap[e.live_class_id] = {
                            reason: e.reason,
                            requested_by: e.requested_by_name,
                            requested_at: e.created_at
                        };
                    });
                }
                emergencyMapRef.current = emergencyMap;

                // 3. Load zoom events for today's classes
                const scheduleIds = classes.map(c => c.schedule_id);
                const zoomEvents = await loadZoomEvents(supabase, scheduleIds);
                zoomEventsRef.current = zoomEvents;

                // 4. Calculate statuses and map to UI format
                const dataWithStatuses = recalculateStatuses(classes, zoomEvents, emergencyMap);
                setData(dataWithStatuses);

            } catch (err) {
                console.error('Error loading real data:', err);
                setData([]);
            } finally {
                setLoading(false);
                setLastRefresh(new Date());
            }
        };

        loadRealData();
    }, []);

    // Real-time subscription to zoom_event_logs
    useEffect(() => {
        const subscription = supabase
            .channel('zoom_events_live')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'zoom_event_logs',
            }, (payload) => {
                console.log('Zoom event received:', payload);
                const newEvent = payload.new;

                // Check if this event is for one of our classes
                const scheduleIds = classesRef.current.map(c => c.schedule_id);
                if (!scheduleIds.includes(newEvent.live_class_id)) {
                    return; // Not for our classes
                }

                // Add new event to our events list
                zoomEventsRef.current = [...zoomEventsRef.current, newEvent];

                // Recalculate statuses
                const updatedData = recalculateStatuses(
                    classesRef.current,
                    zoomEventsRef.current,
                    emergencyMapRef.current
                );
                setData(updatedData);
                setLastRefresh(new Date());
            })
            .subscribe((status) => {
                console.log('Zoom subscription status:', status);
            });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Polling - refresh zoom events every 5 seconds
    useEffect(() => {
        const refreshZoomEvents = async () => {
            if (classesRef.current.length === 0) {
                setLastRefresh(new Date());
                return;
            }

            try {
                const scheduleIds = classesRef.current.map(c => c.schedule_id);
                const zoomEvents = await loadZoomEvents(supabase, scheduleIds);
                zoomEventsRef.current = zoomEvents;

                const updatedData = recalculateStatuses(
                    classesRef.current,
                    zoomEvents,
                    emergencyMapRef.current
                );
                setData(updatedData);
            } catch (err) {
                console.error('Error refreshing zoom events:', err);
            }

            setLastRefresh(new Date());
        };

        // Poll every 5 seconds
        const pollInterval = setInterval(refreshZoomEvents, 5000);

        return () => clearInterval(pollInterval);
    }, []);

    // Filter out classes that ended more than 15 minutes ago
    const activeData = useMemo(() => {
        const now = new Date();
        const fifteenMinutes = 15 * 60 * 1000;

        return data.filter(item => {
            const endTime = new Date(item.class_end_time);
            const timeSinceEnd = now - endTime;

            // Keep classes that haven't ended yet OR ended less than 15 minutes ago
            return timeSinceEnd <= fifteenMinutes;
        });
    }, [data, lastRefresh]); // lastRefresh ensures recalculation every poll

    const filteredData = useMemo(() => {
        if (activeTab === 'need_replacement') {
            return activeData.filter(item => item.need_replacement);
        }
        // "ongoing" tab includes: joined, joining (including stuck join)
        if (activeTab === 'ongoing') {
            return activeData.filter(item =>
                (item.status === 'joined' || item.status === 'joining') && !item.need_replacement
            );
        }
        return activeData.filter(item => item.status === activeTab && !item.need_replacement);
    }, [activeData, activeTab]);

    const statusCounts = useMemo(() => {
        const counts = {};
        TABS.forEach(tab => {
            if (tab.key === 'need_replacement') {
                counts[tab.key] = activeData.filter(item => item.need_replacement).length;
            } else if (tab.key === 'ongoing') {
                // Count joined + joining (including stuck join)
                counts[tab.key] = activeData.filter(item =>
                    (item.status === 'joined' || item.status === 'joining') && !item.need_replacement
                ).length;
            } else {
                counts[tab.key] = activeData.filter(item => item.status === tab.key && !item.need_replacement).length;
            }
        });
        return counts;
    }, [activeData]);

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

    // Check if class is urgent (within 5 minutes of start time or past it, but not started)
    const isUrgentNotStarted = (item) => {
        if (item.status !== 'not_started') return false;
        const now = new Date();
        const startTime = new Date(item.class_start_time);
        const fiveMinutesBefore = new Date(startTime.getTime() - 5 * 60 * 1000);
        return now >= fiveMinutesBefore; // Current time is within 5 min of start or past it
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

    // Notes functions
    const handleNotesClick = (item) => {
        setSelectedClass(item);
        setNoteText(classNotes[item.live_class_id]?.note_text || '');
        setShowNotesModal(true);
    };

    const handleNotesSubmit = async () => {
        if (!selectedClass) return;

        try {
            const today = getLocalDateString();

            const { error } = await supabase
                .from('class_notes')
                .upsert({
                    live_class_id: selectedClass.live_class_id,
                    note_date: today,
                    note_text: noteText.trim(),
                    created_by_email: userEmail,
                    created_by_name: userName,
                    pic_number: currentPIC,
                    created_at: new Date().toISOString(),
                }, {
                    onConflict: 'live_class_id,note_date'
                });

            if (error) {
                console.error('Error saving note:', error);
                alert('Gagal menyimpan catatan. Silakan coba lagi.');
                return;
            }

            // Update local state
            if (noteText.trim()) {
                setClassNotes(prev => ({
                    ...prev,
                    [selectedClass.live_class_id]: {
                        note_text: noteText.trim(),
                        created_by_name: userName,
                        pic_number: currentPIC,
                        created_at: new Date().toISOString()
                    }
                }));
            } else {
                // If note is empty, remove it
                setClassNotes(prev => {
                    const updated = { ...prev };
                    delete updated[selectedClass.live_class_id];
                    return updated;
                });
            }

            setShowNotesModal(false);
            setSelectedClass(null);
            setNoteText('');

        } catch (error) {
            console.error('Error:', error);
            alert('Terjadi kesalahan. Silakan coba lagi.');
        }
    };

    // Get note for a class
    const getClassNote = (liveClassId) => {
        return classNotes[liveClassId] || null;
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
                                    <tr key={item.id} className={`${isStuck(item) ? 'stuck' : ''} ${item.need_replacement ? 'need-replacement' : ''} ${isUrgentNotStarted(item) ? 'urgent-not-started' : ''}`}>
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
                                            <div className="tm-status-cell">
                                                <span
                                                    className={`tm-status-badge ${item.status} ${isStuck(item) ? 'stuck' : ''} ${item.need_replacement ? 'replacement' : ''} ${isUrgentNotStarted(item) ? 'urgent' : ''}`}
                                                >
                                                    {item.need_replacement
                                                        ? 'Need Replacement'
                                                        : isStuck(item)
                                                            ? 'Stuck Join'
                                                            : isUrgentNotStarted(item)
                                                                ? 'Urgent - Not Started'
                                                                : item.status.replace('_', ' ')
                                                    }
                                                </span>
                                                {item.status === 'left' && (
                                                    <span className={`tm-joinback-badge ${item.rejoined_after_left ? 'yes' : 'no'}`}>
                                                        Join Back: {item.rejoined_after_left ? 'Yes' : 'Not Yet'}
                                                    </span>
                                                )}
                                            </div>
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
                                                        const note = getClassNote(item.live_class_id);
                                                        return (
                                                            <>
                                                                {/* Note display with edit - for not_started */}
                                                                {item.status === 'not_started' && (
                                                                    note ? (
                                                                        <div className="tm-note-display with-edit">
                                                                            <MessageSquare size={12} />
                                                                            <span className="tm-note-text">{note.note_text}</span>
                                                                            <button
                                                                                className="tm-note-edit-btn"
                                                                                onClick={() => handleNotesClick(item)}
                                                                                title="Edit Note"
                                                                            >
                                                                                <Pencil size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            className="tm-action-btn notes"
                                                                            onClick={() => handleNotesClick(item)}
                                                                            title="Add Note"
                                                                        >
                                                                            <MessageSquare size={14} />
                                                                            Notes
                                                                        </button>
                                                                    )
                                                                )}
                                                                {/* Note display for other statuses (left, stuck) */}
                                                                {item.status !== 'not_started' && note && (
                                                                    <div className="tm-note-display">
                                                                        <MessageSquare size={12} />
                                                                        <span className="tm-note-text">{note.note_text}</span>
                                                                        <span className="tm-note-author">- PIC {note.pic_number}</span>
                                                                    </div>
                                                                )}
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
                                                        // For joined status, show note if exists
                                                        const note = getClassNote(item.live_class_id);
                                                        if (note) {
                                                            return (
                                                                <div className="tm-note-display">
                                                                    <MessageSquare size={12} />
                                                                    <span className="tm-note-text">{note.note_text}</span>
                                                                    <span className="tm-note-author">- PIC {note.pic_number}</span>
                                                                </div>
                                                            );
                                                        }
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
                        Data kelas diambil dari <strong>class_schedules</strong> dan status dari <strong>zoom_event_logs</strong> secara real-time.
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

            {/* Notes Modal */}
            {showNotesModal && selectedClass && (
                <div className="tm-modal-overlay" onClick={() => setShowNotesModal(false)}>
                    <div className="tm-modal notes-modal" onClick={e => e.stopPropagation()}>
                        <div className="tm-modal-header">
                            <h3>
                                <MessageSquare size={20} />
                                Catatan Kelas
                            </h3>
                            <button className="tm-modal-close" onClick={() => setShowNotesModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="tm-modal-body">
                            <div className="tm-modal-info">
                                <p><strong>Teacher:</strong> {selectedClass.teacher_name}</p>
                                <p><strong>Slot:</strong> {selectedClass.slot_name} (Grade {selectedClass.class_grade})</p>
                                <p><strong>Time:</strong> {formatTime(selectedClass.class_start_time)} - {formatTime(selectedClass.class_end_time)}</p>
                            </div>
                            <div className="tm-form-group">
                                <label>Catatan untuk PIC lain</label>
                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder="Contoh: Sudah dihubungi via WA, menunggu respon..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="tm-modal-footer">
                            <button
                                className="tm-btn secondary"
                                onClick={() => setShowNotesModal(false)}
                            >
                                Batal
                            </button>
                            <button
                                className="tm-btn primary notes"
                                onClick={handleNotesSubmit}
                            >
                                <MessageSquare size={16} />
                                Simpan Catatan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherMonitoring;
