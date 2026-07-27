import React, { useRef, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import MultiSelectFilter from './MultiSelectFilter';
import { getHeatmapCellStyle, getValueRange } from '../utils/heatmapColor';
import { buildStickinessGridRows } from '../utils/stickinessUtils';

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const FIXED_COL_COUNT = 8; // grade, teacher, slot, subject, days, time, overall, trendline
const ROW_HEIGHT = 40;
const OVERSCAN = 8;

function StickinessWeeklyGrid({ stickinessRows, rosterRows, weekPeriods }) {
  const scrollRef = useRef(null);

  const [selectedGrades, setSelectedGrades] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedTimes, setSelectedTimes] = useState([]);

  const gridRows = useMemo(
    () => buildStickinessGridRows(stickinessRows, rosterRows),
    [stickinessRows, rosterRows]
  );

  const getRowDays = (row) => (row.days === '—' ? [] : row.days.split(', '));

  const matchesFilters = useCallback((row, exclude) => {
    if (exclude !== 'grade' && selectedGrades.length && !selectedGrades.includes(row.grade)) return false;
    if (exclude !== 'slot' && selectedSlots.length && !selectedSlots.includes(row.slotName)) return false;
    if (exclude !== 'teacher' && selectedTeachers.length && !selectedTeachers.includes(row.teacherName)) return false;
    if (exclude !== 'subject' && selectedSubjects.length && !selectedSubjects.includes(row.subject)) return false;
    if (exclude !== 'days' && selectedDays.length) {
      const rowDays = getRowDays(row);
      if (!selectedDays.some((d) => rowDays.includes(d))) return false;
    }
    if (exclude !== 'times' && selectedTimes.length && !selectedTimes.includes(row.timeRange)) return false;
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrades, selectedSlots, selectedTeachers, selectedSubjects, selectedDays, selectedTimes]);

  const buildOptions = useCallback((mapFn, exclude) => {
    const values = new Set();
    for (const row of gridRows) {
      if (!matchesFilters(row, exclude)) continue;
      const value = mapFn(row);
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (item && item !== '—') values.add(item);
      }
    }
    return values;
  }, [gridRows, matchesFilters]);

  const gradeOptions = useMemo(
    () => Array.from(buildOptions((r) => r.grade, 'grade')).sort((a, b) => a - b).map((g) => ({ value: g, label: `Grade ${g}` })),
    [buildOptions]
  );
  const slotOptions = useMemo(
    () => Array.from(buildOptions((r) => r.slotName, 'slot')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((s) => ({ value: s, label: s })),
    [buildOptions]
  );
  const teacherOptions = useMemo(
    () => Array.from(buildOptions((r) => r.teacherName, 'teacher')).sort((a, b) => a.localeCompare(b)).map((t) => ({ value: t, label: t })),
    [buildOptions]
  );
  const subjectOptions = useMemo(
    () => Array.from(buildOptions((r) => r.subject, 'subject')).sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s })),
    [buildOptions]
  );
  const dayOptions = useMemo(
    () => Array.from(buildOptions((r) => getRowDays(r), 'days')).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).map((d) => ({ value: d, label: d })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildOptions]
  );
  const timeOptions = useMemo(
    () => Array.from(buildOptions((r) => r.timeRange, 'times')).sort((a, b) => a.localeCompare(b)).map((t) => ({ value: t, label: t })),
    [buildOptions]
  );

  const filteredRows = useMemo(
    () => gridRows.filter((r) => matchesFilters(r, null)),
    [gridRows, matchesFilters]
  );

  const hasFilter = selectedGrades.length || selectedSlots.length || selectedTeachers.length
    || selectedSubjects.length || selectedDays.length || selectedTimes.length;

  const clearFilters = () => {
    setSelectedGrades([]); setSelectedSlots([]); setSelectedTeachers([]);
    setSelectedSubjects([]); setSelectedDays([]); setSelectedTimes([]);
  };

  const cellIndex = useMemo(() => {
    const index = new Map();
    for (const row of gridRows) {
      for (const w of row.weeklyData) {
        index.set(`${row.key}|${w.week_period}`, w.stickiness);
      }
    }
    return index;
  }, [gridRows]);

  const allVisibleValues = useMemo(() => {
    const vals = [];
    for (const row of filteredRows) {
      for (const { date } of weekPeriods) {
        const v = cellIndex.get(`${row.key}|${date}`);
        if (v != null) vals.push(v);
      }
    }
    return vals;
  }, [filteredRows, weekPeriods, cellIndex]);

  const { min, max } = useMemo(() => getValueRange(allVisibleValues), [allVisibleValues]);

  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  if (stickinessRows.length === 0) {
    return <div className="stickiness-empty">Tidak ada data stickiness untuk semester ini.</div>;
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0;
  const colCount = FIXED_COL_COUNT + weekPeriods.length;

  return (
    <div>
      <div className="action-bar">
        <MultiSelectFilter label="Grade" options={gradeOptions} selectedValues={selectedGrades} onChange={setSelectedGrades} />
        <MultiSelectFilter label="Slot" options={slotOptions} selectedValues={selectedSlots} onChange={setSelectedSlots} />
        <MultiSelectFilter label="Teacher" options={teacherOptions} selectedValues={selectedTeachers} onChange={setSelectedTeachers} />
        <MultiSelectFilter label="Subject" options={subjectOptions} selectedValues={selectedSubjects} onChange={setSelectedSubjects} />
        <MultiSelectFilter label="Days" options={dayOptions} selectedValues={selectedDays} onChange={setSelectedDays} />
        <MultiSelectFilter label="Times" options={timeOptions} selectedValues={selectedTimes} onChange={setSelectedTimes} />
        {hasFilter > 0 && (
          <button className="secondary-button" onClick={clearFilters}>Clear Filter</button>
        )}
      </div>

      <div className="spreadsheet-container">
        <div className="table-scroll-container" ref={scrollRef}>
          <table className="attendance-grid-table stickiness-weekly-table">
            <thead>
              <tr>
                <th className="attendance-sticky-col attendance-sticky-col-1">Grade</th>
                <th className="attendance-sticky-col attendance-sticky-col-2">Teacher</th>
                <th className="attendance-sticky-col attendance-sticky-col-3">Slot</th>
                <th className="attendance-sticky-col attendance-sticky-col-4">Subject</th>
                <th className="attendance-sticky-col attendance-sticky-col-5">Days</th>
                <th className="stickiness-sticky-col-6">Time</th>
                <th className="stickiness-overall-col">Stickiness Overall</th>
                <th className="stickiness-sparkline-col">Trendline</th>
                {weekPeriods.map((w) => (
                  <th key={w.date} className="attendance-week-col">
                    <div className="attendance-week-index">{w.label}</div>
                    <div className="attendance-week-date">{w.dateLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={colCount} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = filteredRows[virtualRow.index];
                const sparkData = weekPeriods.map((w) => {
                  const v = cellIndex.get(`${row.key}|${w.date}`);
                  return v != null ? v : null;
                });
                const sparkValid = sparkData.filter((v) => v != null);

                return (
                  <tr key={row.key}>
                    <td className="attendance-sticky-col attendance-sticky-col-1">{row.grade}</td>
                    <td className="attendance-sticky-col attendance-sticky-col-2">{row.teacherName}</td>
                    <td className="attendance-sticky-col attendance-sticky-col-3">{row.slotName}</td>
                    <td className="attendance-sticky-col attendance-sticky-col-4">{row.subject}</td>
                    <td className="attendance-sticky-col attendance-sticky-col-5">{row.days}</td>
                    <td className="stickiness-sticky-col-6">{row.timeRange}</td>
                    <td className="stickiness-overall-cell">
                      {row.overallStickiness != null ? row.overallStickiness.toFixed(2) : '—'}
                    </td>
                    <td className="stickiness-sparkline-cell">
                      {sparkValid.length > 1 ? (
                        <Sparklines data={sparkValid} height={28} width={80} margin={2}>
                          <SparklinesLine color="#3987e5" style={{ fill: 'none', strokeWidth: 1.5 }} />
                        </Sparklines>
                      ) : '—'}
                    </td>
                    {weekPeriods.map((w) => {
                      const value = cellIndex.get(`${row.key}|${w.date}`);
                      const style = getHeatmapCellStyle(value, min, max);
                      return (
                        <td key={w.date} className="stickiness-cell" style={style}>
                          {value != null ? value.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="attendance-grid-empty">
                    Tidak ada data yang sesuai filter.
                  </td>
                </tr>
              )}
              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={colCount} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StickinessWeeklyGrid;
