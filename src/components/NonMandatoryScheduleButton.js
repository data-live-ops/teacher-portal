import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, X, Calendar, Clock, User, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import '../styles/NonMandatorySchedule.css';

const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const NonMandatoryScheduleButton = ({ userEmail }) => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeSemester, setActiveSemester] = useState(null);

    const fetchActiveSemester = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('semesters')
                .select('id, name')
                .eq('is_active', true)
                .single();

            if (error) throw error;
            setActiveSemester(data);
            return data;
        } catch (err) {
            console.error('Error fetching active semester:', err);
            return null;
        }
    }, []);

    const fetchNonMandatoryAssignments = useCallback(async (semesterId) => {
        if (!userEmail || !semesterId) return;

        setLoading(true);
        try {
            // Get user's full name from email
            const { data: userData, error: userError } = await supabase
                .from('user_emails')
                .select('full_name')
                .eq('email', userEmail)
                .single();

            if (userError || !userData) {
                console.log('User not found in user_emails:', userEmail);
                setAssignments([]);
                setLoading(false);
                return;
            }

            const userFullName = userData.full_name;

            // Fetch non-mandatory assignments where user is guru_juara or mentor
            const { data, error } = await supabase
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
                    class_capacity,
                    curriculum,
                    created_at,
                    guru_juara_id,
                    mentor_id
                `)
                .eq('class_rule', 'Non Mandatory')
                .eq('semester_id', semesterId)
                .in('status', ['Open', 'Upcoming']);

            if (error) throw error;

            const guruJuaraIds = [...new Set(data.filter(a => a.guru_juara_id).map(a => a.guru_juara_id))];
            const mentorIds = [...new Set(data.filter(a => a.mentor_id).map(a => a.mentor_id))];
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

            const userAssignments = data.filter(assignment => {
                const guruJuaraName = teacherMap[assignment.guru_juara_id];
                const mentorName = teacherMap[assignment.mentor_id];
                return guruJuaraName === userFullName || mentorName === userFullName;
            }).map(assignment => {
                const guruJuaraName = teacherMap[assignment.guru_juara_id];
                const mentorName = teacherMap[assignment.mentor_id];

                // Determine user's role
                let userRole = null;
                if (guruJuaraName === userFullName) userRole = 'Guru Juara';
                if (mentorName === userFullName) userRole = userRole ? 'Guru Juara & Mentor' : 'Mentor';

                // Check if new (created within last 7 days)
                const createdAt = new Date(assignment.created_at);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const isNew = createdAt > sevenDaysAgo;

                return {
                    ...assignment,
                    guru_juara_name: guruJuaraName,
                    mentor_name: mentorName,
                    user_role: userRole,
                    is_new: isNew
                };
            });

            // Sort: new first, then by grade
            userAssignments.sort((a, b) => {
                if (a.is_new && !b.is_new) return -1;
                if (!a.is_new && b.is_new) return 1;
                return a.grade - b.grade;
            });

            setAssignments(userAssignments);
        } catch (err) {
            console.error('Error fetching non-mandatory assignments:', err);
            setAssignments([]);
        } finally {
            setLoading(false);
        }
    }, [userEmail]);

    // Initial load
    useEffect(() => {
        const init = async () => {
            const semester = await fetchActiveSemester();
            if (semester) {
                await fetchNonMandatoryAssignments(semester.id);
            } else {
                setLoading(false);
            }
        };
        init();
    }, [fetchActiveSemester, fetchNonMandatoryAssignments]);

    // Format days array to Indonesian
    const formatDays = (days) => {
        if (!days || days.length === 0) return '-';

        const dayMap = {
            'Monday': 'Senin',
            'Tuesday': 'Selasa',
            'Wednesday': 'Rabu',
            'Thursday': 'Kamis',
            'Friday': 'Jumat',
            'Saturday': 'Sabtu',
            'Sunday': 'Minggu'
        };

        const indonesianDays = days.map(d => dayMap[d] || d);
        indonesianDays.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));

        return indonesianDays.join(', ');
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    // Don't show button if no assignments
    if (!loading && assignments.length === 0) {
        return null;
    }

    const newCount = assignments.filter(a => a.is_new).length;

    return (
        <>
            {/* Floating Button */}
            <button
                className="non-mandatory-button"
                onClick={() => setShowModal(true)}
                disabled={loading}
            >
                <BookOpen size={18} />
                <span>Jadwal Non Mandatory</span>
                {assignments.length > 0 && (
                    <span className="nm-badge">{assignments.length}</span>
                )}
                {newCount > 0 && (
                    <span className="nm-new-indicator">
                        <Sparkles size={12} />
                    </span>
                )}
            </button>

            {/* Modal */}
            {showModal && (
                <div className="nm-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="nm-modal" onClick={e => e.stopPropagation()}>
                        <div className="nm-modal-header">
                            <h3>
                                <BookOpen size={20} />
                                Jadwal Kelas Non Mandatory
                            </h3>
                            <button className="nm-close-btn" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="nm-modal-body">
                            {loading ? (
                                <div className="nm-loading">Memuat jadwal...</div>
                            ) : assignments.length === 0 ? (
                                <div className="nm-empty">
                                    <p>Tidak ada jadwal kelas Non Mandatory untuk Anda.</p>
                                </div>
                            ) : (
                                <div className="nm-assignments-list">
                                    {assignments.map(assignment => (
                                        <div
                                            key={assignment.id}
                                            className={`nm-assignment-card ${assignment.is_new ? 'is-new' : ''}`}
                                        >
                                            {assignment.is_new && (
                                                <div className="nm-new-badge">
                                                    <Sparkles size={12} />
                                                    Kelas Baru
                                                </div>
                                            )}

                                            <div className="nm-card-header">
                                                <span className="nm-grade">Grade {assignment.grade}</span>
                                                <span className="nm-subject">{assignment.subject}</span>
                                                <span className={`nm-status ${assignment.status.toLowerCase()}`}>
                                                    {assignment.status}
                                                </span>
                                            </div>

                                            <h4 className="nm-slot-name">{assignment.slot_name}</h4>

                                            {assignment.rules && (
                                                <div className="nm-rules">{assignment.rules}</div>
                                            )}

                                            <div className="nm-card-details">
                                                <div className="nm-detail-row">
                                                    <Calendar size={14} />
                                                    <span>{formatDays(assignment.days)}</span>
                                                </div>

                                                {assignment.time_range && (
                                                    <div className="nm-detail-row">
                                                        <Clock size={14} />
                                                        <span>{assignment.time_range}</span>
                                                    </div>
                                                )}

                                                <div className="nm-detail-row">
                                                    <User size={14} />
                                                    <span>Role: <strong>{assignment.user_role}</strong></span>
                                                </div>
                                            </div>

                                            {(assignment.slot_start_date || assignment.slot_end_date) && (
                                                <div className="nm-period">
                                                    Periode: {formatDate(assignment.slot_start_date)} - {formatDate(assignment.slot_end_date)}
                                                </div>
                                            )}

                                            {assignment.notes && (
                                                <div className="nm-notes">
                                                    <strong>Catatan:</strong> {assignment.notes}
                                                </div>
                                            )}

                                            <div className="nm-card-footer">
                                                {assignment.guru_juara_name && (
                                                    <span>Guru Juara: {assignment.guru_juara_name}</span>
                                                )}
                                                {assignment.mentor_name && (
                                                    <span>Mentor: {assignment.mentor_name}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="nm-modal-footer">
                            <span className="nm-semester-info">
                                Semester: {activeSemester?.name || '-'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NonMandatoryScheduleButton;
