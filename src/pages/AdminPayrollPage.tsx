import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  IndianRupee, 
  CalendarDays, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Printer, 
  Search, 
  X, 
  Check, 
  CreditCard, 
  Building2, 
  FileText, 
  BadgePercent,
  AlertTriangle,
  ArrowRight,
  LayoutGrid,
  List
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useAttendance } from '../context/AttendanceContext';
import { usePayroll } from '../context/PayrollContext';
import { useUI } from '../context/UIContext';
import PageHero from '../components/PageHero';
import type { 
  MonthlyPayrollRecord, 
  EmployeeAdvanceRecord, 
  EmployeeSalaryConfig, 
  AdvancePaymentMode 
} from '../types/payroll';
import './AdminPayrollPage.css';

export default function AdminPayrollPage() {
  const { employees } = useCRM();
  const { records: attendanceRecords } = useAttendance();
  const { 
    salaryConfigs, 
    advances, 
    payrolls, 
    updateSalaryConfig, 
    addAdvance, 
    recordAdvanceRecovery,
    cancelAdvance,
    calculateMonthPayrollDrafts,
    savePayrollRecord,
    markPayrollPaid,
    getEmployeeOutstandingAdvance
  } = usePayroll();
  const { showToast, showConfirmModal } = useUI();

  // Active Tab: 'register' | 'advances' | 'structures'
  const [activeTab, setActiveTab] = useState<'register' | 'advances' | 'structures'>('register');

  // Mobile / Tablet View Mode ('cards' | 'table')
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');

  // Month Selection (defaults to current Month e.g. "2026-10")
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayIso.substring(0, 7), [todayIso]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [disburseForm, setDisburseForm] = useState({
    employeeId: '',
    amount: '',
    date: todayIso,
    paymentMode: 'Bank Transfer' as AdvancePaymentMode,
    referenceNumber: '',
    recoveryPlan: 'FULL_NEXT_PAYROLL' as 'FULL_NEXT_PAYROLL' | 'MONTHLY_INSTALLMENT',
    installmentAmount: '',
    reason: '',
    notes: ''
  });

  // Edit Salary Modal
  const [isEditSalaryModalOpen, setIsEditSalaryModalOpen] = useState(false);
  const [editSalaryForm, setEditSalaryForm] = useState<EmployeeSalaryConfig>({
    employeeId: '',
    employeeName: '',
    baseSalary: 25000,
    salaryType: 'MONTHLY',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: ''
  });

  // Mark Paid Modal
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<MonthlyPayrollRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentMode: 'Bank Transfer (NEFT/IMPS)',
    paymentReference: '',
    notes: ''
  });

  // Printable Payslip Modal
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [viewingPayslip, setViewingPayslip] = useState<MonthlyPayrollRecord | null>(null);

  // Filter Company Employees ONLY (dealerId is null or undefined)
  const companyEmployees = useMemo(() => {
    return employees.filter(e => (!e.dealerId || e.dealerId === null) && e.status === 'Active');
  }, [employees]);

  // Compute live payroll rows based on active attendance logs and active advances
  const payrollDrafts = useMemo(() => {
    return calculateMonthPayrollDrafts(selectedMonth, companyEmployees, attendanceRecords);
  }, [calculateMonthPayrollDrafts, selectedMonth, companyEmployees, attendanceRecords]);

  // Filtered rows for search
  const filteredPayrolls = useMemo(() => {
    return payrollDrafts.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      return !q || p.employeeName.toLowerCase().includes(q) || p.employeeId.toLowerCase().includes(q);
    });
  }, [payrollDrafts, searchQuery]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalBase = 0;
    let totalLeaveCuts = 0;
    let totalAdvanceDeductions = 0;
    let totalNetDisbursed = 0;
    let paidCount = 0;

    payrollDrafts.forEach(p => {
      totalBase += p.baseSalary;
      totalLeaveCuts += (p.leaveDeduction + p.absentDeduction);
      totalAdvanceDeductions += p.advanceDeduction;
      totalNetDisbursed += p.netPayable;
      if (p.status === 'PAID') paidCount++;
    });

    const totalActiveAdvances = advances
      .filter(a => a.status === 'ACTIVE' || a.status === 'PARTIALLY_RECOVERED')
      .reduce((sum, a) => sum + a.remainingBalance, 0);

    return {
      totalBase,
      totalLeaveCuts,
      totalAdvanceDeductions,
      totalNetDisbursed,
      paidCount,
      totalCount: payrollDrafts.length,
      totalActiveAdvances
    };
  }, [payrollDrafts, advances]);

  // Handle Disburse Advance Submit
  const handleDisburseAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(disburseForm.amount);
    if (!disburseForm.employeeId || isNaN(amountNum) || amountNum <= 0) {
      showToast('Please select an employee and enter a valid advance amount', 'warning');
      return;
    }

    const targetEmp = companyEmployees.find(e => e.id === disburseForm.employeeId);
    if (!targetEmp) return;

    try {
      await addAdvance({
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        amount: amountNum,
        date: disburseForm.date,
        paymentMode: disburseForm.paymentMode,
        referenceNumber: disburseForm.referenceNumber,
        reason: disburseForm.reason || 'Employee Salary Advance',
        recoveryPlan: disburseForm.recoveryPlan,
        installmentAmount: disburseForm.installmentAmount ? parseFloat(disburseForm.installmentAmount) : undefined,
        notes: disburseForm.notes
      });

      showToast(`✓ Advance of ₹${amountNum.toLocaleString()} disbursed to ${targetEmp.name}!`, 'success');
      setIsDisburseModalOpen(false);
      setDisburseForm({
        employeeId: '',
        amount: '',
        date: todayIso,
        paymentMode: 'Bank Transfer',
        referenceNumber: '',
        recoveryPlan: 'FULL_NEXT_PAYROLL',
        installmentAmount: '',
        reason: '',
        notes: ''
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to disburse advance', 'error');
    }
  };

  // Handle Save / Update Salary Config Submit
  const handleSaveSalaryConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSalaryForm.employeeId) return;

    try {
      await updateSalaryConfig(editSalaryForm);
      showToast(`✓ Salary structure updated for ${editSalaryForm.employeeName}!`, 'success');
      setIsEditSalaryModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to update salary structure', 'error');
    }
  };

  // Handle Mark Payroll as Paid
  const handleConfirmMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markPaidTarget) return;

    try {
      // First save the current computed draft to Firestore
      await savePayrollRecord(markPaidTarget);
      // Then mark it as paid and auto-recover scheduled advances
      await markPayrollPaid(
        markPaidTarget.id,
        paymentForm.paymentMode,
        paymentForm.paymentReference || 'UTR-CASH-SETTLED',
        paymentForm.notes
      );

      showToast(`✓ Salary of ₹${markPaidTarget.netPayable.toLocaleString()} marked as PAID for ${markPaidTarget.employeeName}!`, 'success');
      setIsMarkPaidModalOpen(false);
      setMarkPaidTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to process salary payment', 'error');
    }
  };

  // Export Payroll to CSV
  const handleExportPayrollCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Month',
      'Base Salary (₹)',
      'Total Days',
      'Present Days',
      'Half Days',
      'Leave Days',
      'Absent Days',
      'Leave/Absent Cut (₹)',
      'Advance Deducted (₹)',
      'Bonus (₹)',
      'Net Payable (₹)',
      'Status'
    ];

    const rows = filteredPayrolls.map(p => [
      p.employeeId,
      `"${p.employeeName}"`,
      p.month,
      p.baseSalary,
      p.totalDaysInMonth,
      p.presentDays,
      p.halfDays,
      p.leaveDays,
      p.absentDays,
      p.leaveDeduction + p.absentDeduction,
      p.advanceDeduction,
      p.bonusAmount,
      p.netPayable,
      p.status
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MirrorSolar_Payroll_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${selectedMonth} Payroll Register!`, 'success');
  };

  return (
    <div className="admin-payroll-container">
      {/* Page Hero - Clean Title with Single Primary Action */}
      <PageHero
        badge="Staff Payroll & Advance Governance"
        icon={<Wallet size={26} />}
        title="Employee Salary & Advance Operations"
        subtitle="Manage employee base salaries, disburse advances, and calculate automated monthly payroll with attendance-based salary cuts."
        actions={
          <button 
            className="btn-hero-primary"
            onClick={() => setIsDisburseModalOpen(true)}
          >
            <Plus size={16} /> Give Advance
          </button>
        }
      />

      {/* Auto-Adjusting Subnav Pill Bar (Touch-scrollable on Mobile, Horizontal on Laptop) */}
      <div className="payroll-subnav-bar">
        <button 
          className={`payroll-subnav-pill ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          <CalendarDays size={16} /> Monthly Payroll Register
        </button>
        <button 
          className={`payroll-subnav-pill ${activeTab === 'advances' ? 'active' : ''}`}
          onClick={() => setActiveTab('advances')}
        >
          <IndianRupee size={16} /> Advance Ledger
          {advances.filter(a => a.status === 'ACTIVE').length > 0 && (
            <span className="pill-badge">{advances.filter(a => a.status === 'ACTIVE').length}</span>
          )}
        </button>
        <button 
          className={`payroll-subnav-pill ${activeTab === 'structures' ? 'active' : ''}`}
          onClick={() => setActiveTab('structures')}
        >
          <Building2 size={16} /> Salary Structures
        </button>
      </div>

      {/* Salary Cut Rule Guidance Banner */}
      <div className="payroll-rule-banner">
        <AlertTriangle size={22} color="#0284C7" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <span style={{ fontWeight: 800, display: 'block', fontSize: '0.92rem' }}>
            Attendance-Linked Salary Policy Active
          </span>
          <span style={{ fontSize: '0.82rem', opacity: 0.9 }}>
            Per company guidelines, each approved leave day or unmarked absence deducts that day's pay from the employee's gross monthly salary: <code>(Base Salary / Total Days in Month) × Days</code>. Half days deduct 0.5 of a day's pay.
          </span>
        </div>
      </div>

      {/* Summary KPI Metrics Grid (Desktop 4-col, Tablet 2-col, Mobile 2-col compact) */}
      <div className="payroll-metrics-grid">
        <div className="payroll-metric-card">
          <div className="payroll-metric-icon p-icon-blue">
            <Building2 size={24} />
          </div>
          <div className="payroll-metric-info">
            <span className="payroll-metric-val">₹{summaryMetrics.totalBase.toLocaleString()}</span>
            <span className="payroll-metric-lbl">Total Base Payroll</span>
          </div>
        </div>

        <div className="payroll-metric-card">
          <div className="payroll-metric-icon p-icon-rose">
            <TrendingDown size={24} />
          </div>
          <div className="payroll-metric-info">
            <span className="payroll-metric-val">₹{summaryMetrics.totalLeaveCuts.toLocaleString()}</span>
            <span className="payroll-metric-lbl">Leave & Absent Cuts</span>
          </div>
        </div>

        <div className="payroll-metric-card">
          <div className="payroll-metric-icon p-icon-amber">
            <IndianRupee size={24} />
          </div>
          <div className="payroll-metric-info">
            <span className="payroll-metric-val">₹{summaryMetrics.totalAdvanceDeductions.toLocaleString()}</span>
            <span className="payroll-metric-lbl">Advances Recovered</span>
          </div>
        </div>

        <div className="payroll-metric-card">
          <div className="payroll-metric-icon p-icon-green">
            <Wallet size={24} />
          </div>
          <div className="payroll-metric-info">
            <span className="payroll-metric-val">₹{summaryMetrics.totalNetDisbursed.toLocaleString()}</span>
            <span className="payroll-metric-lbl">Net Payable ({summaryMetrics.paidCount}/{summaryMetrics.totalCount} Paid)</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MONTHLY PAYROLL REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className={`payroll-card ${mobileViewMode === 'table' ? 'show-table-on-mobile' : ''}`}>
          <div className="payroll-toolbar">
            <div className="payroll-toolbar-left">
              <div className="month-picker-pill">
                <CalendarDays size={16} color="#0284C7" />
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)} 
                />
              </div>

              <div className="payroll-search-box">
                <Search size={15} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search staff payroll..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="payroll-toolbar-right">
              {/* Mobile View Toggle */}
              <div className="view-mode-toggle">
                <button 
                  type="button"
                  className={`view-mode-btn ${mobileViewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setMobileViewMode('cards')}
                >
                  <LayoutGrid size={13} /> Cards
                </button>
                <button 
                  type="button"
                  className={`view-mode-btn ${mobileViewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setMobileViewMode('table')}
                >
                  <List size={13} /> Table
                </button>
              </div>

              <button 
                className="btn-outline"
                onClick={handleExportPayrollCSV}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          {/* Desktop & Laptop Uncompressed Table (min-width: 1080px guaranteed) */}
          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th className="col-emp">Employee</th>
                  <th className="col-base">Base Pay</th>
                  <th className="col-att">Attendance Summary</th>
                  <th className="col-cut">Leave Cut (₹)</th>
                  <th className="col-adv">Active Advance / Cut</th>
                  <th className="col-net">Net Payable</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.map((rec) => {
                  const outstandingAdvance = getEmployeeOutstandingAdvance(rec.employeeId);
                  const isPaid = rec.status === 'PAID';

                  return (
                    <tr key={rec.id}>
                      <td className="col-emp">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="emp-avatar" style={{ width: '38px', height: '38px', fontSize: '13px', flexShrink: 0 }}>
                            {rec.employeeName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-navy" style={{ fontSize: '0.92rem' }}>{rec.employeeName}</div>
                            <div className="text-muted text-xs">{rec.employeeId} • {rec.role}</div>
                          </div>
                        </div>
                      </td>

                      <td className="col-base">
                        <div className="font-bold text-navy">₹{rec.baseSalary.toLocaleString()}</div>
                        <div className="text-muted text-xs">₹{rec.perDayRate}/day</div>
                      </td>

                      <td className="col-att">
                        <div style={{ display: 'flex', gap: '5px', fontSize: '11px', fontWeight: 700 }}>
                          <span style={{ color: '#15803D', background: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>
                            {rec.presentDays} P
                          </span>
                          <span style={{ color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>
                            {rec.halfDays} H
                          </span>
                          <span style={{ color: '#4338CA', background: '#E0E7FF', padding: '2px 6px', borderRadius: '4px' }}>
                            {rec.leaveDays} L
                          </span>
                          <span style={{ color: '#B91C1C', background: '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>
                            {rec.absentDays} A
                          </span>
                        </div>
                        <div className="text-muted text-xs" style={{ marginTop: '2px' }}>
                          {rec.totalDaysInMonth} total days ({rec.workingDaysCount} working)
                        </div>
                      </td>

                      <td className="col-cut">
                        <div className="font-bold" style={{ color: '#B91C1C' }}>
                          -₹{(rec.leaveDeduction + rec.absentDeduction).toLocaleString()}
                        </div>
                        <div className="text-muted text-xs">
                          {rec.leaveDays + rec.absentDays + (rec.halfDays * 0.5)} days cut
                        </div>
                      </td>

                      <td className="col-adv">
                        {outstandingAdvance > 0 ? (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#B45309' }}>
                              Bal: ₹{outstandingAdvance.toLocaleString()}
                            </div>
                            <div className="font-bold" style={{ color: '#DC2626', fontSize: '12px' }}>
                              -₹{rec.advanceDeduction.toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted text-xs">No active advance</span>
                        )}
                      </td>

                      <td className="col-net">
                        <div className="font-extrabold text-navy" style={{ fontSize: '1.05rem', color: '#0F172A' }}>
                          ₹{rec.netPayable.toLocaleString()}
                        </div>
                        {rec.bonusAmount > 0 && (
                          <div style={{ color: '#16A34A', fontSize: '11px', fontWeight: 600 }}>
                            +₹{rec.bonusAmount} bonus
                          </div>
                        )}
                      </td>

                      <td className="col-status">
                        {isPaid ? (
                          <span className="badge-payroll-paid">
                            <CheckCircle2 size={13} /> PAID
                          </span>
                        ) : (
                          <span className="badge-payroll-draft">
                            <Clock size={13} /> DRAFT
                          </span>
                        )}
                      </td>

                      {/* ACTIONS COLUMN: Generous spacing, uncompressed */}
                      <td className="col-actions">
                        <div className="payroll-action-buttons">
                          {!isPaid ? (
                            <button 
                              className="btn-disburse-pay"
                              onClick={() => {
                                setMarkPaidTarget(rec);
                                setIsMarkPaidModalOpen(true);
                              }}
                              title="Mark this employee salary as disbursed"
                            >
                              <Check size={14} /> Disburse Pay
                            </button>
                          ) : (
                            <button 
                              className="btn-view-payslip"
                              onClick={() => {
                                setViewingPayslip(rec);
                                setIsPayslipModalOpen(true);
                              }}
                            >
                              <FileText size={14} /> View Payslip
                            </button>
                          )}

                          <button 
                            className="btn-icon-payslip"
                            onClick={() => {
                              setViewingPayslip(rec);
                              setIsPayslipModalOpen(true);
                            }}
                            title="Generate and Print formal Salary Slip"
                          >
                            <Printer size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (Visible on Mobile & Tablets <= 768px) */}
          <div className="payroll-mobile-cards">
            {filteredPayrolls.map((rec) => {
              const outstandingAdvance = getEmployeeOutstandingAdvance(rec.employeeId);
              const isPaid = rec.status === 'PAID';

              return (
                <div key={`mob-${rec.id}`} className="payroll-mobile-card">
                  <div className="p-m-header">
                    <div className="p-m-emp">
                      <div className="emp-avatar" style={{ width: '38px', height: '38px', fontSize: '13px', flexShrink: 0 }}>
                        {rec.employeeName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="p-m-name">{rec.employeeName}</div>
                        <div className="p-m-sub">{rec.employeeId} • {rec.role}</div>
                      </div>
                    </div>

                    <div>
                      {isPaid ? (
                        <span className="badge-payroll-paid"><CheckCircle2 size={12} /> PAID</span>
                      ) : (
                        <span className="badge-payroll-draft"><Clock size={12} /> DRAFT</span>
                      )}
                    </div>
                  </div>

                  {/* Net Payable Highlight Banner */}
                  <div className="p-m-net-box">
                    <div>
                      <span className="p-m-net-lbl">NET TAKE-HOME PAY</span>
                      <span className="p-m-net-val">₹{rec.netPayable.toLocaleString()}</span>
                    </div>
                    {rec.bonusAmount > 0 && (
                      <span className="p-m-bonus-tag">+₹{rec.bonusAmount} bonus</span>
                    )}
                  </div>

                  {/* 2x2 Financial and Attendance Details */}
                  <div className="p-m-grid">
                    <div className="p-m-cell">
                      <span className="p-m-lbl">Base Salary</span>
                      <span className="p-m-val">₹{rec.baseSalary.toLocaleString()}</span>
                      <span className="p-m-hint">₹{rec.perDayRate}/day</span>
                    </div>

                    <div className="p-m-cell">
                      <span className="p-m-lbl">Attendance</span>
                      <div className="p-m-att-chips">
                        <span className="chip-p">{rec.presentDays}P</span>
                        <span className="chip-h">{rec.halfDays}H</span>
                        <span className="chip-l">{rec.leaveDays}L</span>
                        <span className="chip-a">{rec.absentDays}A</span>
                      </div>
                      <span className="p-m-hint">{rec.workingDaysCount} working days</span>
                    </div>

                    <div className="p-m-cell">
                      <span className="p-m-lbl">Leave Cuts</span>
                      <span className="p-m-val" style={{ color: '#B91C1C' }}>
                        -₹{(rec.leaveDeduction + rec.absentDeduction).toLocaleString()}
                      </span>
                      <span className="p-m-hint">
                        {rec.leaveDays + rec.absentDays + (rec.halfDays * 0.5)} days cut
                      </span>
                    </div>

                    <div className="p-m-cell">
                      <span className="p-m-lbl">Advance Cut</span>
                      {outstandingAdvance > 0 ? (
                        <>
                          <span className="p-m-val" style={{ color: '#D97706' }}>
                            -₹{rec.advanceDeduction.toLocaleString()}
                          </span>
                          <span className="p-m-hint">Bal: ₹{outstandingAdvance.toLocaleString()}</span>
                        </>
                      ) : (
                        <span className="p-m-hint" style={{ marginTop: '4px' }}>No active advance</span>
                      )}
                    </div>
                  </div>

                  {/* Large Touch Actions */}
                  <div className="p-m-actions">
                    {!isPaid ? (
                      <button 
                        className="btn-disburse-mobile"
                        onClick={() => {
                          setMarkPaidTarget(rec);
                          setIsMarkPaidModalOpen(true);
                        }}
                      >
                        <Check size={16} /> Disburse Pay (₹{rec.netPayable.toLocaleString()})
                      </button>
                    ) : (
                      <button 
                        className="btn-payslip-mobile"
                        onClick={() => {
                          setViewingPayslip(rec);
                          setIsPayslipModalOpen(true);
                        }}
                      >
                        <FileText size={16} /> View Payslip
                      </button>
                    )}

                    <button 
                      className="btn-icon-mobile"
                      onClick={() => {
                        setViewingPayslip(rec);
                        setIsPayslipModalOpen(true);
                      }}
                      title="Print Payslip"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ADVANCES LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'advances' && (
        <div className={`payroll-card ${mobileViewMode === 'table' ? 'show-table-on-mobile' : ''}`}>
          <div className="payroll-toolbar">
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A', fontWeight: 800 }}>
              Employee Salary Advances Ledger
            </h3>

            <div className="payroll-toolbar-right">
              {/* Mobile View Toggle */}
              <div className="view-mode-toggle">
                <button 
                  type="button"
                  className={`view-mode-btn ${mobileViewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setMobileViewMode('cards')}
                >
                  <LayoutGrid size={13} /> Cards
                </button>
                <button 
                  type="button"
                  className={`view-mode-btn ${mobileViewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setMobileViewMode('table')}
                >
                  <List size={13} /> Table
                </button>
              </div>

              <button 
                className="btn-admin-mark"
                onClick={() => setIsDisburseModalOpen(true)}
                style={{ background: '#10B981', padding: '7px 14px', fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Disburse New Advance
              </button>
            </div>
          </div>

          {advances.length === 0 ? (
            <div className="empty-state-wrap" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <IndianRupee size={40} className="empty-icon text-emerald" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#0F172A', fontWeight: 700 }}>No Salary Advances Disbursed</h3>
              <p style={{ color: '#64748B', fontSize: '0.9rem' }}>When an employee requests an advance, click "Give Advance" above to track recovery.</p>
            </div>
          ) : (
            <>
              {/* Desktop Uncompressed Table (min-width: 980px guaranteed) */}
              <div className="payroll-table-wrapper">
                <table className="payroll-table" style={{ minWidth: '980px' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '180px' }}>Employee</th>
                      <th style={{ minWidth: '140px' }}>Advance Amount</th>
                      <th style={{ minWidth: '120px' }}>Date Disbursed</th>
                      <th style={{ minWidth: '160px' }}>Mode & Reference</th>
                      <th style={{ minWidth: '170px' }}>Repayment Progress</th>
                      <th style={{ minWidth: '160px' }}>Reason</th>
                      <th style={{ minWidth: '100px' }}>Status</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advances.map(adv => {
                      const percentRecovered = adv.amount > 0 ? Math.round((adv.recoveredAmount / adv.amount) * 100) : 0;
                      const isSettled = adv.status === 'SETTLED';

                      return (
                        <tr key={adv.id}>
                          <td>
                            <div className="font-bold text-navy">{adv.employeeName}</div>
                            <div className="text-muted text-xs">{adv.employeeId}</div>
                          </td>

                          <td>
                            <div className="font-extrabold text-navy">₹{adv.amount.toLocaleString()}</div>
                            <div className="text-muted text-xs">
                              {adv.recoveryPlan === 'FULL_NEXT_PAYROLL' ? 'Full next salary' : `₹${adv.installmentAmount}/month`}
                            </div>
                          </td>

                          <td>{adv.date}</td>

                          <td>
                            <span className="font-semibold">{adv.paymentMode}</span>
                            {adv.referenceNumber && (
                              <div className="text-muted text-xs">Ref: {adv.referenceNumber}</div>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
                              <span style={{ color: '#16A34A' }}>₹{adv.recoveredAmount.toLocaleString()} paid</span>
                              <span style={{ color: '#DC2626' }}>₹{adv.remainingBalance.toLocaleString()} left</span>
                            </div>
                            <div className="advance-prog-bar-wrap">
                              <div className="advance-prog-bar-fill" style={{ width: `${percentRecovered}%` }}></div>
                            </div>
                          </td>

                          <td style={{ maxWidth: '220px', fontSize: '13px' }}>
                            "{adv.reason}"
                          </td>

                          <td>
                            {isSettled ? (
                              <span className="badge-advance-settled">SETTLED</span>
                            ) : adv.status === 'PARTIALLY_RECOVERED' ? (
                              <span className="badge-advance-active">PARTIAL</span>
                            ) : (
                              <span className="badge-advance-active">ACTIVE</span>
                            )}
                          </td>

                          <td className="col-actions">
                            {!isSettled ? (
                              <button 
                                className="btn-outline" 
                                style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}
                                onClick={() => {
                                  showConfirmModal(
                                    'Record Advance Repayment',
                                    `Record manual repayment for ${adv.employeeName}? Outstanding balance: ₹${adv.remainingBalance.toLocaleString()}`,
                                    async () => {
                                      await recordAdvanceRecovery(adv.id, adv.remainingBalance, 'Direct manual cash/bank repayment');
                                      showToast(`Settled advance for ${adv.employeeName}!`, 'success');
                                    }
                                  );
                                }}
                              >
                                Settle Full
                              </button>
                            ) : (
                              <span className="text-muted text-xs">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Advance Cards */}
              <div className="payroll-mobile-cards">
                {advances.map(adv => {
                  const percentRecovered = adv.amount > 0 ? Math.round((adv.recoveredAmount / adv.amount) * 100) : 0;
                  const isSettled = adv.status === 'SETTLED';

                  return (
                    <div key={`m-adv-${adv.id}`} className="payroll-mobile-card">
                      <div className="p-m-header">
                        <div>
                          <div className="p-m-name">{adv.employeeName}</div>
                          <div className="p-m-sub">{adv.employeeId} • {adv.date}</div>
                        </div>
                        <div>
                          {isSettled ? (
                            <span className="badge-advance-settled">SETTLED</span>
                          ) : (
                            <span className="badge-advance-active">ACTIVE (₹{adv.remainingBalance.toLocaleString()} Left)</span>
                          )}
                        </div>
                      </div>

                      <div className="p-m-net-box" style={{ background: '#FFFBEB', borderColor: '#FCD34D' }}>
                        <div>
                          <span className="p-m-net-lbl" style={{ color: '#92400E' }}>TOTAL ADVANCE DISBURSED</span>
                          <span className="p-m-net-val" style={{ color: '#78350F' }}>₹{adv.amount.toLocaleString()}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="p-m-net-lbl" style={{ color: '#92400E' }}>PLAN</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#78350F', display: 'block' }}>
                            {adv.recoveryPlan === 'FULL_NEXT_PAYROLL' ? 'Full Next Salary' : `₹${adv.installmentAmount}/mo`}
                          </span>
                        </div>
                      </div>

                      {/* Repayment Progress */}
                      <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, marginBottom: '6px' }}>
                          <span style={{ color: '#16A34A' }}>Paid: ₹{adv.recoveredAmount.toLocaleString()} ({percentRecovered}%)</span>
                          <span style={{ color: '#DC2626' }}>Balance: ₹{adv.remainingBalance.toLocaleString()}</span>
                        </div>
                        <div className="advance-prog-bar-wrap" style={{ maxWidth: '100%', height: '8px' }}>
                          <div className="advance-prog-bar-fill" style={{ width: `${percentRecovered}%` }}></div>
                        </div>
                        <div className="p-m-hint" style={{ marginTop: '6px' }}>
                          Payment: {adv.paymentMode} {adv.referenceNumber ? `• Ref: ${adv.referenceNumber}` : ''}
                        </div>
                      </div>

                      {adv.reason && (
                        <div style={{ fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                          "{adv.reason}"
                        </div>
                      )}

                      {!isSettled && (
                        <button 
                          className="btn-disburse-mobile"
                          style={{ background: '#0284C7' }}
                          onClick={() => {
                            showConfirmModal(
                              'Record Advance Repayment',
                              `Record manual repayment for ${adv.employeeName}? Outstanding balance: ₹${adv.remainingBalance.toLocaleString()}`,
                              async () => {
                                await recordAdvanceRecovery(adv.id, adv.remainingBalance, 'Direct manual cash/bank repayment');
                                showToast(`Settled advance for ${adv.employeeName}!`, 'success');
                              }
                            );
                          }}
                        >
                          <Check size={16} /> Settle Advance (₹{adv.remainingBalance.toLocaleString()})
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SALARY STRUCTURES */}
      {/* ========================================================================= */}
      {activeTab === 'structures' && (
        <div className={`payroll-card ${mobileViewMode === 'table' ? 'show-table-on-mobile' : ''}`}>
          <div className="payroll-toolbar">
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A', fontWeight: 800 }}>
              Employee Salary Packages & Bank Details
            </h3>

            <div className="payroll-toolbar-right">
              {/* Mobile View Toggle */}
              <div className="view-mode-toggle">
                <button 
                  type="button"
                  className={`view-mode-btn ${mobileViewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setMobileViewMode('cards')}
                >
                  <LayoutGrid size={13} /> Cards
                </button>
                <button 
                  type="button"
                  className={`view-mode-btn ${mobileViewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setMobileViewMode('table')}
                >
                  <List size={13} /> Table
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Table (min-width: 900px guaranteed) */}
          <div className="payroll-table-wrapper">
            <table className="payroll-table" style={{ minWidth: '920px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Employee</th>
                  <th style={{ minWidth: '150px' }}>Monthly Base Salary</th>
                  <th style={{ minWidth: '130px' }}>Daily Rate (Est)</th>
                  <th style={{ minWidth: '130px' }}>Bank Name</th>
                  <th style={{ minWidth: '130px' }}>Account Number</th>
                  <th style={{ minWidth: '110px' }}>IFSC Code</th>
                  <th style={{ minWidth: '120px' }}>UPI ID</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companyEmployees.map(emp => {
                  const config = salaryConfigs.find(s => s.employeeId === emp.id);
                  const base = config?.baseSalary || 20000;
                  const dailyRate = Math.round(base / 30);

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="font-bold text-navy">{emp.name}</div>
                        <div className="text-muted text-xs">{emp.id} • {emp.role}</div>
                      </td>

                      <td>
                        <span className="font-extrabold text-navy" style={{ fontSize: '1.05rem' }}>
                          ₹{base.toLocaleString()}
                        </span>
                        <span className="text-muted text-xs" style={{ display: 'block' }}>Monthly Fixed</span>
                      </td>

                      <td>
                        <span className="font-semibold text-navy">₹{dailyRate}/day</span>
                        <span className="text-muted text-xs" style={{ display: 'block' }}>Per day cut rate</span>
                      </td>

                      <td>{config?.bankName || '—'}</td>
                      <td>{config?.accountNumber ? `••••${config.accountNumber.slice(-4)}` : '—'}</td>
                      <td>{config?.ifscCode || '—'}</td>
                      <td>{config?.upiId || '—'}</td>

                      <td className="col-actions">
                        <button 
                          className="btn-outline" 
                          style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
                          onClick={() => {
                            setEditSalaryForm({
                              employeeId: emp.id,
                              employeeName: emp.name,
                              baseSalary: base,
                              salaryType: config?.salaryType || 'MONTHLY',
                              bankName: config?.bankName || '',
                              accountNumber: config?.accountNumber || '',
                              ifscCode: config?.ifscCode || '',
                              upiId: config?.upiId || ''
                            });
                            setIsEditSalaryModalOpen(true);
                          }}
                        >
                          Edit Structure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Salary Structure Cards */}
          <div className="payroll-mobile-cards">
            {companyEmployees.map(emp => {
              const config = salaryConfigs.find(s => s.employeeId === emp.id);
              const base = config?.baseSalary || 20000;
              const dailyRate = Math.round(base / 30);

              return (
                <div key={`m-struct-${emp.id}`} className="payroll-mobile-card">
                  <div className="p-m-header">
                    <div>
                      <div className="p-m-name">{emp.name}</div>
                      <div className="p-m-sub">{emp.id} • {emp.role}</div>
                    </div>
                  </div>

                  <div className="p-m-net-box" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
                    <div>
                      <span className="p-m-net-lbl" style={{ color: '#1E40AF' }}>MONTHLY BASE SALARY</span>
                      <span className="p-m-net-val" style={{ color: '#1E3A8A' }}>₹{base.toLocaleString()}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="p-m-net-lbl" style={{ color: '#1E40AF' }}>DAILY CUT RATE</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E3A8A', display: 'block' }}>
                        ₹{dailyRate}/day
                      </span>
                    </div>
                  </div>

                  <div className="p-m-grid">
                    <div className="p-m-cell">
                      <span className="p-m-lbl">Bank Name</span>
                      <span className="p-m-val" style={{ fontSize: '0.85rem' }}>{config?.bankName || 'Not Set'}</span>
                    </div>
                    <div className="p-m-cell">
                      <span className="p-m-lbl">Account Number</span>
                      <span className="p-m-val" style={{ fontSize: '0.85rem' }}>
                        {config?.accountNumber ? `••••${config.accountNumber.slice(-4)}` : 'Not Set'}
                      </span>
                    </div>
                    <div className="p-m-cell">
                      <span className="p-m-lbl">IFSC Code</span>
                      <span className="p-m-val" style={{ fontSize: '0.85rem' }}>{config?.ifscCode || 'Not Set'}</span>
                    </div>
                    <div className="p-m-cell">
                      <span className="p-m-lbl">UPI ID</span>
                      <span className="p-m-val" style={{ fontSize: '0.85rem' }}>{config?.upiId || 'Not Set'}</span>
                    </div>
                  </div>

                  <button 
                    className="btn-payslip-mobile"
                    onClick={() => {
                      setEditSalaryForm({
                        employeeId: emp.id,
                        employeeName: emp.name,
                        baseSalary: base,
                        salaryType: config?.salaryType || 'MONTHLY',
                        bankName: config?.bankName || '',
                        accountNumber: config?.accountNumber || '',
                        ifscCode: config?.ifscCode || '',
                        upiId: config?.upiId || ''
                      });
                      setIsEditSalaryModalOpen(true);
                    }}
                  >
                    Edit Structure & Bank Details
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DISBURSE ADVANCE */}
      {/* ========================================================================= */}
      {isDisburseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDisburseModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '480px', padding: '1.75rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IndianRupee size={20} color="#10B981" /> Disburse Employee Advance
              </h3>
              <button className="close-btn" onClick={() => setIsDisburseModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleDisburseAdvanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Select Employee *
                </label>
                <select 
                  value={disburseForm.employeeId}
                  onChange={(e) => setDisburseForm({ ...disburseForm, employeeId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 600 }}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {companyEmployees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.id})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Advance Amount (₹) *
                  </label>
                  <input 
                    type="number"
                    min="100"
                    placeholder="e.g. 5000"
                    value={disburseForm.amount}
                    onChange={(e) => setDisburseForm({ ...disburseForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 700 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Disbursement Date *
                  </label>
                  <input 
                    type="date"
                    value={disburseForm.date}
                    onChange={(e) => setDisburseForm({ ...disburseForm, date: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Payment Mode
                  </label>
                  <select 
                    value={disburseForm.paymentMode}
                    onChange={(e) => setDisburseForm({ ...disburseForm, paymentMode: e.target.value as AdvancePaymentMode })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cash">Cash Voucher</option>
                    <option value="Cheque">Company Cheque</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Reference / UTR #
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. UTR49281928"
                    value={disburseForm.referenceNumber}
                    onChange={(e) => setDisburseForm({ ...disburseForm, referenceNumber: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Recovery Plan *
                </label>
                <select 
                  value={disburseForm.recoveryPlan}
                  onChange={(e) => setDisburseForm({ ...disburseForm, recoveryPlan: e.target.value as any })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="FULL_NEXT_PAYROLL">Deduct 100% from Next Month's Salary</option>
                  <option value="MONTHLY_INSTALLMENT">Deduct in Monthly Installments</option>
                </select>
              </div>

              {disburseForm.recoveryPlan === 'MONTHLY_INSTALLMENT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Monthly Installment Deduction Amount (₹)
                  </label>
                  <input 
                    type="number"
                    placeholder="e.g. 2000"
                    value={disburseForm.installmentAmount}
                    onChange={(e) => setDisburseForm({ ...disburseForm, installmentAmount: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Reason / Purpose *
                </label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Festival advance, emergency family medical expenses..."
                  value={disburseForm.reason}
                  onChange={(e) => setDisburseForm({ ...disburseForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" className="btn-outline" onClick={() => setIsDisburseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#10B981', borderColor: '#10B981' }}>
                  Confirm & Disburse Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT SALARY STRUCTURE */}
      {/* ========================================================================= */}
      {isEditSalaryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEditSalaryModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '480px', padding: '1.75rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A', fontWeight: 800 }}>
                Edit Salary Package: {editSalaryForm.employeeName}
              </h3>
              <button className="close-btn" onClick={() => setIsEditSalaryModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveSalaryConfigSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Monthly Base Salary (₹) *
                </label>
                <input 
                  type="number"
                  value={editSalaryForm.baseSalary}
                  onChange={(e) => setEditSalaryForm({ ...editSalaryForm, baseSalary: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '16px', fontWeight: 800 }}
                  required
                />
                <span className="text-muted text-xs" style={{ display: 'block', marginTop: '4px' }}>
                  Daily cut rate = ₹{Math.round(editSalaryForm.baseSalary / 30)}/day
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Bank Name
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={editSalaryForm.bankName}
                    onChange={(e) => setEditSalaryForm({ ...editSalaryForm, bankName: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Account Number
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. 501002938172"
                    value={editSalaryForm.accountNumber}
                    onChange={(e) => setEditSalaryForm({ ...editSalaryForm, accountNumber: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    IFSC Code
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. HDFC0001234"
                    value={editSalaryForm.ifscCode}
                    onChange={(e) => setEditSalaryForm({ ...editSalaryForm, ifscCode: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    UPI ID
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. name@upi"
                    value={editSalaryForm.upiId}
                    onChange={(e) => setEditSalaryForm({ ...editSalaryForm, upiId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" className="btn-outline" onClick={() => setIsEditSalaryModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#0284C7', borderColor: '#0284C7' }}>
                  Save Salary Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MARK SALARY AS PAID */}
      {/* ========================================================================= */}
      {isMarkPaidModalOpen && markPaidTarget && (
        <div className="modal-overlay" onClick={() => setIsMarkPaidModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '440px', padding: '1.75rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A', fontWeight: 800 }}>
                Disburse Monthly Salary
              </h3>
              <button className="close-btn" onClick={() => setIsMarkPaidModalOpen(false)}><X size={20} /></button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', marginBottom: '1rem', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748B' }}>Paying Employee:</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{markPaidTarget.employeeName}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.9rem' }}>
                <span>Month: <strong>{markPaidTarget.month}</strong></span>
                <span style={{ color: '#16A34A', fontWeight: 800 }}>Net Pay: ₹{markPaidTarget.netPayable.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmMarkPaid} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Payment Method *
                </label>
                <select 
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI Transfer</option>
                  <option value="Cash">Cash Voucher</option>
                  <option value="Cheque">Company Cheque</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Transaction Reference / UTR Number *
                </label>
                <input 
                  type="text"
                  placeholder="e.g. UTR2918291039"
                  value={paymentForm.paymentReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  required
                />
              </div>

              {markPaidTarget.advanceDeduction > 0 && (
                <div style={{ background: '#FEF3C7', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FCD34D', fontSize: '12px', color: '#B45309' }}>
                  ℹ️ <strong>Advance Recovery:</strong> ₹{markPaidTarget.advanceDeduction.toLocaleString()} will automatically be deducted from active advances upon confirmation.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" className="btn-outline" onClick={() => setIsMarkPaidModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#10B981', borderColor: '#10B981' }}>
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: FORMAL PRINTABLE PAYSLIP */}
      {/* ========================================================================= */}
      {isPayslipModalOpen && viewingPayslip && (
        <div className="modal-overlay" onClick={() => setIsPayslipModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '650px', padding: '2rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A', fontWeight: 800 }}>
                Formal Salary Slip
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-primary" 
                  onClick={() => window.print()}
                  style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={15} /> Print Payslip
                </button>
                <button className="close-btn" onClick={() => setIsPayslipModalOpen(false)}><X size={20} /></button>
              </div>
            </div>

            {/* Print Section */}
            <div className="payslip-container">
              <div className="payslip-header">
                <div className="payslip-company-name">MIRROR SOLAR VISION PVT LTD</div>
                <div className="payslip-subtext">Head Office: Eluru, Andhra Pradesh • Email: mirrorsolarvision@gmail.com</div>
                <div style={{ marginTop: '8px', fontWeight: 700, fontSize: '0.95rem', color: '#0284C7' }}>
                  SALARY SLIP FOR THE MONTH OF {viewingPayslip.month.toUpperCase()}
                </div>
              </div>

              <div className="payslip-grid">
                <div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Employee Name:</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>{viewingPayslip.employeeName}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Employee ID: <strong>{viewingPayslip.employeeId}</strong></div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Designation: <strong>{viewingPayslip.role}</strong></div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Attendance Breakdown:</div>
                  <div style={{ fontSize: '12px', color: '#0F172A', marginTop: '2px' }}>
                    Total Calendar Days: <strong>{viewingPayslip.totalDaysInMonth}</strong><br />
                    Days Present: <strong>{viewingPayslip.presentDays}</strong> • Half Days: <strong>{viewingPayslip.halfDays}</strong><br />
                    Leaves: <strong>{viewingPayslip.leaveDays}</strong> • Absences: <strong>{viewingPayslip.absentDays}</strong>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Table */}
              <table className="payslip-breakdown-table">
                <thead>
                  <tr>
                    <th>Earnings Breakdown</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                    <th>Deductions Breakdown</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Base Fixed Salary</td>
                    <td style={{ textAlign: 'right' }}>₹{viewingPayslip.baseSalary.toLocaleString()}</td>
                    <td>Leave Salary Cut ({viewingPayslip.leaveDays} day(s))</td>
                    <td style={{ textAlign: 'right', color: '#DC2626' }}>-₹{viewingPayslip.leaveDeduction.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Performance / Extra Bonus</td>
                    <td style={{ textAlign: 'right' }}>₹{viewingPayslip.bonusAmount.toLocaleString()}</td>
                    <td>Absent Salary Cut ({viewingPayslip.absentDays} day(s))</td>
                    <td style={{ textAlign: 'right', color: '#DC2626' }}>-₹{viewingPayslip.absentDeduction.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>—</td>
                    <td style={{ textAlign: 'right' }}>—</td>
                    <td>Employee Advance Deduction</td>
                    <td style={{ textAlign: 'right', color: '#DC2626' }}>-₹{viewingPayslip.advanceDeduction.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <div className="payslip-net-box">
                <span>NET PAYABLE SALARY:</span>
                <span>₹{viewingPayslip.netPayable.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', fontSize: '11px', color: '#64748B' }}>
                <div>Employer Signature: __________________</div>
                <div>Employee Signature: __________________</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
