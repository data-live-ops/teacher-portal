import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Calendar, User, MessageSquare, AlertCircle, Clock, BookOpen, Users, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import '../styles/NotificationBell.css';

const NotificationBell = ({ userEmail }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const dropdownRef = useRef(null);

  // Extract email string from userEmail (could be string or Firebase user object)
  const email = typeof userEmail === 'string' ? userEmail : userEmail?.email;

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!email) return;

    try {
      setIsLoading(true);

      // Get notifications
      const { data, error } = await supabase.rpc('get_user_notifications', {
        p_email: email,
        p_limit: 20
      });

      if (error) throw error;
      setNotifications(data || []);

      // Get unread count
      const { data: countData, error: countError } = await supabase.rpc('get_unread_notification_count', {
        p_email: email
      });

      if (!countError) {
        setUnreadCount(countData || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Fallback: direct query if RPC doesn't exist
      try {
        const { data, error: fallbackError } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_email', email)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!fallbackError) {
          setNotifications(data || []);
          setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        }
      } catch (e) {
        console.error('Fallback query failed:', e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and setup real-time subscription
  useEffect(() => {
    if (!email) return;

    fetchNotifications();

    // Subscribe to new notifications
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_email=eq.${email}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [email]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Mark single notification as read
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });

      if (error) {
        // Fallback direct update
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
      }

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_email: email
      });

      if (error) {
        // Fallback direct update
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('recipient_email', email)
          .eq('is_read', false);
      }

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;

    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Format sender name (extract email from string or show short form)
  const formatSender = (createdBy) => {
    if (!createdBy) return null;
    // If it's an email, show only the part before @
    if (createdBy.includes('@')) {
      return createdBy.split('@')[0];
    }
    return createdBy;
  };

  // Get icon based on notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_slot_assignment':
        return <Calendar size={16} className="notif-icon slot" />;
      case 'admin_message':
        return <MessageSquare size={16} className="notif-icon admin" />;
      default:
        return <AlertCircle size={16} className="notif-icon system" />;
    }
  };

  // Get type label
  const getTypeLabel = (type, metadata) => {
    switch (type) {
      case 'new_slot_assignment':
        return metadata?.role === 'mentor' ? 'Slot Mentor Baru' : 'Slot Guru Juara Baru';
      case 'admin_message':
        return 'Pesan Admin';
      default:
        return 'Notifikasi';
    }
  };

  // Handle notification click - open detail modal
  const handleNotifClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    setSelectedNotif(notif);
    setShowDetailModal(true);
  };

  // Close detail modal
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedNotif(null);
  };

  // Format date for detail
  const formatFullDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Get role label in Indonesian
  const getRoleLabel = (role) => {
    return role === 'mentor' ? 'Mentor' : 'Guru Juara';
  };

  // Get status badge class
  const getStatusClass = (status) => {
    switch (status) {
      case 'Open': return 'status-open';
      case 'Upcoming': return 'status-upcoming';
      default: return 'status-default';
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifikasi</h3>
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={markAllAsRead}
                title="Tandai semua sudah dibaca"
              >
                <CheckCheck size={16} />
                Tandai Semua Dibaca
              </button>
            )}
          </div>

          <div className="notification-list">
            {isLoading ? (
              <div className="notification-loading">
                <div className="loading-spinner"></div>
                <span>Memuat notifikasi...</span>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotifClick(notif)}
                >
                  <div className="notification-icon-wrapper">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-type-badge">
                      {getTypeLabel(notif.type, notif.metadata)}
                    </div>
                    <h4 className="notification-title">{notif.title}</h4>
                    <p className="notification-message">{notif.message}</p>
                    <div className="notification-meta">
                      <span className="notification-time">{formatDate(notif.created_at)}</span>
                      {notif.created_by && (
                        <span className="notification-sender">
                          <User size={12} />
                          {formatSender(notif.created_by)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!notif.is_read && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              ))
            ) : (
              <div className="notification-empty">
                <Bell size={40} />
                <p>Tidak ada notifikasi</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button onClick={fetchNotifications} className="refresh-btn">
                Refresh
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedNotif && (
        <div className="notif-detail-overlay" onClick={closeDetailModal}>
          <div className="notif-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notif-detail-header">
              <div className="notif-detail-icon">
                {getNotificationIcon(selectedNotif.type)}
              </div>
              <div className="notif-detail-title-section">
                <span className={`notif-detail-type ${selectedNotif.type === 'new_slot_assignment' ? 'type-slot' : 'type-admin'}`}>
                  {getTypeLabel(selectedNotif.type, selectedNotif.metadata)}
                </span>
                <h2>{selectedNotif.title}</h2>
              </div>
              <button className="notif-detail-close" onClick={closeDetailModal}>
                <X size={20} />
              </button>
            </div>

            <div className="notif-detail-body">
              <p className="notif-detail-message">{selectedNotif.message}</p>

              {/* Slot Assignment Details */}
              {selectedNotif.type === 'new_slot_assignment' && selectedNotif.metadata && (
                <div className="notif-detail-info">
                  <h4>Detail Assignment</h4>
                  <div className="notif-detail-grid">
                    <div className="notif-detail-item">
                      <div className="notif-detail-label">
                        <Users size={14} />
                        <span>Peran Anda</span>
                      </div>
                      <div className="notif-detail-value role-badge">
                        {getRoleLabel(selectedNotif.metadata.role)}
                      </div>
                    </div>

                    <div className="notif-detail-item">
                      <div className="notif-detail-label">
                        <BookOpen size={14} />
                        <span>Nama Slot</span>
                      </div>
                      <div className="notif-detail-value">
                        {selectedNotif.metadata.slot_name || '-'}
                      </div>
                    </div>

                    <div className="notif-detail-item">
                      <div className="notif-detail-label">
                        <MapPin size={14} />
                        <span>Grade</span>
                      </div>
                      <div className="notif-detail-value">
                        Grade {selectedNotif.metadata.grade || '-'}
                      </div>
                    </div>

                    {selectedNotif.metadata.subject && (
                      <div className="notif-detail-item">
                        <div className="notif-detail-label">
                          <BookOpen size={14} />
                          <span>Mata Pelajaran</span>
                        </div>
                        <div className="notif-detail-value">
                          {selectedNotif.metadata.subject}
                        </div>
                      </div>
                    )}

                    <div className="notif-detail-item">
                      <div className="notif-detail-label">
                        <Calendar size={14} />
                        <span>Tanggal Mulai Kelas</span>
                      </div>
                      <div className="notif-detail-value highlight">
                        {formatFullDate(selectedNotif.metadata.first_class_date)}
                      </div>
                    </div>

                    {selectedNotif.metadata.status && (
                      <div className="notif-detail-item">
                        <div className="notif-detail-label">
                          <AlertCircle size={14} />
                          <span>Status Slot</span>
                        </div>
                        <div className={`notif-detail-value status-badge ${getStatusClass(selectedNotif.metadata.status)}`}>
                          {selectedNotif.metadata.status}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Message - just show full message */}
              {selectedNotif.type === 'admin_message' && (
                <div className="notif-detail-info">
                  <h4>Pesan dari Admin</h4>
                  <div className="notif-admin-message">
                    {selectedNotif.message}
                  </div>
                </div>
              )}
            </div>

            <div className="notif-detail-footer">
              <div className="notif-detail-meta">
                <Clock size={14} />
                <span>Diterima: {formatFullDate(selectedNotif.created_at)}</span>
              </div>
              {selectedNotif.created_by && (
                <div className="notif-detail-meta">
                  <User size={14} />
                  <span>Dari: {selectedNotif.created_by}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
