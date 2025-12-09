import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.mjs';

/**
 * Check if current time is within the recurring schedule
 * @param {Object} campaign - Campaign data with schedule fields
 * @returns {boolean} - Whether the campaign should be shown now
 */
const isWithinRecurringSchedule = (campaign) => {
    // Get current time in Asia/Jakarta
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

    const currentDay = jakartaTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = jakartaTime.toTimeString().slice(0, 5); // "HH:MM"

    // Check schedule type
    if (campaign.schedule_type === 'one_time') {
        // For one_time, the database query already handles start/end datetime
        return true;
    }

    if (campaign.schedule_type === 'daily') {
        // Check if current time is within the time window
        const startTime = campaign.recurring_start_time?.slice(0, 5) || '00:00';
        const endTime = campaign.recurring_end_time?.slice(0, 5) || '23:59';
        return currentTime >= startTime && currentTime <= endTime;
    }

    if (campaign.schedule_type === 'weekly') {
        // Check if today is one of the selected days
        const recurringDays = campaign.recurring_days || [];
        if (!recurringDays.includes(currentDay)) {
            return false;
        }

        // Check if current time is within the time window
        const startTime = campaign.recurring_start_time?.slice(0, 5) || '00:00';
        const endTime = campaign.recurring_end_time?.slice(0, 5) || '23:59';
        return currentTime >= startTime && currentTime <= endTime;
    }

    return true;
};

/**
 * Custom hook for managing popup campaign display logic
 * @param {string} currentPage - The current page identifier (e.g., 'home', 'individual_schedule')
 * @returns {Object} - Campaign data and control functions
 */
export const usePopupCampaign = (currentPage) => {
    const [campaign, setCampaign] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Session storage key for dismissed campaigns
    const getSessionKey = (campaignId) => `popup_dismissed_${campaignId}`;
    const getMinimizedKey = (campaignId) => `popup_minimized_${campaignId}`;

    // Check if campaign was already dismissed this session
    const wasDismissed = (campaignId) => {
        return sessionStorage.getItem(getSessionKey(campaignId)) === 'true';
    };

    // Check if campaign was minimized
    const wasMinimized = (campaignId) => {
        return sessionStorage.getItem(getMinimizedKey(campaignId)) === 'true';
    };

    // Fetch active campaign for current page
    const fetchActiveCampaign = useCallback(async () => {
        if (!currentPage) return;

        setLoading(true);
        setError(null);

        try {
            // Get current time in Asia/Jakarta timezone
            const now = new Date();

            console.log('Fetching popup campaign for page:', currentPage);
            console.log('Current time:', now.toISOString());

            // Use filter for JSONB array contains check
            const { data, error: fetchError } = await supabase
                .from('popup_campaigns')
                .select('*')
                .eq('is_active', true)
                .lte('start_datetime', now.toISOString())
                .gte('end_datetime', now.toISOString())
                .filter('target_pages', 'cs', `["${currentPage}"]`)
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(1);

            console.log('Popup campaign query result:', { data, fetchError });

            // Handle array result (since we removed .single())
            const campaignData = data && data.length > 0 ? data[0] : null;

            if (fetchError) {
                console.error('Popup campaign fetch error:', fetchError);
                throw fetchError;
            } else if (campaignData) {
                console.log('Found active campaign:', campaignData.name);
                console.log('Schedule type:', campaignData.schedule_type);

                // Check if within recurring schedule
                if (!isWithinRecurringSchedule(campaignData)) {
                    console.log('Campaign not within recurring schedule window');
                    setCampaign(null);
                    return;
                }

                setCampaign(campaignData);

                // Determine initial state based on display type and session storage
                if (campaignData.display_type === 'dismissible') {
                    if (!wasDismissed(campaignData.id)) {
                        setIsModalOpen(true);
                        setIsMinimized(false);
                    }
                } else if (campaignData.display_type === 'minimizable') {
                    if (wasMinimized(campaignData.id)) {
                        setIsMinimized(true);
                        setIsModalOpen(false);
                    } else {
                        setIsModalOpen(true);
                        setIsMinimized(false);
                    }
                }
            } else {
                console.log('No active campaign found for page:', currentPage);
                setCampaign(null);
            }
        } catch (err) {
            console.error('Error fetching popup campaign:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    // Initial fetch
    useEffect(() => {
        fetchActiveCampaign();
    }, [fetchActiveCampaign]);

    // Close modal (for dismissible type)
    const closeModal = useCallback(() => {
        if (campaign?.display_type === 'dismissible') {
            sessionStorage.setItem(getSessionKey(campaign.id), 'true');
            setIsModalOpen(false);
            setIsMinimized(false);
        }
    }, [campaign]);

    // Minimize modal (for minimizable type)
    const minimizeModal = useCallback(() => {
        if (campaign?.display_type === 'minimizable') {
            sessionStorage.setItem(getMinimizedKey(campaign.id), 'true');
            setIsModalOpen(false);
            setIsMinimized(true);
        }
    }, [campaign]);

    // Expand from bubble (for minimizable type)
    const expandFromBubble = useCallback(() => {
        if (campaign?.display_type === 'minimizable') {
            sessionStorage.removeItem(getMinimizedKey(campaign.id));
            setIsModalOpen(true);
            setIsMinimized(false);
        }
    }, [campaign]);

    // Handle click on campaign image/content
    const handleCampaignClick = useCallback(() => {
        if (campaign?.click_url) {
            window.open(campaign.click_url, '_blank', 'noopener,noreferrer');
        }
    }, [campaign]);

    return {
        campaign,
        isModalOpen,
        isMinimized,
        loading,
        error,
        closeModal,
        minimizeModal,
        expandFromBubble,
        handleCampaignClick,
        refetch: fetchActiveCampaign
    };
};

export default usePopupCampaign;
