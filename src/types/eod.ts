export interface EodReport {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCategory: string; // 'Marketing Employee' | 'PM Surya Ghar Incharge' | 'Stock Incharge' | string
  email: string;
  date: string; // YYYY-MM-DD
  summary: string;
  callsMade?: number;
  visitsCompleted?: number;
  leadsCreated?: number;
  kycApplicationsProcessed?: number;
  subsidyDocumentsVerified?: number;
  dispatchesCompleted?: number;
  nextDayPlan: string;
  blockersOrIssues?: string;
  createdAt: string;
}
