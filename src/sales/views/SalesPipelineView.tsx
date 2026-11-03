import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, MessageSquare, 
  ChevronRight, X, AlertTriangle, CheckCircle2, ShieldCheck, FileText, Calendar, UserCheck
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { useAudit } from '../../context/AuditLogContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import type { SalesStage } from '../../types/sales';

interface SalesPipelineViewProps {
  onNavigateSubView: (view: any, params?: any) => void;
  onOpenCallLogModal?: (lead?: MockLead) => void;
  onOpenWhatsApp?: (lead: MockLead) => void;
}

export const PIPELINE_STAGES: { key: SalesStage; label: string; color: string; description: string }[] = [
  { key: 'New Lead', label: '1. New Enquiries', color: '#0284c7', description: 'Fresh lead inbox awaiting first call' },
  { key: 'Contact Attempted', label: '2. 1st Call Attempted', color: '#38bdf8', description: 'Dialed within 15-min SLA' },
  { key: 'Contacted', label: '3. Contacted', color: '#6366f1', description: 'Customer spoke with telecaller' },
  { key: 'Qualified', label: '4. Qualified (4-Pillar)', color: '#8b5cf6', description: 'Load, roof, bill & budget recorded' },
  { key: 'Site Survey Scheduled', label: '5. Survey Scheduled', color: '#06b6d4', description: 'Dealer visit appointment booked' },
  { key: 'Site Survey Completed', label: '6. Survey Completed', color: '#10b981', description: 'Technical feasibility confirmed' },
  { key: 'Quotation Sent', label: '7. Proposal Sent', color: '#f59e0b', description: 'Official pricing & subsidy proposal' },
  { key: 'Negotiation', label: '8. Negotiation', color: '#d97706', description: 'Discount approval & terms discussion' },
  { key: 'Advance Submitted', label: '9. Advance Submitted', color: '#f97316', description: 'Token advance receipt uploaded' },
  { key: 'Booking Confirmed', label: '10. Booking Confirmed', color: '#16a34a', description: 'Payment verified by Accounts/Admin' },
  { key: 'Project Handoff', label: '11. Project Handoff (Closed Won)', color: '#0b1f3a', description: 'Dealer accepted for installation' },
  { key: 'Lost', label: '12. Closed Lost (Dropped)', color: '#94a3b8', description: 'Unqualified or competitor lost' }
];

const LOSS_REASONS = [
  'Competitor quoted lower pricing',
  'Rooftop shading / Structural unsuitability',
  'Customer postponed to next financial year',
  'DISCOM transformer capacity / sanctioned load limit',
  'Financing / Loan rejection',
  'Tenant / Not property owner',
  'Customer unresponsive after repeated follow-ups',
  'Other / Unspecified reason'
];

