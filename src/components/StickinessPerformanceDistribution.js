import React, { useMemo, useState } from 'react';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import {
  computeDistribution, computeWeeklyTrend,
  STATUS_LIST, JENJANG_LIST, JENJANG_COLORS, getStatusColor,
} from '../utils/stickinessUtils';

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

  return (
    <div className="stickiness-dist-section">
      <h3 className="stickiness-dist-subtitle">Per Jenjang</h3>
      <div className="table-scroll-container">
        <table className="stickiness-dist-table stickiness-jenjang-table">
          <thead>
            <tr>
              <th></th>
              {JENJANG_LIST.map((j) => (
                <th key={j} colSpan={3} style={{ background: JENJANG_COLORS[j].header, borderBottom: `2px solid ${JENJANG_COLORS[j].border}` }}>
                  {j}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {JENJANG_LIST.map((j) => (
                <React.Fragment key={j}>
                  <th style={{ background: JENJANG_COLORS[j].header }}>Slot</th>
                  <th style={{ background: JENJANG_COLORS[j].header }}>%</th>
                  <th style={{ background: JENJANG_COLORS[j].header }}>Avg.</th>
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
                  {JENJANG_LIST.map((j) => {
                    const d = (perJenjang[j] || {})[status] || { count: 0, pct: 0, avgStickiness: null };
                    return (
                      <React.Fragment key={j}>
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
              {JENJANG_LIST.map((j) => (
                <td key={j} colSpan={3} className="stickiness-number-cell">
                  {fmt(gap[j])}
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
const TREND_GROUPS = ['General', ...JENJANG_LIST];

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
                <th key={group} colSpan={6} style={group !== 'General' ? { background: JENJANG_COLORS[group]?.header } : {}}>
                  {group}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {TREND_GROUPS.map((group) => (
                <React.Fragment key={group}>
                  <th style={group !== 'General' ? { background: JENJANG_COLORS[group]?.header } : {}}>Exceptional</th>
                  <th style={group !== 'General' ? { background: JENJANG_COLORS[group]?.header } : {}}>%</th>
                  <th style={group !== 'General' ? { background: JENJANG_COLORS[group]?.header } : {}}>On Average</th>
                  <th style={group !== 'General' ? { background: JENJANG_COLORS[group]?.header } : {}}>%</th>
                  <th style={group !== 'General' ? { background: JENJANG_COLORS[group]?.header } : {}}>Below Average</th>
                  <th style={group !== 'General' ? { background: JENJANG_COLORS[group]?.header } : {}}>%</th>
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

// ── Main component ────────────────────────────────────────────────────────────
function StickinessPerformanceDistribution({ stickinessRows, weekPeriods }) {
  const latestWeek = weekPeriods[weekPeriods.length - 1]?.date || null;
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [innerTab, setInnerTab] = useState('entire');

  const activeWeek = selectedWeek || latestWeek;

  const weekRows = useMemo(
    () => stickinessRows.filter((r) => r.week_period === activeWeek),
    [stickinessRows, activeWeek]
  );

  const distribution = useMemo(() => computeDistribution(weekRows), [weekRows]);

  if (stickinessRows.length === 0) {
    return <div className="stickiness-empty">Tidak ada data stickiness untuk semester ini.</div>;
  }

  return (
    <div>
      <div className="stickiness-dist-header">
        <h2 className="stickiness-dist-title">Teachers Performance Distribution</h2>
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
      </div>

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
      {innerTab === 'trend' && <WeeklyTrendTable allStickinessRows={stickinessRows} weekPeriods={weekPeriods} />}
    </div>
  );
}

export default StickinessPerformanceDistribution;
