import React, { useState, useMemo } from 'react';
import { 
  GitFork, ArrowRight, PhoneCall, MessageSquare, 
  Flame, CheckCircle2, ChevronRight, User, RefreshCw, X
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import type { SalesStage } from '../../types/sales';

interface SalesPipelineViewProps {
  onNavigateSubView: (view: any, params?: any) => void;
  onOpenCallLogModal?: (lead?: MockLead) => void;
  onOpenWhatsApp?: (lead: MockLead) => void;
}

const PIPELINE_STAGES: { key: SalesStage; label: string; color: string }[] = [
  { key: 'New Lead', label: '1. New Enquiries', color: '#0284c7' },
  { key: 'Contact Attempted', label: '2. 1st Call Attempted', color: '#38bdf8' },
  { key: 'Contacted', label: '3. Contacted', color: '#6366f1' },
  { key: 'Qualified', label: '4. Qualified (4-Pillar)', color: '#8b5cf6' },
  { key: 'Site Survey Scheduled', label: '5. Survey Scheduled', color: '#06b6d4' },
  { key: 'Site Survey Completed', label: '6. Survey Completed', color: '#10b981' },
  { key: 'Quotation Sent', label: '7. Proposal Sent', color: '#f59e0b' },
  { key: 'Negotiation', label: '8. Negotiation / Discount', color: '#d97706' },
  { key: 'Advance Submitted', label: '9. Advance Submitted', color: '#f97316' },
  { key: 'Booking Confirmed', label: '10. Booking Confirmed', color: '#16a34a' },
  { key: 'Project Handoff', label: '11. Dealer Handoff', color: '#0b1f3a' },
  { key: 'Lost', label: '12. Lost / Dropped', color: '#94a3b8' }
];

export default function SalesPipelineView({
  onNavigateSubView,
  onOpenCallLogModal,
  onOpenWhatsApp
}: SalesPipelineViewProps) {
  const { currentUser, leads, updateLeadSalesStage } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  const [activeStageFilter, setActiveStageFilter] = useState<string>('all');
  const [selectedLeadForAdvance, setSelectedLeadForAdvance] = useState<MockLead | null>(null);

  // Scoped leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

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

  // Handle stage change
  const handleAdvanceStage = async (leadId: string, nextStage: SalesStage) => {
    await updateLeadSalesStage(leadId, nextStage);
    setSelectedLeadForAdvance(null);
  };

  return (
    <div className="sales-pipeline-content">
      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              12-Stage Inbound Sales Pipeline Funnel
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Enquiry-to-Booking solar conversion pipeline from first 15m contact to formal project dealer handoff.
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
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0b1f3a' }}>{stage.label}</span>
                <span style={{ background: 'white', padding: '1px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, color: stage.color }}>
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

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                            {lead.qualificationData?.preferredCapacityKw || 3} kW Solar
                          </span>
                          <button 
                            className="sales-btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                            onClick={() => setSelectedLeadForAdvance(lead)}
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

      {/* Advance Stage Modal */}
      {selectedLeadForAdvance && (
        <div className="sales-modal-overlay" onClick={() => setSelectedLeadForAdvance(null)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3>Advance Sales Stage: {selectedLeadForAdvance.customer}</h3>
              <button className="sales-modal-close-btn" onClick={() => setSelectedLeadForAdvance(null)}><X size={20} /></button>
            </div>
            <div className="sales-modal-body">
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                Current Stage: <strong>{selectedLeadForAdvance.salesStage || 'New Lead'}</strong>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                {PIPELINE_STAGES.map(s => (
                  <button
                    key={s.key}
                    className="sales-btn-secondary"
                    style={{
                      justifyContent: 'flex-start',
                      padding: '0.6rem 0.75rem',
                      borderColor: selectedLeadForAdvance.salesStage === s.key ? s.color : '#e2e8f0',
                      background: selectedLeadForAdvance.salesStage === s.key ? '#f8fafc' : 'white',
                      fontWeight: selectedLeadForAdvance.salesStage === s.key ? 700 : 500
                    }}
                    onClick={() => handleAdvanceStage(selectedLeadForAdvance.id, s.key)}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, marginRight: '6px' }}></span>
                    {s.label}
                  </button>
                ))}
              </div>
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

