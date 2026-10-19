export type AuditAction = 
  | 'QUOTATION_CREATED'
  | 'QUOTATION_EDITED'
  | 'QUOTATION_FINALIZED'
  | 'QUOTATION_AMENDED'
  | 'QUOTATION_CANCELLED'
  | 'QUOTATION_STATUS_CHANGED'
  | 'PRICE_CHANGED'
  | 'DISCOUNT_CHANGED'
  | 'INVENTORY_DISPATCHED'
  | 'INVENTORY_RECEIVED'
  | 'INVENTORY_CONSUMED'
  | 'INVENTORY_REVERSED'
  | 'LEAD_STAGE_CHANGED'
  | 'LEAD_CREATED'
  | 'LEAD_DELETED'
  | 'PERMISSION_CHANGED'
  | 'ATTENDANCE_CHECK_IN'
  | 'ATTENDANCE_CHECK_OUT'
  | 'ATTENDANCE_CORRECTED'
  | 'LEAVE_REQUESTED'
  | 'LEAVE_REVIEWED'
  | 'SALARY_CONFIG_UPDATED'
  | 'ADVANCE_DISBURSED'
  | 'ADVANCE_RECOVERED'
  | 'PAYROLL_SAVED'
  | 'PAYROLL_DISBURSED'
  | 'CUSTOMER_DATA_CHANGED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT';

export type EntityType = 
  | 'Quotation'
  | 'Lead'
  | 'Customer'
  | 'Inventory'
  | 'Attendance'
  | 'Payroll'
  | 'User'
  | 'Permission'
  | 'Payment';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: 'Admin' | 'Dealer' | 'Employee' | 'System';
  dealerId?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityLabel?: string;
  timestamp: string; // ISO string
  previousValue?: any;
  newValue?: any;
  diffSummary?: string;
  ipAddress?: string;
  reason?: string;
}
