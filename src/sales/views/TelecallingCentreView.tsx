import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, 
  Calendar, CheckCircle2, AlertCircle, Plus, Search, 
  Filter, User, ChevronRight, X, PhoneMissed, PhoneForwarded
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import type { CallOutcome, TelecallerCallLog } from '../../types/sales';

interface TelecallingCentreViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
  selectedLeadForCall?: MockLead | null;
  onCloseCallModal?: () => void;
}

export default function TelecallingCentreView({
  onNavigateSubView: _onNavigateSubView,
  selectedLeadForCall,
  onCloseCallModal
}: TelecallingCentreViewProps) {
  const { currentUser, leads, callLogs, addCallLog, updateLead } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || 'Telecaller';
  const currentUserId = currentUser?.id || 'emp_user';

  const [isLogModalOpen, setIsLogModalOpen] = useState(!!selectedLeadForCall);
  const [searchLeadQuery, setSearchLeadQuery] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterTelecaller, setFilterTelecaller] = useState<string>('all');

  // Active Scoped Leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  // Scoped Call Logs
  const scopedCallLogs = useMemo(() => {
    let list = callLogs;
    if (!isManager) {
      list = list.filter(c => c.telecallerId === currentUserId || c.telecallerName === currentUserName);
    } else if (filterTelecaller !== 'all') {
      list = list.filter(c => c.telecallerName === filterTelecaller);
    }

    if (filterOutcome !== 'all') {
      list = list.filter(c => c.outcome === filterOutcome);
    }
    return list;
  }, [callLogs, isManager, currentUserId, currentUserName, filterTelecaller, filterOutcome]);

  // Today's Stats
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCalls = useMemo(() => {
    return scopedCallLogs.filter(c => c.timestamp?.startsWith(todayStr));
  }, [scopedCallLogs, todayStr]);

  const dailyTarget = 35;
  const callsCompleted = todayCalls.length;
  const callsConnected = todayCalls.filter(c => c.outcome.startsWith('Connected')).length;
  const callsBusyOrNoAnswer = todayCalls.filter(c => c.outcome === 'Busy' || c.outcome === 'No Answer' || c.outcome === 'Switch Off').length;
  const connectRate = callsCompleted > 0 ? Math.round((callsConnected / callsCompleted) * 100) : 0;

  // Form State for Manual Call Logging
  const [callForm, setCallForm] = useState({
    leadId: selectedLeadForCall?.id || '',
    customerName: selectedLeadForCall?.customer || '',
    phone: selectedLeadForCall?.phone || '',
    callDirection: 'Outgoing' as 'Outgoing' | 'Incoming',
    durationSeconds: 120,
    outcome: 'Connected - Interested' as CallOutcome,
    notes: '',
    nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    nextFollowUpTime: '11:00 AM'
  });

  // Handle Select Lead in Log Modal
  const handleSelectLead = (lead: MockLead) => {
    setCallForm({
      ...callForm,
      leadId: lead.id,
      customerName: lead.customer,
      phone: lead.phone
    });
    setSearchLeadQuery('');
  };

  // Submit Call Log
  const handleSubmitCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callForm.customerName || !callForm.phone) return;

    await addCallLog({
      leadId: callForm.leadId || undefined,
      customerName: callForm.customerName,
      phone: callForm.phone,
      callDirection: callForm.callDirection,
      durationSeconds: Number(callForm.durationSeconds) || 0,
      outcome: callForm.outcome,
      notes: callForm.notes,
      nextFollowUpDate: callForm.nextFollowUpDate,
      nextFollowUpTime: callForm.nextFollowUpTime,
      telecallerId: currentUserId,
      telecallerName: currentUserName
    });

    // Advance salesStage if first call on New Lead
    if (callForm.leadId) {
      const currentLead = leads.find(l => l.id === callForm.leadId);
      if (currentLead && (!currentLead.firstCallAttemptAt || currentLead.salesStage === 'New Lead')) {
        await updateLead(callForm.leadId, {
          firstCallAttemptAt: new Date().toISOString(),
          salesStage: callForm.outcome.startsWith('Connected') ? 'Contacted' : 'Contact Attempted'
        });
      }
    }

    setIsLogModalOpen(false);
    if (onCloseCallModal) onCloseCallModal();
    setCallForm({
      leadId: '',
      customerName: '',
      phone: '',
      callDirection: 'Outgoing',
      durationSeconds: 120,
      outcome: 'Connected - Interested',
      notes: '',
      nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      nextFollowUpTime: '11:00 AM'
    });
  };

  return (
    <div className="telecalling-centre-content">
      {/* Top Banner & Calling Targets */}
      <div className="sales-calling-target-banner">
        <div>
          <h3><PhoneCall size={18} style={{ display: 'inline', marginRight: '6px' }} /> Daily Calling Targets & Performance</h3>
          <p>
            {isManager ? 'Team Daily Call Desk' : 'Personal Telecalling Target'}: {callsCompleted} / {dailyTarget} calls completed today ({dailyTarget - callsCompleted > 0 ? dailyTarget - callsCompleted : 0} pending)
          </p>
          <div className="sales-progress-track">
            <div className="sales-progress-fill" style={{ width: `${Math.min(100, Math.round((callsCompleted / dailyTarget) * 100))}%` }}></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>{connectRate}%</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#93c5fd' }}>Connect Rate</span>
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fef08a' }}>{callsConnected}</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#93c5fd' }}>Connected Calls</span>
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171' }}>{callsBusyOrNoAnswer}</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#93c5fd' }}>Busy / No Answer</span>
          </div>
          <button 
            className="sales-btn-primary" 
            style={{ background: '#38bdf8', color: '#0b1f3a' }}
            onClick={() => setIsLogModalOpen(true)}
          >
            <Plus size={16} /> Log Call Record
          </button>
        </div>
      </div>

      {/* Call History Table & Filter Panel */}
      <div className="sales-panel">
        <div className="sales-panel-header">
          <h2 className="sales-panel-title">
            <Clock size={20} color="#0284c7" />
            Telecalling Log & Interaction History
          </h2>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select 
              className="sales-form-control" 
              style={{ width: 'auto', fontSize: '0.825rem' }}
              value={filterOutcome}
              onChange={e => setFilterOutcome(e.target.value)}
            >
              <option value="all">All Outcomes</option>
              <option value="Connected - Interested">Connected - Interested</option>
              <option value="Connected - Callback">Connected - Callback</option>
              <option value="Connected - Not Interested">Connected - Not Interested</option>
              <option value="Busy">Busy</option>
              <option value="No Answer">No Answer</option>
              <option value="Switch Off">Switch Off</option>
              <option value="Wrong Number">Wrong Number</option>
            </select>

            {isManager && (
              <select 
                className="sales-form-control" 
                style={{ width: 'auto', fontSize: '0.825rem' }}
                value={filterTelecaller}
                onChange={e => setFilterTelecaller(e.target.value)}
              >
                <option value="all">All Telecallers</option>
                <option value="P. Suresh">P. Suresh</option>
                <option value="K. Bhavani">K. Bhavani</option>
              </select>
            )}
          </div>
        </div>

        {scopedCallLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <PhoneCall size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0b1f3a' }}>No call records found</h4>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Click "Log Call Record" above to record customer phone interactions.</p>
          </div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Customer Name & Phone</th>
                  <th>Direction</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                  <th>Customer Response Notes</th>
                  <th>Next Follow-up</th>
                  {isManager && <th>Logged By</th>}
                </tr>
              </thead>
              <tbody>
                {scopedCallLogs.map(log => {
                  const isConnected = log.outcome.startsWith('Connected');
                  const isBusy = log.outcome === 'Busy' || log.outcome === 'No Answer' || log.outcome === 'Switch Off';

                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.775rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{log.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.phone}</div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.775rem', color: log.callDirection === 'Incoming' ? '#0369a1' : '#15803d' }}>
                          {log.callDirection === 'Incoming' ? <PhoneIncoming size={13} /> : <PhoneOutgoing size={13} />}
                          {log.callDirection}
                        </span>
                      </td>
                      <td>
                        <span className={`sales-badge ${isConnected ? 'connected' : isBusy ? 'busy' : 'cold'}`}>
                          {log.outcome}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem' }}>
                        {log.durationSeconds ? `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s` : '0s'}
                      </td>
                      <td style={{ maxWidth: '280px', fontSize: '0.825rem', color: '#334155' }}>
                        {log.notes}
                      </td>
                      <td>
                        {log.nextFollowUpDate ? (
                          <div style={{ fontSize: '0.8rem', color: '#0b1f3a' }}>
                            {log.nextFollowUpDate}
                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>
                              {log.nextFollowUpTime || '11:00 AM'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                        )}
                      </td>
                      {isManager && (
                        <td>
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#475569' }}>
                            {log.telecallerName}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Call Logging Modal */}
      {isLogModalOpen && (
        <div className="sales-modal-overlay" onClick={() => setIsLogModalOpen(false)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3><PhoneCall size={18} style={{ display: 'inline', marginRight: '6px' }} /> Record Call Outcome & Notes</h3>
              <button className="sales-modal-close-btn" onClick={() => setIsLogModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitCallLog}>
              <div className="sales-modal-body">
                {/* Customer Selection if not preselected */}
                {!callForm.customerName ? (
                  <div className="sales-form-group">
                    <label>Select Customer from Assigned Leads *</label>
                    <select 
                      className="sales-form-control"
                      value={callForm.leadId}
                      onChange={e => {
                        const target = scopedLeads.find(l => l.id === e.target.value);
                        if (target) handleSelectLead(target);
                      }}
                    >
                      <option value="">-- Choose a lead --</option>
                      {scopedLeads.map(l => (
                        <option key={l.id} value={l.id}>{l.customer} ({l.phone}) - {l.location}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{callForm.customerName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Phone: {callForm.phone}</div>
                  </div>
                )}

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Call Direction</label>
                    <select 
                      className="sales-form-control"
                      value={callForm.callDirection}
                      onChange={e => setCallForm({ ...callForm, callDirection: e.target.value as any })}
                    >
                      <option value="Outgoing">Outgoing (Telecaller initiated)</option>
                      <option value="Incoming">Incoming (Customer called office)</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Call Duration (Seconds)</label>
                    <input 
                      type="number" 
                      className="sales-form-control" 
                      placeholder="e.g. 180"
                      value={callForm.durationSeconds}
                      onChange={e => setCallForm({ ...callForm, durationSeconds: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="sales-form-group">
                  <label>Call Outcome *</label>
                  <select 
                    required
                    className="sales-form-control"
                    value={callForm.outcome}
                    onChange={e => setCallForm({ ...callForm, outcome: e.target.value as CallOutcome })}
                  >
                    <option value="Connected - Interested">Connected - Interested & Seeking Proposal</option>
                    <option value="Connected - Callback">Connected - Requested Callback Later</option>
                    <option value="Connected - Not Interested">Connected - Not Interested (Roof/Budget)</option>
                    <option value="Busy">Busy (Call waiting/Disconnect)</option>
                    <option value="No Answer">No Answer / Ringing</option>
                    <option value="Switch Off">Switch Off / Out of Coverage</option>
                    <option value="Wrong Number">Wrong Number</option>
                  </select>
                </div>

                <div className="sales-form-group">
                  <label>Customer Response Notes *</label>
                  <textarea 
                    rows={3} 
                    required
                    className="sales-form-control"
                    placeholder="Record electricity bill, customer questions, interest level, objections..."
                    value={callForm.notes}
                    onChange={e => setCallForm({ ...callForm, notes: e.target.value })}
                  />
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Next Follow-up Date</label>
                    <input 
                      type="date" 
                      className="sales-form-control"
                      value={callForm.nextFollowUpDate}
                      onChange={e => setCallForm({ ...callForm, nextFollowUpDate: e.target.value })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Next Follow-up Time</label>
                    <input 
                      type="time" 
                      className="sales-form-control"
                      value={callForm.nextFollowUpTime}
                      onChange={e => setCallForm({ ...callForm, nextFollowUpTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="sales-modal-footer">
                <button type="button" className="sales-btn-secondary" onClick={() => setIsLogModalOpen(false)}>Cancel</button>
                <button type="submit" className="sales-btn-primary">Save Call Log & Schedule Callback</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
