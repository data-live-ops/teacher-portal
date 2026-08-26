import React, { useMemo, useState, useCallback } from 'react';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import MultiSelectFilter from './MultiSelectFilter';
import FilterReflection from './FilterReflection';
import {
  computeDistribution, computeWeeklyTrend, getLatestPerSlot, classifyMeetingFrequency,
  STATUS_LIST, JENJANG_COLORS, getStatusColor,
  buildJenjangColumnKeys, baseJenjangOf, MEETING_FREQUENCY_OPTIONS,
} from '../utils/stickinessUtils';
import { buildFilterReflections } from '../utils/filterReflection';

/** Header color for a Per Jenjang / Weekly Trend column ("Grade 10-11", "Grade 10-11 (1x)", ...). */
function getColumnColor(columnKey) {
  return JENJANG_COLORS[baseJenjangOf(columnKey)];
}

const STATUS_DISPLAY = {
  'EXCEPTIONAL':       'Exceptional',
  'ON AVERAGE':        'On Average',
  'BELOW AVERAGE':     'Below Average',
  'NOT AVAILABLE YET': 'Not Available Yet',
};

function fmt(val, decimals = 2) {
  if (val == null || Number.isNaN(val)) return '#N/A';
  return Number(val).toFixed(decimals);
}

function fmtPct(val) {
  if (val == null || Number.isNaN(val)) return '0.00%';
  return `${Number(val).toFixed(2)}%`;
}

