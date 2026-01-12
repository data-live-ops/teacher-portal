import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle, CheckCircle, XCircle, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import '../styles/TeacherAssignment.css';
import '../styles/TeacherUtilization.css';
import { supabase } from '../lib/supabaseClient.mjs';
import SortableFilterableHeader from './SortableFilterableHeader';

// ✅ Receive selectedSemester from parent component
const TeacherUtilization = ({ selectedSemester }) => {
    const [utilizationData, setUtilizationData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // ✅ Column width state for resizing
    const [columnWidths, setColumnWidths] = useState({
        teacher_name: 180,
        level: 100,
        responsibility: 200,
        hours_gj: 130,
        hours_gj_other: 150,
        hours_mentor: 140,
        utilization_gj: 150,
        utilization_mentor: 180,
        status_50: 150,
        status_mentor: 150,
        status_75: 150
    });
    const [resizing, setResizing] = useState(null);
    const [filters, setFilters] = useState({
        gjStatus50: '',
        gjStatus75: '',
        mentorStatus: '',
        showInactive: true  // ✅ Show inactive teachers by default
    });

    // ✅ Sorting state
    const [sortConfig, setSortConfig] = useState({
        key: 'teacher_name',
        direction: 'asc'
    });

    // ✅ Column filter state
    const [columnFilters, setColumnFilters] = useState({
        teacher_name: '',
        level: '',
        responsibility: ''
    });

    // ✅ Recalculate state
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [recalculateResult, setRecalculateResult] = useState(null);

    // ✅ Load data when selectedSemester changes (from parent)
    useEffect(() => {
        if (selectedSemester) {
            loadUtilizationData();
        }
    }, [selectedSemester]);

    // ✅ Column resizing handlers
    const startResizing = (column, e) => {
        e.preventDefault();
        setResizing({ column, startX: e.clientX, startWidth: columnWidths[column] });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!resizing) return;

            const diff = e.clientX - resizing.startX;
            const newWidth = Math.max(80, resizing.startWidth + diff);

            setColumnWidths(prev => ({
                ...prev,
                [resizing.column]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizing(null);
        };

        if (resizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing]);

    const loadUtilizationData = async () => {
        if (!selectedSemester) {
            setUtilizationData([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // ✅ Query with semester filter and teacher status
            const { data, error } = await supabase
                .from('teacher_utilization')
                .select(`
                    *,
                    teacher_leveling:teacher_leveling_id(
                        level,
                        responsibility,
                        teaching_minimum_hour,
                        teaching_maximum_hour,
                        mentoring_minimum_hour,
                        mentoring_maximum_hour
                    ),
                    teacher:teacher_id(
                        name,
                        is_active
                    )
                `)
                .eq('semester_id', selectedSemester.id)  // ✅ Filter by semester
                .order('teacher_name');

            if (error) throw error;

            // ✅ Get teacher_semester_status to check active/inactive per semester
            const { data: semesterStatuses, error: statusError } = await supabase
                .from('teacher_semester_status')
                .select('*')
                .eq('semester_id', selectedSemester.id);

            if (statusError) {
                console.error('Error loading semester statuses:', statusError);
            }

            // Create map for quick lookup
            const statusMap = {};
            (semesterStatuses || []).forEach(status => {
                statusMap[status.teacher_id] = status;
            });

            const formattedData = data.map(item => ({
                ...item,
                level: item.teacher_leveling?.level || 'Unknown',
                responsibility: item.teacher_leveling?.responsibility || 'Unknown',
                teaching_min_hour: item.teacher_leveling?.teaching_minimum_hour || 0,
                teaching_max_hour: item.teacher_leveling?.teaching_maximum_hour || 0,
                mentoring_min_hour: item.teacher_leveling?.mentoring_minimum_hour || 0,
                mentoring_max_hour: item.teacher_leveling?.mentoring_maximum_hour || 0,
                // ✅ Add semester status info
                semester_status: statusMap[item.teacher_id] || { is_active: true },
                is_active_in_semester: statusMap[item.teacher_id]?.is_active ?? true,
                ended_at: statusMap[item.teacher_id]?.ended_at || null
            }));

            setUtilizationData(formattedData);
        } catch (error) {
            console.error('Error loading utilization data:', error);
            alert('Failed to load teacher utilization data');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'FULL CAPACITY': { color: 'success', icon: CheckCircle },
            'MEET MINIMUM': { color: 'warning', icon: AlertCircle },
            'BELOW MINIMUM': { color: 'danger', icon: XCircle }
        };

        const config = statusConfig[status] || { color: 'neutral', icon: AlertCircle };
        const Icon = config.icon;

        return (
            <span className={`status-badge status-${config.color}`}>
                <Icon size={12} />
                {status || 'N/A'}
            </span>
        );
    };

    // ✅ Sorting function
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) {
            return <ArrowUpDown size={14} className="sort-icon" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="sort-icon active" />
            : <ArrowDown size={14} className="sort-icon active" />;
    };

    // ✅ Column filter handlers
    const handleColumnFilter = (column, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [column]: value
        }));
    };

    const getColumnValues = (column) => {
        const values = utilizationData.map(item => item[column]);
        return [...new Set(values)].filter(Boolean).sort();
    };

    // ✅ Recalculate utilization data
    const handleRecalculate = async () => {
        if (!selectedSemester) {
            alert('Please select a semester first');
            return;
        }

        const confirmRecalculate = window.confirm(
            `Are you sure you want to recalculate all teacher utilization for ${selectedSemester.name}?\n\n` +
            'This will sync the utilization data with the actual assignment slots.'
        );

        if (!confirmRecalculate) return;

        setIsRecalculating(true);
        setRecalculateResult(null);

        try {
            const { data, error } = await supabase
                .rpc('restore_all_teacher_utilization', {
                    p_semester_id: selectedSemester.id
                });

            if (error) throw error;

            // Count changes
            const updatedCount = data?.filter(r => r.change_status === 'UPDATED').length || 0;
            const totalCount = data?.length || 0;

            setRecalculateResult({
                success: true,
                message: `Recalculation complete! ${updatedCount} of ${totalCount} teachers updated.`,
                details: data?.filter(r => r.change_status === 'UPDATED') || []
            });

            // Reload data to show updated values
            await loadUtilizationData();

        } catch (error) {
            console.error('Error recalculating utilization:', error);
            setRecalculateResult({
                success: false,
                message: `Error: ${error.message}`
            });
        } finally {
            setIsRecalculating(false);
        }
    };

    // ✅ Filter and sort data
    const filteredAndSortedData = utilizationData
        .filter(teacher => {
            const matchesSearch = teacher.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                teacher.level.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesFilters =
                (!filters.gjStatus50 || teacher.minimum_50_teacher_utilization_status === filters.gjStatus50) &&
                (!filters.gjStatus75 || teacher.minimum_75_teacher_utilization_status === filters.gjStatus75) &&
                (!filters.mentorStatus || teacher.minimum_mentor_utilization_status === filters.mentorStatus);

            // ✅ Filter by active status
            const matchesActiveStatus = filters.showInactive || teacher.is_active_in_semester;

            // ✅ Column filter for teacher_name
            let matchesColumnFilters = true;
            if (columnFilters.teacher_name) {
                try {
                    const selectedNames = JSON.parse(columnFilters.teacher_name);
                    if (Array.isArray(selectedNames) && selectedNames.length > 0) {
                        matchesColumnFilters = selectedNames.includes(teacher.teacher_name);
                    }
                } catch {
                    matchesColumnFilters = teacher.teacher_name.toLowerCase().includes(columnFilters.teacher_name.toLowerCase());
                }
            }

            // ✅ Column filter for level
            let matchesLevelFilter = true;
            if (columnFilters.level) {
                try {
                    const selectedLevels = JSON.parse(columnFilters.level);
                    if (Array.isArray(selectedLevels) && selectedLevels.length > 0) {
                        matchesLevelFilter = selectedLevels.includes(teacher.level);
                    }
                } catch {
                    matchesLevelFilter = teacher.level.toLowerCase().includes(columnFilters.level.toLowerCase());
                }
            }

            // ✅ Column filter for responsibility
            let matchesResponsibilityFilter = true;
            if (columnFilters.responsibility) {
                try {
                    const selectedResponsibilities = JSON.parse(columnFilters.responsibility);
                    if (Array.isArray(selectedResponsibilities) && selectedResponsibilities.length > 0) {
                        matchesResponsibilityFilter = selectedResponsibilities.includes(teacher.responsibility);
                    }
                } catch {
                    matchesResponsibilityFilter = teacher.responsibility.toLowerCase().includes(columnFilters.responsibility.toLowerCase());
                }
            }

            return matchesSearch && matchesFilters && matchesActiveStatus && matchesColumnFilters && matchesLevelFilter && matchesResponsibilityFilter;
        })
        .sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle numeric values
            if (sortConfig.key === 'hours_as_teacher_in_mandatory_class' ||
                sortConfig.key === 'hours_as_teacher_in_non_mandatory_class' ||
                sortConfig.key === 'hours_as_mentor' ||
                sortConfig.key === 'teacher_utilization_percentage' ||
                sortConfig.key === 'mentor_utilization_percentage') {
                aValue = parseFloat(aValue) || 0;
                bValue = parseFloat(bValue) || 0;
            }

            // Handle string values
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue?.toLowerCase() || '';
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading teacher utilization data...</div>
            </div>
        );
    }

    return (
        <div className="teacher-utilization-container">
            <div className="header">
                <div className="header-actions">
                    <div className="search-bar">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search teachers or leveling.."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="filter-group">
                        {/* ✅ Show Inactive Toggle */}
                        <label className="filter-checkbox" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            background: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={filters.showInactive}
                                onChange={(e) => setFilters({ ...filters, showInactive: e.target.checked })}
                            />
                            <span>Show Inactive</span>
                        </label>

                        <select
                            value={filters.gjStatus50}
                            onChange={(e) => setFilters({ ...filters, gjStatus50: e.target.value })}
                            className="filter-select"
                        >
                            <option value="">All GJ 50% Status</option>
                            <option value="FULL CAPACITY">Full Capacity</option>
                            <option value="MEET MINIMUM">Meet Minimum</option>
                            <option value="BELOW MINIMUM">Below Minimum</option>
                        </select>

                        {/* ✅ Recalculate Button */}
                        <button
                            onClick={handleRecalculate}
                            disabled={isRecalculating || !selectedSemester}
                            className="recalculate-button"
                            title="Recalculate all teacher utilization based on current assignment slots"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                background: isRecalculating ? '#94a3b8' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isRecalculating ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                transition: 'background 0.2s'
                            }}
                        >
                            <RefreshCw
                                size={16}
                                className={isRecalculating ? 'spinning' : ''}
                                style={{
                                    animation: isRecalculating ? 'spin 1s linear infinite' : 'none'
                                }}
                            />
                            {isRecalculating ? 'Recalculating...' : 'Recalculate'}
                        </button>
                    </div>
                </div>

                {/* ✅ Recalculate Result Banner */}
                {recalculateResult && (
                    <div
                        className="recalculate-result"
                        style={{
                            padding: '12px 16px',
                            marginBottom: '16px',
                            borderRadius: '8px',
                            background: recalculateResult.success ? '#dcfce7' : '#fee2e2',
                            border: `1px solid ${recalculateResult.success ? '#86efac' : '#fca5a5'}`,
                            color: recalculateResult.success ? '#166534' : '#dc2626',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px'
                        }}
                    >
                        {recalculateResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: '500' }}>{recalculateResult.message}</p>
                            {recalculateResult.details && recalculateResult.details.length > 0 && (
                                <details style={{ marginTop: '8px' }}>
                                    <summary style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                                        View updated teachers ({recalculateResult.details.length})
                                    </summary>
                                    <ul style={{
                                        margin: '8px 0 0 0',
                                        paddingLeft: '20px',
                                        fontSize: '0.875rem',
                                        maxHeight: '200px',
                                        overflowY: 'auto'
                                    }}>
                                        {recalculateResult.details.map((detail, idx) => (
                                            <li key={idx}>
                                                <strong>{detail.teacher_name}</strong>:
                                                GJ {detail.old_mandatory}→{detail.new_mandatory},
                                                Other {detail.old_non_mandatory}→{detail.new_non_mandatory},
                                                Mentor {detail.old_mentor}→{detail.new_mentor}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                        <button
                            onClick={() => setRecalculateResult(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: recalculateResult.success ? '#166534' : '#dc2626'
                            }}
                        >
                            <XCircle size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="stats-container">
                <div className="stat-card stat-total">
                    <div className="stat-content">
                        <div className="stat-icon">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="stat-label">Total Teachers</p>
                            <p className="stat-value">{filteredAndSortedData.length}</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-assigned">
                    <div className="stat-content">
                        <div className="stat-icon">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p className="stat-label">Full Capacity (50%)</p>
                            <p className="stat-value">
                                {filteredAndSortedData.filter(t => t.minimum_50_teacher_utilization_status === 'FULL CAPACITY').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-open">
                    <div className="stat-content">
                        <div className="stat-icon">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p className="stat-label">Below Minimum (50%)</p>
                            <p className="stat-value">
                                {filteredAndSortedData.filter(t => t.minimum_50_teacher_utilization_status === 'BELOW MINIMUM').length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="stat-card stat-pending">
                    <div className="stat-content">
                        <div className="stat-icon">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="stat-label">Avg GJ Utilization</p>
                            <p className="stat-value">
                                {filteredAndSortedData.length > 0
                                    ? Math.round(filteredAndSortedData.reduce((sum, t) => sum + (parseFloat(t.teacher_utilization_percentage) || 0), 0) / filteredAndSortedData.length)
                                    : 0}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-header">
                    <h3>Teacher Utilization Details</h3>
                    <p>{filteredAndSortedData.length} teachers found</p>
                </div>

                <div className="table-scroll-container-util">
                    <table className="assignment-table">
                        <thead>
                            <tr>
                                <SortableFilterableHeader
                                    column="teacher_name"
                                    title="Teacher Name"
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    filterValue={columnFilters.teacher_name || ''}
                                    onFilter={handleColumnFilter}
                                    columnType="select"
                                    width={columnWidths.teacher_name}
                                    onResize={startResizing}
                                    existingValues={getColumnValues('teacher_name')}
                                />
                                <SortableFilterableHeader
                                    column="level"
                                    title="Level"
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    filterValue={columnFilters.level || ''}
                                    onFilter={handleColumnFilter}
                                    columnType="select"
                                    width={columnWidths.level}
                                    onResize={startResizing}
                                    existingValues={getColumnValues('level')}
                                />
                                <SortableFilterableHeader
                                    column="responsibility"
                                    title="Responsibility"
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    filterValue={columnFilters.responsibility || ''}
                                    onFilter={handleColumnFilter}
                                    columnType="select"
                                    width={columnWidths.responsibility}
                                    onResize={startResizing}
                                    existingValues={getColumnValues('responsibility')}
                                />
                                <th
                                    onClick={() => handleSort('hours_as_teacher_in_mandatory_class')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.hours_gj}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Scheduled as GJ
                                        {getSortIcon('hours_as_teacher_in_mandatory_class')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('hours_gj', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                                <th
                                    onClick={() => handleSort('hours_as_teacher_in_non_mandatory_class')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.hours_gj_other}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Scheduled as GJ Other
                                        {getSortIcon('hours_as_teacher_in_non_mandatory_class')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('hours_gj_other', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                                <th
                                    onClick={() => handleSort('hours_as_mentor')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.hours_mentor}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Scheduled as Mentor
                                        {getSortIcon('hours_as_mentor')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('hours_mentor', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                                <th
                                    onClick={() => handleSort('teacher_utilization_percentage')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.utilization_gj}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        GJ Utilization (%)
                                        {getSortIcon('teacher_utilization_percentage')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('utilization_gj', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                                <th
                                    onClick={() => handleSort('mentor_utilization_percentage')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.utilization_mentor}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        In-Class Utilization (%)
                                        {getSortIcon('mentor_utilization_percentage')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('utilization_mentor', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                                <th
                                    onClick={() => handleSort('minimum_50_teacher_utilization_status')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.status_50}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Min GJ 50% Status
                                        {getSortIcon('minimum_50_teacher_utilization_status')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('status_50', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                                <th
                                    onClick={() => handleSort('minimum_mentor_utilization_status')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.status_mentor}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        In-Class Status
                                        {getSortIcon('minimum_mentor_utilization_status')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('status_mentor', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                                <th
                                    onClick={() => handleSort('minimum_75_teacher_utilization_status')}
                                    style={{
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        width: `${columnWidths.status_75}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Min GJ 75% Status
                                        {getSortIcon('minimum_75_teacher_utilization_status')}
                                    </div>
                                    <div
                                        className="resize-handle"
                                        onMouseDown={(e) => startResizing('status_75', e)}
                                        onClick={(e) => e.stopPropagation()}
                                    ></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedData.map((teacher) => (
                                <tr
                                    key={teacher.id}
                                    style={{
                                        opacity: teacher.is_active_in_semester ? 1 : 0.6,
                                        background: teacher.is_active_in_semester ? 'transparent' : '#f9fafb'
                                    }}
                                >
                                    <td className="teacher-name">
                                        <div className="name-cell">
                                            {teacher.teacher_name}
                                            {/* ✅ Inactive Badge */}
                                            {!teacher.is_active_in_semester && (
                                                <span style={{
                                                    marginLeft: '8px',
                                                    padding: '2px 8px',
                                                    background: '#fee2e2',
                                                    color: '#991b1b',
                                                    fontSize: '0.75rem',
                                                    borderRadius: '12px',
                                                    fontWeight: 600
                                                }}>
                                                    Inactive
                                                    {teacher.ended_at && (
                                                        <span style={{ fontWeight: 'normal' }}>
                                                            {' '}since {new Date(teacher.ended_at).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>{teacher.level}</td>
                                    <td className="responsibility-cell">{teacher.responsibility}</td>
                                    <td className="hours-cell">{teacher.hours_as_teacher_in_mandatory_class || 0}h</td>
                                    <td className="hours-cell">{teacher.hours_as_teacher_in_non_mandatory_class || 0}h</td>
                                    <td className="hours-cell">{teacher.hours_as_mentor || 0}h</td>
                                    <td className="percentage-cell">
                                        <div className="percentage-bar">
                                            <div
                                                className="percentage-fill"
                                                style={{ width: `${Math.min(parseFloat(teacher.teacher_utilization_percentage) || 0, 100)}%` }}
                                            ></div>
                                            <span className="percentage-text">
                                                {teacher.teacher_utilization_percentage || 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="percentage-cell">
                                        <div className="percentage-bar">
                                            <div
                                                className="percentage-fill mentor"
                                                style={{ width: `${Math.min(parseFloat(teacher.mentor_utilization_percentage) || 0, 100)}%` }}
                                            ></div>
                                            <span className="percentage-text">
                                                {teacher.mentor_utilization_percentage || 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td>{getStatusBadge(teacher.minimum_50_teacher_utilization_status)}</td>
                                    <td>{getStatusBadge(teacher.minimum_mentor_utilization_status)}</td>
                                    <td>{getStatusBadge(teacher.minimum_75_teacher_utilization_status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredAndSortedData.length === 0 && (
                    <div className="empty-state">
                        <Users size={48} />
                        <p>No teachers found matching your criteria</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherUtilization;