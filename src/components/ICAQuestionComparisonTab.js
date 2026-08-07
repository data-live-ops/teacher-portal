import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/InClassAssessment.css'; // .cell-with-copy / .copy-btn used by the matrix's copy buttons
import { supabase } from '../lib/supabaseClient.mjs';
import { fetchAllRows } from './ICAAnalyticsTab';

const RESULT_TABS = [
    { key: 'matrix', label: 'Student Comparison Matrix' },
    { key: 'flow', label: 'Understanding Flow' },
    { key: 'pattern', label: 'Student Pattern Breakdown' },
];

// 4-way classification. A missing row for a student+question splits into two
// different meanings that must NOT be conflated:
//   - 'Not Attempted': the question WAS launched to this student's own
//     grade+slot (a classmate has a row for it), but this student has none -
//     they personally missed/skipped it (present-but-no-answer, or absent).
//   - 'Not Launched': this question was never launched to this student's
//     grade+slot at all (no one in that class has a row for it either) -
//     it simply doesn't apply to them, which is a different situation from
//     "attempted or not". Comparing e.g. a Grade 10-only question against a
//     Grade 4-only question would otherwise show every Grade 10 student as
//     "Not Attempted" on the Grade 4 question, which is misleading.
const STATUS_ORDER = ['Full', 'No', 'Not Attempted', 'Not Launched'];
const STATUS_COLOR = { Full: '#16a34a', No: '#dc2626', 'Not Attempted': '#94a3b8', 'Not Launched': '#475569' };
// 'Not Launched' renders italic wherever it's shown as a pill, matching the
// existing INACTIVE-vs-ABSENT convention on the Dashboard tab (italic = the
// row doesn't apply to this student, plain = it applies but has no data).
const STATUS_PILL_STYLE = (status) => ({
    backgroundColor: `${STATUS_COLOR[status]}1a`,
    color: STATUS_COLOR[status],
    fontStyle: status === 'Not Launched' ? 'italic' : 'normal',
});
const STATUS_LABEL = { Full: 'Full Understanding', No: 'No Understanding', 'Not Attempted': 'Not Attempted', 'Not Launched': 'Not Launched' };

