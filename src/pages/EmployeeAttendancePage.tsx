import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle2, Calendar, 
  History, Shield, AlertCircle, Sun, Coffee, Check, RefreshCw
} from 'lucide-react';
import { useAttendance } from '../context/AttendanceContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import PageHero from '../components/PageHero';
import './EmployeeAttendancePage.css';

export default function EmployeeAttendancePage() {
  const { todayRecord, markAttendance, getRecordsByEmployee, requestCorrection } = useAttendance();
  const { currentUser } = useAuth();
  const { showToast } = useUI();

  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Correction Request Modal State
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<any>(null);
  const [reqIn, setReqIn] = useState('09:30');
  const [reqOut, setReqOut] = useState('18:00');
  const [reqReason, setReqReason] = useState('');

  // Keep live digital clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time Analysis for Recommendations
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTotalMins = currentHours * 60 + currentMinutes;

  // 9:30 AM = 570 mins, 10:30 AM = 630 mins
  const isFullDayWindow = currentTotalMins >= 540 && currentTotalMins <= 660; // 9:00 AM to 11:00 AM
  // Around 1:00 PM (12:30 PM to 2:30 PM)
  const isHalfDayWindow = currentTotalMins >= 750 && currentTotalMins <= 870; // 12:30 PM to 2:30 PM

  const handleMark = async (type: 'FULL_DAY' | 'HALF_DAY') => {
    setIsProcessing(true);
    try {
      await markAttendance(type, notes.trim() || undefined);
      showToast(
        type === 'FULL_DAY' 
          ? 'Present! Full Day Attendance marked successfully.' 
          : 'Half Day Attendance marked successfully.', 
        'success'
      );
      setNotes('');
    } catch (err: any) {
      showToast(err.message || 'Failed to mark attendance', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitCorrection = async () => {
    if (!selectedRecordForCorrection) return;
    if (!reqReason.trim()) {
      showToast('Please provide a reason for the attendance correction', 'error');
      return;
    }

    try {
      const targetDate = selectedRecordForCorrection.date;
      const fullReqIn = `${targetDate}T${reqIn}:00.000Z`;
      const fullReqOut = reqOut ? `${targetDate}T${reqOut}:00.000Z` : '';
      await requestCorrection(selectedRecordForCorrection.id, targetDate, fullReqIn, fullReqOut, reqReason);
      showToast('Correction request submitted to Administrator for review!', 'success');
      setSelectedRecordForCorrection(null);
      setReqReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit correction request', 'error');
    }
  };

  const myHistory = currentUser ? getRecordsByEmployee(currentUser.id) : [];
  const isMarked = !!todayRecord && !!todayRecord.status && todayRecord.status !== 'ABSENT';

  return (
    <div className="employee-attendance-page">
      {/* Header */}
      <PageHero
        badge="Daily Attendance Logging"
        icon={<Clock size={26} />}
        title="Staff Daily Attendance"
        subtitle="Fast 1-click attendance marking for company staff & field employees."
      />

      {/* Main Today Action Card */}
      <div className="ea-punch-card">
        <div className="ea-punch-header">
          <div className="ea-date-badge">
            <Calendar size={16} />
            <span>
              {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {isMarked ? (
            <span className={`ea-status-pill status-${todayRecord.status.toLowerCase()}`}>
              ✓ {todayRecord.status === 'HALF_DAY' ? 'Half Day' : 'Present (Full Day)'}
            </span>
          ) : (
            <span className="ea-status-pill status-absent">Not Marked Yet</span>
          )}
        </div>

        <div className="ea-punch-body">
          {/* Digital Clock Banner */}
          <div className="ea-time-banner">
            <div className="ea-time-icon">
              <Clock size={28} />
            </div>
            <div className="ea-time-info">
              <div className="ea-current-clock">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="ea-window-guidance">
                {isFullDayWindow ? (
                  <span className="ea-guide-active">
                    🟢 Full Day Window Active: Mark Present between <strong>9:30 AM – 10:30 AM</strong>
                  </span>
                ) : isHalfDayWindow ? (
                  <span className="ea-guide-half">
                    🟡 Half Day Window Active: Mark Half Day around <strong>1:00 PM</strong>
                  </span>
                ) : (
                  <span className="ea-guide-standard">
                    Standard Working Hours: 9:30 AM to 6:30 PM
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Today Record Status if Already Marked */}
          {isMarked && (
            <div className="ea-already-marked-card">
              <div className="ea-marked-icon">
                <CheckCircle2 size={32} color="#16A34A" />
              </div>
              <div className="ea-marked-details">
                <div className="ea-marked-title">
                  Attendance Recorded: <strong>{todayRecord.status === 'HALF_DAY' ? 'Half Day' : 'Full Day (Present)'}</strong>
                </div>
                <div className="ea-marked-sub">
                  Marked at {todayRecord.checkInTime ? new Date(todayRecord.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'} • {todayRecord.notes || 'Recorded successfully'}
                </div>
              </div>
            </div>
          )}

          {/* Attendance Selection Buttons */}
          <div className="ea-buttons-wrapper">
            <div className="ea-button-card">
              <button 
                className={`ea-mark-btn btn-full-day ${todayRecord?.status === 'PRESENT' ? 'btn-active-selection' : ''}`}
                onClick={() => handleMark('FULL_DAY')}
                disabled={isProcessing}
              >
                <div className="ea-btn-title-row">
                  <Sun size={20} />
                  <span>Mark Present (Full Day)</span>
                </div>
                <span className="ea-btn-sub">Click between 9:30 AM – 10:30 AM</span>
              </button>
            </div>

            <div className="ea-button-card">
              <button 
                className={`ea-mark-btn btn-half-day ${todayRecord?.status === 'HALF_DAY' ? 'btn-active-selection' : ''}`}
                onClick={() => handleMark('HALF_DAY')}
                disabled={isProcessing}
              >
                <div className="ea-btn-title-row">
                  <Coffee size={20} />
                  <span>Mark Half Day</span>
                </div>
                <span className="ea-btn-sub">Click around 1:00 PM</span>
              </button>
            </div>
          </div>

          {/* Optional Notes */}
          <div className="ea-notes-row">
            <input 
              type="text" 
              className="ea-note-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: Add visit/meeting notes or site location description..."
            />
          </div>
        </div>
      </div>

      {/* Past Attendance History */}
      <div className="ea-history-card">
        <div className="ea-history-header">
          <h3><History size={18} /> My Attendance Logs (Past 30 Days)</h3>
        </div>

        <div className="ea-table-wrapper">
          <table className="ea-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>TIME MARKED</th>
                <th>ATTENDANCE TYPE</th>
                <th>STATUS</th>
                <th>NOTES</th>
                <th style={{ textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {myHistory.map((rec) => (
                <tr key={rec.id}>
                  <td className="font-semibold text-navy">
                    {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </td>
                  <td>
                    <span className="font-bold">
                      {rec.status === 'HALF_DAY' ? 'Half Day' : 'Full Day'}
                    </span>
                  </td>
                  <td>
                    <span className={`ea-status-pill status-${rec.status.toLowerCase()}`}>
                      {rec.status === 'HALF_DAY' ? 'Half Day' : 'Present'}
                    </span>
                  </td>
                  <td className="text-muted text-sm">
                    {rec.notes || '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn-outline" 
                      style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}
                      onClick={() => setSelectedRecordForCorrection(rec)}
                    >
                      Correction
                    </button>
                  </td>
                </tr>
              ))}
              {myHistory.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                    No attendance records logged yet. Click Full Day or Half Day above to mark attendance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correction Request Modal */}
      {selectedRecordForCorrection && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px', padding: '1.5rem', background: '#fff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0F172A', fontSize: '1.15rem' }}>Request Attendance Correction</h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '1rem' }}>
              Submitting correction for: <strong>{new Date(selectedRecordForCorrection.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Actual In Time:</label>
                <input 
                  type="time" 
                  value={reqIn} 
                  onChange={(e) => setReqIn(e.target.value)} 
                  style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Reason for Correction *</label>
                <textarea 
                  rows={3} 
                  value={reqReason} 
                  onChange={(e) => setReqReason(e.target.value)} 
                  placeholder="e.g. Field visit to customer site early morning, punch omitted..." 
                  style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => setSelectedRecordForCorrection(null)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSubmitCorrection}>
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
