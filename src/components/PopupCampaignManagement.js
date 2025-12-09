import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Megaphone,
    Plus,
    Edit2,
    Trash2,
    X,
    Upload,
    Calendar,
    Clock,
    Eye,
    EyeOff,
    ExternalLink,
    Image as ImageIcon,
    AlertCircle,
    CheckCircle,
    Loader,
    Copy,
    Monitor
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import '../styles/PopupCampaignManagement.css';

const TARGET_PAGES = [
    { id: 'home', label: 'Home', description: 'Homepage / Dashboard' },
    { id: 'individual_schedule', label: 'Individual Schedule', description: 'Personal schedule page' },
    { id: 'piket_schedule', label: 'Piket Schedule', description: 'Piket schedule page' },
    { id: 'teacher_assignment', label: 'Teacher Assignment', description: 'Assignment management page' },
    { id: 'teacher_utilization', label: 'Teacher Utilization', description: 'Utilization metrics page' },
    { id: 'data_management', label: 'Data Management', description: 'Admin data management page' }
];

const DISPLAY_TYPES = [
    {
        id: 'dismissible',
        label: 'Dismissible',
        description: 'User can close the popup with X button'
    },
    {
        id: 'minimizable',
        label: 'Minimizable',
        description: 'User can only minimize to bubble icon, cannot fully close'
    }
];

const SCHEDULE_TYPES = [
    {
        id: 'one_time',
        label: 'One Time',
        description: 'Show between specific start and end date/time'
    },
    {
        id: 'daily',
        label: 'Daily',
        description: 'Show every day during specified time window'
    },
    {
        id: 'weekly',
        label: 'Weekly',
        description: 'Show on specific days of the week'
    }
];

const DAYS_OF_WEEK = [
    { id: 0, label: 'Minggu', short: 'Min' },
    { id: 1, label: 'Senin', short: 'Sen' },
    { id: 2, label: 'Selasa', short: 'Sel' },
    { id: 3, label: 'Rabu', short: 'Rab' },
    { id: 4, label: 'Kamis', short: 'Kam' },
    { id: 5, label: 'Jumat', short: 'Jum' },
    { id: 6, label: 'Sabtu', short: 'Sab' }
];