// ============================================================================
// Question Comparison: pick 2+ question IDs and see how student understanding
// transitions from one to the next (Full -> No, No -> Full, etc.), across
// every grade/slot the questions were launched in. Order is entirely
// user-controlled (selection order, adjustable via the up/down buttons) - not
// auto-inferred from week_launched/session_date, even though the comparison
// is conceptually a chronological progression.
// ============================================================================
const QuestionComparison = () => {
    // Grade filter - must be picked before the question picker appears, so
    // the question list only ever offers questions actually launched in that
    // grade (avoids nonsensical cross-grade comparisons).
    const [grades, setGrades] = useState([]);
    const [loadingGrades, setLoadingGrades] = useState(true);
    const [selectedGrade, setSelectedGrade] = useState('');

    // reference_ids actually launched in the selected grade, sourced from
    // ica_student_assessments (ground truth of what was launched) rather than
    // ica_question_metadata (only holds questions the curriculum team has
    // manually reviewed/tagged, and its own `grade` column is a free-text
    // curriculum label, not the real grade_list - not reliable for filtering).
    const [gradeQuestionRefIds, setGradeQuestionRefIds] = useState([]);
    const [loadingGradeQuestions, setLoadingGradeQuestions] = useState(false);

    // Applied between Grade and the question search - Grade -> Question Type -> Question ID
    const [questionTypeFilter, setQuestionTypeFilter] = useState('all'); // 'all' | 'mandatory' | 'non_mandatory'

    const [activeResultTab, setActiveResultTab] = useState('matrix');

    // ica_question_metadata is still loaded, purely to enrich the picker with
    // subject/mandatory/week_launched labels when available - not as the
    // source of which reference_ids are selectable.
    const [allQuestions, setAllQuestions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedQuestions, setSelectedQuestions] = useState([]); // ordered reference_id[] - this order IS the comparison order

    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [matrixSearch, setMatrixSearch] = useState('');

    useEffect(() => {
        (async () => {
            try {
                setLoadingGrades(true);
                const data = await fetchAllRows(() =>
                    supabase.from('ica_grade_slots').select('grade_list').order('grade_list')
                );
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

        (async () => {
            try {
                const data = await fetchAllRows(() =>
                    supabase
                        .from('ica_question_metadata')
                        .select('reference_id, subject, grade, is_mandatory, week_launched')
                        .order('reference_id')
                );
                setAllQuestions(data || []);
            } catch (err) {
                console.error('Error loading question metadata:', err);
            }
        })();
    }, []);

    // Picking a grade resets any in-progress selection - it belonged to a
    // different (or no) grade scope and would otherwise let a stale
    // cross-grade comparison linger.
    const handleGradeChange = (grade) => {
        setSelectedGrade(grade);
        setSelectedQuestions([]);
        setSearchTerm('');
    };

    useEffect(() => {
        if (!selectedGrade) {
            setGradeQuestionRefIds([]);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                setLoadingGradeQuestions(true);
                const data = await fetchAllRows(() =>
                    supabase
                        .from('ica_student_assessments')
                        .select('reference_id')
                        .eq('grade_list', selectedGrade)
                        .order('id')
                );
                if (!cancelled) setGradeQuestionRefIds([...new Set((data || []).map(r => r.reference_id))]);
            } catch (err) {
                console.error('Error loading questions for grade:', err);
                if (!cancelled) setGradeQuestionRefIds([]);
            } finally {
                if (!cancelled) setLoadingGradeQuestions(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedGrade]);

    const dropdownOptions = useMemo(() => {
        if (!selectedGrade) return [];
        const metaMap = new Map(allQuestions.map(q => [q.reference_id, q]));
        let pool = gradeQuestionRefIds
            .filter(refId => !selectedQuestions.includes(refId))
            .map(refId => metaMap.get(refId) ?? { reference_id: refId });

        // A reference_id absent from ica_question_metadata is treated as
        // Non-Mandatory by convention (same default used on the Dashboard tab).
        if (questionTypeFilter === 'mandatory') pool = pool.filter(q => q.is_mandatory === true);
        else if (questionTypeFilter === 'non_mandatory') pool = pool.filter(q => q.is_mandatory !== true);

        const term = searchTerm.trim().toLowerCase();
        const filtered = !term
            ? pool
            : pool.filter(q =>
                q.reference_id.toLowerCase().includes(term) ||
                (q.subject && q.subject.toLowerCase().includes(term))
            );
        return filtered.sort((a, b) => a.reference_id.localeCompare(b.reference_id)).slice(0, 30);
    }, [allQuestions, gradeQuestionRefIds, selectedQuestions, searchTerm, selectedGrade, questionTypeFilter]);

    // Appends to the end - the dropdown intentionally stays open (unlike the
    // single-select combobox in QuestionsBreakdown) so users can add several
    // questions back-to-back without re-opening it each time.
    const handleAddQuestion = (refId) => {
        setSelectedQuestions(prev => (prev.includes(refId) ? prev : [...prev, refId]));
        setSearchTerm('');
    };

    const handleRemoveQuestion = (refId) => {
        setSelectedQuestions(prev => prev.filter(id => id !== refId));
    };

    const handleMoveUp = (index) => {
        if (index <= 0) return;
        setSelectedQuestions(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const handleMoveDown = (index) => {
        setSelectedQuestions(prev => {
            if (index >= prev.length - 1) return prev;
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    };

    const handleClearAll = () => setSelectedQuestions([]);

    useEffect(() => {
        if (selectedQuestions.length < 2) {
            setAssessments([]);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchAllRows(() =>
                    supabase
                        .from('ica_student_assessments')
                        .select('user_id, student_name, grade_list, slot_name, reference_id, session_date, understanding_types')
                        .in('reference_id', selectedQuestions)
                        .order('id') // required: .range() pagination is unstable without a deterministic order
                );
                if (!cancelled) setAssessments(data || []);
            } catch (err) {
                console.error('Error loading comparison data:', err);
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedQuestions]);

    // Core aggregation: dedupe -> per-row (student x grade x slot) status
    // vector -> matrix rows, per-stage counts (Sankey node sizing), per-stage
    // transitions (Sankey ribbons), full-path counts (pattern table).
    const { matrixRows, stageCounts, transitions, pathTable, totalStudents } = useMemo(() => {
        if (selectedQuestions.length < 2 || assessments.length === 0) {
            return { matrixRows: [], stageCounts: [], transitions: [], pathTable: [], totalStudents: 0 };
        }

        // ica_student_assessments only enforces UNIQUE(user_id, reference_id,
        // session_date, question_id) - the same student+question pair can have
        // more than one row if the question was administered again in a later
        // session (retake/remediation). Keep the most recent attempt as the
        // student's "current" understanding for that question.
        const latestByRowQuestion = new Map();
        // A student's grade/slot can theoretically differ across rows (moved
        // slots, or the same reference_id reused in a different class) - key
        // rows by (user_id, grade, slot) rather than user_id alone, so each
        // grade/slot combination gets its own matrix row instead of silently
        // merging into one.
        const rowKeyOf = (row) => `${row.user_id}||${row.grade_list}||${row.slot_name}`;
        const rowMeta = new Map(); // rowKey -> { user_id, student_name, grade, slot }

        assessments.forEach(row => {
            const rk = rowKeyOf(row);
            if (!rowMeta.has(rk)) {
                rowMeta.set(rk, { user_id: row.user_id, student_name: row.student_name, grade: row.grade_list, slot_name: row.slot_name });
            }
            const key = `${rk}||${row.reference_id}`;
            const existing = latestByRowQuestion.get(key);
            if (!existing || row.session_date > existing.session_date) {
                latestByRowQuestion.set(key, row);
            }
        });

        // Which (grade, slot, reference_id) combinations were actually
        // launched at all - i.e. at least one classmate has a row for it.
        // Used to tell "this student's class never got this question"
        // ('Not Launched') apart from "this student personally has no answer
        // for a question their class did get" ('Not Attempted').
        const launchedCombos = new Set();
        assessments.forEach(row => {
            launchedCombos.add(`${row.grade_list}||${row.slot_name}||${row.reference_id}`);
        });

        const classifyForRow = (row, meta, refId) => {
            if (row?.understanding_types === 'Full Understanding') return 'Full';
            if (row?.understanding_types === 'No Understanding') return 'No';
            const launchedToThisClass = launchedCombos.has(`${meta.grade}||${meta.slot_name}||${refId}`);
            return launchedToThisClass ? 'Not Attempted' : 'Not Launched';
        };

        // Every (student, grade, slot) row that attempted ANY of the selected
        // questions is included - a missing question at a given position gets
        // 'Not Attempted'/'Not Launched' there instead of being dropped, so
        // partial attempts still show up.
        const vectors = new Map(); // rowKey -> status[]
        rowMeta.forEach((meta, rk) => {
            const vector = selectedQuestions.map(refId => {
                const row = latestByRowQuestion.get(`${rk}||${refId}`);
                return classifyForRow(row, meta, refId);
            });
            vectors.set(rk, vector);
        });

        const matrixRows = Array.from(rowMeta.entries())
            .map(([rk, meta]) => ({ ...meta, statuses: vectors.get(rk) }))
            .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));

        const stageCounts = selectedQuestions.map(() => {
            const counts = new Map(STATUS_ORDER.map(s => [s, 0]));
            return counts;
        });
        vectors.forEach(vector => {
            vector.forEach((status, i) => {
                stageCounts[i].set(status, stageCounts[i].get(status) + 1);
            });
        });

        const transitions = [];
        for (let i = 0; i < selectedQuestions.length - 1; i++) {
            const counts = new Map();
            vectors.forEach(vector => {
                const key = `${vector[i]}->${vector[i + 1]}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            });
            transitions.push(counts);
        }

        const pathCounts = new Map();
        vectors.forEach(vector => {
            const key = vector.join('|');
            pathCounts.set(key, (pathCounts.get(key) ?? 0) + 1);
        });
        const pathTable = Array.from(pathCounts.entries())
            .map(([key, count]) => ({ path: key.split('|'), count }))
            .sort((a, b) => b.count - a.count);

        return { matrixRows, stageCounts, transitions, pathTable, totalStudents: vectors.size };
    }, [assessments, selectedQuestions]);

    const selectedMeta = useMemo(() => {
        const map = new Map(allQuestions.map(q => [q.reference_id, q]));
        return selectedQuestions.map(refId => map.get(refId) ?? { reference_id: refId });
    }, [allQuestions, selectedQuestions]);

    const filteredMatrixRows = useMemo(() => {
        const term = matrixSearch.trim().toLowerCase();
        if (!term) return matrixRows;
        return matrixRows.filter(r =>
            r.user_id?.toLowerCase().includes(term) ||
            r.student_name?.toLowerCase().includes(term) ||
            String(r.grade ?? '').toLowerCase().includes(term) ||
            r.slot_name?.toLowerCase().includes(term)
        );
    }, [matrixRows, matrixSearch]);

    return (
        <div className="table-container">
            <div className="header-actions" style={{ marginBottom: 16 }}>
                <div className="filter-group">
                    <span className="filter-label">Grade</span>
                    <select
                        value={selectedGrade}
                        onChange={(e) => handleGradeChange(e.target.value)}
                        className="filter-select"
                        disabled={loadingGrades}
                    >
                        <option value="">{loadingGrades ? 'Loading grades...' : 'Select Grade'}</option>
                        {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>

                {selectedGrade && (
                    <div className="filter-group">
                        <span className="filter-label">Question Type</span>
                        <select
                            value={questionTypeFilter}
                            onChange={(e) => setQuestionTypeFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Questions</option>
                            <option value="mandatory">Mandatory Only</option>
                            <option value="non_mandatory">Non-Mandatory Only</option>
                        </select>
                    </div>
                )}

                {selectedGrade && (
                    <div className="filter-group ica-question-search-group">
                        <span className="filter-label">Add Question</span>
                        <div className="ica-question-search-wrap">
                            <input
                                type="text"
                                className="search-input ica-question-search-input"
                                placeholder={loadingGradeQuestions ? 'Loading questions...' : 'Type reference ID or subject...'}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                                onFocus={() => setShowDropdown(true)}
                                onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                                disabled={loadingGradeQuestions}
                            />
                            {showDropdown && dropdownOptions.length > 0 && (
                                <ul className="ica-question-dropdown">
                                    {dropdownOptions.map(q => (
                                        <li
                                            key={q.reference_id}
                                            className="ica-question-dropdown-item"
                                            onMouseDown={() => handleAddQuestion(q.reference_id)}
                                        >
                                            <code className="ica-ref-id">{q.reference_id}</code>
                                            {q.subject && <span className="ica-question-dropdown-subject">{q.subject}</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
                {selectedQuestions.length > 0 && (
                    // .header-actions centers items on the cross-axis, but the filter-group
                    // siblings are taller (label + input stacked) - align this bare button
                    // to the bottom so it lines up with the input/select row, not the labels.
                    <button className="dropdown-button" onClick={handleClearAll} style={{ alignSelf: 'flex-end' }}>Clear All</button>
                )}
            </div>

            {!selectedGrade && (
                <div className="empty-state"><p>Choose grade first to see in detail for questions list</p></div>
            )}

            {selectedQuestions.length > 0 && (
                <div className="ica-compare-chip-list">
                    {selectedMeta.map((q, index) => (
                        <div key={q.reference_id} className="ica-compare-chip">
                            <span className="ica-compare-chip-order">{index + 1}</span>
                            <code className="ica-ref-id">{q.reference_id}</code>
                            {q.subject && <span className="ica-compare-chip-subject">{q.subject}</span>}
                            <div className="ica-compare-chip-actions">
                                <button
                                    type="button"
                                    className="ica-compare-chip-btn"
                                    onClick={() => handleMoveUp(index)}
                                    disabled={index === 0}
                                    title="Move earlier"
                                    aria-label="Move earlier"
                                >↑</button>
                                <button
                                    type="button"
                                    className="ica-compare-chip-btn"
                                    onClick={() => handleMoveDown(index)}
                                    disabled={index === selectedMeta.length - 1}
                                    title="Move later"
                                    aria-label="Move later"
                                >↓</button>
                                <button
                                    type="button"
                                    className="ica-compare-chip-btn ica-compare-chip-remove"
                                    onClick={() => handleRemoveQuestion(q.reference_id)}
                                    title="Remove"
                                    aria-label="Remove"
                                >✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!selectedGrade ? null : selectedQuestions.length < 2 ? (
                <div className="empty-state"><p>Pilih minimal 2 soal (question ID) untuk membandingkan performa siswa antar soal. Urutan mengikuti urutan kamu memilih - bisa disusun ulang pakai tombol ↑↓.</p></div>
            ) : loading ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">Loading comparison data...</div>
                </div>
            ) : error ? (
                <div className="empty-state"><p>Failed to load: {error}</p></div>
            ) : totalStudents === 0 ? (
                <div className="empty-state"><p>No assessment data found for the selected questions.</p></div>
            ) : (
                <>
                    <div className="tab-navigation" style={{ marginBottom: 16 }}>
                        {RESULT_TABS.map(tab => (
                            <button
                                key={tab.key}
                                className={`tab-button ${activeResultTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveResultTab(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeResultTab === 'matrix' && (
                        <ComparisonMatrix
                            selectedQuestions={selectedQuestions}
                            rows={filteredMatrixRows}
                            totalRows={matrixRows.length}
                            searchTerm={matrixSearch}
                            onSearchChange={setMatrixSearch}
                        />
                    )}
                    {activeResultTab === 'flow' && (
                        <ComparisonSankey selectedQuestions={selectedQuestions} stageCounts={stageCounts} transitions={transitions} totalStudents={totalStudents} />
                    )}
                    {activeResultTab === 'pattern' && (
                        <PathTable selectedQuestions={selectedQuestions} pathTable={pathTable} totalStudents={totalStudents} />
                    )}
                </>
            )}
        </div>
    );
};

// ============================================================================
// Per-student matrix: one row per (student, grade, slot), one column per
// selected question showing that student's status. This is the raw
// drill-down view - the Sankey/pattern table below give the aggregate
// picture, this answers "which specific students went from Full to No".
// ============================================================================
const MATRIX_PAGE_SIZE = 10;

const ComparisonMatrix = ({ selectedQuestions, rows, totalRows, searchTerm, onSearchChange }) => {
    const [page, setPage] = useState(1);
    const [copiedId, setCopiedId] = useState(null);

    // Jump back to page 1 whenever the underlying row set changes (new
    // search term, newly loaded data) - otherwise a filtered-down result
    // could land the user on a now-nonexistent page.
    useEffect(() => { setPage(1); }, [rows]);

    const totalPages = Math.max(1, Math.ceil(rows.length / MATRIX_PAGE_SIZE));
    const pageRows = useMemo(() => {
        const from = (page - 1) * MATRIX_PAGE_SIZE;
        return rows.slice(from, from + MATRIX_PAGE_SIZE);
    }, [rows, page]);

    const copyToClipboard = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="table-container" style={{ marginBottom: 24 }}>
            <div className="table-header">
                <h3>Student Comparison Matrix</h3>
                <p>{rows.length} of {totalRows} student{totalRows !== 1 ? 's' : ''}{searchTerm ? ' (filtered)' : ''}</p>
            </div>

            <div className="header-actions" style={{ marginBottom: 12 }}>
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search by name, user ID, grade, or slot..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="empty-state"><p>No students match this search.</p></div>
            ) : (
                <>
                    <div className="ica-table-scroll">
                        <table className="assignment-table">
                            <thead>
                                <tr>
                                    <th>User ID</th>
                                    <th>Name</th>
                                    <th>Grade</th>
                                    <th>Slot</th>
                                    {selectedQuestions.map((refId) => (
                                        <th key={refId}>{refId}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((row, idx) => (
                                    <tr key={`${row.user_id}-${row.grade}-${row.slot_name}-${idx}`}>
                                        <td>
                                            <div className="cell-with-copy">
                                                <span title={row.user_id}>{row.user_id?.substring(0, 8)}...</span>
                                                <button
                                                    className="copy-btn"
                                                    onClick={() => copyToClipboard(row.user_id, `id-${row.user_id}`)}
                                                    title="Copy full ID"
                                                >
                                                    {copiedId === `id-${row.user_id}` ? <Check size={12} /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="cell-with-copy">
                                                <span>{row.student_name || '-'}</span>
                                                <button
                                                    className="copy-btn"
                                                    onClick={() => copyToClipboard(row.student_name || '', `name-${row.user_id}`)}
                                                    title="Copy name"
                                                >
                                                    {copiedId === `name-${row.user_id}` ? <Check size={12} /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td>{row.grade || '-'}</td>
                                        <td>{row.slot_name || '-'}</td>
                                        {row.statuses.map((status, i) => (
                                            <td key={i}>
                                                <span
                                                    className="ica-compare-status-pill"
                                                    style={STATUS_PILL_STYLE(status)}
                                                >
                                                    {STATUS_LABEL[status]}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="ica-compare-pagination">
                        <span className="ica-compare-pagination-info">Page {page} of {totalPages}</span>
                        <div className="ica-compare-pagination-buttons">
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                <ChevronLeft size={16} />
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Next
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ============================================================================
// Supporting table: exact counts per full status pattern (e.g.
// Full -> No -> Full: 12 students) - built before the Sankey chart during
// implementation as a correctness check, kept as a permanent feature since
// exact numbers are hard to read off a flow diagram.
// ============================================================================
const PathTable = ({ selectedQuestions, pathTable, totalStudents }) => (
    <div className="table-container" style={{ marginTop: 24 }}>
        <div className="table-header">
            <h3>Student Pattern Breakdown</h3>
            <p>{pathTable.length} distinct pattern{pathTable.length !== 1 ? 's' : ''} across {totalStudents} students</p>
        </div>
        <div className="ica-table-scroll">
            <table className="assignment-table">
                <thead>
                    <tr>
                        {selectedQuestions.map((refId, i) => (
                            <th key={refId}>{refId}</th>
                        ))}
                        <th>Students</th>
                        <th>%</th>
                    </tr>
                </thead>
                <tbody>
                    {pathTable.map((row, idx) => (
                        <tr key={idx}>
                            {row.path.map((status, i) => (
                                <td key={i}>
                                    <span
                                        className="ica-compare-status-pill"
                                        style={STATUS_PILL_STYLE(status)}
                                    >
                                        {STATUS_LABEL[status]}
                                    </span>
                                </td>
                            ))}
                            <td>{row.count}</td>
                            <td>{((row.count / totalStudents) * 100).toFixed(1)}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

// ============================================================================
// Sankey-style flow chart, hand-rolled SVG following the same conventions as
// DumbbellChart elsewhere in this file (viewBox + manual coordinate math, no
// chart library). Generalized to N stages (not hardcoded to 2/3) since more
// than 2 questions is an explicit requirement. Node height per stage is
// proportional to student count in each status - since every student has
// exactly one status at every stage, the total height is the same constant
// across all stages ("conservation of flow"), which is what makes this a
// Sankey rather than 3 independent bar charts.
// ============================================================================
const ComparisonSankey = ({ selectedQuestions, stageCounts, transitions, totalStudents }) => {
    const stageCount = selectedQuestions.length;
    const colWidth = 280;
    const nodeWidth = 24;
    const padLeft = 110;
    const padRight = 110;
    const padTop = 64;
    const padBottom = 40;
    const height = 640;
    const plotHeight = height - padTop - padBottom;
    const plotWidth = padLeft + padRight + colWidth * (stageCount - 1);
    const pxPerStudent = totalStudents > 0 ? plotHeight / totalStudents : 0;

    const xForStage = (stageIndex) => padLeft + stageIndex * colWidth;

    // One node list per stage: y0/y1 stacked in STATUS_ORDER, height scaled by
    // pxPerStudent so all stages sum to the same plotHeight.
    const stagesNodes = useMemo(() => {
        return selectedQuestions.map((_, stageIdx) => {
            let cursor = padTop;
            return STATUS_ORDER.map(status => {
                const count = stageCounts[stageIdx]?.get(status) ?? 0;
                const h = count * pxPerStudent;
                const node = { status, count, y0: cursor, y1: cursor + h };
                cursor += h;
                return node;
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedQuestions, stageCounts, pxPerStudent]);

    // Ribbons between each pair of consecutive stages. Within a stage-pair,
    // outgoing links from one fromStatus node are stacked contiguously (in
    // STATUS_ORDER of their destination), and incoming links into one
    // toStatus node are stacked contiguously in the order their source was
    // visited - the standard Sankey stacking algorithm, run once per
    // (stageIndex, fromStatus) pair so it naturally supports any stageCount.
    const ribbons = useMemo(() => {
        const result = [];
        for (let i = 0; i < stageCount - 1; i++) {
            const fromNodes = stagesNodes[i];
            const toNodes = stagesNodes[i + 1];
            const fromCursor = new Map(fromNodes.map(n => [n.status, n.y0]));
            const toCursor = new Map(toNodes.map(n => [n.status, n.y0]));

            STATUS_ORDER.forEach(fromStatus => {
                STATUS_ORDER.forEach(toStatus => {
                    const count = transitions[i]?.get(`${fromStatus}->${toStatus}`) ?? 0;
                    if (count === 0) return;
                    const h = count * pxPerStudent;

                    const y0out = fromCursor.get(fromStatus);
                    const y1out = y0out + h;
                    fromCursor.set(fromStatus, y1out);

                    const y0in = toCursor.get(toStatus);
                    const y1in = y0in + h;
                    toCursor.set(toStatus, y1in);

                    result.push({ stage: i, fromStatus, toStatus, y0out, y1out, y0in, y1in, count });
                });
            });
        }
        return result;
    }, [stageCount, stagesNodes, transitions, pxPerStudent]);

    if (totalStudents === 0) {
        return <span className="ica-analytics-no-data">No data to chart</span>;
    }

    return (
        <div className="table-container">
            <div className="table-header">
                <h3>Understanding Flow</h3>
                <p>{totalStudents} students across {stageCount} questions</p>
            </div>

            <div className="ica-sankey-legend">
                {STATUS_ORDER.map(status => (
                    <span key={status} className="ica-sankey-legend-item">
                        <i className="ica-sankey-swatch" style={{ backgroundColor: STATUS_COLOR[status] }} />
                        {STATUS_LABEL[status]}
                    </span>
                ))}
            </div>

            <div className="ica-table-scroll">
                <div className="ica-sankey-center">
                    <svg
                        width={plotWidth}
                        height={height}
                        viewBox={`0 0 ${plotWidth} ${height}`}
                        className="ica-sankey-chart"
                        role="img"
                        aria-label={`Understanding flow across ${stageCount} questions for ${totalStudents} students`}
                    >
                    {ribbons.map((r, idx) => {
                        const x0 = xForStage(r.stage) + nodeWidth;
                        const x1 = xForStage(r.stage + 1);
                        const xMid = (x0 + x1) / 2;
                        const d = `M${x0},${r.y0out} C${xMid},${r.y0out} ${xMid},${r.y0in} ${x1},${r.y0in} `
                            + `L${x1},${r.y1in} C${xMid},${r.y1in} ${xMid},${r.y1out} ${x0},${r.y1out} Z`;
                        return (
                            <path key={idx} d={d} fill={STATUS_COLOR[r.fromStatus]} fillOpacity={0.32} stroke="none">
                                <title>{`${STATUS_LABEL[r.fromStatus]} → ${STATUS_LABEL[r.toStatus]}: ${r.count} students`}</title>
                            </path>
                        );
                    })}

                    {selectedQuestions.map((refId, stageIdx) => (
                        <text
                            key={`label-${refId}`}
                            x={xForStage(stageIdx) + nodeWidth / 2}
                            y={padTop - 24}
                            textAnchor="middle"
                            fontSize="15"
                            fontWeight="600"
                            fill="#334155"
                        >
                            {refId}
                        </text>
                    ))}

                    {stagesNodes.map((nodes, stageIdx) => (
                        <g key={stageIdx}>
                            {nodes.map(node => (
                                node.count > 0 && (
                                    <g key={node.status}>
                                        <rect
                                            x={xForStage(stageIdx)}
                                            y={node.y0}
                                            width={nodeWidth}
                                            height={node.y1 - node.y0}
                                            fill={STATUS_COLOR[node.status]}
                                        >
                                            <title>{`${STATUS_LABEL[node.status]}: ${node.count} students`}</title>
                                        </rect>
                                        {(node.y1 - node.y0) > 18 && (
                                            <text
                                                x={xForStage(stageIdx) + nodeWidth + 8}
                                                y={(node.y0 + node.y1) / 2 + 5}
                                                fontSize="13"
                                                fill="#475569"
                                            >
                                                {node.count}
                                            </text>
                                        )}
                                    </g>
                                )
                            ))}
                        </g>
                    ))}
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default QuestionComparison;
