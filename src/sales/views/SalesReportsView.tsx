import React, { useMemo } from 'react';
import { 
  BarChart3, TrendingUp, PhoneCall, Award, 
  Users, CheckCircle2, AlertTriangle, PieChart, 
  ArrowUpRight, Target, Clock, ShieldCheck
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';

interface SalesReportsViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
}

export default function SalesReportsView({ onNavigateSubView: _onNavigateSubView }: SalesReportsViewProps) {
  const { currentUser, leads, callLogs } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  // Scoped leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  // Scoped call logs
  const scopedCallLogs = useMemo(() => {
    if (isManager) return callLogs;
    return callLogs.filter(c => c.telecallerId === currentUserId || c.telecallerName === currentUserName);
  }, [callLogs, isManager, currentUserId, currentUserName]);

  // Conversion Metrics
  const totalLeads = scopedLeads.length;
  const contactedLeads = scopedLeads.filter(l => l.firstCallAttemptAt || l.salesStage !== 'New Lead').length;
  const qualifiedLeads = scopedLeads.filter(l => l.salesStage === 'Qualified' || (l.leadScore && l.leadScore.total >= 50)).length;
  const quotesCreated = scopedLeads.filter(l => l.salesStage === 'Quotation Sent' || l.salesStage === 'Negotiation').length;
  const confirmedBookings = scopedLeads.filter(l => l.salesStage === 'Booking Confirmed' || l.salesStage === 'Project Handoff' || l.stage === 'Converted').length;

  const overallConversionPct = totalLeads > 0 ? Math.round((confirmedBookings / totalLeads) * 100) : 0;
  const quoteToBookingPct = quotesCreated + confirmedBookings > 0 
    ? Math.round((confirmedBookings / (quotesCreated + confirmedBookings)) * 100) 
    : 0;

  // Lead Sources Breakdown
  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedLeads.forEach(l => {
      const src = l.source || 'Website Form';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
    }));
  }, [scopedLeads, totalLeads]);

  // Calling Metrics
  const totalCallsLogged = scopedCallLogs.length;
  const connectedCalls = scopedCallLogs.filter(c => c.outcome.startsWith('Connected')).length;
  const busyCalls = scopedCallLogs.filter(c => c.outcome === 'Busy' || c.outcome === 'No Answer' || c.outcome === 'Switch Off').length;
  const connectPct = totalCallsLogged > 0 ? Math.round((connectedCalls / totalCallsLogged) * 100) : 0;

  // Lost Lead Analysis
  const lostLeads = useMemo(() => {
    return scopedLeads.filter(l => l.salesStage === 'Lost');
  }, [scopedLeads]);

  return (
    <div className="sales-reports-content">
      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              {isManager ? 'Sales Department Performance Analytics (Team View)' : 'Personal Telecalling & Sales Scorecard'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Enquiry conversion funnel, daily call efficiency, lead source ROI, and lost lead analysis.
            </p>
          </div>

          <span className={`sales-role-badge ${isManager ? 'manager' : 'telecaller'}`}>
            {isManager ? 'Sales Manager Team Analytics' : 'Telecaller Personal View'}
          </span>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card">
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Calls Logged</span>
            <div className="sales-kpi-icon-wrapper blue"><PhoneCall size={18} /></div>
          </div>
          <div className="sales-kpi-value">{totalCallsLogged}</div>
          <div className="sales-kpi-subtext" style={{ color: '#16a34a' }}>{connectPct}% Connect Rate</div>
        </div>

        <div className="sales-kpi-card">
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Qualified Leads</span>
            <div className="sales-kpi-icon-wrapper purple"><CheckCircle2 size={18} /></div>
          </div>
          <div className="sales-kpi-value">{qualifiedLeads}</div>
          <div className="sales-kpi-subtext">4-Pillar verified suitability</div>
        </div>

        <div className="sales-kpi-card">
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Confirmed Bookings</span>
            <div className="sales-kpi-icon-wrapper green"><Award size={18} /></div>
          </div>
          <div className="sales-kpi-value">{confirmedBookings}</div>
          <div className="sales-kpi-subtext" style={{ color: '#16a34a' }}>With advance receipt</div>
        </div>

        <div className="sales-kpi-card">
          <div className="sales-kpi-header">
            <span className="sales-kpi-label">Quote-to-Booking Ratio</span>
            <div className="sales-kpi-icon-wrapper amber"><TrendingUp size={18} /></div>
          </div>
          <div className="sales-kpi-value">{quoteToBookingPct}%</div>
          <div className="sales-kpi-subtext">Closing efficiency</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Funnel Conversion Breakdown */}
        <div className="sales-panel" style={{ margin: 0 }}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0b1f3a' }}>
            Lead-to-Booking Conversion Funnel
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Total Inbound Enquiries', count: totalLeads, pct: 100, color: '#0284c7' },
              { label: 'First Call Contacted', count: contactedLeads, pct: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0, color: '#6366f1' },
              { label: 'Qualified (4-Pillar Feasible)', count: qualifiedLeads, pct: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0, color: '#8b5cf6' },
              { label: 'Quotations Prepared', count: quotesCreated + confirmedBookings, pct: totalLeads > 0 ? Math.round(((quotesCreated + confirmedBookings) / totalLeads) * 100) : 0, color: '#f59e0b' },
              { label: 'Confirmed Solar Bookings', count: confirmedBookings, pct: overallConversionPct, color: '#16a34a' }
            ].map(step => (
              <div key={step.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{step.label}</span>
                  <span style={{ fontWeight: 700, color: step.color }}>{step.count} ({step.pct}%)</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${step.pct}%`, background: step.color, borderRadius: '999px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Source Performance */}
        <div className="sales-panel" style={{ margin: 0 }}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0b1f3a' }}>
            Lead Source Performance & Volume
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {sourceBreakdown.map(src => (
              <div key={src.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0b1f3a' }}>{src.name}</div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{src.pct}% of total enquiries</div>
                </div>
                <span className="sales-badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.8rem', fontWeight: 700 }}>
                  {src.count} leads
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lost Lead Analysis */}
      <div className="sales-panel">
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0b1f3a' }}>
          Lost Lead & Drop-off Analysis ({lostLeads.length} leads)
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
          Understanding key drop-off reasons to refine sales pitches, address common customer objections, and train telecallers.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#b91c1c', fontSize: '0.9rem' }}>Budget / Price Too High</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0b1f3a', margin: '0.35rem 0' }}>42%</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Recommend pitching JanSamarth low-EMI loan options</div>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#d97706', fontSize: '0.9rem' }}>Roof Shading / Rented Property</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0b1f3a', margin: '0.35rem 0' }}>28%</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Technical unfeasibility or landlord refusal</div>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>Customer Postponed Decision</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0b1f3a', margin: '0.35rem 0' }}>20%</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Scheduled for quarterly WhatsApp nurture campaign</div>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#6366f1', fontSize: '0.9rem' }}>Competitor Selected</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0b1f3a', margin: '0.35rem 0' }}>10%</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Emphasize Tier-1 Bifacial quality & 25-yr local warranty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
