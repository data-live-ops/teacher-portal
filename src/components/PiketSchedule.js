import React, { useState, useEffect, useRef } from 'react';
import Navbar from "./Navbar";
import { supabase } from "../lib/supabaseClient.mjs";

const styles = {
    container: {
        height: '100%',
        backgroundColor: '#75ABFB',
    },
    navbar: {
        backgroundColor: '#3B82F6',
        padding: '16px',
        color: 'white',
    },
    content: {
        marginTop: '75px',
        padding: '2rem',
        paddingTop: '1rem',
    },
    navigationContainer: {
        position: 'fixed',
        top: '75px',
        left: 0,
        right: 0,
        width: '100vw',
        height: '10vh',
        backgroundColor: 'white',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        padding: '0 2rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    },
    jumpToLabel: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#333',
        textDecoration: 'underline',
        marginRight: '1.5rem',
    },
    navigationButtons: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        flex: 1,
    },
    navButton: {
        padding: '8px 16px',
        borderRadius: '20px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        color: 'white',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    },
    navButtonHover: {
        transform: 'scale(1.05)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    },
    contentWithNav: {
        marginTop: '10vh',
        paddingTop: '2rem',
    },
    title: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: '28px',
        marginBottom: '24px',
        marginTop: '75px',
        textAlign: 'center',
    },
    currentClassInfo: {
        textAlign: 'left',
    },
    currentClassMainTitle: {
        marginTop: '2rem',
        marginBottom: '.5rem',
        color: '#FFFF',
        fontWeight: '750'
    },
    classTitle: {
        color: '#FEE643',
        fontSize: '1.4rem',
        fontWeight: '700',
        marginTop: '0',
        marginBottom: '3rem',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
    },
    gradeCircle: {
        width: '40px',
        height: '40px',
        fontSize: '',
        borderRadius: '50%',
        backgroundColor: '#FEE643',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0F32B1',
        fontWeight: 'bold',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
    },
    tableContainer: {
        marginBottom: '2rem',
    },
    table: {
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '8px',
        marginBottom: '3rem',
    },
    tableHeader: {
        backgroundColor: '#0F32B1',
        color: '#FEE643',
        padding: '12px 16px',
        fontWeight: '600',
        textAlign: 'left',
    },
    tableHeaderCenter: {
        backgroundColor: '#0F32B1',
        color: '#FEE643',
        padding: '12px 16px',
        fontWeight: '600',
        textAlign: 'center',
    },
    tableHeaderFirst: {
        backgroundColor: '#0F32B1',
        color: '#FEE643',
        padding: '12px 16px',
        fontWeight: '600',
        textAlign: 'center',
        borderTopLeftRadius: '20px',
    },
    tableHeaderLast: {
        backgroundColor: '#0F32B1',
        color: '#FEE643',
        padding: '12px 16px',
        fontWeight: '600',
        textAlign: 'center',
        borderTopRightRadius: '20px',
    },
    timeCell: {
        backgroundColor: '#FEE643',
        color: '#1E5AF6',
        padding: '12px 12px',
        fontWeight: '600',
        textAlign: 'center',
    },
    teacherCell: {
        backgroundColor: 'white',
        color: '#1E5AF6',
        padding: '12px 16px',
        textAlign: 'center',
        verticalAlign: 'top',
        lineHeight: '1.4',
        position: 'relative',
    },
    teacherCellLast: {
        backgroundColor: 'white',
        color: '#1E5AF6',
        padding: '12px 16px',
        textAlign: 'center',
        verticalAlign: 'top',
        lineHeight: '1.4',
        position: 'relative',
    },
    teacherName: {
        display: 'block',
        marginBottom: '4px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        position: 'relative',
    },
    teacherNameLast: {
        display: 'block',
        marginBottom: '0',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        position: 'relative',
    },
    teacherNameEditable: {
        display: 'block',
        marginBottom: '4px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        position: 'relative',
        borderRadius: '4px',
        padding: '2px 4px',
        transition: 'background-color 0.2s ease',
    },
    teacherNameEditableHover: {
        backgroundColor: 'rgba(30, 90, 246, 0.1)',
    },
    teacherNameEditableLast: {
        display: 'block',
        marginBottom: '0',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        position: 'relative',
        borderRadius: '4px',
        padding: '2px 4px',
        transition: 'background-color 0.2s ease',
    },
    nickName: {
        fontSize: '1rem',
    },
    tooltipContainer: {
        position: 'relative',
    },
    tooltip: {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '8px',
        backgroundColor: '#333',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        zIndex: 1000,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '20rem',
        height: 'auto',
        whiteSpace: 'normal',
        wordWrap: 'break-word',
    },
    tooltipArrow: {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid #333',
    },
    tooltipEditable: {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '8px',
        backgroundColor: '#333',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: 1000,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '200px',
        cursor: 'pointer',
        border: '1px solid #555',
        transition: 'background-color 0.2s ease',
    },
    tooltipEditableHover: {
        backgroundColor: '#444',
    },
    teacherNameWithIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        marginBottom: '4px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    teacherNameWithIconLast: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        marginBottom: '0',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    teacherNameWithIconEditable: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        borderRadius: '4px',
        padding: '2px 4px',
        transition: 'background-color 0.2s ease',
    },
    teacherNameWithIconEditableLast: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        marginBottom: '0',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        borderRadius: '4px',
        padding: '2px 4px',
        transition: 'background-color 0.2s ease',
    },
    infoIcon: {
        fontSize: '12px',
        color: '#1E5AF6',
        opacity: 0.7,
        transition: 'opacity 0.2s ease',
    },
    infoIconHover: {
        opacity: 1,
    },
    editIcon: {
        fontSize: '10px',
        color: '#1E5AF6',
        opacity: 0.5,
        marginLeft: '4px',
        transition: 'opacity 0.2s ease',
    },
    editIconHover: {
        opacity: 1,
    },
    editInput: {
        width: '100%',
        padding: '4px 8px',
        border: '2px solid #1E5AF6',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: '600',
        textAlign: 'center',
        backgroundColor: 'white',
        color: '#1E5AF6',
        outline: 'none',
    },
    editTextarea: {
        width: '100%',
        minHeight: '60px',
        padding: '8px 12px',
        border: '2px solid #333',
        borderRadius: '6px',
        fontSize: '12px',
        backgroundColor: '#333',
        color: 'white',
        outline: 'none',
        resize: 'vertical',
    },
    editButtons: {
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
        justifyContent: 'center',
    },
    editButton: {
        padding: '4px 8px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'background-color 0.2s ease',
    },
    saveButton: {
        backgroundColor: '#10B981',
        color: 'white',
    },
    cancelButton: {
        backgroundColor: '#EF4444',
        color: 'white',
    },
    editHint: {
        position: 'absolute',
        top: '-20px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '10px',
        color: '#1E5AF6',
        opacity: 0.7,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
    },
    sectionTitle: {
        color: 'white',
        fontSize: '1.8rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        textAlign: 'center',
    },

    teacherDropdown: {
        position: 'relative',
        width: '100%',
    },
    dropdownButton: {
        width: '15rem',
        padding: '4px 8px',
        border: '2px solid #1E5AF6',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: '600',
        textAlign: 'center',
        backgroundColor: 'white',
        color: '#1E5AF6',
        outline: 'none',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownList: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'white',
        border: '2px solid #1E5AF6',
        borderTop: 'none',
        borderRadius: '0 0 4px 4px',
        maxHeight: '200px',
        overflowY: 'auto',
        zIndex: 1000,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    },
    dropdownItem: {
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '14px',
        borderBottom: '1px solid #E5E7EB',
        transition: 'background-color 0.2s ease',
    },
    dropdownItemHover: {
        backgroundColor: '#F3F4F6',
    },
    dropdownSearch: {
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        borderBottom: '2px solid #E5E7EB',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: '#F9FAFB',
    },
    noAccess: {
        textAlign: 'center',
        color: 'white',
        fontSize: '1.2rem',
        marginTop: '100px',
        padding: '2rem',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        margin: '2rem',
    },
    addNoteButton: {
        fontSize: '10px',
        color: '#1E5AF6',
        opacity: 0.5,
        marginLeft: '4px',
        cursor: 'pointer',
        padding: '2px 4px',
        borderRadius: '2px',
        transition: 'all 0.2s ease',
        backgroundColor: 'transparent',
        border: 'none',
    },
    addNoteButtonHover: {
        opacity: 1,
        backgroundColor: 'rgba(30, 90, 246, 0.1)',
    },
    emptyCell: {
        backgroundColor: 'white',
        color: '#999',
        padding: '12px 16px',
        textAlign: 'center',
        verticalAlign: 'middle',
        fontStyle: 'italic',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
    },
    emptyCellHover: {
        backgroundColor: '#F3F4F6',
        color: '#666',
    },
    addTeacherButton: {
        padding: '6px 12px',
        backgroundColor: '#10B981',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'background-color 0.2s ease',
    },
    addTeacherButtonHover: {
        backgroundColor: '#059669',
    },
    noteActions: {
        display: 'flex',
        gap: '4px',
        marginTop: '8px',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 10,
        padding: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '4px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    },
    noteActionButton: {
        padding: '4px 8px',
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: '600',
        transition: 'background-color 0.2s ease',
    },
    addNoteActionButton: {
        backgroundColor: '#3B82F6',
        color: 'white',
    },
    deleteRecordAction: {
        padding: '4px 8px',
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: '600',
        transition: 'background-color 0.2s ease',
        backgroundColor: '#f44336',
        color: 'white',
    },
    editNoteActionButton: {
        backgroundColor: '#F59E0B',
        color: 'white',
    },
    deleteNoteActionButton: {
        backgroundColor: '#EF4444',
        color: 'white',
    },

    teacherRowContainer: {
        position: 'relative',
        paddingBottom: '4px',
    },
    teacherRowContainerLast: {
        position: 'relative',
        marginBottom: '0',
        paddingBottom: '4px',
    },
    cellContainer: {
        position: 'relative',
        minHeight: '40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addTeacherContainer: {
        position: 'relative',
        width: '100%',
        textAlign: 'center',
        padding: '8px',
    },
    readOnlyIndicator: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        color: '#666',
        padding: '2px 6px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: '500',
    },
};

