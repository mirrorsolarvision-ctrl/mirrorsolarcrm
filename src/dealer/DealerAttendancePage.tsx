import { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  UserCheck, 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertCircle,
  XCircle,
  Search,
  ShieldCheck
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import './DealerAttendancePage.css';

export default function DealerAttendancePage() {
  const { employees, currentUser, attendances, markAttendance, removeAttendance } = useCRM();
  const { showToast } = useUI();

  // Date selection state (defaults to Today)
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [searchQuery, setSearchQuery] = useState('');

  const isTodaySelected = selectedDate === todayIso;

  // Format display date
  const formattedDisplayDate = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, [selectedDate]);

  // Strict isolation: Dealer's own staff ONLY
  const dealerStaff = useMemo(() => {
    if (!currentUser) return [];
    return employees.filter(e => e.dealerId === currentUser.id && e.status === 'Active');
  }, [employees, currentUser]);

  // Find attendance records for this dealer & selected date
  const dateAttendanceMap = useMemo(() => {
    const map = new Map<string, { markedAt: string }>();
    attendances.forEach(a => {
      if (a.date === selectedDate && a.dealerId === currentUser?.id && a.status === 'PRESENT') {
        map.set(a.employeeId, { markedAt: a.markedAt });
      }
    });
    return map;
  }, [attendances, selectedDate, currentUser]);

  const staffWithAttendance = useMemo(() => {
    return dealerStaff.map(emp => {
      const att = dateAttendanceMap.get(emp.id);
      return {
        ...emp,
        isPresent: !!att,
        markedAt: att?.markedAt || null
      };
    });
  }, [dealerStaff, dateAttendanceMap]);

  const filteredStaff = useMemo(() => {
    return staffWithAttendance.filter(emp => {
      return (
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.phone && emp.phone.includes(searchQuery))
      );
    });
  }, [staffWithAttendance, searchQuery]);

  // Stats
  const totalActive = dealerStaff.length;
  const totalPresent = staffWithAttendance.filter(e => e.isPresent).length;
  const totalUnmarked = totalActive - totalPresent;

  // Handlers for Today only
  const handleTogglePresent = async (empId: string, empName: string, currentlyPresent: boolean) => {
    if (!isTodaySelected) {
      showToast('Attendance modification is only permitted for today.', 'warning');
      return;
    }
    if (!currentUser) return;

    try {
      if (currentlyPresent) {
        await removeAttendance(empId, selectedDate);
        showToast(`Removed attendance for ${empName}`, 'info');
      } else {
        await markAttendance(empId, selectedDate, currentUser.id);
        showToast(`Marked ${empName} as Present for today`, 'success');
      }
    } catch (err) {
      showToast('Failed to update attendance', 'error');
    }
  };

  return (
    <div className="dealer-attendance-container">
      {/* Header */}
      <div className="dealer-attendance-header">
        <div>
          <h1 className="page-title">Team Attendance</h1>
          <p className="page-subtitle">Track and verify daily attendance for your staff members</p>
        </div>

        {/* Date Selector */}
        <div className="date-picker-control">
          <CalendarIcon size={18} className="text-blue" />
          <input 
            type="date" 
            value={selectedDate}
            max={todayIso}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          {isTodaySelected ? (
            <span className="today-badge">Today</span>
          ) : (
            <button className="reset-today-btn" onClick={() => setSelectedDate(todayIso)}>
              Go to Today
            </button>
          )}
        </div>
      </div>

      {/* Date Banner */}
      <div className="date-summary-banner">
        <div className="banner-left">
          <CalendarIcon size={20} className="banner-icon" />
          <div>
            <span className="banner-date-label">Roster for:</span>
            <span className="banner-date-value">{formattedDisplayDate}</span>
          </div>
        </div>
        {!isTodaySelected && (
          <div className="past-notice-chip">
            <ShieldCheck size={14} /> Historical View (Read-Only)
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="attendance-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap icon-blue">
            <Users size={22} />
          </div>
          <div>
            <span className="stat-number">{totalActive}</span>
            <span className="stat-label">Active Team Members</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap icon-emerald">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="stat-number">{totalPresent}</span>
            <span className="stat-label">Marked Present</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap icon-amber">
            <AlertCircle size={22} />
          </div>
          <div>
            <span className="stat-number">{totalUnmarked}</span>
            <span className="stat-label">Not Marked Yet</span>
          </div>
        </div>
      </div>

      {/* Roster Card */}
      <div className="roster-table-card">
        <div className="roster-table-toolbar">
          <div className="roster-search-input">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="empty-roster">
            <Users size={36} className="empty-icon" />
            <p>No active employees found for this dealership.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Attendance Status</th>
                  <th>Marked Time</th>
                  {isTodaySelected && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="emp-roster-profile">
                        <div className="emp-avatar">{emp.initials || 'EM'}</div>
                        <div>
                          <span className="emp-name">{emp.name}</span>
                          <span className="emp-id-sub">{emp.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {emp.isPresent ? (
                        <span className="status-badge-present">
                          <CheckCircle2 size={14} /> PRESENT
                        </span>
                      ) : (
                        <span className="status-badge-unmarked">
                          <XCircle size={14} /> NOT MARKED
                        </span>
                      )}
                    </td>
                    <td>
                      {emp.isPresent ? (
                        <span className="time-text">
                          <Clock size={13} /> {emp.markedAt || 'Recorded'}
                        </span>
                      ) : (
                        <span className="time-text text-muted">—</span>
                      )}
                    </td>
                    {isTodaySelected && (
                      <td>
                        {emp.isPresent ? (
                          <button 
                            className="btn-unmark-action"
                            onClick={() => handleTogglePresent(emp.id, emp.name, true)}
                            title="Remove Present status"
                          >
                            Remove
                          </button>
                        ) : (
                          <button 
                            className="btn-mark-action"
                            onClick={() => handleTogglePresent(emp.id, emp.name, false)}
                            title="Mark as Present for today"
                          >
                            <CheckCircle2 size={14} /> Mark Present
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
