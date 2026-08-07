import React, { useState, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import '../styles/ImportAssignmentModal.css';
import '../styles/ICAAnalytics.css';
import { supabase } from '../lib/supabaseClient.mjs';
import { fetchAllRows, formatDate } from './ICAAnalyticsTab';

// Per-student drill-down behind one Historical/Active row, so the aggregate
// Total/Below/Optimal/Above numbers can be checked against the actual list
// of students they were computed from, instead of taken on faith.
// - historical: every student who ever had data for this grade+slot+week
//   (vw_student_classification[_mandatory]), no registration filter.
// - active: same, but only students still registered that exact week
//   (participants_per_batch), mirroring mv_ica_classification_active's join.
const SlotDetailModal = ({ row, onClose, mode, isMandatory }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!row) return;
        let cancelled = false;
        (async () => {
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
                if (cancelled) return;

                const nameMap = new Map();
                participantRows.forEach(p => {
                    if (!nameMap.has(p.user_id)) nameMap.set(p.user_id, p.student_name);
                });

                const eligibleIds = mode === 'active'
                    ? new Set(participantRows.filter(p => p.week_date === row.week_period).map(p => p.user_id))
                    : null;

                const merged = (classRows || [])
                    .filter(r => !eligibleIds || eligibleIds.has(r.user_id))
                    .map(r => ({ ...r, student_name: nameMap.get(r.user_id) || null }))
                    .sort((a, b) => (a.student_name || a.user_id).localeCompare(b.student_name || b.user_id));

                setStudents(merged);
            } catch (err) {
                console.error('Error loading slot detail:', err);
                if (!cancelled) setError(err.message || String(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [row, mode, isMandatory]);

    const computedTotals = useMemo(() => ({
        total: students.length,
        below: students.filter(s => s.classification === 'Below').length,
        optimal: students.filter(s => s.classification === 'Optimal').length,
        above: students.filter(s => s.classification === 'Above').length,
    }), [students]);

    const filteredStudents = useMemo(() => {
        if (!search) return students;
        const term = search.toLowerCase();
        return students.filter(s =>
            s.user_id?.toLowerCase().includes(term) || s.student_name?.toLowerCase().includes(term)
        );
    }, [students, search]);

    if (!row) return null;

    const mismatch = !loading && !error && (
        computedTotals.total !== row.total_students ||
        computedTotals.below !== row.total_below ||
        computedTotals.optimal !== row.total_optimal ||
        computedTotals.above !== row.total_above
    );

    return (
        <div className="import-modal-overlay">
            <div className="import-modal-content">
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
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="ica-threshold-jenjang">Tabel</td>
                                <td>{row.total_students}</td>
                                <td>{row.total_below}</td>
                                <td>{row.total_optimal}</td>
                                <td>{row.total_above}</td>
                            </tr>
                            <tr>
                                <td className="ica-threshold-jenjang">Detail (di bawah)</td>
                                <td>{loading ? '…' : computedTotals.total}</td>
                                <td>{loading ? '…' : computedTotals.below}</td>
                                <td>{loading ? '…' : computedTotals.optimal}</td>
                                <td>{loading ? '…' : computedTotals.above}</td>
                            </tr>
                        </tbody>
                    </table>

                    {mismatch && (
                        <div className="ica-threshold-footer-error" style={{ marginBottom: 12 }}>
                            Jumlah di tabel dan detail tidak sama - kemungkinan data belum di-refresh atau ada perubahan ambang batas yang belum diterapkan ulang.
                        </div>
                    )}

                    <div className="search-bar" style={{ maxWidth: '100%', marginBottom: 12 }}>
                        <Search className="search-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Cari nama/user_id..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    {loading ? (
                        <p className="ica-threshold-loading-text">Memuat detail siswa…</p>
                    ) : error ? (
                        <p className="ica-threshold-footer-error">Gagal memuat: {error}</p>
                    ) : filteredStudents.length === 0 ? (
                        <p className="ica-threshold-footer-warn">Tidak ada siswa untuk ditampilkan.</p>
                    ) : (
                        <div className="ica-table-scroll" style={{ maxHeight: 360 }}>
                            <table className="assignment-table ica-analytics-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>User ID</th>
                                        <th>% Correctness</th>
                                        <th>Klasifikasi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map(s => (
                                        <tr key={s.user_id}>
                                            <td>{s.student_name || '-'}</td>
                                            <td>{s.user_id}</td>
                                            <td>{s.pct_correctness != null ? `${Number(s.pct_correctness).toFixed(1)}%` : '-'}</td>
                                            <td>
                                                <span className={`ica-badge ica-badge-${s.classification?.toLowerCase()}`}>
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