const PiketSchedule = ({ user, onLogout }) => {
    const [piketData, setPiketData] = useState([]);
    const [gradeSubjects, setGradeSubjects] = useState([]);
    const [uniqueGrades, setUniqueGrades] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [tooltipVisible, setTooltipVisible] = useState(null);
    const [hoveredNavButton, setHoveredNavButton] = useState(null);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [deleteTeacher, setDeleteTeacher] = useState(null);
    const [editingNote, setEditingNote] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [hoveredTeacher, setHoveredTeacher] = useState(null);
    const [hoveredTooltip, setHoveredTooltip] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [showDropdown, setShowDropdown] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [hasEditPermission, setHasEditPermission] = useState(false);
    const [showAddTeacher, setShowAddTeacher] = useState(null);
    const [hoveredEmptyCell, setHoveredEmptyCell] = useState(null);
    const [hoveredActionsContainer, setHoveredActionsContainer] = useState(null);

    const tableRefs = useRef({});
    const dropdownRef = useRef({});

    const userEmail = user?.email;

    const checkEditPermission = async (email) => {
        try {
            const { data, error } = await supabase
                .from('piket_editors')
                .select('email')
                .eq('email', email)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Error checking edit permission:", error);
                return false;
            }

            return !!data;
        } catch (error) {
            console.error("Error checking edit permission:", error);
            return false;
        }
    };

    useEffect(() => {
        const initializePermissions = async () => {
            if (userEmail) {
                const hasPermission = await checkEditPermission(userEmail);
                setHasEditPermission(hasPermission);
            }
        };

        initializePermissions();
    }, [userEmail]);

    const fetchTeachers = async () => {
        try {
            const { data: teachersData, error } = await supabase
                .from('avatars')
                .select('email, first_name, last_name')
                .order('last_name');

            if (error) throw error;

            const formattedTeachers = teachersData.map(teacher => ({
                email: teacher.email,
                name: `${teacher.last_name || ''}`.trim() || teacher.email,
                first_name: teacher.first_name,
                last_name: teacher.last_name
            }));

            setTeachers(formattedTeachers);
        } catch (error) {
            console.error("Error fetching teachers:", error);
        }
    };

    const fetchPiketData = async () => {
        try {
            const { data: piketDataRaw, error: piketError } = await supabase
                .from('piket_schedule')
                .select('*');
            if (piketError) throw piketError;

            setPiketData(piketDataRaw || []);
        } catch (error) {
            console.error("Error fetching piket data:", error);
        }
    };

    const updatePiketData = async (id, field, value) => {
        try {
            const { error } = await supabase
                .from('piket_schedule')
                .update({
                    [field]: value,
                    updated_at: getJakartaISOString(),
                    updated_by: userEmail
                })
                .eq('id', id);

            if (error) throw error;

            setPiketData(prev => prev.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            ));

            return true;
        } catch (error) {
            console.error("Error updating piket data:", error);
            alert("Gagal menyimpan perubahan. Silakan coba lagi.");
            return false;
        }
    };

    const findFirstClassDate = async (email) => {
        const { data, error } = await supabase
            .from('teacher_schedules')
            .select('first_class_date')
            .or(`teacher_email.eq.${email},mentor_email.eq.${email}`);
        if (error) {
            console.error("Error fetching first class date:", error);
            return null;
        }

        if (!data || data.length === 0) return null;
        const dateSorted = data.filter(item => item.first_class_date).sort((a, b) => new Date(a.first_class_date) - new Date(b.first_class_date));
        return dateSorted.length > 0 ? dateSorted[0].first_class_date : null;
    };

    const deleteTeacherData = async (id) => {
        try {
            const { error } = await supabase
                .from('piket_schedule')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (e) {
            console.error(`Failed to delete record id: ${id}: ${e.messsage}`);
            throw new Error(e);
        }
    }

    const updateTeacherAssignment = async (id, selectedTeacher, currentTeacherName) => {
        try {
            const firstClassDate = await findFirstClassDate(selectedTeacher.email);
            const updateData = {
                teacher_name: selectedTeacher.name,
                email: selectedTeacher.email,
                updated_at: getJakartaISOString(),
                first_class_date: firstClassDate,
                previous_teacher: currentTeacherName || null,
                updated_by: userEmail
            };

            const { error } = await supabase
                .from('piket_schedule')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            setPiketData(prev => prev.map(item =>
                item.id === id ? { ...item, ...updateData } : item
            ));

            return true;
        } catch (error) {
            console.error("Error updating teacher assignment:", error);
            alert("Gagal menyimpan perubahan guru. Silakan coba lagi.");
            return false;
        }
    };

    useEffect(() => {
        fetchPiketData();
        if (hasEditPermission) {
            fetchTeachers();
        }
    }, [hasEditPermission]);

    useEffect(() => {
        const uniqueGradeSubjects = [...new Set(piketData.map(item => `${item.grade}-${item.subject}`))];
        const uniqueGrades = [...new Set(piketData.map(item => item.grade))];
        const gradeSubjectArr = uniqueGradeSubjects.map(gs => {
            const [grade, subject] = gs.split('-');
            return { grade, subject };
        });

        const order = [
            '4', '5', '6', 'SD', 'SMP MATH', 'SMA MATH', 'SCIENCE'
        ];
        const getOrderIndex = (gs) => {
            const key = gs.grade.trim().toUpperCase() + (gs.subject ? ' ' + gs.subject.trim().toUpperCase() : '');

            if (key.startsWith('SMP') && gs.subject && gs.subject.toUpperCase().includes('MATH')) return order.indexOf('SMP MATH');
            if (key.startsWith('SMA') && gs.subject && gs.subject.toUpperCase().includes('MATH')) return order.indexOf('SMA MATH');
            if (gs.subject && gs.subject.toUpperCase().includes('SCIENCE')) return order.indexOf('SCIENCE');

            const idx = order.findIndex(o => o === gs.grade.trim().toUpperCase());
            return idx !== -1 ? idx : 99;
        };

        gradeSubjectArr.sort((a, b) => getOrderIndex(a) - getOrderIndex(b));
        uniqueGrades.sort((a, b) => getOrderIndex({ grade: a }) - getOrderIndex({ grade: b }));

        setGradeSubjects(gradeSubjectArr);
        setUniqueGrades(uniqueGrades);
        const uniqueTimes = [...new Set(piketData.map(item => item.time))].sort();
        setTimeSlots(uniqueTimes);
    }, [piketData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && dropdownRef.current[showDropdown] &&
                !dropdownRef.current[showDropdown].contains(event.target)) {
                setShowDropdown(null);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const getButtonColor = (grade) => {
        if (['4', '5', '6'].includes(grade)) {
            return '#F86077';
        } else if (grade === '10 IPA & KIM') {
            return '#FFED76'
        } else if (grade.includes('SMP')) {
            return '#75ABFB';
        } else if (grade.includes('SMA')) {
            return '#67F5AD';
        } else if (grade.includes('IPA')) {
            return '#FF8D9E';
        } else {
            return '#FFED76';
        }
    };

    const getTeachersForSlot = (time, day, gradeSubject) => {
        const teachers = piketData.filter(item =>
            item.time === time &&
            item.day === day &&
            gradeSubject === item.grade
        );

        return teachers.map(item => ({
            id: item.id,
            nick_name: item.nick_name,
            teacher_name: item.teacher_name,
            email: item.email,
            note: item.note,
        }));
    };

    const handleNavButtonClick = (grade) => {
        const element = tableRefs.current[grade];
        if (element) {
            const yOffset = -250;
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    const handleMouseEnter = (teacherIndex, time, day, gradeSubject) => {
        setTooltipVisible(`${time} - ${day} - ${teacherIndex} - ${gradeSubject}`);
    };

    const handleMouseLeave = () => {
        setTooltipVisible(null);
    };

    const handleTeacherClick = (teacherId) => {
        if (!hasEditPermission) return;

        if (showDropdown === teacherId) {
            setShowDropdown(null);
            setSearchTerm('');
        } else {
            setShowDropdown(teacherId);
            setSearchTerm('');
        }
    };

    const handleTeacherSelect = async (teacherId, selectedTeacher, currentTeacherName) => {
        const success = await updateTeacherAssignment(teacherId, selectedTeacher, currentTeacherName);
        if (success) {
            setShowDropdown(null);
            setSearchTerm('');
        }
    };

    const handleNoteDoubleClick = (teacherId, currentNote) => {
        if (!hasEditPermission) return;
        setEditingNote(teacherId);
        setEditValue(currentNote || '');
    };

    const handleSaveNote = async () => {
        if (editingNote) {
            const success = await updatePiketData(editingNote, 'note', editValue.trim());
            if (success) {
                setEditingNote(null);
                setEditValue('');
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingTeacher(null);
        setEditingNote(null);
        setEditValue('');
        setShowDropdown(null);
        setSearchTerm('');
    };

    const handleKeyPress = (e, saveFunction) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveFunction();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const getJakartaISOString = () => {
        const now = new Date();
        const jakartaOffset = 7 * 60;
        const jakartaTime = new Date(now.getTime() + (jakartaOffset * 60 * 1000));

        return jakartaTime.toISOString().replace(/Z$/, '+07:00');
    };


    const insertNewPiketRecord = async (time, day, grade, subject) => {
        try {
            const newRecord = {
                grade: grade,
                subject: subject || null,
                day: day,
                time: time,
                teacher_name: null,
                email: null,
                note: null,
                created_at: getJakartaISOString(),
                updated_at: getJakartaISOString(),
                first_class_date: null,
                updated_by: null
            };

            const { data, error } = await supabase
                .from('piket_schedule')
                .insert([newRecord])
                .select()
                .single();

            if (error) throw error;

            setPiketData(prev => [...prev, data]);
            return data.id;
        } catch (error) {
            console.error("Error inserting new piket record:", error);
            alert("Gagal menambahkan slot baru. Silakan coba lagi.");
            return null;
        }
    };

    const deleteNote = async (teacherId) => {
        const success = await updatePiketData(teacherId, 'note', null);
        if (success) {
            setTooltipVisible(null);
        }
    };

    const handleAddTeacherClick = async (time, day, grade, subject) => {
        if (!hasEditPermission) return;

        const newRecordId = await insertNewPiketRecord(time, day, grade, subject);
        if (newRecordId) {
            setTimeout(() => {
                setShowDropdown(newRecordId);
            }, 100);
        }
    };

    const filteredTeachers = teachers.filter(teacher =>
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddNote = (teacherId) => {
        setEditingNote(teacherId);
        setEditValue('');
        setTooltipVisible(null);
    };

    const handleDeleteRecord = async (teacherId, teacherName) => {
        if (window.confirm(`Are you sure to delete ${teacherName} from database?`)) {
            await deleteTeacherData(teacherId);
            setPiketData(prev => prev.filter(item => item.id !== teacherId));
        }
    }

    return (
        <div style={styles.container}>
            <Navbar userEmail={user} onLogoutClick={onLogout} />
            {!hasEditPermission && (
                <div style={styles.readOnlyIndicator}>
                    View Only
                </div>
            )}

            <div style={styles.navigationContainer}>
                <span style={styles.jumpToLabel}>Jump to</span>
                <div style={styles.navigationButtons}>
                    {uniqueGrades.map((grade, index) => (
                        <button
                            key={index}
                            onClick={() => handleNavButtonClick(grade)}
                            style={{
                                ...styles.navButton,
                                backgroundColor: getButtonColor(grade),
                                color: ['4', '5', '6', 'SMP', 'SMA', 'IPA'].some(type =>
                                    grade.includes(type)) ? 'white' : '#333',
                                ...(hoveredNavButton === index ? styles.navButtonHover : {})
                            }}
                            onMouseEnter={() => setHoveredNavButton(index)}
                            onMouseLeave={() => setHoveredNavButton(null)}
                        >
                            {grade}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ ...styles.content, ...styles.contentWithNav }}>
                {gradeSubjects.map((gradeSubject, gsIndex) => (
                    <div
                        key={gsIndex}
                        ref={el => tableRefs.current[gradeSubject.grade] = el}
                        style={{ marginBottom: '4rem', marginTop: '75px' }}
                    >
                        <div style={styles.currentClassInfo}>
                            <h2 style={styles.currentClassMainTitle}>Jadwal Guru Piket</h2>
                            <h2 style={styles.classTitle}>
                                <span>Kelas</span>
                                <div style={{
                                    ...styles.gradeCircle,
                                    fontSize:
                                        gradeSubject.grade.split(' ').length > 1
                                            ? '12px'
                                            : (gradeSubject.grade.length > 3 ? '10px' : '16px'),
                                    lineHeight: '1.1',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-line',
                                    textAlign: 'center',
                                }}>{gradeSubject.grade.split(' ').join('\n')}
                                </div>
                                <span>{gradeSubject.subject}</span>
                            </h2>
                        </div>

                        <div style={styles.tableContainer}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.tableHeaderFirst}>
                                            Jam/Hari
                                        </th>
                                        {dayNames.map((day, index) => (
                                            <th
                                                key={day}
                                                style={index === dayNames.length - 1 ? styles.tableHeaderLast : styles.tableHeaderCenter}
                                            >
                                                {day}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map((time) => (
                                        <tr key={time}>
                                            <td style={styles.timeCell}>
                                                {time}
                                            </td>
                                            {dayNames.map((day, index) => {
                                                const teachers = getTeachersForSlot(time, day, gradeSubject.grade);
                                                const cellId = `${time}-${day}-${gradeSubject.grade}`;

                                                return (
                                                    <td
                                                        key={day}
                                                        style={index === dayNames.length - 1 ? styles.teacherCellLast : styles.teacherCell}
                                                    >
                                                        <div style={styles.cellContainer}>
                                                            {teachers.map((teacherData, teacherIndex) => {
                                                                const tooltipId = `${time} - ${day} - ${teacherIndex} - ${gradeSubject.grade} - ${gradeSubject.subject}`;
                                                                const hasNote = teacherData.note && teacherData.note.trim() !== '';
                                                                const isEditingThisNote = editingNote === teacherData.id;
                                                                const teacherHoverId = `${teacherData.id}-teacher`;
                                                                const isHoveredTeacher = hoveredTeacher === teacherHoverId;
                                                                const isDropdownOpen = showDropdown === teacherData.id;
                                                                const actionsContainerId = `${teacherData.id}-actions`;
                                                                const isHoveredActions = hoveredActionsContainer === actionsContainerId;

                                                                return (
                                                                    <div
                                                                        key={teacherIndex}
                                                                        style={teacherIndex === teachers.length - 1 ? styles.teacherRowContainerLast : styles.teacherRowContainer}
                                                                    >
                                                                        <div style={styles.tooltipContainer}>
                                                                            {!isDropdownOpen ? (
                                                                                <div
                                                                                    onMouseEnter={() => {
                                                                                        setHoveredTeacher(teacherHoverId);
                                                                                        setHoveredActionsContainer(actionsContainerId);
                                                                                        if (hasNote) handleMouseEnter(teacherIndex, time, day, `${gradeSubject.grade} - ${gradeSubject.subject}`);
                                                                                    }}
                                                                                    onMouseLeave={() => {
                                                                                        setHoveredTeacher(null);
                                                                                        setHoveredActionsContainer(null);
                                                                                        handleMouseLeave();
                                                                                    }}
                                                                                    style={{ position: 'relative' }}
                                                                                >
                                                                                    <span
                                                                                        style={{
                                                                                            ...(teacherIndex === teachers.length - 1 ?
                                                                                                (hasNote ? styles.teacherNameWithIconEditableLast : styles.teacherNameEditableLast) :
                                                                                                (hasNote ? styles.teacherNameWithIconEditable : styles.teacherNameEditable)
                                                                                            ),
                                                                                            ...(isHoveredTeacher ? styles.teacherNameEditableHover : {})
                                                                                        }}
                                                                                        onClick={() => handleTeacherClick(teacherData.id)}
                                                                                    >
                                                                                        {(isHoveredTeacher || isHoveredActions) && hasEditPermission && (
                                                                                            <div style={styles.editHint}>
                                                                                                Click to change teacher
                                                                                            </div>
                                                                                        )}
                                                                                        <div style={styles.nickName}>
                                                                                            {teacherData.nick_name || teacherData.teacher_name || '(Mohon diisi)'}
                                                                                        </div>
                                                                                        {hasNote && (
                                                                                            <span
                                                                                                style={{
                                                                                                    ...styles.infoIcon,
                                                                                                    ...(tooltipVisible === tooltipId ? styles.infoIconHover : {})
                                                                                                }}
                                                                                            >
                                                                                                ℹ️
                                                                                            </span>
                                                                                        )}
                                                                                        {(isHoveredTeacher || isHoveredActions) && hasEditPermission && (
                                                                                            <span style={{
                                                                                                ...styles.editIcon,
                                                                                                ...styles.editIconHover
                                                                                            }}>
                                                                                                ✏️
                                                                                            </span>
                                                                                        )}
                                                                                    </span>

                                                                                    {(isHoveredTeacher || isHoveredActions) && hasEditPermission && (
                                                                                        <div style={{
                                                                                            ...styles.noteActions,
                                                                                            pointerEvents: 'auto',
                                                                                            marginTop: 4
                                                                                        }}>
                                                                                            {!hasNote ? (
                                                                                                <>
                                                                                                    <button
                                                                                                        style={{
                                                                                                            ...styles.noteActionButton,
                                                                                                            ...styles.addNoteActionButton
                                                                                                        }}
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            handleAddNote(teacherData.id);
                                                                                                        }}
                                                                                                    >
                                                                                                        + Note
                                                                                                    </button>
                                                                                                    <button
                                                                                                        style={{
                                                                                                            ...styles.noteActionButton,
                                                                                                            ...styles.deleteRecordAction
                                                                                                        }}
                                                                                                        onClick={async (e) => {
                                                                                                            e.stopPropagation();
                                                                                                            await handleDeleteRecord(teacherData.id, teacherData.teacher_name);
                                                                                                        }}
                                                                                                    >
                                                                                                        Delete Him/Her!
                                                                                                    </button>
                                                                                                </>

                                                                                            ) : (
                                                                                                <>
                                                                                                    <button
                                                                                                        style={{
                                                                                                            ...styles.noteActionButton,
                                                                                                            ...styles.editNoteActionButton
                                                                                                        }}
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            handleNoteDoubleClick(teacherData.id, teacherData.note);
                                                                                                        }}
                                                                                                    >
                                                                                                        Edit
                                                                                                    </button>
                                                                                                    <button
                                                                                                        style={{
                                                                                                            ...styles.noteActionButton,
                                                                                                            ...styles.deleteNoteActionButton
                                                                                                        }}
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            if (window.confirm('Are you sure you want to delete this note?')) {
                                                                                                                deleteNote(teacherData.id);
                                                                                                            }
                                                                                                        }}
                                                                                                    >
                                                                                                        Delete
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    style={styles.teacherDropdown}
                                                                                    ref={el => dropdownRef.current[teacherData.id] = el}
                                                                                >
                                                                                    <div style={styles.dropdownButton}>
                                                                                        <span>{teacherData.nick_name || teacherData.teacher_name || "Select Teacher"}</span>
                                                                                        <span>▼</span>
                                                                                    </div>
                                                                                    <div style={styles.dropdownList}>
                                                                                        <input
                                                                                            type="text"
                                                                                            placeholder="Search teachers..."
                                                                                            value={searchTerm}
                                                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                                                            style={styles.dropdownSearch}
                                                                                            autoFocus
                                                                                        />
                                                                                        {filteredTeachers.map((teacher, idx) => (
                                                                                            <div
                                                                                                key={idx}
                                                                                                style={{
                                                                                                    ...styles.dropdownItem,
                                                                                                    ...(hoveredTeacher === `dropdown-${idx}` ? styles.dropdownItemHover : {})
                                                                                                }}
                                                                                                onMouseEnter={() => setHoveredTeacher(`dropdown-${idx}`)}
                                                                                                onMouseLeave={() => setHoveredTeacher(null)}
                                                                                                onClick={() => handleTeacherSelect(
                                                                                                    teacherData.id,
                                                                                                    teacher,
                                                                                                    teacherData.teacher_name
                                                                                                )}
                                                                                            >
                                                                                                <div style={{ fontWeight: '600' }}>
                                                                                                    {teacher.name}
                                                                                                </div>
                                                                                                <div style={{ fontSize: '12px', color: '#666' }}>
                                                                                                    {teacher.email}
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                        {filteredTeachers.length === 0 && (
                                                                                            <div style={{ ...styles.dropdownItem, color: '#666', fontStyle: 'italic' }}>
                                                                                                No teachers found
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {tooltipVisible === tooltipId && hasNote && !isEditingThisNote && (
                                                                                <div
                                                                                    style={{
                                                                                        ...styles.tooltipEditable,
                                                                                        ...(hoveredTooltip === tooltipId ? styles.tooltipEditableHover : {})
                                                                                    }}
                                                                                    onMouseEnter={() => setHoveredTooltip(tooltipId)}
                                                                                    onMouseLeave={() => setHoveredTooltip(null)}
                                                                                    onDoubleClick={() => handleNoteDoubleClick(teacherData.id, teacherData.note)}
                                                                                >
                                                                                    {teacherData.note}
                                                                                    <div style={styles.tooltipArrow}></div>
                                                                                    {hoveredTooltip === tooltipId && hasEditPermission && (
                                                                                        <div style={{
                                                                                            fontSize: '10px',
                                                                                            marginTop: '4px',
                                                                                            opacity: 0.8
                                                                                        }}>
                                                                                            Double-click to edit note
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {isEditingThisNote && (
                                                                                <div style={styles.tooltip}>
                                                                                    <textarea
                                                                                        value={editValue}
                                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                                        onKeyDown={(e) => handleKeyPress(e, handleSaveNote)}
                                                                                        style={styles.editTextarea}
                                                                                        autoFocus
                                                                                        placeholder="Enter note here..."
                                                                                    />
                                                                                    <div style={styles.editButtons}>
                                                                                        <button
                                                                                            onClick={handleSaveNote}
                                                                                            style={{ ...styles.editButton, ...styles.saveButton }}
                                                                                        >
                                                                                            ✓
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={handleCancelEdit}
                                                                                            style={{ ...styles.editButton, ...styles.cancelButton }}
                                                                                        >
                                                                                            ✕
                                                                                        </button>
                                                                                    </div>
                                                                                    <div style={styles.tooltipArrow}></div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}

                                                            {hasEditPermission && (
                                                                <div style={styles.addTeacherContainer}>
                                                                    <button
                                                                        style={{
                                                                            ...styles.addTeacherButton,
                                                                            ...(hoveredEmptyCell === cellId ? styles.addTeacherButtonHover : {})
                                                                        }}
                                                                        onMouseEnter={() => setHoveredEmptyCell(cellId)}
                                                                        onMouseLeave={() => setHoveredEmptyCell(null)}
                                                                        onClick={() => handleAddTeacherClick(time, day, gradeSubject.grade, gradeSubject.subject)}
                                                                    >
                                                                        + Add Teacher
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PiketSchedule;