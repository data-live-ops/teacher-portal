import React, { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { Plus, X, Search, Users, ChevronDown, Calendar, Clock, BookOpen, User, Trash2, Edit3, Check, AlertCircle, Filter, Download, Upload, Save, Eye, EyeOff, Maximize, Minimize, Settings, RefreshCw, FlaskConical } from 'lucide-react';
import Navbar from "./Navbar";
import '../styles/TeacherUtilization.css';
import { supabase } from '../lib/supabaseClient.mjs';
import TeacherAssignmentTable from './TeacherAssignmentTable';
import TeacherUtilization from './TeacherUtilization';
import { useTeacherAssignmentValidation } from '../hooks/useTeacherAssignmentValidation';
import SemesterManager from './SemesterManager';
import ImportAssignmentModal from './ImportAssignmentModal';
import ExportAssignmentModal from './ExportAssignmentModal';
import TestDataInjectionModal from './TestDataInjectionModal';
import { fetchGoogleSheetData, parseSheetDataToAssignments, validateAssignments } from '../utils/googleSheetsImporter';
import { formatAssignmentsForExport, exportToGoogleSheet } from '../utils/googleSheetsExporter';
import { usePermissions } from '../contexts/PermissionContext';
import { sanitizeAssignmentData } from '../utils/sanitizeAssignmentData';

const TeacherAssignment = ({ user, onLogout }) => {
    const { canEdit } = usePermissions();
    const hasEditPermission = canEdit('teacher_assignment');
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

    // Semester states
    const [semesters, setSemesters] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState(null);
    const [showSemesterManager, setShowSemesterManager] = useState(false);

    const [isResyncingData, setIsResyncingData] = useState(false);

    const [showSlotNormalizationModal, setShowSlotNormalizationModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showDataActionsDropdown, setShowDataActionsDropdown] = useState(false);
    const [showTestDataModal, setShowTestDataModal] = useState(false);
    const [slotNormalizationData, setSlotNormalizationData] = useState({
        grade: '',
        originalSlotName: '',
        normalizedSlotName: '',
        notes: ''
    });
    const [unmatchedSlots, setUnmatchedSlots] = useState([]);
    const [normalizedSlots, setNormalizedSlots] = useState([]);
    const { validateAssignment, validationState } = useTeacherAssignmentValidation();

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
                actions: 200, grade: 120, subject: 150, slot_name: 180,
                rules: 120, days: 120, time_range: 120, status: 120,
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
            // Sort by Grade first
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
                const matchWithSuffix = slotName.match(/^(.+?)\s+(\d+)\s*\((\d+)x\)$/i);
                const matchWithoutSuffix = slotName.match(/^(.+?)\s+(\d+)$/);

                if (matchWithSuffix) {
                    return {
                        baseName: matchWithSuffix[1].trim(),
                        index: parseInt(matchWithSuffix[2]),
                        frequency: parseInt(matchWithSuffix[3])
                    };
                } else if (matchWithoutSuffix) {
                    return {
                        baseName: matchWithoutSuffix[1].trim(),
                        index: parseInt(matchWithoutSuffix[2]),
                        frequency: 0
                    };
                }
                return {
                    baseName: slotName,
                    index: 0,
                    frequency: 0
                };
            };

            const parsedA = parseSlotName(slotA);
            const parsedB = parseSlotName(slotB);

            const baseNameComparison = parsedA.baseName.localeCompare(parsedB.baseName);
            if (baseNameComparison !== 0) {
                return baseNameComparison;
            }

            if (parsedA.frequency !== parsedB.frequency) {
                return parsedA.frequency - parsedB.frequency;
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
        loadSemesters();
    }, []);

    useEffect(() => {
        if (selectedSemester) {
            loadData();
        }
    }, [selectedSemester]);

    const loadSemesters = async () => {
        try {
            const { data, error } = await supabase
                .from('semesters')
                .select('*')
                .order('start_date', { ascending: false });

            if (error) throw error;

            setSemesters(data || []);

            // Auto-select active semester or latest
            const activeSemester = data?.find(s => s.is_active);
            setSelectedSemester(activeSemester || data?.[0] || null);
        } catch (error) {
            console.error('Error loading semesters:', error);
            alert('Failed to load semesters: ' + error.message);
        }
    };

    const loadData = async () => {
        if (!selectedSemester) return;

        try {
            const { data: subjectData, error: subjectError } = await supabase
                .from('subjects')
                .select('id, name');

            if (subjectError) throw new Error(subjectError);

            const { data: allTeachersData, error: allTeachersError } = await supabase
                .from('teachers_new')
                .select('*')
                .eq('is_active', true);

            if (allTeachersError) throw new Error(allTeachersError);

            // Load teacher subjects (capabilities)
            const { data: teacherSubjectsData, error: teacherSubjectsError } = await supabase
                .from('teacher_subjects')
                .select('*')
                .eq('is_active', true);

            if (teacherSubjectsError) throw new Error(teacherSubjectsError);

            // Then get utilization data - filter by selected semester
            const { data: utilizationData, error: utilizationError } = await supabase
                .from('teacher_utilization')
                .select('teacher_id, teacher_name, teacher_utilization_percentage, mentor_utilization_percentage')
                .eq('semester_id', selectedSemester.id);

            if (utilizationError) throw new Error(utilizationError);

            // Create a map of utilization by teacher name
            const utilizationMap = {};
            utilizationData?.forEach(item => {
                utilizationMap[item.teacher_name] = {
                    teacher_utilization_percentage: parseFloat(item.teacher_utilization_percentage || 0),
                    mentor_utilization_percentage: parseFloat(item.mentor_utilization_percentage || 0)
                };
            });

            // Create teacher records WITH subject capabilities
            // Each teacher-subject combination becomes a separate record for recommendations
            const teachers = [];
            allTeachersData?.forEach(teacher => {
                const teacherCapabilities = teacherSubjectsData?.filter(ts => ts.teacher_id === teacher.id) || [];

                if (teacherCapabilities.length > 0) {
                    // Create one record per subject capability
                    teacherCapabilities.forEach(capability => {
                        teachers.push({
                            id: teacher.id,
                            name: teacher.name,
                            teacher_leveling: teacher.teacher_leveling,
                            subject: capability.subject,
                            level: capability.level,
                            grade: capability.grade,
                            utilization: utilizationMap[teacher.name] || {
                                teacher_utilization_percentage: 0,
                                mentor_utilization_percentage: 0
                            }
                        });
                    });
                } else {
                    // Teacher without subjects (for backward compatibility)
                    teachers.push({
                        id: teacher.id,
                        name: teacher.name,
                        teacher_leveling: teacher.teacher_leveling,
                        subject: null,
                        level: null,
                        grade: null,
                        utilization: utilizationMap[teacher.name] || {
                            teacher_utilization_percentage: 0,
                            mentor_utilization_percentage: 0
                        }
                    });
                }
            });

            const { data: slotData, error: slotError } = await supabase
                .from('teacher_assignment_slots')
                .select(`
          *,
          guru_juara:teachers_new!guru_juara_id(name),
          mentor:teachers_new!mentor_id(name)
        `)
                .eq('semester_id', selectedSemester.id); // Filter by selected semester

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
        } catch (error) {
            console.error('Error loading data:', error);
            setLoading(false);
        }
    };

    const saveAssignmentToDatabase = async (assignmentData) => {
        try {
            // FIX: Sanitize data to convert empty strings to null for date fields
            const sanitizedData = sanitizeAssignmentData(assignmentData);

            const { data, error } = await supabase
                .from('teacher_assignment_slots')
                .insert([{
                    grade: sanitizedData.grade,
                    subject: sanitizedData.subject,
                    slot_name: sanitizedData.slot_name,
                    rules: sanitizedData.rules,
                    days: sanitizedData.days,
                    time_range: sanitizedData.time_range,
                    duration: sanitizedData.duration,
                    status: sanitizedData.status,
                    guru_juara_id: sanitizedData.guru_juara_id,
                    mentor_id: sanitizedData.mentor_id,
                    notes: sanitizedData.notes,
                    class_capacity: sanitizedData.class_capacity,
                    curriculum: sanitizedData.curriculum,
                    batch_start_date: sanitizedData.batch_start_date,
                    slot_start_date: sanitizedData.slot_start_date,
                    slot_end_date: sanitizedData.slot_end_date,
                    class_rule: sanitizedData.class_rule || null,
                    semester_id: selectedSemester.id,
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
            console.log('updateAssignmentInDatabase called with id:', id, 'data:', updatedData);

            // FIX: Sanitize data to convert empty strings to null for date fields
            const sanitizedData = sanitizeAssignmentData(updatedData);
            console.log('Sanitized data:', sanitizedData);

            const { data, error } = await supabase
                .from('teacher_assignment_slots')
                .update({
                    ...sanitizedData,
                    updated_by: user?.email,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();

            console.log('Supabase update response - data:', data, 'error:', error);

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

        Object.entries(columnFilters).forEach(([column, filterValue]) => {
            if (filterValue && filterValue.trim() !== '') {
                let filterValues = [];
                try {
                    const parsed = JSON.parse(filterValue);
                    filterValues = Array.isArray(parsed) ? parsed : [filterValue];
                } catch {
                    filterValues = [filterValue];
                }

                result = result.filter(assignment => {
                    const cellValue = assignment[column];

                    if (filterValues.length > 1 || (filterValues.length === 1 && filterValue.startsWith('['))) {
                        if (column === 'days') {
                            return assignment.days?.some(day =>
                                filterValues.some(fv =>
                                    String(day).toLowerCase().includes(String(fv).toLowerCase())
                                )
                            );
                        }

                        if (typeof cellValue === 'string') {
                            return filterValues.some(fv =>
                                cellValue.toLowerCase() === String(fv).toLowerCase()
                            );
                        }

                        if (typeof cellValue === 'number') {
                            return filterValues.some(fv =>
                                cellValue.toString() === String(fv).toString() ||
                                cellValue === Number(fv)
                            );
                        }

                        return filterValues.some(fv =>
                            String(cellValue || '').toLowerCase() === String(fv).toLowerCase()
                        );
                    } else {
                        const singleFilterValue = filterValues[0];

                        if (column === 'days') {
                            return assignment.days?.some(day =>
                                String(day).toLowerCase().includes(String(singleFilterValue).toLowerCase())
                            );
                        }

                        if (typeof cellValue === 'string') {
                            return cellValue.toLowerCase().includes(String(singleFilterValue).toLowerCase());
                        }

                        if (typeof cellValue === 'number') {
                            return cellValue.toString() === String(singleFilterValue).toString() ||
                                cellValue === Number(singleFilterValue);
                        }

                        return String(cellValue || '').toLowerCase().includes(String(singleFilterValue).toLowerCase());
                    }
                });
            }
        });

        if (searchTerm) {
            result = result.filter(assignment =>
                assignment.slot_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(assignment?.guru_juara_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(assignment?.mentor_name).toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        result = result.filter(assignment => {
            const matchesFilters =
                (!filters.status || assignment.status === filters.status) &&
                (!filters.subject || assignment.subject === filters.subject) &&
                (!filters.grade || (assignment.grade && assignment.grade.toString() === filters.grade));
            return matchesFilters;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
                if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                if (sortConfig.key.includes('date')) {
                    const dateA = new Date(aValue);
                    const dateB = new Date(bValue);
                    return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                }

                if (Array.isArray(aValue) && Array.isArray(bValue)) {
                    const strA = aValue.join(',');
                    const strB = bValue.join(',');
                    return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
                }

                const strA = String(aValue).toLowerCase();
                const strB = String(bValue).toLowerCase();
                return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
            });
        }

        return result;
    }, [assignments, columnFilters, sortConfig, searchTerm, filters]);


    // FIX: Deduplicate teachers and fix search
    const filteredTeachers = useMemo(() => {
        // First, deduplicate teachers by ID
        const uniqueTeachersMap = new Map();

        teachers.forEach(teacher => {
            if (!uniqueTeachersMap.has(teacher.id)) {
                // First occurrence - store it
                uniqueTeachersMap.set(teacher.id, {
                    ...teacher,
                    // Aggregate subjects for display
                    allSubjects: [teacher.subject],
                    allGrades: [teacher.grade],
                    allLevels: [teacher.level]
                });
            } else {
                // Duplicate - merge subjects/grades/levels
                const existing = uniqueTeachersMap.get(teacher.id);
                if (teacher.subject && !existing.allSubjects.includes(teacher.subject)) {
                    existing.allSubjects.push(teacher.subject);
                }
                if (teacher.grade && !existing.allGrades.includes(teacher.grade)) {
                    existing.allGrades.push(teacher.grade);
                }
                if (teacher.level && !existing.allLevels.includes(teacher.level)) {
                    existing.allLevels.push(teacher.level);
                }
            }
        });

        // Convert map to array
        const uniqueTeachers = Array.from(uniqueTeachersMap.values());

        // Apply search filter
        if (!modalSearchTerm.trim()) {
            // No search term - show all unique teachers
            return uniqueTeachers;
        }

        const searchLower = modalSearchTerm.toLowerCase().trim();

        return uniqueTeachers.filter(teacher => {
            // Search in name
            const nameMatch = teacher.name?.toLowerCase().includes(searchLower);

            // Search in teacher leveling
            const levelingMatch = teacher.teacher_leveling?.toLowerCase().includes(searchLower);

            // Search in subjects
            const subjectMatch = teacher.allSubjects?.some(s =>
                s?.toLowerCase().includes(searchLower)
            );

            // Match if ANY field matches
            return nameMatch || levelingMatch || subjectMatch;
        });
    }, [teachers, modalSearchTerm]);

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

            // Validate for Mandatory classes
            if (assignment.class_rule === 'Mandatory' && assignment.guru_juara_id) {
                const validationResult = await validateAssignment(assignment);

                if (!validationResult.success) {
                    const errorMessage = validationResult.errors
                        ? validationResult.errors.join('\n\n')
                        : validationResult.message;

                    alert(`⚠️ VALIDATION FAILED\n\n${errorMessage}`);
                    setLoading(false);
                    return;
                }
            }

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

            alert('✅ Assignment added successfully!');
        } catch (error) {
            alert('❌ Failed to add assignment: ' + error.message);
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

    const handleBulkDeleteAssignments = async (ids) => {
        if (!ids || ids.length === 0) return;

        try {
            setLoading(true);

            // Delete all selected assignments from database
            const { error } = await supabase
                .from('teacher_assignment_slots')
                .delete()
                .in('id', ids);

            if (error) throw error;

            // Update local state
            setAssignments(prev => prev.filter(a => !ids.includes(a.id)));

            alert(`Successfully deleted ${ids.length} assignment(s)!`);
        } catch (error) {
            console.error('Bulk delete error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Bulk update status with validation
    const handleBulkUpdateStatus = async (ids, newStatus) => {
        if (!ids || ids.length === 0) return;

        try {
            setLoading(true);

            // Get assignments to update
            const assignmentsToUpdate = assignments.filter(a => ids.includes(a.id));

            // For status change to Open/Upcoming, validate Mandatory classes against raw_sessions
            if (newStatus === 'Open' || newStatus === 'Upcoming') {
                const mandatoryAssignments = assignmentsToUpdate.filter(a => a.class_rule === 'Mandatory');

                if (mandatoryAssignments.length > 0) {
                    const validationResults = [];
                    const failedValidations = [];

                    // Validate each mandatory assignment
                    for (const assignment of mandatoryAssignments) {
                        const result = await validateAssignment({
                            ...assignment,
                            status: newStatus
                        });

                        validationResults.push({
                            assignment,
                            result
                        });

                        if (!result.success) {
                            failedValidations.push({
                                slot_name: assignment.slot_name,
                                grade: assignment.grade,
                                errors: result.errors || ['Validation failed'],
                                matched_sessions: result.matched_sessions || 0
                            });
                        }
                    }

                    // If any validation failed, show errors and ask user
                    if (failedValidations.length > 0) {
                        const failedList = failedValidations
                            .map(f => `• Grade ${f.grade} - ${f.slot_name}: ${f.errors[0]} (${f.matched_sessions} sessions)`)
                            .join('\n');

                        const passedCount = mandatoryAssignments.length - failedValidations.length;
                        const nonMandatoryCount = assignmentsToUpdate.length - mandatoryAssignments.length;

                        const message = `⚠️ VALIDATION FAILED\n\n` +
                            `${failedValidations.length} Mandatory assignment(s) failed validation:\n\n` +
                            `${failedList}\n\n` +
                            `These slots don't exist in Ajar/raw_sessions data.\n\n` +
                            `Options:\n` +
                            `• Click "OK" to update only VALID assignments (${passedCount} Mandatory + ${nonMandatoryCount} Non-Mandatory = ${passedCount + nonMandatoryCount} total)\n` +
                            `• Click "Cancel" to abort and Resync Data Ajar first`;

                        if (!window.confirm(message)) {
                            setLoading(false);
                            return;
                        }

                        // Remove failed assignments from update list
                        const failedIds = failedValidations.map(f =>
                            mandatoryAssignments.find(a =>
                                a.slot_name === f.slot_name && a.grade === f.grade
                            )?.id
                        ).filter(Boolean);

                        ids = ids.filter(id => !failedIds.includes(id));

                        if (ids.length === 0) {
                            alert('No valid assignments to update.');
                            setLoading(false);
                            return;
                        }
                    }
                }
            }

            // Update status in database
            const { error } = await supabase
                .from('teacher_assignment_slots')
                .update({ status: newStatus })
                .in('id', ids);

            if (error) throw error;

            // Update local state
            setAssignments(prev =>
                prev.map(a => ids.includes(a.id) ? { ...a, status: newStatus } : a)
            );

            alert(`Successfully updated ${ids.length} assignment(s) to "${newStatus}"!`);
        } catch (error) {
            console.error('Bulk status update error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAssignment = async (id, updatedData) => {
        try {
            console.log('handleUpdateAssignment called with id:', id, 'updatedData:', updatedData);

            // Get current assignment data
            const currentAssignment = assignments.find(a => a.id === id);

            if (!currentAssignment) {
                throw new Error('Assignment not found');
            }

            // Check if teacher or status is being changed
            const isTeacherChange = updatedData.hasOwnProperty('guru_juara_id');
            const isStatusChange = updatedData.hasOwnProperty('status');

            // Only validate if it's a Mandatory class AND (teacher or status changes)
            if (currentAssignment.class_rule === 'Mandatory' && (isTeacherChange || isStatusChange)) {
                // Prepare full assignment data for validation
                const assignmentToValidate = {
                    ...currentAssignment,
                    ...updatedData
                };

                // Call validation function
                const validationResult = await validateAssignment(assignmentToValidate);

                if (!validationResult.success) {
                    // Show errors
                    const errorMessage = validationResult.errors
                        ? validationResult.errors.join('\n\n')
                        : validationResult.message;

                    const shouldProceed = window.confirm(
                        `⚠️ VALIDATION FAILED\n\n${errorMessage}\n\n` +
                        `Would you like to:\n\n` +
                        `• Click "OK" to Resync Data Ajar first\n` +
                        `• Click "Cancel" to fix manually\n\n` +
                        `Matched sessions: ${validationResult.matched_sessions || 0}`
                    );

                    if (shouldProceed) {
                        // Trigger resync
                        await handleResyncDataAjar();
                        return; // Don't proceed with update
                    } else {
                        throw new Error('Validation failed. Please check the data.');
                    }
                }

                // Show warnings if any
                if (validationResult.warnings && validationResult.warnings.length > 0) {
                    const warningMessage = validationResult.warnings.join('\n');
                    const proceedWithWarnings = window.confirm(
                        `⚡ WARNING\n\n${warningMessage}\n\nDo you want to proceed?`
                    );

                    if (!proceedWithWarnings) {
                        return;
                    }
                }

                console.log('✅ Validation passed:', validationResult);
            }

            // Proceed with update
            await updateAssignmentInDatabase(id, updatedData);

            const updatedAssignments = assignments.map(a => {
                if (a.id === id) {
                    const updated = {
                        ...a,
                        ...updatedData,
                        updated_by: user?.email,
                        updated_at: new Date().toISOString(),
                        guru_juara_name: updatedData.guru_juara_id
                            ? teachers.find(t => t.id === updatedData.guru_juara_id)?.name
                            : (updatedData.guru_juara_id === null ? null : a.guru_juara_name),
                        mentor_name: updatedData.mentor_id
                            ? teachers.find(t => t.id === updatedData.mentor_id)?.name
                            : (updatedData.mentor_id === null ? null : a.mentor_name)
                    };
                    return updated;
                }
                return a;
            });

            setAssignments(updatedAssignments);

            if (isTeacherChange) {
                alert('✅ Teacher assignment updated successfully!');
            }
        } catch (error) {
            console.error('Update failed:', error);
            alert('❌ Failed to update assignment: ' + error.message);
        }
    };

    const getTeacherRecommendations = (assignment) => {
        const { subject, grade, rules, class_rule } = assignment;

        console.log('getTeacherRecommendations - assignment:', assignment);
        console.log('Looking for - subject:', subject, 'grade:', grade, 'class_rule:', class_rule);
        console.log('Available teachers:', teachers.length);

        if (class_rule === 'Mandatory') {
            let eligibleTeachers = teachers.filter(teacher => {
                const matches = teacher.subject === subject &&
                    teacher.grade == grade &&
                    teacher.teacher_leveling.includes('Guru Juara');

                if (matches) {
                    console.log('Matching teacher:', teacher.name, teacher.subject, teacher.grade, teacher.teacher_leveling);
                }

                return matches;
            });

            console.log('Eligible teachers found:', eligibleTeachers.length);

            const priorityOrder = ['Guru Juara I', 'Guru Juara II', 'Guru Juara III', 'Guru Juara IV'];

            eligibleTeachers.sort((a, b) => {
                const aPriority = priorityOrder.indexOf(a.teacher_leveling);
                const bPriority = priorityOrder.indexOf(b.teacher_leveling);

                if (aPriority !== bPriority) return aPriority - bPriority;

                return a.utilization.teacher_utilization_percentage - b.utilization.teacher_utilization_percentage;
            });

            // Remove duplicates based on teacher id, keeping first match
            const uniqueTeachers = [];
            const seenIds = new Set();
            eligibleTeachers.forEach(teacher => {
                if (!seenIds.has(teacher.id)) {
                    uniqueTeachers.push(teacher);
                    seenIds.add(teacher.id);
                }
            });

            return uniqueTeachers.slice(0, 3);
        } else {
            let eligibleTeachers = teachers.filter(teacher => {
                const subjectMatch = teacher.subject === subject;
                const gradeMatch = teacher.grade == grade;
                const levelMatch = true;

                const matches = (subjectMatch && gradeMatch && levelMatch) ||
                    (subjectMatch && gradeMatch) ||
                    (subjectMatch || gradeMatch);

                if (matches) {
                    console.log('Non-mandatory match:', teacher.name, 'subject:', subjectMatch, 'grade:', gradeMatch);
                }

                return matches;
            });

            console.log('Eligible teachers for non-mandatory:', eligibleTeachers.length);

            const uniqueTeachers = [];
            const seenIds = new Set();
            eligibleTeachers.forEach(teacher => {
                if (!seenIds.has(teacher.id)) {
                    uniqueTeachers.push(teacher);
                    seenIds.add(teacher.id);
                }
            });

            return uniqueTeachers.slice(0, 5);
        }
    };

    const getMentorRecommendations = (assignment) => {
        const { subject, grade } = assignment;

        console.log('getMentorRecommendations - Looking for mentors (All Grade & All Subject)');

        // Mentors have "All Grade & All Subject" - only filter by Mentor level
        let eligibleMentors = teachers.filter(teacher => {
            const isMentor = teacher.teacher_leveling === 'Mentor' || teacher.teacher_leveling === 'Mentor Part Time';

            if (isMentor) {
                console.log('Found mentor:', teacher.name, 'utilization:', teacher.utilization?.mentor_utilization_percentage);
            }

            return isMentor;
        });

        console.log('Eligible mentors found:', eligibleMentors.length);

        // Sort by utilization (lowest first) - mentors don't need subject/grade match
        eligibleMentors.sort((a, b) => {
            const aUtil = a.utilization?.mentor_utilization_percentage || 0;
            const bUtil = b.utilization?.mentor_utilization_percentage || 0;
            return aUtil - bUtil;
        });

        // Remove duplicates by teacher ID
        const uniqueMentors = [];
        const seenIds = new Set();
        eligibleMentors.forEach(mentor => {
            if (!seenIds.has(mentor.id)) {
                uniqueMentors.push(mentor);
                seenIds.add(mentor.id);
            }
        });

        return uniqueMentors.slice(0, 5);  // Return top 5 mentors with lowest utilization
    };

    const handleShowRecommendations = (rowIndex, type, formData = null, setFormData = null) => {
        // Check if this is from modal (formData will be passed)
        if (formData && setFormData) {
            // Modal mode: use formData for recommendations
            const tempAssignment = {
                ...formData,
                grade: formData.grade,
                subject: formData.subject,
                class_rule: formData.class_rule
            };

            setCurrentRecommendationType(type);

            if (type === 'guru_juara') {
                setRecommendations(getTeacherRecommendations(tempAssignment));
            } else {
                setRecommendations(getMentorRecommendations(tempAssignment));
            }

            setGradeForAllTeachers(formData.grade);

            // Store modal callback for later use
            window._modalSetFormData = setFormData;
            window._modalFormData = formData;
            window._isModalMode = true;
        } else {
            // Table mode: use existing assignment
            const assignment = filteredAssignments[rowIndex];
            const actualIndex = assignments.findIndex(a => a.id === assignment.id);

            console.log('handleShowRecommendations - rowIndex:', rowIndex, 'actualIndex:', actualIndex, 'assignment:', assignment);

            setCurrentRowIndex(actualIndex);
            setCurrentRecommendationType(type);

            if (type === 'guru_juara') {
                setRecommendations(getTeacherRecommendations(assignment));
            } else {
                setRecommendations(getMentorRecommendations(assignment));
            }

            setGradeForAllTeachers(assignment.grade);

            window._isModalMode = false;
        }

        setShowRecommendationModal(true);
        console.log('Recommendations modal opened');
    };

    const fetchUnmatchedSlots = async () => {
        try {
            const { data, error } = await supabase.rpc('monitor_teacher_assignment_coverage');
            if (error) throw error;

            console.log('Raw unmatched slots data:', data);

            const unmatchedFiltered = (data || []).filter(item =>
                item &&
                !item.has_assignment &&
                item.grade &&
                item.slot_name &&
                item.total_sessions_affected > 0
            );

            const uniqueUnmatched = [];
            const seenCombinations = new Set();

            unmatchedFiltered.forEach(item => {
                const key = `${item.grade}_${item.slot_name}`;
                if (!seenCombinations.has(key)) {
                    seenCombinations.add(key);
                    const totalSessions = unmatchedFiltered
                        .filter(i => i.grade === item.grade && i.slot_name === item.slot_name)
                        .reduce((sum, i) => sum + (i.total_sessions_affected || 0), 0);

                    uniqueUnmatched.push({
                        ...item,
                        total_sessions_affected: totalSessions
                    });
                }
            });

            console.log('Processed unmatched slots (unique):', uniqueUnmatched);
            setUnmatchedSlots(uniqueUnmatched);
        } catch (error) {
            console.error('Error fetching unmatched slots:', error);
            setUnmatchedSlots([]);
        }
    };

    const fetchNormalizedSlots = async () => {
        try {
            const { data, error } = await supabase
                .from('slot_normalized')
                .select('*')
                .eq('is_active', true)
                .order('grade', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log('Fetched normalized slots:', data);
            setNormalizedSlots(data || []);
        } catch (error) {
            console.error('Error fetching normalized slots:', error);
            setNormalizedSlots([]);
        }
    };

    const handleShowSlotNormalization = () => {
        console.log('Current assignments:', assignments);
        console.log('Assignments with null/undefined grade:', assignments.filter(a => !a.grade));
        fetchUnmatchedSlots();
        fetchNormalizedSlots();
        setShowSlotNormalizationModal(true);
    };

    const handleSlotNormalizationSubmit = async () => {
        try {
            const { error } = await supabase
                .from('slot_normalized')
                .insert({
                    grade: slotNormalizationData.grade,
                    original_slot_name: slotNormalizationData.originalSlotName,
                    normalized_slot_name: slotNormalizationData.normalizedSlotName,
                    created_by: user?.email,
                    notes: slotNormalizationData.notes
                });

            if (error) throw error;

            alert('Slot normalization saved successfully!');
            setSlotNormalizationData({
                grade: '',
                originalSlotName: '',
                normalizedSlotName: '',
                notes: ''
            });

            // Refresh both unmatched and normalized slots
            fetchUnmatchedSlots();
            fetchNormalizedSlots();
        } catch (error) {
            alert('Failed to save slot normalization: ' + error.message);
        }
    };

    const handleResyncDataAjar = async () => {
        if (window.confirm('Are you sure you want to resync data from Ajar? This will refresh all session data.')) {
            try {
                setIsResyncingData(true);

                // Call the Edge Function to resync data from Metabase
                console.log('Calling Edge Function...');
                const response = await supabase.functions.invoke('resync-metabase-data', {
                    method: 'POST'
                });

                console.log('Edge Function response:', response);
                console.log('Response data:', response.data);
                console.log('Response error:', response.error);

                if (response.error) {
                    console.error('Supabase function error:', response.error);
                    throw new Error(`Edge Function error: ${response.error.message || response.error}`);
                }

                const result = response.data;

                if (result && result.success) {
                    const rowsProcessed = result.rows_processed || 0;
                    const totalRows = result.total_rows || rowsProcessed;
                    const failedBatches = result.failed_batches || [];

                    let message = `Data resync completed successfully! ${rowsProcessed} rows processed.`;

                    if (totalRows > rowsProcessed) {
                        message += ` (${totalRows - rowsProcessed} rows failed)`;
                    }

                    if (failedBatches.length > 0) {
                        message += `\n\nWarning: ${failedBatches.length} batches had issues. Check logs for details.`;
                    }

                    alert(message);
                } else {
                    const errorMsg = result?.error || result?.message || 'Unknown error occurred';
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Resync error:', error);
                alert(`Failed to resync data: ${error.message || error}\n\nPlease check if:\n• Metabase connection is working\n• Edge Function is deployed\n• Network connection is stable`);
            } finally {
                setIsResyncingData(false);
            }
        }
    };

    const handleImportAssignments = async (spreadsheetId, sheetName) => {
        if (!selectedSemester) {
            alert('Please select a semester first');
            return;
        }

        const confirmMessage = `⚠️ WARNING: This will DELETE all existing assignments for semester "${selectedSemester.name}" and import new data.\n\nAre you sure you want to continue?`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            setIsImporting(true);

            console.log('Fetching data from Google Spreadsheet...');
            const rawData = await fetchGoogleSheetData(spreadsheetId, sheetName);

            if (!rawData || !rawData.values || rawData.values.length === 0) {
                throw new Error('No data found in spreadsheet');
            }

            console.log('Parsing spreadsheet data...');
            const parsedAssignments = parseSheetDataToAssignments(rawData.values, teachers);

            if (parsedAssignments.length === 0) {
                throw new Error('No valid assignments found in spreadsheet');
            }

            console.log('Validating assignments...');
            const validation = validateAssignments(parsedAssignments);

            if (!validation.valid) {
                const errorMessage = `Validation failed:\n\n${validation.errors.join('\n')}`;
                alert(errorMessage);
                setIsImporting(false);
                return;
            }

            console.log(`Deleting existing assignments for semester ${selectedSemester.id}...`);
            const { error: deleteError } = await supabase
                .from('teacher_assignment_slots')
                .delete()
                .eq('semester_id', selectedSemester.id);

            if (deleteError) {
                throw new Error(`Failed to delete existing assignments: ${deleteError.message}`);
            }

            // Step 5: Insert new assignments
            console.log(`Inserting ${parsedAssignments.length} new assignments...`);
            const assignmentsToInsert = parsedAssignments.map(assignment => ({
                ...assignment,
                semester_id: selectedSemester.id,
                created_by: user?.email,
                created_at: new Date().toISOString()
            }));

            const { data: insertedData, error: insertError } = await supabase
                .from('teacher_assignment_slots')
                .insert(assignmentsToInsert)
                .select();

            if (insertError) {
                throw new Error(`Failed to insert assignments: ${insertError.message}`);
            }

            // Step 6: Reload data
            console.log('Import successful! Reloading data...');
            await loadData();

            alert(`✅ Import successful!\n\n${insertedData.length} assignments imported for semester "${selectedSemester.name}"`);
            setShowImportModal(false);
        } catch (error) {
            console.error('Import error:', error);
            alert(`❌ Import failed: ${error.message}\n\nPlease check:\n• Spreadsheet ID and Sheet Name are correct\n• Spreadsheet is accessible\n• Column headers match expected format\n• Teacher names exist in database`);
        } finally {
            setIsImporting(false);
        }
    };

    const handleExportAssignments = async (webAppUrl, sheetName, clearExisting) => {
        if (!selectedSemester) {
            alert('Please select a semester first');
            return;
        }

        if (assignments.length === 0) {
            alert('No assignments to export');
            return;
        }

        try {
            setIsExporting(true);

            // Step 1: Format assignments for export
            console.log('Formatting assignments for export...');
            const formattedData = formatAssignmentsForExport(assignments, teachers);

            // Step 2: Export to Google Sheets via Apps Script
            console.log(`Exporting ${assignments.length} assignments to spreadsheet...`);
            const result = await exportToGoogleSheet(webAppUrl, sheetName, formattedData, clearExisting);

            if (result.success) {
                alert(`✅ Export successful!\n\n${assignments.length} assignments have been sent to your spreadsheet.\n\nSheet: "${sheetName}"\n\nPlease check your Google Spreadsheet to verify the data.`);
                setShowExportModal(false);
            }
        } catch (error) {
            console.error('Export error:', error);
            alert(`❌ Export failed: ${error.message}\n\nPlease check:\n• Web App URL is correct and valid\n• Apps Script is deployed correctly\n• You have edit access to the spreadsheet\n• Network connection is stable\n\nSee the setup guide in the export modal for help.`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleSelectRecommendation = (teacherId) => {
        const field = currentRecommendationType === 'guru_juara' ? 'guru_juara_id' : 'mentor_id';

        // Check if we're in modal mode
        if (window._isModalMode && window._modalSetFormData && window._modalFormData) {
            // Update modal formData
            window._modalSetFormData({
                ...window._modalFormData,
                [field]: teacherId
            });

            // Clear modal mode flags
            window._modalSetFormData = null;
            window._modalFormData = null;
            window._isModalMode = false;

            setShowRecommendationModal(false);
            return;
        }

        // Table mode
        if (currentRowIndex === null || currentRowIndex === undefined || !assignments[currentRowIndex]) {
            console.error('Invalid currentRowIndex:', currentRowIndex);
            alert('Error: Could not find assignment to update');
            return;
        }

        const assignment = assignments[currentRowIndex];
        const assignmentId = assignment.id;

        console.log('Updating field:', field, 'with teacherId:', teacherId, 'for assignmentId:', assignmentId);

        handleUpdateAssignment(assignmentId, { [field]: teacherId });
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

            let filterValues = [];
            try {
                const parsed = JSON.parse(filterValue);
                filterValues = Array.isArray(parsed) ? parsed : [filterValue];
            } catch {
                filterValues = [filterValue];
            }

            filteredData = filteredData.filter(assignment => {
                const cellValue = assignment[filterColumn];

                if (filterValues.length > 1 || (filterValues.length === 1 && filterValue.startsWith('['))) {
                    if (filterColumn === 'days') {
                        return assignment.days?.some(day =>
                            filterValues.some(fv =>
                                String(day).toLowerCase().includes(String(fv).toLowerCase())
                            )
                        );
                    }

                    if (typeof cellValue === 'string') {
                        return filterValues.some(fv =>
                            cellValue.toLowerCase() === String(fv).toLowerCase()
                        );
                    }

                    if (typeof cellValue === 'number') {
                        return filterValues.some(fv =>
                            cellValue.toString() === String(fv).toString() ||
                            cellValue === Number(fv)
                        );
                    }

                    return filterValues.some(fv =>
                        String(cellValue || '').toLowerCase() === String(fv).toLowerCase()
                    );
                } else {
                    const singleFilterValue = filterValues[0];

                    if (filterColumn === 'days') {
                        return assignment.days?.some(day =>
                            String(day).toLowerCase().includes(String(singleFilterValue).toLowerCase())
                        );
                    }

                    if (typeof cellValue === 'string') {
                        return cellValue.toLowerCase().includes(String(singleFilterValue).toLowerCase());
                    }

                    if (typeof cellValue === 'number') {
                        return cellValue.toString() === String(singleFilterValue).toString();
                    }

                    return String(cellValue || '').toLowerCase().includes(String(singleFilterValue).toLowerCase());
                }
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

                        {/* Semester Selector */}
                        {selectedSemester && (
                            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={18} color="#3b82f6" />
                                    <select
                                        value={selectedSemester?.id || ''}
                                        onChange={(e) => {
                                            const semester = semesters.find(s => s.id === e.target.value);
                                            setSelectedSemester(semester);
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            border: '2px solid #3b82f6',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            minWidth: '200px',
                                            background: 'white'
                                        }}
                                    >
                                        {semesters.map(sem => (
                                            <option key={sem.id} value={sem.id}>
                                                {sem.name} {sem.is_active ? '(Active)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={() => setShowSemesterManager(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                                    onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                                >
                                    <Settings size={16} />
                                    Manage Semesters
                                </button>
                            </div>
                        )}
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

                            {/* Data Actions Dropdown */}
                            <div
                                className="dropdown-container"
                                onMouseLeave={() => setShowDataActionsDropdown(false)}
                            >
                                <button
                                    onClick={() => setShowDataActionsDropdown(!showDataActionsDropdown)}
                                    className="dropdown-button"
                                    title="Data Actions"
                                    disabled={!selectedSemester}
                                >
                                    <Download size={16} />
                                    Data Actions
                                    <ChevronDown size={14} />
                                </button>

                                {showDataActionsDropdown && (
                                    <div className="dropdown-menu">
                                        <button
                                            onClick={() => {
                                                setShowImportModal(true);
                                                setShowDataActionsDropdown(false);
                                            }}
                                            className="dropdown-item"
                                            disabled={!selectedSemester}
                                        >
                                            <Upload size={14} />
                                            <span>Import Data</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowExportModal(true);
                                                setShowDataActionsDropdown(false);
                                            }}
                                            className="dropdown-item"
                                            disabled={!selectedSemester || assignments.length === 0}
                                        >
                                            <Download size={14} />
                                            <span>Export Data</span>
                                        </button>
                                        <div className="dropdown-divider"></div>
                                        <button
                                            onClick={() => {
                                                handleResyncDataAjar();
                                                setShowDataActionsDropdown(false);
                                            }}
                                            className="dropdown-item"
                                            disabled={isResyncingData}
                                        >
                                            <RefreshCw size={14} className={isResyncingData ? 'spinning' : ''} />
                                            <span>{isResyncingData ? 'Resyncing...' : 'Resync Data Ajar'}</span>
                                        </button>
                                        <div className="dropdown-divider"></div>
                                        <button
                                            onClick={() => {
                                                setShowTestDataModal(true);
                                                setShowDataActionsDropdown(false);
                                            }}
                                            className="dropdown-item test-data-item"
                                        >
                                            <FlaskConical size={14} />
                                            <span>Inject Test Data</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleShowSlotNormalization}
                                className="slot-normalization-button"
                                title="Slot Normalization"
                            >
                                <Settings size={16} />
                                Normalize Slots
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
                                    {Object.entries(columnFilters).map(([column, value]) => {
                                        let displayValue = value;
                                        try {
                                            const parsed = JSON.parse(value);
                                            if (Array.isArray(parsed)) {
                                                displayValue = parsed.join(', ');
                                            }
                                        } catch {
                                            // Keep original value if not JSON
                                        }

                                        return (
                                            <div key={column} className="filter-tag">
                                                <span>{column}: {displayValue}</span>
                                                <button
                                                    onClick={() => handleClearColumnFilter(column)}
                                                    className="filter-tag-remove"
                                                    title={`Remove ${column} filter`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
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
                                    handleBulkDeleteAssignments={handleBulkDeleteAssignments}
                                    handleBulkUpdateStatus={handleBulkUpdateStatus}
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
                                    canEdit={hasEditPermission}
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
                                                {Object.entries(columnFilters).map(([column, value]) => {
                                                    // Parse multiple values if they exist
                                                    let displayValue = value;
                                                    try {
                                                        const parsed = JSON.parse(value);
                                                        if (Array.isArray(parsed)) {
                                                            displayValue = parsed.join(', ');
                                                        }
                                                    } catch {
                                                        // Keep original value if not JSON
                                                    }

                                                    return (
                                                        <div key={column} className="filter-tag">
                                                            <span>{column}: {displayValue}</span>
                                                            <button
                                                                onClick={() => handleClearColumnFilter(column)}
                                                                className="filter-tag-remove"
                                                                title={`Remove ${column} filter`}
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
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
                                        handleBulkDeleteAssignments={handleBulkDeleteAssignments}
                                        handleBulkUpdateStatus={handleBulkUpdateStatus}
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
                                        canEdit={hasEditPermission}
                                    />
                                </div>
                            </div>
                        )}
                    </>) : (
                    <TeacherUtilization selectedSemester={selectedSemester} />
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
                                {console.log('Rendering recommendations modal, recommendations:', recommendations)}
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
                                        onClick={() => {
                                            setShowOthersModal(false);
                                            setModalSearchTerm(''); // Reset search when closing
                                        }}
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
                                        value={modalSearchTerm}
                                        onChange={e => setModalSearchTerm(e.target.value)}
                                        className="search-input"
                                    />
                                    {modalSearchTerm && (
                                        <button
                                            onClick={() => setModalSearchTerm('')}
                                            className="search-clear-button"
                                            title="Clear search"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
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
                                                    <p>
                                                        <strong>Subjects:</strong> {teacher.allSubjects?.filter(s => s).join(', ') || 'N/A'} |&nbsp;
                                                        <strong>Grades:</strong> {teacher.allGrades?.filter(g => g).join(', ') || 'N/A'} |&nbsp;
                                                        <strong>Levels:</strong> {teacher.allLevels?.filter(l => l).join(', ') || 'N/A'}
                                                    </p>
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
                                        <p>No teachers found matching "{modalSearchTerm}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showSlotNormalizationModal && (
                    <div className="modal-overlay">
                        <div className="modal-content large-modal">
                            <div className="modal-header">
                                <h3 className="modal-title">Slot Normalization</h3>
                                <button
                                    onClick={() => setShowSlotNormalizationModal(false)}
                                    className="modal-close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="normalization-content">
                                <div className="section">
                                    <h4>Unmatched Slots ({unmatchedSlots.length} found)</h4>
                                    <div className="unmatched-slots-list">
                                        {unmatchedSlots.length > 0 ? unmatchedSlots.map((slot, index) => (
                                            <div
                                                key={index}
                                                className="unmatched-slot-item"
                                                onClick={() => {
                                                    if (slot && slot.grade && slot.slot_name) {
                                                        setSlotNormalizationData({
                                                            ...slotNormalizationData,
                                                            grade: slot.grade.toString(),
                                                            originalSlotName: slot.slot_name
                                                        });
                                                    }
                                                }}
                                            >
                                                <span className="slot-grade">Grade {slot.grade || 'N/A'}</span>
                                                <span className="slot-name">{slot.slot_name || 'N/A'}</span>
                                                <span className="slot-sessions">{slot.total_sessions_affected || 0} sessions</span>
                                            </div>
                                        )) : (
                                            <div className="no-unmatched-slots">
                                                <p>No unmatched slots found or still loading...</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="section">
                                    <h4>Already Normalized Slots ({normalizedSlots.length} found)</h4>
                                    <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                                        {normalizedSlots.length > 0 ? (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Grade</th>
                                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Original Slot (Ajar)</th>
                                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Normalized Slot (Assignment)</th>
                                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created By</th>
                                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created At</th>
                                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {normalizedSlots.map((slot, index) => (
                                                        <tr key={slot.id || index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                            <td style={{ padding: '12px' }}>
                                                                <span style={{ fontWeight: '500' }}>Grade {slot.grade}</span>
                                                            </td>
                                                            <td style={{ padding: '12px' }}>
                                                                <span style={{ color: '#059669', fontWeight: '500' }}>{slot.original_slot_name}</span>
                                                            </td>
                                                            <td style={{ padding: '12px' }}>
                                                                <span style={{ color: '#3b82f6', fontWeight: '500' }}>{slot.normalized_slot_name}</span>
                                                            </td>
                                                            <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>
                                                                {slot.created_by || 'N/A'}
                                                            </td>
                                                            <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>
                                                                {slot.created_at ? new Date(slot.created_at).toLocaleDateString('en-US', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }) : 'N/A'}
                                                            </td>
                                                            <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280', maxWidth: '200px' }}>
                                                                {slot.notes || '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={{
                                                padding: '24px',
                                                textAlign: 'center',
                                                color: '#6b7280',
                                                backgroundColor: '#f9fafb',
                                                borderRadius: '6px'
                                            }}>
                                                <p>No normalized slots found. Start by creating normalization rules below.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="section">
                                    <h4>Create Normalization Rule</h4>
                                    <div className="normalization-form">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Grade</label>
                                                <input
                                                    type="text"
                                                    value={slotNormalizationData.grade}
                                                    onChange={(e) => setSlotNormalizationData({
                                                        ...slotNormalizationData,
                                                        grade: e.target.value
                                                    })}
                                                    placeholder="e.g., 5"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Original Slot Name (from Ajar)</label>
                                                <input
                                                    type="text"
                                                    value={slotNormalizationData.originalSlotName}
                                                    onChange={(e) => setSlotNormalizationData({
                                                        ...slotNormalizationData,
                                                        originalSlotName: e.target.value
                                                    })}
                                                    placeholder="e.g., Math Regular"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Normalized Slot Name (from Teacher Assignments)</label>
                                                <select
                                                    value={slotNormalizationData.normalizedSlotName}
                                                    onChange={(e) => setSlotNormalizationData({
                                                        ...slotNormalizationData,
                                                        normalizedSlotName: e.target.value
                                                    })}
                                                >
                                                    <option value="">Select a slot from assignments</option>
                                                    {[...new Set(assignments.filter(a => a.slot_name && a.grade).map(a => a.slot_name))]
                                                        .filter(slotName =>
                                                            assignments.some(a =>
                                                                a.slot_name === slotName &&
                                                                a.grade &&
                                                                a.grade.toString() === slotNormalizationData.grade
                                                            )
                                                        )
                                                        .map(slotName => (
                                                            <option key={slotName} value={slotName}>
                                                                {slotName}
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Notes (Optional)</label>
                                                <textarea
                                                    value={slotNormalizationData.notes}
                                                    onChange={(e) => setSlotNormalizationData({
                                                        ...slotNormalizationData,
                                                        notes: e.target.value
                                                    })}
                                                    placeholder="Additional notes about this normalization"
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-actions">
                                            <button
                                                onClick={handleSlotNormalizationSubmit}
                                                className="primary-button"
                                                disabled={!slotNormalizationData.grade || !slotNormalizationData.originalSlotName || !slotNormalizationData.normalizedSlotName}
                                            >
                                                <Save size={16} />
                                                Save Normalization
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <SemesterManager
                    isOpen={showSemesterManager}
                    onClose={() => setShowSemesterManager(false)}
                    onSemesterChange={loadSemesters}
                    currentUser={user}
                />

                <ImportAssignmentModal
                    isOpen={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    onImport={handleImportAssignments}
                    isImporting={isImporting}
                />

                <ExportAssignmentModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    onExport={handleExportAssignments}
                    isExporting={isExporting}
                    assignmentCount={assignments.length}
                />

                <TestDataInjectionModal
                    isOpen={showTestDataModal}
                    onClose={() => setShowTestDataModal(false)}
                    assignments={assignments}
                    teachers={teachers}
                    currentUser={user}
                />
            </div>
        </>
    );
};

export default TeacherAssignment;