// ── Entire Slot tab ──────────────────────────────────────────────────────────
function EntireSlotTable({ distribution }) {
  const { entireSlot } = distribution;
  const total = STATUS_LIST.reduce((s, st) => s + (st === 'NOT AVAILABLE YET' ? 0 : (entireSlot[st]?.count || 0)), 0)
    + (entireSlot['NOT AVAILABLE YET']?.count || 0);

  return (
    <div className="stickiness-dist-section">
      <h3 className="stickiness-dist-subtitle">Entire Slot</h3>
      <table className="stickiness-dist-table">
        <thead>
          <tr>
            <th></th>
            <th>Slot Performing</th>
            <th>%</th>
            <th>Avg. Stickiness</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_LIST.map((status) => {
            const d = entireSlot[status] || { count: 0, pct: 0, avgStickiness: null };
            const statusColor = getStatusColor(status === 'NOT AVAILABLE YET' ? null : status);
            return (
              <tr key={status}>
                <td>
                  <span className="stickiness-status-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                    {STATUS_DISPLAY[status]}
                  </span>
                </td>
                <td className="stickiness-number-cell">{d.count}</td>
                <td className="stickiness-number-cell">{fmtPct(d.pct)}</td>
                <td className="stickiness-number-cell">{fmt(d.avgStickiness)}</td>
              </tr>
            );
          })}
          <tr className="stickiness-dist-total">
            <td>Total</td>
            <td className="stickiness-number-cell">{total}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Per Jenjang tab ──────────────────────────────────────────────────────────
function PerJenjangTable({ distribution }) {
  const { perJenjang, gap } = distribution;
  const columns = useMemo(() => buildJenjangColumnKeys(), []);

  return (
    <div className="stickiness-dist-section">
      <h3 className="stickiness-dist-subtitle">Per Jenjang</h3>
      <div className="table-scroll-container">
        <table className="stickiness-dist-table stickiness-jenjang-table">
          <thead>
            <tr>
              <th></th>
              {columns.map((col) => (
                <th key={col} colSpan={3} style={{ background: getColumnColor(col).header, borderBottom: `2px solid ${getColumnColor(col).border}` }}>
                  {col}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {columns.map((col) => (
                <React.Fragment key={col}>
                  <th style={{ background: getColumnColor(col).header }}>Slot</th>
                  <th style={{ background: getColumnColor(col).header }}>%</th>
                  <th style={{ background: getColumnColor(col).header }}>Avg.</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {STATUS_LIST.map((status) => {
              const statusColor = getStatusColor(status === 'NOT AVAILABLE YET' ? null : status);
              return (
                <tr key={status}>
                  <td>
                    <span className="stickiness-status-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                      {STATUS_DISPLAY[status]}
                    </span>
                  </td>
                  {columns.map((col) => {
                    const d = (perJenjang[col] || {})[status] || { count: 0, pct: 0, avgStickiness: null };
                    return (
                      <React.Fragment key={col}>
                        <td className="stickiness-number-cell">{d.count}</td>
                        <td className="stickiness-number-cell">{fmtPct(d.pct)}</td>
                        <td className="stickiness-number-cell">{fmt(d.avgStickiness)}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="stickiness-dist-gap">
              <td>gap exceptional - below</td>
              {columns.map((col) => (
                <td key={col} colSpan={3} className="stickiness-number-cell">
                  {fmt(gap[col])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Weekly Trend tab ─────────────────────────────────────────────────────────
const TREND_GROUPS = ['General', ...buildJenjangColumnKeys()];

function WeeklyTrendTable({ allStickinessRows, weekPeriods }) {
  const trendData = useMemo(() => computeWeeklyTrend(allStickinessRows, weekPeriods), [allStickinessRows, weekPeriods]);

  // Collect sparkline data per (group, status)
  const sparklineData = useMemo(() => {
    const result = {};
    for (const group of TREND_GROUPS) {
      result[group] = {};
      for (const status of ['EXCEPTIONAL', 'ON AVERAGE', 'BELOW AVERAGE']) {
        result[group][status] = {
          avg: weekPeriods.map((w) => trendData[w.date]?.[group]?.[status]?.avgStickiness ?? null),
          pct: weekPeriods.map((w) => trendData[w.date]?.[group]?.[status]?.pct ?? null),
        };
      }
    }
    return result;
  }, [trendData, weekPeriods]);

  const filterNull = (arr) => arr.filter((v) => v != null);

  return (
    <div className="stickiness-dist-section">
      <h3 className="stickiness-dist-subtitle">Average Stickiness Improvement (Weekly)</h3>
      <div className="table-scroll-container">
        <table className="stickiness-dist-table stickiness-trend-table">
          <thead>
            <tr>
              <th>Periode</th>
              {TREND_GROUPS.map((group) => (
                <th key={group} colSpan={6} style={group !== 'General' ? { background: getColumnColor(group)?.header } : {}}>
                  {group}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {TREND_GROUPS.map((group) => (
                <React.Fragment key={group}>
                  <th style={group !== 'General' ? { background: getColumnColor(group)?.header } : {}}>Exceptional</th>
                  <th style={group !== 'General' ? { background: getColumnColor(group)?.header } : {}}>%</th>
                  <th style={group !== 'General' ? { background: getColumnColor(group)?.header } : {}}>On Average</th>
                  <th style={group !== 'General' ? { background: getColumnColor(group)?.header } : {}}>%</th>
                  <th style={group !== 'General' ? { background: getColumnColor(group)?.header } : {}}>Below Average</th>
                  <th style={group !== 'General' ? { background: getColumnColor(group)?.header } : {}}>%</th>
                </React.Fragment>
              ))}
            </tr>
            {/* Trendline row */}
            <tr className="stickiness-trendline-row">
              <td>Trendline</td>
              {TREND_GROUPS.map((group) => (
                <React.Fragment key={group}>
                  {['EXCEPTIONAL', 'ON AVERAGE', 'BELOW AVERAGE'].map((status) => (
                    <React.Fragment key={status}>
                      <td>
                        {filterNull(sparklineData[group][status].avg).length > 1 ? (
                          <Sparklines data={filterNull(sparklineData[group][status].avg)} height={24} width={60} margin={2}>
                            <SparklinesLine color="#3987e5" style={{ fill: 'none', strokeWidth: 1.5 }} />
                          </Sparklines>
                        ) : '—'}
                      </td>
                      <td>
                        {filterNull(sparklineData[group][status].pct).length > 1 ? (
                          <Sparklines data={filterNull(sparklineData[group][status].pct)} height={24} width={60} margin={2}>
                            <SparklinesLine color="#7c3aed" style={{ fill: 'none', strokeWidth: 1.5 }} />
                          </Sparklines>
                        ) : '—'}
                      </td>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekPeriods.map((w) => {
              const weekData = trendData[w.date] || {};
              return (
                <tr key={w.date}>
                  <td className="stickiness-week-label">{w.date}</td>
                  {TREND_GROUPS.map((group) => {
                    const g = weekData[group] || {};
                    return (
                      <React.Fragment key={group}>
                        {['EXCEPTIONAL', 'ON AVERAGE', 'BELOW AVERAGE'].map((status) => {
                          const d = g[status] || { avgStickiness: null, pct: 0 };
                          return (
                            <React.Fragment key={status}>
                              <td className="stickiness-number-cell">{fmt(d.avgStickiness)}</td>
                              <td className="stickiness-number-cell">{fmtPct(d.pct)}</td>
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ALL_WEEKS = '__ALL_WEEKS__';

// ── Main component ────────────────────────────────────────────────────────────
function StickinessPerformanceDistribution({ stickinessRows, weekPeriods }) {
  const latestWeek = weekPeriods[weekPeriods.length - 1]?.date || null;
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [innerTab, setInnerTab] = useState('entire');

  const [selectedGrades, setSelectedGrades] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedFrequencies, setSelectedFrequencies] = useState([]);

  const matchesFilters = useCallback((row, exclude) => {
    if (exclude !== 'grade' && selectedGrades.length && !selectedGrades.includes(row.course_grade)) return false;
    if (exclude !== 'slot' && selectedSlots.length && !selectedSlots.includes(row.slot_name)) return false;
    if (exclude !== 'teacher' && selectedTeachers.length && !selectedTeachers.includes(row.teacher_name)) return false;
    if (exclude !== 'subject' && selectedSubjects.length && !selectedSubjects.includes(row.subject)) return false;
    if (exclude !== 'freq' && selectedFrequencies.length && !selectedFrequencies.includes(classifyMeetingFrequency(row.slot_name))) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrades, selectedSlots, selectedTeachers, selectedSubjects, selectedFrequencies]);

  const buildOptions = useCallback((mapFn, exclude) => {
    const values = new Set();
    for (const row of stickinessRows) {
      if (!matchesFilters(row, exclude)) continue;
      const value = mapFn(row);
      if (value != null && value !== '') values.add(value);
    }
    return values;
  }, [stickinessRows, matchesFilters]);

  const gradeOptions = useMemo(
    () => Array.from(buildOptions((r) => r.course_grade, 'grade')).sort((a, b) => a - b).map((g) => ({ value: g, label: `Grade ${g}` })),
    [buildOptions]
  );
  const slotOptions = useMemo(
    () => Array.from(buildOptions((r) => r.slot_name, 'slot')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((s) => ({ value: s, label: s })),
    [buildOptions]
  );
  const teacherOptions = useMemo(
    () => Array.from(buildOptions((r) => r.teacher_name, 'teacher')).sort((a, b) => a.localeCompare(b)).map((t) => ({ value: t, label: t })),
    [buildOptions]
  );
  const subjectOptions = useMemo(
    () => Array.from(buildOptions((r) => r.subject, 'subject')).sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s })),
    [buildOptions]
  );
  const frequencyOptions = useMemo(
    () => Array.from(buildOptions((r) => classifyMeetingFrequency(r.slot_name), 'freq'))
      .sort((a, b) => MEETING_FREQUENCY_OPTIONS.indexOf(a) - MEETING_FREQUENCY_OPTIONS.indexOf(b))
      .map((f) => ({ value: f, label: f })),
    [buildOptions]
  );

  const filteredRows = useMemo(
    () => stickinessRows.filter((r) => matchesFilters(r, null)),
    [stickinessRows, matchesFilters]
  );

  const hasFilter = selectedGrades.length || selectedSlots.length || selectedTeachers.length || selectedSubjects.length || selectedFrequencies.length;

  const filterReflections = useMemo(
    () => buildFilterReflections(selectedGrades, selectedSlots, selectedTeachers, selectedSubjects, selectedFrequencies),
    [selectedGrades, selectedSlots, selectedTeachers, selectedSubjects, selectedFrequencies]
  );

  const clearFilters = () => {
    setSelectedGrades([]); setSelectedSlots([]); setSelectedTeachers([]); setSelectedSubjects([]); setSelectedFrequencies([]);
  };

  const activeWeek = selectedWeek || latestWeek;

  // "All Week" shows each unique slot once (its latest week), so Entire Slot /
  // Per Jenjang reflect the current overall standing of every slot instead of
  // a single week's snapshot — not every week-slot row summed together.
  // Weekly Trend ignores activeWeek entirely, so selecting it there has no effect.
  const weekRows = useMemo(() => {
    if (activeWeek === ALL_WEEKS) return getLatestPerSlot(filteredRows);
    return filteredRows.filter((r) => r.week_period === activeWeek);
  }, [filteredRows, activeWeek]);

  const distribution = useMemo(() => computeDistribution(weekRows), [weekRows]);

  if (stickinessRows.length === 0) {
    return <div className="stickiness-empty">Tidak ada data stickiness untuk semester ini.</div>;
  }

  return (
    <div>
      <div className="action-bar">
        <MultiSelectFilter label="Grade" options={gradeOptions} selectedValues={selectedGrades} onChange={setSelectedGrades} />
        <MultiSelectFilter label="Slot" options={slotOptions} selectedValues={selectedSlots} onChange={setSelectedSlots} />
        <MultiSelectFilter label="Teacher" options={teacherOptions} selectedValues={selectedTeachers} onChange={setSelectedTeachers} />
        <MultiSelectFilter label="Subject" options={subjectOptions} selectedValues={selectedSubjects} onChange={setSelectedSubjects} />
        <MultiSelectFilter label="Meeting" options={frequencyOptions} selectedValues={selectedFrequencies} onChange={setSelectedFrequencies} />
        {hasFilter > 0 && (
          <button className="secondary-button clear-filter-button" onClick={clearFilters}>Clear Filter</button>
        )}
      </div>

      <div className="stickiness-dist-header">
        <h2 className="stickiness-dist-title">Teachers Performance Distribution</h2>
        <select
          className="filter-select"
          value={activeWeek || ''}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
          <option value={ALL_WEEKS}>All Week — Overall</option>
          {weekPeriods.map((w) => (
            <option key={w.date} value={w.date}>
              {w.label} — {w.dateLabel}
            </option>
          ))}
        </select>
      </div>

      <FilterReflection labels={filterReflections} />

      <div className="tab-navigation" style={{ marginBottom: '16px' }}>
        <button className={`tab-button ${innerTab === 'entire' ? 'active' : ''}`} onClick={() => setInnerTab('entire')}>
          Entire Slot
        </button>
        <button className={`tab-button ${innerTab === 'jenjang' ? 'active' : ''}`} onClick={() => setInnerTab('jenjang')}>
          Per Jenjang
        </button>
        <button className={`tab-button ${innerTab === 'trend' ? 'active' : ''}`} onClick={() => setInnerTab('trend')}>
          Weekly Trend
        </button>
      </div>

      {innerTab === 'entire' && <EntireSlotTable distribution={distribution} />}
      {innerTab === 'jenjang' && <PerJenjangTable distribution={distribution} />}
      {innerTab === 'trend' && <WeeklyTrendTable allStickinessRows={filteredRows} weekPeriods={weekPeriods} />}
    </div>
  );
}

export default StickinessPerformanceDistribution;
