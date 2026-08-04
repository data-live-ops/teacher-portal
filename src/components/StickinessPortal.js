import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { stickinessSupabase } from '../lib/stickinessSupabaseClient';
import { supabase } from '../lib/supabaseClient.mjs';
import StickinessWeeklyGrid from './StickinessWeeklyGrid';
import StickinessCurrentWeek from './StickinessCurrentWeek';
import StickinessPerformanceDistribution from './StickinessPerformanceDistribution';
import { formatWeekDate } from '../utils/stickinessUtils';
import '../styles/StickinessPortal.css';

const VIEWS = [
  { key: 'weekly_grid', label: 'Weekly Grid' },
  { key: 'current_week', label: 'Current Week' },
  { key: 'performance_dist', label: 'Performance Distribution' },
];

const PAGE_SIZE = 1000;

/** Paginate through a Supabase table, returning all matching rows. */
async function fetchAllRows(client, table, semesterId) {
  const allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('semester_id', semesterId)
      .order('week_period', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

/** First Monday on or after semesterStartDate (YYYY-MM-DD), returned as Date (UTC). */
function getSemesterWeek1Start(semesterStartDate) {
  const d = new Date(semesterStartDate + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  return new Date(d.getTime() + daysToMonday * 24 * 60 * 60 * 1000);
}

/** Compute week number relative to semester's Week 1 start. */
function computeWeekNumber(weekPeriodStr, week1Start) {
  const d = new Date(weekPeriodStr + 'T00:00:00Z');
  return Math.round((d.getTime() - week1Start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/** Fetch distinct week_period values directly from DB (paginated), labeled relative to semester start. */
async function fetchWeekPeriods(client, table, semesterId, semesterStartDate) {
  const all = new Set();
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select('week_period')
      .eq('semester_id', semesterId)
      .order('week_period', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    data.forEach((r) => all.add(r.week_period));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const week1Start = semesterStartDate ? getSemesterWeek1Start(semesterStartDate) : null;

  return Array.from(all)
    .sort()
    .map((date, index) => ({
      date,
      label: week1Start ? `Week ${computeWeekNumber(date, week1Start)}` : `Week ${index + 1}`,
      dateLabel: formatWeekDate(date),
    }));
}

function StickinessPortal() {
  const [stickinessType, setStickinessType] = useState('historical');
  const [activeView, setActiveView] = useState('weekly_grid');

  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState(null);

  const [stickinessData, setStickinessData] = useState([]);
  const [weekPeriods, setWeekPeriods] = useState([]);
  const [rosterRows, setRosterRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSemesters = useCallback(async () => {
    const { data, error: err } = await stickinessSupabase
      .from('semesters')
      .select('*')
      .order('start_date', { ascending: false });
    if (err) { setError('Gagal memuat daftar semester.'); return; }
    setSemesters(data || []);
    const active = data?.find((s) => s.is_active);
    setSelectedSemesterId((active || data?.[0])?.id || null);
  }, []);

  const loadStickinessData = useCallback(async (semesterId, type, semesterStartDate) => {
    if (!semesterId) return;
    setLoading(true);
    setError(null);

    const table = type === 'active' ? 'active_stickiness' : 'historical_stickiness';

    try {
      // Fetch week_periods and full data in parallel
      const [weeks, rows] = await Promise.all([
        fetchWeekPeriods(stickinessSupabase, table, semesterId, semesterStartDate),
        fetchAllRows(stickinessSupabase, table, semesterId),
      ]);
      setWeekPeriods(weeks);
      setStickinessData(rows);
    } catch (err) {
      console.error('Error loading stickiness:', err);
      setError(`Gagal memuat data stickiness: ${err.message}`);
      setStickinessData([]);
      setWeekPeriods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Match external semester (academic_year + term) to local semester (academic_year + semester_number).
   * External: term=1 (Ganjil), term=2 (Genap). Local: semester_number=1, semester_number=2.
   * Fallbacks: active semester → most recent semester.
   */
  const loadRosterRows = useCallback(async (semesterId, externalSemesters) => {
    const externalSem = externalSemesters.find((s) => s.id === semesterId);

    const { data: localSemesters, error: lsErr } = await supabase
      .from('semesters')
      .select('id, academic_year, semester_number, is_active, start_date')
      .order('start_date', { ascending: false });

    if (lsErr) { setRosterRows([]); return; }

    // Primary: match by academic_year + term (external) = semester_number (local)
    let localSemesterId = localSemesters?.find(
      (s) => s.academic_year === externalSem?.academic_year && s.semester_number === externalSem?.term
    )?.id;

    // Fallback: local active semester
    if (!localSemesterId) {
      localSemesterId = localSemesters?.find((s) => s.is_active)?.id;
    }

    // Fallback: most recent
    if (!localSemesterId) {
      localSemesterId = localSemesters?.[0]?.id;
    }

    if (!localSemesterId) { setRosterRows([]); return; }

    const { data, error: rErr } = await supabase
      .from('v_current_teacher_assignment_slots')
      .select('grade, slot_name, days, time_range')
      .eq('semester_id', localSemesterId);

    if (rErr) { setRosterRows([]); return; }
    setRosterRows(data || []);
  }, []);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (selectedSemesterId && semesters.length > 0) {
      const sem = semesters.find((s) => s.id === selectedSemesterId);
      loadStickinessData(selectedSemesterId, stickinessType, sem?.start_date);
      loadRosterRows(selectedSemesterId, semesters);
    }
  }, [selectedSemesterId, stickinessType, semesters, loadStickinessData, loadRosterRows]);

  // historical_stickiness/active_stickiness have no dedicated sync log (unlike
  // attendance) - the newest row's updated_at across the currently loaded
  // type/semester is the best available proxy for "last synced".
  const lastSyncedAt = useMemo(() => {
    let latest = null;
    for (const r of stickinessData) {
      if (r.updated_at && (!latest || r.updated_at > latest)) latest = r.updated_at;
    }
    return latest;
  }, [stickinessData]);

  const semesterName = semesters.find((s) => s.id === selectedSemesterId)?.name || 'semester';

  return (
    <div className="stickiness-portal">
      <div className="stickiness-type-tabs">
        <div className="tab-navigation" style={{ maxWidth: 'fit-content' }}>
          <button
            className={`tab-button ${stickinessType === 'historical' ? 'active' : ''}`}
            onClick={() => setStickinessType('historical')}
          >
            Historical
          </button>
          <button
            className={`tab-button ${stickinessType === 'active' ? 'active' : ''}`}
            onClick={() => setStickinessType('active')}
          >
            Active Student
          </button>
        </div>

        <select
          className="filter-select"
          value={selectedSemesterId || ''}
          onChange={(e) => setSelectedSemesterId(Number(e.target.value))}
        >
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {lastSyncedAt && (
          <span className="attendance-last-synced">
            Last synced: {new Date(lastSyncedAt).toLocaleString('id-ID')}
          </span>
        )}
      </div>

      <div className="tab-navigation">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={`tab-button ${activeView === v.key ? 'active' : ''}`}
            onClick={() => setActiveView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {error && <div className="stickiness-error">{error}</div>}

      {loading ? (
        <div className="attendance-grid-empty">Memuat data stickiness...</div>
      ) : (
        <>
          {activeView === 'weekly_grid' && (
            <StickinessWeeklyGrid
              stickinessRows={stickinessData}
              rosterRows={rosterRows}
              weekPeriods={weekPeriods}
              stickinessType={stickinessType}
              semesterName={semesterName}
            />
          )}
          {activeView === 'current_week' && (
            <StickinessCurrentWeek
              stickinessRows={stickinessData}
              rosterRows={rosterRows}
              weekPeriods={weekPeriods}
              stickinessType={stickinessType}
              semesterName={semesterName}
            />
          )}
          {activeView === 'performance_dist' && (
            <StickinessPerformanceDistribution
              stickinessRows={stickinessData}
              weekPeriods={weekPeriods}
            />
          )}
        </>
      )}
    </div>
  );
}

export default StickinessPortal;
