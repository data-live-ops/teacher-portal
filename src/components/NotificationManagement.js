import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Search,
  RefreshCw,
  Trash2,
  User,
  Calendar,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader,
  Plus,
  X,
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';

const NotificationManagement = ({ currentUserEmail }) => {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    recipient_email: '',
    title: '',
    message: ''
  });
  const [filterType, setFilterType] = useState('all');

  // Extract email string from currentUserEmail (could be string or Firebase user object)
  const adminEmail = typeof currentUserEmail === 'string' ? currentUserEmail : currentUserEmail?.email;

  // Fetch all notifications (admin view)
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setMessage({ type: 'error', text: 'Gagal memuat notifikasi' });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch users for recipient selection
  const fetchUsers = async () => {
    try {
      // Get from user_emails table
      const { data: userEmails, error: userError } = await supabase
        .from('user_emails')
        .select('email, full_name')
        .order('full_name');

      if (userError) throw userError;

      // Also get from avatars for additional users
      const { data: avatars, error: avatarError } = await supabase
        .from('avatars')
        .select('email, first_name, last_name')
        .not('email', 'is', null);

      // Merge and deduplicate
      const allUsers = new Map();

      userEmails?.forEach(u => {
        if (u.email) {
          allUsers.set(u.email, { email: u.email, name: u.full_name || u.email });
        }
      });

      avatars?.forEach(a => {
        if (a.email && !allUsers.has(a.email)) {
          allUsers.set(a.email, {
            email: a.email,
            name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email
          });
        }
      });

      setUsers(Array.from(allUsers.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
  }, []);

  // Generate slot notifications
  const generateSlotNotifications = async () => {
    try {
      setIsGenerating(true);
      setMessage({ type: '', text: '' });

      const { data, error } = await supabase.rpc('generate_slot_notifications');

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Berhasil generate ${data || 0} notifikasi slot baru`
      });

      fetchNotifications();
    } catch (error) {
      console.error('Error generating notifications:', error);
      setMessage({ type: 'error', text: `Gagal generate: ${error.message}` });
    } finally {
      setIsGenerating(false);
    }
  };

  // Send admin message
  const sendAdminMessage = async () => {
    if (!sendForm.recipient_email || !sendForm.title || !sendForm.message) {
      setMessage({ type: 'error', text: 'Semua field harus diisi' });
      return;
    }

    try {
      setIsSending(true);
      setMessage({ type: '', text: '' });

      // Use RPC if available
      const { data, error } = await supabase.rpc('send_admin_notification', {
        p_recipient_email: sendForm.recipient_email,
        p_title: sendForm.title,
        p_message: sendForm.message,
        p_created_by: adminEmail
      });

      if (error) {
        // Fallback to direct insert
        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            recipient_email: sendForm.recipient_email,
            type: 'admin_message',
            title: sendForm.title,
            message: sendForm.message,
            created_by: adminEmail
          });

        if (insertError) throw insertError;
      }

      setMessage({ type: 'success', text: 'Pesan berhasil dikirim!' });
      setSendForm({ recipient_email: '', title: '', message: '' });
      setShowSendModal(false);
      fetchNotifications();
    } catch (error) {
      console.error('Error sending message:', error);
      setMessage({ type: 'error', text: `Gagal mengirim: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  // Delete notification
  const deleteNotification = async (id) => {
    if (!window.confirm('Hapus notifikasi ini?')) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      setMessage({ type: 'success', text: 'Notifikasi dihapus' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      setMessage({ type: 'error', text: 'Gagal menghapus' });
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    const matchesSearch =
      n.recipient_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || n.type === filterType;

    return matchesSearch && matchesType;
  });

  // Get type badge color
  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'new_slot_assignment': return 'type-slot';
      case 'admin_message': return 'type-admin';
      default: return 'type-system';
    }
  };

  // Get type label
  const getTypeLabel = (type) => {
    switch (type) {
      case 'new_slot_assignment': return 'Slot Assignment';
      case 'admin_message': return 'Admin Message';
      default: return 'System';
    }
  };

  return (
    <div className="notification-management">
      {/* Header */}
      <div className="section-header">
        <h2>
          <Bell size={24} />
          Notification Management
        </h2>
        <div className="header-actions">
          <button
            onClick={generateSlotNotifications}
            className="dm-btn-secondary"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader size={16} className="spinning" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Generate Slot Notifications
              </>
            )}
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            className="dm-btn-primary"
          >
            <Send size={16} />
            Kirim Pesan
          </button>
        </div>
      </div>

      <p className="section-description">
        Kelola notifikasi untuk user. Generate notifikasi slot baru atau kirim pesan langsung ke user.
      </p>

      {/* Message */}
      {message.text && (
        <div className={`notif-mgmt-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="notif-filters">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Cari berdasarkan email, judul, atau pesan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="type-filter"
        >
          <option value="all">Semua Tipe</option>
          <option value="new_slot_assignment">Slot Assignment</option>
          <option value="admin_message">Admin Message</option>
          <option value="system">System</option>
        </select>
        <button onClick={fetchNotifications} className="refresh-btn">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="notif-stats">
        <div className="stat-item">
          <span className="stat-value">{notifications.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{notifications.filter(n => !n.is_read).length}</span>
          <span className="stat-label">Belum Dibaca</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{notifications.filter(n => n.type === 'new_slot_assignment').length}</span>
          <span className="stat-label">Slot</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{notifications.filter(n => n.type === 'admin_message').length}</span>
          <span className="stat-label">Pesan Admin</span>
        </div>
      </div>

      {/* Notifications Table */}
      {isLoading ? (
        <div className="dm-loading-container">
          <div className="dm-loading-spinner"></div>
          <p className="dm-loading-text">Memuat notifikasi...</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="management-table">
            <thead>
              <tr>
                <th>Tipe</th>
                <th>Penerima</th>
                <th>Judul</th>
                <th>Pesan</th>
                <th>Status</th>
                <th>Tanggal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map(notif => (
                  <tr key={notif.id}>
                    <td>
                      <span className={`notif-type-badge ${getTypeBadgeClass(notif.type)}`}>
                        {getTypeLabel(notif.type)}
                      </span>
                    </td>
                    <td>
                      <div className="recipient-cell">
                        <User size={14} />
                        <span>{notif.recipient_email}</span>
                      </div>
                    </td>
                    <td className="title-cell">{notif.title}</td>
                    <td className="message-cell" title={notif.message}>
                      {notif.message?.length > 50
                        ? notif.message.substring(0, 50) + '...'
                        : notif.message}
                    </td>
                    <td>
                      <span className={`read-status ${notif.is_read ? 'read' : 'unread'}`}>
                        {notif.is_read ? 'Dibaca' : 'Belum'}
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(notif.created_at)}</td>
                    <td>
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="dm-btn-icon dm-btn-delete"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    <Bell size={40} />
                    <p>Tidak ada notifikasi</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Send Message Modal */}
      {showSendModal && (
        <div className="data-mgmt-modal-overlay">
          <div className="data-mgmt-modal-content">
            <div className="data-mgmt-modal-header">
              <h3>
                <Send size={20} />
                Kirim Pesan ke User
              </h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="dm-btn-icon"
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-section">
              <div className="dm-form-group">
                <label>
                  <User size={14} />
                  Penerima
                </label>
                <select
                  value={sendForm.recipient_email}
                  onChange={(e) => setSendForm({ ...sendForm, recipient_email: e.target.value })}
                >
                  <option value="">Pilih penerima...</option>
                  {users.map(user => (
                    <option key={user.email} value={user.email}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="dm-form-group">
                <label>Judul</label>
                <input
                  type="text"
                  value={sendForm.title}
                  onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                  placeholder="Judul notifikasi..."
                />
              </div>

              <div className="dm-form-group">
                <label>Pesan</label>
                <textarea
                  value={sendForm.message}
                  onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                  placeholder="Tulis pesan Anda..."
                  rows={4}
                />
              </div>
            </div>

            <div className="data-mgmt-modal-actions">
              <button
                onClick={() => setShowSendModal(false)}
                className="dm-btn-secondary"
              >
                Batal
              </button>
              <button
                onClick={sendAdminMessage}
                className="dm-btn-primary"
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <Loader size={16} className="spinning" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Kirim Pesan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .notification-management {
          width: 100%;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 1.5rem;
          color: #2d3748;
        }

        .section-description {
          color: #718096;
          margin-bottom: 20px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        /* Message */
        .notif-mgmt-message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .notif-mgmt-message.success {
          background: #dcfce7;
          border: 1px solid #86efac;
          color: #166534;
        }

        .notif-mgmt-message.error {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          color: #991b1b;
        }

        .notif-mgmt-message span {
          flex: 1;
        }

        .notif-mgmt-message button {
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.7;
          padding: 4px;
        }

        .notif-mgmt-message button:hover {
          opacity: 1;
        }

        /* Filters */
        .notif-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1;
          min-width: 250px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .search-box svg {
          color: #94a3b8;
        }

        .search-box input {
          flex: 1;
          border: none;
          background: none;
          font-size: 14px;
          outline: none;
        }

        .type-filter {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .refresh-btn:hover {
          background: #e2e8f0;
          color: #374151;
        }

        /* Stats */
        .notif-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Table customizations */
        .notif-type-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .notif-type-badge.type-slot {
          background: #f3e8ff;
          color: #7c3aed;
        }

        .notif-type-badge.type-admin {
          background: #dbeafe;
          color: #2563eb;
        }

        .notif-type-badge.type-system {
          background: #fef3c7;
          color: #d97706;
        }

        .recipient-cell {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #374151;
        }

        .recipient-cell svg {
          color: #94a3b8;
        }

        .title-cell {
          font-weight: 500;
          color: #1f2937;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .message-cell {
          color: #64748b;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .date-cell {
          font-size: 12px;
          color: #64748b;
          white-space: nowrap;
        }

        .read-status {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
        }

        .read-status.read {
          background: #dcfce7;
          color: #166534;
        }

        .read-status.unread {
          background: #fee2e2;
          color: #dc2626;
        }

        .empty-cell {
          text-align: center;
          padding: 60px 20px !important;
          color: #94a3b8;
        }

        .empty-cell svg {
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .empty-cell p {
          margin: 0;
        }

        /* Modal additions */
        .form-section textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        }

        .form-section textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .section-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .notif-filters {
            flex-direction: column;
          }

          .search-box {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationManagement;
