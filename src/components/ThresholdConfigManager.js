import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import '../styles/ImportAssignmentModal.css';
import '../styles/ICAAnalytics.css';
import { supabase } from '../lib/supabaseClient.mjs';
import { formatDate } from './ICAAnalyticsTab';

const JENJANG_DEFAULTS = {
    SD:  { below: 50, above: 85 },
    SMP: { below: 50, above: 85 },
    SMA: { below: 50, above: 85 },
};

// Global Below/Optimal/Above thresholds for ICA - single source of truth
// (ica_threshold_config) read by both the Dashboard tab and Analytics tab
// (Historical/Active), and by the underlying SQL views. Editing here and
// saving updates every consumer, not just whichever tab happens to be open.
const ThresholdConfigManager = ({ isOpen, onClose, userEmail, onSaved }) => {
    const [jenjangThresholds, setJenjangThresholds] = useState(JENJANG_DEFAULTS);
    const [savedThresholds, setSavedThresholds] = useState(JENJANG_DEFAULTS);
    const [thresholdMeta, setThresholdMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const hasUnsavedChanges = ['SD', 'SMP', 'SMA'].some(
        j => jenjangThresholds[j].below !== savedThresholds[j].below ||
             jenjangThresholds[j].above !== savedThresholds[j].above
    );

    const loadThresholds = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('ica_threshold_config')
                .select('jenjang,below_threshold,above_threshold,updated_by,updated_at');
            if (error) throw error;
            if (!data || data.length === 0) return;
            const next = { ...JENJANG_DEFAULTS };
            let latest = null;
            data.forEach(r => {
                next[r.jenjang] = { below: r.below_threshold, above: r.above_threshold };
                if (!latest || new Date(r.updated_at) > new Date(latest.updatedAt)) {
                    latest = { updatedBy: r.updated_by, updatedAt: r.updated_at };
                }
            });
            setJenjangThresholds(next);
            setSavedThresholds(next);
            setThresholdMeta(latest);
        } catch (error) {
            console.error('Error loading ica_threshold_config:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) loadThresholds();
    }, [isOpen]);

    const updateThreshold = (jenjang, field, rawValue) => {
        const value = Number(rawValue);
        if (rawValue === '' || isNaN(value)) return;
        setJenjangThresholds(prev => {
            const cur = prev[jenjang];
            if (field === 'below') return { ...prev, [jenjang]: { ...cur, below: value } };
            return { ...prev, [jenjang]: { ...cur, above: value } };
        });
    };

    const clampThreshold = (jenjang, field) => {
        setJenjangThresholds(prev => {
            const cur = prev[jenjang];
            if (field === 'below') {
                const clamped = Math.max(1, Math.min(Math.round(cur.below) || 1, cur.above - 1));
                return { ...prev, [jenjang]: { ...cur, below: clamped } };
            }
            const clamped = Math.max(cur.below + 1, Math.min(Math.round(cur.above) || 99, 99));
            return { ...prev, [jenjang]: { ...cur, above: clamped } };
        });
    };

    const saveThresholds = async () => {
        try {
            setSaving(true);
            setSaveError(null);
            const payload = ['SD', 'SMP', 'SMA'].map(j => ({
                jenjang: j,
                below_threshold: jenjangThresholds[j].below,
                above_threshold: jenjangThresholds[j].above,
                updated_by: userEmail || null,
            }));
            const { error } = await supabase
                .from('ica_threshold_config')
                .upsert(payload, { onConflict: 'jenjang' });
            if (error) throw error;
            setSavedThresholds(jenjangThresholds);
            setThresholdMeta({ updatedBy: userEmail || null, updatedAt: new Date().toISOString() });

            // Re-classify every student against the new thresholds server-side -
            // mv_ica_classification_historical/active[_mandatory] all depend on
            // vw_student_classification, which reads ica_threshold_config.
            const { error: refreshErr } = await supabase.rpc('refresh_ica_classification_views');
            if (refreshErr) throw refreshErr;

            onSaved?.();
        } catch (error) {
            console.error('Error saving ica_threshold_config:', error);
            setSaveError(error.message || String(error));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="import-modal-overlay">
            <div className="import-modal-content">
                <div className="import-modal-header">
                    <h3 className="import-modal-title">
                        <SlidersHorizontal size={20} />
                        Ambang Batas (Below / Optimal / Above)
                    </h3>
                    <button className="import-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="import-modal-body">
                    <p className="mqm-hint">
                        Berlaku untuk <strong>semua user</strong> dan <strong>semua tab</strong> (Dashboard &amp; Analytics).
                        Perubahan langsung diterapkan ke seluruh data setelah disimpan.
                    </p>

                    {loading ? (
                        <p className="ica-threshold-loading-text">Memuat konfigurasi…</p>
                    ) : (
                        <>
                            <table className="ica-threshold-table">
                                <thead>
                                    <tr>
                                        <th>Jenjang</th>
                                        <th>Below (&lt;)</th>
                                        <th>Above (&gt;)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {['SD', 'SMP', 'SMA'].map(j => (
                                        <tr key={j}>
                                            <td className="ica-threshold-jenjang">{j}</td>
                                            <td>
                                                <div className="ica-threshold-cell">
                                                    <input
                                                        type="number" min="1" max="99"
                                                        value={jenjangThresholds[j].below}
                                                        onChange={e => updateThreshold(j, 'below', e.target.value)}
                                                        onBlur={() => clampThreshold(j, 'below')}
                                                        className="ica-threshold-input"
                                                    />
                                                    <span className="ica-threshold-pct">%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="ica-threshold-cell">
                                                    <input
                                                        type="number" min="1" max="99"
                                                        value={jenjangThresholds[j].above}
                                                        onChange={e => updateThreshold(j, 'above', e.target.value)}
                                                        onBlur={() => clampThreshold(j, 'above')}
                                                        className="ica-threshold-input"
                                                    />
                                                    <span className="ica-threshold-pct">%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="ica-threshold-footer">
                                {thresholdMeta && (
                                    <div className="ica-threshold-footer-info">
                                        Terakhir diubah oleh {thresholdMeta.updatedBy || 'tidak diketahui'} pada {formatDate(thresholdMeta.updatedAt)}
                                    </div>
                                )}
                                {saveError && (
                                    <div className="ica-threshold-footer-error" title={saveError}>
                                        Gagal menyimpan: {saveError}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="import-modal-footer">
                    {hasUnsavedChanges && (
                        <button
                            className="import-button cancel"
                            onClick={() => setJenjangThresholds(savedThresholds)}
                            disabled={saving}
                        >
                            Batalkan
                        </button>
                    )}
                    <button className="import-button cancel" onClick={onClose} disabled={saving}>Tutup</button>
                    <button
                        className="import-button primary"
                        onClick={saveThresholds}
                        disabled={saving || loading || !hasUnsavedChanges}
                    >
                        {saving ? 'Menyimpan…' : 'Simpan untuk semua'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThresholdConfigManager;
