import React, { useState } from 'react';
import { 
  AlertTriangle, Clock, Calendar, FileText, CreditCard, 
  Handshake, Flame, ShieldAlert, X, ChevronRight, Phone, 
  MapPin, UserCheck 
} from 'lucide-react';
import { useCRM, type MockLead } from '../context/CRMContext';
import './AdminSalesLeakageMonitor.css';

interface AdminSalesLeakageMonitorProps {
  onSelectLead?: (lead: MockLead) => void;
  onNavigateTab?: (tabName: string) => void;
}

type DrilldownType = 
  | 'unassigned' 
  | 'sla_breach' 
  | 'overdue' 
  | 'quotation_leakage' 
  | 'pending_payment' 
  | 'pending_handoff' 
  | 'hot_leads' 
  | null;

export default function AdminSalesLeakageMonitor({ onSelectLead, onNavigateTab }: AdminSalesLeakageMonitorProps) {
  const { leads, salesLeakageMetrics } = useCRM();
  const [drilldown, setDrilldown] = useState<DrilldownType>(null);

  const getDrilldownLeads = (): MockLead[] => {
    if (!drilldown) return [];
    return leads.filter(l => {
      if (l.archived) return false;
      if (drilldown === 'unassigned') {
        return !l.leadOwnerId && !l.assignedEmployeeId && !l.assignedEmployee;
      }
      if (drilldown === 'sla_breach') {
        return l.slaStatus === 'SLA Breached';
      }
      if (drilldown === 'overdue') {
        return l.followUp?.status === 'Overdue';
      }
      if (drilldown === 'quotation_leakage') {
        const daysOld = (Date.now() - new Date(l.updatedAt || l.createdAt).getTime()) / (1000 * 3600 * 24);
        return l.salesStage === 'Qualified' && daysOld >= 2;
      }
      if (drilldown === 'pending_payment') {
        return l.payments?.customerPayments?.some(p => p.status === 'Pending Verification');
      }
      if (drilldown === 'pending_handoff') {
        return l.salesStage === 'Booking Confirmed' && !l.handoffAcceptedAt;
      }
      if (drilldown === 'hot_leads') {
        return l.leadScore?.category === 'Hot';
      }
      return false;
    });
  };

  const drilldownTitle = (): string => {
    switch (drilldown) {
      case 'unassigned': return '🚨 Unassigned Enquiries (Requires Ownership)';
      case 'sla_breach': return '⏱️ Inbound 15-Min SLA Breaches (Uncontacted Paid Leads)';
      case 'overdue': return '📅 Overdue Customer Follow-ups';
      case 'quotation_leakage': return '📉 Quotation Leakage (Qualified > 48h without Quote)';
      case 'pending_payment': return '💳 Customer Payments Pending Accounts Verification';
      case 'pending_handoff': return '🤝 Confirmed Bookings Awaiting Dealer Acceptance';
      case 'hot_leads': return '🔥 High-Intent Hot Leads (Score ≥ 75)';
      default: return 'Exception Details';
    }
  };

  const handleLeadClick = (lead: MockLead) => {
    setDrilldown(null);
    if (onSelectLead) {
      onSelectLead(lead);
    } else if (onNavigateTab) {
      onNavigateTab('Leads');
    }
  };

  return (
    <div className="leakage-monitor-container">
      <div className="leakage-header">
        <div className="leakage-title-row">
          <ShieldAlert size={22} color="#0b1f3a" />
          <div>
            <h3>Sales Leakage & Exception Monitor</h3>
            <p className="leakage-subtitle">Real-time governance over inbound response SLA, follow-up discipline, and operational handoffs</p>
          </div>
        </div>
        <div className="leakage-badge-total">
          Funnel Active: <strong>{salesLeakageMetrics.totalLeadsInFunnel}</strong> leads
        </div>
      </div>

      <div className="leakage-grid">
        {/* 1. Unassigned Leads */}
        <div 
          className={`leakage-card ${salesLeakageMetrics.unassignedCount > 0 ? 'critical' : 'success'}`}
          onClick={() => setDrilldown('unassigned')}
        >
          <div className="leakage-card-top">
            <span className="leakage-card-label">Unassigned Leads</span>
            <AlertTriangle size={18} />
          </div>
          <div className="leakage-card-val">{salesLeakageMetrics.unassignedCount}</div>
          <div className="leakage-card-desc">No active employee owner</div>
        </div>

        {/* 2. 15-Minute SLA Breach */}
        <div 
          className={`leakage-card ${salesLeakageMetrics.slaBreachCount > 0 ? 'critical' : 'success'}`}
          onClick={() => setDrilldown('sla_breach')}
        >
          <div className="leakage-card-top">
            <span className="leakage-card-label">15-Min SLA Breaches</span>
            <Clock size={18} />
          </div>
          <div className="leakage-card-val">{salesLeakageMetrics.slaBreachCount}</div>
          <div className="leakage-card-desc">First call attempt delayed</div>
        </div>

        {/* 3. Overdue Follow-ups */}
        <div 
          className={`leakage-card ${salesLeakageMetrics.overdueFollowupCount > 0 ? 'warning' : 'success'}`}
          onClick={() => setDrilldown('overdue')}
        >
          <div className="leakage-card-top">
            <span className="leakage-card-label">Overdue Follow-ups</span>
            <Calendar size={18} />
          </div>
          <div className="leakage-card-val">{salesLeakageMetrics.overdueFollowupCount}</div>
          <div className="leakage-card-desc">Scheduled touchpoint missed</div>
        </div>

        {/* 4. Quotation Leakage */}
        <div 
          className={`leakage-card ${salesLeakageMetrics.quotationLeakageCount > 0 ? 'warning' : 'info'}`}
          onClick={() => setDrilldown('quotation_leakage')}
        >
          <div className="leakage-card-top">
            <span className="leakage-card-label">Quotation Leakage</span>
            <FileText size={18} />
          </div>
          <div className="leakage-card-val">{salesLeakageMetrics.quotationLeakageCount}</div>
          <div className="leakage-card-desc">Qualified &gt; 48h without proposal</div>
        </div>

        {/* 5. Advance Pending Verification */}
        <div 
          className={`leakage-card ${salesLeakageMetrics.pendingPaymentVerificationCount > 0 ? 'warning' : 'info'}`}
          onClick={() => setDrilldown('pending_payment')}
        >
          <div className="leakage-card-top">
            <span className="leakage-card-label">Payment Verification</span>
            <CreditCard size={18} />
          </div>
          <div className="leakage-card-val">{salesLeakageMetrics.pendingPaymentVerificationCount}</div>
          <div className="leakage-card-desc">Awaiting Accounts check</div>
        </div>

        {/* 6. Pending Dealer Handoff */}
        <div 
          className={`leakage-card ${salesLeakageMetrics.pendingDealerHandoffCount > 0 ? 'warning' : 'info'}`}
          onClick={() => setDrilldown('pending_handoff')}
        >
          <div className="leakage-card-top">
            <span className="leakage-card-label">Dealer Acceptance</span>
            <Handshake size={18} />
          </div>
          <div className="leakage-card-val">{salesLeakageMetrics.pendingDealerHandoffCount}</div>
          <div className="leakage-card-desc">Handoff awaiting acceptance</div>
        </div>

        {/* 7. Hot Leads Count */}
        <div 
          className="leakage-card info"
          onClick={() => setDrilldown('hot_leads')}
        >
          <div className="leakage-card-top">
            <span className="leakage-card-label">Hot Leads (≥75 pts)</span>
            <Flame size={18} color="#ea580c" />
          </div>
          <div className="leakage-card-val" style={{ color: '#ea580c' }}>{salesLeakageMetrics.hotLeadsCount}</div>
          <div className="leakage-card-desc">High conversion probability</div>
        </div>
      </div>

      {/* Drilldown Modal */}
      {drilldown && (
        <div className="leakage-modal-overlay" onClick={() => setDrilldown(null)}>
          <div className="leakage-modal-content" onClick={e => e.stopPropagation()}>
            <div className="leakage-modal-header">
              <h4 style={{ margin: 0, fontWeight: 700, color: '#0b1f3a' }}>{drilldownTitle()}</h4>
              <button 
                onClick={() => setDrilldown(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} color="#64748b" />
              </button>
            </div>
            <div className="leakage-modal-body">
              {getDrilldownLeads().length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                  ✓ Zero leakage in this category! All items are compliant.
                </div>
              ) : (
                getDrilldownLeads().map(l => (
                  <div key={l.id} className="leakage-list-item">
                    <div>
                      <div className="leakage-cust-name">{l.customer}</div>
                      <div className="leakage-cust-meta">
                        <span><Phone size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />{l.phone}</span>
                        <span><MapPin size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />{l.location}</span>
                        <span><UserCheck size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />Owner: {l.leadOwnerName || l.assignedEmployee || 'None'}</span>
                      </div>
                    </div>
                    <button className="leakage-action-btn" onClick={() => handleLeadClick(l)}>
                      Open Lead <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
