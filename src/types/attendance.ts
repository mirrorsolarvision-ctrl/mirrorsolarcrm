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

export interface AttendanceCorrectionRequest {
  id: string;
  attendanceId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  requestedCheckIn: string;
  requestedCheckOut?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface AttendanceConfig {
  officeStartTime: string; // e.g. "09:00"
  officeEndTime: string; // e.g. "18:00"
  gracePeriodMinutes: number; // e.g. 15
  halfDayThresholdHours: number; // e.g. 4.5
  fullDayThresholdHours: number; // e.g. 8
  
  // Geofence Policy
  requireLocation: boolean;
  officeLatitude: number;
  officeLongitude: number;
  geofenceRadiusMeters: number;
  maxAccuracyLimitMeters: number;
  allowFieldPunchWithFlag: boolean;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  gracePeriodMinutes: 15,
  halfDayThresholdHours: 4.5,
  fullDayThresholdHours: 8,
  
  // Mirror Solar Office HQ Geofence (Example coords with 500m radius)
  requireLocation: true,
  officeLatitude: 16.5062,
  officeLongitude: 80.6480,
  geofenceRadiusMeters: 500,
  maxAccuracyLimitMeters: 150,
  allowFieldPunchWithFlag: true
};

/**
 * Calculates distance in meters between two GPS coordinates using the Haversine formula
 */
export function calculateGeofenceDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
}
