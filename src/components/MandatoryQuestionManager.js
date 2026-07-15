import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Loader2, ListChecks, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/ImportAssignmentModal.css';
import '../styles/MandatoryQuestionManager.css';
import { supabase } from '../lib/supabaseClient.mjs';
import QuestionFieldCombobox from './QuestionFieldCombobox';

const PAGE_SIZE = 25;

const EMPTY_NEW_QUESTION = {
    reference_id: '',
    question_id: '',
    subject: '',
    grade: '',
    is_mandatory: true,
    week_launched: ''
};

const MandatoryQuestionManager = ({ isOpen, onClose, userEmail, onSaved }) => {
    const [rows, setRows] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showOnlyUnset, setShowOnlyUnset] = useState(true);
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [gradeOptions, setGradeOptions] = useState([]);
    const [savingId, setSavingId] = useState(null);

    const [showAddForm, setShowAddForm] = useState(false);
    const [newQuestion, setNewQuestion] = useState(EMPTY_NEW_QUESTION);
    const [addingQuestion, setAddingQuestion] = useState(false);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // Debounce free-text search so we don't fire a query per keystroke
    useEffect(() => {
        const timeout = setTimeout(() => setSearchTerm(searchInput.trim()), 350);
        return () => clearTimeout(timeout);
    }, [searchInput]);

    // Any filter change invalidates the current page
    useEffect(() => {
        setPage(1);
    }, [searchTerm, showOnlyUnset]);

    const loadFieldOptions = useCallback(async () => {
        const { data, error } = await supabase
            .from('ica_field_options')
            .select('field_name, value');

        if (error) {
            console.error('Error loading field options:', error);
            return;
        }

        const subjects = new Set();
        const grades = new Set();
        (data || []).forEach(opt => {
            if (opt.field_name === 'subject') subjects.add(opt.value);
            if (opt.field_name === 'grade') grades.add(opt.value);
        });
        setSubjectOptions(Array.from(subjects).sort());
        setGradeOptions(Array.from(grades).sort());
    }, []);

    const loadPage = useCallback(async () => {
        try {
            setLoading(true);

            let query = supabase
                .from('ica_questions_with_metadata')
                .select('reference_id, question_id, subject, grade, is_mandatory, week_launched, has_metadata, is_manual', { count: 'exact' });

            if (showOnlyUnset) query = query.eq('has_metadata', false);
            if (searchTerm) {
                query = query.or(`reference_id.ilike.%${searchTerm}%,question_id.ilike.%${searchTerm}%`);
            }

            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.order('reference_id', { ascending: true }).range(from, to);

            const { data, error, count } = await query;
            if (error) throw error;

            setRows((data || []).map(row => ({
                reference_id: row.reference_id,
                question_id: row.question_id || '',
                subject: row.subject || '',
                grade: row.grade || '',
                is_mandatory: row.has_metadata ? row.is_mandatory : true,
                week_launched: row.week_launched ?? '',
                hasMetadata: row.has_metadata,
                isManual: row.is_manual,
                dirty: false
            })));
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error loading question metadata:', error);
            alert('Gagal memuat data soal: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm, showOnlyUnset]);

    useEffect(() => {
        if (isOpen) {
            loadFieldOptions();
        }
    }, [isOpen, loadFieldOptions]);

    useEffect(() => {
        if (isOpen) {
            loadPage();
        }
    }, [isOpen, loadPage]);

    const updateRow = (referenceId, patch) => {
        setRows(prev => prev.map(r =>
            r.reference_id === referenceId ? { ...r, ...patch, dirty: true } : r
        ));
    };

    const createFieldOption = async (fieldName, value) => {
        const { error } = await supabase
            .from('ica_field_options')
            .upsert({ field_name: fieldName, value }, { onConflict: 'field_name,value', ignoreDuplicates: true });

        if (error) {
            console.error(`Error creating ${fieldName} option:`, error);
            return;
        }

        if (fieldName === 'subject') {
            setSubjectOptions(prev => prev.includes(value) ? prev : [...prev, value].sort());
        } else if (fieldName === 'grade') {
            setGradeOptions(prev => prev.includes(value) ? prev : [...prev, value].sort());
        }
    };

    const saveRow = async (row) => {
        setSavingId(row.reference_id);
        try {
            const payload = {
                reference_id: row.reference_id,
                question_id: row.question_id || null,
                subject: row.subject || null,
                grade: row.grade || null,
                is_mandatory: row.is_mandatory,
                week_launched: row.week_launched === '' ? null : parseInt(row.week_launched, 10),
                updated_by: userEmail || null
            };

            const { error } = await supabase
                .from('ica_question_metadata')
                .upsert(payload, { onConflict: 'reference_id' });

            if (error) throw error;

            onSaved?.();
            await loadPage();
        } catch (error) {
            console.error('Error saving question metadata:', error);
            alert('Gagal menyimpan: ' + error.message);
        } finally {
            setSavingId(null);
        }
    };

    const submitNewQuestion = async () => {
        const referenceId = newQuestion.reference_id.trim();
        if (!referenceId) {
            alert('Reference ID wajib diisi');
            return;
        }

        setAddingQuestion(true);
        try {
            const payload = {
                reference_id: referenceId,
                question_id: newQuestion.question_id.trim() || null,
                subject: newQuestion.subject || null,
                grade: newQuestion.grade || null,
                is_mandatory: newQuestion.is_mandatory,
                week_launched: newQuestion.week_launched === '' ? null : parseInt(newQuestion.week_launched, 10),
                updated_by: userEmail || null
            };

            const { error } = await supabase
                .from('ica_question_metadata')
                .upsert(payload, { onConflict: 'reference_id' });

            if (error) throw error;

            setNewQuestion(EMPTY_NEW_QUESTION);
            setShowAddForm(false);
            onSaved?.();
            await loadPage();
        } catch (error) {
            console.error('Error adding manual question:', error);
            alert('Gagal menambah soal: ' + error.message);
        } finally {
            setAddingQuestion(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="import-modal-overlay">
            <div className="import-modal-content mqm-modal-content">
                <div className="import-modal-header">
                    <h3 className="import-modal-title">
                        <ListChecks size={20} />
                        Kelola Soal Wajib (Mandatory)
                    </h3>
                    <button className="import-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="import-modal-body mqm-body">
                    <p className="mqm-hint">
                        Soal yang ada di daftar ini masih dianggap <strong>Non-Mandatory</strong>.
                        Segera isi record yang tersedia, jika checklist maka <strong>Mandatory</strong>. Jika questions tidak ada atau belum tersinkron dengan database, maka silakan klik button <strong>Tambah Soal Baru</strong>.
                    </p>

                    <div className="mqm-toolbar">
                        <div className="mqm-search">
                            <Search size={16} className="mqm-search-icon" />
                            <input
                                type="text"
                                placeholder="Cari reference_id / question_id..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                        </div>
                        <label className="mqm-toggle">
                            <input
                                type="checkbox"
                                checked={showOnlyUnset}
                                onChange={(e) => setShowOnlyUnset(e.target.checked)}
                            />
                            Hanya tampilkan yang belum diisi
                        </label>
                        <button
                            type="button"
                            className="mqm-add-toggle-btn"
                            onClick={() => setShowAddForm(v => !v)}
                        >
                            <Plus size={14} />
                            Tambah Soal Baru
                        </button>
                    </div>

                    {showAddForm && (
                        <div className="mqm-add-form">
                            <div className="mqm-add-form-grid">
                                <input
                                    type="text"
                                    placeholder="Reference ID *"
                                    value={newQuestion.reference_id}
                                    onChange={(e) => setNewQuestion(q => ({ ...q, reference_id: e.target.value }))}
                                />
                                <input
                                    type="text"
                                    placeholder="Question ID (opsional)"
                                    value={newQuestion.question_id}
                                    onChange={(e) => setNewQuestion(q => ({ ...q, question_id: e.target.value }))}
                                />
                                <QuestionFieldCombobox
                                    value={newQuestion.subject}
                                    options={subjectOptions}
                                    onChange={(val) => setNewQuestion(q => ({ ...q, subject: val }))}
                                    onCreateOption={(val) => createFieldOption('subject', val)}
                                    placeholder="Pilih subject"
                                />
                                <QuestionFieldCombobox
                                    value={newQuestion.grade}
                                    options={gradeOptions}
                                    onChange={(val) => setNewQuestion(q => ({ ...q, grade: val }))}
                                    onCreateOption={(val) => createFieldOption('grade', val)}
                                    placeholder="Pilih grade"
                                />
                                <label className="mqm-toggle">
                                    <input
                                        type="checkbox"
                                        checked={newQuestion.is_mandatory}
                                        onChange={(e) => setNewQuestion(q => ({ ...q, is_mandatory: e.target.checked }))}
                                    />
                                    Mandatory
                                </label>
                                <input
                                    type="number"
                                    className="mqm-week-input"
                                    placeholder="Week"
                                    min="1"
                                    value={newQuestion.week_launched}
                                    onChange={(e) => setNewQuestion(q => ({ ...q, week_launched: e.target.value }))}
                                />
                            </div>
                            <div className="mqm-add-form-actions">
                                <button
                                    type="button"
                                    className="import-button cancel"
                                    onClick={() => { setShowAddForm(false); setNewQuestion(EMPTY_NEW_QUESTION); }}
                                    disabled={addingQuestion}
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    className="import-button primary"
                                    onClick={submitNewQuestion}
                                    disabled={addingQuestion}
                                >
                                    {addingQuestion ? <Loader2 size={14} className="mqm-spin" /> : 'Simpan Soal Baru'}
                                </button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="mqm-loading">
                            <Loader2 size={24} className="mqm-spin" />
                            <span>Memuat data soal...</span>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="mqm-empty">
                            {showOnlyUnset
                                ? 'Semua soal sudah diisi statusnya. Matikan filter untuk melihat/mengubah semua soal.'
                                : 'Tidak ada soal yang cocok.'}
                        </div>
                    ) : (
                        <>
                            <div className="mqm-table-scroll">
                                <table className="mqm-table">
                                    <thead>
                                        <tr>
                                            <th>Reference ID</th>
                                            <th>Question ID</th>
                                            <th>Subject</th>
                                            <th>Grade</th>
                                            <th>Mandatory</th>
                                            <th>Week Launched</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(row => (
                                            <tr key={row.reference_id} className={row.hasMetadata ? '' : 'mqm-row-unset'}>
                                                <td className="mqm-mono">{row.reference_id}</td>
                                                <td className="mqm-mono">
                                                    {row.question_id}
                                                    {row.isManual && <span className="mqm-manual-badge">Manual</span>}
                                                </td>
                                                <td>
                                                    <QuestionFieldCombobox
                                                        value={row.subject}
                                                        options={subjectOptions}
                                                        onChange={(val) => updateRow(row.reference_id, { subject: val })}
                                                        onCreateOption={(val) => createFieldOption('subject', val)}
                                                        placeholder="Pilih subject"
                                                    />
                                                </td>
                                                <td>
                                                    <QuestionFieldCombobox
                                                        value={row.grade}
                                                        options={gradeOptions}
                                                        onChange={(val) => updateRow(row.reference_id, { grade: val })}
                                                        onCreateOption={(val) => createFieldOption('grade', val)}
                                                        placeholder="Pilih grade"
                                                    />
                                                </td>
                                                <td className="mqm-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.is_mandatory}
                                                        onChange={(e) => updateRow(row.reference_id, { is_mandatory: e.target.checked })}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="mqm-week-input"
                                                        min="1"
                                                        value={row.week_launched}
                                                        onChange={(e) => updateRow(row.reference_id, { week_launched: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="mqm-save-btn"
                                                        disabled={!row.dirty || savingId === row.reference_id}
                                                        onClick={() => saveRow(row)}
                                                    >
                                                        {savingId === row.reference_id ? (
                                                            <Loader2 size={14} className="mqm-spin" />
                                                        ) : row.hasMetadata ? 'Update' : 'Simpan'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mqm-pagination">
                                <span className="mqm-pagination-info">
                                    Halaman {page} dari {totalPages} &middot; {totalCount} soal
                                </span>
                                <div className="mqm-pagination-buttons">
                                    <button
                                        type="button"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                    >
                                        <ChevronLeft size={16} />
                                        Sebelumnya
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                    >
                                        Selanjutnya
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="import-modal-footer">
                    <button className="import-button cancel" onClick={onClose}>Tutup</button>
                </div>
            </div>
        </div>
    );
};

export default MandatoryQuestionManager;
