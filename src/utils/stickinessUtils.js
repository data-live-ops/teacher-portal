const naturalCompare = (a, b) => {
  const chunk = (s) => String(s).match(/(\d+|\D+)/g) || [];
  const aParts = chunk(a);
  const bParts = chunk(b);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? '';
    const bp = bParts[i] ?? '';
    const an = Number(ap);
    const bn = Number(bp);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && ap !== '' && bp !== '') {
      if (an !== bn) return an - bn;
    } else if (ap !== bp) {
      return ap < bp ? -1 : 1;
    }
  }
  return 0;
};

export function formatWeekDate(dateStr) {
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// SD: Matematika grade 4-6, SMP: 7-9, Grade 10-11: 10-11, Grade 12: 12, Sciences: non-Matematika
export function getJenjang(subject, grade) {
  const isMath = subject?.toLowerCase().includes('matematika');
  if (!isMath) return 'Sciences';
  if ([4, 5, 6].includes(grade)) return 'SD';
  if ([7, 8, 9].includes(grade)) return 'SMP';
  if ([10, 11].includes(grade)) return 'Grade 10-11';
  if (grade === 12) return 'Grade 12';
  return null;
}

export const JENJANG_LIST = ['SD', 'SMP', 'Grade 10-11', 'Grade 12', 'Sciences'];
export const STATUS_LIST = ['EXCEPTIONAL', 'ON AVERAGE', 'BELOW AVERAGE', 'NOT AVAILABLE YET'];

export function getStatusColor(status) {
  switch (status?.toUpperCase()) {
    case 'EXCEPTIONAL':    return { bg: '#cceedd', text: '#1a6645' };
    case 'ON AVERAGE':     return { bg: '#fef9c3', text: '#7c6a00' };
    case 'BELOW AVERAGE':  return { bg: '#fde8e8', text: '#9b2c2c' };
    default:               return { bg: '#f2f2f0', text: '#898781' };
  }
}

export const JENJANG_COLORS = {
  SD:          { header: '#e8d5f5', border: '#c084fc' },
  SMP:         { header: '#dbeafe', border: '#60a5fa' },
  'Grade 10-11': { header: '#dcfce7', border: '#4ade80' },
  'Grade 12':  { header: '#fef3c7', border: '#fbbf24' },
  Sciences:    { header: '#ffe4e6', border: '#fb7185' },
};

/**
 * Merge external stickiness rows with local roster rows.
 * Returns one row per (course_grade, slot_name, subject) with:
 *   - overallStickiness: stickiness value from the latest week_period
 *   - weeklyData: array of { week_period, stickiness, status, is_holiday } sorted ASC
 *   - days, time_range from local roster
 */
export function buildStickinessGridRows(stickinessRows, rosterRows) {
  // Index roster by "grade|slot_name"
  const rosterIndex = new Map();
  for (const r of rosterRows) {
    const key = `${r.grade}|${r.slot_name}`;
    if (!rosterIndex.has(key)) {
      rosterIndex.set(key, {
        days: Array.isArray(r.days) ? r.days.join(', ') : (r.days || '—'),
        time_range: r.time_range || '—',
      });
    }
  }

  // Group stickiness rows by (course_grade, slot_name, subject)
  const grouped = new Map();
  for (const r of stickinessRows) {
    const key = `${r.course_grade}|${r.slot_name}|${r.subject}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  }

  const rows = [];
  for (const [key, items] of grouped) {
    const sorted = [...items].sort((a, b) => a.week_period.localeCompare(b.week_period));
    const latest = sorted[sorted.length - 1];
    const rosterKey = `${latest.course_grade}|${latest.slot_name}`;
    const roster = rosterIndex.get(rosterKey) || { days: '—', time_range: '—' };

    rows.push({
      key,
      grade: latest.course_grade,
      teacherName: latest.teacher_name || '—',
      slotName: latest.slot_name,
      subject: latest.subject || '—',
      curriculum: latest.curriculum || '—',
      days: roster.days,
      timeRange: roster.time_range,
      overallStickiness: latest.stickiness != null ? Number(latest.stickiness) : null,
      overallStatus: latest.status || null,
      weeklyData: sorted.map((r) => ({
        week_period: r.week_period,
        stickiness: r.stickiness != null ? Number(r.stickiness) : null,
        dynamic_avg: r.dynamic_avg != null ? Number(r.dynamic_avg) : null,
        deviation: r.deviation != null ? Number(r.deviation) : null,
        status: r.status,
        is_holiday: r.is_holiday,
      })),
    });
  }

  rows.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return naturalCompare(a.slotName, b.slotName);
  });

  return rows;
}

/**
 * Builds CSV rows for the Weekly Grid export: sticky columns + Stickiness
 * Overall + one column per week, mirroring what's rendered on screen and
 * respecting whatever filters already narrowed `rows`.
 */
export function buildWeeklyGridCsvRows(rows, weekPeriods) {
  const header = ['Grade', 'Teacher', 'Slot', 'Subject', 'Days', 'Time', 'Stickiness Overall', ...weekPeriods.map((w) => w.dateLabel)];

  const cellIndex = new Map();
  for (const row of rows) {
    for (const w of row.weeklyData) {
      cellIndex.set(`${row.key}|${w.week_period}`, w.stickiness);
    }
  }

  const body = rows.map((row) => [
    row.grade,
    row.teacherName,
    row.slotName,
    row.subject,
    row.days,
    row.timeRange,
    row.overallStickiness != null ? row.overallStickiness.toFixed(2) : '—',
    ...weekPeriods.map((w) => {
      const value = cellIndex.get(`${row.key}|${w.date}`);
      return value != null ? value.toFixed(2) : '—';
    }),
  ]);

  return [header, ...body];
}

/**
 * Builds CSV rows for the Current Week export, mirroring the columns
 * rendered on screen and respecting whatever filters already narrowed `rows`
 * (grade/days/times filters plus the single selected week are baked into
 * `rows` by the caller before this is called).
 */
export function buildCurrentWeekCsvRows(rows) {
  const header = ['Grade', 'Teacher', 'Slot', 'Subject', 'Stickiness Overall', 'Average Stickiness', 'Deviation', 'Day', 'Time', 'Status'];

  const body = rows.map((row) => [
    row.course_grade,
    row.teacher_name || '—',
    row.slot_name,
    row.subject || '—',
    row.stickiness != null ? Number(row.stickiness).toFixed(2) : '—',
    row.dynamic_avg != null ? Number(row.dynamic_avg).toFixed(2) : '—',
    row.deviation != null ? Number(row.deviation).toFixed(2) : '—',
    row.days,
    row.time_range,
    row.status || '—',
  ]);

  return [header, ...body];
}

/** Distinct week_period values sorted ASC across all stickiness rows. */
export function getWeekPeriods(stickinessRows) {
  const dates = new Set();
  for (const r of stickinessRows) dates.add(r.week_period);
  return Array.from(dates)
    .sort()
    .map((date, index) => ({ date, label: `Week ${index + 1}`, dateLabel: formatWeekDate(date) }));
}

/** Latest week_period in the dataset. */
export function getLatestWeekPeriod(stickinessRows) {
  let latest = null;
  for (const r of stickinessRows) {
    if (!latest || r.week_period > latest) latest = r.week_period;
  }
  return latest;
}

function avg(nums) {
  const valid = nums.filter((n) => n != null);
  if (valid.length === 0) return null;
  return valid.reduce((s, n) => s + n, 0) / valid.length;
}

/**
 * Compute Performance Distribution aggregates for a given set of rows
 * (already filtered to one week_period).
 * Returns: { entireSlot, perJenjang, gap }
 */
export function computeDistribution(weekRows) {
  const total = weekRows.length;

  const aggregate = (subset) => {
    const result = {};
    for (const status of STATUS_LIST) {
      const matching = subset.filter((r) => {
        if (status === 'NOT AVAILABLE YET') return r.status == null || r.status === '';
        return r.status?.toUpperCase() === status;
      });
      const count = matching.length;
      const pct = total > 0 ? (count / subset.length) * 100 : 0;
      const avgStickiness = avg(matching.map((r) => r.stickiness != null ? Number(r.stickiness) : null));
      result[status] = { count, pct, avgStickiness };
    }
    return result;
  };

  const entireSlot = aggregate(weekRows);

  const perJenjang = {};
  for (const jenjang of JENJANG_LIST) {
    const subset = weekRows.filter((r) => getJenjang(r.subject, r.course_grade) === jenjang);
    perJenjang[jenjang] = aggregate(subset);
  }

  const gap = {};
  for (const jenjang of ['General', ...JENJANG_LIST]) {
    const subset = jenjang === 'General' ? weekRows : weekRows.filter((r) => getJenjang(r.subject, r.course_grade) === jenjang);
    const excAvg = avg(subset.filter((r) => r.status?.toUpperCase() === 'EXCEPTIONAL').map((r) => r.stickiness != null ? Number(r.stickiness) : null));
    const belAvg = avg(subset.filter((r) => r.status?.toUpperCase() === 'BELOW AVERAGE').map((r) => r.stickiness != null ? Number(r.stickiness) : null));
    gap[jenjang] = excAvg != null && belAvg != null ? excAvg - belAvg : null;
  }

  return { entireSlot, perJenjang, gap };
}

/**
 * Compute weekly trend: per week_period → General + per jenjang → per status → { avgStickiness, count, pct }
 */
export function computeWeeklyTrend(allRows, weekPeriods) {
  const result = {};
  for (const { date } of weekPeriods) {
    const weekRows = allRows.filter((r) => r.week_period === date);
    const computeGroup = (subset) => {
      const groupTotal = subset.length;
      const out = {};
      for (const status of ['EXCEPTIONAL', 'ON AVERAGE', 'BELOW AVERAGE']) {
        const matching = subset.filter((r) => r.status?.toUpperCase() === status);
        out[status] = {
          avgStickiness: avg(matching.map((r) => r.stickiness != null ? Number(r.stickiness) : null)),
          count: matching.length,
          pct: groupTotal > 0 ? (matching.length / groupTotal) * 100 : 0,
        };
      }
      return out;
    };

    result[date] = { General: computeGroup(weekRows) };
    for (const jenjang of JENJANG_LIST) {
      const subset = weekRows.filter((r) => getJenjang(r.subject, r.course_grade) === jenjang);
      result[date][jenjang] = computeGroup(subset);
    }
  }
  return result;
}