const PopupCampaignManagement = ({ currentUserEmail }) => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image_url: '',
        bubble_icon_url: '',
        click_url: '',
        display_type: 'dismissible',
        target_pages: ['home'],
        // Schedule fields
        schedule_type: 'one_time',
        start_date: '',
        start_time: '00:00',
        end_date: '',
        end_time: '23:59',
        // Recurring fields
        recurring_days: [],
        recurring_start_time: '08:00',
        recurring_end_time: '17:00',
        is_active: true,
        priority: 0
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadingBubbleIcon, setUploadingBubbleIcon] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewBubbleIcon, setPreviewBubbleIcon] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const fileInputRef = useRef(null);
    const bubbleIconInputRef = useRef(null);

    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('popup_campaigns')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCampaigns(data || []);
        } catch (err) {
            console.error('Error fetching campaigns:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const formatDateTime = (isoString) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getCampaignStatus = (campaign) => {
        if (!campaign.is_active) return { status: 'inactive', label: 'Inactive', className: 'status-inactive' };

        const now = new Date();
        const start = new Date(campaign.start_datetime);
        const end = new Date(campaign.end_datetime);

        if (now < start) return { status: 'scheduled', label: 'Scheduled', className: 'status-scheduled' };
        if (now > end) return { status: 'expired', label: 'Expired', className: 'status-expired' };
        return { status: 'active', label: 'Active', className: 'status-active' };
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            image_url: '',
            bubble_icon_url: '',
            click_url: '',
            display_type: 'dismissible',
            target_pages: ['home'],
            schedule_type: 'one_time',
            start_date: '',
            start_time: '00:00',
            end_date: '',
            end_time: '23:59',
            recurring_days: [],
            recurring_start_time: '08:00',
            recurring_end_time: '17:00',
            is_active: true,
            priority: 0
        });
        setPreviewImage('');
        setPreviewBubbleIcon('');
        setErrors({});
        setEditingCampaign(null);
    };

    // Open modal for new campaign
    const handleAdd = () => {
        resetForm();
        setShowModal(true);
    };

    // Open modal for editing
    const handleEdit = (campaign) => {
        const startDate = new Date(campaign.start_datetime);
        const endDate = new Date(campaign.end_datetime);

        // Format for date input (YYYY-MM-DD)
        const formatDateInput = (date) => {
            const jakartaDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
            return jakartaDate.toISOString().split('T')[0];
        };

        // Format for time input (HH:MM)
        const formatTimeInput = (date) => {
            const jakartaDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
            return jakartaDate.toTimeString().slice(0, 5);
        };

        setFormData({
            name: campaign.name,
            description: campaign.description || '',
            image_url: campaign.image_url,
            bubble_icon_url: campaign.bubble_icon_url || '',
            click_url: campaign.click_url || '',
            display_type: campaign.display_type,
            target_pages: campaign.target_pages || ['home'],
            schedule_type: campaign.schedule_type || 'one_time',
            start_date: formatDateInput(startDate),
            start_time: formatTimeInput(startDate),
            end_date: formatDateInput(endDate),
            end_time: formatTimeInput(endDate),
            recurring_days: campaign.recurring_days || [],
            recurring_start_time: campaign.recurring_start_time || '08:00',
            recurring_end_time: campaign.recurring_end_time || '17:00',
            is_active: campaign.is_active,
            priority: campaign.priority || 0
        });
        setPreviewImage(campaign.image_url);
        setPreviewBubbleIcon(campaign.bubble_icon_url || '');
        setEditingCampaign(campaign);
        setShowModal(true);
    };

    // Delete campaign
    const handleDelete = async (campaign) => {
        if (!window.confirm(`Are you sure you want to delete campaign "${campaign.name}"?`)) {
            return;
        }

        try {
            // Delete image from storage if exists
            if (campaign.image_url && campaign.image_url.includes('popup-campaigns')) {
                const imagePath = campaign.image_url.split('popup-campaigns/')[1];
                if (imagePath) {
                    await supabase.storage.from('popup-campaigns').remove([imagePath]);
                }
            }

            const { error } = await supabase
                .from('popup_campaigns')
                .delete()
                .eq('id', campaign.id);

            if (error) throw error;

            setSuccessMessage('Campaign deleted successfully');
            setTimeout(() => setSuccessMessage(''), 3000);
            fetchCampaigns();
        } catch (err) {
            console.error('Error deleting campaign:', err);
            alert('Failed to delete campaign: ' + err.message);
        }
    };

    // Toggle active status
    const handleToggleActive = async (campaign) => {
        try {
            const { error } = await supabase
                .from('popup_campaigns')
                .update({ is_active: !campaign.is_active })
                .eq('id', campaign.id);

            if (error) throw error;
            fetchCampaigns();
        } catch (err) {
            console.error('Error toggling campaign status:', err);
            alert('Failed to update campaign status');
        }
    };

    // Handle file upload (main image)
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setErrors({ ...errors, image_url: 'Please upload a valid image (JPG, PNG, GIF, or WebP)' });
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setErrors({ ...errors, image_url: 'Image size must be less than 5MB' });
            return;
        }

        setUploading(true);
        try {
            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `campaigns/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('popup-campaigns')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('popup-campaigns')
                .getPublicUrl(filePath);

            setFormData({ ...formData, image_url: publicUrl });
            setPreviewImage(publicUrl);
            setErrors({ ...errors, image_url: '' });
        } catch (err) {
            console.error('Error uploading image:', err);
            setErrors({ ...errors, image_url: 'Failed to upload image: ' + err.message });
        } finally {
            setUploading(false);
        }
    };

    // Handle bubble icon upload
    const handleBubbleIconUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setErrors({ ...errors, bubble_icon_url: 'Please upload a valid image (JPG, PNG, GIF, or WebP)' });
            return;
        }

        // Validate file size (max 2MB for icon)
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            setErrors({ ...errors, bubble_icon_url: 'Icon size must be less than 2MB' });
            return;
        }

        setUploadingBubbleIcon(true);
        try {
            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_icon_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `campaigns/icons/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('popup-campaigns')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('popup-campaigns')
                .getPublicUrl(filePath);

            setFormData({ ...formData, bubble_icon_url: publicUrl });
            setPreviewBubbleIcon(publicUrl);
            setErrors({ ...errors, bubble_icon_url: '' });
        } catch (err) {
            console.error('Error uploading bubble icon:', err);
            setErrors({ ...errors, bubble_icon_url: 'Failed to upload icon: ' + err.message });
        } finally {
            setUploadingBubbleIcon(false);
        }
    };

    // Clear bubble icon
    const handleClearBubbleIcon = () => {
        setFormData({ ...formData, bubble_icon_url: '' });
        setPreviewBubbleIcon('');
    };

    // Handle form input change
    const handleInputChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    // Handle target pages toggle
    const handleTargetPageToggle = (pageId) => {
        const currentPages = formData.target_pages;
        if (currentPages.includes(pageId)) {
            if (currentPages.length > 1) {
                setFormData({
                    ...formData,
                    target_pages: currentPages.filter(p => p !== pageId)
                });
            }
        } else {
            setFormData({
                ...formData,
                target_pages: [...currentPages, pageId]
            });
        }
    };

    // Handle recurring days toggle
    const handleRecurringDayToggle = (dayId) => {
        const currentDays = formData.recurring_days || [];
        if (currentDays.includes(dayId)) {
            setFormData({
                ...formData,
                recurring_days: currentDays.filter(d => d !== dayId)
            });
        } else {
            setFormData({
                ...formData,
                recurring_days: [...currentDays, dayId].sort((a, b) => a - b)
            });
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Campaign name is required';
        }

        if (!formData.image_url.trim()) {
            newErrors.image_url = 'Campaign image is required';
        }

        if (formData.target_pages.length === 0) {
            newErrors.target_pages = 'At least one target page is required';
        }

        // Validate based on schedule type
        if (formData.schedule_type === 'one_time') {
            if (!formData.start_date) {
                newErrors.start_date = 'Start date is required';
            }
            if (!formData.end_date) {
                newErrors.end_date = 'End date is required';
            }
            // Validate date range
            if (formData.start_date && formData.end_date) {
                const startDateTime = new Date(`${formData.start_date}T${formData.start_time}:00`);
                const endDateTime = new Date(`${formData.end_date}T${formData.end_time}:00`);
                if (endDateTime <= startDateTime) {
                    newErrors.end_date = 'End date/time must be after start date/time';
                }
            }
        } else if (formData.schedule_type === 'weekly') {
            if (!formData.recurring_days || formData.recurring_days.length === 0) {
                newErrors.recurring_days = 'Please select at least one day';
            }
        }

        // Validate recurring time window
        if (formData.schedule_type !== 'one_time') {
            if (formData.recurring_start_time >= formData.recurring_end_time) {
                newErrors.recurring_end_time = 'End time must be after start time';
            }
        }

        // Validate URL format if provided
        if (formData.click_url && formData.click_url.trim()) {
            try {
                new URL(formData.click_url);
            } catch {
                newErrors.click_url = 'Please enter a valid URL';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save campaign
    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            // For one_time, use the date range; for recurring, set a far future end date
            let startDateTimeStr, endDateTimeStr;

            if (formData.schedule_type === 'one_time') {
                startDateTimeStr = `${formData.start_date}T${formData.start_time}:00+07:00`;
                endDateTimeStr = `${formData.end_date}T${formData.end_time}:00+07:00`;
            } else {
                // For recurring schedules, set start to now and end to far future
                const now = new Date();
                startDateTimeStr = now.toISOString();
                endDateTimeStr = '2099-12-31T23:59:59+07:00';
            }

            const campaignData = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                image_url: formData.image_url.trim(),
                bubble_icon_url: formData.bubble_icon_url.trim() || null,
                click_url: formData.click_url.trim() || null,
                display_type: formData.display_type,
                target_pages: formData.target_pages,
                schedule_type: formData.schedule_type,
                start_datetime: startDateTimeStr,
                end_datetime: endDateTimeStr,
                recurring_days: formData.schedule_type === 'weekly' ? formData.recurring_days : null,
                recurring_start_time: formData.schedule_type !== 'one_time' ? formData.recurring_start_time : null,
                recurring_end_time: formData.schedule_type !== 'one_time' ? formData.recurring_end_time : null,
                is_active: formData.is_active,
                priority: parseInt(formData.priority) || 0
            };

            if (editingCampaign) {
                const updateData = {
                    ...campaignData,
                    updated_by: currentUserEmail
                }
                const { error } = await supabase
                    .from('popup_campaigns')
                    .update(updateData)
                    .eq('id', editingCampaign.id);

                if (error) throw error;
                setSuccessMessage('Campaign updated successfully');
            } else {
                const { error } = await supabase
                    .from('popup_campaigns')
                    .insert([{
                        ...campaignData,
                        created_by: currentUserEmail
                    }]);

                if (error) throw error;
                setSuccessMessage('Campaign created successfully');
            }

            setTimeout(() => setSuccessMessage(''), 3000);
            setShowModal(false);
            resetForm();
            fetchCampaigns();
        } catch (err) {
            console.error('Error saving campaign:', err);
            alert('Failed to save campaign: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Duplicate campaign
    const handleDuplicate = (campaign) => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        setFormData({
            name: `${campaign.name} (Copy)`,
            description: campaign.description || '',
            image_url: campaign.image_url,
            bubble_icon_url: campaign.bubble_icon_url || '',
            click_url: campaign.click_url || '',
            display_type: campaign.display_type,
            target_pages: campaign.target_pages || ['home'],
            schedule_type: campaign.schedule_type || 'one_time',
            start_date: now.toISOString().split('T')[0],
            start_time: '00:00',
            end_date: tomorrow.toISOString().split('T')[0],
            end_time: '23:59',
            recurring_days: campaign.recurring_days || [],
            recurring_start_time: campaign.recurring_start_time || '08:00',
            recurring_end_time: campaign.recurring_end_time || '17:00',
            is_active: false,
            priority: campaign.priority || 0
        });
        setPreviewImage(campaign.image_url);
        setPreviewBubbleIcon(campaign.bubble_icon_url || '');
        setEditingCampaign(null);
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="dm-loading-container">
                <div className="dm-loading-spinner"></div>
                <div className="dm-loading-text">Loading campaigns...</div>
            </div>
        );
    }

    return (
        <div className="management-section popup-campaign-management">
            <div className="section-header">
                <h2>
                    <Megaphone size={24} />
                    Popup Campaigns
                </h2>
                <button className="dm-btn-primary" onClick={handleAdd}>
                    <Plus size={18} />
                    Add Campaign
                </button>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="success-banner">
                    <CheckCircle size={18} />
                    {successMessage}
                </div>
            )}

            {/* Campaigns Table */}
            {campaigns.length === 0 ? (
                <div className="empty-state">
                    <Megaphone size={48} />
                    <p>No popup campaigns yet</p>
                    <button className="dm-btn-primary" onClick={handleAdd}>
                        <Plus size={18} />
                        Create First Campaign
                    </button>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="management-table campaigns-table">
                        <thead>
                            <tr>
                                <th>Preview</th>
                                <th>Campaign Name</th>
                                <th>Display Type</th>
                                <th>Schedule Type</th>
                                <th>Target Pages</th>
                                <th>Schedule</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map(campaign => {
                                const statusInfo = getCampaignStatus(campaign);
                                return (
                                    <tr key={campaign.id}>
                                        <td>
                                            <div className="campaign-preview-cell">
                                                <img
                                                    src={campaign.image_url}
                                                    alt={campaign.name}
                                                    className="campaign-thumbnail"
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="campaign-name-cell">
                                                <strong>{campaign.name}</strong>
                                                {campaign.description && (
                                                    <span className="campaign-description">{campaign.description}</span>
                                                )}
                                                {campaign.click_url && (
                                                    <a
                                                        href={campaign.click_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="campaign-link"
                                                    >
                                                        <ExternalLink size={12} />
                                                        Link
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`display-type-badge ${campaign.display_type}`}>
                                                {campaign.display_type === 'dismissible' ? 'Dismissible' : 'Minimizable'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`schedule-type-badge ${campaign.schedule_type || 'one_time'}`}>
                                                {campaign.schedule_type === 'daily' ? 'Daily' :
                                                    campaign.schedule_type === 'weekly' ? 'Weekly' : 'One Time'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="target-pages-cell">
                                                {campaign.target_pages?.map(page => (
                                                    <span key={page} className="page-badge">
                                                        {TARGET_PAGES.find(p => p.id === page)?.label || page}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="schedule-cell">
                                                {(campaign.schedule_type === 'one_time' || !campaign.schedule_type) ? (
                                                    <>
                                                        <div className="schedule-row">
                                                            <Calendar size={12} />
                                                            {formatDateTime(campaign.start_datetime)}
                                                        </div>
                                                        <div className="schedule-row">
                                                            <span className="schedule-to">to</span>
                                                        </div>
                                                        <div className="schedule-row">
                                                            <Calendar size={12} />
                                                            {formatDateTime(campaign.end_datetime)}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {campaign.schedule_type === 'weekly' && campaign.recurring_days && (
                                                            <div className="schedule-row">
                                                                <span className="recurring-days-display">
                                                                    {campaign.recurring_days
                                                                        .map(d => DAYS_OF_WEEK.find(day => day.id === d)?.label)
                                                                        .join(', ')}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {campaign.schedule_type === 'daily' && (
                                                            <div className="schedule-row">
                                                                <span className="recurring-days-display">Every day</span>
                                                            </div>
                                                        )}
                                                        <div className="schedule-row">
                                                            <Clock size={12} />
                                                            <span>
                                                                {campaign.recurring_start_time?.slice(0, 5) || '00:00'} - {campaign.recurring_end_time?.slice(0, 5) || '23:59'}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`dm-status-badge ${statusInfo.className}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="priority-badge">{campaign.priority}</span>
                                        </td>
                                        <td>
                                            <div className="dm-action-buttons">
                                                <button
                                                    className="dm-btn-icon dm-btn-edit"
                                                    onClick={() => handleToggleActive(campaign)}
                                                    title={campaign.is_active ? 'Deactivate' : 'Activate'}
                                                >
                                                    {campaign.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                                <button
                                                    className="dm-btn-icon"
                                                    onClick={() => handleDuplicate(campaign)}
                                                    title="Duplicate"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    className="dm-btn-icon dm-btn-edit"
                                                    onClick={() => handleEdit(campaign)}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="dm-btn-icon dm-btn-delete"
                                                    onClick={() => handleDelete(campaign)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="data-mgmt-modal-overlay">
                    <div className="data-mgmt-modal-content data-mgmt-modal-large campaign-modal">
                        <div className="data-mgmt-modal-header">
                            <h3>
                                <Megaphone size={20} />
                                {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
                            </h3>
                            <button className="dm-btn-icon" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="campaign-modal-body">
                            {/* Basic Info Section */}
                            <div className="form-section">
                                <h4>Campaign Information</h4>
                                <div className="form-grid">
                                    <div className="dm-form-group full-width">
                                        <label>Campaign Name *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            placeholder="e.g., Holiday Promo December 2024"
                                            className={errors.name ? 'error' : ''}
                                        />
                                        {errors.name && <span className="error-message">{errors.name}</span>}
                                    </div>

                                    <div className="dm-form-group full-width">
                                        <label>Description (Optional)</label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) => handleInputChange('description', e.target.value)}
                                            placeholder="Brief description for internal reference"
                                        />
                                    </div>

                                    <div className="dm-form-group full-width">
                                        <label>Click URL (Optional)</label>
                                        <input
                                            type="url"
                                            value={formData.click_url}
                                            onChange={(e) => handleInputChange('click_url', e.target.value)}
                                            placeholder="https://example.com/promo"
                                            className={errors.click_url ? 'error' : ''}
                                        />
                                        {errors.click_url && <span className="error-message">{errors.click_url}</span>}
                                        <small className="input-help">URL to open when user clicks the popup image</small>
                                    </div>
                                </div>
                            </div>

                            {/* Image Upload Section */}
                            <div className="form-section">
                                <h4>Campaign Image *</h4>
                                <div className="image-upload-section">
                                    <div className="image-upload-controls">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            accept="image/jpeg,image/png,image/gif,image/webp"
                                            style={{ display: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            className="dm-btn-secondary"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader size={16} className="spinning" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={16} />
                                                    Upload Image
                                                </>
                                            )}
                                        </button>
                                        <span className="upload-hint">or enter URL directly</span>
                                    </div>
                                    <div className="dm-form-group">
                                        <input
                                            type="url"
                                            value={formData.image_url}
                                            onChange={(e) => {
                                                handleInputChange('image_url', e.target.value);
                                                setPreviewImage(e.target.value);
                                            }}
                                            placeholder="https://example.com/image.png"
                                            className={errors.image_url ? 'error' : ''}
                                        />
                                        {errors.image_url && <span className="error-message">{errors.image_url}</span>}
                                    </div>
                                    {previewImage && (
                                        <div className="image-preview">
                                            <img src={previewImage} alt="Preview" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Display Type Section */}
                            <div className="form-section">
                                <h4>Display Behavior</h4>
                                <div className="display-type-options">
                                    {DISPLAY_TYPES.map(type => (
                                        <label
                                            key={type.id}
                                            className={`display-type-option ${formData.display_type === type.id ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="display_type"
                                                value={type.id}
                                                checked={formData.display_type === type.id}
                                                onChange={(e) => handleInputChange('display_type', e.target.value)}
                                            />
                                            <div className="display-type-content">
                                                <strong>{type.label}</strong>
                                                <span>{type.description}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {/* Bubble Icon Upload - only show for minimizable type */}
                                {formData.display_type === 'minimizable' && (
                                    <div className="bubble-icon-section">
                                        <h5>Bubble Icon (Optional)</h5>
                                        <p className="input-help">
                                            Custom icon for the minimized bubble. If not set, the main campaign image will be used.
                                        </p>
                                        <div className="bubble-icon-upload">
                                            <div className="bubble-icon-controls">
                                                <input
                                                    type="file"
                                                    ref={bubbleIconInputRef}
                                                    onChange={handleBubbleIconUpload}
                                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                                    style={{ display: 'none' }}
                                                />
                                                <button
                                                    type="button"
                                                    className="dm-btn-secondary dm-btn-sm"
                                                    onClick={() => bubbleIconInputRef.current?.click()}
                                                    disabled={uploadingBubbleIcon}
                                                >
                                                    {uploadingBubbleIcon ? (
                                                        <>
                                                            <Loader size={14} className="spinning" />
                                                            Uploading...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={14} />
                                                            Upload Icon
                                                        </>
                                                    )}
                                                </button>
                                                {formData.bubble_icon_url && (
                                                    <button
                                                        type="button"
                                                        className="dm-btn-secondary dm-btn-sm"
                                                        onClick={handleClearBubbleIcon}
                                                    >
                                                        <X size={14} />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="dm-form-group">
                                                <input
                                                    type="url"
                                                    value={formData.bubble_icon_url}
                                                    onChange={(e) => {
                                                        handleInputChange('bubble_icon_url', e.target.value);
                                                        setPreviewBubbleIcon(e.target.value);
                                                    }}
                                                    placeholder="Or enter URL directly"
                                                    className={errors.bubble_icon_url ? 'error' : ''}
                                                />
                                                {errors.bubble_icon_url && <span className="error-message">{errors.bubble_icon_url}</span>}
                                            </div>
                                            {previewBubbleIcon && (
                                                <div className="bubble-icon-preview">
                                                    <img src={previewBubbleIcon} alt="Bubble Icon Preview" />
                                                    <span>Bubble Preview</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Target Pages Section */}
                            <div className="form-section">
                                <h4>Target Pages *</h4>
                                {errors.target_pages && <span className="error-message">{errors.target_pages}</span>}
                                <div className="target-pages-grid">
                                    {TARGET_PAGES.map(page => (
                                        <label
                                            key={page.id}
                                            className={`target-page-option ${formData.target_pages.includes(page.id) ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.target_pages.includes(page.id)}
                                                onChange={() => handleTargetPageToggle(page.id)}
                                            />
                                            <Monitor size={16} />
                                            <div className="page-option-content">
                                                <strong>{page.label}</strong>
                                                <span>{page.description}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Schedule Section */}
                            <div className="form-section">
                                <h4>Schedule (Asia/Jakarta Time)</h4>

                                {/* Schedule Type Selection */}
                                <div className="schedule-type-options">
                                    {SCHEDULE_TYPES.map(type => (
                                        <label
                                            key={type.id}
                                            className={`schedule-type-option ${formData.schedule_type === type.id ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="schedule_type"
                                                value={type.id}
                                                checked={formData.schedule_type === type.id}
                                                onChange={(e) => handleInputChange('schedule_type', e.target.value)}
                                            />
                                            <div className="schedule-type-content">
                                                <strong>{type.label}</strong>
                                                <span>{type.description}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {/* One Time Schedule */}
                                {formData.schedule_type === 'one_time' && (
                                    <div className="schedule-inputs">
                                        <div className="schedule-group">
                                            <label>Start Date & Time *</label>
                                            <div className="datetime-inputs">
                                                <div className="dm-form-group">
                                                    <input
                                                        type="date"
                                                        value={formData.start_date}
                                                        onChange={(e) => handleInputChange('start_date', e.target.value)}
                                                        className={errors.start_date ? 'error' : ''}
                                                    />
                                                </div>
                                                <div className="dm-form-group">
                                                    <input
                                                        type="time"
                                                        value={formData.start_time}
                                                        onChange={(e) => handleInputChange('start_time', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            {errors.start_date && <span className="error-message">{errors.start_date}</span>}
                                        </div>

                                        <div className="schedule-group">
                                            <label>End Date & Time *</label>
                                            <div className="datetime-inputs">
                                                <div className="dm-form-group">
                                                    <input
                                                        type="date"
                                                        value={formData.end_date}
                                                        onChange={(e) => handleInputChange('end_date', e.target.value)}
                                                        className={errors.end_date ? 'error' : ''}
                                                    />
                                                </div>
                                                <div className="dm-form-group">
                                                    <input
                                                        type="time"
                                                        value={formData.end_time}
                                                        onChange={(e) => handleInputChange('end_time', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            {errors.end_date && <span className="error-message">{errors.end_date}</span>}
                                        </div>
                                    </div>
                                )}

                                {/* Weekly Schedule - Day Selection */}
                                {formData.schedule_type === 'weekly' && (
                                    <div className="recurring-days-section">
                                        <label>Select Days *</label>
                                        {errors.recurring_days && <span className="error-message">{errors.recurring_days}</span>}
                                        <div className="days-of-week-grid">
                                            {DAYS_OF_WEEK.map(day => (
                                                <label
                                                    key={day.id}
                                                    className={`day-option ${(formData.recurring_days || []).includes(day.id) ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={(formData.recurring_days || []).includes(day.id)}
                                                        onChange={() => handleRecurringDayToggle(day.id)}
                                                    />
                                                    <span className="day-short">{day.short}</span>
                                                    <span className="day-full">{day.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Time Window for Daily/Weekly */}
                                {formData.schedule_type !== 'one_time' && (
                                    <div className="recurring-time-section">
                                        <label>Time Window (popup will show during these hours)</label>
                                        <div className="time-window-inputs">
                                            <div className="dm-form-group">
                                                <label>From</label>
                                                <input
                                                    type="time"
                                                    value={formData.recurring_start_time}
                                                    onChange={(e) => handleInputChange('recurring_start_time', e.target.value)}
                                                />
                                            </div>
                                            <span className="time-separator">-</span>
                                            <div className="dm-form-group">
                                                <label>Until</label>
                                                <input
                                                    type="time"
                                                    value={formData.recurring_end_time}
                                                    onChange={(e) => handleInputChange('recurring_end_time', e.target.value)}
                                                    className={errors.recurring_end_time ? 'error' : ''}
                                                />
                                            </div>
                                        </div>
                                        {errors.recurring_end_time && <span className="error-message">{errors.recurring_end_time}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Status & Priority Section */}
                            <div className="form-section">
                                <h4>Status & Priority</h4>
                                <div className="form-grid">
                                    <div className="dm-form-group">
                                        <label>Active Status</label>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={(e) => handleInputChange('is_active', e.target.checked)}
                                            />
                                            <span className="toggle-slider"></span>
                                            <span className="toggle-label">
                                                {formData.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </label>
                                    </div>

                                    <div className="dm-form-group">
                                        <label>Priority</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={formData.priority}
                                            onChange={(e) => handleInputChange('priority', e.target.value)}
                                        />
                                        <small className="input-help">Higher number = higher priority</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="data-mgmt-modal-actions">
                            <button
                                className="dm-btn-secondary"
                                onClick={() => setShowModal(false)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                className="dm-btn-primary"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader size={16} className="spinning" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={16} />
                                        {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PopupCampaignManagement;
