import React, { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { Plus, X, Search, Users, ChevronDown, Calendar, Clock, BookOpen, User, Trash2, Edit3, Check, AlertCircle, Filter, Download, Upload, Save, Eye, EyeOff, Maximize, Minimize } from 'lucide-react';
import Navbar from "./Navbar";
import '../styles/TeacherUtilization.css';
import { supabase } from '../lib/supabaseClient.mjs';
import TeacherAssignmentTable from './TeacherAssignmentTable';
import TeacherUtilization from './TeacherUtilization';

const TeacherAssignment = ({ user, onLogout }) => {
    const [assignments, setAssignments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [timeRanges, setTimeRanges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingRow, setEditingRow] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: '',
        subject: '',
        grade: ''
    });
    const [columnWidths, setColumnWidths] = useState({});
    const resizingRef = useRef(null);

    const [showRecommendationModal, setShowRecommendationModal] = useState(false);
    const [showOthersModal, setShowOthersModal] = useState(false);
    const [currentRecommendationType, setCurrentRecommendationType] = useState('');
    const [currentRowIndex, setCurrentRowIndex] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [showStats, setShowStats] = useState(true);
    const [isAddingRow, setIsAddingRow] = useState(false);
    const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
    const [showAddRowId, setShowAddRowId] = useState(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [activeTab, setActiveTab] = useState('assignments');
    const [gradeForAllTeachers, setGradeForAllTeachers] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [columnFilters, setColumnFilters] = useState({});
    const [hasActiveFilters, setHasActiveFilters] = useState(false);

    useEffect(() => {
        const activeFiltersCount = Object.values(columnFilters).filter(
            value => value && value.trim() !== ''
        ).length;
        setHasActiveFilters(activeFiltersCount > 0);
    }, [columnFilters]);

    const [newAssignment, setNewAssignment] = useState({
        grade: '',
        subject: '',
        slot_name: '',
        rules: '',
        days: [],
        time_range: '',
        duration: '',
        status: 'Open',
        guru_juara_id: null,
        mentor_id: null,
        notes: '',
        class_capacity: 20,
        curriculum: '',
        batch_start_date: '',
        slot_start_date: '',
        slot_end_date: '',
        class_rule: 'Mandatory'
    });

    useEffect(() => {
        const saved = localStorage.getItem('ta_columnWidths');
        const initialWidths = saved
            ? JSON.parse(saved)
            : {
                actions: 100, grade: 80, subject: 150, slot_name: 180,
                rules: 120, days: 180, time: 120, status: 120,
                guru_juara: 200, mentor: 200, notes: 100, capacity: 100,
                curriculum: 150, batch_start_date: 120,
                slot_start_date: 120, slot_end_date: 120, class_rule: 120
            };
        setColumnWidths(initialWidths);
    }, []);

    const startResizing = (columnName, event) => {
        event.preventDefault();
        resizingRef.current = {
            columnName,
            startX: event.clientX,
            startWidth: columnWidths[columnName] || 100
        };
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResizing);
    };

    const renderTabNavigation = () => (
        <div className="tab-navigation">
            <button
                className={`tab-button ${activeTab === 'assignments' ? 'active' : ''}`}
                onClick={() => setActiveTab('assignments')}
            >
                <BookOpen size={16} />
                Teacher Assignments
            </button>
            <button
                className={`tab-button ${activeTab === 'utilization' ? 'active' : ''}`}
                onClick={() => setActiveTab('utilization')}
            >
                <Users size={16} />
                Teacher Utilization
            </button>
        </div>
    );

    const handleClearAllFilters = () => {
        setColumnFilters({});
    };

    const handleClearColumnFilter = (column) => {
        setColumnFilters(prev => {
            const updated = { ...prev };
            delete updated[column];
            return updated;
        });
    };

    const handleSort = (column) => {
        let direction = 'asc';
        if (sortConfig.key === column && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key: column, direction });
    };

    const handleColumnFilter = (column, value) => {
        setColumnFilters(prev => {
            const updated = { ...prev };
            if (!value || value.trim() === '') {
                delete updated[column];
            } else {
                updated[column] = value;
            }
            return updated;
        });
    };

    const handleResize = (event) => {
        if (!resizingRef.current) return;

        const { columnName, startX, startWidth } = resizingRef.current;
        const newWidth = startWidth + (event.clientX - startX);

        setColumnWidths(prev => ({
            ...prev,
            [columnName]: Math.max(50, newWidth)
        }));
    };

    const sortAssignments = (assignmentsArray) => {
        return assignmentsArray.sort((a, b) => {
            const classRuleA = a.class_rule || '';
            const classRuleB = b.class_rule || '';

            const getClassRulePriority = (rule) => {
                if (rule === 'Mandatory') return 0;
                if (rule === 'Non Mandatory') return 1;
                return 2;
            };

            const classRulePriorityA = getClassRulePriority(classRuleA);
            const classRulePriorityB = getClassRulePriority(classRuleB);

            if (classRulePriorityA !== classRulePriorityB) {
                return classRulePriorityA - classRulePriorityB;
            }

            const gradeA = parseInt(a.grade) || 0;
            const gradeB = parseInt(b.grade) || 0;

            if (gradeA !== gradeB) {
                return gradeA - gradeB;
            }

            const subjectA = a.subject || '';
            const subjectB = b.subject || '';
            const subjectComparison = subjectA.localeCompare(subjectB);
            if (subjectComparison !== 0) {
                return subjectComparison;
            }

            const slotA = a.slot_name || '';
            const slotB = b.slot_name || '';

            const parseSlotName = (slotName) => {
                const match = slotName.match(/^(.+?)\s+(\d+)$/);
                if (match) {
                    return {
                        name: match[1].trim(),
                        index: parseInt(match[2])
                    };
                }
                return {
                    name: slotName,
                    index: 0
                };
            };

            const parsedA = parseSlotName(slotA);
            const parsedB = parseSlotName(slotB);

            const nameComparison = parsedA.name.localeCompare(parsedB.name);
            if (nameComparison !== 0) {
                return nameComparison;
            }

            return parsedA.index - parsedB.index;
        });
    };

    const stopResizing = () => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResizing);
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && isFullScreen) {
                setIsFullScreen(false);
            }
            if (event.key === 'F11') {
                event.preventDefault();
                setIsFullScreen(!isFullScreen);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreen]);

    useEffect(() => {
        const loadData = async () => {
            const { data: subjectData, error: subjectError } = await supabase
                .from('subjects')
                .select('id, name');

            if (subjectError) throw new Error(subjectError);

            const { data: teacherData, error: teacherError } = await supabase
                .from('teacher_utilization')
                .select(`
          teacher_id,
          teacher_name,
          teacher_utilization_percentage,
          mentor_utilization_percentage,
          teachers!inner(
            id,
            teacher_leveling,
            subject,
            level,
            grade
          )
        `);
            if (teacherError) throw new Error(teacherError);
            const teachers = teacherData?.map(item => ({
                id: item.teachers.id,
                name: item.teacher_name,
                teacher_leveling: item.teachers.teacher_leveling,
                subject: item.teachers.subject,
                level: item.teachers.level,
                grade: item.teachers.grade,
                utilization: {
                    teacher_utilization_percentage: parseFloat(item.teacher_utilization_percentage),
                    mentor_utilization_percentage: parseFloat(item.mentor_utilization_percentage)
                }
            })) || [];

            const { data: slotData, error: slotError } = await supabase
                .from('teacher_assignment_slots')
                .select(`
          *,
          guru_juara:teachers!guru_juara_id(name),
          mentor:teachers!mentor_id(name)
        `);

            if (slotError) {
                console.error(slotError);
                return;
            }

            const assignments = slotData.map(s => ({
                id: s.id,
                grade: s.grade,
                subject: s.subject,
                slot_name: s.slot_name,
                rules: s.rules,
                days: s.days || [],
                time_range: s.time_range,
                duration: s.duration,
                status: s.status,
                guru_juara_id: s.guru_juara_id,
                mentor_id: s.mentor_id,
                notes: s.notes || '',
                class_capacity: s.class_capacity,
                curriculum: s.curriculum,
                batch_start_date: s.batch_start_date,
                slot_start_date: s.slot_start_date,
                slot_end_date: s.slot_end_date,
                class_rule: s.class_rule,
                guru_juara_name: s.guru_juara?.name || teachers.find(t => t.id === s.guru_juara_id)?.name || null,
                mentor_name: s.mentor?.name || teachers.find(t => t.id === s.mentor_id)?.name || null
            }));

            const uniqueTimeRanges = [...new Set(slotData
                .map(s => s.time_range)
                .filter(time => time && time.trim() !== '')
            )].sort();

            setSubjects(subjectData);
            setTeachers(teachers);
            setTimeRanges(uniqueTimeRanges);
            setAssignments(sortAssignments(assignments));
            setLoading(false);
        };

        loadData();
    }, []);

    const saveAssignmentToDatabase = async (assignmentData) => {
        try {
            const { data, error } = await supabase
                .from('teacher_assignment_slots')
                .insert([{
                    grade: assignmentData.grade,
                    subject: assignmentData.subject,
                    slot_name: assignmentData.slot_name,
                    rules: assignmentData.rules,
                    days: assignmentData.days,
                    time_range: assignmentData.time_range,
                    duration: assignmentData.duration,
                    status: assignmentData.status,
                    guru_juara_id: assignmentData.guru_juara_id,
                    mentor_id: assignmentData.mentor_id,
                    notes: assignmentData.notes,
                    class_capacity: assignmentData.class_capacity,
                    curriculum: assignmentData.curriculum,
                    batch_start_date: assignmentData.batch_start_date || null,
                    slot_start_date: assignmentData.slot_start_date || null,
                    slot_end_date: assignmentData.slot_end_date || null,
                    class_rule: assignmentData.class_rule || null,
                    created_by: user?.email,
                    created_at: new Date().toISOString()
                }])
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error saving assignment:', error);
            throw error;
        }
    };

    const updateAssignmentInDatabase = async (id, updatedData) => {
        try {
            const { data, error } = await supabase
                .from('teacher_assignment_slots')
                .update({
                    ...updatedData,
                    updated_by: user?.email,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error updating assignment:', error);
            throw error;
        }
    };

    const deleteAssignmentFromDatabase = async (id) => {
        try {
            const { error } = await supabase
                .from('teacher_assignment_slots')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting assignment:', error);
            throw error;
        }
    };

    const filteredAssignments = useMemo(() => {
        let result = [...assignments];

        // Apply column filters
        Object.entries(columnFilters).forEach(([column, filterValue]) => {
            if (filterValue && filterValue.trim() !== '') {
                result = result.filter(assignment => {
                    const cellValue = assignment[column];

                    if (column === 'days') {
                        return assignment.days?.some(day =>
                            day.toLowerCase().includes(filterValue.toLowerCase())
                        );
                    }

                    if (typeof cellValue === 'string') {
                        return cellValue.toLowerCase().includes(filterValue.toLowerCase());
                    }

                    if (typeof cellValue === 'number') {
                        return cellValue.toString() === filterValue.toString();
                    }

                    return String(cellValue || '').toLowerCase().includes(filterValue.toLowerCase());
                });
            }
        });

        // Apply search term (existing logic)
        if (searchTerm) {
            result = result.filter(assignment =>
                assignment.slot_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(assignment?.guru_juara_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(assignment?.mentor_name).toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply existing filters
        result = result.filter(assignment => {
            const matchesFilters =
                (!filters.status || assignment.status === filters.status) &&
                (!filters.subject || assignment.subject === filters.subject) &&
                (!filters.grade || assignment.grade.toString() === filters.grade);
            return matchesFilters;
        });

        // Apply sorting
        if (sortConfig.key) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                // Handle null/undefined values
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
                if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

                // Handle different data types
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                // Handle dates
                if (sortConfig.key.includes('date')) {
                    const dateA = new Date(aValue);
                    const dateB = new Date(bValue);
                    return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                }

                // Handle arrays (for days)
                if (Array.isArray(aValue) && Array.isArray(bValue)) {
                    const strA = aValue.join(',');
                    const strB = bValue.join(',');
                    return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
                }

                // Default string comparison
                const strA = String(aValue).toLowerCase();
                const strB = String(bValue).toLowerCase();
                return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
            });
        }

        return result;
    }, [assignments, columnFilters, sortConfig, searchTerm, filters]);


    const filteredTeachers = teachers.filter(teacher => {
        const matchSearch = (String(teacher?.name).toLocaleLowerCase().includes(modalSearchTerm.toLowerCase()) && Number(teacher?.grade) === Number(gradeForAllTeachers)) || (String(teacher?.name).toLocaleLowerCase().includes(modalSearchTerm.toLowerCase()) && String(teacher?.teacher_leveling).includes('Part Time'));
        return matchSearch;
    })

    const handleAddAssignment = async (insertAfterId = null, dataFromModal) => {
        if (!dataFromModal.subject || !dataFromModal.grade || !dataFromModal.slot_name) {
            alert('Please fill in required fields: Subject, Grade, and Slot Name');
            return;
        }

        try {
            setLoading(true);

            const assignment = {
                ...dataFromModal,
                grade: parseInt(dataFromModal.grade) || null,
                duration: parseInt(dataFromModal.duration) || null,
                class_capacity: parseInt(dataFromModal.class_capacity) || 20,
            };

            const savedAssignment = await saveAssignmentToDatabase(assignment);

            const assignmentWithNames = {
                ...savedAssignment,
                guru_juara_name: savedAssignment.guru_juara_id
                    ? teachers.find(t => t.id === savedAssignment.guru_juara_id)?.name
                    : null,
                mentor_name: savedAssignment.mentor_id
                    ? teachers.find(t => t.id === savedAssignment.mentor_id)?.name
                    : null
            };

            if (insertAfterId) {
                const idx = assignments.findIndex(a => a.id === insertAfterId);
                const updated = [...assignments];
                updated.splice(idx + 1, 0, assignmentWithNames);
                setAssignments(sortAssignments(updated));
            } else {
                setAssignments(prev => sortAssignments([...prev, assignmentWithNames]));
            }

            setShowAddRowId(null);
            setIsAddingRow(false);
            setNewAssignment({
                grade: '',
                subject: '',
                slot_name: '',
                rules: '',
                days: [],
                time_range: '',
                duration: '',
                status: 'Open',
                guru_juara_id: null,
                mentor_id: null,
                notes: '',
                class_capacity: 20,
                curriculum: '',
                batch_start_date: '',
                slot_start_date: '',
                slot_end_date: '',
                class_rule: 'Mandatory'
            });

            alert('Assignment added successfully!');
        } catch (error) {
            alert('Failed to add assignment: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleShowAddRow = (id) => {
        setShowAddRowId(id);
        setIsAddingRow(true);
        setNewAssignment({
            grade: '',
            subject: '',
            slot_name: '',
            rules: '',
            days: [],
            time_range: '',
            duration: '',
            status: 'Open',
            guru_juara_id: null,
            mentor_id: null,
            notes: '',
            class_capacity: 20,
            curriculum: '',
            batch_start_date: '',
            slot_start_date: '',
            slot_end_date: '',
            class_rule: 'Mandatory'
        });
    };

    const handleCancelAdd = () => {
        setIsAddingRow(false);
        setShowAddRowId(null);
        setNewAssignment({
            grade: '',
            subject: '',
            slot_name: '',
            rules: '',
            days: [],
            time_range: '',
            duration: '',
            status: 'Open',
            guru_juara_id: null,
            mentor_id: null,
            notes: '',
            class_capacity: 20,
            curriculum: '',
            batch_start_date: '',
            slot_start_date: '',
            slot_end_date: '',
            class_rule: 'Mandatory'
        });
    };

    const handleDeleteAssignment = async (id) => {
        if (window.confirm('Are you sure you want to delete this assignment?')) {
            try {
                setLoading(true);
                await deleteAssignmentFromDatabase(id);
                setAssignments(assignments.filter(a => a.id !== id));
                alert('Assignment deleted successfully!');
            } catch (error) {
                alert('Failed to delete assignment: ' + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleUpdateAssignment = async (id, updatedData) => {
        try {
            await updateAssignmentInDatabase(id, updatedData);

            setAssignments(assignments.map(a =>
                a.id === id
                    ? {
                        ...a,
                        ...updatedData,
                        updated_by: user,
                        updated_at: new Date().toISOString(),
                        guru_juara_name: updatedData.guru_juara_id
                            ? teachers.find(t => t.id === updatedData.guru_juara_id)?.name
                            : (updatedData.guru_juara_id === null ? null : a.guru_juara_name),
                        mentor_name: updatedData.mentor_id
                            ? teachers.find(t => t.id === updatedData.mentor_id)?.name
                            : (updatedData.mentor_id === null ? null : a.mentor_name)
                    }
                    : a
            ));
        } catch (error) {
            alert('Failed to update assignment: ' + error.message);
        }
    };

    const getTeacherRecommendations = (assignment) => {
        const { subject, grade, rules, class_rule } = assignment;

        if (class_rule === 'Mandatory') {
            let eligibleTeachers = teachers.filter(teacher =>
                teacher.subject === subject &&
                teacher.grade === grade &&
                teacher.teacher_leveling.includes('Guru Juara')
            );

            const priorityOrder = ['Guru Juara I', 'Guru Juara II', 'Guru Juara III', 'Guru Juara IV'];

            eligibleTeachers.sort((a, b) => {
                const aPriority = priorityOrder.indexOf(a.teacher_leveling);
                const bPriority = priorityOrder.indexOf(b.teacher_leveling);

                if (aPriority !== bPriority) return aPriority - bPriority;

                return a.utilization.teacher_utilization_percentage - b.utilization.teacher_utilization_percentage;
            });

            return eligibleTeachers.slice(0, 3);
        } else {
            let eligibleTeachers = teachers.filter(teacher => {
                const subjectMatch = teacher.subject === subject;
                const gradeMatch = teacher.grade === grade;
                const levelMatch = true;

                return (subjectMatch && gradeMatch && levelMatch) ||
                    (subjectMatch && gradeMatch) ||
                    (subjectMatch || gradeMatch);
            });

            return eligibleTeachers.slice(0, 5);
        }
    };

    const getMentorRecommendations = (assignment) => {
        const { subject, grade } = assignment;

        let eligibleMentors = teachers.filter(teacher =>
            teacher.subject === subject &&
            teacher.grade === grade &&
            (teacher.teacher_leveling === 'Mentor' || teacher.teacher_leveling === 'Mentor Part Time')
        );

        eligibleMentors.sort((a, b) =>
            a.utilization.mentor_utilization_percentage - b.utilization.mentor_utilization_percentage
        );

        return eligibleMentors.slice(0, 3);
    };

    const handleShowRecommendations = (rowIndex, type) => {
        const assignment = assignments[rowIndex];
        setCurrentRowIndex(rowIndex);
        setCurrentRecommendationType(type);

        if (type === 'guru_juara') {
            setRecommendations(getTeacherRecommendations(assignment));
        } else {
            setRecommendations(getMentorRecommendations(assignment));
        }

        setGradeForAllTeachers(assignment.grade);
        setShowRecommendationModal(true);
    };

    const handleSelectRecommendation = (teacherId) => {
        const field = currentRecommendationType === 'guru_juara' ? 'guru_juara_id' : 'mentor_id';
        handleUpdateAssignment(assignments[currentRowIndex].id, { [field]: teacherId });
        setShowRecommendationModal(false);
    };

    const activeTabInformation = {
        assignments: {
            title: "Teacher Assignment Management",
            description: "Assign teachers to classes and manage schedules"
        },
        utilization: {
            title: "Teacher Utilization Overview",
            description: "Monitor teacher workload and utilization status"
        }
    }

    const getUniqueValues = (data, column) => {
        const values = data.map(item => {
            const value = item[column];

            if (column === 'days' && Array.isArray(value)) {
                return value;
            }

            if (column === 'guru_juara_name' || column === 'mentor_name') {
                return value;
            }

            return value;
        }).filter(value => value != null && value !== '');

        const flattened = values.reduce((acc, val) => {
            if (Array.isArray(val)) {
                return [...acc, ...val];
            }
            return [...acc, val];
        }, []);

        const unique = [...new Set(flattened)];

        if (column === 'grade' || column === 'class_capacity') {
            return unique.sort((a, b) => Number(a) - Number(b));
        }

        if (column.includes('date')) {
            return unique.sort((a, b) => new Date(a) - new Date(b));
        }

        return unique.sort();
    };

    const getColumnValues = (column, excludeColumn = null) => {
        let filteredData = [...assignments];

        Object.entries(columnFilters).forEach(([filterColumn, filterValue]) => {
            if (filterColumn === excludeColumn || !filterValue || filterValue.trim() === '') {
                return;
            }

            filteredData = filteredData.filter(assignment => {
                const cellValue = assignment[filterColumn];

                if (filterColumn === 'days') {
                    return assignment.days?.some(day =>
                        day.toLowerCase().includes(filterValue.toLowerCase())
                    );
                }

                if (typeof cellValue === 'string') {
                    return cellValue.toLowerCase().includes(filterValue.toLowerCase());
                }

                if (typeof cellValue === 'number') {
                    return cellValue.toString() === filterValue.toString();
                }

                return String(cellValue || '').toLowerCase().includes(filterValue.toLowerCase());
            });
        });

        return getUniqueValues(filteredData, column);
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading assignments...</div>
            </div>
        );
    }

    return (
        <>
            <Navbar userEmail={user} onLogoutClick={onLogout} />
            <div className="teacher-assignment-container">
                <div className="header">
                    <div className="header-content">
                        <h1 className="title">{activeTabInformation[activeTab]?.title}</h1>
                        <p className="subtitle">{activeTabInformation[activeTab]?.description}</p>
                    </div>

                    {renderTabNavigation()}

                    {activeTab === 'assignments' && (
                        <div className="header-actions">
                            <button
                                onClick={() => setIsFullScreen(true)}
                                className="fullscreen-button"
                                title="Full Screen View"
                            >
                                <Maximize size={16} />
                                Full Screen
                            </button>
                            <div className="search-bar">
                                <Search className="search-icon" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search teacher name or slots.."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                            </div>

                            {hasActiveFilters && (
                                <div className="active-filters">
                                    <span className="active-filters-label">Active Filters:</span>
                                    {Object.entries(columnFilters).map(([column, value]) => (
                                        <div key={column} className="filter-tag">
                                            <span>{column}: {value}</span>
                                            <button
                                                onClick={() => handleClearColumnFilter(column)}
                                                className="filter-tag-remove"
                                                title={`Remove ${column} filter`}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleClearAllFilters}
                                        className="clear-all-filters"
                                        title="Clear all filters"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            )}

                            <div className="filter-dropdown">
                                <Filter size={18} />
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="filter-select"
                                >
                                    <option value="">All Status</option>
                                    <option value="Open">Open</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Upcoming">Upcoming</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab === 'assignments' ? (
                    <>
                        <button
                            className="secondary-button"
                            onClick={() => setShowStats(!showStats)}
                        >
                            {showStats ? <EyeOff size={16} /> : <Eye size={16} />}
                            {showStats ? 'Hide Stats' : 'Show Stats'}
                        </button>

                        {showStats && (<div className="stats-container">
                            <div className="stat-card stat-total">
                                <div className="stat-content">
                                    <BookOpen className="stat-icon" size={40} />
                                    <div>
                                        <p className="stat-label">Total Assignments</p>
                                        <p className="stat-value">{assignments.length}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-assigned">
                                <div className="stat-content">
                                    <Check className="stat-icon" size={40} />
                                    <div>
                                        <p className="stat-label">Assigned</p>
                                        <p className="stat-value">
                                            {assignments.filter(a => a.guru_juara_id || a.mentor_id).length}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-pending">
                                <div className="stat-content">
                                    <Clock className="stat-icon" size={40} />
                                    <div>
                                        <p className="stat-label">Pending</p>
                                        <p className="stat-value">
                                            {assignments.filter(a => a.status === 'Pending').length}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card stat-open">
                                <div className="stat-content">
                                    <AlertCircle className="stat-icon" size={40} />
                                    <div>
                                        <p className="stat-label">Open</p>
                                        <p className="stat-value">
                                            {assignments.filter(a => a.status === 'Open').length}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>)}

                        {!isFullScreen && (
                            <div className="spreadsheet-container">
                                <div className="table-header">
                                    <h3>Current Assignments</h3>
                                    <p>{filteredAssignments.length} assignments found</p>
                                </div>

                                <TeacherAssignmentTable
                                    assignments={assignments}
                                    subjects={subjects}
                                    teachers={teachers}
                                    timeRanges={timeRanges}
                                    editingRow={editingRow}
                                    setEditingRow={setEditingRow}
                                    hoveredRowIndex={hoveredRowIndex}
                                    setHoveredRowIndex={setHoveredRowIndex}
                                    isAddingRow={isAddingRow}
                                    showAddRowId={showAddRowId}
                                    handleShowAddRow={handleShowAddRow}
                                    handleDeleteAssignment={handleDeleteAssignment}
                                    handleUpdateAssignment={handleUpdateAssignment}
                                    handleAddAssignment={handleAddAssignment}
                                    handleCancelAdd={handleCancelAdd}
                                    newAssignment={newAssignment}
                                    setNewAssignment={setNewAssignment}
                                    handleShowRecommendations={handleShowRecommendations}
                                    columnWidths={columnWidths}
                                    startResizing={startResizing}
                                    filters={filters}
                                    filteredAssignments={filteredAssignments}
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    columnFilters={columnFilters}
                                    onColumnFilter={handleColumnFilter}
                                    getColumnValues={getColumnValues}
                                    onClearColumnFilter={handleClearColumnFilter}
                                    onClearAllFilters={handleClearAllFilters}
                                    hasActiveFilters={hasActiveFilters}
                                />
                            </div>
                        )}

                        {isFullScreen && (
                            <div className="fullscreen-overlay">
                                <div className="fullscreen-header">
                                    <h1 className="fullscreen-title">Teacher Assignment Management - Full View</h1>

                                    <div className="fullscreen-actions">
                                        <div className="filter-dropdown">
                                            <Filter size={18} />
                                            <select
                                                value={filters.status}
                                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                                className="filter-select"
                                            >
                                                <option value="">All Status</option>
                                                <option value="Open">Open</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Upcoming">Upcoming</option>
                                            </select>
                                        </div>

                                        {hasActiveFilters && (
                                            <div className="active-filters">
                                                <span className="active-filters-label">Active Filters:</span>
                                                {Object.entries(columnFilters).map(([column, value]) => (
                                                    <div key={column} className="filter-tag">
                                                        <span>{column}: {value}</span>
                                                        <button
                                                            onClick={() => handleClearColumnFilter(column)}
                                                            className="filter-tag-remove"
                                                            title={`Remove ${column} filter`}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={handleClearAllFilters}
                                                    className="clear-all-filters"
                                                    title="Clear all filters"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setIsFullScreen(false)}
                                            className="fullscreen-button exit"
                                            title="Exit Full Screen"
                                        >
                                            <Minimize size={16} />
                                            Exit Full Screen
                                        </button>
                                    </div>
                                </div>

                                <div className="fullscreen-spreadsheet-container">
                                    <div className="table-header">
                                        <h3>Current Assignments</h3>
                                        <p>{filteredAssignments.length} assignments found</p>
                                    </div>

                                    <TeacherAssignmentTable
                                        assignments={assignments}
                                        subjects={subjects}
                                        teachers={teachers}
                                        timeRanges={timeRanges}
                                        editingRow={editingRow}
                                        setEditingRow={setEditingRow}
                                        hoveredRowIndex={hoveredRowIndex}
                                        setHoveredRowIndex={setHoveredRowIndex}
                                        isAddingRow={isAddingRow}
                                        showAddRowId={showAddRowId}
                                        handleShowAddRow={handleShowAddRow}
                                        handleDeleteAssignment={handleDeleteAssignment}
                                        handleUpdateAssignment={handleUpdateAssignment}
                                        handleAddAssignment={handleAddAssignment}
                                        handleCancelAdd={handleCancelAdd}
                                        newAssignment={newAssignment}
                                        setNewAssignment={setNewAssignment}
                                        handleShowRecommendations={handleShowRecommendations}
                                        columnWidths={columnWidths}
                                        startResizing={startResizing}
                                        filters={filters}
                                        filteredAssignments={filteredAssignments}
                                        sortConfig={sortConfig}
                                        onSort={handleSort}
                                        columnFilters={columnFilters}
                                        onColumnFilter={handleColumnFilter}
                                        getColumnValues={getColumnValues}
                                        onClearColumnFilter={handleClearColumnFilter}
                                        onClearAllFilters={handleClearAllFilters}
                                        hasActiveFilters={hasActiveFilters}
                                    />
                                </div>
                            </div>
                        )}
                    </>) : (
                    <TeacherUtilization />
                )}

                {showRecommendationModal && (
                    <div className="recommendation-modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3 className="modal-title">
                                    {currentRecommendationType === 'guru_juara' ? 'Guru Juara Recommendations' : 'Mentor Recommendations'}
                                </h3>
                                <button
                                    onClick={() => setShowRecommendationModal(false)}
                                    className="modal-close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="recommendations-list">
                                {recommendations.length > 0 ? (
                                    recommendations.map((teacher, index) => (
                                        <div key={teacher.id} className="recommendation-item">
                                            <div className="teacher-info">
                                                <div className="teacher-header">
                                                    <h4 className="teacher-name">{teacher.name}</h4>
                                                    {index < 3 && (
                                                        <span className="top-badge">
                                                            Top {index + 1}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="teacher-details">
                                                    <p><strong>Level:</strong> {teacher.teacher_leveling}</p>
                                                    <p><strong>Subject:</strong> {teacher.subject} | <strong>Grade:</strong> {teacher.grade}</p>
                                                    <p>
                                                        <strong>Teacher Utilization:</strong> {teacher.utilization.teacher_utilization_percentage}% |
                                                        <strong> Mentor Utilization:</strong> {teacher.utilization.mentor_utilization_percentage}%
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleSelectRecommendation(teacher.id)}
                                                className="select-button"
                                            >
                                                <Check size={16} />
                                                Select
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-recommendations">
                                        <p>No recommendations found. Please try different criteria.</p>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button
                                    onClick={() => setShowOthersModal(true)}
                                    className="others-button"
                                >
                                    <Search size={16} />
                                    View All Teachers
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* All Teachers Modal */}
                {showOthersModal && (
                    <div className="modal-overlay">
                        <div className="modal-content large-modal">
                            <div className='modal-top'>
                                <div className="modal-header">
                                    <h3 className="modal-title">All Available Teachers</h3>
                                    <button
                                        onClick={() => setShowOthersModal(false)}
                                        className="modal-close"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="search-container">
                                    <Search className="search-icon" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search teachers..."
                                        onChange={e => setModalSearchTerm(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                            </div>

                            <div className="teachers-list">
                                {filteredTeachers.length > 0 ? (
                                    filteredTeachers.map((teacher) => (
                                        <div key={teacher.id} className="teacher-item">
                                            <div className="teacher-info">
                                                <div className="teacher-header">
                                                    <h4 className="teacher-name">{teacher.name}</h4>
                                                    <span className={`level-badge level-${teacher.teacher_leveling.replace(/\s+/g, '-').toLowerCase()}`}>
                                                        {teacher.teacher_leveling}
                                                    </span>
                                                </div>
                                                <div className="teacher-details">
                                                    <p><strong>Subject:</strong> {teacher.subject} | <strong>Grade:</strong> {teacher.grade} | <strong>Level:</strong> {teacher.level}</p>
                                                    <p>
                                                        <strong>Teacher Utilization:</strong> {teacher.utilization.teacher_utilization_percentage}% |
                                                        <strong> Mentor Utilization:</strong> {teacher.utilization.mentor_utilization_percentage}%
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    handleSelectRecommendation(teacher.id);
                                                    setShowOthersModal(false);
                                                }}
                                                className="select-button secondary"
                                            >
                                                <Check size={16} />
                                                Select
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-teachers">
                                        <p>No teachers available.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default TeacherAssignment;