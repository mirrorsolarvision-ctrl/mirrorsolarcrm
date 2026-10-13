import React, { useState, useMemo } from 'react';
import { 
  Award, Target, CheckCircle2, Clock, ChevronDown, ChevronUp, Search, 
  Download, Calendar, Users, Wallet, 
  ArrowRight, ShieldCheck, Check, TrendingUp, Sparkles, AlertCircle,
  FileCheck, ArrowUpRight, Zap
} from 'lucide-react';
import PageHero from './components/PageHero';
import { useCRM } from './context/CRMContext';
import type { MockLead, PaymentMilestoneType } from './context/CRMContext';
import { useUI } from './context/UIContext';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './MilestonesPage.css';

interface MilestonesPageProps {
  onNavigate?: (tabName: string) => void;
  defaultTab?: 'marketing' | 'dealer' | 'analytics';
}

export default function MilestonesPage({ onNavigate, defaultTab = 'marketing' }: MilestonesPageProps) {
  const { 
    leads, employees, dealers, currentUser, 
    settleLeadPayment, acknowledgeLeadPayment 
  } = useCRM();
  const { showToast } = useUI();

  const isAdmin = currentUser?.role === 'Admin';
  const isDealer = currentUser?.role === 'Dealer';
  const isEmployee = currentUser?.role === 'Employee';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'marketing' | 'dealer' | 'analytics'>(defaultTab);

  // Month & Year Filter for Marketing Milestones
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Marketing Employee Search & Status Filter
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<'all' | 'achieved' | 'pending'>('all');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Dealer Project Filter
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');
  const [dealerStatusFilter, setDealerStatusFilter] = useState<'all' | 'pending_settlement' | 'settled' | 'received'>('all');

  // Milestone Settle Modal State (Admin settles milestone payout)
  const [settleTarget, setSettleTarget] = useState<{ lead: MockLead; milestoneType: PaymentMilestoneType } | null>(null);
  const [settleForm, setSettleForm] = useState({
    amount: '',
    utrNumber: '',
    adminNotes: '',
    file: null as File | null
  });
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Dealer Milestone Confirm Modal State
  const [confirmTarget, setConfirmTarget] = useState<{ lead: MockLead; milestoneType: PaymentMilestoneType } | null>(null);
  const [dealerNotes, setDealerNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Mandatory Marketing Milestone constant
  const MINIMUM_MARKETING_SALES_TARGET = 4;

  // --------------------------------------------------------------------------
  // 1. MARKETING EMPLOYEES & MONTHLY SALES MILESTONES
  // --------------------------------------------------------------------------
  const marketingEmployees = useMemo(() => {
    return employees.filter(emp => {
      const cat = (emp.employeeCategory || (emp as any).category || '').toLowerCase();
      // Exclude dedicated warehouse stock incharge and PM surya central lead processing
      if (cat.includes('stock incharge')) return false;
      return true;
    });
  }, [employees]);

  // Derived: Converted leads per marketing employee for the selected month
  const marketingMilestoneStats = useMemo(() => {
    return marketingEmployees.map(emp => {
      const empName = (emp.name || '').toLowerCase().trim();
      const empId = (emp.id || '').toLowerCase().trim();

      // Find leads converted by this employee in the selected month & year
      const empConvertedLeads = leads.filter(l => {
        // Must be in converted or downstream stage
        const isConvertedStage = ['Converted', 'Loan', 'Material', 'Installation', 'Completed'].includes(l.stage);
        if (!isConvertedStage) return false;

        // Check attribution
        const assigned = (l.assignedEmployee || '').toLowerCase().trim();
        const marketing = ((l as any).marketingEmployee || (l as any).sourceMarketingEmployee || '').toLowerCase().trim();
        const createdByName = (l.createdByName || '').toLowerCase().trim();
        const createdById = (l.createdBy || '').toLowerCase().trim();
        const assignedId = (l.assignedEmployeeId || '').toLowerCase().trim();

        const isMatch = (empName && (assigned === empName || marketing === empName || createdByName === empName)) ||
                        (empId && (createdById === empId || assignedId === empId));
        if (!isMatch) return false;

        // Check month and year
        const dateStr = l.convertedAt || l.updatedAt || l.createdAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true; // fallback to include if date string malformed

        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });

      const salesCount = empConvertedLeads.length;
      const target = MINIMUM_MARKETING_SALES_TARGET;
      const progressPct = Math.min(100, Math.round((salesCount / target) * 100));
      const isAchieved = salesCount >= target;
      const remainingNeeded = Math.max(0, target - salesCount);

      // Total kW capacity & deal value closed
      const totalKw = empConvertedLeads.reduce((acc, l) => {
        const spec = l.dealerSpecifications?.systemCapacityKw || (l as any).systemCapacity || '3';
        const kw = parseFloat(spec);
        return acc + (isNaN(kw) ? 3 : kw);
      }, 0);

      const totalDealValue = empConvertedLeads.reduce((acc, l) => {
        const custPaySum = l.payments?.customerPayments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
        return acc + ((l as any).dealValue || custPaySum || 150000);
      }, 0);

      return {
        emp,
        salesCount,
        target,
        progressPct,
        isAchieved,
        remainingNeeded,
        totalKw,
        totalDealValue,
        leads: empConvertedLeads
      };
    });
  }, [marketingEmployees, leads, selectedMonth, selectedYear]);

  // Filtered Marketing Stats
  const filteredMarketingStats = useMemo(() => {
    return marketingMilestoneStats.filter(item => {
      const q = empSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || item.emp.name.toLowerCase().includes(q) || item.emp.phone.toLowerCase().includes(q);
      
      let matchesStatus = true;
      if (empStatusFilter === 'achieved') matchesStatus = item.isAchieved;
      if (empStatusFilter === 'pending') matchesStatus = !item.isAchieved;

      return matchesSearch && matchesStatus;
    });
  }, [marketingMilestoneStats, empSearchQuery, empStatusFilter]);

  // Overall Marketing Summary
  const marketingSummary = useMemo(() => {
    const totalStaff = marketingMilestoneStats.length;
    const achievedCount = marketingMilestoneStats.filter(m => m.isAchieved).length;
    const totalSalesAchieved = marketingMilestoneStats.reduce((sum, m) => sum + m.salesCount, 0);
    const attainmentRate = totalStaff > 0 ? Math.round((achievedCount / totalStaff) * 100) : 0;
    
    // Days remaining in month
    const now = new Date();
    const daysInCurrentMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const isCurrentCalendarMonth = now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
    const daysRemaining = isCurrentCalendarMonth ? Math.max(0, daysInCurrentMonth - now.getDate()) : 0;

    return { totalStaff, achievedCount, totalSalesAchieved, attainmentRate, daysRemaining, isCurrentCalendarMonth };
  }, [marketingMilestoneStats, selectedMonth, selectedYear]);

  // --------------------------------------------------------------------------
  // 2. DEALER PROJECT MILESTONES (Pre & Post Installation Payouts)
  // --------------------------------------------------------------------------
  const eligibleDealerLeads = useMemo(() => {
    let list = leads.filter(l => {
      const isConvertedOrBeyond = ['Converted', 'Loan', 'Material', 'Installation', 'Completed'].includes(l.stage);
      return isConvertedOrBeyond && (l.dealer || l.dealerId);
    });

    if (isDealer && currentUser) {
      const dName = (currentUser.name || '').toLowerCase().trim();
      const dId = currentUser.id;
      list = list.filter(l => 
        (l.dealer && l.dealer.toLowerCase().includes(dName)) ||
        (l.dealerId && l.dealerId === dId)
      );
    }
    return list;
  }, [leads, isDealer, currentUser]);

  const filteredDealerLeads = useMemo(() => {
    return eligibleDealerLeads.filter(lead => {
      const q = dealerSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        lead.customer.toLowerCase().includes(q) ||
        (lead.dealer || '').toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q) ||
        (lead.payments?.preInstallation?.utrNumber?.toLowerCase() || '').includes(q) ||
        (lead.payments?.postInstallation?.utrNumber?.toLowerCase() || '').includes(q);

      if (!matchesSearch) return false;

      const preStatus = lead.payments?.preInstallation?.status || 'Pending Settlement';
      const postStatus = lead.payments?.postInstallation?.status || 'Pending Settlement';

      if (dealerStatusFilter === 'pending_settlement') {
        return preStatus === 'Pending Settlement' || postStatus === 'Pending Settlement';
      }
      if (dealerStatusFilter === 'settled') {
        return preStatus === 'Settled' || postStatus === 'Settled';
      }
      if (dealerStatusFilter === 'received') {
        return preStatus === 'Received' || postStatus === 'Received';
      }

      return true;
    });
  }, [eligibleDealerLeads, dealerSearchQuery, dealerStatusFilter]);

  // Dealer Milestone Metrics
  const dealerMilestoneMetrics = useMemo(() => {
    let totalPreSettled = 0;
    let totalPostSettled = 0;
    let pendingCount = 0;
    let receivedCount = 0;

    eligibleDealerLeads.forEach(lead => {
      const pre = lead.payments?.preInstallation;
      const post = lead.payments?.postInstallation;

      if (pre?.status === 'Settled' || pre?.status === 'Received') totalPreSettled += (pre.amount || 0);
      if (post?.status === 'Settled' || post?.status === 'Received') totalPostSettled += (post.amount || 0);

      if (!pre || pre.status === 'Pending Settlement') pendingCount++;
      if (pre?.status === 'Received') receivedCount++;
      if (!post || post.status === 'Pending Settlement') pendingCount++;
      if (post?.status === 'Received') receivedCount++;
    });

    return {
      totalDisbursed: totalPreSettled + totalPostSettled,
      totalPreSettled,
      totalPostSettled,
      pendingCount,
      receivedCount
    };
  }, [eligibleDealerLeads]);

  // Upload proof helper
  const uploadToFirebase = async (file: File, folder: string): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch {
      return URL.createObjectURL(file);
    }
  };

  // Submit Settlement
  const handleSubmitSettlement = async () => {
    if (!settleTarget) return;
    const numAmount = parseFloat(settleForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Please enter a valid payout amount.", 'error');
      return;
    }

    const existing = settleTarget.milestoneType === 'Pre-Installation' 
      ? settleTarget.lead.payments?.preInstallation 
      : settleTarget.lead.payments?.postInstallation;

    if (!settleForm.file && !existing?.proofUrl) {
      showToast("Please upload a payment proof screenshot or voucher.", 'error');
      return;
    }

    try {
      setIsUploadingProof(true);
      let proofUrl = existing?.proofUrl || '';
      let proofFileName = existing?.proofFileName || 'Payment_Proof.jpg';
      let proofFileSize = existing?.proofFileSize || 0;

      if (settleForm.file) {
        proofUrl = await uploadToFirebase(settleForm.file, 'payments/proofs');
        proofFileName = settleForm.file.name;
        proofFileSize = settleForm.file.size;
      }

      await settleLeadPayment(settleTarget.lead.id, settleTarget.milestoneType, {
        amount: numAmount,
        proofUrl,
        proofFileName,
        proofFileSize,
        utrNumber: settleForm.utrNumber.trim(),
        adminNotes: settleForm.adminNotes.trim()
      });

      showToast(`✓ ${settleTarget.milestoneType} payment settled & proof sent to Dealer!`, 'success');
      setSettleTarget(null);
    } catch (err: any) {
      console.error("Error settling payment:", err);
      showToast(err.message || "Failed to settle payment.", 'error');
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Confirm Received
  const handleConfirmReceived = async () => {
    if (!confirmTarget) return;
    try {
      setIsConfirming(true);
      await acknowledgeLeadPayment(confirmTarget.lead.id, confirmTarget.milestoneType, {
        dealerNotes: dealerNotes.trim()
      });
      showToast(`✓ Confirmed! ${confirmTarget.milestoneType} marked as Received.`, 'success');
      setConfirmTarget(null);
    } catch (err: any) {
      console.error("Error confirming payment:", err);
      showToast("Failed to confirm receipt.", 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="milestones-page">
      {/* Top Hero Banner */}
      <PageHero
        badge="Performance & Payout Milestones"
        icon={<Award size={26} />}
        title="Milestones & Targets Hub"
        subtitle="Manage Marketing Employee monthly sales milestones (Min. 4 Sales/Month) & Dealer project milestone payouts."
        actions={
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {onNavigate && (
              <button 
                className="btn-hero-secondary"
                onClick={() => onNavigate('Payments')}
                title="Open Finance & Payments"
              >
                <Wallet size={16} /> Finance & Payments
              </button>
            )}
          </div>
        }
      >
        {/* Module Sub-Navigation */}
        <div className="milestones-nav-tabs">
          <button 
            className={`milestone-nav-btn ${activeTab === 'marketing' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketing')}
          >
            <Target size={18} />
            <span>Marketing Sales Milestones</span>
            <span className="milestone-badge-pill green">Min 4 Sales / Mo</span>
          </button>

          <button 
            className={`milestone-nav-btn ${activeTab === 'dealer' ? 'active' : ''}`}
            onClick={() => setActiveTab('dealer')}
          >
            <ShieldCheck size={18} />
            <span>Dealer Project Milestones</span>
            <span className="milestone-badge-pill blue">40% / 60% Payouts</span>
          </button>

          <button 
            className={`milestone-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <TrendingUp size={18} />
            <span>Quota & Turnaround Analytics</span>
          </button>
        </div>
      </PageHero>

      <div className="milestones-content-container">

        {/* ================================================================== */}
        {/* TAB 1: MARKETING EMPLOYEE SALES MILESTONES (MINIMUM 4 SALES/MONTH) */}
        {/* ================================================================== */}
        {activeTab === 'marketing' && (
          <div className="marketing-milestones-section fade-in">
            {/* MANDATORY POLICY BANNER */}
            <div className="mandatory-milestone-banner">
              <div className="milestone-banner-left">
                <div className="milestone-gold-icon">
                  <Award size={32} />
                </div>
                <div>
                  <div className="banner-kicker">COMPANY SALES BENCHMARK</div>
                  <h2 className="banner-heading">Marketing Employee Milestone: Minimum 4 Sales Per Month</h2>
                  <p className="banner-desc">
                    Every marketing executive has a required performance milestone of <strong>minimum 4 converted customer sales per month</strong>. Achieving 4+ sales fulfills monthly quota compliance and unlocks executive performance incentives.
                  </p>
                </div>
              </div>

              <div className="milestone-banner-stats">
                <div className="banner-stat-chip">
                  <span className="chip-label">MONTHLY TARGET</span>
                  <span className="chip-value">4 Sales</span>
                </div>
                <div className="banner-stat-chip highlight">
                  <span className="chip-label">STATUS</span>
                  <span className="chip-value">{marketingSummary.achievedCount} / {marketingSummary.totalStaff} Met</span>
                </div>
              </div>
            </div>

            {/* Filter Bar: Month Selector + Search */}
            <div className="milestones-filter-bar">
              <div className="filter-group-left">
                <div className="date-picker-chip">
                  <Calendar size={16} color="var(--color-navy)" />
                  <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(parseInt(e.target.value))}
                    className="select-custom"
                  >
                    {monthsList.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>
                  <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(parseInt(e.target.value))}
                    className="select-custom"
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>

                <div className="search-input-box">
                  <Search size={16} />
                  <input 
                    type="text"
                    placeholder="Search marketing executive..."
                    value={empSearchQuery}
                    onChange={e => setEmpSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-group-right">
                <div className="status-toggle-pill">
                  <button 
                    className={`toggle-btn ${empStatusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setEmpStatusFilter('all')}
                  >
                    All ({marketingMilestoneStats.length})
                  </button>
                  <button 
                    className={`toggle-btn ${empStatusFilter === 'achieved' ? 'active' : ''}`}
                    onClick={() => setEmpStatusFilter('achieved')}
                  >
                    Achieved 🏆 ({marketingSummary.achievedCount})
                  </button>
                  <button 
                    className={`toggle-btn ${empStatusFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setEmpStatusFilter('pending')}
                  >
                    In Progress ({marketingSummary.totalStaff - marketingSummary.achievedCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Overall Monthly Attainment Metric Cards */}
            <div className="milestones-overview-grid">
              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Total Sales Converted ({monthsList[selectedMonth]})</span>
                  <div className="stat-icon-circle blue"><Zap size={18} /></div>
                </div>
                <div className="stat-card-value">{marketingSummary.totalSalesAchieved}</div>
                <div className="stat-card-footer text-muted">Across all marketing team members</div>
              </div>

              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Staff Quota Attainment</span>
                  <div className="stat-icon-circle green"><CheckCircle2 size={18} /></div>
                </div>
                <div className="stat-card-value">{marketingSummary.attainmentRate}%</div>
                <div className="stat-card-footer text-green">
                  {marketingSummary.achievedCount} of {marketingSummary.totalStaff} executives achieved 4+ sales
                </div>
              </div>

              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Minimum Target Baseline</span>
                  <div className="stat-icon-circle gold"><Target size={18} /></div>
                </div>
                <div className="stat-card-value">4 Sales / Mo</div>
                <div className="stat-card-footer">Standard marketing team threshold</div>
              </div>

              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Calendar Month Status</span>
                  <div className="stat-icon-circle purple"><Clock size={18} /></div>
                </div>
                <div className="stat-card-value">
                  {marketingSummary.isCurrentCalendarMonth ? `${marketingSummary.daysRemaining} Days Left` : 'Completed'}
                </div>
                <div className="stat-card-footer text-muted">
                  {marketingSummary.isCurrentCalendarMonth ? 'Days left to reach 4 sales milestone' : 'Historical record'}
                </div>
              </div>
            </div>

            {/* Marketing Reps Milestone Progress Grid */}
            <div className="marketing-cards-grid">
              {filteredMarketingStats.map(item => {
                const isExpanded = expandedEmpId === item.emp.id;
                const isCurrentLoggedIn = currentUser?.name === item.emp.name;

                return (
                  <div 
                    key={item.emp.id} 
                    className={`marketing-milestone-card ${item.isAchieved ? 'milestone-achieved' : ''} ${isCurrentLoggedIn ? 'current-user-card' : ''}`}
                  >
                    {isCurrentLoggedIn && (
                      <div className="my-quota-indicator">
                        <Sparkles size={12} /> YOUR MILESTONE TRACKER
                      </div>
                    )}

                    <div className="card-top-row">
                      <div className="emp-avatar-box">
                        {item.emp.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="emp-info-col">
                        <h3 className="emp-name">{item.emp.name}</h3>
                        <span className="emp-role-tag">{item.emp.employeeCategory || 'Marketing Executive'}</span>
                      </div>
                      <div className="emp-status-badge-col">
                        {item.isAchieved ? (
                          <span className="badge-achieved">
                            <Check size={14} /> 4+ Milestone Achieved!
                          </span>
                        ) : (
                          <span className="badge-pending">
                            <Clock size={14} /> {item.remainingNeeded} Needed for Quota
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Milestone Progress Bar */}
                    <div className="milestone-progress-section">
                      <div className="progress-labels">
                        <span className="progress-title">
                          <strong>{item.salesCount}</strong> / {item.target} Sales Closed
                        </span>
                        <span className="progress-percentage">
                          {item.progressPct}% of Monthly Goal
                        </span>
                      </div>
                      <div className="progress-track">
                        <div 
                          className={`progress-fill ${item.isAchieved ? 'achieved' : item.salesCount >= 2 ? 'medium' : 'low'}`}
                          style={{ width: `${item.progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Mini Stats Bar */}
                    <div className="card-mini-stats">
                      <div className="mini-stat-item">
                        <span className="mini-lbl">Closed kW</span>
                        <span className="mini-val">{item.totalKw} kW</span>
                      </div>
                      <div className="mini-stat-item">
                        <span className="mini-lbl">Deal Value</span>
                        <span className="mini-val">₹{item.totalDealValue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="mini-stat-item">
                        <span className="mini-lbl">Requirement</span>
                        <span className="mini-val font-semibold">Min 4 Sales</span>
                      </div>
                    </div>

                    {/* Collapsible Converted Leads List */}
                    <div className="card-leads-toggle-row">
                      <button 
                        className="btn-toggle-leads"
                        onClick={() => setExpandedEmpId(isExpanded ? null : item.emp.id)}
                      >
                        {isExpanded ? (
                          <>Hide Closed Sales ({item.leads.length}) <ChevronUp size={16} /></>
                        ) : (
                          <>View Converted Deals ({item.leads.length}) <ChevronDown size={16} /></>
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="card-leads-expanded-panel">
                        {item.leads.length === 0 ? (
                          <div className="empty-leads-notice">
                            No converted customer deals logged for {monthsList[selectedMonth]} {selectedYear} yet.
                          </div>
                        ) : (
                          <div className="leads-mini-list">
                            {item.leads.map(lead => (
                              <div key={lead.id} className="lead-mini-row">
                                <div className="lead-info-left">
                                  <div className="lead-cust-name">{lead.customer}</div>
                                  <div className="lead-meta-text">
                                    {lead.phone} • {lead.dealerSpecifications?.systemCapacityKw || (lead as any).systemCapacity || '3 kW'} • {lead.dealer || 'Direct'}
                                  </div>
                                </div>
                                <div className="lead-info-right">
                                  <span className="lead-stage-pill">{lead.stage}</span>
                                  <div className="lead-date-text">
                                    {lead.convertedAt ? new Date(lead.convertedAt).toLocaleDateString() : 'Active'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredMarketingStats.length === 0 && (
              <div className="empty-state-card">
                <Target size={40} color="#94a3b8" />
                <h3>No marketing executives found</h3>
                <p>Try adjusting your search criteria or filter options.</p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: DEALER PROJECT MILESTONES (PRE & POST INSTALLATION PAYOUTS) */}
        {/* ================================================================== */}
        {activeTab === 'dealer' && (
          <div className="dealer-milestones-section fade-in">
            {/* Header / Filter row */}
            <div className="milestones-filter-bar">
              <div className="filter-group-left">
                <div className="search-input-box">
                  <Search size={16} />
                  <input 
                    type="text"
                    placeholder="Search by customer, dealer, phone, or UTR..."
                    value={dealerSearchQuery}
                    onChange={e => setDealerSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-group-right">
                <div className="status-toggle-pill">
                  <button 
                    className={`toggle-btn ${dealerStatusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setDealerStatusFilter('all')}
                  >
                    All ({eligibleDealerLeads.length})
                  </button>
                  <button 
                    className={`toggle-btn ${dealerStatusFilter === 'pending_settlement' ? 'active' : ''}`}
                    onClick={() => setDealerStatusFilter('pending_settlement')}
                  >
                    Pending Settle
                  </button>
                  <button 
                    className={`toggle-btn ${dealerStatusFilter === 'settled' ? 'active' : ''}`}
                    onClick={() => setDealerStatusFilter('settled')}
                  >
                    Settled
                  </button>
                  <button 
                    className={`toggle-btn ${dealerStatusFilter === 'received' ? 'active' : ''}`}
                    onClick={() => setDealerStatusFilter('received')}
                  >
                    Confirmed
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="milestones-overview-grid">
              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Total Milestone Disbursements</span>
                  <div className="stat-icon-circle green"><Wallet size={18} /></div>
                </div>
                <div className="stat-card-value">₹{dealerMilestoneMetrics.totalDisbursed.toLocaleString('en-IN')}</div>
                <div className="stat-card-footer text-muted">Settled to Dealer Partners</div>
              </div>

              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Pre-Installation (40%) Settled</span>
                  <div className="stat-icon-circle blue"><ShieldCheck size={18} /></div>
                </div>
                <div className="stat-card-value">₹{dealerMilestoneMetrics.totalPreSettled.toLocaleString('en-IN')}</div>
                <div className="stat-card-footer">Milestone 1 payouts</div>
              </div>

              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Post-Installation (60%) Settled</span>
                  <div className="stat-icon-circle purple"><FileCheck size={18} /></div>
                </div>
                <div className="stat-card-value">₹{dealerMilestoneMetrics.totalPostSettled.toLocaleString('en-IN')}</div>
                <div className="stat-card-footer">Milestone 2 payouts</div>
              </div>

              <div className="milestone-stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-lbl">Awaiting Payout Settlement</span>
                  <div className="stat-icon-circle gold"><Clock size={18} /></div>
                </div>
                <div className="stat-card-value">{dealerMilestoneMetrics.pendingCount} Milestones</div>
                <div className="stat-card-footer text-muted">Ready for Admin settlement</div>
              </div>
            </div>

            {/* Projects Milestones Table */}
            <div className="milestones-table-card">
              <div className="table-responsive">
                <table className="milestones-table">
                  <thead>
                    <tr>
                      <th>Project / Customer</th>
                      <th>Dealer Partner</th>
                      <th>Stage & kW</th>
                      <th>Milestone 1: Pre-Install (40%)</th>
                      <th>Milestone 2: Post-Install (60%)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDealerLeads.map(lead => {
                      const pre = lead.payments?.preInstallation;
                      const post = lead.payments?.postInstallation;
                      const preStatus = pre?.status || 'Pending Settlement';
                      const postStatus = post?.status || 'Pending Settlement';

                      return (
                        <tr key={lead.id} className="milestone-row">
                          <td className="lead-main-cell">
                            <div className="lead-name font-semibold">{lead.customer}</div>
                            <div className="lead-sub text-muted">{lead.phone} • {lead.location || 'AP'}</div>
                          </td>

                          <td>
                            <div className="dealer-badge-box">
                              <span className="dealer-name">{lead.dealer || 'Direct Dealer'}</span>
                            </div>
                          </td>

                          <td>
                            <span className="stage-pill">{lead.stage}</span>
                            <div className="text-muted text-xs mt-1">{lead.dealerSpecifications?.systemCapacityKw || (lead as any).systemCapacity || '3 kW'} Solar</div>
                          </td>

                          {/* MILESTONE 1: Pre-Installation */}
                          <td>
                            <div className={`milestone-status-block ${preStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                              <div className="milestone-block-header">
                                <span className="m-tag">{preStatus}</span>
                                {pre?.amount && <span className="m-val">₹{pre.amount.toLocaleString('en-IN')}</span>}
                              </div>
                              {pre?.utrNumber && (
                                <div className="m-utr">UTR: {pre.utrNumber}</div>
                              )}
                              {pre?.proofUrl && (
                                <a 
                                  href={pre.proofUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="m-proof-link"
                                >
                                  <Download size={12} /> View Proof
                                </a>
                              )}
                            </div>
                          </td>

                          {/* MILESTONE 2: Post-Installation */}
                          <td>
                            <div className={`milestone-status-block ${postStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                              <div className="milestone-block-header">
                                <span className="m-tag">{postStatus}</span>
                                {post?.amount && <span className="m-val">₹{post.amount.toLocaleString('en-IN')}</span>}
                              </div>
                              {post?.utrNumber && (
                                <div className="m-utr">UTR: {post.utrNumber}</div>
                              )}
                              {post?.proofUrl && (
                                <a 
                                  href={post.proofUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="m-proof-link"
                                >
                                  <Download size={12} /> View Proof
                                </a>
                              )}
                            </div>
                          </td>

                          {/* ACTION BUTTONS */}
                          <td className="actions-cell">
                            <div className="action-buttons-wrap">
                              {/* Admin Settle Pre Button */}
                              {isAdmin && preStatus === 'Pending Settlement' && (
                                <button 
                                  className="btn-action-primary"
                                  onClick={() => {
                                    setSettleTarget({ lead, milestoneType: 'Pre-Installation' });
                                    setSettleForm({ amount: pre?.amount ? String(pre.amount) : '', utrNumber: '', adminNotes: '', file: null });
                                  }}
                                  title="Settle Pre-Installation Payout"
                                >
                                  Settle Pre (40%)
                                </button>
                              )}

                              {/* Admin Settle Post Button */}
                              {isAdmin && postStatus === 'Pending Settlement' && (
                                <button 
                                  className="btn-action-primary"
                                  onClick={() => {
                                    setSettleTarget({ lead, milestoneType: 'Post-Installation' });
                                    setSettleForm({ amount: post?.amount ? String(post.amount) : '', utrNumber: '', adminNotes: '', file: null });
                                  }}
                                  title="Settle Post-Installation Payout"
                                >
                                  Settle Post (60%)
                                </button>
                              )}

                              {/* Dealer Confirm Pre Button */}
                              {(isDealer || isAdmin) && preStatus === 'Settled' && (
                                <button 
                                  className="btn-action-confirm"
                                  onClick={() => {
                                    setConfirmTarget({ lead, milestoneType: 'Pre-Installation' });
                                    setDealerNotes('');
                                  }}
                                >
                                  Confirm Pre Received
                                </button>
                              )}

                              {/* Dealer Confirm Post Button */}
                              {(isDealer || isAdmin) && postStatus === 'Settled' && (
                                <button 
                                  className="btn-action-confirm"
                                  onClick={() => {
                                    setConfirmTarget({ lead, milestoneType: 'Post-Installation' });
                                    setDealerNotes('');
                                  }}
                                >
                                  Confirm Post Received
                                </button>
                              )}

                              {preStatus === 'Received' && postStatus === 'Received' && (
                                <span className="fully-settled-badge">
                                  <Check size={14} /> All Milestones Paid
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredDealerLeads.length === 0 && (
                <div className="empty-table-state">
                  <ShieldCheck size={36} color="#94a3b8" />
                  <p>No project milestones match current filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: TARGET & MILESTONE ANALYTICS                                */}
        {/* ================================================================== */}
        {activeTab === 'analytics' && (
          <div className="analytics-milestones-section fade-in">
            <div className="analytics-grid-two">
              {/* Marketing Milestone Attainment Card */}
              <div className="analytics-box">
                <div className="analytics-box-header">
                  <Target size={20} color="var(--color-navy)" />
                  <h3>Marketing Team Quota Performance (Min. 4 Sales Target)</h3>
                </div>
                <div className="analytics-box-body">
                  <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                    Company standard stipulates each marketing executive must convert at least 4 solar plant customers each calendar month.
                  </p>
                  <div className="target-progress-circle-row">
                    <div className="big-percentage-badge">
                      <span className="big-num">{marketingSummary.attainmentRate}%</span>
                      <span className="big-lbl">Target Achieved</span>
                    </div>
                    <div className="target-breakdown-list">
                      <div className="target-row">
                        <span>Achieved 4+ Sales Goal:</span>
                        <strong className="text-green">{marketingSummary.achievedCount} Staff</strong>
                      </div>
                      <div className="target-row">
                        <span>Working Towards Milestone:</span>
                        <strong className="text-amber">{marketingSummary.totalStaff - marketingSummary.achievedCount} Staff</strong>
                      </div>
                      <div className="target-row">
                        <span>Total Converted Customer Deals:</span>
                        <strong>{marketingSummary.totalSalesAchieved} Sales</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dealer Payout Turnaround Card */}
              <div className="analytics-box">
                <div className="analytics-box-header">
                  <ShieldCheck size={20} color="#16a34a" />
                  <h3>Dealer Milestone Payout Governance</h3>
                </div>
                <div className="analytics-box-body">
                  <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                    Two-stage milestone distribution: 40% advance disbursed upon Material dispatch, and final 60% released upon site installation approval and PCR sign-off.
                  </p>
                  <div className="payout-distribution-row">
                    <div className="payout-tile pre">
                      <span className="tile-title">Pre-Installation (40%)</span>
                      <span className="tile-val">₹{dealerMilestoneMetrics.totalPreSettled.toLocaleString('en-IN')}</span>
                      <span className="tile-sub">Material Delivery Trigger</span>
                    </div>
                    <div className="payout-tile post">
                      <span className="tile-title">Post-Installation (60%)</span>
                      <span className="tile-val">₹{dealerMilestoneMetrics.totalPostSettled.toLocaleString('en-IN')}</span>
                      <span className="tile-sub">PCR & Inspection Trigger</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ================================================================== */}
      {/* MODAL 1: ADMIN SETTLE MILESTONE PAYOUT MODAL                       */}
      {/* ================================================================== */}
      {settleTarget && (
        <div className="modal-backdrop-overlay">
          <div className="milestone-modal-card">
            <div className="modal-header">
              <h3>Settle {settleTarget.milestoneType} Milestone</h3>
              <button className="btn-close" onClick={() => setSettleTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Disburse milestone payment for customer <strong>{settleTarget.lead.customer}</strong> to dealer <strong>{settleTarget.lead.dealer}</strong>.
              </p>

              <div className="form-group">
                <label>Payout Amount (₹) *</label>
                <input 
                  type="number"
                  className="input-custom"
                  placeholder="e.g. 25000"
                  value={settleForm.amount}
                  onChange={e => setSettleForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Bank UTR / Transaction Reference *</label>
                <input 
                  type="text"
                  className="input-custom"
                  placeholder="e.g. HDFC20261012001928"
                  value={settleForm.utrNumber}
                  onChange={e => setSettleForm(prev => ({ ...prev, utrNumber: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Payment Proof Screenshot / Voucher *</label>
                <input 
                  type="file"
                  accept="image/*,.pdf"
                  className="input-file"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSettleForm(prev => ({ ...prev, file: e.target.files![0] }));
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label>Admin Remarks / Notes</label>
                <textarea 
                  className="textarea-custom"
                  rows={2}
                  placeholder="Optional notes to dealer partner..."
                  value={settleForm.adminNotes}
                  onChange={e => setSettleForm(prev => ({ ...prev, adminNotes: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setSettleTarget(null)}>Cancel</button>
              <button 
                className="btn-confirm" 
                onClick={handleSubmitSettlement}
                disabled={isUploadingProof}
              >
                {isUploadingProof ? 'Uploading Proof...' : 'Record Payout & Notify Dealer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL 2: DEALER CONFIRM RECEIVED MODAL                             */}
      {/* ================================================================== */}
      {confirmTarget && (
        <div className="modal-backdrop-overlay">
          <div className="milestone-modal-card">
            <div className="modal-header">
              <h3>Confirm Milestone Receipt</h3>
              <button className="btn-close" onClick={() => setConfirmTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Acknowledge receipt of <strong>{confirmTarget.milestoneType}</strong> milestone payout for project <strong>{confirmTarget.lead.customer}</strong>.
              </p>

              <div className="form-group">
                <label>Dealer Notes / Acknowledgement</label>
                <textarea 
                  className="textarea-custom"
                  rows={3}
                  placeholder="e.g. Received in bank account. Verified."
                  value={dealerNotes}
                  onChange={e => setDealerNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button 
                className="btn-confirm" 
                onClick={handleConfirmReceived}
                disabled={isConfirming}
              >
                {isConfirming ? 'Confirming...' : 'Confirm Received'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
