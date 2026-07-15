import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Download, Filter, BookOpen, Copy, Check, ListChecks } from 'lucide-react';
import '../styles/TeacherAssignment.css';
import '../styles/InClassAssessment.css';
import { supabase } from '../lib/supabaseClient.mjs';
import MandatoryQuestionManager from './MandatoryQuestionManager';
import { usePermissions } from '../contexts/PermissionContext';

const MANDATORY_FILTER_LABELS = {
    all: 'All Question Types',
    mandatory: 'Mandatory Only',
    non_mandatory: 'Non-Mandatory Only',
};

const ICADashboardTab = ({ user }) => {
    const { canEdit } = usePermissions();

    // Filter states
    const [grades, setGrades] = useState([]);
    const [slots, setSlots] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [mandatoryFilter, setMandatoryFilter] = useState('all'); // 'all' | 'mandatory' | 'non_mandatory'

    // Data states
    const [assessmentData, setAssessmentData] = useState([]);
    const [participantsData, setParticipantsData] = useState([]);
    const [questionsWithDates, setQuestionsWithDates] = useState([]);
    const [questionMetadataMap, setQuestionMetadataMap] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [loadingFilters, setLoadingFilters] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Mandatory question manager modal
    const [showQuestionManager, setShowQuestionManager] = useState(false);

    // Copy state
    const [copiedId, setCopiedId] = useState(null);

    // Copy to clipboard function
    const copyToClipboard = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Load available grades and question mandatory-status map on mount
    useEffect(() => {
        loadGrades();
        loadQuestionMetadata();
    }, []);

    const loadQuestionMetadata = async () => {
        try {
            const { data, error } = await supabase
                .from('ica_question_metadata')
                .select('reference_id, is_mandatory');

            if (error) throw error;

            const map = new Map();
            (data || []).forEach(row => map.set(String(row.reference_id), row.is_mandatory));
            setQuestionMetadataMap(map);
        } catch (error) {
            console.error('Error loading question metadata:', error);
        }
    };

    // A reference_id with no row in ica_question_metadata is treated as Non-Mandatory
    const isQuestionMandatory = (referenceId) => questionMetadataMap.get(String(referenceId)) === true;

    // Load slots when grade changes
    useEffect(() => {
        if (selectedGrade) {
            loadSlots(selectedGrade);
        } else {
            setSlots([]);
            setSelectedSlot('');
        }
    }, [selectedGrade]);

    // Load assessment data when both grade and slot are selected
    useEffect(() => {
        if (selectedGrade && selectedSlot) {
            loadAssessmentData();
        } else {
            setAssessmentData([]);
            setQuestionsWithDates([]);
        }
    }, [selectedGrade, selectedSlot]);

    const loadGrades = async () => {
        try {
            setLoadingFilters(true);
            const { data, error } = await supabase
                .from('ica_grade_slots')
                .select('grade_list');

            if (error) throw error;

            const uniqueGrades = [...new Set(data.map(d => d.grade_list))]
                .filter(Boolean)
                .sort((a, b) => {
                    const numA = parseInt(a, 10);
                    const numB = parseInt(b, 10);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return String(a).localeCompare(String(b));
                });
            setGrades(uniqueGrades);
        } catch (error) {
            console.error('Error loading grades:', error);
        } finally {
            setLoadingFilters(false);
        }
    };

    const loadSlots = async (grade) => {
        try {
            const { data, error } = await supabase
                .from('ica_grade_slots')
                .select('slot_name')
                .eq('grade_list', grade);

            if (error) throw error;

            // Get unique slots with natural sort (Matematika 1, 2, 10, 11)
            const uniqueSlots = [...new Set(data.map(d => d.slot_name))]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            setSlots(uniqueSlots);
            setSelectedSlot('');
        } catch (error) {
            console.error('Error loading slots:', error);
        }
    };

    // Supabase/PostgREST caps a single select() at db.max_rows (default 1000).
    // A busy grade+slot can easily pass 1000 assessment rows over a semester
    // (students x questions x weeks), so an unpaginated select() would
    // silently drop rows past the cap instead of erroring - page through with
    // .range() until a page comes back short.
    const fetchAllRows = async (queryFactory) => {
        const pageSize = 1000;
        let from = 0;
        let all = [];
        while (true) {
            const { data, error } = await queryFactory().range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }
        return all;
    };

    const loadAssessmentData = async () => {
        if (!selectedGrade || !selectedSlot) return;

        try {
            setLoading(true);

            // Fetch assessment data for selected grade and slot
            const assessments = await fetchAllRows(() =>
                supabase
                    .from('ica_student_assessments')
                    .select('*')
                    .eq('grade_list', selectedGrade)
                    .eq('slot_name', selectedSlot)
                    .order('student_name')
            );

            // Fetch participants_per_batch for this grade+slot - source of truth for
            // which students were actually registered per session_id. Doubles as the
            // Student ID/Name roster (union across every session_id, so a student who
            // only joined in a later session still gets a row) and, per-session, to
            // detect INACTIVE (not registered that session) separately from ABSENT
            // (registered but no assessment data that session).
            // participants_per_batch.grade is INTEGER while ica_grade_slots.grade_list
            // (selectedGrade) is TEXT - cast before filtering.
            const participants = await fetchAllRows(() =>
                supabase
                    .from('participants_per_batch')
                    .select('session_id, user_id, student_name')
                    .eq('grade', parseInt(selectedGrade, 10))
                    .eq('slot_name', selectedSlot)
            );

            setParticipantsData(participants || []);
            setAssessmentData(assessments || []);

            // Extract unique reference_id + session_date combinations (+ session_id,
            // needed to look up the INACTIVE set for that session)
            const questionDateMap = new Map();
            assessments.forEach(a => {
                if (a.reference_id && a.session_date) {
                    const key = `${a.reference_id}|${a.session_date}`;
                    if (!questionDateMap.has(key)) {
                        questionDateMap.set(key, {
                            reference_id: a.reference_id,
                            question_id: a.question_id,
                            session_date: a.session_date,
                            session_id: a.session_id
                        });
                    }
                }
            });

            // Sort by session_date
            const sortedQuestions = Array.from(questionDateMap.values())
                .sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

            setQuestionsWithDates(sortedQuestions);

        } catch (error) {
            console.error('Error loading assessment data:', error);
            alert('Failed to load assessment data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Per-session active participant sets, derived from participants_per_batch.
    // A student missing from the set for a given session_id was not registered for
    // that session at all (not yet joined, or already unsubscribed) - distinct from
    // ABSENT, which means registered but with no assessment data that session.
    const sessionParticipantSets = useMemo(() => {
        const map = new Map();
        participantsData.forEach(p => {
            if (!p.session_id) return;
            if (!map.has(p.session_id)) map.set(p.session_id, new Set());
            map.get(p.session_id).add(p.user_id);
        });
        return map;
    }, [participantsData]);

    // Process data into table format
    const tableData = useMemo(() => {
        if (!assessmentData.length && !participantsData.length) return [];

        // Get every student ever registered in this grade+slot, across all
        // session_ids (union, not a single-point-in-time snapshot) - so a student
        // who only joined in a later session still gets a row.
        const studentsMap = new Map();
        participantsData.forEach(p => {
            if (!studentsMap.has(p.user_id)) {
                studentsMap.set(p.user_id, {
                    user_id: p.user_id,
                    student_name: p.student_name,
                    assessments: {}
                });
            }
        });

        // Also add students from assessment data (in case participants sync is incomplete)
        assessmentData.forEach(a => {
            if (!studentsMap.has(a.user_id)) {
                studentsMap.set(a.user_id, {
                    user_id: a.user_id,
                    student_name: a.student_name,
                    assessments: {}
                });
            }
        });

        // Map assessment data to students
        assessmentData.forEach(a => {
            const student = studentsMap.get(a.user_id);
            if (student) {
                const key = `${a.reference_id}|${a.session_date}`;
                student.assessments[key] = a.understanding_types || 'No Attempt';
            }
        });

        // Convert to array and sort by student name
        return Array.from(studentsMap.values())
            .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
    }, [assessmentData, participantsData]);

    // Apply Mandatory/Non-Mandatory filter on top of the raw question list
    const filteredQuestionsWithDates = useMemo(() => {
        if (mandatoryFilter === 'all') return questionsWithDates;
        return questionsWithDates.filter(q => {
            const mandatory = isQuestionMandatory(q.reference_id);
            return mandatoryFilter === 'mandatory' ? mandatory : !mandatory;
        });
    }, [questionsWithDates, questionMetadataMap, mandatoryFilter]);

    // Filter by search term
    const filteredData = useMemo(() => {
        if (!searchTerm) return tableData;
        const term = searchTerm.toLowerCase();
        return tableData.filter(student =>
            student.student_name?.toLowerCase().includes(term) ||
            student.user_id?.toLowerCase().includes(term)
        );
    }, [tableData, searchTerm]);

    // Get status for a cell.
    // INACTIVE (not registered in participants_per_batch for this session_id - not
    // yet joined, or already unsubscribed) takes precedence over ABSENT (registered
    // for the session but with no assessment data at all).
    const getStatus = (student, referenceId, sessionDate, sessionId) => {
        const activeSet = sessionParticipantSets.get(sessionId);
        // Only trust the INACTIVE check when we actually have participants data for
        // this session - otherwise fall through to the ABSENT/No Attempt logic below
        // instead of mislabeling every student INACTIVE.
        if (activeSet && !activeSet.has(student.user_id)) {
            return 'INACTIVE';
        }

        const key = `${referenceId}|${sessionDate}`;
        const status = student.assessments[key];

        // If no data for this reference/session, check if student has ANY data for this session
        if (!status) {
            // Check if student has any assessment data for this session_date
            const hasAnyDataForSession = assessmentData.some(
                a => a.user_id === student.user_id && a.session_date === sessionDate
            );
            return hasAnyDataForSession ? 'No Attempt' : 'ABSENT';
        }

        return status;
    };

    // % Correctness = Full Understanding / (Full Understanding + No Understanding).
    // No Attempt and ABSENT are excluded entirely (not just from the numerator),
    // matching the ica-dashboard SQL definition of this metric.
    const getParticipationStatus = (student) => {
        if (!filteredQuestionsWithDates.length) return { percentage: 0, status: 'Below', participated: 0, eligible: 0 };

        let participated = 0; // Full Understanding (correct)
        let eligible = 0; // Full Understanding + No Understanding (No Attempt/ABSENT/INACTIVE excluded)

        filteredQuestionsWithDates.forEach(q => {
            const status = getStatus(student, q.reference_id, q.session_date, q.session_id);

            if (status === 'Full Understanding') {
                eligible++;
                participated++;
            } else if (status === 'No Understanding') {
                eligible++;
            }
            // No Attempt, ABSENT and INACTIVE: ignored entirely, not counted in eligible
        });

        const percentage = eligible > 0 ? (participated / eligible) * 100 : 0;

        let statusLabel;
        if (percentage > 80) {
            statusLabel = 'Above';
        } else if (percentage >= 50) {
            statusLabel = 'Optimal';
        } else {
            statusLabel = 'Below';
        }

        return { percentage, status: statusLabel, participated, eligible };
    };

    // Get participation status cell style
    const getParticipationStyle = (status) => {
        switch (status) {
            case 'Above':
                return { backgroundColor: '#dcfce7', color: '#166534' }; // Green
            case 'Optimal':
                return { backgroundColor: '#dbeafe', color: '#1e40af' }; // Blue
            case 'Below':
                return { backgroundColor: '#fee2e2', color: '#991b1b' }; // Red
            default:
                return { backgroundColor: '#f9fafb', color: '#374151' };
        }
    };

    // Get cell style based on status
    const getCellStyle = (status) => {
        switch (status) {
            case 'Full Understanding':
                return { backgroundColor: '#dcfce7', color: '#166534' }; // Green
            case 'No Understanding':
                return { backgroundColor: '#fee2e2', color: '#991b1b' }; // Red
            case 'No Attempt':
                return { backgroundColor: '#fef9c3', color: '#854d0e' }; // Yellow
            case 'ABSENT':
                return { backgroundColor: '#f3f4f6', color: '#6b7280' }; // Gray
            case 'INACTIVE':
                return { backgroundColor: '#e5e7eb', color: '#4b5563', fontStyle: 'italic' }; // Darker gray, italic
            default:
                return { backgroundColor: '#f9fafb', color: '#374151' };
        }
    };

    // Get abbreviated status for display
    const getAbbreviatedStatus = (status) => {
        switch (status) {
            case 'Full Understanding':
                return 'Full';
            case 'No Understanding':
                return 'No Und.';
            case 'No Attempt':
                return 'No Att.';
            case 'ABSENT':
                return 'ABSENT';
            case 'INACTIVE':
                return 'Inactive';
            default:
                return status;
        }
    };

    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Export to CSV
    const exportToCSV = () => {
        if (!filteredData.length || !filteredQuestionsWithDates.length) return;

        // Headers
        let headers = ['Student ID', 'Student Name'];
        filteredQuestionsWithDates.forEach(q => {
            headers.push(`${q.reference_id} (${formatDate(q.session_date)})`);
        });

        // Rows
        const rows = filteredData.map(student => {
            const row = [student.user_id, student.student_name];
            filteredQuestionsWithDates.forEach(q => {
                row.push(getStatus(student, q.reference_id, q.session_date, q.session_id));
            });
            return row;
        });

        // Convert to CSV
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ICA_${selectedGrade}_${selectedSlot}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const stats = useMemo(() => {
        if (!filteredData.length || !filteredQuestionsWithDates.length) {
            return { total: 0, fullUnderstanding: 0, noUnderstanding: 0, noAttempt: 0, absent: 0, inactive: 0 };
        }

        let fullUnderstanding = 0;
        let noUnderstanding = 0;
        let noAttempt = 0;
        let absent = 0;
        let inactive = 0;
        let total = 0;

        filteredData.forEach(student => {
            filteredQuestionsWithDates.forEach(q => {
                const status = getStatus(student, q.reference_id, q.session_date, q.session_id);
                total++;
                switch (status) {
                    case 'Full Understanding': fullUnderstanding++; break;
                    case 'No Understanding': noUnderstanding++; break;
                    case 'No Attempt': noAttempt++; break;
                    case 'ABSENT': absent++; break;
                    case 'INACTIVE': inactive++; break;
                }
            });
        });

        return { total, fullUnderstanding, noUnderstanding, noAttempt, absent, inactive };
    }, [filteredData, filteredQuestionsWithDates, sessionParticipantSets, assessmentData]);

    // Per-question attempt count: how many currently-shown students submitted an
    // answer (Full or No Understanding) for that question, regardless of whether
    // it was correct - No Attempt/ABSENT/INACTIVE don't count as an attempt.
    const questionAttemptCounts = useMemo(() => {
        const map = new Map();
        filteredQuestionsWithDates.forEach(q => {
            let attempted = 0;
            filteredData.forEach(student => {
                const status = getStatus(student, q.reference_id, q.session_date, q.session_id);
                if (status === 'Full Understanding' || status === 'No Understanding') attempted++;
            });
            map.set(`${q.reference_id}|${q.session_date}`, attempted);
        });
        return map;
    }, [filteredData, filteredQuestionsWithDates, sessionParticipantSets, assessmentData]);

    if (loadingFilters) {
        return (
            <div className="teacher-assignment-container ica-tab-content">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">Loading filters...</div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="teacher-assignment-container ica-tab-content">
                <div className="header">
                    <div className="header-content">
                        <h1 className="title">ICA Dashboard - Per Student</h1>
                        <p className="subtitle">Monitor student understanding per session</p>
                    </div>

                    <div className="header-actions">
                        {/* Grade Filter */}
                        <div className="filter-group">
                            <select
                                value={selectedGrade}
                                onChange={(e) => setSelectedGrade(e.target.value)}
                                className="filter-select"
                            >
                                <option value="">Select Grade</option>
                                {grades.map(grade => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                        </div>

                        {/* Slot Filter */}
                        <div className="filter-group">
                            <select
                                value={selectedSlot}
                                onChange={(e) => setSelectedSlot(e.target.value)}
                                className="filter-select"
                                disabled={!selectedGrade}
                            >
                                <option value="">Select Slot</option>
                                {slots.map(slot => (
                                    <option key={slot} value={slot}>{slot}</option>
                                ))}
                            </select>
                        </div>

                        {/* Mandatory Filter */}
                        <div className="filter-group">
                            <select
                                value={mandatoryFilter}
                                onChange={(e) => setMandatoryFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Questions</option>
                                <option value="mandatory">Mandatory Only</option>
                                <option value="non_mandatory">Non-Mandatory Only</option>
                            </select>
                        </div>

                        {/* Search */}
                        <div className="search-bar">
                            <Search className="search-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Search students..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={exportToCSV}
                            disabled={!filteredData.length}
                            className="dropdown-button"
                            title="Export to CSV"
                        >
                            <Download size={16} />
                            Export
                        </button>

                        {/* Manage Mandatory Questions */}
                        {canEdit('in_class_assessment') && (
                            <button
                                onClick={() => setShowQuestionManager(true)}
                                className="dropdown-button"
                                title="Kelola status Mandatory/Non-Mandatory per soal"
                            >
                                <ListChecks size={16} />
                                Atur Soal Mandatory
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                {selectedGrade && selectedSlot && (
                    <div className="stats-container">
                        <div className="stat-card stat-total">
                            <div className="stat-content">
                                <div className="stat-icon">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <p className="stat-label">Total Students</p>
                                    <p className="stat-value">{filteredData.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card stat-success">
                            <div className="stat-content">
                                <div className="stat-icon" style={{ color: '#166534' }}>
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <p className="stat-label">Full Understanding</p>
                                    <p className="stat-value">{stats.fullUnderstanding}</p>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card stat-danger">
                            <div className="stat-content">
                                <div className="stat-icon" style={{ color: '#991b1b' }}>
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <p className="stat-label">No Understanding</p>
                                    <p className="stat-value">{stats.noUnderstanding}</p>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card stat-warning">
                            <div className="stat-content">
                                <div className="stat-icon" style={{ color: '#854d0e' }}>
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <p className="stat-label">No Attempt</p>
                                    <p className="stat-value">{stats.noAttempt}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reflects the "Mandatory Filter" dropdown, so it's clear at a
                    glance which question type the table below is scoped to -
                    easy to miss otherwise since the dropdown sits far above,
                    next to the Grade/Slot selects. */}
                {selectedGrade && selectedSlot && (
                    <div className={`question-type-banner question-type-banner-${mandatoryFilter}`}>
                        <span className="question-type-banner-pill">{MANDATORY_FILTER_LABELS[mandatoryFilter]}</span>
                        <span className="question-type-banner-count">
                            {filteredQuestionsWithDates.length} question{filteredQuestionsWithDates.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}

                {/* Content Area */}
                {!selectedGrade || !selectedSlot ? (
                    <div className="empty-state">
                        <Filter size={48} />
                        <p>Please select a Grade and Slot to view assessment data</p>
                    </div>
                ) : loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <div className="loading-text">Loading assessment data...</div>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="empty-state">
                        <Users size={48} />
                        <p>No assessment data found for the selected filters</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <div className="table-header">
                            <h3>Assessment Results - {selectedGrade} / {selectedSlot}</h3>
                            <p>{filteredData.length} students, {filteredQuestionsWithDates.length} questions</p>
                        </div>

                        <div className="ica-table-scroll">
                            <table className="assignment-table ica-table">
                                <thead>
                                    <tr>
                                        <th className="sticky-col sticky-col-1">Student ID</th>
                                        <th className="sticky-col sticky-col-2">Student Name</th>
                                        <th className="sticky-col sticky-col-3">Participation</th>
                                        {filteredQuestionsWithDates.map(q => (
                                            <th key={`${q.reference_id}-${q.session_date}`} className="question-header">
                                                <div className="question-id">{q.reference_id}</div>
                                                <div className="session-date">{formatDate(q.session_date)}</div>
                                                <div
                                                    className="question-attempt-count"
                                                    title="Students who submitted an answer (correct or incorrect), out of the students currently shown"
                                                >
                                                    {questionAttemptCounts.get(`${q.reference_id}|${q.session_date}`) ?? 0}/{filteredData.length} attempted
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map(student => (
                                        <tr key={student.user_id}>
                                            <td className="sticky-col sticky-col-1 student-id">
                                                <div className="cell-with-copy">
                                                    <span title={student.user_id}>{student.user_id?.substring(0, 8)}...</span>
                                                    <button
                                                        className="copy-btn"
                                                        onClick={() => copyToClipboard(student.user_id, `id-${student.user_id}`)}
                                                        title="Copy full ID"
                                                    >
                                                        {copiedId === `id-${student.user_id}` ? <Check size={12} /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="sticky-col sticky-col-2 student-name">
                                                <div className="cell-with-copy">
                                                    <span>{student.student_name}</span>
                                                    <button
                                                        className="copy-btn"
                                                        onClick={() => copyToClipboard(student.student_name, `name-${student.user_id}`)}
                                                        title="Copy name"
                                                    >
                                                        {copiedId === `name-${student.user_id}` ? <Check size={12} /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </td>
                                            {(() => {
                                                const participation = getParticipationStatus(student);
                                                return (
                                                    <td
                                                        className="sticky-col sticky-col-3 participation-cell"
                                                        style={getParticipationStyle(participation.status)}
                                                        title={`${participation.participated}/${participation.eligible} correct (${participation.percentage.toFixed(1)}%)`}
                                                    >
                                                        <div className="participation-content">
                                                            <span className="participation-status">{participation.status}</span>
                                                            <span className="participation-percentage">{participation.percentage.toFixed(0)}%</span>
                                                        </div>
                                                    </td>
                                                );
                                            })()}
                                            {filteredQuestionsWithDates.map(q => {
                                                const status = getStatus(student, q.reference_id, q.session_date, q.session_id);
                                                return (
                                                    <td
                                                        key={`${student.user_id}-${q.reference_id}-${q.session_date}`}
                                                        className="status-cell"
                                                        style={getCellStyle(status)}
                                                        title={status}
                                                    >
                                                        {getAbbreviatedStatus(status)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div className="ica-legend">
                            <span className="legend-title">Status:</span>
                            <span className="legend-item" style={getCellStyle('Full Understanding')}>
                                Full = Full Understanding
                            </span>
                            <span className="legend-item" style={getCellStyle('No Understanding')}>
                                No Und. = No Understanding
                            </span>
                            <span className="legend-item" style={getCellStyle('No Attempt')}>
                                No Att. = No Attempt
                            </span>
                            <span className="legend-item" style={getCellStyle('ABSENT')}>
                                ABSENT = Student Absent
                            </span>
                            <span className="legend-item" style={getCellStyle('INACTIVE')}>
                                Inactive = Not Registered This Session
                            </span>
                        </div>
                        <div className="ica-legend">
                            <span className="legend-title">Participation:</span>
                            <span className="legend-item" style={getParticipationStyle('Above')}>
                                Above = &gt;80%
                            </span>
                            <span className="legend-item" style={getParticipationStyle('Optimal')}>
                                Optimal = 50-80%
                            </span>
                            <span className="legend-item" style={getParticipationStyle('Below')}>
                                Below = &lt;50%
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <MandatoryQuestionManager
                isOpen={showQuestionManager}
                onClose={() => setShowQuestionManager(false)}
                userEmail={user}
                onSaved={loadQuestionMetadata}
            />
        </>
    );
};

export default ICADashboardTab;
