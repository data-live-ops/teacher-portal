import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Clock,
  Play,
  Pause,
  Save,
  AlertCircle,
  CheckCircle,
  Loader,
  Calendar,
  Database,
  Settings,
  Trash2,
  Plus,
  History
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';

// Interval options for cron scheduling
const INTERVAL_OPTIONS = [
  { value: '*/5 * * * *', label: 'Every 5 minutes', description: 'Runs at 0, 5, 10, 15... minutes' },
  { value: '*/15 * * * *', label: 'Every 15 minutes', description: 'Runs at 0, 15, 30, 45 minutes' },
  { value: '*/30 * * * *', label: 'Every 30 minutes', description: 'Runs at 0, 30 minutes' },
  { value: '0 * * * *', label: 'Every hour', description: 'Runs at the start of every hour' },
  { value: '0 */2 * * *', label: 'Every 2 hours', description: 'Runs every 2 hours' },
  { value: '0 */4 * * *', label: 'Every 4 hours', description: 'Runs every 4 hours' },
  { value: '0 */6 * * *', label: 'Every 6 hours', description: 'Runs at 00:00, 06:00, 12:00, 18:00' },
  { value: '0 */12 * * *', label: 'Every 12 hours', description: 'Runs at 00:00 and 12:00' },
  { value: '0 0 * * *', label: 'Once daily (midnight)', description: 'Runs at 00:00 every day' },
  { value: '0 6 * * *', label: 'Once daily (6 AM)', description: 'Runs at 06:00 every day' },
  { value: '0 18 * * *', label: 'Once daily (6 PM)', description: 'Runs at 18:00 every day' },
  { value: '0 0 * * 1', label: 'Weekly (Monday midnight)', description: 'Runs every Monday at 00:00' },
];

