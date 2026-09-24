import React, { useState, useEffect } from 'react';
import { 
  Clock, MapPin, CheckCircle2, AlertTriangle, Calendar, 
  Shield, Play, Square, History, FileText, ChevronRight, Check
} from 'lucide-react';
import { useAttendance } from '../context/AttendanceContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import './EmployeeAttendancePage.css';

export default function EmployeeAttendancePage() {
  const { todayRecord, config, checkIn, checkOut, getRecordsByEmployee } = useAttendance();
  const { currentUser } = useAuth();
  const { showToast } = useUI();

  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Timer when Checked In
  useEffect(() => {
    if (!todayRecord || !todayRecord.checkInTime || todayRecord.checkOutTime) {
      return;
    }

    const checkInDate = new Date(todayRecord.checkInTime).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const diffSec = Math.floor((now - checkInDate) / 1000);
      setElapsedSeconds(diffSec > 0 ? diffSec : 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleCheckIn = async () => {
    setIsProcessing(true);
    try {
      await checkIn({ notes });
      showToast('Checked in successfully! Have a productive day.', 'success');
      setNotes('');
    } catch (err: any) {
      showToast(err.message || 'Check-in failed. Please enable location access.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    setIsProcessing(true);
    try {
      await checkOut({ notes });
      showToast('Checked out successfully. Shift completed!', 'success');
      setNotes('');
    } catch (err: any) {
      showToast(err.message || 'Check-out failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const myHistory = currentUser ? getRecordsByEmployee(currentUser.id) : [];

  const isCheckedIn = !!todayRecord && !!todayRecord.checkInTime && !todayRecord.checkOutTime;
  const isShiftComplete = !!todayRecord && !!todayRecord.checkOutTime;

  return (
    <div className="employee-attendance-page">
      {/* Header */}
      <div className="ea-header">
        <div>
          <div className="ea-breadcrumb">Staff Portal / Attendance</div>
          <h1>Live Attendance & Geolocation Check-In</h1>
          <p className="ea-sub">Office Hours: {config.officeStartTime} - {config.officeEndTime} (Grace: {config.gracePeriodMinutes} mins)</p>
        </div>
      </div>

      {/* Main Today Punch Card */}
      <div className="ea-punch-card">
        <div className="ea-punch-header">
          <div className="ea-date-badge">
            <Calendar size={15} />
            <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          {todayRecord ? (
            <span className={`ea-status-pill status-${todayRecord.status.toLowerCase()}`}>
              {todayRecord.status}
            </span>
          ) : (
            <span className="ea-status-pill status-absent">Not Checked In</span>
          )}
        </div>

        <div className="ea-punch-body">
          {/* Live Timer / Clock Display */}
          <div className="ea-timer-display">
            <div className="ea-timer-icon-wrap">
              <Clock size={32} className={isCheckedIn ? 'timer-pulse' : ''} />
            </div>
            <div className="ea-timer-text">
              <span className="ea-timer-label">
                {isCheckedIn ? 'ACTIVE SHIFT WORKING TIME' : isShiftComplete ? 'TOTAL SHIFT DURATION' : 'READY TO START SHIFT'}
              </span>
              <span className="ea-timer-val">
                {isCheckedIn ? formatTimer(elapsedSeconds) : isShiftComplete ? `${Math.floor(todayRecord.totalWorkingMinutes / 60)}h ${todayRecord.totalWorkingMinutes % 60}m` : '00:00:00'}
              </span>
            </div>
          </div>

          {/* Geo-location & Check-in Details */}
          <div className="ea-punch-details-grid">
            <div className="ea-detail-box">
              <span className="ea-box-label">Check-In Time:</span>
              <span className="ea-box-val font-bold text-navy">
                {todayRecord?.checkInTime ? new Date(todayRecord.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
              {todayRecord?.lateMinutes ? (
                <span className="text-danger text-xs font-bold">Late by {todayRecord.lateMinutes} mins</span>
              ) : todayRecord?.checkInTime ? (
                <span className="text-success text-xs font-bold">On Time ✓</span>
              ) : null}
            </div>

            <div className="ea-detail-box">
              <span className="ea-box-label">Check-Out Time:</span>
              <span className="ea-box-val font-bold text-navy">
                {todayRecord?.checkOutTime ? new Date(todayRecord.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
              {isShiftComplete && (
                <span className="text-muted text-xs">Completed</span>
              )}
            </div>

            <div className="ea-detail-box ea-col-span-2">
              <span className="ea-box-label"><MapPin size={13} /> GPS Geolocation Status:</span>
              <span className="ea-box-val text-xs text-muted">
                {todayRecord?.checkInLocation ? (
                  `Lat: ${todayRecord.checkInLocation.latitude.toFixed(4)}, Long: ${todayRecord.checkInLocation.longitude.toFixed(4)} (±${todayRecord.checkInLocation.accuracyMeters}m)`
                ) : (
                  'GPS verified automatically upon punch action'
                )}
              </span>
            </div>
          </div>

          {/* Action Input & Buttons */}
          <div className="ea-action-section">
            <input 
              type="text" 
              className="ea-note-input" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: Enter visit notes / site survey destination / client location..."
              disabled={isShiftComplete}
            />

            {!todayRecord?.checkInTime ? (
              <button 
                className="btn-primary ea-punch-btn green" 
                onClick={handleCheckIn} 
                disabled={isProcessing}
              >
                <Play size={18} /> PUNCH IN (START SHIFT)
              </button>
            ) : !todayRecord?.checkOutTime ? (
              <button 
                className="btn-danger ea-punch-btn red" 
                onClick={handleCheckOut} 
                disabled={isProcessing}
              >
                <Square size={18} /> PUNCH OUT (END SHIFT)
              </button>
            ) : (
              <div className="ea-completed-banner">
                <CheckCircle2 size={20} color="#16A34A" />
                <span>Shift Completed for today! Enjoy your evening.</span>
              </div>
            )}
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
                <th>IN</th>
                <th>OUT</th>
                <th>WORKING HOURS</th>
                <th>LATE</th>
                <th>STATUS</th>
                <th>LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {myHistory.map((rec) => (
                <tr key={rec.id}>
                  <td className="font-semibold text-navy">
                    {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td>{rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                  <td>{rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                  <td>
                    <span className="font-bold text-navy">
                      {Math.floor(rec.totalWorkingMinutes / 60)}h {rec.totalWorkingMinutes % 60}m
                    </span>
                  </td>
                  <td>
                    {rec.lateMinutes > 0 ? (
                      <span className="text-danger font-bold">{rec.lateMinutes}m</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    <span className={`ea-status-pill status-${rec.status.toLowerCase()}`}>
                      {rec.status}
                    </span>
                  </td>
                  <td className="text-muted text-xs">
                    {rec.checkInLocation ? '✓ GPS Verified' : '--'}
                  </td>
                </tr>
              ))}
              {myHistory.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                    No attendance records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
