import React, { useState, useEffect, useMemo } from 'react';
import { GitCompare, X } from 'lucide-react';
import '../styles/TeacherAssignment.css';
import '../styles/ICAAnalytics.css';
import { supabase } from '../lib/supabaseClient.mjs';

const fetchAllRows = async (queryFactory) => {
    const pageSize = 1000;
    let from = 0;
    let all = [];
    while (true) {
        const { data, error } = await queryFactory().range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const SUB_TABS = [
    { key: 'historical', label: 'Historical (All Student)' },
    { key: 'active', label: 'Active Student' },
    { key: 'grade-breakdown', label: 'Grade Breakdown'},
];

const ICAAnalyticsTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('historical');

    return (
        <div className="teacher-assignment-container ica-tab-content">
            <div className="header">
                <div className="header-content">
                    <h1 className="title">
                        ICA Analytics
                    </h1>
                    <p className="subtitle">Latest-week snapshot per grade/slot for ICA</p>
                </div>
            </div>

            <div className="tab-navigation">
                {SUB_TABS.map(tab => {
                    return (
                        <button
                            key={tab.key}
                            className={`tab-button ${activeSubTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveSubTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeSubTab === 'historical' && <ClassificationOverview mode="historical" />}
            {activeSubTab === 'active' && <ClassificationOverview mode="active" />}
            {activeSubTab === 'grade-breakdown' && <GradeBreakdown />}
        </div>
    );
};

// ============================================================================
// Mini distribution chart (Below/Optimal/Above) - a 3-point line sparkline,
// matching the "Trend" column look from the ICA Google Sheet: a thin line
// through the 3 values, peaking where the healthy Optimal bucket dominates.
// Scaled relative to each row's own min/max (like a spreadsheet SPARKLINE),
// not a fixed 0-100 axis, so the peak/skew shape is always legible even when
// a row's absolute percentages are close together. The connecting line is
// chrome (neutral gray); the 3 vertex dots carry the actual identity, colored
// to match the Below/Optimal/Above badges elsewhere in this table (validated
// CVD-safe adjacent pairs via the dataviz skill's validate_palette.js).
// ============================================================================
const DISTRIBUTION_POINT_COLOR = { below: '#dc2626', optimal: '#3b82f6', above: '#16a34a' };
const DIST_CHART_WIDTH = 96;
const DIST_CHART_HEIGHT = 40;
const DIST_CHART_PAD = 6;
const DIST_DOT_RADIUS = 4;

const DistributionChart = ({ pctBelow, pctOptimal, pctAbove, totalBelow, totalOptimal, totalAbove }) => {
    const points = [
        { key: 'below', pct: pctBelow ?? 0, total: totalBelow ?? 0, label: 'Below' },
        { key: 'optimal', pct: pctOptimal ?? 0, total: totalOptimal ?? 0, label: 'Optimal' },
        { key: 'above', pct: pctAbove ?? 0, total: totalAbove ?? 0, label: 'Above' },
    ];

    const values = points.map(p => p.pct);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const usableHeight = DIST_CHART_HEIGHT - DIST_CHART_PAD * 2;
    const yFor = (v) => range === 0
        ? DIST_CHART_HEIGHT / 2
        : DIST_CHART_PAD + usableHeight - ((v - min) / range) * usableHeight;

    const step = (DIST_CHART_WIDTH - DIST_CHART_PAD * 2) / (points.length - 1);
    const coords = points.map((p, i) => ({ ...p, x: DIST_CHART_PAD + i * step, y: yFor(p.pct) }));

    return (
        <svg
            width={DIST_CHART_WIDTH}
            height={DIST_CHART_HEIGHT}
            viewBox={`0 0 ${DIST_CHART_WIDTH} ${DIST_CHART_HEIGHT}`}
            className="ica-distribution-chart"
            role="img"
            aria-label={points.map(p => `${p.label}: ${p.total} students (${p.pct.toFixed(1)}%)`).join(', ')}
        >
            <polyline
                points={coords.map(c => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {coords.map(c => (
                <circle
                    key={c.key}
                    cx={c.x}
                    cy={c.y}
                    r={DIST_DOT_RADIUS}
                    fill={DISTRIBUTION_POINT_COLOR[c.key]}
                    stroke="#fff"
                    strokeWidth={2}
                    tabIndex={0}
                    className="ica-distribution-dot"
                >
                    <title>{`${c.label}: ${c.total} students (${c.pct.toFixed(1)}%)`}</title>
                </circle>
            ))}
        </svg>
    );
};

// ============================================================================
// Sections A & B: Historical / Active classification overview.
// "Period of Week" selects one week_period and queries mv_ica_classification_*
// directly, filtered to that single week across ALL grade/slot combos - a
// uniform point-in-time snapshot. Defaults to the most recent available week
// (vw_ica_available_weeks is ordered newest first). Still not a week-by-week
// trend view - the Google Sheet remains the place for that.
// ============================================================================
const ClassificationOverview = ({ mode }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [gradeFilter, setGradeFilter] = useState('');
    const [slotSearch, setSlotSearch] = useState('');
    const [availableWeeks, setAvailableWeeks] = useState([]);
    const [weekFilter, setWeekFilter] = useState('');

    // Compare Weeks mode - same grade+slot, two different weeks side by side
    const [compareMode, setCompareMode] = useState(false);
    const [compareGrades, setCompareGrades] = useState([]);
    const [compareGrade, setCompareGrade] = useState('');
    const [compareSlots, setCompareSlots] = useState([]);
    const [compareSlot, setCompareSlot] = useState('');
    const [weekA, setWeekA] = useState('');
    const [weekB, setWeekB] = useState('');
    const [compareRows, setCompareRows] = useState([]);
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState(null);

    const baseTableName = mode === 'historical'
        ? 'mv_ica_classification_historical'
        : 'mv_ica_classification_active';

    // Available weeks to pick from (same set for historical and active) -
    // ordered newest first, so default the selection to the most recent one.
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchAllRows(() => supabase.from('vw_ica_available_weeks').select('week_period'));
                const weeks = (data || []).map(r => r.week_period);
                setAvailableWeeks(weeks);
                if (weeks.length) setWeekFilter(weeks[0]);
                if (weeks.length) setWeekA(weeks[0]);
                if (weeks.length > 1) setWeekB(weeks[1]);
            } catch (err) {
                console.error('Error loading available weeks:', err);
            }
        })();
    }, []);

    // Compare mode grade options - ica_grade_slots is the canonical grade/slot
    // list (same source the Dashboard tab uses), independent of whichever
    // single week is currently selected in the non-compare view above.
    useEffect(() => {
        if (!compareMode || compareGrades.length) return;
        (async () => {
            try {
                const { data, error: err } = await supabase.from('ica_grade_slots').select('grade_list');
                if (err) throw err;
                const uniqueGrades = [...new Set((data || []).map(d => d.grade_list))]
                    .filter(Boolean)
                    .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
                setCompareGrades(uniqueGrades);
            } catch (err) {
                console.error('Error loading compare grades:', err);
            }
        })();
    }, [compareMode, compareGrades.length]);

    useEffect(() => {
        if (!compareGrade) {
            setCompareSlots([]);
            setCompareSlot('');
            return;
        }
        (async () => {
            try {
                const { data, error: err } = await supabase
                    .from('ica_grade_slots')
                    .select('slot_name')
                    .eq('grade_list', compareGrade);
                if (err) throw err;
                const uniqueSlots = [...new Set((data || []).map(d => d.slot_name))]
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                setCompareSlots(uniqueSlots);
                setCompareSlot('');
            } catch (err) {
                console.error('Error loading compare slots:', err);
            }
        })();
    }, [compareGrade]);

    // Fetch both weeks for the chosen grade+slot in one query
    useEffect(() => {
        if (!compareMode || !compareGrade || !compareSlot || !weekA || !weekB) {
            setCompareRows([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                setCompareLoading(true);
                setCompareError(null);
                const gradeAsInt = parseInt(compareGrade, 10);
                const { data, error: err } = await supabase
                    .from(baseTableName)
                    .select('*')
                    .eq('grade', gradeAsInt)
                    .eq('slot_name', compareSlot)
                    .in('week_period', [weekA, weekB]);
                if (err) throw err;
                if (!cancelled) setCompareRows(data || []);
            } catch (err) {
                console.error(`Error loading comparison from ${baseTableName}:`, err);
                if (!cancelled) setCompareError(err.message);
            } finally {
                if (!cancelled) setCompareLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [compareMode, compareGrade, compareSlot, weekA, weekB, baseTableName]);

    const rowForWeek = (week) => compareRows.find(r => r.week_period === week) || null;
    const rowA = rowForWeek(weekA);
    const rowB = rowForWeek(weekB);

    useEffect(() => {
        if (!weekFilter) return;

        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchAllRows(() =>
                    supabase.from(baseTableName).select('*').eq('week_period', weekFilter).order('grade').order('slot_name')
                );
                if (!cancelled) setRows(data || []);
            } catch (err) {
                console.error(`Error loading ${baseTableName}:`, err);
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [baseTableName, weekFilter]);

    const grades = useMemo(() => {
        return [...new Set(rows.map(r => r.grade))].sort((a, b) => a - b);
    }, [rows]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (gradeFilter && String(r.grade) !== String(gradeFilter)) return false;
            if (slotSearch && !r.slot_name?.toLowerCase().includes(slotSearch.toLowerCase())) return false;
            return true;
        });
    }, [rows, gradeFilter, slotSearch]);

    return (
        <div className="table-container">
            <div className="header-actions" style={{ marginBottom: 16 }}>
                {!compareMode && (
                    <>
                        <div className="filter-group">
                            <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="filter-select">
                                {availableWeeks.map(w => <option key={w} value={w}>Week of {formatDate(w)}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="filter-select">
                                <option value="">All Grades</option>
                                {grades.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="search-bar">
                            <input
                                type="text"
                                placeholder="Search slot..."
                                value={slotSearch}
                                onChange={(e) => setSlotSearch(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </>
                )}
                <button
                    className={`dropdown-button ica-compare-toggle ${compareMode ? 'active' : ''}`}
                    style={{ marginLeft: compareMode ? 0 : 'auto' }}
                    onClick={() => setCompareMode(!compareMode)}
                >
                    {compareMode ? <X size={16} /> : <GitCompare size={16} />}
                    {compareMode ? 'Close Comparison' : 'Compare Weeks'}
                </button>
            </div>

            {compareMode ? (
                <div className="ica-compare">
                    <div className="header-actions" style={{ marginBottom: 16 }}>
                        <div className="filter-group">
                            <span className="filter-label">Grade</span>
                            <select value={compareGrade} onChange={(e) => setCompareGrade(e.target.value)} className="filter-select">
                                <option value="">Select Grade</option>
                                {compareGrades.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">Slot</span>
                            <select
                                value={compareSlot}
                                onChange={(e) => setCompareSlot(e.target.value)}
                                className="filter-select"
                                disabled={!compareGrade}
                            >
                                <option value="">Select Slot</option>
                                {compareSlots.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">Week A</span>
                            <select value={weekA} onChange={(e) => setWeekA(e.target.value)} className="filter-select">
                                {availableWeeks.map(w => <option key={w} value={w}>Week of {formatDate(w)}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">Week B</span>
                            <select value={weekB} onChange={(e) => setWeekB(e.target.value)} className="filter-select">
                                {availableWeeks.map(w => <option key={w} value={w}>Week of {formatDate(w)}</option>)}
                            </select>
                        </div>
                    </div>

                    {!compareGrade || !compareSlot ? (
                        <div className="empty-state"><p>Select a Grade and Slot to compare</p></div>
                    ) : compareLoading ? (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <div className="loading-text">Loading comparison...</div>
                        </div>
                    ) : compareError ? (
                        <div className="empty-state"><p>Failed to load: {compareError}</p></div>
                    ) : (
                        <div className="ica-compare-result">
                            <div className="ica-compare-cards">
                                <CompareStatCard
                                    label="Total Student" accent="neutral"
                                    a={rowA?.total_students} b={rowB?.total_students}
                                />
                                <CompareStatCard
                                    label="Below" accent="below" colorRule="badIfUp"
                                    a={rowA?.total_below} b={rowB?.total_below}
                                    pctA={rowA?.pct_below} pctB={rowB?.pct_below}
                                />
                                <CompareStatCard
                                    label="Optimal" accent="optimal" colorRule="neutral"
                                    a={rowA?.total_optimal} b={rowB?.total_optimal}
                                    pctA={rowA?.pct_optimal} pctB={rowB?.pct_optimal}
                                />
                                <CompareStatCard
                                    label="Above" accent="above" colorRule="goodIfUp"
                                    a={rowA?.total_above} b={rowB?.total_above}
                                    pctA={rowA?.pct_above} pctB={rowB?.pct_above}
                                />
                            </div>

                            <div className="ica-dumbbell-card">
                                <div className="ica-dumbbell-header">
                                    <h3>Below / Optimal / Above shift</h3>
                                    <div className="ica-dumbbell-legend">
                                        <span><i className="ica-dumbbell-swatch ica-dumbbell-swatch-a" />Week of {formatDate(weekA)}</span>
                                        <span><i className="ica-dumbbell-swatch ica-dumbbell-swatch-b" />Week of {formatDate(weekB)}</span>
                                    </div>
                                </div>
                                <DumbbellChart rowA={rowA} rowB={rowB} />
                            </div>
                        </div>
                    )}
                </div>
            ) : loading ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">Loading analytics...</div>
                </div>
            ) : error ? (
                <div className="empty-state"><p>Failed to load: {error}</p></div>
            ) : filteredRows.length === 0 ? (
                <div className="empty-state"><p>No data available for this week.</p></div>
            ) : (
                <div className="ica-table-scroll">
                    <table className="assignment-table ica-analytics-table">
                        <thead>
                            <tr>
                                <th>Grade</th>
                                <th>Slot</th>
                                <th>Teacher</th>
                                <th>Week Of</th>
                                <th>Total Student</th>
                                <th>Below</th>
                                <th>Optimal</th>
                                <th>Above</th>
                                <th>
                                    Distribution
                                    <div className="ica-distribution-legend">
                                        <span><i style={{ background: DISTRIBUTION_POINT_COLOR.below }} />Below</span>
                                        <span><i style={{ background: DISTRIBUTION_POINT_COLOR.optimal }} />Optimal</span>
                                        <span><i style={{ background: DISTRIBUTION_POINT_COLOR.above }} />Above</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map(r => (
                                <tr key={`${r.grade}-${r.slot_name}`}>
                                    <td>{r.grade}</td>
                                    <td className="ica-analytics-slot-cell">{r.slot_name}</td>
                                    <td>{r.teacher_name}</td>
                                    <td>{formatDate(r.week_period)}</td>
                                    <td>{r.total_students}</td>
                                    <td>
                                        <span className="ica-badge ica-badge-below">{r.total_below} ({r.pct_below?.toFixed(1)}%)</span>
                                    </td>
                                    <td>
                                        <span className="ica-badge ica-badge-optimal">{r.total_optimal} ({r.pct_optimal?.toFixed(1)}%)</span>
                                    </td>
                                    <td>
                                        <span className="ica-badge ica-badge-above">{r.total_above} ({r.pct_above?.toFixed(1)}%)</span>
                                    </td>
                                    <td>
                                        <DistributionChart
                                            pctBelow={r.pct_below} pctOptimal={r.pct_optimal} pctAbove={r.pct_above}
                                            totalBelow={r.total_below} totalOptimal={r.total_optimal} totalAbove={r.total_above}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// One Compare Weeks stat card. colorRule decides which direction of change is
// "good" (green) vs "bad" (red): 'goodIfUp' for Above (more students
// excelling is good), 'badIfUp' for Below (more students struggling is bad),
// 'neutral' for Optimal/Total Student, where a change isn't clearly good or
// bad on its own (e.g. Optimal shrinking could mean students moved up to
// Above, not down to Below).
const CompareStatCard = ({ label, a, b, pctA, pctB, colorRule = 'neutral', accent = 'neutral' }) => {
    const delta = (a != null && b != null) ? a - b : null;
    const deltaPct = (pctA != null && pctB != null) ? pctA - pctB : null;

    let deltaTone = 'neutral';
    if (colorRule !== 'neutral' && delta) {
        const isUp = delta > 0;
        const isGood = colorRule === 'goodIfUp' ? isUp : !isUp;
        deltaTone = isGood ? 'good' : 'bad';
    }

    const formatValue = (v, pct) => {
        if (v == null) return '-';
        return pct != null ? `${v} (${pct.toFixed(1)}%)` : v;
    };

    const arrow = delta == null ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    const deltaText = delta == null
        ? 'No data to compare'
        : `${arrow} ${delta > 0 ? '+' : ''}${delta}${deltaPct != null ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}pp)` : ''}`;

    return (
        <div className={`ica-compare-card ica-compare-card-${accent}`}>
            <p className="ica-compare-card-label">{label}</p>
            <div className="ica-compare-card-values">
                <span className="ica-compare-card-value">{formatValue(a, pctA)}</span>
                <span className="ica-compare-card-vs">vs</span>
                <span className="ica-compare-card-value ica-compare-card-value-muted">{formatValue(b, pctB)}</span>
            </div>
            <span className={`ica-compare-card-delta ica-compare-card-delta-${deltaTone}`}>{deltaText}</span>
        </div>
    );
};

// Dumbbell chart: for each of Below/Optimal/Above, a line connects the Week A
// point to the Week B point on a 0-100% scale - the standard form for
// "before -> after per item" (see the dataviz skill's choosing-a-form
// reference). Week A takes the same blue as the "Compare Weeks"/"Close
// Comparison" toggle button, Week B a neutral gray - identity here is "which
// week", not "which bucket", so the 3 rows share one 2-color legend instead
// of 3 categorical hues.
const DUMBBELL_ROWS = [
    { key: 'below', label: 'Below' },
    { key: 'optimal', label: 'Optimal' },
    { key: 'above', label: 'Above' },
];
const DUMBBELL_COLOR_A = '#3b82f6';
const DUMBBELL_COLOR_B = '#64748b';

const DumbbellChart = ({ rowA, rowB }) => {
    const width = 560;
    const height = 172;
    const padLeft = 76;
    const padRight = 32;
    const padTop = 20;
    const padBottom = 24;
    const plotWidth = width - padLeft - padRight;
    const rowHeight = (height - padTop - padBottom) / DUMBBELL_ROWS.length;
    const xFor = (pct) => padLeft + (pct / 100) * plotWidth;

    const hasAnyData = DUMBBELL_ROWS.some(r => rowA?.[`pct_${r.key}`] != null || rowB?.[`pct_${r.key}`] != null);
    if (!hasAnyData) {
        return <span className="ica-analytics-no-data">No data for either week</span>;
    }

    return (
        <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="ica-dumbbell-chart"
            role="img"
            aria-label={DUMBBELL_ROWS.map(r => {
                const pctA = rowA?.[`pct_${r.key}`];
                const pctB = rowB?.[`pct_${r.key}`];
                return `${r.label}: ${pctA != null ? pctA.toFixed(1) : 'n/a'}% vs ${pctB != null ? pctB.toFixed(1) : 'n/a'}%`;
            }).join(', ')}
        >
            {[0, 25, 50, 75, 100].map(g => (
                <g key={g}>
                    <line x1={xFor(g)} x2={xFor(g)} y1={padTop - 4} y2={height - padBottom} stroke="#e1e0d9" strokeWidth={1} />
                    <text x={xFor(g)} y={height - padBottom + 16} textAnchor="middle" fontSize="10" fill="#898781">{g}%</text>
                </g>
            ))}
            {DUMBBELL_ROWS.map((row, i) => {
                const pctA = rowA?.[`pct_${row.key}`];
                const pctB = rowB?.[`pct_${row.key}`];
                if (pctA == null && pctB == null) return null;

                const y = padTop + rowHeight * i + rowHeight / 2;
                const xA = pctA != null ? xFor(pctA) : null;
                const xB = pctB != null ? xFor(pctB) : null;

                return (
                    <g key={row.key}>
                        <text x={padLeft - 12} y={y + 4} textAnchor="end" fontSize="12" fontWeight="600" fill="#334155">
                            {row.label}
                        </text>
                        {xA != null && xB != null && (
                            <line x1={xA} y1={y} x2={xB} y2={y} stroke="#cbd5e1" strokeWidth={2} />
                        )}
                        {xB != null && (
                            <g>
                                <circle cx={xB} cy={y} r={6} fill={DUMBBELL_COLOR_B} stroke="#fff" strokeWidth={2} tabIndex={0} className="ica-dumbbell-dot">
                                    <title>{`Week B: ${pctB.toFixed(1)}%`}</title>
                                </circle>
                                <text x={xB} y={y + 19} textAnchor="middle" fontSize="10" fill="#64748b">{pctB.toFixed(0)}%</text>
                            </g>
                        )}
                        {xA != null && (
                            <g>
                                <circle cx={xA} cy={y} r={6} fill={DUMBBELL_COLOR_A} stroke="#fff" strokeWidth={2} tabIndex={0} className="ica-dumbbell-dot">
                                    <title>{`Week A: ${pctA.toFixed(1)}%`}</title>
                                </circle>
                                <text x={xA} y={y - 13} textAnchor="middle" fontSize="10" fontWeight="600" fill={DUMBBELL_COLOR_A}>{pctA.toFixed(0)}%</text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

// ============================================================================
// Section C: Per-grade slot breakdown.
// "% Full Understanding" / "% No Understanding" and the per-question breakdown
// are answer-level metrics (what fraction of submitted answers were correct),
// which is a different metric from the student-classification-based
// Below/Optimal/Above buckets in sections A/B - none of the 4 materialized
// views expose it at slot/question granularity, so this section reads
// ica_student_assessments directly, the same way the Dashboard tab does,
// scoped to a user-controlled date range (From/To) instead of a fixed latest
// week. "Total Active Students" is COUNT DISTINCT user_id from
// participants_per_batch within that same range (union across every session
// in the range, not an average per session - same "Union distinct" choice
// confirmed earlier for the latest-week case).
// ============================================================================
const GradeBreakdown = () => {
    const [grades, setGrades] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [loadingGrades, setLoadingGrades] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [slotRows, setSlotRows] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                setLoadingGrades(true);
                const { data, error: err } = await supabase.from('ica_grade_slots').select('grade_list');
                if (err) throw err;
                const uniqueGrades = [...new Set((data || []).map(d => d.grade_list))]
                    .filter(Boolean)
                    .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
                setGrades(uniqueGrades);
            } catch (err) {
                console.error('Error loading grades:', err);
            } finally {
                setLoadingGrades(false);
            }
        })();
    }, []);

    // Default the date range to the grade's most recently synced week (Mon-Sun),
    // as a convenient starting point - the user can then pick any range they want.
    useEffect(() => {
        if (!selectedGrade) {
            setDateFrom('');
            setDateTo('');
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const gradeAsInt = parseInt(selectedGrade, 10);
                const summaryRows = await fetchAllRows(() =>
                    supabase.from('vw_participants_summary_latest').select('week_date').eq('grade', gradeAsInt)
                );
                if (cancelled || !summaryRows.length) return;

                const latestWeek = summaryRows.reduce((max, r) => (r.week_date > max ? r.week_date : max), summaryRows[0].week_date);
                const weekEnd = new Date(latestWeek);
                weekEnd.setDate(weekEnd.getDate() + 6);

                setDateFrom(latestWeek);
                setDateTo(weekEnd.toISOString().split('T')[0]);
            } catch (err) {
                console.error('Error computing default date range:', err);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedGrade]);

    useEffect(() => {
        if (!selectedGrade || !dateFrom || !dateTo) {
            setSlotRows([]);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);

                const gradeAsInt = parseInt(selectedGrade, 10);

                // Total active students per slot: distinct registrants across the range
                const participants = await fetchAllRows(() =>
                    supabase
                        .from('participants_per_batch')
                        .select('slot_name, user_id, teacher_name')
                        .eq('grade', gradeAsInt)
                        .gte('session_date', dateFrom)
                        .lte('session_date', dateTo)
                );

                if (cancelled) return;

                const bySlotParticipants = new Map();
                participants.forEach(p => {
                    if (!bySlotParticipants.has(p.slot_name)) {
                        bySlotParticipants.set(p.slot_name, { userIds: new Set(), teacher_name: p.teacher_name });
                    }
                    const entry = bySlotParticipants.get(p.slot_name);
                    entry.userIds.add(p.user_id);
                    if (p.teacher_name) entry.teacher_name = p.teacher_name;
                });

                const assessments = await fetchAllRows(() =>
                    supabase
                        .from('ica_student_assessments')
                        .select('slot_name, reference_id, session_date, understanding_types')
                        .eq('grade_list', selectedGrade)
                        .gte('session_date', dateFrom)
                        .lte('session_date', dateTo)
                );

                if (cancelled) return;

                // Bucket assessments per slot, then per question within the slot
                const bySlotAssessments = new Map();
                assessments.forEach(a => {
                    if (!bySlotAssessments.has(a.slot_name)) bySlotAssessments.set(a.slot_name, { full: 0, noUnd: 0, byQuestion: new Map() });
                    const bucket = bySlotAssessments.get(a.slot_name);
                    if (a.understanding_types === 'Full Understanding') bucket.full++;
                    else if (a.understanding_types === 'No Understanding') bucket.noUnd++;

                    if (a.understanding_types === 'Full Understanding' || a.understanding_types === 'No Understanding') {
                        if (!bucket.byQuestion.has(a.reference_id)) bucket.byQuestion.set(a.reference_id, { full: 0, attempted: 0 });
                        const qBucket = bucket.byQuestion.get(a.reference_id);
                        qBucket.attempted++;
                        if (a.understanding_types === 'Full Understanding') qBucket.full++;
                    }
                });

                // Union of slots seen in either source, so a slot with participants
                // but no assessment yet (or vice versa) still shows up
                const allSlotNames = new Set([...bySlotParticipants.keys(), ...bySlotAssessments.keys()]);

                const combined = Array.from(allSlotNames).map(slotName => {
                    const participantsEntry = bySlotParticipants.get(slotName);
                    const totalActiveStudents = participantsEntry ? participantsEntry.userIds.size : 0;
                    const teacherName = participantsEntry?.teacher_name || null;

                    const bucket = bySlotAssessments.get(slotName);
                    const attempted = bucket ? bucket.full + bucket.noUnd : 0;
                    const pctFull = attempted > 0 ? (bucket.full / attempted) * 100 : null;
                    const pctNoUnd = attempted > 0 ? (bucket.noUnd / attempted) * 100 : null;

                    const questions = bucket
                        ? Array.from(bucket.byQuestion.entries()).map(([referenceId, q]) => ({
                            reference_id: referenceId,
                            pctFull: q.attempted > 0 ? (q.full / q.attempted) * 100 : null,
                            pctParticipation: totalActiveStudents > 0
                                ? (q.attempted / totalActiveStudents) * 100
                                : null,
                        })).sort((a, b) => a.reference_id.localeCompare(b.reference_id))
                        : [];

                    return {
                        slot_name: slotName,
                        teacher_name: teacherName,
                        total_registrants: totalActiveStudents,
                        pctFull,
                        pctNoUnd,
                        questions,
                    };
                }).sort((a, b) => a.slot_name.localeCompare(b.slot_name, undefined, { numeric: true, sensitivity: 'base' }));

                setSlotRows(combined);
            } catch (err) {
                console.error('Error loading grade breakdown:', err);
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedGrade, dateFrom, dateTo]);

    if (loadingGrades) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading grades...</div>
            </div>
        );
    }

    return (
        <div className="table-container">
            <div className="header-actions" style={{ marginBottom: 16 }}>
                <div className="filter-group">
                    <span className="filter-label">Grade</span>
                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">Select Grade</option>
                        {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                {selectedGrade && (
                    <>
                        <div className="filter-group">
                            <span className="filter-label">From</span>
                            <input
                                type="date"
                                value={dateFrom}
                                max={dateTo || undefined}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="filter-select"
                            />
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">To</span>
                            <input
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="filter-select"
                            />
                        </div>
                    </>
                )}
            </div>

            {!selectedGrade ? (
                <div className="empty-state"><p>Select a grade to see its slot breakdown</p></div>
            ) : loading ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">Loading breakdown...</div>
                </div>
            ) : error ? (
                <div className="empty-state"><p>Failed to load: {error}</p></div>
            ) : slotRows.length === 0 ? (
                <div className="empty-state"><p>No data available for this grade.</p></div>
            ) : (
                <div className="ica-table-scroll">
                    <table className="assignment-table ica-analytics-table">
                        <thead>
                            <tr>
                                <th>Slot</th>
                                <th>Teacher</th>
                                <th>Total Active Students</th>
                                <th>% Full Understanding</th>
                                <th>% No Understanding</th>
                                <th>Per-Question Breakdown</th>
                            </tr>
                        </thead>
                        <tbody>
                            {slotRows.map(row => (
                                <tr key={row.slot_name}>
                                    <td className="ica-analytics-slot-cell">{row.slot_name}</td>
                                    <td>{row.teacher_name}</td>
                                    <td>{row.total_registrants}</td>
                                    <td>{row.pctFull != null ? `${row.pctFull.toFixed(1)}%` : '-'}</td>
                                    <td>{row.pctNoUnd != null ? `${row.pctNoUnd.toFixed(1)}%` : '-'}</td>
                                    <td>
                                        {row.questions.length === 0 ? (
                                            <span className="ica-analytics-no-data">No assessment in this range</span>
                                        ) : (
                                            <div className="ica-question-chip-list">
                                                {row.questions.map(q => (
                                                    <span key={q.reference_id} className="ica-question-chip" title={q.reference_id}>
                                                        <strong>{q.reference_id}</strong>
                                                        {' '}
                                                        {q.pctFull != null ? `${q.pctFull.toFixed(0)}% Full` : 'n/a'}
                                                        {' · '}
                                                        {q.pctParticipation != null ? `${q.pctParticipation.toFixed(0)}% Participation` : 'n/a'}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ICAAnalyticsTab;
