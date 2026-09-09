import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Search, RefreshCw } from 'lucide-react';
import '../styles/ImportAssignmentModal.css';
import '../styles/ICAAnalytics.css';
import { supabase } from '../lib/supabaseClient.mjs';
import { fetchAllRows, formatDate } from './ICAAnalyticsTab';

// classification -> computedTotals key ('Not Considered' has a space, doesn't
// match a plain .toLowerCase() key)
const CLASSIFICATION_TOTAL_KEY = {
    Below: 'below',
    Optimal: 'optimal',
    Above: 'above',
    'Not Considered': 'notConsidered',
};

// classification -> CSS class suffix, e.g. 'Not Considered' -> 'not-considered'
const classificationSlug = (classification) => classification?.toLowerCase().replace(/\s+/g, '-');

// ============================================================================
// Score distribution histogram - gap analysis at 10% resolution, requested by
// the ICA team on top of the existing Below/Optimal/Above buckets (those
// stay threshold-driven and configurable; this view is a fixed decile split
// of the same pct_correctness already fetched above, so it needs no new SQL).
// Each bin is still colored/stacked by the student's real classification
// (not a hardcoded 50/85 split), so it stays correct under any configured
// threshold - same red/blue/green as DistributionChart in ICAAnalyticsTab,
// validated via the dataviz skill's validate_palette.js (all checks pass).
// ============================================================================
const SCORE_BIN_COLOR = { below: '#dc2626', optimal: '#3b82f6', above: '#16a34a' };
const SCORE_BIN_LABEL = { below: 'Below', optimal: 'Optimal', above: 'Above' };
const SCORE_BIN_GAP = 2;
const SCORE_BINS_META = Array.from({ length: 10 }, (_, i) => ({
    label: i === 0 ? '0-10%' : `${i * 10 + 1}-${i * 10 + 10}%`,
}));

// pct==0 and exact multiples of 10 fall in the LOWER bin (e.g. pct=20 -> "11-20%",
// not "21-30%"), matching the inclusive upper-bound labels above.
const binIndexForPct = (pct) => {
    if (pct <= 0) return 0;
    return Math.min(9, Math.ceil(pct / 10) - 1);
};

