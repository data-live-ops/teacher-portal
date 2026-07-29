/**
 * Pure helpers for building the Attendance Portal's grade+slot x week grid.
 * No Supabase calls here - components fetch the raw rows, these functions
 * just reshape them for rendering.
 */

export const SHEET_CONFIG = [
  { key: 'student_count', label: 'Student Count', dataset: 'attendance', field: 'eligible_students', isPercent: false, suffix: '' },
  { key: 'attendance', label: 'Attendance', dataset: 'attendance', field: 'average_participation_pct', isPercent: true, suffix: '' },
  { key: 'time_spent', label: 'Time Spent', dataset: 'attendance', field: 'average_duration_minutes', isPercent: false, suffix: ' min' },
  { key: 'low_attendance', label: 'Low Attendance', dataset: 'engagement', field: 'low_pct', isPercent: true, suffix: '' },
  { key: 'medium_attendance', label: 'Medium Attendance', dataset: 'engagement', field: 'medium_pct', isPercent: true, suffix: '' },
  { key: 'high_attendance', label: 'High Attendance', dataset: 'engagement', field: 'high_pct', isPercent: true, suffix: '' },
];

const getRowKey = (grade, slotName) => `${grade}|${slotName}`;
const getCellKey = (grade, slotName, weekStartDate) => `${grade}|${slotName}|${weekStartDate}`;

// Natural sort so "Matematika 2" comes before "Matematika 10" instead of after.
const naturalCompare = (a, b) => {
  const chunk = (s) => String(s).match(/(\d+|\D+)/g) || [];
  const aParts = chunk(a);
  const bParts = chunk(b);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    const aNum = Number(aPart);
    const bNum = Number(bPart);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aPart !== '' && bPart !== '') {
      if (aNum !== bNum) return aNum - bNum;
    } else if (aPart !== bPart) {
      return aPart < bPart ? -1 : 1;
    }
  }
  return 0;
};

const TEST_SLOT_NAME = /^test/i;

/**
 * Builds one row per (grade, slot_name) that is eligible for the Attendance
 * Portal: currently Open in the roster (v_current_teacher_assignment_slots),
 * grade 4-12, and not a Test slot. Slots that are Pending/Upcoming, outside
 * the grade range, discontinued (no longer in the roster), or named "Test..."
 * are excluded entirely, even if they still have weekly stats.
 */
export function buildGridRows(rosterRows) {
  const rows = [];
  for (const roster of rosterRows) {
    const grade = roster.grade;
    if (!Number.isInteger(grade) || grade < 4 || grade > 12) continue;
    if (roster.status !== 'Open') continue;
    if (TEST_SLOT_NAME.test(roster.slot_name || '')) continue;

    rows.push({
      key: getRowKey(roster.grade, roster.slot_name),
      grade: roster.grade,
      slotName: roster.slot_name,
      guruJuara: roster.guru_juara_name || '—',
      days: (roster.days || []).join(', ') || '—',
      timeRange: roster.time_range || '—',
    });
  }

  rows.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return naturalCompare(a.slotName, b.slotName);
  });

  return rows;
}

/** "2026-01-05" -> "5 Jan 2026", parsed as UTC so it never shifts a day off. */
function formatWeekDate(dateStr) {
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Distinct week_start_date values across both stats datasets, sorted ascending. */
export function getWeeks(attendanceStats, engagementStats) {
  const dates = new Set();
  for (const r of attendanceStats) dates.add(r.week_start_date);
  for (const r of engagementStats) dates.add(r.week_start_date);

  return Array.from(dates)
    .sort()
    .map((date, index) => ({ date, label: `Week ${index + 1}`, dateLabel: formatWeekDate(date) }));
}

/** Map of "grade|slotName|weekStartDate" -> full stats row, for O(1) cell lookups. */
export function buildStatsIndex(statsRows) {
  const index = new Map();
  for (const r of statsRows) {
    index.set(getCellKey(r.grade, r.slot_name, r.week_start_date), r);
  }
  return index;
}

/** Looks up the raw metric value for one grid cell, or null if not available. */
export function getCellValue(sheetConfig, statsIndexByDataset, grade, slotName, weekStartDate) {
  const statsIndex = statsIndexByDataset[sheetConfig.dataset];
  const row = statsIndex.get(getCellKey(grade, slotName, weekStartDate));
  if (!row) return null;
  const value = row[sheetConfig.field];
  return value === null || value === undefined ? null : Number(value);
}

export function formatCellValue(sheetConfig, value) {
  if (value === null) return '—';
  const rounded = sheetConfig.isPercent ? Math.round(value) : Math.round(value * 100) / 100;
  return `${rounded}${sheetConfig.isPercent ? '%' : sheetConfig.suffix}`;
}

/**
 * Builds a 2D array (header + one row per grid row) matching what's on
 * screen: sticky columns first, then one column per week using the same
 * cell lookup/formatting as the grid itself.
 */
export function buildCsvRows(rows, weeks, statsIndexByDataset, sheetConfig) {
  const header = ['Grade', 'Guru Juara', 'Slot', 'Days', 'Times', ...weeks.map((w) => w.dateLabel)];
  const body = rows.map((row) => [
    row.grade,
    row.guruJuara,
    row.slotName,
    row.days,
    row.timeRange,
    ...weeks.map((week) => {
      const value = getCellValue(sheetConfig, statsIndexByDataset, row.grade, row.slotName, week.date);
      return formatCellValue(sheetConfig, value);
    }),
  ]);
  return [header, ...body];
}

function csvEscapeCell(value) {
  const str = String(value ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsvString(cellRows) {
  return cellRows.map((row) => row.map(csvEscapeCell).join(',')).join('\r\n');
}
