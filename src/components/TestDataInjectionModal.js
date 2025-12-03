import React, { useState, useEffect } from 'react';
import { X, FlaskConical, Plus, Trash2, AlertCircle, CheckCircle, Loader, Copy, Download } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.mjs';
import '../styles/TestDataInjectionModal.css';

// Available time slots
const TIME_SLOTS = [
  '09:30-10:30',
  '11:00-12:00',
  '13:00-14:00',
  '14:30-15:30',
  '16:00-17:00',
  '17:15-18:15',
  '19:00-20:00'
];

const TestDataInjectionModal = ({
  isOpen,
  onClose,
  assignments = [],
  teachers = [],
  currentUser
}) => {
  const [testSessions, setTestSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [existingTestData, setExistingTestData] = useState([]);
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'manage'
  const [message, setMessage] = useState({ type: '', text: '' });

  // Generate unique session ID for test data
  const generateSessionId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `TEST_${timestamp}_${random}`;
  };

  // Generate class dates for the next few weeks
  const generateClassDates = (dayName, count = 4) => {
    const dayMap = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
      'Friday': 5, 'Saturday': 6, 'Sunday': 0
    };

    const dates = [];
    const today = new Date();
    let currentDate = new Date(today);

    // Find next occurrence of the day
    const targetDay = dayMap[dayName] ?? 1;
    while (currentDate.getDay() !== targetDay) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (let i = 0; i < count; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return dates;
  };

  // Format date to YYYY-MM-DD
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Get day name from date
  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(date).getDay()];
  };

  // Load existing test data
  const loadExistingTestData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('raw_sessions')
        .select('*')
        .like('session_id', 'TEST_%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingTestData(data || []);
    } catch (error) {
      console.error('Error loading test data:', error);
      setMessage({ type: 'error', text: 'Failed to load existing test data' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadExistingTestData();
      // Initialize with one empty row
      if (testSessions.length === 0) {
        addNewSession();
      }
    }
  }, [isOpen]);

  // Add new empty session row
  const addNewSession = () => {
    const newSession = {
      id: Date.now(),
      session_id: generateSessionId(),
      subject: '',
      session_topic: '',
      slot_name: '',
      teacher_name: '',
      grade: '',
      class_date: formatDate(new Date()),
      class_time: '16:00-17:00',
      first_class_date: formatDate(new Date()),
      day: getDayName(new Date())
    };
    setTestSessions([...testSessions, newSession]);
  };

  // Remove session row
  const removeSession = (id) => {
    setTestSessions(testSessions.filter(s => s.id !== id));
  };

  // Update session field
  const updateSession = (id, field, value) => {
    setTestSessions(testSessions.map(s => {
      if (s.id === id) {
        const updated = { ...s, [field]: value };

        // Auto-update day when class_date changes
        if (field === 'class_date') {
          updated.day = getDayName(value);
        }

        return updated;
      }
      return s;
    }));
  };

  // Auto-fill from assignment
  const fillFromAssignment = (sessionId, assignmentId) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    const teacherName = assignment.guru_juara_name || '';
    const day = assignment.days?.[0] || 'Monday';
    const classDates = generateClassDates(day, 1);

    // Match time_range to available TIME_SLOTS or use default
    const matchedTimeSlot = TIME_SLOTS.find(slot =>
      assignment.time_range && slot.includes(assignment.time_range.split('-')[0]?.trim())
    ) || assignment.time_range || '16:00-17:00';

    setTestSessions(testSessions.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          subject: assignment.subject || '',
          slot_name: assignment.slot_name || '',
          teacher_name: teacherName,
          grade: assignment.grade?.toString() || '',
          class_time: matchedTimeSlot,
          class_date: classDates[0] ? formatDate(classDates[0]) : s.class_date,
          first_class_date: classDates[0] ? formatDate(classDates[0]) : s.first_class_date,
          day: day,
          session_topic: `${assignment.subject} - ${assignment.slot_name} Session`
        };
      }
      return s;
    }));
  };

  // Generate multiple sessions from an assignment
  const generateBulkSessions = (assignmentId, sessionCount = 4) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    const teacherName = assignment.guru_juara_name || '';
    const day = assignment.days?.[0] || 'Monday';
    const classDates = generateClassDates(day, sessionCount);

    // Match time_range to available TIME_SLOTS or use default
    const matchedTimeSlot = TIME_SLOTS.find(slot =>
      assignment.time_range && slot.includes(assignment.time_range.split('-')[0]?.trim())
    ) || assignment.time_range || '16:00-17:00';

    const newSessions = classDates.map((date, index) => ({
      id: Date.now() + index,
      session_id: generateSessionId(),
      subject: assignment.subject || '',
      session_topic: `${assignment.subject} - ${assignment.slot_name} Session ${index + 1}`,
      slot_name: assignment.slot_name || '',
      teacher_name: teacherName,
      grade: assignment.grade?.toString() || '',
      class_date: formatDate(date),
      class_time: matchedTimeSlot,
      first_class_date: formatDate(classDates[0]),
      day: day
    }));

    setTestSessions([...testSessions, ...newSessions]);
  };

  // Save test data to raw_sessions
  const saveTestData = async () => {
    // Validate
    const validSessions = testSessions.filter(s =>
      s.subject && s.slot_name && s.grade && s.class_date
    );

    if (validSessions.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in at least one valid session (Subject, Slot Name, Grade, and Class Date are required)' });
      return;
    }

    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });

      const dataToInsert = validSessions.map(s => ({
        session_id: s.session_id,
        subject: s.subject,
        session_topic: s.session_topic || `${s.subject} Session`,
        slot_name: s.slot_name,
        teacher_name: s.teacher_name || null,
        grade: s.grade,
        class_date: s.class_date,
        class_time: s.class_time || null,
        first_class_date: s.first_class_date || s.class_date,
        day: s.day || getDayName(s.class_date)
      }));

      const { data, error } = await supabase
        .from('raw_sessions')
        .insert(dataToInsert)
        .select();

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Successfully injected ${data.length} test session(s) to raw_sessions`
      });

      // Clear the form and reload existing data
      setTestSessions([]);
      addNewSession();
      loadExistingTestData();

    } catch (error) {
      console.error('Error saving test data:', error);
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete test data
  const deleteTestData = async (sessionIds) => {
    if (!window.confirm(`Are you sure you want to delete ${sessionIds.length} test session(s)?`)) {
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('raw_sessions')
        .delete()
        .in('session_id', sessionIds);

      if (error) throw error;

      setMessage({ type: 'success', text: `Deleted ${sessionIds.length} test session(s)` });
      loadExistingTestData();
    } catch (error) {
      console.error('Error deleting test data:', error);
      setMessage({ type: 'error', text: `Failed to delete: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete all test data
  const deleteAllTestData = async () => {
    if (!window.confirm('Are you sure you want to delete ALL test data? This cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('raw_sessions')
        .delete()
        .like('session_id', 'TEST_%');

      if (error) throw error;

      setMessage({ type: 'success', text: 'All test data has been deleted' });
      loadExistingTestData();
    } catch (error) {
      console.error('Error deleting all test data:', error);
      setMessage({ type: 'error', text: `Failed to delete: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique teachers from teachers list
  const uniqueTeachers = [...new Map(teachers.map(t => [t.id, t])).values()];

  // Get unique values for dropdowns from assignments
  const uniqueSubjects = [...new Set(assignments.map(a => a.subject).filter(Boolean))];
  const uniqueGrades = [...new Set(assignments.map(a => a.grade?.toString()).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const uniqueSlots = [...new Set(assignments.map(a => a.slot_name).filter(Boolean))];

  const handleClose = () => {
    if (!isSaving) {
      setTestSessions([]);
      setMessage({ type: '', text: '' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="test-injection-modal-overlay">
      <div className="test-injection-modal-content">
        <div className="test-injection-modal-header">
          <h3 className="test-injection-modal-title">
            <FlaskConical size={20} />
            Test Data Injection (raw_sessions)
          </h3>
          <button
            onClick={handleClose}
            className="test-injection-modal-close"
            disabled={isSaving}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="test-injection-tabs">
          <button
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <Plus size={16} />
            Create Test Data
          </button>
          <button
            className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            <FlaskConical size={16} />
            Manage Test Data ({existingTestData.length})
          </button>
        </div>

        <div className="test-injection-modal-body">
          {/* Warning */}
          <div className="test-injection-warning">
            <AlertCircle size={16} />
            <div>
              <p><strong>Test Data Mode:</strong></p>
              <ul>
                <li>Data yang diinjeksikan akan memiliki prefix "TEST_" pada session_id</li>
                <li>Gunakan fitur ini untuk latihan assignment saat data Ajar belum tersedia</li>
                <li>Pastikan hapus test data sebelum production</li>
              </ul>
            </div>
          </div>

          {/* Message */}
          {message.text && (
            <div className={`test-injection-message ${message.type}`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          {activeTab === 'create' && (
            <>
              {/* Quick Fill from Assignment */}
              <div className="quick-fill-section">
                <h4>Quick Generate from Assignment</h4>
                <div className="quick-fill-row">
                  <select
                    className="quick-fill-select"
                    onChange={(e) => {
                      if (e.target.value) {
                        generateBulkSessions(e.target.value, 4);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">-- Select assignment to generate 4 sessions --</option>
                    {assignments.map(a => (
                      <option key={a.id} value={a.id}>
                        Grade {a.grade} - {a.subject} - {a.slot_name} ({a.guru_juara_name || 'No teacher'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sessions Table */}
              <div className="test-sessions-container">
                <div className="test-sessions-header">
                  <h4>Test Sessions ({testSessions.length})</h4>
                  <button className="add-session-btn" onClick={addNewSession}>
                    <Plus size={14} />
                    Add Row
                  </button>
                </div>

                <div className="test-sessions-table-wrapper">
                  <table className="test-sessions-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        <th style={{ width: '120px' }}>Grade</th>
                        <th style={{ width: '150px' }}>Subject</th>
                        <th style={{ width: '180px' }}>Slot Name</th>
                        <th style={{ width: '180px' }}>Teacher Name</th>
                        <th style={{ width: '130px' }}>Class Date</th>
                        <th style={{ width: '100px' }}>Day</th>
                        <th style={{ width: '100px' }}>Time</th>
                        <th style={{ width: '180px' }}>Fill From</th>
                        <th style={{ width: '60px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testSessions.map((session, index) => (
                        <tr key={session.id}>
                          <td>{index + 1}</td>
                          <td>
                            <select
                              value={session.grade}
                              onChange={(e) => updateSession(session.id, 'grade', e.target.value)}
                              className="table-input"
                            >
                              <option value="">Select</option>
                              {uniqueGrades.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={session.subject}
                              onChange={(e) => updateSession(session.id, 'subject', e.target.value)}
                              className="table-input"
                            >
                              <option value="">Select</option>
                              {uniqueSubjects.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={session.slot_name}
                              onChange={(e) => updateSession(session.id, 'slot_name', e.target.value)}
                              className="table-input"
                              placeholder="Slot name..."
                              list={`slots-${session.id}`}
                            />
                            <datalist id={`slots-${session.id}`}>
                              {uniqueSlots.map(s => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </td>
                          <td>
                            <select
                              value={session.teacher_name}
                              onChange={(e) => updateSession(session.id, 'teacher_name', e.target.value)}
                              className="table-input"
                            >
                              <option value="">Select teacher</option>
                              {uniqueTeachers.map(t => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="date"
                              value={session.class_date}
                              onChange={(e) => updateSession(session.id, 'class_date', e.target.value)}
                              className="table-input"
                            />
                          </td>
                          <td>
                            <span className="day-badge">{session.day}</span>
                          </td>
                          <td>
                            <select
                              value={session.class_time}
                              onChange={(e) => updateSession(session.id, 'class_time', e.target.value)}
                              className="table-input"
                            >
                              {TIME_SLOTS.map(slot => (
                                <option key={slot} value={slot}>{slot}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  fillFromAssignment(session.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="table-input"
                            >
                              <option value="">Fill from...</option>
                              {assignments.map(a => (
                                <option key={a.id} value={a.id}>
                                  G{a.grade} {a.slot_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              className="delete-row-btn"
                              onClick={() => removeSession(session.id)}
                              title="Remove row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {testSessions.length === 0 && (
                  <div className="no-sessions">
                    <p>No test sessions added. Click "Add Row" or select an assignment to generate.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'manage' && (
            <div className="manage-test-data">
              <div className="manage-header">
                <h4>Existing Test Data in raw_sessions</h4>
                {existingTestData.length > 0 && (
                  <button
                    className="delete-all-btn"
                    onClick={deleteAllTestData}
                    disabled={isLoading}
                  >
                    <Trash2 size={14} />
                    Delete All Test Data
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="loading-state">
                  <Loader size={20} className="spinning" />
                  <span>Loading test data...</span>
                </div>
              ) : existingTestData.length > 0 ? (
                <div className="existing-data-table-wrapper">
                  <table className="existing-data-table">
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Grade</th>
                        <th>Subject</th>
                        <th>Slot Name</th>
                        <th>Teacher</th>
                        <th>Class Date</th>
                        <th>Day</th>
                        <th>Created At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingTestData.map(session => (
                        <tr key={session.id}>
                          <td>
                            <code className="session-id-code">{session.session_id}</code>
                          </td>
                          <td>{session.grade}</td>
                          <td>{session.subject}</td>
                          <td>{session.slot_name}</td>
                          <td>{session.teacher_name || '-'}</td>
                          <td>{session.class_date}</td>
                          <td>{session.day}</td>
                          <td>{new Date(session.created_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="delete-row-btn"
                              onClick={() => deleteTestData([session.session_id])}
                              title="Delete this test session"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-test-data">
                  <FlaskConical size={40} />
                  <p>No test data found in raw_sessions</p>
                  <p className="hint">Switch to "Create Test Data" tab to add some</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="test-injection-modal-footer">
          <button
            onClick={handleClose}
            className="test-injection-button cancel"
            disabled={isSaving}
          >
            Close
          </button>
          {activeTab === 'create' && (
            <button
              onClick={saveTestData}
              className="test-injection-button primary"
              disabled={isSaving || testSessions.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader size={16} className="spinning" />
                  Saving...
                </>
              ) : (
                <>
                  <FlaskConical size={16} />
                  Inject Test Data ({testSessions.filter(s => s.subject && s.slot_name && s.grade).length})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestDataInjectionModal;
