import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, ExternalLink, X, Tag, AlertCircle, Upload } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import '../styles/KeywordsManagement.css';

const KeywordsManagement = () => {
    const { canEdit } = usePermissions();
    const hasEditPermission = canEdit('data_management');

    const [keywords, setKeywords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        keyword: '',
        file_link: ''
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    // Bulk import state
    const [bulkData, setBulkData] = useState('');
    const [bulkErrors, setBulkErrors] = useState([]);
    const [bulkSaving, setBulkSaving] = useState(false);

    // Load data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            const { data: keywordsData, error: keywordsError } = await supabase
                .from('keywords')
                .select('*')
                .order('keyword');

            if (keywordsError) throw keywordsError;

            setKeywords(keywordsData || []);

        } catch (error) {
            console.error('Error loading keywords:', error);
            alert('Failed to load keywords data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter keywords
    const filteredKeywords = keywords.filter(kw => {
        const matchesSearch = !searchQuery ||
            kw.keyword?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            kw.file_link?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesSearch;
    });

    // Group keywords alphabetically
    const groupedKeywords = filteredKeywords.reduce((acc, kw) => {
        const firstLetter = (kw.keyword?.[0] || '#').toUpperCase();
        const key = /[A-Z]/.test(firstLetter) ? firstLetter : '#';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(kw);
        return acc;
    }, {});

    // Sort groups alphabetically
    const sortedGroups = Object.keys(groupedKeywords).sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
    });

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        if (!formData.keyword?.trim()) {
            newErrors.keyword = 'Keyword is required';
        }

        if (!formData.file_link?.trim()) {
            newErrors.file_link = 'Link URL is required';
        } else {
            try {
                new URL(formData.file_link);
            } catch {
                newErrors.file_link = 'Please enter a valid URL';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Open modal
    const handleOpenModal = (keyword = null) => {
        if (keyword) {
            setEditingId(keyword.id);
            setFormData({
                keyword: keyword.keyword || '',
                file_link: keyword.file_link || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                keyword: '',
                file_link: ''
            });
        }
        setErrors({});
        setShowModal(true);
    };

    // Close modal
    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData({ keyword: '', file_link: '' });
        setErrors({});
    };

    // Save keyword
    const handleSave = async () => {
        if (!validateForm()) return;

        try {
            setSaving(true);

            const keywordData = {
                keyword: formData.keyword.trim(),
                file_link: formData.file_link.trim(),
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                const { error } = await supabase
                    .from('keywords')
                    .update(keywordData)
                    .eq('id', editingId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('keywords')
                    .insert({
                        ...keywordData,
                        created_at: new Date().toISOString()
                    });

                if (error) throw error;
            }

            handleCloseModal();
            loadData();

        } catch (error) {
            console.error('Error saving keyword:', error);
            alert('Failed to save keyword: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Delete keyword
    const handleDelete = async (id) => {
        try {
            const { error } = await supabase
                .from('keywords')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setDeleteConfirm(null);
            loadData();

        } catch (error) {
            console.error('Error deleting keyword:', error);
            alert('Failed to delete keyword: ' + error.message);
        }
    };

    // Bulk import handlers
    const handleOpenBulkModal = () => {
        setBulkData('');
        setBulkErrors([]);
        setShowBulkModal(true);
    };

    const handleCloseBulkModal = () => {
        setShowBulkModal(false);
        setBulkData('');
        setBulkErrors([]);
    };

    const handleBulkImport = async () => {
        try {
            setBulkSaving(true);
            setBulkErrors([]);

            // Parse JSON
            let parsedData;
            try {
                parsedData = JSON.parse(bulkData);
            } catch {
                setBulkErrors(['Invalid JSON format. Please check your data.']);
                setBulkSaving(false);
                return;
            }

            if (!Array.isArray(parsedData)) {
                setBulkErrors(['Data must be an array of objects with "keyword" and "file_link" properties.']);
                setBulkSaving(false);
                return;
            }

            // Validate each entry
            const errors = [];
            const validEntries = [];

            parsedData.forEach((item, index) => {
                if (!item.keyword?.trim()) {
                    errors.push(`Row ${index + 1}: Missing keyword`);
                } else if (!item.file_link?.trim()) {
                    errors.push(`Row ${index + 1}: Missing file_link`);
                } else {
                    try {
                        new URL(item.file_link);
                        validEntries.push({
                            keyword: item.keyword.trim(),
                            file_link: item.file_link.trim(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    } catch {
                        errors.push(`Row ${index + 1}: Invalid URL for "${item.keyword}"`);
                    }
                }
            });

            if (errors.length > 0) {
                setBulkErrors(errors);
                setBulkSaving(false);
                return;
            }

            if (validEntries.length === 0) {
                setBulkErrors(['No valid entries found.']);
                setBulkSaving(false);
                return;
            }

            // Insert all valid entries
            const { error } = await supabase
                .from('keywords')
                .insert(validEntries);

            if (error) throw error;

            handleCloseBulkModal();
            loadData();
            alert(`Successfully imported ${validEntries.length} keywords.`);

        } catch (error) {
            console.error('Error bulk importing:', error);
            setBulkErrors([`Import failed: ${error.message}`]);
        } finally {
            setBulkSaving(false);
        }
    };

    // Get domain from URL
    const getDomain = (url) => {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch {
            return url;
        }
    };

    if (loading) {
        return (
            <div className="keywords-management">
                <div className="dm-loading">Loading keywords...</div>
            </div>
        );
    }

    return (
        <div className="keywords-management">
            {/* Header */}
            <div className="section-header">
                <h2>
                    <Tag size={24} />
                    Keywords Management
                </h2>
                {hasEditPermission && (
                    <div className="header-actions">
                        <button className="dm-btn dm-btn-secondary" onClick={handleOpenBulkModal}>
                            <Upload size={18} />
                            Bulk Import
                        </button>
                        <button className="dm-btn dm-btn-primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} />
                            Add Keyword
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="keywords-filters">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search keywords..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="keywords-stats">
                    <span>{filteredKeywords.length} of {keywords.length} keywords</span>
                </div>
            </div>

            {/* Keywords Display */}
            {sortedGroups.length === 0 ? (
                <div className="keywords-empty">
                    <Tag size={48} />
                    <p>No keywords found</p>
                    {hasEditPermission && (
                        <button className="dm-btn dm-btn-primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} />
                            Add Your First Keyword
                        </button>
                    )}
                </div>
            ) : (
                <div className="keywords-grid">
                    {sortedGroups.map(letter => (
                        <div key={letter} className="keywords-letter-group">
                            <div className="letter-header">
                                <span className="letter-badge">{letter}</span>
                                <span className="letter-count">{groupedKeywords[letter].length}</span>
                            </div>

                            <div className="letter-keywords">
                                {groupedKeywords[letter].map(kw => (
                                    <div key={kw.id} className="keyword-card">
                                        <div className="keyword-main">
                                            <span className="keyword-text">{kw.keyword}</span>
                                            <a
                                                href={kw.file_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="keyword-link"
                                            >
                                                {getDomain(kw.file_link)}
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>

                                        {hasEditPermission && (
                                            <div className="keyword-actions">
                                                <button
                                                    className="dm-btn-icon"
                                                    onClick={() => handleOpenModal(kw)}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    className="dm-btn-icon delete"
                                                    onClick={() => setDeleteConfirm(kw.id)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="dm-modal-overlay" onClick={handleCloseModal}>
                    <div className="dm-modal" onClick={e => e.stopPropagation()}>
                        <div className="dm-modal-header">
                            <h3>{editingId ? 'Edit Keyword' : 'Add New Keyword'}</h3>
                            <button className="dm-modal-close" onClick={handleCloseModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="dm-modal-body">
                            <div className="dm-form-group">
                                <label>Keyword <span className="required">*</span></label>
                                <input
                                    type="text"
                                    value={formData.keyword}
                                    onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                                    placeholder="Enter keyword"
                                    className={errors.keyword ? 'error' : ''}
                                />
                                {errors.keyword && (
                                    <span className="error-message">
                                        <AlertCircle size={14} />
                                        {errors.keyword}
                                    </span>
                                )}
                            </div>

                            <div className="dm-form-group">
                                <label>File Link <span className="required">*</span></label>
                                <input
                                    type="url"
                                    value={formData.file_link}
                                    onChange={(e) => setFormData({ ...formData, file_link: e.target.value })}
                                    placeholder="https://example.com/file"
                                    className={errors.file_link ? 'error' : ''}
                                />
                                {errors.file_link && (
                                    <span className="error-message">
                                        <AlertCircle size={14} />
                                        {errors.file_link}
                                    </span>
                                )}
                            </div>

                            {formData.file_link && !errors.file_link && (
                                <div className="link-preview">
                                    <span>Preview:</span>
                                    <a
                                        href={formData.file_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {getDomain(formData.file_link)}
                                        <ExternalLink size={12} />
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="dm-modal-footer">
                            <button className="dm-btn dm-btn-secondary" onClick={handleCloseModal}>
                                Cancel
                            </button>
                            <button
                                className="dm-btn dm-btn-primary"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkModal && (
                <div className="dm-modal-overlay" onClick={handleCloseBulkModal}>
                    <div className="dm-modal dm-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="dm-modal-header">
                            <h3>Bulk Import Keywords</h3>
                            <button className="dm-modal-close" onClick={handleCloseBulkModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="dm-modal-body">
                            <div className="bulk-import-info">
                                <p>Paste JSON array with objects containing "keyword" and "file_link" properties:</p>
                                <pre className="json-example">{`[
  { "keyword": "Example 1", "file_link": "https://example.com/1" },
  { "keyword": "Example 2", "file_link": "https://example.com/2" }
]`}</pre>
                            </div>

                            <div className="dm-form-group">
                                <label>JSON Data <span className="required">*</span></label>
                                <textarea
                                    value={bulkData}
                                    onChange={(e) => setBulkData(e.target.value)}
                                    placeholder='[{ "keyword": "...", "file_link": "..." }]'
                                    rows={10}
                                    className={bulkErrors.length > 0 ? 'error' : ''}
                                />
                            </div>

                            {bulkErrors.length > 0 && (
                                <div className="bulk-errors">
                                    <strong>Errors:</strong>
                                    <ul>
                                        {bulkErrors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="dm-modal-footer">
                            <button className="dm-btn dm-btn-secondary" onClick={handleCloseBulkModal}>
                                Cancel
                            </button>
                            <button
                                className="dm-btn dm-btn-primary"
                                onClick={handleBulkImport}
                                disabled={bulkSaving || !bulkData.trim()}
                            >
                                {bulkSaving ? 'Importing...' : 'Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="dm-modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="dm-modal dm-modal-confirm" onClick={e => e.stopPropagation()}>
                        <div className="dm-modal-header">
                            <h3>Delete Keyword</h3>
                        </div>
                        <div className="dm-modal-body">
                            <p>Are you sure you want to delete this keyword? This action cannot be undone.</p>
                        </div>
                        <div className="dm-modal-footer">
                            <button className="dm-btn dm-btn-secondary" onClick={() => setDeleteConfirm(null)}>
                                Cancel
                            </button>
                            <button className="dm-btn dm-btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KeywordsManagement;
