import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, CheckCircle2, Calendar, 
  History, Shield, AlertCircle, Sun, Coffee, Check, RefreshCw,
  CalendarDays, FileText, Plus, X, AlertTriangle, ArrowRight,
  Wallet, IndianRupee, CreditCard, Printer, Download, Landmark, Sparkles, FileCheck
} from 'lucide-react';
import { useAttendance } from '../context/AttendanceContext';
import { usePayroll } from '../context/PayrollContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import PageHero from '../components/PageHero';
import type { LeaveType, LeaveRequest } from '../types/attendance';
import type { MonthlyPayrollRecord, EmployeeAdvanceRecord } from '../types/payroll';
import './EmployeeAttendancePage.css';

interface EmployeeAttendancePageProps {
  initialTab?: 'punch' | 'calendar' | 'leaves' | 'history' | 'payroll';
}

export default function EmployeeAttendancePage({ initialTab }: EmployeeAttendancePageProps = {}) {
  const { 
    todayRecord, 
    markAttendance, 
    getRecordsByEmployee, 
    requestCorrection, 
    applyLeave, 
    getEmployeeLeaves 
  } = useAttendance();
  const { 
    getSalaryConfig, 
    getEmployeeAdvances, 
    getEmployeePayrolls, 
    getEmployeeOutstandingAdvance 
  } = usePayroll();
  const { currentUser } = useAuth();
  const { showToast } = useUI();

  // Active Tab: 'punch' | 'calendar' | 'leaves' | 'history' | 'payroll'
  const [activeTab, setActiveTab] = useState<'punch' | 'calendar' | 'leaves' | 'history' | 'payroll'>(initialTab || 'punch');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const mySalaryConfig = currentUser ? getSalaryConfig(currentUser.id) : undefined;
  const myOutstandingAdvance = currentUser ? getEmployeeOutstandingAdvance(currentUser.id) : 0;
  const myPayrolls = useMemo(() => {
    return currentUser ? getEmployeePayrolls(currentUser.id) : [];
  }, [currentUser, getEmployeePayrolls]);
  const myAdvances = useMemo(() => {
    return currentUser ? getEmployeeAdvances(currentUser.id) : [];
  }, [currentUser, getEmployeeAdvances]);

  const [selectedPayslipForView, setSelectedPayslipForView] = useState<MonthlyPayrollRecord | null>(null);

  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Date constants
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayIso.substring(0, 7), [todayIso]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Correction Request Modal State
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<any>(null);
  const [reqIn, setReqIn] = useState('09:30');
  const [reqOut, setReqOut] = useState('18:00');
  const [reqReason, setReqReason] = useState('');

  // Apply Leave Modal State
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'CASUAL' as LeaveType,
    startDate: todayIso,
    endDate: todayIso,
    isHalfDay: false,
    reason: ''
  });
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Digital clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sunday Check
  const isSunday = currentTime.getDay() === 0;

  // Window guidance
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTotalMins = currentHours * 60 + currentMinutes;
  const isFullDayWindow = currentTotalMins >= 540 && currentTotalMins <= 660; // 9:00 AM to 11:00 AM
  const isHalfDayWindow = currentTotalMins >= 750 && currentTotalMins <= 870; // 12:30 PM to 2:30 PM

  const myHistory = useMemo(() => {
    return currentUser ? getRecordsByEmployee(currentUser.id) : [];
  }, [currentUser, getRecordsByEmployee]);

  const myLeaves = useMemo(() => {
    return currentUser ? getEmployeeLeaves(currentUser.id) : [];
  }, [currentUser, getEmployeeLeaves]);

  const isMarked = !!todayRecord && !!todayRecord.status && todayRecord.status !== 'ABSENT';

  // Punch Action
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

  // Correction Submit
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

  // Leave Submit Action
  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!leaveForm.reason.trim()) {
      showToast('Please provide a reason for your leave application', 'warning');
      return;
    }
    if (leaveForm.startDate > leaveForm.endDate) {
      showToast('Start date cannot be after end date', 'warning');
      return;
    }

    setIsSubmittingLeave(true);
    try {
      // Calculate total days
      const s = new Date(leaveForm.startDate + 'T00:00:00');
      const en = new Date(leaveForm.endDate + 'T00:00:00');
      const diffTime = Math.abs(en.getTime() - s.getTime());
      const rawDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = leaveForm.isHalfDay ? 0.5 : rawDays;

      await applyLeave({
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        employeeRole: currentUser.role as any,
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        isHalfDay: leaveForm.isHalfDay,
        totalDays,
        reason: leaveForm.reason
      });

      showToast('Leave request submitted successfully to Admin!', 'success');
      setShowApplyLeaveModal(false);
      setLeaveForm({
        leaveType: 'CASUAL',
        startDate: todayIso,
        endDate: todayIso,
        isHalfDay: false,
        reason: ''
      });
      setActiveTab('leaves');
    } catch (err: any) {
      showToast(err.message || 'Failed to apply for leave', 'error');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Monthly Calendar Calculations
  const calendarData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const totalDays = new Date(year, month, 0).getDate();

    // Map records for this month
    const recordsMap = new Map<string, any>();
    myHistory.forEach(r => {
      if (r.date.startsWith(selectedMonth)) {
        recordsMap.set(r.date, r);
      }
    });

    let presentCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let absentCount = 0;
    let sundaysCount = 0;

    const daysList = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateIso = `${yearStr}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSun = dateObj.getDay() === 0;
      const isPast = dateIso <= todayIso;
      const isToday = dateIso === todayIso;

      if (isSun) sundaysCount++;

      const rec = recordsMap.get(dateIso);
      let statusStr = '—';
      let statusClass = 'chip-future';

      if (isSun) {
        statusStr = 'Sun';
        statusClass = 'status-chip-sun';
      } else if (rec) {
        if (rec.status === 'PRESENT' || rec.status === 'LATE') {
          presentCount++;
          statusStr = 'Present';
          statusClass = 'status-chip-present';
        } else if (rec.status === 'HALF_DAY') {
          halfDayCount++;
          statusStr = 'Half Day';
          statusClass = 'status-chip-half';
        } else if (rec.status === 'LEAVE') {
          leaveCount++;
          statusStr = 'Leave';
          statusClass = 'status-chip-leave';
        } else if (rec.status === 'ABSENT') {
          absentCount++;
          statusStr = 'Absent';
          statusClass = 'status-chip-absent';
        }
      } else {
        if (isPast) {
          absentCount++;
          statusStr = 'Absent';
          statusClass = 'status-chip-absent';
        }
      }

      daysList.push({
        dayNum: d,
        dateIso,
        isSun,
        isToday,
        isPast,
        statusStr,
        statusClass,
        rec
      });
    }

    const workingDays = totalDays - sundaysCount;
    const effectiveDays = presentCount + (halfDayCount * 0.5);
    const attendanceRate = workingDays > 0 ? Math.round((effectiveDays / workingDays) * 100) : 0;

    return {
      year,
      month,
      totalDays,
      workingDays,
      presentCount,
      halfDayCount,
      leaveCount,
      absentCount,
      attendanceRate,
      daysList
    };
  }, [selectedMonth, myHistory, todayIso]);

  return (
    <div className="employee-attendance-page">
      {/* Header */}
      <PageHero
        badge="Attendance & Leaves"
        icon={<Clock size={26} />}
        title="My Attendance & Leave Portal"
        subtitle="Mark your daily presence, track monthly attendance, and manage leave requests."
        actions={
          <button 
            className="btn-hero-primary"
            onClick={() => setShowApplyLeaveModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} /> Apply for Leave
          </button>
        }
      />

      {/* Subnav Pills */}
      <div className="ea-subnav-bar">
        <button 
          className={`ea-nav-btn ${activeTab === 'punch' ? 'active' : ''}`}
          onClick={() => setActiveTab('punch')}
        >
          <Sun size={17} /> Daily Punch
        </button>
        <button 
          className={`ea-nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <CalendarDays size={17} /> Monthly Calendar
        </button>
        <button 
          className={`ea-nav-btn ${activeTab === 'leaves' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaves')}
        >
          <FileText size={17} /> Leave Applications ({myLeaves.length})
        </button>
        <button 
          className={`ea-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={17} /> Attendance Logs
        </button>
        <button 
          className={`ea-nav-btn ${activeTab === 'payroll' ? 'active' : ''}`}
          onClick={() => setActiveTab('payroll')}
        >
          <Wallet size={17} /> My Salary & Advances
        </button>
      </div>

      {/* Salary Cut Policy Notice */}
      <div className="ea-policy-banner">
        <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0 }} />
        <span>
          <strong>Company Attendance Policy:</strong> Each approved leave day or unmarked absence directly cuts that day's pay from your monthly payroll. Half-day presence deducts 0.5 day's pay.
        </span>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY PUNCH */}
      {/* ========================================================================= */}
      {activeTab === 'punch' && (
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
                  {isSunday ? (
                    <span style={{color: '#4338ca', fontWeight: 600}}>
                      🏖️ Sunday is a Weekly Holiday! If you have active field duty or project work today, you can freely punch attendance below.
                    </span>
                  ) : isFullDayWindow ? (
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY CALENDAR GRID */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="ea-calendar-card">
          <div className="ea-cal-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarDays size={20} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A', fontWeight: 800 }}>
                Monthly Attendance Calendar
              </h3>
            </div>

            <div className="month-picker-pill">
              <Calendar size={15} color="#0284c7" />
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
              />
            </div>
          </div>

          {/* Month Summary KPI Strip */}
          <div className="ea-cal-summary-strip">
            <div className="ea-summary-pill">
              <span className="sum-val" style={{ color: '#15803D' }}>{calendarData.presentCount}</span>
              <span className="sum-lbl">Days Present</span>
            </div>
            <div className="ea-summary-pill">
              <span className="sum-val" style={{ color: '#B45309' }}>{calendarData.halfDayCount}</span>
              <span className="sum-lbl">Half Days</span>
            </div>
            <div className="ea-summary-pill">
              <span className="sum-val" style={{ color: '#4338CA' }}>{calendarData.leaveCount}</span>
              <span className="sum-lbl">Leaves Taken</span>
            </div>
            <div className="ea-summary-pill">
              <span className="sum-val" style={{ color: '#B91C1C' }}>{calendarData.absentCount}</span>
              <span className="sum-lbl">Absences</span>
            </div>
            <div className="ea-summary-pill">
              <span className="sum-val" style={{ color: '#0284C7' }}>{calendarData.attendanceRate}%</span>
              <span className="sum-lbl">Attendance Rate</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="ea-month-days-grid">
            {calendarData.daysList.map(item => (
              <div 
                key={item.dayNum} 
                className={`ea-day-cell ${item.isSun ? 'is-sun' : ''} ${item.isToday ? 'is-today' : ''}`}
              >
                <div className="ea-cell-top">
                  <span className="ea-cell-num">{item.dayNum}</span>
                  {item.isToday && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '1px 4px', borderRadius: '4px' }}>
                      Today
                    </span>
                  )}
                </div>

                <div className={`ea-cell-status-chip ${item.statusClass}`}>
                  {item.statusStr}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LEAVE APPLICATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'leaves' && (
        <div className="ea-history-card">
          <div className="ea-history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><FileText size={18} /> My Leave Applications & Status</h3>
            <button 
              className="btn-primary" 
              style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setShowApplyLeaveModal(true)}
            >
              <Plus size={15} /> Apply New Leave
            </button>
          </div>

          <div className="ea-table-wrapper">
            <table className="ea-table">
              <thead>
                <tr>
                  <th>LEAVE TYPE</th>
                  <th>DATES</th>
                  <th>DURATION</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th>ADMIN NOTES</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.map(leave => (
                  <tr key={leave.id}>
                    <td>
                      <span className="font-bold text-navy">{leave.leaveType}</span>
                      {leave.isHalfDay && <span style={{ fontSize: '11px', color: '#B45309', marginLeft: '6px' }}>(Half Day)</span>}
                    </td>
                    <td>
                      <span className="font-semibold">{leave.startDate}</span>
                      {leave.startDate !== leave.endDate && <span> → {leave.endDate}</span>}
                    </td>
                    <td>
                      <span className="leave-duration-badge">{leave.totalDays} Day{leave.totalDays > 1 ? 's' : ''}</span>
                    </td>
                    <td style={{ maxWidth: '240px', fontSize: '13px' }}>
                      "{leave.reason}"
                    </td>
                    <td>
                      <span className={`status-pill status-${leave.status.toLowerCase()}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="text-muted text-xs">
                      {leave.reviewNotes || (leave.status === 'PENDING' ? 'Awaiting Admin Approval' : '—')}
                    </td>
                  </tr>
                ))}
                {myLeaves.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                      You have not applied for any leaves yet. Click "Apply New Leave" above if you need time off.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RECENT ATTENDANCE LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="ea-history-card">
          <div className="ea-history-header">
            <h3><History size={18} /> Detailed Attendance Logs</h3>
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
                      {new Date(rec.date).getDay() === 0 && (
                        <span style={{ display: 'inline-block', fontSize: '10px', background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 700 }}>
                          Sunday Duty
                        </span>
                      )}
                    </td>
                    <td>
                      {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                    </td>
                    <td>
                      <span className="font-bold">
                        {rec.status === 'HALF_DAY' ? 'Half Day' : rec.status === 'LEAVE' ? 'Leave' : 'Full Day'}
                      </span>
                    </td>
                    <td>
                      <span className={`ea-status-pill status-${rec.status.toLowerCase()}`}>
                        {rec.status}
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
                      No attendance records logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MY SALARY, ADVANCES & REMUNERATION PORTAL */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="ea-payroll-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top KPI Remuneration Cards */}
          <div className="ea-remun-kpi-grid">
            <div className="ea-remun-card base">
              <div className="ea-remun-icon-box blue">
                <Wallet size={24} />
              </div>
              <div className="ea-remun-content">
                <span className="ea-remun-lbl">Monthly Base Salary</span>
                <span className="ea-remun-val">₹{(mySalaryConfig?.baseSalary || 25000).toLocaleString()}<span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}> /mo</span></span>
                <div className="ea-remun-sub">
                  <Landmark size={13} /> {mySalaryConfig?.bankName || 'Direct Salary Account'} {mySalaryConfig?.accountNumber ? `(•••• ${mySalaryConfig.accountNumber.slice(-4)})` : ''}
                </div>
              </div>
            </div>

            <div className="ea-remun-card advance">
              <div className="ea-remun-icon-box orange">
                <CreditCard size={24} />
              </div>
              <div className="ea-remun-content">
                <span className="ea-remun-lbl">Active Salary Advance</span>
                <span className="ea-remun-val" style={{ color: myOutstandingAdvance > 0 ? '#dc2626' : '#16a34a' }}>
                  ₹{myOutstandingAdvance.toLocaleString()}
                </span>
                <div className="ea-remun-sub">
                  {myOutstandingAdvance > 0 ? (
                    <span style={{ color: '#b45309', fontWeight: 700 }}>
                      • Monthly deduction active on payroll
                    </span>
                  ) : (
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>
                      ✓ Zero outstanding advance balance
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ea-remun-card policy">
              <div className="ea-remun-icon-box purple">
                <Clock size={24} />
              </div>
              <div className="ea-remun-content">
                <span className="ea-remun-lbl">Attendance Deduction Policy</span>
                <span className="ea-remun-val" style={{ fontSize: '1.05rem', color: '#0f172a' }}>1 Day Cut per Leave/Absence</span>
                <div className="ea-remun-sub">
                  Half-Day presence deducts 0.5 day's pay automatically
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Monthly Payslips */}
          <div className="ea-payroll-block">
            <div className="ea-block-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>My Monthly Payslips</h3>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
                {myPayrolls.length} Generated Statements
              </span>
            </div>

            {myPayrolls.length === 0 ? (
              <div className="ea-payroll-empty-box">
                <FileCheck size={40} color="#94a3b8" />
                <h4>No Finalized Payslips Yet</h4>
                <p>
                  Your daily attendance punch, calendar presence, and approved leaves are tracked automatically towards payroll. 
                  When Accounts finalizes and disburses salaries at month-end, your detailed salary slips with bank UTR and tax/deduction statements will appear here.
                </p>
              </div>
            ) : (
              <div className="ea-payslips-grid">
                {myPayrolls.map((payroll) => (
                  <div key={payroll.id} className="ea-payslip-card">
                    <div className="ea-payslip-top">
                      <div>
                        <span className="ea-payslip-month">{payroll.month}</span>
                        <div className="ea-payslip-role">{payroll.role || 'Staff Employee'}</div>
                      </div>
                      <div className="ea-payslip-status-badge">
                        {payroll.status === 'PAID' ? (
                          <span className="status-pill-paid">✓ PAID</span>
                        ) : (
                          <span className="status-pill-draft">CALCULATED</span>
                        )}
                      </div>
                    </div>

                    <div className="ea-payslip-net-box">
                      <span className="net-lbl">Net Salary Disbursed</span>
                      <span className="net-val">₹{payroll.netPayable.toLocaleString()}</span>
                      {payroll.paymentReference && (
                        <span className="net-ref">UTR / Ref: {payroll.paymentReference}</span>
                      )}
                    </div>

                    {/* Breakdown Chips */}
                    <div className="ea-payslip-chips-grid">
                      <div className="payslip-chip">
                        <label>Base Pay</label>
                        <span>₹{payroll.baseSalary.toLocaleString()}</span>
                      </div>
                      <div className="payslip-chip">
                        <label>Present Days</label>
                        <span>{payroll.presentDays} / {payroll.workingDaysCount || 26}</span>
                      </div>
                      <div className="payslip-chip">
                        <label>Leave Deduction</label>
                        <span style={{ color: payroll.leaveDeduction > 0 ? '#dc2626' : '#64748b' }}>
                          -₹{payroll.leaveDeduction.toLocaleString()}
                        </span>
                      </div>
                      <div className="payslip-chip">
                        <label>Absent Deduction</label>
                        <span style={{ color: payroll.absentDeduction > 0 ? '#dc2626' : '#64748b' }}>
                          -₹{payroll.absentDeduction.toLocaleString()}
                        </span>
                      </div>
                      <div className="payslip-chip">
                        <label>Advance Recovery</label>
                        <span style={{ color: payroll.advanceDeduction > 0 ? '#b45309' : '#64748b' }}>
                          -₹{payroll.advanceDeduction.toLocaleString()}
                        </span>
                      </div>
                      <div className="payslip-chip">
                        <label>Bonus / Incentives</label>
                        <span style={{ color: '#16a34a' }}>+₹{payroll.bonusAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="ea-payslip-actions">
                      <button 
                        className="btn-view-slip"
                        onClick={() => setSelectedPayslipForView(payroll)}
                      >
                        <Printer size={15} /> View & Print Payslip Statement
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Advances & Repayment Ledger */}
          <div className="ea-payroll-block">
            <div className="ea-block-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Advance Disbursements & Recovery Ledger</h3>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
                {myAdvances.length} Advance Records
              </span>
            </div>

            {myAdvances.length === 0 ? (
              <div className="ea-payroll-empty-box">
                <CheckCircle2 size={36} color="#16a34a" />
                <h4>No Advance Records</h4>
                <p>You have not taken any salary advances. Any advances disbursed by Admin will appear here with transparent installment deductions.</p>
              </div>
            ) : (
              <div className="ea-table-container">
                <table className="ea-advances-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Advance ID</th>
                      <th>Disbursed Amount</th>
                      <th>Reason</th>
                      <th>Recovery Plan</th>
                      <th>Recovered</th>
                      <th>Remaining</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAdvances.map((adv) => (
                      <tr key={adv.id}>
                        <td style={{ fontWeight: 600 }}>{adv.date}</td>
                        <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>{adv.id}</td>
                        <td style={{ fontWeight: 800, color: '#0f172a' }}>₹{adv.amount.toLocaleString()}</td>
                        <td style={{ color: '#334155' }}>{adv.reason}</td>
                        <td>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0284c7' }}>
                            {adv.recoveryPlan === 'FULL_NEXT_PAYROLL' ? 'Full Next Payroll' : `Monthly: ₹${(adv.installmentAmount || 0).toLocaleString()}`}
                          </span>
                        </td>
                        <td style={{ color: '#16a34a', fontWeight: 700 }}>₹{adv.recoveredAmount.toLocaleString()}</td>
                        <td style={{ color: adv.remainingBalance > 0 ? '#dc2626' : '#16a34a', fontWeight: 800 }}>
                          ₹{adv.remainingBalance.toLocaleString()}
                        </td>
                        <td>
                          <span className={`status-pill-${adv.status.toLowerCase()}`}>
                            {adv.status === 'SETTLED' ? '✓ SETTLED' : adv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAILED OFFICIAL PAYSLIP STATEMENT */}
      {/* ========================================================================= */}
      {selectedPayslipForView && (
        <div className="modal-overlay" onClick={() => setSelectedPayslipForView(null)}>
          <div className="payslip-modal-content" onClick={e => e.stopPropagation()}>
            <div className="payslip-print-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>MIRROR SOLAR VISION</h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Solar EPC & Clean Energy Solutions • Staff Salary Statement</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="payslip-badge-official">OFFICIAL PAYSLIP</span>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>Period: {selectedPayslipForView.month}</div>
                </div>
              </div>
            </div>

            <div className="payslip-meta-grid">
              <div>
                <label>Employee Name</label>
                <strong>{selectedPayslipForView.employeeName}</strong>
              </div>
              <div>
                <label>Employee ID</label>
                <strong>{selectedPayslipForView.employeeId}</strong>
              </div>
              <div>
                <label>Designation / Role</label>
                <strong>{selectedPayslipForView.role || 'Staff Employee'}</strong>
              </div>
              <div>
                <label>Bank Account</label>
                <strong>{mySalaryConfig?.bankName || 'Bank Account'} {mySalaryConfig?.accountNumber ? `•••• ${mySalaryConfig.accountNumber.slice(-4)}` : ''}</strong>
              </div>
              <div>
                <label>Working Days in Month</label>
                <strong>{selectedPayslipForView.workingDaysCount || selectedPayslipForView.totalDaysInMonth} Days</strong>
              </div>
              <div>
                <label>Days Attended</label>
                <strong>{selectedPayslipForView.presentDays} Full + {selectedPayslipForView.halfDays} Half</strong>
              </div>
            </div>

            {/* Earnings & Deductions 2-Column Table */}
            <div className="payslip-tables-split">
              <div className="payslip-table-box">
                <div className="split-hdr earnings">EARNINGS</div>
                <div className="split-row">
                  <span>Basic Fixed Salary</span>
                  <strong>₹{selectedPayslipForView.baseSalary.toLocaleString()}</strong>
                </div>
                <div className="split-row">
                  <span>Performance Incentive / Bonus</span>
                  <strong>₹{selectedPayslipForView.bonusAmount.toLocaleString()}</strong>
                </div>
                <div className="split-row total">
                  <span>Gross Remuneration</span>
                  <strong>₹{(selectedPayslipForView.baseSalary + selectedPayslipForView.bonusAmount).toLocaleString()}</strong>
                </div>
              </div>

              <div className="payslip-table-box">
                <div className="split-hdr deductions">DEDUCTIONS</div>
                <div className="split-row">
                  <span>Leave Absence Cut ({selectedPayslipForView.leaveDays} leaves)</span>
                  <strong style={{ color: '#dc2626' }}>-₹{selectedPayslipForView.leaveDeduction.toLocaleString()}</strong>
                </div>
                <div className="split-row">
                  <span>Unmarked Absence Cut ({selectedPayslipForView.absentDays} absents)</span>
                  <strong style={{ color: '#dc2626' }}>-₹{selectedPayslipForView.absentDeduction.toLocaleString()}</strong>
                </div>
                <div className="split-row">
                  <span>Salary Advance Repayment</span>
                  <strong style={{ color: '#b45309' }}>-₹{selectedPayslipForView.advanceDeduction.toLocaleString()}</strong>
                </div>
                {selectedPayslipForView.otherDeductions > 0 && (
                  <div className="split-row">
                    <span>Other Deductions</span>
                    <strong style={{ color: '#dc2626' }}>-₹{selectedPayslipForView.otherDeductions.toLocaleString()}</strong>
                  </div>
                )}
                <div className="split-row total">
                  <span>Total Deductions</span>
                  <strong style={{ color: '#dc2626' }}>
                    -₹{(selectedPayslipForView.leaveDeduction + selectedPayslipForView.absentDeduction + selectedPayslipForView.advanceDeduction + selectedPayslipForView.otherDeductions).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Net Payable Highlight Banner */}
            <div className="payslip-net-banner">
              <div>
                <span className="net-sub">NET DISBURSED SALARY</span>
                <span className="net-large">₹{selectedPayslipForView.netPayable.toLocaleString()}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status-pill-${selectedPayslipForView.status.toLowerCase()}`}>
                  ✓ {selectedPayslipForView.status}
                </span>
                {selectedPayslipForView.paymentReference && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                    Txn Ref: {selectedPayslipForView.paymentReference}
                  </div>
                )}
              </div>
            </div>

            <div className="payslip-modal-footer">
              <button 
                type="button" 
                className="btn-print" 
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print / Download PDF
              </button>
              <button 
                type="button" 
                className="btn-close-slip" 
                onClick={() => setSelectedPayslipForView(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APPLY FOR LEAVE */}
      {/* ========================================================================= */}
      {showApplyLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowApplyLeaveModal(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '480px', padding: '1.75rem', background: '#fff', borderRadius: '14px', boxShadow: '0 25px 35px -5px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#0284c7" /> Apply for Leave
              </h3>
              <button className="close-btn" onClick={() => setShowApplyLeaveModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Leave Type *
                </label>
                <select 
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value as LeaveType })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 600 }}
                >
                  <option value="CASUAL">Casual Leave (Personal / Family)</option>
                  <option value="SICK">Sick Leave (Medical / Illness)</option>
                  <option value="PAID">Paid Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                  <option value="UNPAID">Unpaid Leave / LOP</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Start Date *
                  </label>
                  <input 
                    type="date" 
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    End Date *
                  </label>
                  <input 
                    type="date" 
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                <input 
                  type="checkbox" 
                  id="halfDayCheck" 
                  checked={leaveForm.isHalfDay}
                  onChange={(e) => setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="halfDayCheck" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  This is a Half Day Leave (0.5 day salary cut)
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Reason for Leave *
                </label>
                <textarea 
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="e.g. Attending family function, viral fever doctor visit..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  required
                />
              </div>

              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#92400E' }}>
                ℹ️ <strong>Note:</strong> Approving this leave application will deduct the day's salary from your monthly payroll register.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn-outline" 
                  onClick={() => setShowApplyLeaveModal(false)}
                  disabled={isSubmittingLeave}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSubmittingLeave}
                  style={{ background: '#0284c7', borderColor: '#0284c7' }}
                >
                  {isSubmittingLeave ? 'Submitting...' : 'Submit Leave Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CORRECTION REQUEST */}
      {/* ========================================================================= */}
      {selectedRecordForCorrection && (
        <div className="modal-overlay" onClick={() => setSelectedRecordForCorrection(null)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '460px', padding: '1.5rem', background: '#fff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
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
