import { useMemo } from 'react';
import { 
  Users, PhoneCall, Flame, CheckCircle2, 
  TrendingUp, AlertTriangle, Clock, 
  PhoneIncoming, Target, ShieldAlert, Award,
  ArrowUpRight, Phone, Check, RefreshCw
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
  onOpenWhatsApp: _onOpenWhatsApp
}: SalesDashboardViewProps) {
  const { currentUser, leads, callLogs, employees } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || currentUser?.uid || '';

  // Scope leads: Telecaller sees only their own assigned leads, Sales Manager sees all team leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      ((l.assignedEmployee && currentUserName && l.assignedEmployee.trim().toLowerCase() === currentUserName.trim().toLowerCase()) || 
       (l.assignedEmployeeId && currentUserId && l.assignedEmployeeId === currentUserId) || 
       (l.leadOwnerId && currentUserId && l.leadOwnerId === currentUserId))
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  // Scope call logs: Telecaller sees only their own calls, Sales Manager sees team calls
  const todayDateStr = new Date().toISOString().split('T')[0];
  const scopedCallLogs = useMemo(() => {
    if (isManager) return callLogs;
    return callLogs.filter(c => c.telecallerId === currentUserId || c.telecallerName === currentUserName);
  }, [callLogs, isManager, currentUserId, currentUserName]);

  const todayCalls = useMemo(() => {
    return scopedCallLogs.filter(c => c.timestamp?.startsWith(todayDateStr) || c.callDate === todayDateStr);
  }, [scopedCallLogs, todayDateStr]);

  // Connected calls today
  const todayConnectedCalls = useMemo(() => {
    return todayCalls.filter(c => 
      c.outcome.startsWith('Connected') || 
      c.outcome === 'Connected' || 
      c.outcome === 'Interested'
    );
  }, [todayCalls]);

  // Calling Targets (35 calls per day target)
  const dailyCallTarget = 35;
  const callsCompletedCount = todayCalls.length;
  const callsPendingCount = Math.max(0, dailyCallTarget - callsCompletedCount);
  const callingProgressPct = Math.min(100, Math.round((callsCompletedCount / dailyCallTarget) * 100));

  // 1. Total assigned leads
  const totalAssignedLeadsCount = scopedLeads.length;

  // 2. Calls made today
  const callsMadeTodayCount = todayCalls.length;

  // 3. Connected calls
  const connectedCallsCount = todayConnectedCalls.length;

  // 4. Interested leads
  const interestedLeads = useMemo(() => {
    return scopedLeads.filter(l => 
      (l.salesStage as any) === 'Interested' || 
      l.salesStage === 'Contacted' ||
      l.callLogs?.some(c => c.outcome.includes('Interested'))
    );
  }, [scopedLeads]);

  // 5. Follow-ups due today
  const todayFollowUps = useMemo(() => {
    return scopedLeads.filter(l => l.followUp?.date === todayDateStr && l.followUp?.status !== 'Completed');
  }, [scopedLeads, todayDateStr]);

  // 6. Overdue follow-ups
  const overdueFollowUps = useMemo(() => {
    return scopedLeads.filter(l => {
      if (!l.followUp?.date || l.followUp.status === 'Completed') return false;
      return l.followUp.date < todayDateStr || l.followUp.status === 'Overdue';
    });
  }, [scopedLeads, todayDateStr]);

  // 7. Qualified leads
  const qualifiedLeads = useMemo(() => {
    return scopedLeads.filter(l => 
      l.salesStage === 'Qualified' || 
      l.qualificationData?.qualificationResult === 'Qualified' ||
      (l.leadScore && l.leadScore.total >= 60)
    );
  }, [scopedLeads]);

  // 8. Lead conversion summary
  const bookingsConfirmed = useMemo(() => {
    return scopedLeads.filter(l => 
      l.salesStage === 'Booking Confirmed' || 
      l.salesStage === 'Project Handoff' || 
      l.stage === 'Converted'
    );
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

  // Telecaller Performance Stats Matrix (for Manager)
  const telecallerPerformanceMatrix = useMemo(() => {
    const telecallers = employees.filter(e => 
      e.status === 'Active' && 
      (e.employeeCategory?.toLowerCase().includes('telecaller') || 
       e.employeeCategory?.toLowerCase().includes('sales') || 
       e.responsibilities?.primaryResponsibilityId?.includes('sales') ||
       e.responsibilities?.primaryResponsibilityId?.includes('telecaller'))
    );

    return telecallers.map(emp => {
      const empLeads = leads.filter(l => 
        !l.archived && 
        ((l.assignedEmployee && l.assignedEmployee.trim().toLowerCase() === emp.name.trim().toLowerCase()) || 
         l.assignedEmployeeId === emp.id)
      );

      const empCallsToday = callLogs.filter(c => 
        (c.telecallerId === emp.id || c.telecallerName === emp.name) && 
        (c.timestamp?.startsWith(todayDateStr) || c.callDate === todayDateStr)
      );

      const empConnectedToday = empCallsToday.filter(c => 
        c.outcome.startsWith('Connected') || 
        c.outcome === 'Connected' || 
        c.outcome === 'Interested'
      );

      const empFollowupsToday = empLeads.filter(l => l.followUp?.date === todayDateStr && l.followUp?.status !== 'Completed');
      const empOverdueFollowups = empLeads.filter(l => {
        if (!l.followUp?.date || l.followUp.status === 'Completed') return false;
        return l.followUp.date < todayDateStr || l.followUp.status === 'Overdue';
      });

      const empQualified = empLeads.filter(l => 
        l.salesStage === 'Qualified' || 
        l.qualificationData?.qualificationResult === 'Qualified'
      );

      return {
        id: emp.id,
        name: emp.name,
        assignedCount: empLeads.length,
        callsTodayCount: empCallsToday.length,
        connectedCount: empConnectedToday.length,
        followupsTodayCount: empFollowupsToday.length,
        overdueCount: empOverdueFollowups.length,
        qualifiedCount: empQualified.length
      };
    });
  }, [employees, leads, callLogs, todayDateStr]);

  // High-priority Hot Leads
  const hotLeads = useMemo(() => {
    return scopedLeads.filter(l => l.leadScore?.category === 'Hot' || l.priority === 'High');
  }, [scopedLeads]);

  return (
    <div className="sales-dashboard-content">
      {/* Explicit Live Status & Reporting Period Banner */}
      <div style={{ 
        background: '#0b1f3a', 
        color: '#f8fafc', 
        borderRadius: '10px', 
        padding: '0.85rem 1.25rem', 
        marginBottom: '1.25rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '0.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.2px' }}>
            Reporting Period: Today, November 4, 2026 (Live Firestore Synchronized)
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#93c5fd' }}>
          Real-time sync active • User: <strong>{currentUserName}</strong> ({isManager ? 'Sales Manager' : 'Telecaller'})
        </div>
      </div>

      {/* Daily Calling Target Bar */}
      <div className="sales-calling-target-banner">
        <div className="sales-target-info">
          <h3>
            <Target size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
            {isManager ? 'Sales Team Daily Calling Target' : 'My Daily Calling Target'}
          </h3>
          <p>
            {callsCompletedCount} calls completed today out of {dailyCallTarget} target ({callsPendingCount} calls pending). Connect rate: {callsCompletedCount > 0 ? Math.round((connectedCallsCount / callsCompletedCount) * 100) : 0}%.
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

      {/* PRIMARY 8 KPI TILES (Explicit Master Requirements) */}
      <div className="sales-kpi-grid">
        {/* KPI 1: Total Assigned Leads */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('leads')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">{isManager ? '1. Total Team Leads' : '1. Total Assigned Leads'}</span>
            <div className="sales-kpi-icon-wrapper navy"><Users size={18} /></div>
          </div>
          <div className="sales-kpi-value">{totalAssignedLeadsCount}</div>
          <div className="sales-kpi-subtext">Active enquiries in pipeline</div>
        </div>

        {/* KPI 2: Calls Made Today */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('telecalling')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">2. Calls Made Today</span>
            <div className="sales-kpi-icon-wrapper blue"><PhoneCall size={18} /></div>
          </div>
          <div className="sales-kpi-value">{callsMadeTodayCount}</div>
          <div className="sales-kpi-subtext">Logged on Nov 4, 2026</div>
        </div>

        {/* KPI 3: Connected Calls */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('telecalling')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">3. Connected Calls</span>
            <div className="sales-kpi-icon-wrapper green"><CheckCircle2 size={18} /></div>
          </div>
          <div className="sales-kpi-value">{connectedCallsCount}</div>
          <div className="sales-kpi-subtext">
            {callsCompletedCount > 0 ? `${Math.round((connectedCallsCount / callsCompletedCount) * 100)}% connect rate` : 'Awaiting calls'}
          </div>
        </div>

        {/* KPI 4: Interested Leads */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('leads', { filter: 'hot' })} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">4. Interested Leads</span>
            <div className="sales-kpi-icon-wrapper red"><Flame size={18} /></div>
          </div>
          <div className="sales-kpi-value">{interestedLeads.length}</div>
          <div className="sales-kpi-subtext" style={{ color: '#dc2626' }}>Ready for qualification</div>
        </div>

        {/* KPI 5: Follow-ups Due Today */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('followups', { filter: 'today' })} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">5. Follow-ups Due Today</span>
            <div className="sales-kpi-icon-wrapper amber"><Clock size={18} /></div>
          </div>
          <div className="sales-kpi-value">{todayFollowUps.length}</div>
          <div className="sales-kpi-subtext">Scheduled callbacks for today</div>
        </div>

        {/* KPI 6: Overdue Follow-ups */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('followups', { filter: 'overdue' })} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">6. Overdue Follow-ups</span>
            <div className="sales-kpi-icon-wrapper red"><AlertTriangle size={18} /></div>
          </div>
          <div className="sales-kpi-value" style={{ color: overdueFollowUps.length > 0 ? '#dc2626' : undefined }}>
            {overdueFollowUps.length}
          </div>
          <div className="sales-kpi-subtext" style={{ color: overdueFollowUps.length > 0 ? '#dc2626' : undefined }}>
            {overdueFollowUps.length > 0 ? '⚠️ High risk of leakage!' : '0 backlog, on track'}
          </div>
        </div>

        {/* KPI 7: Qualified Leads */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('qualification')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">7. Qualified Leads</span>
            <div className="sales-kpi-icon-wrapper purple"><CheckCircle2 size={18} /></div>
          </div>
          <div className="sales-kpi-value">{qualifiedLeads.length}</div>
          <div className="sales-kpi-subtext">Feasibility & score verified</div>
        </div>

        {/* KPI 8: Lead Conversion Summary */}
        <div className="sales-kpi-card" onClick={() => onNavigateSubView('reports')} style={{ cursor: 'pointer' }}>
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">8. Lead Conversion</span>
            <div className="sales-kpi-icon-wrapper green"><TrendingUp size={18} /></div>
          </div>
          <div className="sales-kpi-value">{conversionRate}%</div>
          <div className="sales-kpi-subtext">
            {bookingsConfirmed.length} booked / {scopedLeads.length} total
          </div>
        </div>
      </div>

      {/* SALES MANAGER AUTHORITY DESK: Telecaller Performance Matrix */}
      {isManager && (
        <div className="sales-panel" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="sales-panel-header">
            <h2 className="sales-panel-title">
              <ShieldAlert size={20} color="#0284c7" />
              Telecaller Performance Matrix (Live Management Control)
            </h2>
            <span className="sales-badge cold">Manager Oversight</span>
          </div>

          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Telecaller Name</th>
                  <th>Assigned Leads</th>
                  <th>Calls Made Today</th>
                  <th>Connected Calls</th>
                  <th>Follow-ups Today</th>
                  <th>Overdue Follow-ups</th>
                  <th>Qualified Leads</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {telecallerPerformanceMatrix.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{t.name}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{t.assignedCount}</span> leads
                    </td>
                    <td>
                      <span className="sales-badge blue">{t.callsTodayCount}</span>
                    </td>
                    <td>
                      <span className="sales-badge green">{t.connectedCount}</span>
                    </td>
                    <td>
                      <span>{t.followupsTodayCount} due</span>
                    </td>
                    <td>
                      {t.overdueCount > 0 ? (
                        <span className="sales-badge hot">⚠️ {t.overdueCount} Overdue</span>
                      ) : (
                        <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>Clean (0)</span>
                      )}
                    </td>
                    <td>
                      <span className="sales-badge purple">{t.qualifiedCount}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>● Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hot Leads Desk */}
      <div className="sales-panel">
        <div className="sales-panel-header">
          <h2 className="sales-panel-title">
            <Flame size={20} color="#dc2626" />
            High-Intent Hot Leads (Immediate Calling Priority)
          </h2>
          <button className="sales-btn-secondary" onClick={() => onNavigateSubView('leads', { filter: 'hot' })}>
            View All Hot Leads <ArrowUpRight size={14} />
          </button>
        </div>

        {hotLeads.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
            No high-priority hot leads currently pending action. All enquiries are attended to!
          </p>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Customer Name & Mobile</th>
                  <th>Location</th>
                  <th>Solar Capacity</th>
                  <th>Lead Score</th>
                  <th>Funnel Stage</th>
                  <th>Next Follow-up</th>
                  <th>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {hotLeads.slice(0, 5).map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{lead.customer}</div>
                      <div style={{ fontSize: '0.75rem' }}>
                        <a href={`tel:${lead.phone}`} style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Phone size={11} /> {lead.phone}
                        </a>
                      </div>
                    </td>
                    <td>{lead.location || 'Andhra Pradesh'}</td>
                    <td>
                      <span className="sales-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                        {lead.qualificationData?.preferredCapacityKw || lead.capacityKw || 3} kW
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
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Not scheduled</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button 
                          className="sales-btn-primary" 
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
                          title="Call Lead"
                          onClick={() => onOpenCallLogModal ? onOpenCallLogModal(lead) : onNavigateSubView('telecalling')}
                        >
                          <PhoneCall size={12} /> Call
                        </button>
                        <button 
                          className="sales-btn-secondary" 
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
                          title="Qualify Lead"
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
