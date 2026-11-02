import React, { useState, useRef } from 'react';
import { pairKey } from '../hooks/usePiketNavConfig';

const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '12px',
        width: 'min(1000px, 94vw)',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    },
    header: {
        padding: '16px 24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: { margin: 0, fontSize: '1.2rem', color: '#0F32B1' },
    body: { padding: '16px 24px', overflowY: 'auto', flex: 1 },
    footer: {
        padding: '12px 24px',
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '8px',
    },
    sectionTitle: { margin: '8px 0 4px', fontSize: '1rem', color: '#333' },
    hint: { margin: '0 0 12px', fontSize: '12px', color: '#666' },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 0',
        borderBottom: '1px solid #F3F4F6',
    },
    input: {
        padding: '6px 8px',
        border: '1px solid #D1D5DB',
        borderRadius: '4px',
        fontSize: '13px',
        minWidth: 0,
    },
    colorInput: { width: '36px', height: '30px', padding: 0, border: '1px solid #D1D5DB', borderRadius: '4px', cursor: 'pointer' },
    iconButton: {
        border: '1px solid #D1D5DB',
        backgroundColor: 'white',
        borderRadius: '4px',
        cursor: 'pointer',
        padding: '4px 8px',
        fontSize: '12px',
    },
    primaryButton: {
        padding: '8px 16px',
        backgroundColor: '#3B82F6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 600,
    },
    secondaryButton: {
        padding: '8px 16px',
        backgroundColor: '#E5E7EB',
        color: '#333',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 600,
    },
    addButton: {
        marginTop: '8px',
        padding: '6px 12px',
        backgroundColor: '#10B981',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 600,
    },
    deleteButton: {
        border: 'none',
        backgroundColor: '#EF4444',
        color: 'white',
        borderRadius: '4px',
        cursor: 'pointer',
        padding: '4px 8px',
        fontSize: '12px',
    },
    unmappedBox: {
        margin: '8px 0 12px',
        padding: '8px 12px',
        backgroundColor: '#FEF3C7',
        borderRadius: '6px',
        fontSize: '12px',
    },
    error: { color: '#B91C1C', fontSize: '13px', marginRight: 'auto' },
    preview: {
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        minWidth: '60px',
        textAlign: 'center',
    },
};

const DEFAULT_TEXT_COLOR = '#FFFFFF';
const DEFAULT_COLOR = '#FFED76';

/**
 * Editor for the Piket "Jump to" navigation: group order/colors/visibility and
 * the (grade, subject) -> group mapping. Edits stay local until "Simpan".
 *
 * Props:
 *  - groups / mappings: current saved config
 *  - detectedPairs: unique raw { grade, subject } pairs found in piket_schedule
 *  - currentGroups: group names currently shown (used to pre-fill when no config exists)
 *  - fallbackColor(name): colour the page uses for a group without config
 *  - onSave(groups, mappings): async, throws on failure
 */
