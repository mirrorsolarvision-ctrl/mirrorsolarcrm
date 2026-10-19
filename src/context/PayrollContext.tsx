import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import type { 
  EmployeeSalaryConfig, 
  EmployeeAdvanceRecord, 
  MonthlyPayrollRecord,
  AdvancePaymentMode,
  AdvanceStatus
} from '../types/payroll';
import type { AttendanceRecord } from '../types/attendance';
import type { Employee } from './CRMContext';
import { useAuth } from './AuthContext';
import { useAudit } from './AuditLogContext';

interface PayrollContextType {
  salaryConfigs: EmployeeSalaryConfig[];
  advances: EmployeeAdvanceRecord[];
  payrolls: MonthlyPayrollRecord[];
  loading: boolean;
  updateSalaryConfig: (config: EmployeeSalaryConfig) => Promise<void>;
  getSalaryConfig: (employeeId: string) => EmployeeSalaryConfig | undefined;
  addAdvance: (advance: {
    employeeId: string;
    employeeName: string;
    amount: number;
    date: string;
    paymentMode: AdvancePaymentMode;
    referenceNumber?: string;
    reason: string;
    recoveryPlan: 'FULL_NEXT_PAYROLL' | 'MONTHLY_INSTALLMENT';
    installmentAmount?: number;
    notes?: string;
  }) => Promise<EmployeeAdvanceRecord>;
  recordAdvanceRecovery: (advanceId: string, amount: number, notes?: string) => Promise<void>;
  cancelAdvance: (advanceId: string) => Promise<void>;
  calculateMonthPayrollDrafts: (
    monthStr: string, // YYYY-MM
    companyEmployees: Employee[],
    attendanceRecords: AttendanceRecord[]
  ) => MonthlyPayrollRecord[];
  savePayrollRecord: (record: MonthlyPayrollRecord) => Promise<void>;
  markPayrollPaid: (
    payrollId: string,
    paymentMode: string,
    paymentReference: string,
    notes?: string
  ) => Promise<void>;
  getEmployeeOutstandingAdvance: (employeeId: string) => number;
  getEmployeeAdvances: (employeeId: string) => EmployeeAdvanceRecord[];
  getEmployeePayrolls: (employeeId: string) => MonthlyPayrollRecord[];
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

export const usePayroll = () => {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error('usePayroll must be used within a PayrollProvider');
  return ctx;
};

// Default seed configs so employees have immediate visible structures
const DEFAULT_SALARY_CONFIGS: EmployeeSalaryConfig[] = [
  { employeeId: 'EMP01', employeeName: 'Aditya Sharma', baseSalary: 30000, salaryType: 'MONTHLY', bankName: 'HDFC Bank', accountNumber: '50100492817291', ifscCode: 'HDFC0001234', upiId: 'aditya@hdfcbank' },
  { employeeId: 'EMP02', employeeName: 'Ravi Teja', baseSalary: 25000, salaryType: 'MONTHLY', bankName: 'State Bank of India', accountNumber: '30492817291', ifscCode: 'SBIN0004567', upiId: 'ravi@sbi' },
  { employeeId: 'EMP03', employeeName: 'Suresh Kumar', baseSalary: 28000, salaryType: 'MONTHLY', bankName: 'ICICI Bank', accountNumber: '002938172635', ifscCode: 'ICIC0000892', upiId: 'suresh@icici' },
  { employeeId: 'EMP04', employeeName: 'Ramesh Varma', baseSalary: 22000, salaryType: 'MONTHLY', bankName: 'Kotak Mahindra', accountNumber: '8839201928', ifscCode: 'KKBK0000213', upiId: 'ramesh@kotak' },
];

export const PayrollProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [salaryConfigs, setSalaryConfigs] = useState<EmployeeSalaryConfig[]>(DEFAULT_SALARY_CONFIGS);
  const [advances, setAdvances] = useState<EmployeeAdvanceRecord[]>([]);
  const [payrolls, setPayrolls] = useState<MonthlyPayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const { currentUser } = useAuth();
  const { logAction } = useAudit();

