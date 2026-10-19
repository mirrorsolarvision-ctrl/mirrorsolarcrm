import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, addDoc, query, orderBy } from 'firebase/firestore';
import type { AttendanceRecord, AttendanceStatus, AttendanceConfig, GeoLocationPoint, AttendanceCorrectionRequest, LeaveRequest, LeaveType } from '../types/attendance';
import { DEFAULT_ATTENDANCE_CONFIG, calculateGeofenceDistance } from '../types/attendance';
import { useAuth } from './AuthContext';
import { useAudit } from './AuditLogContext';

interface AttendanceContextType {
  records: AttendanceRecord[];
  todayRecord: AttendanceRecord | null;
  config: AttendanceConfig;
  loading: boolean;
  correctionRequests: AttendanceCorrectionRequest[];
  leaveRequests: LeaveRequest[];
  checkIn: (options?: { notes?: string }) => Promise<AttendanceRecord>;
  checkOut: (options?: { notes?: string }) => Promise<AttendanceRecord>;
  markAttendance: (type: 'FULL_DAY' | 'HALF_DAY', notes?: string) => Promise<AttendanceRecord>;
  adminUpdateRecord: (id: string, updates: Partial<AttendanceRecord>, reason?: string) => Promise<void>;
  requestCorrection: (attendanceId: string, date: string, requestedCheckIn: string, requestedCheckOut: string, reason: string) => Promise<void>;
  reviewCorrection: (requestId: string, approved: boolean, reviewNotes?: string) => Promise<void>;
  applyLeave: (leaveData: Omit<LeaveRequest, 'id' | 'status' | 'appliedAt'>) => Promise<LeaveRequest>;
  reviewLeave: (requestId: string, approved: boolean, reviewNotes?: string) => Promise<void>;
  updateConfig: (newConfig: Partial<AttendanceConfig>) => void;
  getRecordsByEmployee: (employeeId: string) => AttendanceRecord[];
  getRecordsByDateRange: (startDate: string, endDate: string) => AttendanceRecord[];
  getEmployeeLeaves: (employeeId: string) => LeaveRequest[];
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const useAttendance = () => {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within an AttendanceProvider');
  return ctx;
};

export const AttendanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<AttendanceCorrectionRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [config, setConfig] = useState<AttendanceConfig>(DEFAULT_ATTENDANCE_CONFIG);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const { logAction } = useAudit();