export default function SalesPipelineView({
  onNavigateSubView,
  onOpenCallLogModal,
  onOpenWhatsApp
}: SalesPipelineViewProps) {
  const { currentUser, leads, updateLeadSalesStage, updateLead } = useCRM();
  const { logAction } = useAudit();
  const isManager = isSalesManager(currentUser);
  const isAdmin = currentUser?.role === 'Admin';
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  const [selectedLeadForAdvance, setSelectedLeadForAdvance] = useState<MockLead | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState<string>(LOSS_REASONS[0]);
  const [targetStageSelected, setTargetStageSelected] = useState<SalesStage | null>(null);

  // Scoped leads
  const scopedLeads = useMemo(() => {
    if (isManager || isAdmin) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, isAdmin, currentUserName, currentUserId]);

  // Group leads by stage
  const stageGroups = useMemo(() => {
    const groups: Record<SalesStage, MockLead[]> = {
      'New Lead': [],
      'Contact Attempted': [],
      'Contacted': [],
      'Qualified': [],
      'Site Survey Scheduled': [],
      'Site Survey Completed': [],
      'Quotation Sent': [],
      'Negotiation': [],
      'Advance Submitted': [],
      'Booking Confirmed': [],
      'Project Handoff': [],
      'Lost': []
    };

    scopedLeads.forEach(lead => {
      const stage = (lead.salesStage || 'New Lead') as SalesStage;
      if (groups[stage]) {
        groups[stage].push(lead);
      } else {
        groups['New Lead'].push(lead);
      }
    });

    return groups;
  }, [scopedLeads]);

  // Validate Stage Transition Gates
  const validateTransition = (lead: MockLead, targetStage: SalesStage): { ok: boolean; reason?: string } => {
    // 1. Moving to Site Survey Scheduled: Requires dealer assignment or appointment schedule
    if (targetStage === 'Site Survey Scheduled') {
      if (!lead.dealer && !lead.dealerId) {
        return {
          ok: false,
          reason: 'Dealer allocation is required before scheduling a Site Survey. Please assign a regional dealer.'
        };
      }
    }

    // 2. Moving to Quotation Sent: Requires system capacity preference
    if (targetStage === 'Quotation Sent') {
      const capacity = lead.qualificationData?.preferredCapacityKw || (lead as any).capacityPreferenceKw || (lead as any).preferredCapacityKw;
      if (!capacity) {
        return {
          ok: false,
          reason: 'Preferred system capacity (kW) must be recorded before sending a quotation.'
        };
      }
    }

    // 3. Moving to Booking Confirmed: Strict financial gate
    if (targetStage === 'Booking Confirmed') {
      const customerPayments = lead.payments?.customerPayments || [];
      const hasVerifiedPayment = customerPayments.some(p => p.status === 'Verified');
      if (!hasVerifiedPayment) {
        return {
          ok: false,
          reason: 'Financial Security Gate: Advance payment evidence must be verified by Accounts or Super Admin before confirming booking.'
        };
      }
    }

    // 4. Moving to Project Handoff: Requires confirmed booking and dealer
    if (targetStage === 'Project Handoff') {
      const isBookingConfirmed = lead.salesStage === 'Booking Confirmed' || lead.stage === 'Converted';
      if (!isBookingConfirmed) {
        return {
          ok: false,
          reason: 'Lead must reach "Booking Confirmed" with verified payment before handoff to Operations.'
        };
      }
      if (!lead.dealerId && !lead.dealer) {
        return {
          ok: false,
          reason: 'A regional dealer must be assigned to receive the project handoff.'
        };
      }
    }

    return { ok: true };
  };

  // Handle stage change request
  const handleStageClick = (targetStage: SalesStage) => {
    if (!selectedLeadForAdvance) return;
    setTargetStageSelected(targetStage);
    setTransitionError(null);

    const validation = validateTransition(selectedLeadForAdvance, targetStage);
    if (!validation.ok) {
      setTransitionError(validation.reason || 'Stage transition gate requirement not met.');
      return;
    }

    if (targetStage !== 'Lost') {
      commitStageTransition(selectedLeadForAdvance.id, targetStage);
    }
  };

  const commitStageTransition = async (leadId: string, nextStage: SalesStage, explicitLossReason?: string) => {
    const lead = scopedLeads.find(l => l.id === leadId);
    const prevStage = lead?.salesStage || 'New Lead';

    const updates: any = {
      salesStage: nextStage
    };

    if (nextStage === 'Lost' && explicitLossReason) {
      updates.lossReason = explicitLossReason;
      updates.notes = `${lead?.notes ? lead.notes + '\n' : ''}[Closed Lost Reason: ${explicitLossReason}]`;
    } else if (nextStage === 'Booking Confirmed') {
      updates.stage = 'Converted';
    } else if (nextStage === 'Project Handoff') {
      updates.stage = 'Installation';
    }

    await updateLead(leadId, updates);
    await updateLeadSalesStage(leadId, nextStage);

    // Audit log immutable record
    logAction({
      action: 'LEAD_STAGE_CHANGED',
      entityType: 'Lead',
      entityId: leadId,
      entityLabel: lead?.customer || leadId,
      previousValue: prevStage,
      newValue: nextStage,
      diffSummary: `Pipeline transition from ${prevStage} to ${nextStage}`,
      reason: explicitLossReason || 'Pipeline stage progression'
    }).catch(() => {});

    setSelectedLeadForAdvance(null);
    setTargetStageSelected(null);
    setTransitionError(null);
  };

  return (
    <div className="sales-pipeline-content">
      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              12-Stage Gated Inbound Sales Pipeline Funnel
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Enquiry-to-Booking solar conversion pipeline with stage validation gates and separated Closed Won / Closed Lost outcomes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 600 }}>Total in Funnel:</span>
            <span className="sales-badge cold" style={{ fontSize: '0.85rem' }}>{scopedLeads.length} leads</span>
          </div>
        </div>
      </div>

      {/* Horizontal Kanban Board */}
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1.5rem' }}>
        {PIPELINE_STAGES.map(stage => {
          const leadsInStage = stageGroups[stage.key] || [];

          return (
            <div 
              key={stage.key} 
              style={{
                minWidth: '280px',
                width: '280px',
                background: '#f1f5f9',
                borderRadius: '12px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 220px)'
              }}
            >
              {/* Column Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid', borderColor: stage.color }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0b1f3a', display: 'block' }}>{stage.label}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{stage.description}</span>
                </div>
                <span style={{ background: 'white', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, color: stage.color, alignSelf: 'flex-start' }}>
                  {leadsInStage.length}
                </span>
              </div>

              {/* Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
                {leadsInStage.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.775rem' }}>
                    No leads at this stage
                  </div>
                ) : (
                  leadsInStage.map(lead => {
                    const isHot = lead.leadScore?.category === 'Hot' || lead.priority === 'High';

                    return (
                      <div 
                        key={lead.id}
                        style={{
                          background: 'white',
                          borderRadius: '8px',
                          padding: '0.85rem',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          border: isHot ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0b1f3a' }}>
                            {lead.customer}
                          </span>
                          {isHot && (
                            <span className="sales-badge hot" style={{ padding: '1px 5px', fontSize: '0.65rem' }}>
                              🔥 Hot
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          📱 {lead.phone} • 📍 {lead.location?.split(',')[0]}
                        </div>

                        {lead.dealer && (
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px' }}>
                            Dealer: {lead.dealer}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                            {lead.qualificationData?.preferredCapacityKw || 3} kW Solar
                          </span>
                          <button 
                            className="sales-btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                            onClick={() => {
                              setSelectedLeadForAdvance(lead);
                              setTransitionError(null);
                              setTargetStageSelected(null);
                            }}
                          >
                            Advance <ChevronRight size={12} />
                          </button>
                        </div>

                        {/* Quick action icons */}
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
                          <button 
                            className="sales-btn-secondary" 
                            style={{ flex: 1, padding: '0.25rem', justifyContent: 'center' }}
                            title="Call Customer"
                            onClick={() => onOpenCallLogModal ? onOpenCallLogModal(lead) : onNavigateSubView('telecalling')}
                          >
                            <PhoneCall size={12} />
                          </button>
                          <button 
                            className="sales-btn-secondary" 
                            style={{ flex: 1, padding: '0.25rem', justifyContent: 'center', color: '#16a34a', borderColor: '#bbf7d0' }}
                            title="Send WhatsApp"
                            onClick={() => onOpenWhatsApp ? onOpenWhatsApp(lead) : onNavigateSubView('whatsapp')}
                          >
                            <MessageSquare size={12} />
                          </button>
                          <button 
                            className="sales-btn-secondary" 
                            style={{ flex: 1, padding: '0.25rem', justifyContent: 'center' }}
                            title="Qualify Customer"
                            onClick={() => onNavigateSubView('qualification', { leadId: lead.id })}
                          >
                            Qualify
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Advance Stage Modal with Validation Gates */}
      {selectedLeadForAdvance && (
        <div className="sales-modal-overlay" onClick={() => setSelectedLeadForAdvance(null)}>
          <div className="sales-modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3>Advance Stage Gate: {selectedLeadForAdvance.customer}</h3>
              <button className="sales-modal-close-btn" onClick={() => setSelectedLeadForAdvance(null)}><X size={20} /></button>
            </div>
            <div className="sales-modal-body">
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                Current Stage: <strong style={{ color: '#0b1f3a' }}>{selectedLeadForAdvance.salesStage || 'New Lead'}</strong>
              </p>

              {transitionError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                  marginBottom: '1rem'
                }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Prerequisite Condition Not Satisfied:</strong>
                    <p style={{ margin: '3px 0 0 0' }}>{transitionError}</p>
                  </div>
                </div>
              )}

              {/* Target Stage Options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                {PIPELINE_STAGES.map(s => {
                  const isCurrent = (selectedLeadForAdvance.salesStage || 'New Lead') === s.key;
                  const isSelected = targetStageSelected === s.key;

                  return (
                    <button
                      key={s.key}
                      className="sales-btn-secondary"
                      style={{
                        justifyContent: 'flex-start',
                        padding: '0.6rem 0.75rem',
                        borderColor: isSelected ? s.color : (isCurrent ? '#cbd5e1' : '#e2e8f0'),
                        background: isSelected ? '#f0f9ff' : (isCurrent ? '#f8fafc' : 'white'),
                        fontWeight: isSelected || isCurrent ? 700 : 500,
                        textAlign: 'left'
                      }}
                      onClick={() => handleStageClick(s.key)}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, marginRight: '6px', flexShrink: 0 }}></span>
                      <span style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Special Loss Reason Selector when moving to Lost */}
              {targetStageSelected === 'Lost' && (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Mandatory Reason for Dropping / Closing Lost:
                  </label>
                  <select 
                    className="sales-form-input"
                    value={lossReason}
                    onChange={e => setLossReason(e.target.value)}
                    style={{ marginBottom: '0.75rem' }}
                  >
                    {LOSS_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button 
                    className="sales-btn-primary"
                    style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                    onClick={() => commitStageTransition(selectedLeadForAdvance.id, 'Lost', lossReason)}
                  >
                    Confirm Drop Lead
                  </button>
                </div>
              )}
            </div>
            <div className="sales-modal-footer">
              <button className="sales-btn-secondary" onClick={() => setSelectedLeadForAdvance(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
