import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import Navbar from './Navbar';
import AttendanceMetricGrid from './AttendanceMetricGrid';
import MultiSelectFilter from './MultiSelectFilter';
import { SHEET_CONFIG, buildGridRows, getWeeks, buildStatsIndex, buildCsvRows, toCsvString } from '../utils/attendanceGrid';
import '../styles/AttendancePortal.css';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const getRowDays = (row) => (row.days === '—' ? [] : row.days.split(', '));

const AttendancePortal = ({ user, onLogout }) => {
    const { canEdit } = usePermissions();
    const canSync = canEdit('attendance_portal');
    const userEmail = user?.email;

    const [mode, setMode] = useState('attendance');
    const [semesters, setSemesters] = useState([]);
    const [selectedSemesterId, setSelectedSemesterId] = useState(null);
    const [activeSheetKey, setActiveSheetKey] = useState(SHEET_CONFIG[0].key);
    const [selectedGrades, setSelectedGrades] = useState([]);
    const [selectedSlotNames, setSelectedSlotNames] = useState([]);
    const [selectedGuruJuaras, setSelectedGuruJuaras] = useState([]);
    const [selectedDays, setSelectedDays] = useState([]);
    const [selectedTimes, setSelectedTimes] = useState([]);
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
            setSelectedGrades([]);
            setSelectedSlotNames([]);
            setSelectedGuruJuaras([]);
            setSelectedDays([]);
            setSelectedTimes([]);
        }
    }, [selectedSemesterId, loadGridData]);

    const rows = useMemo(
        () => buildGridRows(rosterRows, attendanceStats, engagementStats),
        [rosterRows, attendanceStats, engagementStats]
    );

    // Each filter's own selection is excluded from its own option list, so picking
    // Grade 4 narrows Slot/Guru/Days/Times, picking a Slot narrows Grade, etc.
    const matchesFilters = useCallback((row, exclude) => {
        if (exclude !== 'grade' && selectedGrades.length && !selectedGrades.includes(row.grade)) return false;
        if (exclude !== 'slot' && selectedSlotNames.length && !selectedSlotNames.includes(row.slotName)) return false;
        if (exclude !== 'guru' && selectedGuruJuaras.length && !selectedGuruJuaras.includes(row.guruJuara)) return false;
        if (exclude !== 'days' && selectedDays.length) {
            const rowDays = getRowDays(row);
            if (!selectedDays.some((d) => rowDays.includes(d))) return false;
        }
        if (exclude !== 'times' && selectedTimes.length && !selectedTimes.includes(row.timeRange)) return false;
        return true;
    }, [selectedGrades, selectedSlotNames, selectedGuruJuaras, selectedDays, selectedTimes]);

    const buildOptionValues = useCallback((mapFn, exclude) => {
        const values = new Set();
        for (const row of rows) {
            if (!matchesFilters(row, exclude)) continue;
            const value = mapFn(row);
            const items = Array.isArray(value) ? value : [value];
            for (const item of items) {
                if (item && item !== '—') values.add(item);
            }
        }
        return values;
    }, [rows, matchesFilters]);

    const gradeOptions = useMemo(
        () => Array.from(buildOptionValues((r) => r.grade, 'grade'))
            .sort((a, b) => a - b)
            .map((grade) => ({ value: grade, label: `Grade ${grade}` })),
        [buildOptionValues]
    );

    const slotNameOptions = useMemo(
        () => Array.from(buildOptionValues((r) => r.slotName, 'slot'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .map((slotName) => ({ value: slotName, label: slotName })),
        [buildOptionValues]
    );

    const guruJuaraOptions = useMemo(
        () => Array.from(buildOptionValues((r) => r.guruJuara, 'guru'))
            .sort((a, b) => a.localeCompare(b))
            .map((name) => ({ value: name, label: name })),
        [buildOptionValues]
    );

    const dayOptions = useMemo(
        () => Array.from(buildOptionValues((r) => getRowDays(r), 'days'))
            .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
            .map((day) => ({ value: day, label: day })),
        [buildOptionValues]
    );

    const timeOptions = useMemo(
        () => Array.from(buildOptionValues((r) => r.timeRange, 'times'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .map((time) => ({ value: time, label: time })),
        [buildOptionValues]
    );

    // Selections that fall out of a narrowed option list (e.g. a Slot that no
    // longer matches after Grade changes) are dropped automatically. Bail out
    // to the same array reference when nothing was actually removed, or the
    // new-array-every-filter-call would retrigger these effects forever.
    const dropStale = (prev, validValues) => {
        const next = prev.filter((v) => validValues.has(v));
        return next.length === prev.length ? prev : next;
    };

    useEffect(() => {
        const validGrades = new Set(gradeOptions.map((o) => o.value));
        setSelectedGrades((prev) => dropStale(prev, validGrades));
    }, [gradeOptions]);

    useEffect(() => {
        const validSlotNames = new Set(slotNameOptions.map((o) => o.value));
        setSelectedSlotNames((prev) => dropStale(prev, validSlotNames));
    }, [slotNameOptions]);

    useEffect(() => {
        const validGuruJuaras = new Set(guruJuaraOptions.map((o) => o.value));
        setSelectedGuruJuaras((prev) => dropStale(prev, validGuruJuaras));
    }, [guruJuaraOptions]);

    useEffect(() => {
        const validDays = new Set(dayOptions.map((o) => o.value));
        setSelectedDays((prev) => dropStale(prev, validDays));
    }, [dayOptions]);

    useEffect(() => {
        const validTimes = new Set(timeOptions.map((o) => o.value));
        setSelectedTimes((prev) => dropStale(prev, validTimes));
    }, [timeOptions]);

    const hasActiveFilter = selectedGrades.length > 0 || selectedSlotNames.length > 0
        || selectedGuruJuaras.length > 0 || selectedDays.length > 0 || selectedTimes.length > 0;

    const clearFilters = () => {
        setSelectedGrades([]);
        setSelectedSlotNames([]);
        setSelectedGuruJuaras([]);
        setSelectedDays([]);
        setSelectedTimes([]);
    };

    const filteredRows = useMemo(
        () => rows.filter((r) => matchesFilters(r, null)),
        [rows, matchesFilters]
    );

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

    const handleExportCsv = () => {
        const csvRows = buildCsvRows(filteredRows, weeks, statsIndexByDataset, activeSheet);
        const csvContent = toCsvString(csvRows);
        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const semesterName = semesters.find((s) => s.id === selectedSemesterId)?.name || 'semester';
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `attendance_${activeSheet.key}_${semesterName}_${dateStr}`
            .replace(/[^a-z0-9]+/gi, '_');

        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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

                        <MultiSelectFilter
                            label="Grade"
                            options={gradeOptions}
                            selectedValues={selectedGrades}
                            onChange={setSelectedGrades}
                        />

                        <MultiSelectFilter
                            label="Slot"
                            options={slotNameOptions}
                            selectedValues={selectedSlotNames}
                            onChange={setSelectedSlotNames}
                        />

                        <MultiSelectFilter
                            label="Guru Juara"
                            options={guruJuaraOptions}
                            selectedValues={selectedGuruJuaras}
                            onChange={setSelectedGuruJuaras}
                        />

                        <MultiSelectFilter
                            label="Days"
                            options={dayOptions}
                            selectedValues={selectedDays}
                            onChange={setSelectedDays}
                        />

                        <MultiSelectFilter
                            label="Times"
                            options={timeOptions}
                            selectedValues={selectedTimes}
                            onChange={setSelectedTimes}
                        />

                        {hasActiveFilter && (
                            <button
                                className="secondary-button"
                                onClick={clearFilters}
                            >
                                Clear Filter
                            </button>
                        )}

                        <button
                            className="export-button"
                            onClick={handleExportCsv}
                            disabled={filteredRows.length === 0}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Export CSV
                        </button>

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