  const getTodayString = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    try {
      const q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: AttendanceRecord[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as AttendanceRecord);
        });
        setRecords(fetched);
        setLoading(false);
      }, (err) => {
        console.warn('Attendance snapshot fallback:', err.message);
        setLoading(false);
      });

      const corrQ = query(collection(db, 'attendance_corrections'), orderBy('createdAt', 'desc'));
      const unsubCorr = onSnapshot(corrQ, (snapshot) => {
        const fetchedCorr: AttendanceCorrectionRequest[] = [];
        snapshot.forEach((d) => {
          fetchedCorr.push({ id: d.id, ...d.data() } as AttendanceCorrectionRequest);
        });
        setCorrectionRequests(fetchedCorr);
      }, (err) => {
        console.warn('Correction requests fallback:', err.message);
      });

      const leavesQ = query(collection(db, 'employee_leaves'), orderBy('appliedAt', 'desc'));
      const unsubLeaves = onSnapshot(leavesQ, (snapshot) => {
        const fetchedLeaves: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          fetchedLeaves.push({ id: d.id, ...d.data() } as LeaveRequest);
        });
        setLeaveRequests(fetchedLeaves);
      }, (err) => {
        console.warn('Leave requests fallback:', err.message);
      });

      return () => {
        unsubscribe();
        unsubCorr();
        unsubLeaves();
      };
    } catch (err) {
      console.warn('Attendance init fallback:', err);
      setLoading(false);
    }
  }, []);

  const todayRecord = records.find(
    (r) => r.employeeId === currentUser?.id && r.date === getTodayString()
  ) || null;

  const getCurrentGeoLocation = (): Promise<GeoLocationPoint | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy),
            timestamp: new Date().toISOString()
          });
        },
        (err) => {
          console.warn('Geolocation denied/unavailable:', err.message);
          resolve(null);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  };

  const calculateLateMinutes = (checkInDate: Date): number => {
    const [startHour, startMin] = config.officeStartTime.split(':').map(Number);
    const expectedTime = new Date(checkInDate);
    expectedTime.setHours(startHour, startMin, 0, 0);

    const diffMs = checkInDate.getTime() - expectedTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    return diffMinutes > config.gracePeriodMinutes ? diffMinutes : 0;
  };

  const checkIn = async (options?: { notes?: string }): Promise<AttendanceRecord> => {
    if (!currentUser) throw new Error('User must be logged in to check in');
    
    const today = getTodayString();
    const existing = records.find((r) => r.employeeId === currentUser.id && r.date === today);
    if (existing && existing.checkInTime) {
      throw new Error('Already checked in for today');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const location = await getCurrentGeoLocation();
    const lateMinutes = calculateLateMinutes(now);
    const status: AttendanceStatus = lateMinutes > 0 ? 'LATE' : 'PRESENT';

    let geofenceNote = '';
    if (location && config.officeLatitude && config.officeLongitude) {
      const distance = calculateGeofenceDistance(
        location.latitude,
        location.longitude,
        config.officeLatitude,
        config.officeLongitude
      );
      if (distance > config.geofenceRadiusMeters) {
        geofenceNote = `[OUT OF GEOFENCE: ${distance}m from Office]`;
      } else {
        geofenceNote = `[ON-SITE: ${distance}m from Office]`;
      }
    }

    const recordId = `ATT_${currentUser.id}_${today}`;
    const newRecord: AttendanceRecord = {
      id: recordId,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      employeeRole: (currentUser.role as any) || 'Employee',
      dealerId: (currentUser as any)?.dealerId,
      dealerName: (currentUser as any)?.dealerName,
      date: today,
      checkInTime: nowIso,
      checkOutTime: null,
      totalWorkingMinutes: 0,
      lateMinutes,
      overtimeMinutes: 0,
      checkInLocation: location,
      checkOutLocation: null,
      status,
      deviceInfo: navigator.userAgent.substring(0, 100),
      notes: [options?.notes, geofenceNote].filter(Boolean).join(' | '),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    try {
      await setDoc(doc(db, 'attendance', recordId), newRecord);
    } catch (err) {
      console.error('Attendance Firestore error:', err);
      setRecords((prev) => [newRecord, ...prev]);
    }

    await logAction({
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'Attendance',
      entityId: recordId,
      entityLabel: `${currentUser.name} Checked In (${status})`,
      newValue: newRecord,
      reason: lateMinutes > 0 ? `Late by ${lateMinutes} minutes` : 'On-time check-in'
    });

    return newRecord;
  };

  const checkOut = async (options?: { notes?: string }): Promise<AttendanceRecord> => {
    if (!currentUser) throw new Error('User must be logged in');
    if (!todayRecord || !todayRecord.checkInTime) {
      throw new Error('You must check in first before checking out');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const checkInDate = new Date(todayRecord.checkInTime);
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - checkInDate.getTime()) / 60000));
    const location = await getCurrentGeoLocation();

    // Determine if worked enough for full day or half day
    let finalStatus: AttendanceStatus = todayRecord.status;
    const workedHours = elapsedMinutes / 60;
    if (workedHours < config.halfDayThresholdHours) {
      finalStatus = 'HALF_DAY';
    }

    const updates: Partial<AttendanceRecord> = {
      checkOutTime: nowIso,
      checkOutLocation: location,
      totalWorkingMinutes: elapsedMinutes,
      status: finalStatus,
      notes: options?.notes ? `${todayRecord.notes ? todayRecord.notes + ' | ' : ''}${options.notes}` : todayRecord.notes,
      updatedAt: nowIso
    };

    try {
      await updateDoc(doc(db, 'attendance', todayRecord.id), updates);
    } catch (err) {
      console.error('Checkout error:', err);
      setRecords((prev) => prev.map((r) => (r.id === todayRecord.id ? { ...r, ...updates } : r)));
    }

    const updatedRecord = { ...todayRecord, ...updates };

    await logAction({
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'Attendance',
      entityId: todayRecord.id,
      entityLabel: `${currentUser.name} Checked Out (${elapsedMinutes} mins)`,
      newValue: updatedRecord
    });

    return updatedRecord;
  };

  const markAttendance = async (type: 'FULL_DAY' | 'HALF_DAY', notes?: string): Promise<AttendanceRecord> => {
    if (!currentUser) throw new Error('User must be logged in to mark attendance');
    const today = getTodayString();
    const now = new Date();
    const nowIso = now.toISOString();
    const recordId = `ATT_${currentUser.id}_${today}`;
    const status: AttendanceStatus = type === 'FULL_DAY' ? 'PRESENT' : 'HALF_DAY';
    const totalWorkingMinutes = type === 'FULL_DAY' ? 480 : 240;

    let location: GeoLocationPoint | null = null;
    try {
      location = await getCurrentGeoLocation();
    } catch {
      // Non-blocking fallback
    }

    const record: AttendanceRecord = {
      id: recordId,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      employeeRole: (currentUser.role as any) || 'Employee',
      dealerId: (currentUser as any)?.dealerId,
      dealerName: (currentUser as any)?.dealerName,
      date: today,
      checkInTime: todayRecord?.checkInTime || nowIso,
      checkOutTime: type === 'HALF_DAY' ? nowIso : null,
      totalWorkingMinutes,
      lateMinutes: 0,
      overtimeMinutes: 0,
      checkInLocation: location || todayRecord?.checkInLocation || null,
      checkOutLocation: null,
      status,
      deviceInfo: navigator.userAgent.substring(0, 100),
      notes: notes || (type === 'FULL_DAY' ? 'Full Day Attendance Marked (Present)' : 'Half Day Attendance Marked'),
      createdAt: todayRecord?.createdAt || nowIso,
      updatedAt: nowIso
    };

    try {
      await setDoc(doc(db, 'attendance', recordId), record, { merge: true });
    } catch (err) {
      console.error('Attendance Firestore error:', err);
    }

    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === recordId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });

    await logAction({
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'Attendance',
      entityId: recordId,
      entityLabel: `${currentUser.name} Marked ${type === 'FULL_DAY' ? 'Full Day (Present)' : 'Half Day'}`,
      newValue: record,
      reason: `Direct marked ${type}`
    });

    return record;
  };

  const adminUpdateRecord = async (id: string, updates: Partial<AttendanceRecord>, reason?: string) => {
    const existing = records.find((r) => r.id === id);
    if (!existing) return;

    const payload = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'attendance', id), payload);
    } catch (err) {
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    }

    await logAction({
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'Attendance',
      entityId: id,
      entityLabel: `Admin adjusted attendance for ${existing.employeeName}`,
      previousValue: existing,
      newValue: { ...existing, ...payload },
      reason: reason || 'Admin manual correction'
    });
  };

  const requestCorrection = async (
    attendanceId: string,
    date: string,
    requestedCheckIn: string,
    requestedCheckOut: string,
    reason: string
  ) => {
    if (!currentUser) throw new Error('User must be logged in');
    const correctionReq: AttendanceCorrectionRequest = {
      id: `CORR_${currentUser.id}_${Date.now()}`,
      attendanceId,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      date,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'attendance_corrections'), correctionReq);
    } catch (err) {
      console.warn('Correction request local fallback:', err);
      setCorrectionRequests((prev) => [correctionReq, ...prev]);
    }

    await logAction({
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'Attendance',
      entityId: attendanceId,
      entityLabel: `${currentUser.name} requested correction for ${date}`,
      reason
    });
  };

  const reviewCorrection = async (
    requestId: string,
    approved: boolean,
    reviewNotes?: string
  ) => {
    if (currentUser?.role !== 'Admin') throw new Error('Only admins can approve attendance corrections');
    const req = correctionRequests.find((c) => c.id === requestId);
    if (!req) return;

    const status = approved ? 'APPROVED' : 'REJECTED';
    const payload = {
      status,
      reviewedBy: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes || (approved ? 'Approved by Admin' : 'Rejected by Admin')
    };

    try {
      await updateDoc(doc(db, 'attendance_corrections', requestId), payload);
    } catch (err) {
      setCorrectionRequests((prev) =>
        prev.map((c) => (c.id === requestId ? { ...c, ...payload } as any : c))
      );
    }

    if (approved) {
      await adminUpdateRecord(
        req.attendanceId,
        {
          checkInTime: req.requestedCheckIn,
          checkOutTime: req.requestedCheckOut || null,
          correctionRequested: false,
          verifiedByAdmin: true
        },
        `Approved Correction: ${req.reason}`
      );
    }
  };

  const applyLeave = async (
    leaveData: Omit<LeaveRequest, 'id' | 'status' | 'appliedAt'>
  ): Promise<LeaveRequest> => {
    if (!currentUser) throw new Error('User must be logged in to apply for leave');

    const leaveId = `LEAVE_${currentUser.id}_${Date.now()}`;
    const newLeave: LeaveRequest = {
      ...leaveData,
      id: leaveId,
      status: 'PENDING',
      appliedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'employee_leaves', leaveId), newLeave);
    } catch (err) {
      console.warn('Leave request local fallback:', err);
      setLeaveRequests((prev) => [newLeave, ...prev]);
    }

    await logAction({
      action: 'LEAVE_REQUESTED',
      entityType: 'Attendance',
      entityId: leaveId,
      entityLabel: `${newLeave.employeeName} applied for ${newLeave.leaveType} (${newLeave.totalDays} day(s))`,
      newValue: newLeave,
      reason: newLeave.reason
    });

    return newLeave;
  };

  const reviewLeave = async (
    requestId: string,
    approved: boolean,
    reviewNotes?: string
  ) => {
    if (currentUser?.role !== 'Admin') throw new Error('Only admins can approve leave requests');
    const leaveReq = leaveRequests.find((l) => l.id === requestId);
    if (!leaveReq) return;

    const status = approved ? 'APPROVED' : 'REJECTED';
    const payload = {
      status,
      reviewedBy: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes || (approved ? 'Leave Approved by Admin' : 'Leave Rejected by Admin')
    };

    try {
      await updateDoc(doc(db, 'employee_leaves', requestId), payload);
    } catch (err) {
      setLeaveRequests((prev) =>
        prev.map((l) => (l.id === requestId ? ({ ...l, ...payload } as any) : l))
      );
    }

    // If approved, create or update attendance records for each date in the range as LEAVE
    if (approved) {
      const cur = new Date(leaveReq.startDate + 'T00:00:00');
      const end = new Date(leaveReq.endDate + 'T00:00:00');

      while (cur <= end) {
        const dateStr = cur.toISOString().split('T')[0];
        const isSunday = cur.getDay() === 0;

        // Skip sundays since they are weekly off
        if (!isSunday) {
          const recordId = `ATT_${leaveReq.employeeId}_${dateStr}`;
          const isHalf = !!leaveReq.isHalfDay;
          const statusVal: AttendanceStatus = isHalf ? 'HALF_DAY' : 'LEAVE';
          const workingMins = isHalf ? 240 : 0;

          const leaveAttendanceRecord: AttendanceRecord = {
            id: recordId,
            employeeId: leaveReq.employeeId,
            employeeName: leaveReq.employeeName,
            employeeRole: leaveReq.employeeRole,
            dealerId: leaveReq.dealerId || undefined,
            date: dateStr,
            checkInTime: null,
            checkOutTime: null,
            totalWorkingMinutes: workingMins,
            lateMinutes: 0,
            overtimeMinutes: 0,
            checkInLocation: null,
            checkOutLocation: null,
            status: statusVal,
            notes: `Approved Leave: ${leaveReq.leaveType} (${leaveReq.reason})`,
            verifiedByAdmin: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          try {
            await setDoc(doc(db, 'attendance', recordId), leaveAttendanceRecord, { merge: true });
          } catch (err) {
            console.error('Failed to write leave attendance record:', err);
          }

          setRecords((prev) => {
            const idx = prev.findIndex((r) => r.id === recordId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = leaveAttendanceRecord;
              return updated;
            }
            return [leaveAttendanceRecord, ...prev];
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    await logAction({
      action: 'LEAVE_REVIEWED',
      entityType: 'Attendance',
      entityId: requestId,
      entityLabel: `Admin ${approved ? 'Approved' : 'Rejected'} leave for ${leaveReq.employeeName}`,
      reason: reviewNotes || (approved ? 'Leave approved' : 'Leave rejected')
    });
  };

  const updateConfig = (newConfig: Partial<AttendanceConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const getRecordsByEmployee = (employeeId: string) => records.filter((r) => r.employeeId === employeeId);
  const getRecordsByDateRange = (startDate: string, endDate: string) =>
    records.filter((r) => r.date >= startDate && r.date <= endDate);
  const getEmployeeLeaves = (employeeId: string) => leaveRequests.filter((l) => l.employeeId === employeeId);

  return (
    <AttendanceContext.Provider
      value={{
        records,
        todayRecord,
        config,
        loading,
        correctionRequests,
        leaveRequests,
        checkIn,
        checkOut,
        markAttendance,
        adminUpdateRecord,
        requestCorrection,
        reviewCorrection,
        applyLeave,
        reviewLeave,
        updateConfig,
        getRecordsByEmployee,
        getRecordsByDateRange,
        getEmployeeLeaves
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};
