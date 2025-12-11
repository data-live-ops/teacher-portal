import React from 'react';
import { X, Minimize2, ExternalLink } from 'lucide-react';
import usePopupCampaign from '../hooks/usePopupCampaign';
import '../styles/PopupCampaignDisplay.css';

/**
 * PopupCampaignDisplay Component
 * Renders the popup modal and/or floating bubble for active campaigns
 *
 * @param {string} currentPage - The current page identifier for targeting
 * @param {string} userEmail - The current user's email for tracking clicks
 */
const PopupCampaignDisplay = ({ currentPage, userEmail }) => {
    const {
        campaign,
        isModalOpen,
        isMinimized,
        loading,
        closeModal,
        minimizeModal,
        expandFromBubble,
        handleCampaignClick
    } = usePopupCampaign(currentPage, userEmail);

    // Don't render anything if no campaign or loading
    if (loading || !campaign) {
        return null;
    }

    return (
        <>
            {/* Popup Modal */}
            {isModalOpen && (
                <div className="popup-campaign-overlay">
                    <div className="popup-campaign-modal">
                        {/* Header with action buttons */}
                        <div className="popup-campaign-header">
                            {campaign.display_type === 'dismissible' ? (
                                <button
                                    className="popup-close-btn"
                                    onClick={closeModal}
                                    aria-label="Close popup"
                                >
                                    <X size={24} />
                                </button>
                            ) : (
                                <button
                                    className="popup-minimize-btn"
                                    onClick={minimizeModal}
                                    aria-label="Minimize popup"
                                >
                                    <Minimize2 size={20} />
                                </button>
                            )}
                        </div>

                        {/* Campaign Content */}
                        <div
                            className={`popup-campaign-content ${campaign.click_url ? 'clickable' : ''}`}
                            onClick={campaign.click_url ? handleCampaignClick : undefined}
                            role={campaign.click_url ? 'button' : undefined}
                            tabIndex={campaign.click_url ? 0 : undefined}
                            onKeyDown={(e) => {
                                if (campaign.click_url && (e.key === 'Enter' || e.key === ' ')) {
                                    handleCampaignClick();
                                }
                            }}
                        >
                            <img
                                src={campaign.image_url}
                                alt={campaign.name}
                                className="popup-campaign-image"
                            />
                            {campaign.click_url && (
                                <div className="popup-click-indicator">
                                    <ExternalLink size={16} />
                                    <span>Klik untuk info lebih lanjut</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Bubble (for minimized state) */}
            {isMinimized && campaign.display_type === 'minimizable' && (
                <button
                    className="popup-campaign-bubble"
                    onClick={expandFromBubble}
                    aria-label="Show popup"
                >
                    <img
                        src={campaign.bubble_icon_url || campaign.image_url}
                        alt={campaign.name}
                        className="bubble-image"
                    />
                    <div className="bubble-pulse"></div>
                </button>
            )}
        </>
    );
};

export default PopupCampaignDisplay;
