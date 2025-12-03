import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Calendar, User, Clock, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Plus, Trash2, Edit3, RefreshCw, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import '../styles/DataManagement.css';

const AssignmentLogsManagement = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [operationFilter, setOperationFilter] = useState('');
    const [editorFilter, setEditorFilter] = useState('');
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [selectedLog, setSelectedLog] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('teacher_assignment_logs')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;

            // Flatten logs for easier display
            const flattenedLogs = [];
            data?.forEach(row => {
                const logsArray = row.logs || [];
                logsArray.forEach((logEntry, index) => {
                    flattenedLogs.push({
                        id: `${row.id}-${index}`,
                        rowId: row.id,
                        grade: row.grade,
                        slot_name: row.slot_name,
                        ...logEntry
                    });
                });
            });

            // Sort by timestamp descending
            flattenedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            setLogs(flattenedLogs);
        } catch (error) {
            console.error('Error loading logs:', error);
            alert('Failed to load logs');
        } finally {
            setLoading(false);
        }
    };

    const getOperationIcon = (operation) => {
        switch (operation) {
            case 'INSERT':
                return <Plus size={16} className="op-icon op-insert" />;
            case 'DELETE':
                return <Trash2 size={16} className="op-icon op-delete" />;
            case 'UPDATE':
                return <Edit3 size={16} className="op-icon op-update" />;
            case 'UPDATE_VALIDATION_WARNING':
                return <AlertTriangle size={16} className="op-icon op-warning" />;
            default:
                return <RefreshCw size={16} className="op-icon" />;
        }
    };

    const getOperationLabel = (operation) => {
        switch (operation) {
            case 'INSERT':
                return 'Slot Dibuat';
            case 'DELETE':
                return 'Slot Dihapus';
            case 'UPDATE':
                return 'Slot Diupdate';
            case 'UPDATE_VALIDATION_WARNING':
                return 'Validasi Warning';
            default:
                return operation;
        }
    };

    const getOperationBadgeClass = (operation) => {
        switch (operation) {
            case 'INSERT':
                return 'badge-insert';
            case 'DELETE':
                return 'badge-delete';
            case 'UPDATE':
                return 'badge-update';
            case 'UPDATE_VALIDATION_WARNING':
                return 'badge-warning';
            default:
                return 'badge-default';
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '-';

        // Timestamp dari database sudah dalam waktu Asia/Jakarta
        // tapi disimpan dengan offset +00:00, jadi kita parse tanpa konversi
        // Contoh: "2025-12-01T13:15:51.930569+00:00" -> 13:15 WIB (bukan UTC)

        // Ambil bagian tanggal dan waktu saja, abaikan timezone offset
        const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (!match) return '-';

        const [, year, month, day, hour, minute] = match;

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthName = months[parseInt(month) - 1];

        return `${day} ${monthName} ${year}, ${hour}:${minute}`;
    };

    const formatValue = (value) => {
        if (value === null || value === undefined) return <span className="value-null">kosong</span>;
        if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
        if (Array.isArray(value)) {
            if (value.length === 0) return <span className="value-null">kosong</span>;
            return value.join(', ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    };

    const getFieldLabel = (field) => {
        const labels = {
            // Assignment fields
            'assignment': 'Data Assignment',
            'status': 'Status',
            'teacher_name': 'Guru Juara',
            'mentor_name': 'Mentor',
            'days': 'Hari Mengajar',
            'time_range': 'Jam Mengajar',
            'subject': 'Mata Pelajaran',
            'class_rule': 'Tipe Kelas',
            'curriculum': 'Kurikulum',
            'class_capacity': 'Kapasitas Kelas',
            'notes': 'Catatan',
            'slot_name': 'Nama Slot',
            'grade': 'Grade',
            'duration': 'Durasi (menit)',
            'rules': 'Aturan',
            // Date fields
            'batch_start_date': 'Tanggal Mulai Batch',
            'slot_start_date': 'Tanggal Mulai Slot',
            'slot_end_date': 'Tanggal Selesai Slot',
            // ID fields
            'guru_juara_id': 'ID Guru Juara',
            'mentor_id': 'ID Mentor',
            'semester_id': 'ID Semester',
            // Validation fields
            'no_sessions_found': 'Sesi Tidak Ditemukan',
            'matched_sessions': 'Sesi yang Cocok',
            // Meta fields
            'created_by': 'Dibuat Oleh',
            'updated_by': 'Diupdate Oleh',
            'created_at': 'Waktu Dibuat',
            'updated_at': 'Waktu Diupdate'
        };
        return labels[field] || field;
    };

    const formatDate = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const getStatusBadgeClass = (status) => {
        const statusClasses = {
            'Open': 'status-open',
            'Pending': 'status-pending',
            'Upcoming': 'status-upcoming',
            'Active': 'status-active',
            'Completed': 'status-completed',
            'Cancelled': 'status-cancelled'
        };
        return statusClasses[status] || 'status-default';
    };

    const renderChangeDescription = (log) => {
        if (!log.changes || log.changes.length === 0) return null;

        if (log.operation === 'INSERT') {
            const assignment = log.changes.find(c => c.field === 'assignment')?.new_value;
            if (assignment) {
                return (
                    <div className="change-summary">
                        <div className="change-text">
                            <span className="action-label">Membuat slot baru</span>
                            <div className="insert-summary">
                                <span className="summary-item">
                                    <strong>Mapel:</strong> {assignment.subject || '-'}
                                </span>
                                {assignment.class_rule && (
                                    <span className={`class-rule-badge ${assignment.class_rule === 'Mandatory' ? 'mandatory' : 'non-mandatory'}`}>
                                        {assignment.class_rule}
                                    </span>
                                )}
                                {assignment.status && (
                                    <span className={`status-badge-log ${getStatusBadgeClass(assignment.status)}`}>
                                        {assignment.status}
                                    </span>
                                )}
                            </div>
                            {(assignment.teacher_name || assignment.mentor_name) && (
                                <div className="assignment-teachers">
                                    {assignment.teacher_name && (
                                        <span className="teacher-info">
                                            <User size={12} /> Guru: {assignment.teacher_name}
                                        </span>
                                    )}
                                    {assignment.mentor_name && (
                                        <span className="mentor-info">
                                            <User size={12} /> Mentor: {assignment.mentor_name}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        }

        if (log.operation === 'DELETE') {
            const assignment = log.changes.find(c => c.field === 'assignment')?.old_value;
            if (assignment) {
                return (
                    <div className="change-summary delete-summary">
                        <div className="change-text">
                            <span className="action-label delete">Menghapus slot</span>
                            <div className="delete-info">
                                <span className="summary-item strikethrough">
                                    <strong>Mapel:</strong> {assignment.subject || '-'}
                                </span>
                                {assignment.teacher_name && (
                                    <span className="teacher-info strikethrough">
                                        Guru: {assignment.teacher_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            }
        }

        if (log.operation === 'UPDATE') {
            // Group changes by category for better readability
            const teacherChanges = log.changes.filter(c => ['teacher_name', 'mentor_name'].includes(c.field));
            const scheduleChanges = log.changes.filter(c => ['days', 'time_range', 'duration'].includes(c.field));
            const statusChanges = log.changes.filter(c => c.field === 'status');
            const dateChanges = log.changes.filter(c => ['batch_start_date', 'slot_start_date', 'slot_end_date'].includes(c.field));
            const otherChanges = log.changes.filter(c =>
                !['teacher_name', 'mentor_name', 'days', 'time_range', 'duration', 'status', 'batch_start_date', 'slot_start_date', 'slot_end_date'].includes(c.field)
            );

            return (
                <div className="change-summary update-summary">
                    {/* Status changes - most important */}
                    {statusChanges.map((change, idx) => (
                        <div key={`status-${idx}`} className="change-item status-change">
                            <span className="field-name">{getFieldLabel(change.field)}:</span>
                            <span className={`status-badge-log ${getStatusBadgeClass(change.old_value)}`}>
                                {change.old_value || 'kosong'}
                            </span>
                            <span className="arrow">→</span>
                            <span className={`status-badge-log ${getStatusBadgeClass(change.new_value)}`}>
                                {change.new_value || 'kosong'}
                            </span>
                        </div>
                    ))}

                    {/* Teacher/Mentor changes */}
                    {teacherChanges.map((change, idx) => (
                        <div key={`teacher-${idx}`} className="change-item teacher-change">
                            <span className="field-name">{getFieldLabel(change.field)}:</span>
                            <span className="old-value">{formatValue(change.old_value)}</span>
                            <span className="arrow">→</span>
                            <span className="new-value highlight">{formatValue(change.new_value)}</span>
                        </div>
                    ))}

                    {/* Schedule changes */}
                    {scheduleChanges.map((change, idx) => (
                        <div key={`schedule-${idx}`} className="change-item">
                            <span className="field-name">{getFieldLabel(change.field)}:</span>
                            <span className="old-value">{formatValue(change.old_value)}</span>
                            <span className="arrow">→</span>
                            <span className="new-value">{formatValue(change.new_value)}</span>
                        </div>
                    ))}

                    {/* Date changes */}
                    {dateChanges.map((change, idx) => (
                        <div key={`date-${idx}`} className="change-item">
                            <span className="field-name">{getFieldLabel(change.field)}:</span>
                            <span className="old-value">{formatDate(change.old_value) || 'kosong'}</span>
                            <span className="arrow">→</span>
                            <span className="new-value">{formatDate(change.new_value) || 'kosong'}</span>
                        </div>
                    ))}

                    {/* Other changes */}
                    {otherChanges.map((change, idx) => (
                        <div key={`other-${idx}`} className="change-item">
                            <span className="field-name">{getFieldLabel(change.field)}:</span>
                            <span className="old-value">{formatValue(change.old_value)}</span>
                            <span className="arrow">→</span>
                            <span className="new-value">{formatValue(change.new_value)}</span>
                        </div>
                    ))}
                </div>
            );
        }

        if (log.operation === 'UPDATE_VALIDATION_WARNING') {
            return (
                <div className="change-summary warning-summary">
                    <AlertTriangle size={14} />
                    <span>{log.error_message}</span>
                </div>
            );
        }

        return null;
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const openDetailModal = (log) => {
        setSelectedLog(log);
        setShowDetailModal(true);
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch =
                searchTerm === '' ||
                log.slot_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.editor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.description?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesGrade = gradeFilter === '' || log.grade === parseInt(gradeFilter);
            const matchesOperation = operationFilter === '' || log.operation === operationFilter;

            // Editor filter - handle null/System cases
            const editorValue = log.editor || 'System';
            const matchesEditor = editorFilter === '' || editorValue === editorFilter;

            return matchesSearch && matchesGrade && matchesOperation && matchesEditor;
        });
    }, [logs, searchTerm, gradeFilter, operationFilter, editorFilter]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, gradeFilter, operationFilter, editorFilter]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    const goToPage = (page) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
        setExpandedRows(new Set()); // Collapse all rows when changing page
    };

    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const uniqueGrades = [...new Set(logs.map(l => l.grade))].sort((a, b) => a - b);
    const uniqueOperations = [...new Set(logs.map(l => l.operation))];
    const uniqueEditors = [...new Set(logs.map(l => l.editor || 'System'))].sort((a, b) => {
        // Put "System" at the end
        if (a === 'System') return 1;
        if (b === 'System') return -1;
        return a.localeCompare(b);
    });

    if (loading) {
        return (
            <div className="dm-loading-container">
                <div className="dm-loading-spinner"></div>
                <p className="dm-loading-text">Memuat log aktivitas...</p>
            </div>
        );
    }

    return (
        <div className="management-section">
            <div className="section-header">
                <h2>Assignment Activity Logs</h2>
                <button className="dm-btn-primary dm-btn-sm" onClick={loadLogs}>
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="logs-filters">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Cari slot, editor, atau deskripsi..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <select
                        value={gradeFilter}
                        onChange={(e) => setGradeFilter(e.target.value)}
                    >
                        <option value="">Semua Grade</option>
                        {uniqueGrades.map(grade => (
                            <option key={grade} value={grade}>Grade {grade}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        value={operationFilter}
                        onChange={(e) => setOperationFilter(e.target.value)}
                    >
                        <option value="">Semua Operasi</option>
                        {uniqueOperations.map(op => (
                            <option key={op} value={op}>{getOperationLabel(op)}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        value={editorFilter}
                        onChange={(e) => setEditorFilter(e.target.value)}
                    >
                        <option value="">Semua Editor</option>
                        {uniqueEditors.map(editor => (
                            <option key={editor} value={editor}>{editor}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="logs-stats">
                <div className="stat-item">
                    <span className="stat-number">{filteredLogs.length}</span>
                    <span className="stat-label">Total Log</span>
                </div>
                <div className="stat-item stat-insert">
                    <span className="stat-number">{filteredLogs.filter(l => l.operation === 'INSERT').length}</span>
                    <span className="stat-label">Dibuat</span>
                </div>
                <div className="stat-item stat-update">
                    <span className="stat-number">{filteredLogs.filter(l => l.operation === 'UPDATE').length}</span>
                    <span className="stat-label">Diupdate</span>
                </div>
                <div className="stat-item stat-delete">
                    <span className="stat-number">{filteredLogs.filter(l => l.operation === 'DELETE').length}</span>
                    <span className="stat-label">Dihapus</span>
                </div>
                <div className="stat-item stat-warning">
                    <span className="stat-number">{filteredLogs.filter(l => l.operation === 'UPDATE_VALIDATION_WARNING').length}</span>
                    <span className="stat-label">Warning</span>
                </div>
            </div>

            {/* Pagination Info & Controls */}
            {filteredLogs.length > 0 && (
                <div className="pagination-header">
                    <div className="pagination-info">
                        Menampilkan <strong>{startIndex + 1}</strong> - <strong>{Math.min(endIndex, filteredLogs.length)}</strong> dari <strong>{filteredLogs.length}</strong> log
                    </div>
                    <div className="pagination-per-page">
                        <span>Per halaman:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        title="Halaman pertama"
                    >
                        <ChevronsLeft size={18} />
                    </button>
                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        title="Halaman sebelumnya"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="pagination-pages">
                        {getPageNumbers().map((page, index) => (
                            page === '...' ? (
                                <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                            ) : (
                                <button
                                    key={page}
                                    className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => goToPage(page)}
                                >
                                    {page}
                                </button>
                            )
                        ))}
                    </div>

                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        title="Halaman selanjutnya"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        title="Halaman terakhir"
                    >
                        <ChevronsRight size={18} />
                    </button>
                </div>
            )}

            {/* Logs Timeline */}
            <div className="logs-timeline">
                {paginatedLogs.length === 0 ? (
                    <div className="empty-state">
                        <Calendar size={48} />
                        <p>Tidak ada log yang ditemukan</p>
                    </div>
                ) : (
                    paginatedLogs.map((log) => (
                        <div key={log.id} className={`log-card ${expandedRows.has(log.id) ? 'expanded' : ''}`}>
                            <div className="log-header" onClick={() => toggleRow(log.id)}>
                                <div className="log-info">
                                    <div className="log-operation">
                                        {getOperationIcon(log.operation)}
                                        <span className={`operation-badge ${getOperationBadgeClass(log.operation)}`}>
                                            {getOperationLabel(log.operation)}
                                        </span>
                                    </div>
                                    <div className="log-slot">
                                        <strong>Grade {log.grade}</strong> - {log.slot_name}
                                    </div>
                                </div>
                                <div className="log-meta">
                                    <div className="log-editor">
                                        <User size={14} />
                                        <span>{log.editor || 'System'}</span>
                                    </div>
                                    <div className="log-time">
                                        <Clock size={14} />
                                        <span>{formatTimestamp(log.timestamp)}</span>
                                    </div>
                                    <button className="expand-btn">
                                        {expandedRows.has(log.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Change Summary - Always visible */}
                            <div className="log-summary">
                                {renderChangeDescription(log)}
                            </div>

                            {/* Expanded Details */}
                            {expandedRows.has(log.id) && (
                                <div className="log-details">
                                    <div className="detail-section">
                                        <h4>Detail Perubahan</h4>
                                        {log.operation === 'INSERT' && log.changes?.find(c => c.field === 'assignment')?.new_value && (
                                            <div className="assignment-detail">
                                                <table className="detail-table">
                                                    <tbody>
                                                        {Object.entries(log.changes.find(c => c.field === 'assignment').new_value).map(([key, value]) => (
                                                            <tr key={key}>
                                                                <td className="detail-label">{getFieldLabel(key)}</td>
                                                                <td className="detail-value">{formatValue(value)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {log.operation === 'DELETE' && log.changes?.find(c => c.field === 'assignment')?.old_value && (
                                            <div className="assignment-detail deleted">
                                                <table className="detail-table">
                                                    <tbody>
                                                        {Object.entries(log.changes.find(c => c.field === 'assignment').old_value).map(([key, value]) => (
                                                            <tr key={key}>
                                                                <td className="detail-label">{getFieldLabel(key)}</td>
                                                                <td className="detail-value strikethrough">{formatValue(value)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {log.operation === 'UPDATE' && (
                                            <div className="changes-list">
                                                {log.changes?.map((change, idx) => (
                                                    <div key={idx} className="change-row">
                                                        <span className="change-field">{getFieldLabel(change.field)}</span>
                                                        <div className="change-values">
                                                            <div className="value-box old">
                                                                <span className="value-label">Sebelum</span>
                                                                <span className="value-content">{formatValue(change.old_value)}</span>
                                                            </div>
                                                            <span className="change-arrow">→</span>
                                                            <div className="value-box new">
                                                                <span className="value-label">Sesudah</span>
                                                                <span className="value-content">{formatValue(change.new_value)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {log.operation === 'UPDATE_VALIDATION_WARNING' && (
                                            <div className="validation-detail">
                                                <div className="warning-box">
                                                    <AlertTriangle size={20} />
                                                    <div>
                                                        <strong>Pesan Warning:</strong>
                                                        <p>{log.error_message}</p>
                                                    </div>
                                                </div>
                                                {log.validation_details && (
                                                    <div className="validation-info">
                                                        <h5>Detail Validasi:</h5>
                                                        <table className="detail-table">
                                                            <tbody>
                                                                {Object.entries(log.validation_details).map(([key, value]) => (
                                                                    <tr key={key}>
                                                                        <td className="detail-label">{getFieldLabel(key)}</td>
                                                                        <td className="detail-value">{formatValue(value)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {log.is_failed && (
                                        <div className="error-section">
                                            <XCircle size={16} />
                                            <span>Operasi Gagal: {log.error_message}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AssignmentLogsManagement;
