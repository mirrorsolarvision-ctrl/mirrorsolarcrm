import { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  CalendarDays,
  History,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import './EmployeeAttendancePage.css';

export default function EmployeeAttendancePage() {
  const { currentUser, isEmployeePresent, getEmployeeAttendance, markAttendance, getEmployeeAttendanceHistory } = useCRM();
  const { showToast } = useUI();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date Formatting
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => {
    return today.toISOString().split('T')[0];
  }, [today]);

  const formattedDate = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, [today]);

  // Greeting
  const greeting = useMemo(() => {
    const hour = today.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, [today]);

  const employeeId = currentUser?.id || '';
  const isPresentToday = isEmployeePresent(employeeId, todayIso);
  const todayAttendance = getEmployeeAttendance(employeeId, todayIso);
  const attendanceHistory = getEmployeeAttendanceHistory(employeeId);

  // Month Statistics
  const currentMonthPrefix = useMemo(() => todayIso.substring(0, 7), [todayIso]);
  const thisMonthPresentCount = useMemo(() => {
    return attendanceHistory.filter(a => a.date.startsWith(currentMonthPrefix)).length;
  }, [attendanceHistory, currentMonthPrefix]);

  const handleMarkPresent = async () => {
    if (isPresentToday) return;
    setIsSubmitting(true);
    try {
      await markAttendance(employeeId, todayIso, currentUser && 'dealerId' in currentUser ? (currentUser as any).dealerId : null);
      showToast('You have been marked Present for today! Have a great day.', 'success');
    } catch (err) {
      showToast('Failed to mark attendance. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="attendance-page-container">
      {/* Header Banner */}
      <div className="attendance-header-card">
        <div className="attendance-header-content">
          <div className="attendance-badge">
            <Sparkles size={16} className="text-yellow" />
            <span>Daily Attendance Portal</span>
          </div>
          <h1 className="attendance-greeting">
            {greeting}, <span className="highlight-name">{currentUser?.name || 'Employee'}</span>
          </h1>
          <p className="attendance-date-text">
            <CalendarIcon size={16} className="inline-icon" />
            {formattedDate}
          </p>
        </div>
        <div className="attendance-stats-pill">
          <TrendingUp size={20} className="stats-icon" />
          <div>
            <span className="stats-number">{thisMonthPresentCount}</span>
            <span className="stats-label">Days Present This Month</span>
          </div>
        </div>
      </div>

      {/* Main Today Action Card */}
      <div className="attendance-main-grid">
        <div className={`attendance-today-card ${isPresentToday ? 'card-present' : 'card-pending'}`}>
          <div className="card-top-indicator">
            <div className="pulse-indicator">
              <span className={`pulse-dot ${isPresentToday ? 'dot-present' : 'dot-pending'}`}></span>
              <span className="indicator-text">
                {isPresentToday ? "Today's Status: Marked" : "Today's Status: Pending Action"}
              </span>
            </div>
            <span className="strict-notice">
              <ShieldCheck size={14} /> Today Only
            </span>
          </div>

          <div className="attendance-action-area">
            {isPresentToday ? (
              <div className="present-celebration">
                <div className="present-icon-ring">
                  <CheckCircle2 size={48} className="present-check-icon" />
                </div>
                <h2 className="present-title">✅ PRESENT</h2>
                <div className="present-timestamp-badge">
                  <Clock size={16} />
                  <span>Marked at {todayAttendance?.markedAt || 'Today'}</span>
                </div>
                <p className="present-success-message">
                  Your attendance has been recorded for {formattedDate}. No further action needed today!
                </p>
                <div className="present-verified-pill">
                  <UserCheck size={16} /> Verified & Recorded
                </div>
              </div>
            ) : (
              <div className="pending-action-box">
                <div className="pending-icon-ring">
                  <CalendarDays size={42} className="pending-calendar-icon" />
                </div>
                <h2 className="pending-title">Ready to Start Your Day?</h2>
                <p className="pending-subtitle">
                  Click the button below to record your presence for <strong>{formattedDate}</strong>.
                </p>

                <button 
                  className="mark-present-btn"
                  onClick={handleMarkPresent}
                  disabled={isSubmitting}
                >
                  <CheckCircle2 size={24} className="btn-icon" />
                  <span>{isSubmitting ? 'Recording...' : 'MARK PRESENT'}</span>
                </button>

                <div className="pending-status-note">
                  <span>Status: <strong>Not Marked Yet</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attendance History Card (Read-Only) */}
        <div className="attendance-history-card">
          <div className="history-header">
            <div className="history-title-wrap">
              <History size={20} className="history-icon" />
              <h3>Attendance History</h3>
            </div>
            <span className="history-badge">Read-Only</span>
          </div>

          <div className="history-list-wrap">
            {attendanceHistory.length === 0 ? (
              <div className="empty-history">
                <CalendarDays size={32} className="empty-history-icon" />
                <p>No past attendance records found.</p>
                <span>Once you mark attendance, your logs will appear here.</span>
              </div>
            ) : (
              <div className="history-items-list">
                {attendanceHistory.map((record) => {
                  const recordDate = new Date(record.date + 'T00:00:00');
                  const formattedRecDate = recordDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });
                  const isTodayRec = record.date === todayIso;

                  return (
                    <div key={record.id} className={`history-row ${isTodayRec ? 'row-today' : ''}`}>
                      <div className="history-row-left">
                        <div className="status-indicator-badge">
                          <CheckCircle2 size={16} className="text-emerald" />
                        </div>
                        <div>
                          <div className="history-date-row">
                            <span className="history-date">{formattedRecDate}</span>
                            {isTodayRec && <span className="today-chip">Today</span>}
                          </div>
                          <span className="history-time">
                            <Clock size={12} className="inline-icon" /> Marked at {record.markedAt}
                          </span>
                        </div>
                      </div>
                      <div className="history-row-right">
                        <span className="status-pill-present">PRESENT</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