const SyncSchedulerManagement = () => {
  const [config, setConfig] = useState({
    is_enabled: false,
    cron_schedule: '0 */6 * * *',
    question_number: '3815',
    last_sync_at: null,
    last_sync_status: null,
    last_sync_message: null
  });
  const [syncHistory, setSyncHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showHistory, setShowHistory] = useState(false);

  // Load configuration
  const loadConfig = async () => {
    try {
      setIsLoading(true);

      // Try to get existing config
      const { data, error } = await supabase
        .from('sync_scheduler_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is OK for first time
        throw error;
      }

      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error loading sync config:', error);
      // Config table might not exist yet, that's OK
    } finally {
      setIsLoading(false);
    }
  };

  // Load sync history
  const loadSyncHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading sync history:', error);
        return;
      }

      setSyncHistory(data || []);
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  };

  useEffect(() => {
    loadConfig();
    loadSyncHistory();
  }, []);

  // Save configuration
  const saveConfig = async () => {
    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });

      // Upsert config
      const { error } = await supabase
        .from('sync_scheduler_config')
        .upsert({
          id: 1, // Single row config
          is_enabled: config.is_enabled,
          cron_schedule: config.cron_schedule,
          question_number: config.question_number,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // If enabled, set up the cron job
      if (config.is_enabled) {
        const { error: cronError } = await supabase.rpc('setup_sync_cron_job', {
          p_schedule: config.cron_schedule,
          p_question_number: config.question_number
        });

        if (cronError) {
          console.warn('Cron job setup warning:', cronError);
          // Continue anyway, might not have pg_cron extension
        }
      } else {
        // Disable the cron job
        const { error: cronError } = await supabase.rpc('disable_sync_cron_job');
        if (cronError) {
          console.warn('Cron job disable warning:', cronError);
        }
      }

      setMessage({ type: 'success', text: 'Configuration saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Manual sync trigger
  const triggerManualSync = async () => {
    try {
      setIsSyncing(true);
      setMessage({ type: '', text: '' });

      // Call the edge function directly
      const { data, error } = await supabase.functions.invoke('resync-metabase-data', {
        body: { question_number: config.question_number }
      });

      if (error) throw error;

      if (data?.success) {
        setMessage({
          type: 'success',
          text: `Sync completed! ${data.rows_processed} rows processed.`
        });

        // Update last sync info
        setConfig(prev => ({
          ...prev,
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
          last_sync_message: data.message
        }));

        // Reload history
        loadSyncHistory();
      } else {
        throw new Error(data?.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      setMessage({ type: 'error', text: `Sync failed: ${error.message}` });

      setConfig(prev => ({
        ...prev,
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'failed',
        last_sync_message: error.message
      }));
    } finally {
      setIsSyncing(false);
    }
  };

  // Get human-readable schedule description
  const getScheduleDescription = (cronValue) => {
    const option = INTERVAL_OPTIONS.find(opt => opt.value === cronValue);
    return option?.description || cronValue;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  if (isLoading) {
    return (
      <div className="dm-loading-container">
        <div className="dm-loading-spinner"></div>
        <p className="dm-loading-text">Loading sync configuration...</p>
      </div>
    );
  }

  return (
    <div className="sync-scheduler-management">
      {/* Header */}
      <div className="section-header">
        <h2>
          <RefreshCw size={24} />
          Sync Scheduler
        </h2>
        <div className="header-actions">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="dm-btn-secondary dm-btn-sm"
          >
            <History size={16} />
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>
      </div>

      <p className="section-description">
        Configure automatic data synchronization from Metabase to raw_sessions table.
        Uses pg_cron for scheduled execution.
      </p>

      {/* Message */}
      {message.text && (
        <div className={`sync-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Status Card */}
      <div className="sync-status-card">
        <div className="status-header">
          <div className={`status-indicator ${config.is_enabled ? 'active' : 'inactive'}`}>
            {config.is_enabled ? <Play size={16} /> : <Pause size={16} />}
            <span>{config.is_enabled ? 'Scheduler Active' : 'Scheduler Inactive'}</span>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
            className={`toggle-button ${config.is_enabled ? 'active' : ''}`}
          >
            {config.is_enabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {config.last_sync_at && (
          <div className="last-sync-info">
            <Clock size={14} />
            <span>Last sync: {formatDate(config.last_sync_at)}</span>
            {config.last_sync_status && (
              <span className={`sync-status-badge ${config.last_sync_status}`}>
                {config.last_sync_status}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <div className="sync-config-form">
        <h3>
          <Settings size={18} />
          Configuration
        </h3>

        <div className="config-grid">
          {/* Interval Selection */}
          <div className="dm-form-group">
            <label>
              <Calendar size={14} />
              Sync Interval
            </label>
            <select
              value={config.cron_schedule}
              onChange={(e) => setConfig(prev => ({ ...prev, cron_schedule: e.target.value }))}
              disabled={isSaving}
            >
              {INTERVAL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="help-text">{getScheduleDescription(config.cron_schedule)}</small>
          </div>

          {/* Question Number */}
          <div className="dm-form-group">
            <label>
              <Database size={14} />
              Metabase Question Number
            </label>
            <input
              type="text"
              value={config.question_number}
              onChange={(e) => setConfig(prev => ({ ...prev, question_number: e.target.value }))}
              placeholder="e.g., 3815"
              disabled={isSaving}
            />
            <small className="help-text">The question ID from Metabase URL</small>
          </div>
        </div>

        {/* Cron Expression Display */}
        <div className="cron-display">
          <label>Cron Expression:</label>
          <code>{config.cron_schedule}</code>
        </div>

        {/* Action Buttons */}
        <div className="config-actions">
          <button
            onClick={saveConfig}
            className="dm-btn-primary"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader size={16} className="spinning" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Configuration
              </>
            )}
          </button>

          <button
            onClick={triggerManualSync}
            className="dm-btn-secondary"
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader size={16} className="spinning" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Sync Now (Manual)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync History */}
      {showHistory && (
        <div className="sync-history-section">
          <h3>
            <History size={18} />
            Sync History
          </h3>

          {syncHistory.length > 0 ? (
            <div className="table-wrapper">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Rows Processed</th>
                    <th>Duration</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {syncHistory.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{formatDate(item.created_at)}</td>
                      <td>
                        <span className={`dm-status-badge ${item.status === 'success' ? 'active' : 'inactive'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.rows_processed || '-'}</td>
                      <td>{item.duration_ms ? `${item.duration_ms}ms` : '-'}</td>
                      <td className="message-cell">{item.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <History size={40} />
              <p>No sync history yet</p>
            </div>
          )}
        </div>
      )}

      {/* Setup Instructions */}
      <div className="setup-instructions">
        <h3>
          <AlertCircle size={18} />
          Setup Requirements
        </h3>
        <div className="instructions-content">
          <p>To enable scheduled sync, the following database objects need to be created:</p>
          <ol>
            <li>
              <strong>Table:</strong> <code>sync_scheduler_config</code> - Stores scheduler configuration
            </li>
            <li>
              <strong>Table:</strong> <code>sync_history</code> - Stores sync execution history
            </li>
            <li>
              <strong>Extension:</strong> <code>pg_cron</code> and <code>pg_net</code> - For scheduled HTTP calls
            </li>
            <li>
              <strong>Function:</strong> <code>setup_sync_cron_job</code> - Manages cron job creation
            </li>
          </ol>
          <details className="sql-details">
            <summary>View SQL Setup Script</summary>
            <pre className="sql-code">{`-- 1. Create config table
CREATE TABLE IF NOT EXISTS sync_scheduler_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_enabled BOOLEAN DEFAULT false,
  cron_schedule TEXT DEFAULT '0 */6 * * *',
  question_number TEXT DEFAULT '3815',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 2. Create history table
CREATE TABLE IF NOT EXISTS sync_history (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL,
  rows_processed INTEGER,
  duration_ms INTEGER,
  message TEXT,
  error_details TEXT,
  triggered_by TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable extensions (requires superuser/dashboard)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- 4. Create function to call edge function
CREATE OR REPLACE FUNCTION call_sync_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_start_time TIMESTAMPTZ;
  v_response JSONB;
BEGIN
  v_start_time := NOW();

  -- Get config
  SELECT * INTO v_config FROM sync_scheduler_config WHERE id = 1;

  IF v_config IS NULL OR NOT v_config.is_enabled THEN
    RETURN;
  END IF;

  -- Call edge function via pg_net
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/resync-metabase-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('question_number', v_config.question_number)
  );

  -- Log to history
  INSERT INTO sync_history (status, triggered_by, message)
  VALUES ('triggered', 'scheduled', 'Sync job triggered via pg_cron');

END;
$$;

-- 5. Function to setup/update cron job
CREATE OR REPLACE FUNCTION setup_sync_cron_job(
  p_schedule TEXT,
  p_question_number TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove existing job if any
  PERFORM cron.unschedule('sync_metabase_data');

  -- Create new job
  PERFORM cron.schedule(
    'sync_metabase_data',
    p_schedule,
    'SELECT call_sync_edge_function()'
  );
END;
$$;

-- 6. Function to disable cron job
CREATE OR REPLACE FUNCTION disable_sync_cron_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM cron.unschedule('sync_metabase_data');
END;
$$;`}</pre>
          </details>
        </div>
      </div>

      <style jsx>{`
        .sync-scheduler-management {
          width: 100%;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
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
        .sync-message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .sync-message.success {
          background: #dcfce7;
          border: 1px solid #86efac;
          color: #166534;
        }

        .sync-message.error {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          color: #991b1b;
        }

        /* Status Card */
        .sync-status-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          color: white;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .status-indicator.active {
          color: #86efac;
        }

        .status-indicator.inactive {
          color: #fcd34d;
        }

        .toggle-button {
          padding: 8px 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .toggle-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .toggle-button.active {
          background: rgba(239, 68, 68, 0.3);
          border-color: #ef4444;
        }

        .last-sync-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .sync-status-badge {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .sync-status-badge.success {
          background: rgba(134, 239, 172, 0.3);
          color: #86efac;
        }

        .sync-status-badge.failed {
          background: rgba(252, 165, 165, 0.3);
          color: #fca5a5;
        }

        /* Config Form */
        .sync-config-form {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .sync-config-form h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 20px 0;
          color: #2d3748;
          font-size: 1.1rem;
        }

        .config-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .dm-form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .help-text {
          color: #718096;
          font-size: 0.8rem;
          margin-top: 4px;
        }

        .cron-display {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #e2e8f0;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .cron-display label {
          font-weight: 500;
          color: #4a5568;
        }

        .cron-display code {
          background: #2d3748;
          color: #86efac;
          padding: 4px 10px;
          border-radius: 4px;
          font-family: monospace;
        }

        .config-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* History Section */
        .sync-history-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .sync-history-section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 20px 0;
          color: #2d3748;
        }

        .message-cell {
          max-width: 300px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Setup Instructions */
        .setup-instructions {
          background: #fffbeb;
          border: 1px solid #fcd34d;
          border-radius: 12px;
          padding: 24px;
        }

        .setup-instructions h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 16px 0;
          color: #92400e;
        }

        .instructions-content {
          color: #78350f;
        }

        .instructions-content ol {
          margin: 12px 0;
          padding-left: 20px;
        }

        .instructions-content li {
          margin-bottom: 8px;
        }

        .instructions-content code {
          background: rgba(146, 64, 14, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }

        .sql-details {
          margin-top: 16px;
        }

        .sql-details summary {
          cursor: pointer;
          font-weight: 600;
          color: #92400e;
          padding: 8px 0;
        }

        .sql-code {
          background: #1e293b;
          color: #e2e8f0;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 0.85rem;
          line-height: 1.5;
          margin-top: 12px;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .status-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .config-grid {
            grid-template-columns: 1fr;
          }

          .config-actions {
            flex-direction: column;
          }

          .config-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default SyncSchedulerManagement;
