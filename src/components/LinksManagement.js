import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, ExternalLink, FolderOpen, X, Link2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import { usePermissions } from '../contexts/PermissionContext';
import '../styles/LinksManagement.css';

const LinksManagement = () => {
    const { canEdit } = usePermissions();
    const hasEditPermission = canEdit('data_management');

    const [links, setLinks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        category: '',
        title: '',
        file_link: ''
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    // Load data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // Load all links
            const { data: linksData, error: linksError } = await supabase
                .from('file_links')
                .select('*')
                .order('category')
                .order('title');

            if (linksError) throw linksError;

            setLinks(linksData || []);

            // Extract unique categories
            const uniqueCategories = [...new Set(linksData?.map(l => l.category).filter(Boolean))].sort();
            setCategories(uniqueCategories);

        } catch (error) {
            console.error('Error loading links:', error);
            alert('Failed to load links data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter links
    const filteredLinks = links.filter(link => {
        const matchesSearch = !searchQuery ||
            link.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            link.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            link.file_link?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = !selectedCategory || link.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    // Group links by category
    const groupedLinks = filteredLinks.reduce((acc, link) => {
        const category = link.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(link);
        return acc;
    }, {});

    // Generate unique ID
    const generateId = () => {
        return `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        if (!formData.title?.trim()) {
            newErrors.title = 'Title is required';
        }

        if (!formData.file_link?.trim()) {
            newErrors.file_link = 'Link URL is required';
        } else {
            // Basic URL validation
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
    const handleOpenModal = (link = null) => {
        if (link) {
            setEditingId(link.id);
            setFormData({
                category: link.category || '',
                title: link.title || '',
                file_link: link.file_link || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                category: '',
                title: '',
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
        setFormData({ category: '', title: '', file_link: '' });
        setErrors({});
    };

    // Save link
    const handleSave = async () => {
        if (!validateForm()) return;

        try {
            setSaving(true);

            const linkData = {
                category: formData.category.trim() || null,
                title: formData.title.trim(),
                file_link: formData.file_link.trim(),
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from('file_links')
                    .update(linkData)
                    .eq('id', editingId);

                if (error) throw error;
            } else {
                // Create new
                const { error } = await supabase
                    .from('file_links')
                    .insert({
                        id: generateId(),
                        ...linkData,
                        created_at: new Date().toISOString()
                    });

                if (error) throw error;
            }

            handleCloseModal();
            loadData();

        } catch (error) {
            console.error('Error saving link:', error);
            alert('Failed to save link: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Delete link
    const handleDelete = async (id) => {
        try {
            const { error } = await supabase
                .from('file_links')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setDeleteConfirm(null);
            loadData();

        } catch (error) {
            console.error('Error deleting link:', error);
            alert('Failed to delete link: ' + error.message);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
            <div className="links-management">
                <div className="dm-loading">Loading links...</div>
            </div>
        );
    }

    return (
        <div className="links-management">
            {/* Header */}
            <div className="section-header">
                <h2>
                    <Link2 size={24} />
                    File Links Management
                </h2>
                {hasEditPermission && (
                    <button className="dm-btn dm-btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={18} />
                        Add Link
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="links-filters">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by title, category, or URL..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="category-filter">
                    <FolderOpen size={18} />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div className="links-stats">
                    <span>{filteredLinks.length} of {links.length} links</span>
                </div>
            </div>

            {/* Links Display */}
            {Object.keys(groupedLinks).length === 0 ? (
                <div className="links-empty">
                    <Link2 size={48} />
                    <p>No links found</p>
                    {hasEditPermission && (
                        <button className="dm-btn dm-btn-primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} />
                            Add Your First Link
                        </button>
                    )}
                </div>
            ) : (
                <div className="links-grid">
                    {Object.entries(groupedLinks).map(([category, categoryLinks]) => (
                        <div key={category} className="links-category-group">
                            <div className="category-header">
                                <FolderOpen size={18} />
                                <span>{category}</span>
                                <span className="category-count">{categoryLinks.length}</span>
                            </div>

                            <div className="category-links">
                                {categoryLinks.map(link => (
                                    <div key={link.id} className="link-card">
                                        <div className="link-main">
                                            <a
                                                href={link.file_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="link-title"
                                            >
                                                {link.title}
                                                <ExternalLink size={14} />
                                            </a>
                                            <div className="link-url">{getDomain(link.file_link)}</div>
                                        </div>

                                        <div className="link-meta">
                                            <span className="link-date">Updated: {formatDate(link.updated_at)}</span>
                                        </div>

                                        {hasEditPermission && (
                                            <div className="link-actions">
                                                <button
                                                    className="dm-btn-icon"
                                                    onClick={() => handleOpenModal(link)}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="dm-btn-icon delete"
                                                    onClick={() => setDeleteConfirm(link.id)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
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
                    <div className="dm-modal links-modal" onClick={e => e.stopPropagation()}>
                        <div className="dm-modal-header">
                            <h3>{editingId ? 'Edit Link' : 'Add New Link'}</h3>
                            <button className="dm-modal-close" onClick={handleCloseModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="dm-modal-body">
                            <div className="dm-form-group">
                                <label>Category</label>
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="e.g., Documentation, Templates, Resources"
                                    list="category-suggestions"
                                />
                                <datalist id="category-suggestions">
                                    {categories.map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                                <span className="input-help">Leave empty for uncategorized</span>
                            </div>

                            <div className="dm-form-group">
                                <label>Title <span className="required">*</span></label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Enter link title"
                                    className={errors.title ? 'error' : ''}
                                />
                                {errors.title && (
                                    <span className="error-message">
                                        <AlertCircle size={14} />
                                        {errors.title}
                                    </span>
                                )}
                            </div>

                            <div className="dm-form-group">
                                <label>URL <span className="required">*</span></label>
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

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="dm-modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="dm-modal dm-modal-confirm" onClick={e => e.stopPropagation()}>
                        <div className="dm-modal-header">
                            <h3>Delete Link</h3>
                        </div>
                        <div className="dm-modal-body">
                            <p>Are you sure you want to delete this link? This action cannot be undone.</p>
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

export default LinksManagement;
