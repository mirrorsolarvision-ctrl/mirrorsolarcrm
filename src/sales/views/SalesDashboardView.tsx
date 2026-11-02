import { useMemo } from 'react';
import { 
  Users, PhoneCall, Flame, CheckCircle2, 
  FileText, TrendingUp, AlertTriangle, Clock, 
  MessageSquare, ChevronRight, Award, ShieldAlert,
  ArrowUpRight, AlertCircle, PhoneIncoming, Target
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';

interface SalesDashboardViewProps {
  onNavigateSubView: (view: any, filterParam?: any) => void;
  onOpenCallLogModal?: (lead?: MockLead) => void;
  onOpenWhatsApp?: (lead: MockLead) => void;
}

export default function SalesDashboardView({
  onNavigateSubView,
  onOpenCallLogModal,
  onOpenWhatsApp
}: SalesDashboardViewProps) {
  const { currentUser, leads, callLogs } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  // Scope leads: Telecaller sees only their own assigned leads, Sales Manager sees all team leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  // Scope call logs: Telecaller sees only their own calls, Sales Manager sees team calls
  const todayDateStr = new Date().toISOString().split('T')[0];
  const scopedCallLogs = useMemo(() => {
    if (isManager) return callLogs;
    return callLogs.filter(c => c.telecallerId === currentUserId || c.telecallerName === currentUserName);
  }, [callLogs, isManager, currentUserId, currentUserName]);

  const todayCalls = useMemo(() => {
    return scopedCallLogs.filter(c => c.timestamp?.startsWith(todayDateStr));
  }, [scopedCallLogs, todayDateStr]);

  // Calling Targets (35 calls per day target)
  const dailyCallTarget = 35;
  const callsCompletedCount = todayCalls.length;
  const callsPendingCount = Math.max(0, dailyCallTarget - callsCompletedCount);
  const callingProgressPct = Math.min(100, Math.round((callsCompletedCount / dailyCallTarget) * 100));

  // KPIs
  const todayNewLeads = useMemo(() => {
    return scopedLeads.filter(l => l.createdAt?.startsWith(todayDateStr) || l.salesStage === 'New Lead');
  }, [scopedLeads, todayDateStr]);

  const hotLeads = useMemo(() => {
    return scopedLeads.filter(l => l.leadScore?.category === 'Hot' || l.priority === 'High');
  }, [scopedLeads]);

  const qualifiedLeads = useMemo(() => {
    return scopedLeads.filter(l => l.salesStage === 'Qualified' || (l.leadScore && l.leadScore.total >= 50));
  }, [scopedLeads]);

  const todayFollowUps = useMemo(() => {
    return scopedLeads.filter(l => l.followUp?.date === todayDateStr && l.followUp?.status !== 'Completed');
  }, [scopedLeads, todayDateStr]);

  const overdueFollowUps = useMemo(() => {
    return scopedLeads.filter(l => {
      if (!l.followUp?.date || l.followUp.status === 'Completed') return false;
      return l.followUp.date < todayDateStr || l.followUp.status === 'Overdue';
    });
  }, [scopedLeads, todayDateStr]);

  const quotationsSent = useMemo(() => {
    return scopedLeads.filter(l => l.salesStage === 'Quotation Sent' || l.salesStage === 'Negotiation');
  }, [scopedLeads]);

  const bookingsConfirmed = useMemo(() => {
    return scopedLeads.filter(l => l.salesStage === 'Booking Confirmed' || l.salesStage === 'Project Handoff' || l.stage === 'Converted');
  }, [scopedLeads]);

  const conversionRate = useMemo(() => {
    if (scopedLeads.length === 0) return 0;
    return Math.round((bookingsConfirmed.length / scopedLeads.length) * 100);
  }, [bookingsConfirmed, scopedLeads]);

  // Management Exception Monitors (for Sales Manager)
  const slaBreachedLeads = useMemo(() => {
    return leads.filter(l => !l.archived && l.slaStatus === 'SLA Breached');
  }, [leads]);

  const uncontactedLeads = useMemo(() => {
    return leads.filter(l => !l.archived && !l.firstCallAttemptAt && (l.salesStage === 'New Lead' || !l.salesStage));
  }, [leads]);

  const pendingDealerHandoff = useMemo(() => {
    return leads.filter(l => !l.archived && l.salesStage === 'Booking Confirmed' && !l.handoffAcceptedAt);
  }, [leads]);

  const pendingPaymentVerification = useMemo(() => {
    return leads.filter(l => !l.archived && l.payments?.customerPayments?.some(p => p.status === 'Pending Verification'));
  }, [leads]);

  const lostLeads = useMemo(() => {
    return scopedLeads.filter(l => l.salesStage === 'Lost');
  }, [scopedLeads]);

  return (
    <div className="sales-dashboard-content">
      {/* Daily Calling Target Bar */}
      <div className="sales-calling-target-banner">
        <div className="sales-target-info">
          <h3>
            <Target size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
            {isManager ? 'Sales Team Daily Calling Target' : 'My Daily Calling Target'}
          </h3>
          <p>
            {callsCompletedCount} calls completed today out of {dailyCallTarget} target ({callsPendingCount} calls pending)
          </p>
          <div className="sales-progress-track">
            <div className="sales-progress-fill" style={{ width: `${callingProgressPct}%` }}></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{callingProgressPct}%</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#93c5fd' }}>Target Completion</span>
          </div>
          <button 
            className="sales-btn-primary" 
            style={{ background: '#38bdf8', color: '#0b1f3a' }}
            onClick={() => onOpenCallLogModal ? onOpenCallLogModal() : onNavigateSubView('telecalling')}
          >
            <PhoneCall size={16} /> Log Call
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('leads', { filter: 'new' })} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Today's New Enquiries</span>
            <div className="sales-kpi-icon-wrapper blue"><Users size={18} /></div>
          </div>
          <div className="sales-kpi-value">{todayNewLeads.length}</div>
          <div className="sales-kpi-subtext"><Clock size={12} /> Requires 15m first-call</div>
        </div>

        <div className="sales-kpi-card" onClick={() => onNavigateSubView('leads')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">{isManager ? 'Total Team Leads' : 'My Assigned Leads'}</span>
            <div className="sales-kpi-icon-wrapper navy"><PhoneIncoming size={18} /></div>
          </div>
          <div className="sales-kpi-value">{scopedLeads.length}</div>
          <div className="sales-kpi-subtext">Active in sales funnel</div>
        </div>

        <div className="sales-kpi-card" onClick={() => onNavigateSubView('leads', { filter: 'hot' })} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">High-Intent Hot Leads</span>
            <div className="sales-kpi-icon-wrapper red"><Flame size={18} /></div>
          </div>
          <div className="sales-kpi-value">{hotLeads.length}</div>
          <div className="sales-kpi-subtext" style={{ color: '#dc2626' }}>Score ≥ 75 / High Priority</div>
        </div>

        <div className="sales-kpi-card" onClick={() => onNavigateSubView('qualification')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Qualified Leads</span>
            <div className="sales-kpi-icon-wrapper purple"><CheckCircle2 size={18} /></div>
          </div>
          <div className="sales-kpi-value">{qualifiedLeads.length}</div>
          <div className="sales-kpi-subtext">4-Pillar suitability verified</div>
        </div>

        <div className="sales-kpi-card" onClick={() => onNavigateSubView('followups', { filter: 'today' })} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Follow-ups Due Today</span>
            <div className="sales-kpi-icon-wrapper amber"><Clock size={18} /></div>
          </div>
          <div className="sales-kpi-value">{todayFollowUps.length}</div>
          <div className="sales-kpi-subtext" style={{ color: overdueFollowUps.length > 0 ? '#dc2626' : undefined }}>
            {overdueFollowUps.length > 0 ? `⚠️ ${overdueFollowUps.length} Overdue callbacks!` : 'All scheduled for today'}
          </div>
        </div>

        <div className="sales-kpi-card" onClick={() => onNavigateSubView('quotations')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Quotations Sent</span>
            <div className="sales-kpi-icon-wrapper blue"><FileText size={18} /></div>
          </div>
          <div className="sales-kpi-value">{quotationsSent.length}</div>
          <div className="sales-kpi-subtext">Awaiting customer booking</div>
        </div>

        <div className="sales-kpi-card" onClick={() => onNavigateSubView('bookings')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Bookings Confirmed</span>
            <div className="sales-kpi-icon-wrapper green"><Award size={18} /></div>
          </div>
          <div className="sales-kpi-value">{bookingsConfirmed.length}</div>
          <div className="sales-kpi-subtext" style={{ color: '#16a34a' }}>Advance payment submitted</div>
        </div>

        <div className="sales-kpi-card" onClick={() => onNavigateSubView('reports')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Lead Conversion Rate</span>
            <div className="sales-kpi-icon-wrapper green"><TrendingUp size={18} /></div>
          </div>
          <div className="sales-kpi-value">{conversionRate}%</div>
          <div className="sales-kpi-subtext">Enquiry-to-Booking ratio</div>
        </div>
      </div>

      {/* SALES MANAGER MANAGEMENT MONITORS (Executive Exception Desk) */}
      {isManager && (
        <div className="sales-panel" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="sales-panel-header">
            <h2 className="sales-panel-title">
              <ShieldAlert size={20} color="#0284c7" />
              Sales Management Exception Monitors (Team Control)
            </h2>
            <span className="sales-badge cold">Sales Manager Authority</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* 15-Minute SLA Monitor */}
            <div 
              style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              onClick={() => onNavigateSubView('leads', { filter: 'sla_breach' })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>15-Minute SLA Monitor</span>
                <span className="sales-badge hot">{slaBreachedLeads.length} Breached</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
                Paid inbound leads delayed past the 15-minute business hours first-call SLA.
              </p>
            </div>

            {/* Missed / Uncontacted Lead Monitor */}
            <div 
              style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              onClick={() => onNavigateSubView('leads', { filter: 'uncontacted' })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d97706' }}>Missed Lead Monitor</span>
                <span className="sales-badge warm">{uncontactedLeads.length} Uncontacted</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
                New customer enquiries that have received 0 phone call attempts.
              </p>
            </div>

            {/* Follow-up Leakage Monitor */}
            <div 
              style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              onClick={() => onNavigateSubView('followups', { filter: 'overdue' })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#b91c1c' }}>Follow-up Leakage Monitor</span>
                <span className="sales-badge hot">{overdueFollowUps.length} Overdue</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
                Scheduled callbacks that telecallers failed to complete on time.
              </p>
            </div>

            {/* Dealer Handoff Monitor */}
            <div 
              style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              onClick={() => onNavigateSubView('dealers')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0369a1' }}>Dealer Handoff Monitor</span>
                <span className="sales-badge cold">{pendingDealerHandoff.length} Pending</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
                Confirmed customer bookings waiting for dealer assignment or survey acceptance.
              </p>
            </div>

            {/* Accounts Verification Monitor */}
            <div 
              style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              onClick={() => onNavigateSubView('bookings')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#7c3aed' }}>Advance Payment Verification</span>
                <span className="sales-badge warm">{pendingPaymentVerification.length} Pending</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
                Customer advance receipts awaiting verification by Admin / Accounts.
              </p>
            </div>

            {/* Lost Lead Analysis */}
            <div 
              style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              onClick={() => onNavigateSubView('reports')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Lost Lead Analysis</span>
                <span className="sales-badge cold">{lostLeads.length} Dropped</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>
                Detailed drop-off reason analysis (Price, Roof Unfeasible, Competitor, Delay).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hot Leads Priority Desk */}
      <div className="sales-panel">
        <div className="sales-panel-header">
          <h2 className="sales-panel-title">
            <Flame size={20} color="#dc2626" />
            High-Intent Hot Leads Desk (Immediate Action)
          </h2>
          <button className="sales-btn-secondary" onClick={() => onNavigateSubView('leads', { filter: 'hot' })}>
            View All Hot Leads <ArrowUpRight size={14} />
          </button>
        </div>

        {hotLeads.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
            No high-priority hot leads currently pending action. Good job!
          </p>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Location</th>
                  <th>Preferred kW</th>
                  <th>Lead Score</th>
                  <th>Funnel Stage</th>
                  <th>Follow-up</th>
                  <th>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {hotLeads.slice(0, 5).map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{lead.customer}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.phone}</div>
                    </td>
                    <td>{lead.location || 'Andhra Pradesh'}</td>
                    <td>
                      <span className="sales-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                        {lead.qualificationData?.preferredCapacityKw || 3} kW
                      </span>
                    </td>
                    <td>
                      <span className="sales-badge hot">
                        🔥 Score: {lead.leadScore?.total || 80}/100
                      </span>
                    </td>
                    <td>
                      <span className="sales-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                        {lead.salesStage || 'New Lead'}
                      </span>
                    </td>
                    <td>
                      {lead.followUp?.date ? (
                        <span style={{ fontSize: '0.8rem', color: lead.followUp.date <= todayDateStr ? '#dc2626' : '#1e293b' }}>
                          {lead.followUp.date} {lead.followUp.time || ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Not set</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button 
                          className="sales-btn-primary" 
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          title="Call Customer"
                          onClick={() => onOpenCallLogModal ? onOpenCallLogModal(lead) : onNavigateSubView('telecalling')}
                        >
                          <PhoneCall size={13} />
                        </button>
                        <button 
                          className="sales-btn-secondary" 
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#16a34a', borderColor: '#bbf7d0' }}
                          title="Send WhatsApp"
                          onClick={() => onOpenWhatsApp ? onOpenWhatsApp(lead) : onNavigateSubView('whatsapp')}
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button 
                          className="sales-btn-secondary" 
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          title="Qualify Customer"
                          onClick={() => onNavigateSubView('qualification', { leadId: lead.id })}
                        >
                          Qualify
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

