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
  Shield,
  Filter,
  Plus,
  Trash2
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import { useUI } from './context/UIContext';
import './AdminAttendancePage.css';

export default function AdminAttendancePage() {
  const { employees, attendances, markAttendance, removeAttendance } = useCRM();
  const { showToast } = useUI();

  // Date selection state (defaults to Today)
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Present' | 'Unmarked'>('All');

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

  // Company Staff ONLY (dealerId is null or undefined)
  const companyEmployees = useMemo(() => {
    return employees.filter(e => (!e.dealerId || e.dealerId === null) && e.status === 'Active');
  }, [employees]);

  // Map attendance records for selectedDate for Company Staff
  const dateAttendanceMap = useMemo(() => {
    const map = new Map<string, { markedAt: string }>();
    attendances.forEach(a => {
      if (a.date === selectedDate && (!a.dealerId || a.dealerId === null) && a.status === 'PRESENT') {
        map.set(a.employeeId, { markedAt: a.markedAt });
      }
    });
    return map;
  }, [attendances, selectedDate]);

  const staffWithAttendance = useMemo(() => {
    return companyEmployees.map(emp => {
      const att = dateAttendanceMap.get(emp.id);
      return {
        ...emp,
        isPresent: !!att,
        markedAt: att?.markedAt || null
      };
    });
  }, [companyEmployees, dateAttendanceMap]);

  const filteredStaff = useMemo(() => {
    return staffWithAttendance.filter(emp => {
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.phone && emp.phone.includes(searchQuery));
      
      const matchesStatus = 
        statusFilter === 'All' ? true :
        statusFilter === 'Present' ? emp.isPresent :
        !emp.isPresent;

      return matchesSearch && matchesStatus;
    });
  }, [staffWithAttendance, searchQuery, statusFilter]);

  // Metrics
  const totalCompanyStaff = companyEmployees.length;
  const presentCount = staffWithAttendance.filter(e => e.isPresent).length;
  const unmarkedCount = totalCompanyStaff - presentCount;
  const attendanceRate = totalCompanyStaff > 0 ? Math.round((presentCount / totalCompanyStaff) * 100) : 0;

  // Admin Actions (can mark/remove for Today and Past dates)
  const handleToggleAttendance = async (empId: string, empName: string, currentlyPresent: boolean) => {
    if (selectedDate > todayIso) {
      showToast('Attendance cannot be marked for future dates', 'warning');
      return;
    }

    try {
      if (currentlyPresent) {
        await removeAttendance(empId, selectedDate);
        showToast(`Attendance removed for ${empName} on ${selectedDate}`, 'info');
      } else {
        await markAttendance(empId, selectedDate, null);
        showToast(`Marked ${empName} as Present for ${selectedDate}`, 'success');
      }
    } catch (err) {
      showToast('Failed to update attendance record', 'error');
    }
  };

  return (
    <div className="admin-attendance-container">
      {/* Header */}
      <div className="admin-attendance-header">
        <div>
          <h1 className="page-title">Company Staff Attendance</h1>
          <p className="page-subtitle">Manage, view, and adjust daily attendance logs for internal company employees</p>
        </div>

        {/* Date Selector */}
        <div className="admin-date-picker-wrap">
          <CalendarIcon size={18} className="text-blue" />
          <input 
            type="date" 
            value={selectedDate}
            max={todayIso} // No future records
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          {isTodaySelected ? (
            <span className="today-badge">Today</span>
          ) : (
            <button className="reset-today-btn" onClick={() => setSelectedDate(todayIso)}>
              Back to Today
            </button>
          )}
        </div>
      </div>

      {/* Date Banner */}
      <div className="admin-date-summary-banner">
        <div className="banner-left">
          <CalendarIcon size={22} className="banner-icon" />
          <div>
            <span className="banner-date-label">Showing attendance for</span>
            <span className="banner-date-value">{formattedDisplayDate}</span>
          </div>
        </div>
        <div className="admin-authority-badge">
          <Shield size={14} /> Full Admin Authority (Today & Past Logs)
        </div>
      </div>

      {/* Metrics */}
      <div className="admin-att-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap icon-blue">
            <Users size={22} />
          </div>
          <div>
            <span className="metric-number">{totalCompanyStaff}</span>
            <span className="metric-label">Total Company Staff</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-emerald">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="metric-number">{presentCount}</span>
            <span className="metric-label">Present</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-amber">
            <AlertCircle size={22} />
          </div>
          <div>
            <span className="metric-number">{unmarkedCount}</span>
            <span className="metric-label">Not Marked</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap icon-purple">
            <UserCheck size={22} />
          </div>
          <div>
            <span className="metric-number">{attendanceRate}%</span>
            <span className="metric-label">Attendance Rate</span>
          </div>
        </div>
      </div>

      {/* Roster & Table */}
      <div className="admin-roster-card">
        <div className="roster-toolbar">
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search company employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="status-filter-buttons">
            {(['All', 'Present', 'Unmarked'] as const).map(tab => (
              <button
                key={tab}
                className={`filter-btn ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="empty-state-wrap">
            <Users size={40} className="empty-icon" />
            <h3>No employees found</h3>
            <p>No active company staff match the current filters.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-roster-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Contact</th>
                  <th>Status on {selectedDate}</th>
                  <th>Marked At</th>
                  <th>Admin Override</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="emp-info-cell">
                        <div className="emp-avatar">{emp.initials || 'EM'}</div>
                        <div>
                          <span className="emp-name">{emp.name}</span>
                          <span className="emp-id">{emp.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="emp-contact-text">
                        <span>{emp.email || '—'}</span>
                        <span className="phone-sub">{emp.phone || '—'}</span>
                      </div>
                    </td>
                    <td>
                      {emp.isPresent ? (
                        <span className="badge-present">
                          <CheckCircle2 size={14} /> PRESENT
                        </span>
                      ) : (
                        <span className="badge-unmarked">
                          <XCircle size={14} /> NOT MARKED
                        </span>
                      )}
                    </td>
                    <td>
                      {emp.isPresent ? (
                        <span className="time-display">
                          <Clock size={13} /> {emp.markedAt}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {emp.isPresent ? (
                        <button 
                          className="btn-admin-unmark"
                          onClick={() => handleToggleAttendance(emp.id, emp.name, true)}
                          title="Remove Attendance record"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      ) : (
                        <button 
                          className="btn-admin-mark"
                          onClick={() => handleToggleAttendance(emp.id, emp.name, false)}
                          title="Mark as Present"
                        >
                          <CheckCircle2 size={14} /> Mark Present
                        </button>
                      )}
                    </td>
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