// Rect with only the top two corners rounded (the free/data end) - the
// baseline-anchored bottom edge of a stack, or the boundary between two
// stacked segments, stays square.
const roundedTopRectPath = (x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, w / 2, h));
    if (radius === 0) return `M${x},${y + h} L${x},${y} L${x + w},${y} L${x + w},${y + h} Z`;
    return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`;
};

const ScoreDistributionHistogram = ({ bins, notConsideredCount }) => {
    const wrapRef = useRef(null);
    // { binIndex, key, count, total, x, y } of whichever segment is hovered/focused,
    // or null - drives both the tooltip and the "lift" highlight on that segment.
    const [hover, setHover] = useState(null);

    const totalScored = bins.reduce((s, b) => s + b.below + b.optimal + b.above, 0);

    if (totalScored === 0) {
        return <p className="ica-threshold-footer-warn">Belum ada siswa dengan skor untuk ditampilkan.</p>;
    }

    const maxCount = Math.max(1, ...bins.map(b => b.below + b.optimal + b.above));
    const width = 640;
    const height = 220;
    const padLeft = 30;
    const padRight = 8;
    const padTop = 14;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const slotW = plotW / bins.length;
    const barW = slotW * 0.62;
    const baselineY = padTop + plotH;

    // Mouse events carry a real cursor position; keyboard focus events don't
    // (clientX/Y are 0), so fall back to the target segment's own bounding box.
    const showTooltip = (e, binIndex, key, count, total) => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const wrapRect = wrap.getBoundingClientRect();
        let x, y;
        if (e.clientX || e.clientY) {
            x = e.clientX - wrapRect.left;
            y = e.clientY - wrapRect.top;
        } else {
            const targetRect = e.currentTarget.getBoundingClientRect();
            x = targetRect.left + targetRect.width / 2 - wrapRect.left;
            y = targetRect.top - wrapRect.top;
        }
        setHover({ binIndex, key, count, total, x, y });
    };
    const hideTooltip = () => setHover(null);

    return (
        <div className="ica-histogram-card">
            <div className="ica-dumbbell-header">
                <h3>Distribusi Skor (interval 10%)</h3>
                <div className="ica-distribution-legend" style={{ marginTop: 0 }}>
                    <span><i style={{ background: SCORE_BIN_COLOR.below }} />Below</span>
                    <span><i style={{ background: SCORE_BIN_COLOR.optimal }} />Optimal</span>
                    <span><i style={{ background: SCORE_BIN_COLOR.above }} />Above</span>
                </div>
            </div>
            <div className="ica-histogram-chart-wrap" ref={wrapRef}>
                <svg
                    width="100%"
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    className="ica-histogram-chart"
                    role="img"
                    aria-label={bins.map((b, i) => `${SCORE_BINS_META[i].label}: ${b.below + b.optimal + b.above} siswa`).join(', ')}
                >
                    <line x1={padLeft} x2={padLeft} y1={padTop} y2={baselineY} stroke="#e1e0d9" strokeWidth={1} />
                    <line x1={padLeft} x2={width - padRight} y1={baselineY} y2={baselineY} stroke="#e1e0d9" strokeWidth={1} />
                    <text x={padLeft - 6} y={padTop + 4} textAnchor="end" fontSize="10" fill="#898781">{maxCount}</text>
                    <text x={padLeft - 6} y={baselineY + 4} textAnchor="end" fontSize="10" fill="#898781">0</text>

                    {bins.map((b, i) => {
                        const x = padLeft + i * slotW + (slotW - barW) / 2;
                        const segments = [
                            { key: 'below', count: b.below, color: SCORE_BIN_COLOR.below },
                            { key: 'optimal', count: b.optimal, color: SCORE_BIN_COLOR.optimal },
                            { key: 'above', count: b.above, color: SCORE_BIN_COLOR.above },
                        ].filter(s => s.count > 0);

                        let yCursor = baselineY;
                        const total = b.below + b.optimal + b.above;

                        return (
                            <g key={i}>
                                {segments.map((s, si) => {
                                    const isLast = si === segments.length - 1;
                                    const rawH = (s.count / maxCount) * plotH;
                                    const topY = yCursor - rawH;
                                    const visibleY = isLast ? topY : topY + SCORE_BIN_GAP;
                                    const visibleH = Math.max(1, isLast ? rawH : rawH - SCORE_BIN_GAP);
                                    yCursor = topY;
                                    const isHovered = hover?.binIndex === i && hover?.key === s.key;
                                    return (
                                        <path
                                            key={s.key}
                                            d={roundedTopRectPath(x, visibleY, barW, visibleH, isLast ? 3 : 0)}
                                            fill={s.color}
                                            tabIndex={0}
                                            className="ica-histogram-segment"
                                            style={isHovered ? { filter: 'brightness(1.15)' } : undefined}
                                            onMouseEnter={(e) => showTooltip(e, i, s.key, s.count, total)}
                                            onMouseMove={(e) => showTooltip(e, i, s.key, s.count, total)}
                                            onMouseLeave={hideTooltip}
                                            onFocus={(e) => showTooltip(e, i, s.key, s.count, total)}
                                            onBlur={hideTooltip}
                                        />
                                    );
                                })}
                                <text x={x + barW / 2} y={baselineY + 14} textAnchor="middle" fontSize="9" fill="#64748b">
                                    {SCORE_BINS_META[i].label}
                                </text>
                            </g>
                        );
                    })}
                </svg>
                {hover && (
                    <div
                        className="ica-histogram-tooltip"
                        style={{ left: Math.min(Math.max(hover.x, 56), (wrapRef.current?.getBoundingClientRect().width ?? 640) - 56), top: hover.y }}
                    >
                        <strong>{hover.count}</strong> siswa{' '}
                        <span style={{ color: SCORE_BIN_COLOR[hover.key] }}>{SCORE_BIN_LABEL[hover.key]}</span>
                        <div className="ica-histogram-tooltip-sub">
                            {SCORE_BINS_META[hover.binIndex].label} &middot; {hover.total} siswa di bin ini
                        </div>
                    </div>
                )}
            </div>
            {notConsideredCount > 0 && (
                <p className="ica-histogram-note">
                    {notConsideredCount} siswa "Not Considered" (belum ≥3 attempt) tidak dihitung dalam grafik ini.
                </p>
            )}
        </div>
    );
};

// Per-student drill-down behind one Historical/Active row, so the aggregate
// Total/Below/Optimal/Above numbers can be checked against the actual list
// of students they were computed from, instead of taken on faith.
// - historical: every student who ever had data for this grade+slot+week
//   (vw_student_classification[_mandatory]), no registration filter.
// - active: same, but only students in the forward-filled active roster for
//   that exact week (vw_active_roster_forward_filled), mirroring
//   mv_ica_classification_active's join (see sql/patch_v8_active_holiday_forward_fill.sql).
//   On a slot-holiday week (no session at all that week) the roster carries
//   forward from the slot's last real session instead of coming up empty.
//
// "Tabel" (row) comes from mv_ica_classification_historical/active - a
// periodic snapshot, refreshed by cron or by saving the threshold config.
// "Detail" queries vw_student_classification live. New assessment data or a
// threshold change since the last refresh shows up in Detail immediately but
// not in Tabel until the mat-view is refreshed - hence the mismatch warning.
// The "Refresh data" button re-runs that same refresh on demand.
const SlotDetailModal = ({ row, onClose, mode, isMandatory, onRefreshed }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [classificationFilter, setClassificationFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState(null);

    const loadDetail = useCallback(async () => {
        if (!row) return;
        try {
            setLoading(true);
            setError(null);

            const classificationTable = isMandatory ? 'vw_student_classification_mandatory' : 'vw_student_classification';
            const classRows = await fetchAllRows(() =>
                supabase
                    .from(classificationTable)
                    .select('user_id, pct_correctness, classification')
                    .eq('grade', row.grade)
                    .eq('slot_name', row.slot_name)
                    .eq('week_date', row.week_period)
            );

            // Union across every session for this grade+slot (not just this week),
            // so a student who has since left still resolves a name for Historical.
            const participantRows = await fetchAllRows(() =>
                supabase
                    .from('participants_per_batch')
                    .select('user_id, student_name, week_date')
                    .eq('grade', row.grade)
                    .eq('slot_name', row.slot_name)
            );

            const nameMap = new Map();
            participantRows.forEach(p => {
                if (!nameMap.has(p.user_id)) nameMap.set(p.user_id, p.student_name);
            });

            const eligibleIds = mode === 'active'
                ? new Set((await fetchAllRows(() =>
                      supabase
                          .from('vw_active_roster_forward_filled')
                          .select('user_id')
                          .eq('grade', row.grade)
                          .eq('slot_name', row.slot_name)
                          .eq('week_date', row.week_period)
                          .eq('is_present', true)
                  )).map(r => r.user_id))
                : null;

            const merged = (classRows || [])
                .filter(r => !eligibleIds || eligibleIds.has(r.user_id))
                .map(r => ({ ...r, student_name: nameMap.get(r.user_id) || null }))
                .sort((a, b) => (a.student_name || a.user_id).localeCompare(b.student_name || b.user_id));

            setStudents(merged);
        } catch (err) {
            console.error('Error loading slot detail:', err);
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    }, [row, mode, isMandatory]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await loadDetail();
            if (cancelled) return;
        })();
        return () => { cancelled = true; };
    }, [loadDetail]);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            setRefreshError(null);
            const { error: err } = await supabase.rpc('refresh_ica_classification_views');
            if (err) throw err;
            await loadDetail();
            onRefreshed?.();
        } catch (err) {
            console.error('Error refreshing classification views:', err);
            setRefreshError(err.message || String(err));
        } finally {
            setRefreshing(false);
        }
    };

    // total: hanya siswa yang sudah terklasifikasi Below/Optimal/Above (>=3
    // attempt) - mirroring total_students di mv_ica_classification_*, yang
    // sengaja TIDAK menghitung Not Considered.
    const computedTotals = useMemo(() => ({
        total: students.filter(s => s.classification !== 'Not Considered').length,
        below: students.filter(s => s.classification === 'Below').length,
        optimal: students.filter(s => s.classification === 'Optimal').length,
        above: students.filter(s => s.classification === 'Above').length,
        notConsidered: students.filter(s => s.classification === 'Not Considered').length,
    }), [students]);

    // Same students as computedTotals, regrouped into 10 fixed-width score
    // bins instead of just Below/Optimal/Above - "Not Considered" (< 3
    // attempts) is excluded here too since it has no meaningful position on
    // a score axis.
    const histogramBins = useMemo(() => {
        const bins = Array.from({ length: 10 }, () => ({ below: 0, optimal: 0, above: 0 }));
        students.forEach(s => {
            if (s.classification === 'Not Considered' || s.pct_correctness == null) return;
            const idx = binIndexForPct(Number(s.pct_correctness));
            if (s.classification === 'Below') bins[idx].below++;
            else if (s.classification === 'Optimal') bins[idx].optimal++;
            else if (s.classification === 'Above') bins[idx].above++;
        });
        return bins;
    }, [students]);

    // New row clicked - drop whatever filter/search was left from the last one.
    useEffect(() => {
        setSearch('');
        setClassificationFilter('all');
    }, [row]);

    const filteredStudents = useMemo(() => {
        const term = search.toLowerCase();
        return students.filter(s => {
            if (classificationFilter !== 'all' && s.classification !== classificationFilter) return false;
            if (!term) return true;
            return s.user_id?.toLowerCase().includes(term) || s.student_name?.toLowerCase().includes(term);
        });
    }, [students, search, classificationFilter]);

    if (!row) return null;

    const mismatch = !loading && !error && (
        computedTotals.total !== row.total_students ||
        computedTotals.below !== row.total_below ||
        computedTotals.optimal !== row.total_optimal ||
        computedTotals.above !== row.total_above ||
        computedTotals.notConsidered !== row.total_not_considered
    );

    return (
        <div className="import-modal-overlay">
            <div className="import-modal-content slot-detail-modal-content">
                <div className="import-modal-header">
                    <h3 className="import-modal-title">
                        Grade {row.grade} - {row.slot_name}
                    </h3>
                    <button className="import-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="import-modal-body">
                    <p className="mqm-hint">
                        {row.teacher_name} - Week of {formatDate(row.week_period)} - {mode === 'active' ? 'Active Student' : 'Historical (All Student)'}
                        {isMandatory && ' - Mandatory Only'}
                    </p>

                    <table className="ica-threshold-table" style={{ marginBottom: 16 }}>
                        <thead>
                            <tr>
                                <th></th>
                                <th>Total Student</th>
                                <th>Below</th>
                                <th>Optimal</th>
                                <th>Above</th>
                                <th>Not Considered</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="ica-threshold-jenjang">Tabel</td>
                                <td>{row.total_students}</td>
                                <td>{row.total_below}</td>
                                <td>{row.total_optimal}</td>
                                <td>{row.total_above}</td>
                                <td>{row.total_not_considered}</td>
                            </tr>
                            <tr>
                                <td className="ica-threshold-jenjang">Detail (di bawah)</td>
                                <td>{loading ? '…' : computedTotals.total}</td>
                                <td>{loading ? '…' : computedTotals.below}</td>
                                <td>{loading ? '…' : computedTotals.optimal}</td>
                                <td>{loading ? '…' : computedTotals.above}</td>
                                <td>{loading ? '…' : computedTotals.notConsidered}</td>
                            </tr>
                        </tbody>
                    </table>

                    {mismatch && (
                        <div className="slot-detail-mismatch">
                            <span>
                                Jumlah di tabel dan detail tidak sama - "Tabel" adalah snapshot yang di-refresh berkala,
                                "Detail" selalu live. Data baru masuk atau ambang batas berubah sejak snapshot terakhir bisa menyebabkan ini.
                            </span>
                            <button
                                type="button"
                                className="import-button primary"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCw size={14} className={refreshing ? 'ica-threshold-loading' : ''} />
                                {refreshing ? 'Menyegarkan…' : 'Refresh data'}
                            </button>
                        </div>
                    )}
                    {refreshError && (
                        <div className="ica-threshold-footer-error" style={{ marginBottom: 12 }}>
                            Gagal refresh: {refreshError}
                        </div>
                    )}

                    {!loading && !error && (
                        <ScoreDistributionHistogram bins={histogramBins} notConsideredCount={computedTotals.notConsidered} />
                    )}

                    <div className="slot-detail-toolbar">
                        <div className="search-bar" style={{ maxWidth: '100%', marginBottom: 0 }}>
                            <Search className="search-icon" size={16} />
                            <input
                                type="text"
                                placeholder="Cari nama/user_id..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        <div className="ica-view-toggle">
                            {['all', 'Below', 'Optimal', 'Above', 'Not Considered'].map(opt => (
                                <button
                                    key={opt}
                                    className={`ica-view-toggle-btn${classificationFilter === opt ? ' active' : ''}`}
                                    onClick={() => setClassificationFilter(opt)}
                                >
                                    {opt === 'all' ? 'All' : opt}
                                    {opt !== 'all' && !loading && ` (${computedTotals[CLASSIFICATION_TOTAL_KEY[opt]]})`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <p className="ica-threshold-loading-text">Memuat detail siswa…</p>
                    ) : error ? (
                        <p className="ica-threshold-footer-error">Gagal memuat: {error}</p>
                    ) : filteredStudents.length === 0 ? (
                        <p className="ica-threshold-footer-warn">Tidak ada siswa untuk ditampilkan.</p>
                    ) : (
                        <div className="ica-table-scroll slot-detail-table-scroll">
                            <table className="assignment-table ica-analytics-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Nama</th>
                                        <th>User ID</th>
                                        <th>% Correctness</th>
                                        <th>Klasifikasi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((s, idx) => (
                                        <tr key={s.user_id}>
                                            <td>{idx + 1}</td>
                                            <td>{s.student_name || '-'}</td>
                                            <td>{s.user_id}</td>
                                            <td>{s.pct_correctness != null ? `${Number(s.pct_correctness).toFixed(1)}%` : '-'}</td>
                                            <td>
                                                <span className={`ica-badge ica-badge-${classificationSlug(s.classification)}`}>
                                                    {s.classification}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="import-modal-footer">
                    <button className="import-button cancel" onClick={onClose}>Tutup</button>
                </div>
            </div>
        </div>
    );
};

export default SlotDetailModal;
