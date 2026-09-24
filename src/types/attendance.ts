export type AttendanceStatus = 
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF';

export interface GeoLocationPoint {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  address?: string;
  timestamp: string;
}

export interface AttendanceRecord {
  id: string; // e.g. ATT-EMP01-2026-09-24
  employeeId: string;
  employeeName: string;
  employeeRole: 'Employee' | 'Dealer' | 'Admin';
  dealerId?: string;
  dealerName?: string;
  date: string; // YYYY-MM-DD
  
  // Timing
  checkInTime: string | null; // ISO String
  checkOutTime: string | null; // ISO String
  totalWorkingMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  
  // Geolocation
  checkInLocation: GeoLocationPoint | null;
  checkOutLocation: GeoLocationPoint | null;
  
  // Status & Metadata
  status: AttendanceStatus;
  deviceInfo?: string;
  notes?: string;
  verifiedByAdmin?: boolean;
  correctionRequested?: boolean;
  correctionReason?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceConfig {
  officeStartTime: string; // e.g. "09:00"
  officeEndTime: string; // e.g. "18:00"
  gracePeriodMinutes: number; // e.g. 15
  halfDayThresholdHours: number; // e.g. 4.5
  fullDayThresholdHours: number; // e.g. 8
  geofenceRadiusMeters?: number;
  requireLocation: boolean;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  gracePeriodMinutes: 15,
  halfDayThresholdHours: 4.5,
  fullDayThresholdHours: 8,
  requireLocation: true
};
