import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  UserCheck, 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertCircle,
  XCircle,
  Search,
  Filter,
  Trash2,
  Check,
  X,
  FileCheck,
  Download,
  CalendarDays,
  FileText,
  Sparkles,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import { useAttendance } from './context/AttendanceContext';
import { useUI } from './context/UIContext';
import { formatEmployeeCode } from './utils/idUtils';
import PageHero from './components/PageHero';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { AttendanceStatus, AttendanceRecord } from './types/attendance';
import './AdminAttendancePage.css';

export default function AdminAttendancePage() {
  const { employees, attendances, markAttendance, removeAttendance } = useCRM();
  const { 
    records: liveAttendanceRecords, 
    correctionRequests, 
    reviewCorrection,
    leaveRequests,
    reviewLeave,
    adminUpdateRecord
  } = useAttendance();
  const { showToast } = useUI();

  // Active Sub-Tab: 'roster' | 'monthly' | 'leaves' | 'corrections'
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'monthly' | 'leaves' | 'corrections'>('roster');

  // Daily Date Selection (defaults to Today)
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Present' | 'Unmarked'>('All');

  // Monthly Matrix Selection (defaults to current Month e.g. "2026-10")
  const currentMonthStr = useMemo(() => todayIso.substring(0, 7), [todayIso]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [matrixSearch, setMatrixSearch] = useState('');

  // Leaves Tab Filter
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'All' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Inline Cell Popover State for Matrix Cell Edit
  const [activeCellEdit, setActiveCellEdit] = useState<{
    empId: string;
    empName: string;
    date: string;
    currentStatus?: AttendanceStatus;
  } | null>(null);

  const isTodaySelected = selectedDate === todayIso;

  // Format display date for Daily Roster
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

  // Merge attendances between CRMContext and AttendanceContext for absolute reliability
  const combinedAttendanceMap = useMemo(() => {
    const map = new Map<string, { status: AttendanceStatus; markedAt?: string; notes?: string }>();
    
    // First CRM attendances
    attendances.forEach(a => {
      const key = `${a.employeeId}_${a.date}`;
      map.set(key, { status: a.status as AttendanceStatus, markedAt: a.markedAt });
    });

    // Then Live Firestore records from AttendanceContext
    liveAttendanceRecords.forEach(r => {
      const key = `${r.employeeId}_${r.date}`;
      map.set(key, {
        status: r.status,
        markedAt: r.checkInTime ? r.checkInTime.split('T')[1]?.substring(0, 5) : undefined,
        notes: r.notes
      });
    });

    return map;
  }, [attendances, liveAttendanceRecords]);

  // Daily Staff List with merged status
  const staffWithAttendance = useMemo(() => {
    return companyEmployees.map(emp => {
      const rec = combinedAttendanceMap.get(`${emp.id}_${selectedDate}`);
      const isPresent = rec?.status === 'PRESENT' || rec?.status === 'LATE';
      return {
        ...emp,
        isPresent,
        statusVal: rec?.status || (isPresent ? 'PRESENT' : 'UNMARKED'),
        markedAt: rec?.markedAt || null
      };
    });
  }, [companyEmployees, combinedAttendanceMap, selectedDate]);

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

  // Daily Metrics
  const totalCompanyStaff = companyEmployees.length;
  const presentCount = staffWithAttendance.filter(e => e.isPresent).length;
  const unmarkedCount = totalCompanyStaff - presentCount;
  const attendanceRate = totalCompanyStaff > 0 ? Math.round((presentCount / totalCompanyStaff) * 100) : 0;

  // Pending Counts
  const pendingLeavesCount = useMemo(() => {
    return (leaveRequests || []).filter(l => l.status === 'PENDING').length;
  }, [leaveRequests]);

  const pendingCorrectionsCount = useMemo(() => {
    return (correctionRequests || []).filter(c => c.status === 'PENDING').length;
  }, [correctionRequests]);

  // Month breakdown for Monthly Sheet
  const monthDetails = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const totalDays = new Date(year, month, 0).getDate();

    const daysArray: { dayNum: number; dateStr: string; isSunday: boolean }[] = [];
    let sundaysCount = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${yearStr}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSunday = dateObj.getDay() === 0;
      if (isSunday) sundaysCount++;
      daysArray.push({ dayNum: d, dateStr, isSunday });
    }

    const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return { year, month, totalDays, daysArray, sundaysCount, workingDays: totalDays - sundaysCount, monthName };
  }, [selectedMonth]);

  // Monthly Matrix Rows Calculation
  const monthlyMatrixRows = useMemo(() => {
    return companyEmployees
      .filter(emp => !matrixSearch || emp.name.toLowerCase().includes(matrixSearch.toLowerCase()))
      .map(emp => {
        let presentDays = 0;
        let halfDays = 0;
        let leaveDays = 0;
        let absentDays = 0;

        const dayStatusMap = new Map<number, { status: string; isSunday: boolean; isFuture: boolean }>();

        monthDetails.daysArray.forEach(d => {
          const isFuture = d.dateStr > todayIso;

          if (d.isSunday) {
            dayStatusMap.set(d.dayNum, { status: 'SUN', isSunday: true, isFuture });
            return;
          }

          const record = combinedAttendanceMap.get(`${emp.id}_${d.dateStr}`);

          if (record) {
            if (record.status === 'PRESENT' || record.status === 'LATE') {
              presentDays++;
              dayStatusMap.set(d.dayNum, { status: 'P', isSunday: false, isFuture });
            } else if (record.status === 'HALF_DAY') {
              halfDays++;
              dayStatusMap.set(d.dayNum, { status: 'H', isSunday: false, isFuture });
            } else if (record.status === 'LEAVE') {
              leaveDays++;
              dayStatusMap.set(d.dayNum, { status: 'L', isSunday: false, isFuture });
            } else if (record.status === 'ABSENT') {
              absentDays++;
              dayStatusMap.set(d.dayNum, { status: 'A', isSunday: false, isFuture });
            } else {
              if (isFuture) {
                dayStatusMap.set(d.dayNum, { status: '—', isSunday: false, isFuture: true });
              } else {
                absentDays++;
                dayStatusMap.set(d.dayNum, { status: 'A', isSunday: false, isFuture: false });
              }
            }
          } else {
            if (isFuture) {
              dayStatusMap.set(d.dayNum, { status: '—', isSunday: false, isFuture: true });
            } else {
              absentDays++;
              dayStatusMap.set(d.dayNum, { status: 'A', isSunday: false, isFuture: false });
            }
          }
        });

        const effectiveWorkedDays = presentDays + (halfDays * 0.5);
        const rate = monthDetails.workingDays > 0 ? Math.round((effectiveWorkedDays / monthDetails.workingDays) * 100) : 0;

        return {
          emp,
          dayStatusMap,
          presentDays,
          halfDays,
          leaveDays,
          absentDays,
          effectiveWorkedDays,
          rate
        };
      });
  }, [companyEmployees, matrixSearch, monthDetails, combinedAttendanceMap, todayIso]);

  // Admin Actions: Daily Toggle
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

  // Admin Action: Matrix Cell Status Override
  const handleSetDayStatus = async (empId: string, dateStr: string, status: AttendanceStatus) => {
    try {
      const recordId = `ATT_${empId}_${dateStr}`;
      const isHalf = status === 'HALF_DAY';
      const workingMins = status === 'PRESENT' ? 480 : isHalf ? 240 : 0;
      
      await adminUpdateRecord(recordId, {
        date: dateStr,
        employeeId: empId,
        status,
        totalWorkingMinutes: workingMins,
        verifiedByAdmin: true,
        notes: `Admin manually updated status to ${status}`
      });

      if (status === 'PRESENT') {
        await markAttendance(empId, dateStr, null);
      } else if (status === 'ABSENT') {
        await removeAttendance(empId, dateStr);
      }

      showToast(`Updated attendance status to ${status} for ${dateStr}`, 'success');
      setActiveCellEdit(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to update day status', 'error');
    }
  };

  // Leave Review Action
  const handleReviewLeave = async (id: string, approve: boolean, notes?: string) => {
    try {
      await reviewLeave(id, approve, notes);
      showToast(
        approve 
          ? '✓ Leave approved! Attendance records updated accordingly.' 
          : 'Leave request rejected.',
        approve ? 'success' : 'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to review leave request', 'error');
    }
  };

  // Correction Review Action
  const handleReviewCorrection = async (id: string, approve: boolean) => {
    try {
      await reviewCorrection(id, approve);
      showToast(approve ? 'Correction request approved and attendance updated!' : 'Correction request rejected.', approve ? 'success' : 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to review request', 'error');
    }
  };

  // Export Matrix to CSV
  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      ...monthDetails.daysArray.map(d => `${d.dayNum}${d.isSunday ? ' (Sun)' : ''}`),
      'Present (P)',
      'Half Day (H)',
      'Leaves (L)',
      'Absents (A)',
      'Attendance %'
    ];

    const rows = monthlyMatrixRows.map(r => {
      const dayCols = monthDetails.daysArray.map(d => {
        const item = r.dayStatusMap.get(d.dayNum);
        return item?.status || '—';
      });

      return [
        r.emp.id,
        `"${r.emp.name}"`,
        ...dayCols,
        r.presentDays,
        r.halfDays,
        r.leaveDays,
        r.absentDays,
        `${r.rate}%`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MirrorSolar_Attendance_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${selectedMonth} Attendance CSV!`, 'success');
  };

  // --- IMPORT ATTENDANCE SHEET LOGIC ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInputMode, setImportInputMode] = useState<'upload' | 'paste'>('upload');
  const [rawPastedText, setRawPastedText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [parsedImportRows, setParsedImportRows] = useState<Array<{
    employeeId: string;
    employeeName: string;
    date: string;
    status: AttendanceStatus;
    inTime?: string;
    outTime?: string;
    notes?: string;
    isValid: boolean;
    error?: string;
  }>>([]);
  const [isExecutingImport, setIsExecutingImport] = useState(false);

  // Download Sample Template (Pre-filled with active company staff)
  const handleDownloadTemplate = () => {
    const headers = ['Date (YYYY-MM-DD)', 'Employee ID', 'Employee Name', 'Status (PRESENT/HALF_DAY/LEAVE/ABSENT)', 'In Time (HH:MM)', 'Out Time (HH:MM)', 'Notes'];
    const rows = companyEmployees.map(emp => [
      selectedDate || todayIso,
      emp.id,
      `"${emp.name}"`,
      'PRESENT',
      '09:30',
      '18:30',
      'Full Day Office Duty'
    ].join(','));

    const sampleCsv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(sampleCsv);
    const link = document.createElement('a');
    link.href = encoded;
    link.download = `MirrorSolar_Attendance_Template_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded attendance sample CSV template!', 'info');
  };

  // Parse CSV text (supports comma, tab, semicolon)
  const parseCSVData = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      setParsedImportRows([]);
      return;
    }

    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const splitLine = (line: string) => {
      const regex = new RegExp(`(?:^|${delimiter})("(?:[^"]|"")*"|[^${delimiter}]*)`, 'g');
      const row: string[] = [];
      let m;
      while ((m = regex.exec(line)) !== null) {
        let val = m[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        row.push(val.trim());
      }
      return row;
    };

    const matchStaff = (raw: string) => {
      if (!raw) return null;
      const clean = raw.trim().toLowerCase();
      return companyEmployees.find(e => {
        const eName = e.name.toLowerCase();
        const eId = e.id.toLowerCase();
        if (eId === clean || eName === clean) return true;
        if (clean === 'kumari' && eName.includes('kumari')) return true;
        if (clean === 'gopal' && (eName.includes('gopal') || eName.includes('sai gopal'))) return true;
        if ((clean === 'shiva' || clean === 'siva') && (eName.includes('siva') || eName.includes('shiva') || eName.includes('sunkara'))) return true;
        return (clean.length > 2 && (eName.includes(clean) || clean.includes(eName)));
      });
    };

    // Scan for month in title lines
    let docMonth = selectedMonth;
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const l = lines[i].toUpperCase();
      if (l.includes('OCTOBER') && l.includes('2026')) docMonth = '2026-10';
      else if (l.includes('NOVEMBER') && l.includes('2026')) docMonth = '2026-11';
      else if (l.includes('DECEMBER') && l.includes('2026')) docMonth = '2026-12';
      else if (l.includes('SEPTEMBER') && l.includes('2026')) docMonth = '2026-09';
    }

    // Locate header row
    let headerRowIndex = 0;
    let headerCols = splitLine(lines[0]);
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const row = splitLine(lines[i]);
      const rowLower = row.map(c => c.toLowerCase());
      if (rowLower.includes('date') || rowLower.includes('day') || rowLower.includes('employee id') || rowLower.includes('employee name')) {
        headerRowIndex = i;
        headerCols = row;
        break;
      }
    }

    const header = headerCols.map(h => h.toLowerCase());
    const isMatrix = header.some(h => /^[0-9]{1,2}$/.test(h.replace(/\s+/g, '')));

    // Check if header contains employee name columns (Format 3)
    const staffColMatches: Array<{ index: number; emp: typeof companyEmployees[0] }> = [];
    headerCols.forEach((colName, idx) => {
      if (idx === 0 || idx === 1) {
        const lower = colName.toLowerCase();
        if (lower === 'date' || lower === 'day' || lower === 's.no' || lower === 'sl') return;
      }
      const matched = matchStaff(colName);
      if (matched) {
        staffColMatches.push({ index: idx, emp: matched });
      }
    });

    const parsed: typeof parsedImportRows = [];

    if (staffColMatches.length > 0) {
      // FORMAT 3: DAILY REGISTER WITH EMPLOYEE COLUMNS (e.g. October Register)
      for (let i = headerRowIndex + 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (cols.length === 0 || cols.every(c => !c)) continue;

        const dayNum = parseInt(cols[0].replace(/\D/g, ''), 10);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

        const [y, m] = docMonth.split('-');
        const dateStr = `${y}-${m.padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const holidayNote = cols[cols.length - 1] || '';

        staffColMatches.forEach(({ index, emp }) => {
          const rawStatus = (cols[index] || '').trim().toUpperCase();
          if (!rawStatus || rawStatus === '—' || rawStatus === '-') return;

          let status: AttendanceStatus = 'PRESENT';
          if (rawStatus === 'P' || rawStatus === 'PRESENT') status = 'PRESENT';
          else if (rawStatus === 'H' || rawStatus === 'HALF_DAY' || rawStatus === '0.5') status = 'HALF_DAY';
          else if (rawStatus === 'L' || rawStatus === 'LEAVE') status = 'LEAVE';
          else if (rawStatus === 'A' || rawStatus === 'ABSENT' || rawStatus === '0') status = 'ABSENT';
          else return;

          parsed.push({
            employeeId: emp.id,
            employeeName: emp.name,
            date: dateStr,
            status,
            isValid: true,
            notes: holidayNote || 'Daily Register Import'
          });
        });
      }
    } else if (isMatrix) {
      // MONTHLY MATRIX FORMAT: Employee ID, Name, 1, 2, ... 31
      const dayColIndices: Array<{ dayNum: number; index: number }> = [];
      header.forEach((h, idx) => {
        const clean = h.replace(/\D/g, '');
        const n = parseInt(clean, 10);
        if (!isNaN(n) && n >= 1 && n <= 31) {
          dayColIndices.push({ dayNum: n, index: idx });
        }
      });

      for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (cols.length < 2) continue;
        const rawEmpId = cols[0];
        const rawEmpName = cols[1];

        // Match staff
        const matchedEmp = companyEmployees.find(e => 
          e.id.toLowerCase() === rawEmpId.toLowerCase() ||
          e.name.toLowerCase() === rawEmpName.toLowerCase() ||
          (rawEmpName.length > 2 && (e.name.toLowerCase().includes(rawEmpName.toLowerCase()) || rawEmpName.toLowerCase().includes(e.name.toLowerCase())))
        );

        if (!matchedEmp) continue;

        dayColIndices.forEach(({ dayNum, index }) => {
          const rawStatus = (cols[index] || '').trim().toUpperCase();
          if (!rawStatus || rawStatus === '—' || rawStatus === '-') return;

          let status: AttendanceStatus = 'PRESENT';
          if (rawStatus === 'P' || rawStatus === 'PRESENT') status = 'PRESENT';
          else if (rawStatus === 'H' || rawStatus === 'HALF_DAY' || rawStatus === 'HALF DAY' || rawStatus === '0.5') status = 'HALF_DAY';
          else if (rawStatus === 'L' || rawStatus === 'LEAVE') status = 'LEAVE';
          else if (rawStatus === 'A' || rawStatus === 'ABSENT' || rawStatus === '0') status = 'ABSENT';
          else if (rawStatus === 'SUN' || rawStatus === 'OFF') return;

          const [yearStr, monthStr] = selectedMonth.split('-');
          const dateStr = `${yearStr}-${monthStr.padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

          parsed.push({
            employeeId: matchedEmp.id,
            employeeName: matchedEmp.name,
            date: dateStr,
            status,
            isValid: true,
            notes: 'Imported from Monthly Matrix Sheet'
          });
        });
      }
    } else {
      // DAILY ROW-BY-ROW FORMAT
      let dateIdx = header.findIndex(h => h.includes('date'));
      let idIdx = header.findIndex(h => h.includes('id') || h.includes('code'));
      let nameIdx = header.findIndex(h => h.includes('name') || h.includes('staff') || h.includes('emp'));
      let statusIdx = header.findIndex(h => h.includes('status') || h.includes('punch') || h.includes('attend'));
      let inIdx = header.findIndex(h => h.includes('in') || h.includes('check in'));
      let outIdx = header.findIndex(h => h.includes('out') || h.includes('check out'));
      let notesIdx = header.findIndex(h => h.includes('note') || h.includes('remark'));

      if (dateIdx === -1) dateIdx = 0;
      if (idIdx === -1 && nameIdx === -1) {
        idIdx = 1;
        nameIdx = 2;
      }
      if (statusIdx === -1) statusIdx = 3;

      for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (cols.length === 0 || cols.every(c => !c)) continue;

        let rawDate = (cols[dateIdx] || '').trim();
        const rawId = idIdx >= 0 ? (cols[idIdx] || '').trim() : '';
        const rawName = nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '';
        const rawStatus = (cols[statusIdx] || 'PRESENT').trim().toUpperCase();
        const inTime = inIdx >= 0 ? (cols[inIdx] || '').trim() : undefined;
        const outTime = outIdx >= 0 ? (cols[outIdx] || '').trim() : undefined;
        const notes = notesIdx >= 0 ? (cols[notesIdx] || '').trim() : undefined;

        // Parse date (DD/MM/YYYY or YYYY-MM-DD)
        let parsedDate = rawDate;
        if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(rawDate)) {
          const parts = rawDate.split(/[-/]/);
          parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          parsedDate = selectedDate || todayIso;
        }

        // Match staff
        const matchedEmp = companyEmployees.find(e => 
          (rawId && e.id.toLowerCase() === rawId.toLowerCase()) ||
          (rawName && e.name.toLowerCase() === rawName.toLowerCase()) ||
          (rawName && rawName.length > 2 && (e.name.toLowerCase().includes(rawName.toLowerCase()) || rawName.toLowerCase().includes(e.name.toLowerCase()))) ||
          (rawId && (e.email || '').toLowerCase().includes(rawId.toLowerCase()))
        );

        let status: AttendanceStatus = 'PRESENT';
        if (rawStatus.startsWith('H') || rawStatus === '0.5') status = 'HALF_DAY';
        else if (rawStatus.startsWith('L') || rawStatus.includes('LEAVE')) status = 'LEAVE';
        else if (rawStatus.startsWith('A') || rawStatus === '0') status = 'ABSENT';
        else status = 'PRESENT';

        if (!matchedEmp) {
          parsed.push({
            employeeId: rawId || 'UNKNOWN',
            employeeName: rawName || rawId || 'Unrecognized Staff',
            date: parsedDate,
            status,
            inTime,
            outTime,
            notes,
            isValid: false,
            error: `Employee not found in Company Staff directory`
          });
        } else {
          parsed.push({
            employeeId: matchedEmp.id,
            employeeName: matchedEmp.name,
            date: parsedDate,
            status,
            inTime,
            outTime,
            notes,
            isValid: true
          });
        }
      }
    }

    setParsedImportRows(parsed);
  };

  // File Upload Reader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        parseCSVData(content);
        showToast(`Loaded ${file.name} successfully!`, 'info');
      }
    };
    reader.readAsText(file);
  };

  // Confirm Import & Save to Firestore
  const handleConfirmImport = async () => {
    const validRows = parsedImportRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showToast('No valid attendance records to import.', 'warning');
      return;
    }

    setIsExecutingImport(true);
    let successCount = 0;
    try {
      for (const row of validRows) {
        const recordId = `ATT_${row.employeeId}_${row.date}`;
        const workingMins = row.status === 'HALF_DAY' ? 240 : (row.status === 'PRESENT' ? 480 : 0);
        
        const payload: AttendanceRecord = {
          id: recordId,
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          employeeRole: 'Employee',
          date: row.date,
          checkInTime: row.inTime ? `${row.date}T${row.inTime}:00.000Z` : `${row.date}T09:30:00.000Z`,
          checkOutTime: row.outTime ? `${row.date}T${row.outTime}:00.000Z` : (row.status === 'HALF_DAY' ? `${row.date}T13:30:00.000Z` : `${row.date}T18:30:00.000Z`),
          totalWorkingMinutes: workingMins,
          lateMinutes: 0,
          overtimeMinutes: 0,
          checkInLocation: null,
          checkOutLocation: null,
          status: row.status,
          deviceInfo: 'Imported via Admin Attendance Sheet',
          notes: row.notes || 'Bulk imported via Admin Attendance Sheet',
          verifiedByAdmin: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'attendance', recordId), payload, { merge: true });

        if (row.status === 'PRESENT') {
          await markAttendance(row.employeeId, row.date, null);
        } else if (row.status === 'ABSENT') {
          await removeAttendance(row.employeeId, row.date);
        }
        successCount++;
      }

      showToast(`✓ Successfully imported ${successCount} attendance records! Monthly sheet updated.`, 'success');
      setIsImportModalOpen(false);
      setParsedImportRows([]);
      setRawPastedText('');
      setImportFileName('');
    } catch (err: any) {
      showToast(err.message || 'Failed during bulk attendance import', 'error');
    } finally {
      setIsExecutingImport(false);
    }
  };

  return (
    <div className="admin-attendance-container">
      {/* Top Page Hero with Sub-Navigation */}
      <PageHero
        badge="Attendance & Leave Operations"
        icon={<UserCheck size={26} />}
        title="Staff Attendance & Leave Governance"
        subtitle="Manage daily rosters, review monthly attendance sheets, and process employee leave applications."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className={`admin-subnav-pill ${activeSubTab === 'roster' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('roster')}
            >
              <CalendarIcon size={16} /> Daily Roster
            </button>
            <button 
              className={`admin-subnav-pill ${activeSubTab === 'monthly' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('monthly')}
            >
              <CalendarDays size={16} /> Monthly Sheet
            </button>
            <button 
              className={`admin-subnav-pill ${activeSubTab === 'leaves' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('leaves')}
            >
              <FileText size={16} /> Leaves
              {pendingLeavesCount > 0 && (
                <span className="subnav-badge-count">{pendingLeavesCount}</span>
              )}
            </button>
            <button 
              className={`admin-subnav-pill ${activeSubTab === 'corrections' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('corrections')}
            >
              <FileCheck size={16} /> Corrections
              {pendingCorrectionsCount > 0 && (
                <span className="subnav-badge-count">{pendingCorrectionsCount}</span>
              )}
            </button>

            <button 
              className="btn-hero-primary"
              onClick={() => setIsImportModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#10b981', border: 'none', marginLeft: '6px' }}
              title="Import Biometric or Monthly Attendance Excel/CSV sheet"
            >
              <Upload size={16} /> Import Sheet
            </button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* VIEW 1: MONTHLY ATTENDANCE SHEET (MATRIX GRID) */}
      {/* ========================================================================= */}
      {activeSubTab === 'monthly' && (
        <div className="admin-roster-card" style={{ marginTop: '0.5rem' }}>
          {/* Matrix Toolbar */}
          <div className="matrix-toolbar">
            <div className="matrix-toolbar-left">
              <div className="month-picker-pill">
                <CalendarDays size={16} color="#0284c7" />
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)} 
                />
              </div>

              <div className="search-bar" style={{ maxWidth: '240px' }}>
                <Search size={15} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Filter employee..." 
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {/* Status Legend */}
              <div className="matrix-legend">
                <span className="legend-item"><span className="matrix-chip chip-p">P</span> Present</span>
                <span className="legend-item"><span className="matrix-chip chip-h">H</span> Half Day</span>
                <span className="legend-item"><span className="matrix-chip chip-l">L</span> Leave (Cut)</span>
                <span className="legend-item"><span className="matrix-chip chip-a">A</span> Absent (Cut)</span>
                <span className="legend-item"><span className="matrix-chip chip-sun">Sun</span> Off</span>
              </div>

              <button 
                className="btn-admin-mark"
                onClick={handleExportCSV}
                style={{ padding: '6px 14px', background: '#0284c7' }}
              >
                <Download size={15} /> Export CSV
              </button>

              <button 
                className="btn-admin-mark"
                onClick={() => setIsImportModalOpen(true)}
                style={{ padding: '6px 14px', background: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={15} /> Import Sheet (CSV/Excel)
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="matrix-scroll-wrapper">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="emp-col-header">Employee</th>
                  {monthDetails.daysArray.map(d => (
                    <th 
                      key={d.dayNum} 
                      className={d.isSunday ? 'sun-header' : ''}
                      title={`${d.dateStr} (${d.isSunday ? 'Sunday' : 'Working Day'})`}
                    >
                      {d.dayNum}
                      <div style={{ fontSize: '9px', fontWeight: 500, color: d.isSunday ? '#EF4444' : '#94A3B8' }}>
                        {d.isSunday ? 'Sun' : ''}
                      </div>
                    </th>
                  ))}
                  <th className="summary-col-header" title="Full Days Present">P</th>
                  <th className="summary-col-header" title="Half Days Present">H</th>
                  <th className="summary-col-header" title="Approved Leaves Taken">L</th>
                  <th className="summary-col-header" title="Days Absent">A</th>
                  <th className="summary-col-header" title="Attendance %">%</th>
                </tr>
              </thead>
              <tbody>
                {monthlyMatrixRows.map(({ emp, dayStatusMap, presentDays, halfDays, leaveDays, absentDays, rate }) => (
                  <tr key={emp.id}>
                    <td className="emp-col-cell">
                      <div className="emp-info-cell">
                        <div className="emp-avatar">{emp.initials || emp.name.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <span className="emp-name" style={{ fontSize: '0.82rem' }}>{emp.name}</span>
                          <span className="emp-id" style={{ fontSize: '0.7rem' }}>{formatEmployeeCode(emp)}</span>
                        </div>
                      </div>
                    </td>

                    {monthDetails.daysArray.map(d => {
                      const item = dayStatusMap.get(d.dayNum);
                      const status = item?.status || '—';
                      const isSun = d.isSunday;
                      const isFuture = item?.isFuture;

                      let chipClass = 'chip-future';
                      if (isSun) chipClass = 'chip-sun';
                      else if (status === 'P') chipClass = 'chip-p';
                      else if (status === 'H') chipClass = 'chip-h';
                      else if (status === 'L') chipClass = 'chip-l';
                      else if (status === 'A') chipClass = 'chip-a';

                      return (
                        <td key={d.dayNum} className={isSun ? 'sun-cell' : ''}>
                          <span 
                            className={`matrix-chip ${chipClass}`}
                            onClick={() => {
                              if (!isSun && !isFuture) {
                                setActiveCellEdit({
                                  empId: emp.id,
                                  empName: emp.name,
                                  date: d.dateStr,
                                  currentStatus: status === 'P' ? 'PRESENT' : status === 'H' ? 'HALF_DAY' : status === 'L' ? 'LEAVE' : 'ABSENT'
                                });
                              }
                            }}
                            title={
                              isSun ? 'Sunday (Weekly Off)' :
                              isFuture ? 'Future Date' :
                              `${emp.name} on ${d.dateStr}: ${status} (Click to edit)`
                            }
                          >
                            {status}
                          </span>
                        </td>
                      );
                    })}

                    <td className="summary-col-cell" style={{ color: '#15803D' }}>{presentDays}</td>
                    <td className="summary-col-cell" style={{ color: '#B45309' }}>{halfDays}</td>
                    <td className="summary-col-cell" style={{ color: '#4338CA' }}>{leaveDays}</td>
                    <td className="summary-col-cell" style={{ color: '#B91C1C' }}>{absentDays}</td>
                    <td className="summary-col-cell" style={{ fontWeight: 800 }}>{rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Inline Edit Cell Modal */}
          {activeCellEdit && (
            <div className="modal-overlay" onClick={() => setActiveCellEdit(null)}>
              <div 
                className="modal-content" 
                style={{ maxWidth: '380px', padding: '20px' }} 
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: 700 }}>
                    Adjust Attendance Status
                  </h4>
                  <button className="close-btn" onClick={() => setActiveCellEdit(null)}><X size={18} /></button>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#64748B' }}>
                  Employee: <strong style={{ color: '#0F172A' }}>{activeCellEdit.empName}</strong><br />
                  Date: <strong style={{ color: '#0284C7' }}>{activeCellEdit.date}</strong>
                </p>

                <div className="popover-btn-list">
                  <button 
                    className="popover-btn" 
                    style={{ color: '#15803D', background: '#DCFCE7' }}
                    onClick={() => handleSetDayStatus(activeCellEdit.empId, activeCellEdit.date, 'PRESENT')}
                  >
                    <CheckCircle2 size={16} /> Set as Present (Full Day)
                  </button>
                  <button 
                    className="popover-btn" 
                    style={{ color: '#B45309', background: '#FEF3C7' }}
                    onClick={() => handleSetDayStatus(activeCellEdit.empId, activeCellEdit.date, 'HALF_DAY')}
                  >
                    <Clock size={16} /> Set as Half Day (0.5 Cut)
                  </button>
                  <button 
                    className="popover-btn" 
                    style={{ color: '#4338CA', background: '#E0E7FF' }}
                    onClick={() => handleSetDayStatus(activeCellEdit.empId, activeCellEdit.date, 'LEAVE')}
                  >
                    <FileText size={16} /> Set as Approved Leave (1.0 Cut)
                  </button>
                  <button 
                    className="popover-btn" 
                    style={{ color: '#B91C1C', background: '#FEE2E2' }}
                    onClick={() => handleSetDayStatus(activeCellEdit.empId, activeCellEdit.date, 'ABSENT')}
                  >
                    <XCircle size={16} /> Set as Absent (1.0 Cut)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: LEAVE REQUESTS & APPROVALS */}
      {/* ========================================================================= */}
      {activeSubTab === 'leaves' && (
        <div className="admin-roster-card" style={{ marginTop: '0.5rem' }}>
          <div className="roster-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A' }}>
                Employee Leave Requests
              </h3>
              {pendingLeavesCount > 0 && (
                <span className="badge-leave-pending">
                  {pendingLeavesCount} Pending Review
                </span>
              )}
            </div>

            <div className="status-filter-buttons">
              {(['All', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
                <button
                  key={st}
                  className={`filter-btn ${leaveStatusFilter === st ? 'active' : ''}`}
                  onClick={() => setLeaveStatusFilter(st)}
                >
                  {st === 'All' ? 'All Leaves' : st}
                </button>
              ))}
            </div>
          </div>

          {(leaveRequests || []).length === 0 ? (
            <div className="empty-state-wrap">
              <CheckCircle2 size={40} className="empty-icon text-emerald" />
              <h3>No Leave Applications</h3>
              <p>Employees haven't submitted any leave requests yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-roster-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Dates & Duration</th>
                    <th>Reason</th>
                    <th>Applied At</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(leaveRequests || [])
                    .filter(l => leaveStatusFilter === 'All' ? true : l.status === leaveStatusFilter)
                    .map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div className="font-bold text-navy">{req.employeeName}</div>
                          <div className="text-muted text-xs">{req.employeeId} • {req.employeeRole}</div>
                        </td>
                        <td>
                          <span className="leave-type-chip">{req.leaveType}</span>
                          {req.isHalfDay && (
                            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                              (Half Day)
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="leave-date-range">
                            {req.startDate} {req.startDate !== req.endDate ? `→ ${req.endDate}` : ''}
                          </span>
                          <span className="leave-duration-badge">
                            {req.totalDays} Day{req.totalDays > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td style={{ maxWidth: '260px', fontSize: '13px' }}>
                          "{req.reason}"
                        </td>
                        <td className="text-muted text-xs">
                          {req.appliedAt ? new Date(req.appliedAt).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {req.status === 'PENDING' ? (
                            <span className="badge-leave-pending">Pending</span>
                          ) : req.status === 'APPROVED' ? (
                            <span className="badge-leave-approved">Approved</span>
                          ) : (
                            <span className="badge-leave-rejected">Rejected</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {req.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button 
                                className="btn-admin-mark" 
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                                onClick={() => handleReviewLeave(req.id, true)}
                                title="Approve Leave and update attendance"
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button 
                                className="btn-admin-unmark" 
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                                onClick={() => handleReviewLeave(req.id, false)}
                                title="Reject Leave"
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted text-xs">
                              Reviewed by {req.reviewedBy || 'Admin'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: CORRECTION REQUESTS */}
      {/* ========================================================================= */}
      {activeSubTab === 'corrections' && (
        <div className="admin-roster-card" style={{ marginTop: '0.5rem' }}>
          <div className="roster-toolbar">
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A' }}>
              Employee Attendance Correction Requests
            </h3>
          </div>

          {(correctionRequests || []).length === 0 ? (
            <div className="empty-state-wrap">
              <CheckCircle2 size={40} className="empty-icon text-emerald" />
              <h3>No Correction Requests</h3>
              <p>All employee punch logs are in sync with zero pending adjustments.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-roster-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Requested Times</th>
                    <th>Reason / Justification</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(correctionRequests || []).map((req) => (
                    <tr key={req.id}>
                      <td className="font-bold text-navy">{req.employeeName}</td>
                      <td>{req.date}</td>
                      <td>
                        <span className="time-display">
                          <Clock size={12} /> {req.requestedCheckIn.split('T')[1]?.substring(0, 5) || 'In'} → {req.requestedCheckOut ? req.requestedCheckOut.split('T')[1]?.substring(0, 5) : 'Out'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '280px', fontSize: '13px' }}>{req.reason}</td>
                      <td>
                        <span className={`badge-${req.status === 'APPROVED' ? 'present' : req.status === 'REJECTED' ? 'unmarked' : 'present'}`} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {req.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              className="btn-admin-mark" 
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => handleReviewCorrection(req.id, true)}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button 
                              className="btn-admin-unmark" 
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => handleReviewCorrection(req.id, false)}
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted text-xs">Reviewed by {req.reviewedBy || 'Admin'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: DAILY STAFF ROSTER (DEFAULT) */}
      {/* ========================================================================= */}
      {activeSubTab === 'roster' && (
        <>
          {/* Date Selector */}
          <div className="admin-date-picker-wrap">
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
              <span className="historical-badge">Past Record</span>
            )}
            <span className="display-date-label">{formattedDisplayDate}</span>
          </div>

          {/* Metrics Grid */}
          <div className="admin-att-metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-wrap icon-blue">
                <Users size={22} />
              </div>
              <div>
                <span className="metric-number">{totalCompanyStaff}</span>
                <span className="metric-label">Active Company Staff</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap icon-green">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="metric-number">{presentCount}</span>
                <span className="metric-label">Present on Date</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap icon-amber">
                <Clock size={22} />
              </div>
              <div>
                <span className="metric-number">{unmarkedCount}</span>
                <span className="metric-label">Unmarked / Absent</span>
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
                              <span className="emp-id">{formatEmployeeCode(emp)}</span>
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
        </>
      )}
      {/* ========================================================================= */}
      {/* ATTENDANCE SHEET IMPORT MODAL (EXCEL / CSV / BIOMETRIC PUNCH LOGS) */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => !isExecutingImport && setIsImportModalOpen(false)}>
          <div className="attendance-import-modal" onClick={e => e.stopPropagation()}>
            <div className="import-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="import-modal-icon-badge">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3>Import Attendance Sheet</h3>
                  <p>Bulk import attendance records from biometric machines, Excel files, or CSV logs.</p>
                </div>
              </div>
              <button 
                className="detail-close" 
                onClick={() => !isExecutingImport && setIsImportModalOpen(false)} 
                disabled={isExecutingImport}
              >
                <X size={20} />
              </button>
            </div>

            {/* Input Mode Selector */}
            <div className="import-mode-switch">
              <button 
                className={`import-mode-tab ${importInputMode === 'upload' ? 'active' : ''}`}
                onClick={() => setImportInputMode('upload')}
              >
                <Upload size={16} /> Upload CSV File
              </button>
              <button 
                className={`import-mode-tab ${importInputMode === 'paste' ? 'active' : ''}`}
                onClick={() => setImportInputMode('paste')}
              >
                <FileText size={16} /> Paste Excel Rows (Ctrl+V)
              </button>
            </div>

            <div className="import-modal-body">
              {/* Template Download & Tips */}
              <div className="import-guidance-card">
                <div>
                  <strong>Supported Formats:</strong>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '3px' }}>
                    1. <strong>Daily Log Format:</strong> <code>Date, Employee ID/Name, Status (P/H/L/A), In Time, Out Time, Notes</code><br />
                    2. <strong>Monthly Matrix Format:</strong> <code>Employee ID, Name, 1, 2, 3... 31</code> (Round-trip compatible with Export CSV)
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn-download-template" 
                  onClick={handleDownloadTemplate}
                  title="Download CSV format template pre-populated with company staff"
                >
                  <Download size={14} /> Download Sample Template
                </button>
              </div>

              {/* Upload Dropzone */}
              {importInputMode === 'upload' ? (
                <div className="import-dropzone">
                  <input 
                    type="file" 
                    id="attendanceCsvFile" 
                    accept=".csv, .txt, .tsv, text/csv, text/plain" 
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="attendanceCsvFile" className="dropzone-label">
                    <Upload size={32} color="#0284c7" />
                    <span className="dropzone-title">Click to browse or drop attendance sheet</span>
                    <span className="dropzone-subtitle">Accepts .CSV, .TXT (Comma or Tab Separated)</span>
                    {importFileName && (
                      <div className="selected-filename-badge">
                        <FileCheck size={14} /> {importFileName}
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div className="import-paste-area">
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                    Paste your Excel columns or comma/tab-separated rows:
                  </label>
                  <textarea 
                    className="import-textarea"
                    placeholder="Date, Employee ID, Employee Name, Status&#10;2026-10-16, EMP01, Aditya Sharma, PRESENT&#10;2026-10-16, MSV-SIVA-001, Sunkara Siva, HALF_DAY"
                    rows={6}
                    value={rawPastedText}
                    onChange={(e) => {
                      setRawPastedText(e.target.value);
                      parseCSVData(e.target.value);
                    }}
                  />
                </div>
              )}

              {/* Preview & Validation Summary */}
              {parsedImportRows.length > 0 && (
                <div className="import-preview-section">
                  <div className="preview-summary-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} color="#0284c7" />
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>Parsed Records Preview</strong>
                    </div>
                    <div className="preview-badges-wrap">
                      <span className="stat-pill total">Total: {parsedImportRows.length}</span>
                      <span className="stat-pill valid">Ready: {parsedImportRows.filter(r => r.isValid).length}</span>
                      {parsedImportRows.filter(r => !r.isValid).length > 0 && (
                        <span className="stat-pill error">Unmatched: {parsedImportRows.filter(r => !r.isValid).length}</span>
                      )}
                    </div>
                  </div>

                  <div className="preview-table-container">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Employee</th>
                          <th>Status</th>
                          <th>In / Out</th>
                          <th>Status Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedImportRows.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className={row.isValid ? '' : 'invalid-row'}>
                            <td style={{ fontWeight: 600 }}>{row.date}</td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.employeeName}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.employeeId}</div>
                            </td>
                            <td>
                              <span className={`status-chip-${row.status.toLowerCase()}`} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                                {row.status === 'HALF_DAY' ? 'Half Day' : row.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                              {row.inTime || '09:30'} — {row.outTime || '18:30'}
                            </td>
                            <td>
                              {row.isValid ? (
                                <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Check size={14} /> Matched
                                </span>
                              ) : (
                                <span style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertCircle size={14} /> {row.error || 'Check employee name/ID'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedImportRows.length > 15 && (
                      <div style={{ textAlign: 'center', padding: '8px', fontSize: '0.78rem', color: '#64748b', background: '#f8fafc' }}>
                        + {parsedImportRows.length - 15} more records will be processed.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="import-modal-footer">
              <button 
                type="button" 
                className="btn-modal-cancel" 
                onClick={() => setIsImportModalOpen(false)}
                disabled={isExecutingImport}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-modal-confirm" 
                onClick={handleConfirmImport}
                disabled={isExecutingImport || parsedImportRows.filter(r => r.isValid).length === 0}
              >
                {isExecutingImport ? 'Importing & Syncing...' : `Confirm & Save (${parsedImportRows.filter(r => r.isValid).length} Records)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
