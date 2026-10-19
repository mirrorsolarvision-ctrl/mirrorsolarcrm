export interface EmployeeSalaryConfig {
  employeeId: string;
  employeeName: string;
  baseSalary: number; // Monthly base salary in ₹
  salaryType: 'MONTHLY' | 'DAILY';
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  panNumber?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type AdvancePaymentMode = 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque';
export type AdvanceStatus = 'ACTIVE' | 'PARTIALLY_RECOVERED' | 'SETTLED' | 'CANCELLED';
export type AdvanceRecoveryPlan = 'FULL_NEXT_PAYROLL' | 'MONTHLY_INSTALLMENT';

export interface EmployeeAdvanceRecord {
  id: string; // e.g. ADV_EMP01_20261015_1234
  employeeId: string;
  employeeName: string;
  amount: number; // Total advance amount disbursed in ₹
  date: string; // YYYY-MM-DD
  paymentMode: AdvancePaymentMode;
  referenceNumber?: string; // UTR or transaction ID
  reason: string;
  recoveryPlan: AdvanceRecoveryPlan;
  installmentAmount?: number; // per month deduction if installment
  recoveredAmount: number;
  remainingBalance: number;
  status: AdvanceStatus;
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export type PayrollStatus = 'DRAFT' | 'APPROVED' | 'PAID';

export interface MonthlyPayrollRecord {
  id: string; // e.g. PAYROLL_2026_10_EMP01
  month: string; // YYYY-MM e.g. "2026-10"
  employeeId: string;
  employeeName: string;
  role: string;
  baseSalary: number;
  
  // Attendance Breakdown
  totalDaysInMonth: number;
  sundaysCount: number;
  workingDaysCount: number;
  presentDays: number; // Full days marked PRESENT
  halfDays: number;    // HALF_DAY marked count
  leaveDays: number;   // Approved LEAVE days count
  absentDays: number;  // ABSENT / Unmarked count
  
  // Per-day rate calculation: baseSalary / totalDaysInMonth
  perDayRate: number;
  
  // Salary Deductions
  // Direct business rule: If employee takes leave, salary is cut for that day
  leaveDeduction: number;   // (leaveDays * perDayRate) + (halfDays * perDayRate * 0.5)
  absentDeduction: number;  // (absentDays * perDayRate)
  advanceDeduction: number; // Deducted towards employee's active advances
  otherDeductions: number;  // Any penalties, TDS, etc.
  deductionNotes?: string;
  
  // Bonuses / Allowances
  bonusAmount: number;
  bonusReason?: string;
  
  // Financial Totals
  grossEarned: number; // baseSalary - leaveDeduction - absentDeduction
  netPayable: number;  // Math.max(0, grossEarned - advanceDeduction - otherDeductions + bonusAmount)
  
  status: PayrollStatus;
  paymentDate?: string;
  paymentMode?: string;
  paymentReference?: string; // UTR or Txn ID
  generatedAt: string;
  paidAt?: string;
  notes?: string;
}