  // 1. Sync Salary Configs from Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, 'employee_salaries'));
      const unsub = onSnapshot(q, (snapshot) => {
        const fetched: EmployeeSalaryConfig[] = [];
        snapshot.forEach((d) => {
          fetched.push({ ...d.data() } as EmployeeSalaryConfig);
        });
        if (fetched.length > 0) {
          // Merge with defaults
          setSalaryConfigs((prev) => {
            const map = new Map<string, EmployeeSalaryConfig>();
            prev.forEach(p => map.set(p.employeeId, p));
            fetched.forEach(f => map.set(f.employeeId, f));
            return Array.from(map.values());
          });
        }
      }, (err) => {
        console.warn('Salary config listener fallback:', err.message);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Salary config init fallback:', err);
    }
  }, []);

  // 2. Sync Advances from Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, 'employee_advances'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const fetched: EmployeeAdvanceRecord[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as EmployeeAdvanceRecord);
        });
        setAdvances(fetched);
        setLoading(false);
      }, (err) => {
        console.warn('Advances listener fallback:', err.message);
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Advances init fallback:', err);
      setLoading(false);
    }
  }, []);

  // 3. Sync Payrolls from Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, 'employee_payrolls'), orderBy('generatedAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const fetched: MonthlyPayrollRecord[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as MonthlyPayrollRecord);
        });
        setPayrolls(fetched);
      }, (err) => {
        console.warn('Payrolls listener fallback:', err.message);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Payrolls init fallback:', err);
    }
  }, []);

  // Helper: Get salary config for employee or provide sensible default
  const getSalaryConfig = (employeeId: string): EmployeeSalaryConfig | undefined => {
    return salaryConfigs.find(s => s.employeeId === employeeId);
  };

  // Update or set Salary Config
  const updateSalaryConfig = async (config: EmployeeSalaryConfig) => {
    const payload = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Admin'
    };

    try {
      await setDoc(doc(db, 'employee_salaries', config.employeeId), payload, { merge: true });
    } catch (err) {
      console.warn('Fallback local update for salary config:', err);
    }

    setSalaryConfigs(prev => {
      const idx = prev.findIndex(s => s.employeeId === config.employeeId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = payload;
        return updated;
      }
      return [payload, ...prev];
    });

    await logAction({
      action: 'SALARY_CONFIG_UPDATED',
      entityType: 'Payroll',
      entityId: config.employeeId,
      entityLabel: `Salary updated for ${config.employeeName}: ₹${config.baseSalary.toLocaleString()}/mo`,
      newValue: payload
    });
  };

  // Add Advance
  const addAdvance = async (advanceData: {
    employeeId: string;
    employeeName: string;
    amount: number;
    date: string;
    paymentMode: AdvancePaymentMode;
    referenceNumber?: string;
    reason: string;
    recoveryPlan: 'FULL_NEXT_PAYROLL' | 'MONTHLY_INSTALLMENT';
    installmentAmount?: number;
    notes?: string;
  }): Promise<EmployeeAdvanceRecord> => {
    const advanceId = `ADV_${advanceData.employeeId}_${Date.now()}`;
    const newAdvance: EmployeeAdvanceRecord = {
      ...advanceData,
      id: advanceId,
      recoveredAmount: 0,
      remainingBalance: advanceData.amount,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin'
    };

    try {
      await setDoc(doc(db, 'employee_advances', advanceId), newAdvance);
    } catch (err) {
      console.warn('Advance local fallback:', err);
    }

    setAdvances(prev => [newAdvance, ...prev]);

    await logAction({
      action: 'ADVANCE_DISBURSED',
      entityType: 'Payroll',
      entityId: advanceId,
      entityLabel: `Disbursed advance ₹${newAdvance.amount.toLocaleString()} to ${newAdvance.employeeName}`,
      newValue: newAdvance,
      reason: newAdvance.reason
    });

    return newAdvance;
  };

  // Record Advance Recovery / Repayment
  const recordAdvanceRecovery = async (advanceId: string, amount: number, notes?: string) => {
    const target = advances.find(a => a.id === advanceId);
    if (!target) return;

    const newRecovered = Math.min(target.amount, target.recoveredAmount + amount);
    const newRemaining = Math.max(0, target.amount - newRecovered);
    const newStatus: AdvanceStatus = newRemaining === 0 ? 'SETTLED' : 'PARTIALLY_RECOVERED';

    const updates: Partial<EmployeeAdvanceRecord> = {
      recoveredAmount: newRecovered,
      remainingBalance: newRemaining,
      status: newStatus,
      notes: notes ? `${target.notes ? target.notes + ' | ' : ''}${notes}` : target.notes
    };

    try {
      await updateDoc(doc(db, 'employee_advances', advanceId), updates);
    } catch (err) {
      console.warn('Advance recovery update fallback:', err);
    }

    setAdvances(prev => prev.map(a => a.id === advanceId ? { ...a, ...updates } : a));

    await logAction({
      action: 'ADVANCE_RECOVERED',
      entityType: 'Payroll',
      entityId: advanceId,
      entityLabel: `Recovered ₹${amount.toLocaleString()} from ${target.employeeName} advance`,
      previousValue: target,
      newValue: { ...target, ...updates },
      reason: notes || 'Payroll recovery'
    });
  };

  // Cancel Advance
  const cancelAdvance = async (advanceId: string) => {
    const target = advances.find(a => a.id === advanceId);
    if (!target) return;

    const updates = { status: 'CANCELLED' as const };
    try {
      await updateDoc(doc(db, 'employee_advances', advanceId), updates);
    } catch (err) {
      console.warn('Advance cancel fallback:', err);
    }

    setAdvances(prev => prev.map(a => a.id === advanceId ? { ...a, ...updates } : a));
  };

  // Outstanding Advance total for an employee
  const getEmployeeOutstandingAdvance = (employeeId: string): number => {
    return advances
      .filter(a => a.employeeId === employeeId && (a.status === 'ACTIVE' || a.status === 'PARTIALLY_RECOVERED'))
      .reduce((sum, a) => sum + a.remainingBalance, 0);
  };

  // Advances list for an employee
  const getEmployeeAdvances = (employeeId: string): EmployeeAdvanceRecord[] => {
    return advances.filter(a => a.employeeId === employeeId);
  };

  // Payrolls list for an employee
  const getEmployeePayrolls = (employeeId: string): MonthlyPayrollRecord[] => {
    return payrolls.filter(p => p.employeeId === employeeId);
  };

  /**
   * Calculate Monthly Payroll Drafts based on live Attendance & Advances
   * KEY USER RULE: "TO EMPLOYEES IF THEY TAKE LEAVE THE SALARY WILL CUT OF THAT DAY"
   */
  const calculateMonthPayrollDrafts = (
    monthStr: string, // "YYYY-MM" e.g. "2026-10"
    companyEmployees: Employee[],
    attendanceRecords: AttendanceRecord[]
  ): MonthlyPayrollRecord[] => {
    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthNumStr, 10); // 1-12

    // Total days in this month
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    // Today's date to avoid marking future dates as absent if calculating current month
    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];
    const isCurrentMonth = todayIso.startsWith(monthStr);
    const maxEvaluationDay = isCurrentMonth ? today.getDate() : totalDaysInMonth;

    // Count sundays in month up to maxEvaluationDay
    let sundaysCount = 0;
    for (let d = 1; d <= maxEvaluationDay; d++) {
      const dateObj = new Date(year, month - 1, d);
      if (dateObj.getDay() === 0) sundaysCount++;
    }
    const workingDaysCount = maxEvaluationDay - sundaysCount;

    return companyEmployees.map((emp) => {
      // 1. Get Base Salary
      const config = getSalaryConfig(emp.id);
      const baseSalary = config?.baseSalary || 20000;
      
      // Per day rate based on standard total calendar days
      const perDayRate = totalDaysInMonth > 0 ? Math.round((baseSalary / totalDaysInMonth) * 100) / 100 : 0;

      // 2. Scan Attendance for this employee in this month
      let presentCount = 0;
      let halfDayCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      for (let day = 1; day <= maxEvaluationDay; day++) {
        const dateObj = new Date(year, month - 1, day);
        const dateIso = `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSunday = dateObj.getDay() === 0;

        // Skip sundays (weekly off)
        if (isSunday) continue;

        const att = attendanceRecords.find(a => a.employeeId === emp.id && a.date === dateIso);

        if (att) {
          if (att.status === 'PRESENT' || att.status === 'LATE') {
            presentCount++;
          } else if (att.status === 'HALF_DAY') {
            halfDayCount++;
          } else if (att.status === 'LEAVE') {
            leaveCount++;
          } else if (att.status === 'ABSENT') {
            absentCount++;
          } else {
            // Unmarked or other
            absentCount++;
          }
        } else {
          // If no record exists for a past working day, it is an absent day
          absentCount++;
        }
      }

      // 3. Calculate Salary Cuts
      // DIRECT USER INSTRUCTION: If employee takes leave, the salary cuts for that day!
      // Half day cuts 0.5 day's pay. Full leave cuts 1.0 day's pay. Absent cuts 1.0 day's pay.
      const leaveDeduction = Math.round((leaveCount * perDayRate) + (halfDayCount * perDayRate * 0.5));
      const absentDeduction = Math.round(absentCount * perDayRate);

      // Gross earned after attendance deductions
      const grossEarned = Math.max(0, Math.round(baseSalary - leaveDeduction - absentDeduction));

      // 4. Calculate Scheduled Advance Deduction
      const activeEmployeeAdvances = advances.filter(
        a => a.employeeId === emp.id && (a.status === 'ACTIVE' || a.status === 'PARTIALLY_RECOVERED')
      );

      let proposedAdvanceDeduction = 0;
      activeEmployeeAdvances.forEach(adv => {
        if (adv.recoveryPlan === 'FULL_NEXT_PAYROLL') {
          proposedAdvanceDeduction += adv.remainingBalance;
        } else if (adv.recoveryPlan === 'MONTHLY_INSTALLMENT') {
          const installment = adv.installmentAmount || adv.remainingBalance;
          proposedAdvanceDeduction += Math.min(installment, adv.remainingBalance);
        }
      });

      // Advance deduction should not exceed gross earned
      proposedAdvanceDeduction = Math.min(proposedAdvanceDeduction, grossEarned);

      // 5. Existing Saved Payroll record (if any)
      const payrollId = `PAYROLL_${yearStr}_${String(month).padStart(2, '0')}_${emp.id}`;
      const existingSaved = payrolls.find(p => p.id === payrollId);

      const bonusAmount = existingSaved?.bonusAmount || 0;
      const otherDeductions = existingSaved?.otherDeductions || 0;
      const netPayable = Math.max(0, Math.round(grossEarned - proposedAdvanceDeduction - otherDeductions + bonusAmount));

      if (existingSaved) {
        return {
          ...existingSaved,
          baseSalary,
          totalDaysInMonth,
          sundaysCount,
          workingDaysCount,
          presentDays: presentCount,
          halfDays: halfDayCount,
          leaveDays: leaveCount,
          absentDays: absentCount,
          perDayRate,
          leaveDeduction,
          absentDeduction,
          advanceDeduction: proposedAdvanceDeduction,
          grossEarned,
          netPayable
        };
      }

      return {
        id: payrollId,
        month: monthStr,
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        baseSalary,
        totalDaysInMonth,
        sundaysCount,
        workingDaysCount,
        presentDays: presentCount,
        halfDays: halfDayCount,
        leaveDays: leaveCount,
        absentDays: absentCount,
        perDayRate,
        leaveDeduction,
        absentDeduction,
        advanceDeduction: proposedAdvanceDeduction,
        otherDeductions: 0,
        bonusAmount: 0,
        grossEarned,
        netPayable,
        status: 'DRAFT',
        generatedAt: new Date().toISOString()
      };
    });
  };

  // Save or Update Payroll Record
  const savePayrollRecord = async (record: MonthlyPayrollRecord) => {
    try {
      await setDoc(doc(db, 'employee_payrolls', record.id), record, { merge: true });
    } catch (err) {
      console.warn('Payroll save fallback:', err);
    }

    setPayrolls(prev => {
      const idx = prev.findIndex(p => p.id === record.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });

    await logAction({
      action: 'PAYROLL_SAVED',
      entityType: 'Payroll',
      entityId: record.id,
      entityLabel: `Payroll drafted for ${record.employeeName} (${record.month}): Net ₹${record.netPayable.toLocaleString()}`,
      newValue: record
    });
  };

  // Mark Payroll as Paid & Auto-Deduct Advances
  const markPayrollPaid = async (
    payrollId: string,
    paymentMode: string,
    paymentReference: string,
    notes?: string
  ) => {
    const target = payrolls.find(p => p.id === payrollId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const updates: Partial<MonthlyPayrollRecord> = {
      status: 'PAID',
      paidAt: nowIso,
      paymentDate: nowIso.split('T')[0],
      paymentMode,
      paymentReference,
      notes: notes || target.notes
    };

    try {
      await updateDoc(doc(db, 'employee_payrolls', payrollId), updates);
    } catch (err) {
      console.warn('Payroll status update fallback:', err);
    }

    setPayrolls(prev => prev.map(p => p.id === payrollId ? { ...p, ...updates } : p));

    // If an advance deduction was included in this payroll, deduct it from active advances
    if (target.advanceDeduction > 0) {
      let remainingToDeduct = target.advanceDeduction;
      const employeeActiveAdvances = advances.filter(
        a => a.employeeId === target.employeeId && (a.status === 'ACTIVE' || a.status === 'PARTIALLY_RECOVERED')
      );

      for (const adv of employeeActiveAdvances) {
        if (remainingToDeduct <= 0) break;
        const deductFromThis = Math.min(adv.remainingBalance, remainingToDeduct);
        await recordAdvanceRecovery(adv.id, deductFromThis, `Auto-deducted from ${target.month} Salary`);
        remainingToDeduct -= deductFromThis;
      }
    }

    await logAction({
      action: 'PAYROLL_DISBURSED',
      entityType: 'Payroll',
      entityId: payrollId,
      entityLabel: `Salary of ₹${target.netPayable.toLocaleString()} paid to ${target.employeeName} via ${paymentMode}`,
      newValue: { ...target, ...updates },
      reason: notes || `Ref: ${paymentReference}`
    });
  };

  return (
    <PayrollContext.Provider
      value={{
        salaryConfigs,
        advances,
        payrolls,
        loading,
        updateSalaryConfig,
        getSalaryConfig,
        addAdvance,
        recordAdvanceRecovery,
        cancelAdvance,
        calculateMonthPayrollDrafts,
        savePayrollRecord,
        markPayrollPaid,
        getEmployeeOutstandingAdvance,
        getEmployeeAdvances,
        getEmployeePayrolls
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};
