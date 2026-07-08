import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import Navbar from './Navbar';
import AttendanceMetricGrid from './AttendanceMetricGrid';
import { SHEET_CONFIG, buildGridRows, getWeeks, buildStatsIndex } from '../utils/attendanceGrid';
import '../styles/AttendancePortal.css';

const AttendancePortal = ({ user, onLogout }) => {
    const { canEdit } = usePermissions();
    const canSync = canEdit('attendance_portal');
    const userEmail = user?.email;

    const [mode, setMode] = useState('attendance');
    const [semesters, setSemesters] = useState([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [activeSheetKey, setActiveSheetKey] = useState(SHEET_CONFIG[0].key);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedSlotName, setSelectedSlotName] = useState('');
    const [rosterRows, setRosterRows] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState([]);
    const [engagementStats, setEngagementStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);

    const activeSheet = SHEET_CONFIG.find((s) => s.key === activeSheetKey) || SHEET_CONFIG[0];

    const loadSemesters = useCallback(async () => {
        const { data, error } = await supabase
            .from('semesters')
            .select('*')
            .order('start_date', { ascending: false });

        if (error) {
            console.error('Error loading semesters:', error);
            return;
        }

        setSemesters(data || []);
        const activeSemester = data?.find((s) => s.is_active);
        setSelectedSemesterId((activeSemester || data?.[0])?.id || null);
    }, []);

    const loadLastSyncLog = useCallback(async () => {
        const { data, error } = await supabase
            .from('attendance_analysis_sync_log')
            .select('finished_at, success')
            .eq('success', true)
            .order('finished_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!error && data) {
            setLastSyncedAt(data.finished_at);
        }
    }, []);

    const loadGridData = useCallback(async (semesterId) => {
        if (!semesterId) return;
        setLoading(true);

        const [rosterRes, attendanceRes, engagementRes] = await Promise.all([
            supabase
                .from('v_current_teacher_assignment_slots')
                .select('*')
                .eq('semester_id', semesterId),
            supabase
                .from('attendance_weekly_stats')
                .select('*')
                .eq('semester_id', semesterId),
            supabase
                .from('student_engagement_weekly_stats')
                .select('*')
                .eq('semester_id', semesterId),
        ]);

        if (rosterRes.error) console.error('Error loading roster:', rosterRes.error);
        if (attendanceRes.error) console.error('Error loading attendance stats:', attendanceRes.error);
        if (engagementRes.error) console.error('Error loading engagement stats:', engagementRes.error);

        setRosterRows(rosterRes.data || []);
        setAttendanceStats(attendanceRes.data || []);
        setEngagementStats(engagementRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSemesters();
        loadLastSyncLog();
    }, [loadSemesters, loadLastSyncLog]);

    useEffect(() => {
        if (selectedSemesterId) {
            loadGridData(selectedSemesterId);
            setSelectedGrade('');
            setSelectedSlotName('');
        }
    }, [selectedSemesterId, loadGridData]);

    const rows = useMemo(
        () => buildGridRows(rosterRows, attendanceStats, engagementStats),
        [rosterRows, attendanceStats, engagementStats]
    );

    const gradeOptions = useMemo(() => {
        const grades = new Set();
        for (const r of rows) {
            if (selectedSlotName === '' || r.slotName === selectedSlotName) grades.add(r.grade);
        }
        return Array.from(grades).sort((a, b) => a - b);
    }, [rows, selectedSlotName]);

    const slotNameOptions = useMemo(() => {
        const slotNames = new Set();
        for (const r of rows) {
            if (selectedGrade === '' || r.grade === Number(selectedGrade)) slotNames.add(r.slotName);
        }
        return Array.from(slotNames).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [rows, selectedGrade]);

    const handleGradeChange = (value) => {
        setSelectedGrade(value);
        if (value !== '') {
            const grade = Number(value);
            const validSlotNames = new Set(rows.filter((r) => r.grade === grade).map((r) => r.slotName));
            setSelectedSlotName((prev) => (prev && !validSlotNames.has(prev) ? '' : prev));
        }
    };

    const handleSlotNameChange = (value) => {
        setSelectedSlotName(value);
        if (value !== '') {
            const validGrades = new Set(rows.filter((r) => r.slotName === value).map((r) => r.grade));
            setSelectedGrade((prev) => (prev !== '' && !validGrades.has(Number(prev)) ? '' : prev));
        }
    };

    const filteredRows = useMemo(() => {
        return rows.filter((r) => {
            if (selectedGrade !== '' && r.grade !== Number(selectedGrade)) return false;
            if (selectedSlotName !== '' && r.slotName !== selectedSlotName) return false;
            return true;
        });
    }, [rows, selectedGrade, selectedSlotName]);

    const weeks = useMemo(
        () => getWeeks(attendanceStats, engagementStats),
        [attendanceStats, engagementStats]
    );
    const statsIndexByDataset = useMemo(
        () => ({
            attendance: buildStatsIndex(attendanceStats),
            engagement: buildStatsIndex(engagementStats),
        }),
        [attendanceStats, engagementStats]
    );

    const handleSyncNow = async () => {
        if (!window.confirm('Sync data attendance & stickiness terbaru dari Metabase sekarang?')) return;

        setIsSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke('attendance_analysis', {
                method: 'POST',
                body: { triggered_by: userEmail || 'unknown' },
            });

            if (error) throw error;

            alert(
                `Sync selesai.\nAttendance rows: ${data?.rows_upserted_attendance ?? 0}\n` +
                `Engagement rows: ${data?.rows_upserted_engagement ?? 0}\n` +
                `Dilewati: ${data?.rows_skipped ?? 0}`
            );

            await loadLastSyncLog();
            if (selectedSemesterId) await loadGridData(selectedSemesterId);
        } catch (error) {
            console.error('Error syncing attendance analysis:', error);
            alert(`Gagal sync: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="attendance-portal-container">
            <Navbar userEmail={user} onLogoutClick={onLogout} />

            <div className="header">
                <div className="header-content">
                    <h1 className="title">Attendance &amp; Stickiness</h1>
                    <p className="subtitle">Data mingguan attendance dan stickiness per grade &amp; slot kelas</p>
                </div>

                <div className="tab-navigation" style={{ maxWidth: 'fit-content' }}>
                    <button
                        className={`tab-button ${mode === 'attendance' ? 'active' : ''}`}
                        onClick={() => setMode('attendance')}
                    >
                        Attendance
                    </button>
                    <button className="tab-button" disabled title="Coming soon">
                        Stickiness
                    </button>
                </div>
            </div>

            {mode === 'stickiness' ? (
                <div className="stickiness-placeholder">Stickiness belum tersedia.</div>
            ) : (
                <>
                    <div className="action-bar">
                        <select
                            className="filter-select"
                            value={selectedSemesterId || ''}
                            onChange={(e) => setSelectedSemesterId(e.target.value)}
                        >
                            {semesters.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            className="filter-select"
                            value={selectedGrade}
                            onChange={(e) => handleGradeChange(e.target.value)}
                        >
                            <option value="">Semua Grade</option>
                            {gradeOptions.map((grade) => (
                                <option key={grade} value={grade}>Grade {grade}</option>
                            ))}
                        </select>

                        <select
                            className="filter-select"
                            value={selectedSlotName}
                            onChange={(e) => handleSlotNameChange(e.target.value)}
                        >
                            <option value="">Semua Slot</option>
                            {slotNameOptions.map((slotName) => (
                                <option key={slotName} value={slotName}>{slotName}</option>
                            ))}
                        </select>

                        {(selectedGrade !== '' || selectedSlotName !== '') && (
                            <button
                                className="secondary-button"
                                onClick={() => {
                                    setSelectedGrade('');
                                    setSelectedSlotName('');
                                }}
                            >
                                Clear Filter
                            </button>
                        )}

                        {canSync && (
                            <button
                                className="primary-button"
                                onClick={handleSyncNow}
                                disabled={isSyncing}
                            >
                                {isSyncing ? 'Syncing...' : 'Sync Now'}
                            </button>
                        )}

                        {lastSyncedAt && (
                            <span className="attendance-last-synced">
                                Last synced: {new Date(lastSyncedAt).toLocaleString('id-ID')}
                            </span>
                        )}
                    </div>

                    <div className="tab-navigation">
                        {SHEET_CONFIG.map((sheet) => (
                            <button
                                key={sheet.key}
                                className={`tab-button ${sheet.key === activeSheetKey ? 'active' : ''}`}
                                onClick={() => setActiveSheetKey(sheet.key)}
                            >
                                {sheet.label}
                            </button>
                        ))}
                    </div>

                    <div className="spreadsheet-container">
                        {loading ? (
                            <div className="attendance-grid-empty">Memuat data...</div>
                        ) : (
                            <AttendanceMetricGrid
                                rows={filteredRows}
                                weeks={weeks}
                                statsIndexByDataset={statsIndexByDataset}
                                sheetConfig={activeSheet}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default AttendancePortal;
