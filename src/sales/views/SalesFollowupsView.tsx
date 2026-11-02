import React, { useState, useMemo } from 'react';
import { 
  Clock, Calendar, CheckCircle2, AlertTriangle, 
  PhoneCall, MessageSquare, Plus, CheckSquare, 
  X, AlertCircle, ChevronRight
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';

interface SalesFollowupsViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
  onOpenCallLogModal?: (lead?: MockLead) => void;
  onOpenWhatsApp?: (lead: MockLead) => void;
  initialFilter?: string;
}

export default function SalesFollowupsView({
  onNavigateSubView: _onNavigateSubView,
  onOpenCallLogModal,
  onOpenWhatsApp,
  initialFilter = 'today'
}: SalesFollowupsViewProps) {
  const { currentUser, leads, updateLead, addActivity } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  const [activeTab, setActiveTab] = useState<string>(initialFilter);
  const [rescheduleLead, setRescheduleLead] = useState<MockLead | null>(null);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('11:00 AM');
  const [newNotes, setNewNotes] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Scoped leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived && l.followUp);
    return leads.filter(l => 
      !l.archived && 
      l.followUp &&
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  // Buckets
  const todayFollowups = useMemo(() => {
    return scopedLeads.filter(l => l.followUp?.date === todayStr && l.followUp.status !== 'Completed');
  }, [scopedLeads, todayStr]);

  const overdueFollowups = useMemo(() => {
    return scopedLeads.filter(l => {
      if (!l.followUp?.date || l.followUp.status === 'Completed') return false;
      return l.followUp.date < todayStr || l.followUp.status === 'Overdue';
    });
  }, [scopedLeads, todayStr]);

  const upcomingFollowups = useMemo(() => {
    return scopedLeads.filter(l => {
      if (!l.followUp?.date || l.followUp.status === 'Completed') return false;
      return l.followUp.date > todayStr;
    });
  }, [scopedLeads, todayStr]);

  const completedFollowups = useMemo(() => {
    return scopedLeads.filter(l => l.followUp?.status === 'Completed');
  }, [scopedLeads]);

  // Current display list
  const currentList = useMemo(() => {
    if (activeTab === 'overdue') return overdueFollowups;
    if (activeTab === 'upcoming') return upcomingFollowups;
    if (activeTab === 'completed') return completedFollowups;
    return todayFollowups;
  }, [activeTab, todayFollowups, overdueFollowups, upcomingFollowups, completedFollowups]);

  // Mark follow-up as completed
  const handleMarkCompleted = async (lead: MockLead) => {
    await updateLead(lead.id, {
      followUp: {
        ...lead.followUp,
        type: lead.followUp?.type || 'Call',
        status: 'Completed',
        date: lead.followUp?.date || todayStr,
        time: lead.followUp?.time || 'Completed',
        notes: `${lead.followUp?.notes || ''} (Completed on ${todayStr})`
      }
    });
    addActivity({
      type: 'Follow-up Completed',
      message: `Follow-up with customer ${lead.customer} marked completed`,
      user: currentUserName,
      leadId: lead.id
    });
  };

  // Reschedule callback
  const handleReschedule = async () => {
    if (!rescheduleLead) return;

    await updateLead(rescheduleLead.id, {
      followUp: {
        date: newDate,
        time: newTime,
        type: 'Call',
        status: newDate === todayStr ? 'Due Today' : newDate < todayStr ? 'Overdue' : 'Upcoming',
        notes: newNotes || rescheduleLead.followUp?.notes || 'Customer callback rescheduled'
      }
    });

    addActivity({
      type: 'Follow-up Rescheduled',
      message: `Callback for ${rescheduleLead.customer} rescheduled to ${newDate} at ${newTime}`,
      user: currentUserName,
      leadId: rescheduleLead.id
    });

    setRescheduleLead(null);
    setNewNotes('');
  };

  return (
    <div className="sales-followups-content">
      {/* Follow-up Leakage Alert Banner */}
      {overdueFollowups.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={24} color="#dc2626" />
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.95rem' }}>
                Follow-up Leakage Warning: {overdueFollowups.length} Overdue Callbacks!
              </div>
              <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                These customers were promised callbacks on earlier dates. Prompt contact prevents customer loss to competitors.
              </div>
            </div>
          </div>
          <button 
            className="sales-btn-primary" 
            style={{ background: '#dc2626' }}
            onClick={() => setActiveTab('overdue')}
          >
            Review Overdue ({overdueFollowups.length})
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Follow-ups & Customer Callback Scheduler
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Maintain daily calling discipline, never miss a callback, and prevent lead leakage.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`sales-subnav-btn ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              Today's Callbacks ({todayFollowups.length})
            </button>
            <button
              className={`sales-subnav-btn ${activeTab === 'overdue' ? 'active' : ''}`}
              style={{ color: overdueFollowups.length > 0 && activeTab !== 'overdue' ? '#dc2626' : undefined }}
              onClick={() => setActiveTab('overdue')}
            >
              Overdue ({overdueFollowups.length})
            </button>
            <button
              className={`sales-subnav-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              Upcoming ({upcomingFollowups.length})
            </button>
            <button
              className={`sales-subnav-btn ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed ({completedFollowups.length})
            </button>
          </div>
        </div>
      </div>

      {/* Follow-up Cards */}
      <div className="sales-panel">
        {currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem auto', color: '#16a34a', opacity: 0.6 }} />
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0b1f3a' }}>No follow-ups in this tab</h4>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>All callbacks for this view have been attended to or none are scheduled.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {currentList.map(lead => {
              const isOverdue = lead.followUp?.date && lead.followUp.date < todayStr && lead.followUp.status !== 'Completed';

              return (
                <div 
                  key={lead.id}
                  style={{
                    background: 'white',
                    borderRadius: '10px',
                    border: isOverdue ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0b1f3a' }}>{lead.customer}</span>
                      <span className={`sales-badge ${isOverdue ? 'hot' : 'warm'}`}>
                        {isOverdue ? '⚠️ Overdue' : 'Scheduled'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                      📱 {lead.phone} • 📍 {lead.location}
                    </div>

                    <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', margin: '0.75rem 0', fontSize: '0.8rem', color: '#334155', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '2px' }}>
                        ⏰ Scheduled Callback: {lead.followUp?.date} at {lead.followUp?.time || '11:00 AM'}
                      </div>
                      <div>{lead.followUp?.notes || 'Follow-up regarding solar quotation and subsidy.'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                      className="sales-btn-primary" 
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}
                      onClick={() => onOpenCallLogModal ? onOpenCallLogModal(lead) : undefined}
                    >
                      <PhoneCall size={14} /> Call Now
                    </button>
                    <button 
                      className="sales-btn-secondary" 
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', color: '#16a34a', borderColor: '#bbf7d0' }}
                      onClick={() => onOpenWhatsApp ? onOpenWhatsApp(lead) : undefined}
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </button>
                    <button 
                      className="sales-btn-secondary" 
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      title="Reschedule Callback"
                      onClick={() => {
                        setRescheduleLead(lead);
                        setNewDate(lead.followUp?.date || todayStr);
                        setNewTime(lead.followUp?.time || '11:00 AM');
                        setNewNotes(lead.followUp?.notes || '');
                      }}
                    >
                      Reschedule
                    </button>
                    {lead.followUp?.status !== 'Completed' && (
                      <button 
                        className="sales-btn-secondary" 
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', color: '#16a34a' }}
                        title="Mark Completed"
                        onClick={() => handleMarkCompleted(lead)}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleLead && (
        <div className="sales-modal-overlay" onClick={() => setRescheduleLead(null)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3>Reschedule Callback: {rescheduleLead.customer}</h3>
              <button className="sales-modal-close-btn" onClick={() => setRescheduleLead(null)}><X size={20} /></button>
            </div>
            <div className="sales-modal-body">
              <div className="sales-form-row">
                <div className="sales-form-group">
                  <label>New Callback Date *</label>
                  <input 
                    type="date" 
                    className="sales-form-control" 
                    value={newDate} 
                    onChange={e => setNewDate(e.target.value)} 
                  />
                </div>
                <div className="sales-form-group">
                  <label>New Callback Time *</label>
                  <input 
                    type="time" 
                    className="sales-form-control" 
                    value={newTime} 
                    onChange={e => setNewTime(e.target.value)} 
                  />
                </div>
              </div>

              <div className="sales-form-group">
                <label>Callback Reason / Reminder Notes</label>
                <textarea 
                  rows={3} 
                  className="sales-form-control"
                  placeholder="e.g. Customer requested to call back after discussing with family..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="sales-modal-footer">
              <button className="sales-btn-secondary" onClick={() => setRescheduleLead(null)}>Cancel</button>
              <button className="sales-btn-primary" onClick={handleReschedule}>Save New Callback Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
