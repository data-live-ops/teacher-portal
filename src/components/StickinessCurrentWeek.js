import React, { useMemo, useState } from 'react';
import MultiSelectFilter from './MultiSelectFilter';
import { getStatusColor, buildCurrentWeekCsvRows } from '../utils/stickinessUtils';
import { toCsvString } from '../utils/attendanceGrid';

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function StickinessCurrentWeek({ stickinessRows, rosterRows, weekPeriods, stickinessType, semesterName }) {
  const latestWeek = weekPeriods[weekPeriods.length - 1]?.date || null;

  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedTimes, setSelectedTimes] = useState([]);

  const activeWeek = selectedWeek || latestWeek;

  // Index roster for days/time
  const rosterIndex = useMemo(() => {
    const idx = new Map();
    for (const r of rosterRows) {
      const key = `${r.grade}|${r.slot_name}`;
      if (!idx.has(key)) {
        idx.set(key, {
          days: Array.isArray(r.days) ? r.days.join(', ') : (r.days || '—'),
          time_range: r.time_range || '—',
        });
      }
    }
    return idx;
  }, [rosterRows]);

  // Rows for the selected week
  const weekRows = useMemo(() => {
    if (!activeWeek) return [];
    return stickinessRows
      .filter((r) => r.week_period === activeWeek)
      .map((r) => {
        const roster = rosterIndex.get(`${r.course_grade}|${r.slot_name}`) || { days: '—', time_range: '—' };
        return {
          ...r,
          days: roster.days,
          time_range: roster.time_range,
        };
      })
      .sort((a, b) => {
        if (a.course_grade !== b.course_grade) return a.course_grade - b.course_grade;
        return a.slot_name.localeCompare(b.slot_name, undefined, { numeric: true });
      });
  }, [stickinessRows, activeWeek, rosterIndex]);

  const getRowDays = (row) => (row.days === '—' ? [] : row.days.split(', '));

  // Filter options
  const gradeOptions = useMemo(
    () => [...new Set(weekRows.map((r) => r.course_grade))].sort((a, b) => a - b).map((g) => ({ value: g, label: `Grade ${g}` })),
    [weekRows]
  );
  const dayOptions = useMemo(() => {
    const days = new Set();
    weekRows.forEach((r) => getRowDays(r).forEach((d) => days.add(d)));
    return Array.from(days).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).map((d) => ({ value: d, label: d }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekRows]);
  const timeOptions = useMemo(
    () => [...new Set(weekRows.map((r) => r.time_range).filter((t) => t !== '—'))].sort().map((t) => ({ value: t, label: t })),
    [weekRows]
  );

  const filteredRows = useMemo(() => {
    return weekRows.filter((r) => {
      if (selectedGrades.length && !selectedGrades.includes(r.course_grade)) return false;
      if (selectedDays.length && !selectedDays.some((d) => getRowDays(r).includes(d))) return false;
      if (selectedTimes.length && !selectedTimes.includes(r.time_range)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekRows, selectedGrades, selectedDays, selectedTimes]);

  const hasFilter = selectedGrades.length || selectedDays.length || selectedTimes.length;

  const handleExportCsv = () => {
    const csvRows = buildCurrentWeekCsvRows(filteredRows);
    const csvContent = toCsvString(csvRows);
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const weekLabel = weekPeriods.find((w) => w.date === activeWeek)?.dateLabel || activeWeek || 'week';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `stickiness_current_week_${stickinessType || 'stickiness'}_${semesterName || 'semester'}_${weekLabel}_${dateStr}`
      .replace(/[^a-z0-9]+/gi, '_');

    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (stickinessRows.length === 0) {
    return <div className="stickiness-empty">Tidak ada data stickiness untuk semester ini.</div>;
  }

  return (
    <div>
      <div className="action-bar">
        <select
          className="filter-select"
          value={activeWeek || ''}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
          {weekPeriods.map((w) => (
            <option key={w.date} value={w.date}>
              {w.label} — {w.dateLabel}
            </option>
          ))}
        </select>

        <MultiSelectFilter label="Grade" options={gradeOptions} selectedValues={selectedGrades} onChange={setSelectedGrades} />
        <MultiSelectFilter label="Days" options={dayOptions} selectedValues={selectedDays} onChange={setSelectedDays} />
        <MultiSelectFilter label="Times" options={timeOptions} selectedValues={selectedTimes} onChange={setSelectedTimes} />

        {hasFilter > 0 && (
          <button className="secondary-button clear-filter-button" onClick={() => { setSelectedGrades([]); setSelectedDays([]); setSelectedTimes([]); }}>
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
      </div>

      <div className="spreadsheet-container">
        <div className="table-scroll-container">
          <table className="stickiness-current-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Course</th>
                <th>Teacher</th>
                <th>Slot</th>
                <th>Subject</th>
                <th>Stickiness Overall</th>
                <th>Average Stickiness</th>
                <th>Deviation</th>
                <th>Day</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const statusColor = getStatusColor(row.status);
                return (
                  <tr key={`${row.course_grade}|${row.slot_name}|${row.subject}|${i}`}>
                    <td className="stickiness-row-number-cell">{i + 1}</td>
                    <td>{row.course_grade}</td>
                    <td>{row.teacher_name || '—'}</td>
                    <td>{row.slot_name}</td>
                    <td>{row.subject || '—'}</td>
                    <td className="stickiness-number-cell">
                      {row.stickiness != null ? Number(row.stickiness).toFixed(2) : '—'}
                    </td>
                    <td className="stickiness-number-cell">
                      {row.dynamic_avg != null ? Number(row.dynamic_avg).toFixed(2) : '—'}
                    </td>
                    <td className="stickiness-number-cell">
                      {row.deviation != null ? Number(row.deviation).toFixed(2) : '—'}
                    </td>
                    <td>{row.days}</td>
                    <td>{row.time_range}</td>
                    <td>
                      {row.status ? (
                        <span className="stickiness-status-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                          {row.status}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="attendance-grid-empty">Tidak ada data yang sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StickinessCurrentWeek;
