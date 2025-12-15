import React, { useState, useEffect, useMemo, use } from 'react';
import Navbar from './Navbar';
import { supabase } from '../lib/supabaseClient.mjs';
import '../styles/IndividualSchedule.css';

const IndividualSchedule = ({ user, onLogout }) => {
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [selectedRole, setSelectedRole] = useState('Teacher');
    const [scheduleData, setScheduleData] = useState([]);
    const [allScheduleData, setAllScheduleData] = useState([]);
    const [piketData, setPiketData] = useState([]);
    const [avatarData, setAvatarData] = useState({});
    const [loading, setLoading] = useState(true);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [error, setError] = useState(null);
    const [isUserRegistered, setIsUserRegistered] = useState(false);
    const [selectedTeachers, setSelectedTeachers] = useState([]);
    const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
    const [nonMandatoryAssignments, setNonMandatoryAssignments] = useState([]);
    const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

    const specialUser = 'annisa.nugraha@colearn.id';
    const userEmail = user?.email; //add dynamic user email

    const generateWeekDates = (date) => {
        const week = [];
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - ((day + 6) % 7);
        startOfWeek.setDate(diff);

        for (let i = 0; i < 6; i++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + i);
            week.push(currentDate);
        }
        return week;
    };

    const formatDateWithSuffix = (date) => {
        const day = date.getDate();
        const suffix = day % 10 === 1 && day !== 11 ? 'st' :
            day % 10 === 2 && day !== 12 ? 'nd' :
                day % 10 === 3 && day !== 13 ? 'rd' : 'th';
        return `${day}${suffix}`;
    };

    const formatTime = (timeRange) => {
        return timeRange.split('-')[0];
    };

    const formatMonthYear = (date) => {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const getBackgroundColor = (level, subject, isPiket = false, isNonMandatory = false) => {
        if (isPiket) return '#B67CFF';
        if (isNonMandatory) return '#5B9BD5'; // Distinct blue for Non Mandatory
        if (level === 'SD') return '#F86077';
        if (level === 'SMP') return '#75ABFB';
        if (level === 'SMA') {
            if (subject === 'Matematika') return '#00CB88';
            if (subject === 'Fisika') return '#FF8D9E';
            if (subject === 'Kimia') return '#F49B26';
        }
        if (subject === 'IPA') return '#FF8D9E'
        return '#75ABFB';
    };

    const getWeekDateRange = (date) => {
        const startDate = new Date(date);
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 5);

        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
    };

    const checkUserRegistration = async () => {
        try {

            if (userEmail === specialUser) {
                setIsUserRegistered(true);
                return true;
            }
            const { data: userSchedules, error: checkError } = await supabase
                .from('class_schedules')
                .select('teacher_email, mentor_email')
                .or(`teacher_email.eq.${userEmail},mentor_email.eq.${userEmail}`)
                .limit(1);

            if (checkError) throw checkError;

            const isRegistered = userSchedules && userSchedules.length > 0;
            setIsUserRegistered(isRegistered);

            return isRegistered;
        } catch (error) {
            console.error('Error checking user registration:', error);
            setIsUserRegistered(false);
            return false;
        }
    };

    const fetchScheduleData = async () => {
        try {
            setLoading(true);
            setError(null);

            const weekRange = getWeekDateRange(currentWeek);
            const isRegistered = await checkUserRegistration();

            const { data: allSchedules, error: allScheduleError } = await supabase
                .from('class_schedules')
                .select('*')
                .gte('period_week', weekRange.start)
                .lte('period_week', weekRange.end);

            if (allScheduleError) throw allScheduleError;
            setAllScheduleData(allSchedules || []);

            let userSchedules = [];

            if (isRegistered) {
                userSchedules = allSchedules?.filter(schedule =>
                    schedule.teacher_email === userEmail || schedule.mentor_email === userEmail
                ) || [];

                if (userEmail === specialUser) {
                    userSchedules = allSchedules || [];
                }

                const currentUserAsTeacher = userSchedules.find(s => s.teacher_email === userEmail);
                const currentUserAsMentor = userSchedules.find(s => s.mentor_email === userEmail);

                const currentUserName = currentUserAsTeacher?.teacher_name || currentUserAsMentor?.mentor_name;

                if (currentUserName && selectedTeachers.length === 0 && userEmail !== specialUser) {
                    setSelectedTeachers([currentUserName]);
                }
            } else {
                userSchedules = allSchedules || [];
            }

            const roles = new Set();
            if (isRegistered) {
                const hasTeacherRole = userSchedules.some(schedule => schedule.teacher_email === userEmail);
                if (hasTeacherRole) roles.add('Teacher');

                const hasMentorRole = userSchedules.some(schedule => schedule.mentor_email === userEmail);
                if (hasMentorRole) roles.add('Mentor');
            } else {
                const hasTeacherData = (allSchedules || []).some(s => s.teacher_email);
                const hasMentorData = (allSchedules || []).some(s => s.mentor_email);

                if (hasTeacherData) roles.add('Teacher');
                if (hasMentorData) roles.add('Mentor');
            }

            setAvailableRoles(Array.from(roles));

            if (roles.size > 0 && !roles.has(selectedRole)) {
                setSelectedRole(Array.from(roles)[0]);
            }

            setScheduleData(userSchedules);

        } catch (error) {
            console.error('Error fetching schedule data:', error);
            setError(error.message);
        }
    };

    const teacherList = useMemo(() => {
        const names = allScheduleData
            .flatMap(s => [s.teacher_name, s.mentor_name])
            .filter(Boolean);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }, [allScheduleData]);

    // Filtered teacher list based on search query
    const filteredTeacherList = useMemo(() => {
        if (!teacherSearchQuery.trim()) return teacherList;
        const query = teacherSearchQuery.toLowerCase().trim();
        return teacherList.filter(name =>
            name.toLowerCase().includes(query)
        );
    }, [teacherList, teacherSearchQuery]);

    const fetchPiketData = async () => {
        try {
            let piket;
            let piketError;

            if (userEmail === specialUser || !isUserRegistered) {
                const { data, error } = await supabase
                    .from('piket_schedule')
                    .select('*');

                piket = data;
                piketError = error;
            } else if (isUserRegistered) {
                const { data, error } = await supabase
                    .from('piket_schedule')
                    .select('*')
                    .eq('email', userEmail);

                piket = data;
                piketError = error;
            }

            if (piketError) throw piketError;
            setPiketData(piket || []);

        } catch (error) {
            console.error('Error fetching piket data:', error);
        }
    };

    const fetchAvatarData = async () => {
        try {
            const emails = new Set();
            allScheduleData.forEach(schedule => {
                if (schedule.teacher_email) emails.add(schedule.teacher_email);
                if (schedule.mentor_email) emails.add(schedule.mentor_email);
            });

            // Also add Non Mandatory teacher/mentor emails
            nonMandatoryAssignments.forEach(assignment => {
                if (assignment.teacher_email) emails.add(assignment.teacher_email);
                if (assignment.mentor_email) emails.add(assignment.mentor_email);
            });

            if (emails.size === 0) return;

            const { data: avatars, error: avatarError } = await supabase
                .from('avatars')
                .select('email, last_name, url')
                .in('email', Array.from(emails));
            if (avatarError) throw avatarError;

            const avatarMap = {};
            avatars?.forEach(avatar => {
                avatarMap[avatar.email] = avatar;
            });
            setAvatarData(avatarMap);

        } catch (error) {
            console.error('Error fetching avatar data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchNonMandatoryAssignments = async () => {
        try {
            // Get active semester
            const { data: activeSemester, error: semesterError } = await supabase
                .from('semesters')
                .select('id')
                .eq('is_active', true)
                .single();

            if (semesterError || !activeSemester) {
                console.log('No active semester found');
                return;
            }

            // Fetch Non Mandatory assignments with status Open or Upcoming
            const { data: assignments, error: assignmentError } = await supabase
                .from('teacher_assignment_slots')
                .select(`
                    id,
                    grade,
                    subject,
                    slot_name,
                    rules,
                    days,
                    time_range,
                    status,
                    notes,
                    slot_start_date,
                    slot_end_date,
                    guru_juara_id,
                    mentor_id
                `)
                .eq('class_rule', 'Non Mandatory')
                .eq('semester_id', activeSemester.id)
                .in('status', ['Open', 'Upcoming']);

            if (assignmentError) throw assignmentError;

            if (!assignments || assignments.length === 0) {
                setNonMandatoryAssignments([]);
                return;
            }

            // Get all teacher IDs to fetch their names and emails
            const guruJuaraIds = [...new Set(assignments.filter(a => a.guru_juara_id).map(a => a.guru_juara_id))];
            const mentorIds = [...new Set(assignments.filter(a => a.mentor_id).map(a => a.mentor_id))];
            const allTeacherIds = [...new Set([...guruJuaraIds, ...mentorIds])];

            let teacherMap = {};
            if (allTeacherIds.length > 0) {
                const { data: teachers } = await supabase
                    .from('teachers_new')
                    .select('id, name')
                    .in('id', allTeacherIds);

                if (teachers) {
                    teacherMap = teachers.reduce((acc, t) => {
                        acc[t.id] = t.name;
                        return acc;
                    }, {});
                }
            }

            // Get emails for teachers
            const teacherNames = Object.values(teacherMap);
            let emailMap = {};
            if (teacherNames.length > 0) {
                const { data: userEmails } = await supabase
                    .from('user_emails')
                    .select('full_name, email')
                    .in('full_name', teacherNames);

                if (userEmails) {
                    emailMap = userEmails.reduce((acc, u) => {
                        acc[u.full_name] = u.email;
                        return acc;
                    }, {});
                }
            }

            // Enrich assignments with teacher/mentor info
            const enrichedAssignments = assignments.map(assignment => {
                const guruJuaraName = teacherMap[assignment.guru_juara_id] || null;
                const mentorName = teacherMap[assignment.mentor_id] || null;
                const guruJuaraEmail = guruJuaraName ? emailMap[guruJuaraName] : null;
                const mentorEmail = mentorName ? emailMap[mentorName] : null;

                return {
                    ...assignment,
                    teacher_name: guruJuaraName,
                    teacher_email: guruJuaraEmail,
                    mentor_name: mentorName,
                    mentor_email: mentorEmail,
                    isNonMandatory: true
                };
            });

            setNonMandatoryAssignments(enrichedAssignments);

        } catch (error) {
            console.error('Error fetching non-mandatory assignments:', error);
            setNonMandatoryAssignments([]);
        }
    };

    // Helper: Check if a Non Mandatory assignment should show for a specific date
    const shouldShowNonMandatory = (assignment, targetDate) => {
        if (!assignment.slot_start_date || !assignment.slot_end_date) return false;

        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        const startDate = new Date(assignment.slot_start_date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(assignment.slot_end_date);
        endDate.setHours(0, 0, 0, 0);

        return target >= startDate && target <= endDate;
    };

    // Helper: Convert English day name to match assignment.days array
    const convertDayToEnglish = (dayName) => {
        const dayMap = {
            'Senin': 'Monday',
            'Selasa': 'Tuesday',
            'Rabu': 'Wednesday',
            'Kamis': 'Thursday',
            'Jumat': 'Friday',
            'Sabtu': 'Saturday',
            'Minggu': 'Sunday'
        };
        return dayMap[dayName] || dayName;
    };

    const handleWeekNavigation = (direction) => {
        const newDate = new Date(currentWeek);
        newDate.setDate(currentWeek.getDate() + (direction * 7));
        setCurrentWeek(newDate);
    };

    const handleRoleChange = (role) => {
        setSelectedRole(role);
    };

    const handleTeacherToggle = (teacherName) => {
        setSelectedTeachers(prev => {
            if (prev.includes(teacherName)) {
                return prev.filter(name => name !== teacherName);
            } else {
                return [...prev, teacherName];
            }
        });
    };

    const getNickNameOfMentor = (name) => {
        if (!avatarData[name]) {
            let words = String(name).split(" ");
            return words.filter(word => word.length <= 6)[0];
        }

        return name;
    }

    const handleSelectAllTeachers = () => {
        if (selectedTeachers.length === teacherList.length) {
            setSelectedTeachers([]);
        } else {
            setSelectedTeachers([...teacherList]);
        }
    };

    const filteredScheduleData = useMemo(() => {
        let filtered = [];

        if (userEmail === specialUser) {
            if (selectedTeachers.length === 0) {
                filtered = allScheduleData.filter(schedule => {
                    if (selectedRole === 'Teacher') {
                        return schedule.teacher_email && schedule.teacher_email.trim() !== '';
                    } else if (selectedRole === 'Mentor') {
                        return schedule.mentor_email && schedule.mentor_email.trim() !== '';
                    }
                    return false;
                });
            } else {
                filtered = allScheduleData.filter(schedule => {
                    return selectedTeachers.some(teacherName =>
                        schedule.teacher_name === teacherName || schedule.mentor_name === teacherName
                    );
                });
            }
        } else if (isUserRegistered) {
            if (selectedTeachers.length === 0) {
                filtered = allScheduleData.filter(schedule => {
                    if (selectedRole === 'Teacher') {
                        return schedule.teacher_email === userEmail;
                    } else if (selectedRole === 'Mentor') {
                        return schedule.mentor_email === userEmail;
                    }
                    return false;
                });
            } else {
                filtered = allScheduleData.filter(schedule => {
                    return selectedTeachers.some(teacherName =>
                        schedule.teacher_name === teacherName || schedule.mentor_name === teacherName
                    );
                });
            }
        } else {
            if (selectedTeachers.length === 0) {
                filtered = allScheduleData.filter(schedule => {
                    if (selectedRole === 'Teacher') {
                        return schedule.teacher_email && schedule.teacher_email.trim() !== '';
                    } else if (selectedRole === 'Mentor') {
                        return schedule.mentor_email && schedule.mentor_email.trim() !== '';
                    }
                    return false;
                });
            } else {
                filtered = allScheduleData.filter(schedule => {
                    return selectedTeachers.some(teacherName =>
                        schedule.teacher_name === teacherName || schedule.mentor_name === teacherName
                    );
                });
            }
        }

        return filtered;
    }, [allScheduleData, selectedRole, userEmail, isUserRegistered, selectedTeachers]);

    const reformatDate = (dateStr) => {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const reformatDayName = (dayName) => {
        const dayMap = {
            'Monday': 'Senin',
            'Tuesday': 'Selasa',
            'Wednesday': 'Rabu',
            'Thursday': 'Kamis',
            'Friday': 'Jumat',
            'Saturday': 'Sabtu',
            'Sunday': 'Minggu'
        };
        return dayMap[dayName] || dayName;
    };

    const getSchedulesForDay = (dayName, targetDate) => {
        const dateStr = reformatDate(new Date(targetDate));
        const englishDayName = dayName; // Keep original English day name for Non Mandatory
        dayName = reformatDayName(dayName);
        const daySchedules = filteredScheduleData.filter(schedule => {
            return schedule.day === dayName && schedule.class_date === dateStr;
        });

        let piketSchedules = [];

        if (userEmail === specialUser) {
            piketSchedules = piketData.filter(piket => {
                return (piket.day || piket.class_day) === dayName;
            }).map(piket => ({
                ...piket,
                slot: 'Piket',
                slot_name: 'Piket',
                isPiket: true,
                class_date: dateStr
            }));

            if (selectedTeachers.length > 0) {
                piketSchedules = piketSchedules.filter(piket => {
                    const matchingSchedule = allScheduleData.find(schedule =>
                        schedule.teacher_email === piket.email || schedule.mentor_email === piket.email
                    );

                    if (matchingSchedule) {
                        return selectedTeachers.includes(matchingSchedule.teacher_name) ||
                            selectedTeachers.includes(matchingSchedule.mentor_name);
                    }

                    return selectedTeachers.some(teacherName =>
                        piket.teacher_name === teacherName || piket.name === teacherName
                    );
                });
            }
        } else if (isUserRegistered) {
            piketSchedules = piketData.filter(piket => {
                return (piket.day || piket.class_day) === dayName && piket.email === userEmail;
            }).map(piket => ({
                ...piket,
                slot: 'Piket',
                slot_name: 'Piket',
                isPiket: true,
                class_date: dateStr
            }));
        } else {
            piketSchedules = piketData.filter(piket => {
                return (piket.day || piket.class_day) === dayName;
            }).map(piket => ({
                ...piket,
                slot: 'Piket',
                slot_name: 'Piket',
                isPiket: true,
                class_date: dateStr
            }));

            if (selectedTeachers.length > 0) {
                piketSchedules = piketSchedules.filter(piket => {
                    const matchingSchedule = allScheduleData.find(schedule =>
                        schedule.teacher_email === piket.email || schedule.mentor_email === piket.email
                    );

                    if (matchingSchedule) {
                        return selectedTeachers.includes(matchingSchedule.teacher_name) ||
                            selectedTeachers.includes(matchingSchedule.mentor_name);
                    }

                    return selectedTeachers.some(teacherName =>
                        piket.teacher_name === teacherName || piket.name === teacherName
                    );
                });
            }
        }

        // === NON MANDATORY SCHEDULES ===
        let nonMandatorySchedules = [];

        // Filter Non Mandatory assignments for this day and date range
        const filteredNonMandatory = nonMandatoryAssignments.filter(assignment => {
            // Check if assignment has this day in its days array
            if (!assignment.days || !assignment.days.includes(englishDayName)) {
                return false;
            }

            // Check if target date is within slot_start_date and slot_end_date
            if (!shouldShowNonMandatory(assignment, targetDate)) {
                return false;
            }

            return true;
        });

        // Apply user/teacher filtering
        if (userEmail === specialUser) {
            // Special user sees all Non Mandatory
            nonMandatorySchedules = filteredNonMandatory;

            // If specific teachers selected, filter by them
            if (selectedTeachers.length > 0) {
                nonMandatorySchedules = nonMandatorySchedules.filter(assignment =>
                    selectedTeachers.includes(assignment.teacher_name) ||
                    selectedTeachers.includes(assignment.mentor_name)
                );
            }
        } else if (isUserRegistered) {
            // Registered user sees only their Non Mandatory assignments
            if (selectedTeachers.length > 0) {
                nonMandatorySchedules = filteredNonMandatory.filter(assignment =>
                    selectedTeachers.includes(assignment.teacher_name) ||
                    selectedTeachers.includes(assignment.mentor_name)
                );
            } else {
                nonMandatorySchedules = filteredNonMandatory.filter(assignment =>
                    assignment.teacher_email === userEmail || assignment.mentor_email === userEmail
                );
            }
        } else {
            // Non-registered user sees all Non Mandatory
            nonMandatorySchedules = filteredNonMandatory;

            if (selectedTeachers.length > 0) {
                nonMandatorySchedules = nonMandatorySchedules.filter(assignment =>
                    selectedTeachers.includes(assignment.teacher_name) ||
                    selectedTeachers.includes(assignment.mentor_name)
                );
            }
        }

        // Transform Non Mandatory to schedule card format
        nonMandatorySchedules = nonMandatorySchedules.map(assignment => ({
            ...assignment,
            id: `nm-${assignment.id}`,
            day: dayName,
            time: assignment.time_range,
            class_date: dateStr,
            level: assignment.grade <= 6 ? 'SD' : assignment.grade <= 9 ? 'SMP' : 'SMA',
            isNonMandatory: true
        }));

        return [...daySchedules, ...piketSchedules, ...nonMandatorySchedules];
    };

    const handleCardSelectTeacher = (schedule) => {
        if (!isUserRegistered) {
            const name = schedule.teacher_name || schedule.mentor_name;
            if (name) {
                handleTeacherToggle(name);
            }
        }
    };

    const getMondayOfWeek = (date) => {
        const monday = new Date(date);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        return monday;
    };

    const getAcademicWeekNumber = (date) => {
        const semesterStartDate = new Date('2025-07-07');
        const semesterStartMonday = getMondayOfWeek(semesterStartDate);
        const currentMonday = getMondayOfWeek(date);

        const diffTime = currentMonday.getTime() - semesterStartMonday.getTime();
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        const weekNumber = diffWeeks + 1;

        return weekNumber < 1 ? null : weekNumber;
    };

    useEffect(() => {
        if (userEmail) {
            fetchScheduleData();
        }
    }, [currentWeek, userEmail]);

    useEffect(() => {
        if (isUserRegistered !== null) {
            fetchPiketData();
        }
    }, [isUserRegistered]);

    useEffect(() => {
        if (allScheduleData.length > 0 || nonMandatoryAssignments.length > 0) {
            fetchAvatarData();
        } else {
            setLoading(false);
        }
    }, [allScheduleData, nonMandatoryAssignments]);

    // Fetch Non Mandatory assignments on component load and when week changes
    useEffect(() => {
        fetchNonMandatoryAssignments();
    }, [currentWeek]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.teacher-selector')) {
                setShowTeacherDropdown(false);
                setTeacherSearchQuery(''); // Clear search when closing dropdown
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekDates = generateWeekDates(currentWeek);

    if (loading) {
        return (
            <div className="individual-schedule">
                <Navbar userEmail={userEmail} onLogoutClick={onLogout} />
                <div className="schedule-container">
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading schedule...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="individual-schedule">
                <Navbar userEmail={userEmail} onLogoutClick={onLogout} />
                <div className="schedule-container">
                    <div className="error-state">
                        <p>Error loading schedule: {error}</p>
                        <button onClick={() => window.location.reload()}>Try Again</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="individual-schedule">
            <Navbar userEmail={user} onLogoutClick={onLogout} />

            <div className="schedule-container">
                <h1 className="schedule-title">
                    <u>
                        {selectedTeachers.length > 1 || !isUserRegistered ? 'All Teachers Schedule' : 'Individual Schedule'}
                    </u>
                </h1>

                <div className="control-section">
                    <div className="control-left">
                        <div className="period-navigator">
                            <div className="nav-button" onClick={() => handleWeekNavigation(-1)}>
                                <img className='double-arrow' src="https://media.sessions.colearn.id/assets/other/images/2025-06-30T05:57:17.059Z-Double Right.png" alt="Double Left Button" />
                            </div>
                            <div className='nav-button-week'>
                                <span className="current-period">
                                    {(() => {
                                        const mondayOfWeek = getMondayOfWeek(currentWeek);
                                        const weekNumber = getAcademicWeekNumber(mondayOfWeek);
                                        if (weekNumber === null) {
                                            return mondayOfWeek.toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            });
                                        }
                                        return `${mondayOfWeek.toLocaleDateString('en-US', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })} - Week ${weekNumber}`;
                                    })()}
                                </span>
                            </div>
                            <div className="nav-button" onClick={() => handleWeekNavigation(1)}>
                                <img className='double-arrow' src="https://media.sessions.colearn.id/assets/other/images/2025-06-30T06:02:42.367Z-Double Right-2.png" alt="Double Right Button" />
                            </div>
                        </div>

                        <div className="teacher-selector">
                            <div className="teacher-selector-button" onClick={() => setShowTeacherDropdown(!showTeacherDropdown)}>
                                <span>
                                    {selectedTeachers.length === 0
                                        ? 'Select Teachers'
                                        : selectedTeachers.length === teacherList.length
                                            ? 'All Teachers'
                                            : `${selectedTeachers.length} Teacher${selectedTeachers.length > 1 ? 's' : ''} Selected`
                                    }
                                </span>
                                <img
                                    className="dropdown-icon"
                                    src="https://media.sessions.colearn.id/assets/other/images/2025-06-30T12:11:18.115Z-Drop Down.png"
                                    alt="Dropdown"
                                />
                            </div>

                            {showTeacherDropdown && (
                                <div className="teacher-dropdown">
                                    <div className="teacher-dropdown-header">
                                        <div className="teacher-search-container">
                                            <input
                                                type="text"
                                                className="teacher-search-input"
                                                placeholder="Search teachers..."
                                                value={teacherSearchQuery}
                                                onChange={(e) => setTeacherSearchQuery(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                            />
                                            {teacherSearchQuery && (
                                                <button
                                                    className="teacher-search-clear"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTeacherSearchQuery('');
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            className="select-all-btn"
                                            onClick={handleSelectAllTeachers}
                                        >
                                            {selectedTeachers.length === teacherList.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="teacher-list">
                                        {filteredTeacherList.length > 0 ? (
                                            filteredTeacherList.map(name => (
                                                <label key={name} className="teacher-checkbox-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTeachers.includes(name)}
                                                        onChange={() => handleTeacherToggle(name)}
                                                    />
                                                    <span className="checkmark"></span>
                                                    <span className="teacher-name">{name}</span>
                                                </label>
                                            ))
                                        ) : (
                                            <div className="teacher-list-empty">
                                                No teachers found for "{teacherSearchQuery}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="control-right">
                        <span className="month-year">{formatMonthYear(currentWeek)}</span>
                    </div>
                </div>

                <div className="schedule-table">
                    <div className="schedule-header">
                        {dayNames.map((day, index) => (
                            <div
                                key={day}
                                className={`day-header ${index === 0 ? 'first' : ''} ${index === 5 ? 'last' : ''}`}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="schedule-body">
                        {dayNames.map((dayName, dayIndex) => {
                            const dayDate = weekDates[dayIndex];
                            const daySchedules = getSchedulesForDay(dayName, dayDate);
                            return (
                                <div key={dayName} className="day-column">
                                    <div className="day-date">
                                        {formatDateWithSuffix(dayDate)}
                                    </div>

                                    <div className="schedule-cards">
                                        {daySchedules.length > 0 ? (
                                            daySchedules
                                                .slice()
                                                .sort((a, b) => {
                                                    const getStart = (s) => (s.time || '').split('-')[0];
                                                    return getStart(a).localeCompare(getStart(b));
                                                })
                                                .filter(schedule => {
                                                    if (schedule.isPiket) {
                                                        if (schedule.first_class_date && schedule.class_date) {
                                                            if (userEmail === specialUser) {
                                                                return new Date(schedule.class_date) >= new Date(schedule.first_class_date);
                                                            }
                                                            return new Date(schedule.class_date) >= new Date(schedule.first_class_date) && isUserRegistered;
                                                        }
                                                        return userEmail === specialUser || isUserRegistered;
                                                    }
                                                    return true;
                                                })
                                                .map((schedule, scheduleIndex) => (
                                                    <div
                                                        key={`${schedule.id}-${scheduleIndex}`}
                                                        className={`schedule-card ${schedule.isNonMandatory ? 'non-mandatory' : ''}`}
                                                        style={{
                                                            backgroundColor: getBackgroundColor(
                                                                schedule.level,
                                                                schedule.subject,
                                                                schedule.isPiket,
                                                                schedule.isNonMandatory
                                                            )
                                                        }}
                                                        onClick={() => handleCardSelectTeacher(schedule)}
                                                    >
                                                        {schedule.isNonMandatory && (
                                                            <div className="non-mandatory-badge">Non Mandatory</div>
                                                        )}
                                                        <div className='card-content'>
                                                            <div className="card-title">
                                                                {schedule.isPiket
                                                                    ? `Standby for Piket`
                                                                    : schedule.isNonMandatory
                                                                        ? `${schedule.grade} ${schedule.slot_name}`
                                                                        : `${schedule.grade} ${schedule.slot_name}`
                                                                }
                                                            </div>
                                                            {schedule.isNonMandatory ? (
                                                                <span className='card-subtitle'>
                                                                    {schedule.rules || schedule.subject || 'Non Mandatory Class'}
                                                                </span>
                                                            ) : new Date(schedule.first_class_date) > new Date() && (
                                                                <span className='card-subtitle'>
                                                                    {schedule.isPiket ? `Grade ${schedule.grade}` : `Starts on ${new Date(schedule.first_class_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="card-avatars">
                                                            <div className="card-time">
                                                                {formatTime(schedule.time)}
                                                            </div>
                                                            {
                                                                <div className='avatars'>
                                                                    {schedule.teacher_email && (
                                                                        <div className="avatar-container">
                                                                            <img
                                                                                src={avatarData[schedule.teacher_email]?.url || 'https://media.sessions.colearn.id/assets/other/images/2025-07-04T13:46:28.685Z-partner asset-coco 3.png'}
                                                                                alt={schedule.teacher_name}
                                                                                className="avatar-image"
                                                                                onError={e => { e.target.src = 'https://media.sessions.colearn.id/assets/other/images/2025-07-04T13:46:28.685Z-partner asset-coco 3.png'; }}
                                                                            />
                                                                            <div className="avatar-name">
                                                                                {avatarData[schedule.teacher_email]?.last_name || getNickNameOfMentor(schedule?.teacher_name)}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {schedule.mentor_email && schedule.mentor_email !== schedule.teacher_email && (
                                                                        <div className="avatar-container">
                                                                            <img
                                                                                src={
                                                                                    avatarData[schedule.mentor_email]?.url
                                                                                    || 'https://media.sessions.colearn.id/assets/other/images/2025-07-04T13:46:28.685Z-partner asset-coco 3.png'
                                                                                }
                                                                                alt={schedule.mentor_name}
                                                                                className="avatar-image"
                                                                                onError={e => { e.target.src = 'https://media.sessions.colearn.id/assets/other/images/2025-07-04T13:46:28.685Z-partner asset-coco 3.png'; }}
                                                                            />
                                                                            <div className="avatar-name">
                                                                                {avatarData[schedule.mentor_email]?.last_name
                                                                                    || getNickNameOfMentor(schedule.mentor_name)}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            }
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="empty-day">
                                                <span>No schedule</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IndividualSchedule;