const PiketNavSettings = ({ groups, mappings, detectedPairs, currentGroups, fallbackColor, onSave, onClose }) => {
    const keyCounter = useRef(0);
    const nextKey = () => `k${keyCounter.current++}`;

    const [draftGroups, setDraftGroups] = useState(() => {
        const source = groups.length > 0
            ? groups.map(g => ({ name: g.name, color: g.color || DEFAULT_COLOR, text_color: g.text_color || DEFAULT_TEXT_COLOR, is_active: g.is_active }))
            : currentGroups.map(name => ({ name, color: fallbackColor(name), text_color: DEFAULT_TEXT_COLOR, is_active: true }));
        return source.map(g => ({ ...g, key: nextKey() }));
    });

    const [draftMappings, setDraftMappings] = useState(() => {
        const source = mappings.length > 0
            ? mappings.map(m => ({
                source_grade: m.source_grade,
                source_subject: m.source_subject || '',
                group_name: m.group_name,
                display_subject: m.display_subject || '',
            }))
            : detectedPairs.map(p => ({
                source_grade: p.grade,
                source_subject: p.subject || '',
                group_name: p.grade,
                display_subject: '',
            }));
        return source.map(m => ({ ...m, key: nextKey() }));
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const updateGroup = (key, patch) => {
        setDraftGroups(prev => prev.map(g => (g.key === key ? { ...g, ...patch } : g)));
    };

    // Renaming a group also renames it in every mapping that points to it.
    const renameGroup = (key, newName) => {
        const old = draftGroups.find(g => g.key === key);
        if (!old) return;
        updateGroup(key, { name: newName });
        setDraftMappings(prev => prev.map(m => (m.group_name === old.name ? { ...m, group_name: newName } : m)));
    };

    const moveGroup = (index, delta) => {
        setDraftGroups(prev => {
            const target = index + delta;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const removeGroup = (key) => {
        setDraftGroups(prev => prev.filter(g => g.key !== key));
    };

    const addGroup = () => {
        setDraftGroups(prev => [...prev, { key: nextKey(), name: '', color: DEFAULT_COLOR, text_color: '#333333', is_active: true }]);
    };

    const updateMapping = (key, patch) => {
        setDraftMappings(prev => prev.map(m => (m.key === key ? { ...m, ...patch } : m)));
    };

    const removeMapping = (key) => {
        setDraftMappings(prev => prev.filter(m => m.key !== key));
    };

    const addMapping = (seed = {}) => {
        setDraftMappings(prev => [...prev, {
            key: nextKey(),
            source_grade: '',
            source_subject: '',
            group_name: draftGroups[0]?.name || '',
            display_subject: '',
            ...seed,
        }]);
    };

    const mappedKeys = new Set(draftMappings.map(m => pairKey(m.source_grade, m.source_subject)));
    const unmappedPairs = detectedPairs.filter(p => !mappedKeys.has(pairKey(p.grade, p.subject)));

    const validate = () => {
        const names = new Set();
        for (const g of draftGroups) {
            const name = g.name.trim();
            if (!name) return 'Nama grup tidak boleh kosong.';
            if (names.has(name.toLowerCase())) return `Nama grup "${name}" dipakai lebih dari sekali.`;
            names.add(name.toLowerCase());
        }
        const pairs = new Set();
        for (const m of draftMappings) {
            if (!m.source_grade.trim()) return 'Grade sumber pada aturan pemetaan tidak boleh kosong.';
            const key = pairKey(m.source_grade, m.source_subject);
            if (pairs.has(key)) return `Aturan untuk "${m.source_grade} / ${m.source_subject || '(tanpa subject)'}" dobel.`;
            pairs.add(key);
            if (!names.has(m.group_name.trim().toLowerCase())) {
                return `Aturan "${m.source_grade} / ${m.source_subject || '(tanpa subject)'}" menunjuk ke grup "${m.group_name}" yang tidak ada.`;
            }
        }
        return '';
    };

    const handleSave = async () => {
        const problem = validate();
        if (problem) {
            setError(problem);
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onSave(
                draftGroups.map(g => ({
                    name: g.name.trim(),
                    color: g.color,
                    text_color: g.text_color,
                    is_active: g.is_active,
                })),
                draftMappings.map(m => ({
                    source_grade: m.source_grade.trim(),
                    source_subject: m.source_subject.trim(),
                    group_name: m.group_name.trim(),
                    display_subject: m.display_subject.trim(),
                }))
            );
            onClose();
        } catch (e) {
            console.error('Failed to save piket nav config:', e);
            setError(`Gagal menyimpan: ${e.message || 'terjadi kesalahan'}`);
            setSaving(false);
        }
    };

    return (
        <div style={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Atur Navigasi Jadwal Piket</h3>
                    <button style={styles.iconButton} onClick={onClose}>✕</button>
                </div>

                <div style={styles.body}>
                    <h4 style={styles.sectionTitle}>1. Grup navigasi</h4>
                    <p style={styles.hint}>
                        Urutan di sini = urutan tombol "Jump to". Grup yang dinonaktifkan tidak tampil (tombol maupun tabelnya).
                    </p>
                    {draftGroups.map((g, index) => (
                        <div key={g.key} style={styles.row}>
                            <button style={styles.iconButton} onClick={() => moveGroup(index, -1)} disabled={index === 0}>▲</button>
                            <button style={styles.iconButton} onClick={() => moveGroup(index, 1)} disabled={index === draftGroups.length - 1}>▼</button>
                            <input
                                style={{ ...styles.input, flex: 1 }}
                                value={g.name}
                                placeholder="Nama grup"
                                onChange={(e) => renameGroup(g.key, e.target.value)}
                            />
                            <label style={{ fontSize: '12px' }}>
                                Tombol{' '}
                                <input type="color" style={styles.colorInput} value={g.color} onChange={(e) => updateGroup(g.key, { color: e.target.value })} />
                            </label>
                            <label style={{ fontSize: '12px' }}>
                                Teks{' '}
                                <input type="color" style={styles.colorInput} value={g.text_color} onChange={(e) => updateGroup(g.key, { text_color: e.target.value })} />
                            </label>
                            <span style={{ ...styles.preview, backgroundColor: g.color, color: g.text_color, opacity: g.is_active ? 1 : 0.4 }}>
                                {g.name || '...'}
                            </span>
                            <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                                <input type="checkbox" checked={g.is_active} onChange={(e) => updateGroup(g.key, { is_active: e.target.checked })} /> Aktif
                            </label>
                            <button style={styles.deleteButton} onClick={() => removeGroup(g.key)}>Hapus</button>
                        </div>
                    ))}
                    <button style={styles.addButton} onClick={addGroup}>+ Tambah grup</button>

                    <h4 style={{ ...styles.sectionTitle, marginTop: '24px' }}>2. Pemetaan grade & subject → grup</h4>
                    <p style={styles.hint}>
                        Kolom kiri adalah nilai grade dan subject yang tersimpan di data jadwal piket sekarang. Pilih grup tujuannya, dan isi
                        "Subject tampil" kalau namanya perlu diganti (kosong = pakai subject asli). Beberapa aturan boleh menuju grup yang sama.
                        Data yang tidak punya aturan tetap tampil dengan grade aslinya sebagai grup.
                    </p>

                    {unmappedPairs.length > 0 && (
                        <div style={styles.unmappedBox}>
                            <strong>Belum punya aturan:</strong>{' '}
                            {unmappedPairs.map(p => (
                                <button
                                    key={pairKey(p.grade, p.subject)}
                                    style={{ ...styles.iconButton, margin: '2px 4px 2px 0' }}
                                    onClick={() => addMapping({
                                        source_grade: p.grade,
                                        source_subject: p.subject || '',
                                        group_name: draftGroups.find(g => g.name.toLowerCase() === p.grade.toLowerCase())?.name || draftGroups[0]?.name || '',
                                    })}
                                >
                                    + {p.grade} / {p.subject || '(tanpa subject)'}
                                </button>
                            ))}
                        </div>
                    )}

                    <div style={{ ...styles.row, fontSize: '12px', fontWeight: 600, color: '#555' }}>
                        <span style={{ flex: 1 }}>Grade (data)</span>
                        <span style={{ flex: 1 }}>Subject (data)</span>
                        <span style={{ width: '16px' }} />
                        <span style={{ flex: 1.2 }}>Grup tujuan</span>
                        <span style={{ flex: 1 }}>Subject tampil</span>
                        <span style={{ width: '56px' }} />
                    </div>
                    {draftMappings.map(m => (
                        <div key={m.key} style={styles.row}>
                            <input style={{ ...styles.input, flex: 1 }} value={m.source_grade} placeholder="Grade"
                                onChange={(e) => updateMapping(m.key, { source_grade: e.target.value })} />
                            <input style={{ ...styles.input, flex: 1 }} value={m.source_subject} placeholder="Subject"
                                onChange={(e) => updateMapping(m.key, { source_subject: e.target.value })} />
                            <span style={{ width: '16px', textAlign: 'center' }}>→</span>
                            <select style={{ ...styles.input, flex: 1.2 }} value={m.group_name}
                                onChange={(e) => updateMapping(m.key, { group_name: e.target.value })}>
                                {!draftGroups.some(g => g.name === m.group_name) && <option value={m.group_name}>{m.group_name || '(pilih grup)'}</option>}
                                {draftGroups.map(g => <option key={g.key} value={g.name}>{g.name || '(tanpa nama)'}</option>)}
                            </select>
                            <input style={{ ...styles.input, flex: 1 }} value={m.display_subject} placeholder="(sama dengan data)"
                                onChange={(e) => updateMapping(m.key, { display_subject: e.target.value })} />
                            <button style={{ ...styles.deleteButton, width: '56px' }} onClick={() => removeMapping(m.key)}>Hapus</button>
                        </div>
                    ))}
                    <button style={styles.addButton} onClick={() => addMapping()}>+ Tambah aturan</button>
                </div>

                <div style={styles.footer}>
                    {error && <span style={styles.error}>{error}</span>}
                    <button style={styles.secondaryButton} onClick={onClose} disabled={saving}>Batal</button>
                    <button style={styles.primaryButton} onClick={handleSave} disabled={saving}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PiketNavSettings;
