import React, { useState, useMemo, useEffect } from 'react';
import { 
  PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, 
  Calendar, CheckCircle2, AlertCircle, Plus, Search, 
  Filter, User, ChevronRight, X, PhoneMissed, PhoneForwarded,
  AlertTriangle, Check, Phone
} from 'lucide-react';
import { useCRM, type MockLead, getIndiaDateString } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import type { CallOutcome } from '../../types/sales';

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
  const currentUserId = currentUser?.id || currentUser?.uid || 'emp_user';

  const [isLogModalOpen, setIsLogModalOpen] = useState(!!selectedLeadForCall);
  const [searchLeadQuery, setSearchLeadQuery] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterTelecaller, setFilterTelecaller] = useState<string>('all');

  // Submission feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Active Scoped Leads (Telecaller sees assigned leads strictly by authenticated UID)
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      ((l.assignedEmployeeId && currentUserId && l.assignedEmployeeId === currentUserId) || 
       (l.leadOwnerId && currentUserId && l.leadOwnerId === currentUserId))
    );
  }, [leads, isManager, currentUserId]);

  // Scoped Call Logs (Telecaller sees call logs strictly by authenticated UID)
  const scopedCallLogs = useMemo(() => {
    let list = callLogs;
    if (!isManager) {
      list = list.filter(c => c.telecallerId === currentUserId);
    } else if (filterTelecaller !== 'all') {
      list = list.filter(c => c.telecallerName === filterTelecaller);
    }

    if (filterOutcome !== 'all') {
      list = list.filter(c => c.outcome === filterOutcome);
    }
    return list;
  }, [callLogs, isManager, currentUserId, currentUserName, filterTelecaller, filterOutcome]);

  // Today's Stats (calculated using Asia/Kolkata date boundary)
  const todayStr = getIndiaDateString();
  const todayCalls = useMemo(() => {
    return scopedCallLogs.filter(c => c.timestamp?.startsWith(todayStr) || c.callDate === todayStr);
  }, [scopedCallLogs, todayStr]);

  const dailyTarget = 35;
  const callsCompleted = todayCalls.length;
  const callsConnected = todayCalls.filter(c => 
    c.outcome.startsWith('Connected') || 
    c.outcome === 'Connected' || 
    c.outcome === 'Interested'
  ).length;
  const callsBusyOrNoAnswer = todayCalls.filter(c => 
    c.outcome === 'Busy' || 
    c.outcome === 'No Answer' || 
    c.outcome === 'Switch Off' || 
    c.outcome === 'Switched Off'
  ).length;
  const connectRate = callsCompleted > 0 ? Math.round((callsConnected / callsCompleted) * 100) : 0;

  // Form State for Manual Call Logging
  const [callForm, setCallForm] = useState({
    leadId: selectedLeadForCall?.id || '',
    customerName: selectedLeadForCall?.customer || '',
    phone: selectedLeadForCall?.phone || '',
    callDirection: 'Outgoing' as 'Outgoing' | 'Incoming',
    durationSeconds: 120,
    outcome: 'Connected - Interested' as CallOutcome,
    customerRequirement: selectedLeadForCall?.customerRequirement || '',
    updatedLeadStatus: (selectedLeadForCall?.salesStage || 'Contacted') as string,
    notes: '',
    nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    nextFollowUpTime: '11:00 AM'
  });

  // Sync if selectedLeadForCall prop changes
  useEffect(() => {
    if (selectedLeadForCall) {
      setCallForm(prev => ({
        ...prev,
        leadId: selectedLeadForCall.id,
        customerName: selectedLeadForCall.customer,
        phone: selectedLeadForCall.phone,
        customerRequirement: selectedLeadForCall.customerRequirement || '',
        updatedLeadStatus: selectedLeadForCall.salesStage || 'Contacted'
      }));
      setIsLogModalOpen(true);
      setSubmitSuccess(null);
      setSubmitError(null);
    }
  }, [selectedLeadForCall]);

  // Is follow-up required based on outcome
  const isFollowUpRequired = useMemo(() => {
    return (
      callForm.outcome === 'Interested' ||
      callForm.outcome === 'Connected - Interested' ||
      callForm.outcome === 'Call Back Requested' ||
      callForm.outcome === 'Connected - Callback'
    );
  }, [callForm.outcome]);

  // Handle Select Lead in Log Modal
  const handleSelectLead = (lead: MockLead) => {
    setCallForm({
      ...callForm,
      leadId: lead.id,
      customerName: lead.customer,
      phone: lead.phone,
      customerRequirement: lead.customerRequirement || '',
      updatedLeadStatus: lead.salesStage || 'Contacted'
    });
    setSearchLeadQuery('');
  };

  // Submit Call Log
  const handleSubmitCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callForm.leadId) {
      setSubmitError('Lead selection is mandatory. Standalone call logs without an assigned lead are not permitted.');
      return;
    }

    if (!callForm.customerName || !callForm.phone) {
      setSubmitError('Please provide customer name and phone number.');
      return;
    }

    // Lead ownership check
    const targetLead = leads.find(l => l.id === callForm.leadId);
    if (!targetLead) {
      setSubmitError('Selected lead could not be found in active records.');
      return;
    }

    if (!isManager && targetLead.assignedEmployeeId !== currentUserId && targetLead.leadOwnerId !== currentUserId) {
      setSubmitError('Unauthorized: The selected lead is not assigned to your authenticated account.');
      return;
    }

    if (isFollowUpRequired && !callForm.nextFollowUpDate) {
      setSubmitError('Please select a callback date for this interested lead.');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const stableOpId = 'CALL_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await addCallLog({
        id: stableOpId,
        operationId: stableOpId,
        leadId: callForm.leadId,
        customerName: callForm.customerName,
        phone: callForm.phone,
        callDirection: callForm.callDirection,
        durationSeconds: Number(callForm.durationSeconds) || 0,
        outcome: callForm.outcome,
        customerRequirement: callForm.customerRequirement,
        updatedLeadStatus: callForm.updatedLeadStatus,
        notes: callForm.notes,
        nextFollowUpDate: isFollowUpRequired || callForm.nextFollowUpDate ? callForm.nextFollowUpDate : undefined,
        nextFollowUpTime: isFollowUpRequired || callForm.nextFollowUpTime ? callForm.nextFollowUpTime : undefined,
        telecallerId: currentUserId,
        telecallerName: currentUserName
      } as any);

      setSubmitSuccess(`Call record for ${callForm.customerName} successfully saved to Firestore!`);

      // Reset form after 1.5 seconds and close modal
      setTimeout(() => {
        setIsLogModalOpen(false);
        if (onCloseCallModal) onCloseCallModal();
        setCallForm({
          leadId: '',
          customerName: '',
          phone: '',
          callDirection: 'Outgoing',
          durationSeconds: 120,
          outcome: 'Connected - Interested',
          customerRequirement: '',
          updatedLeadStatus: 'Contacted',
          notes: '',
          nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          nextFollowUpTime: '11:00 AM'
        });
        setSubmitSuccess(null);
      }, 1200);

    } catch (err: any) {
      console.error('Call log submission error:', err);
      const errMsg = err?.message || 'Failed to persist call log to Firestore. Please check your network and security rules.';
      setSubmitError(errMsg);
      alert(`Error saving call log: ${errMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="telecalling-centre-content">
      {/* Top Banner & Calling Targets */}
      <div className="sales-calling-target-banner">
        <div className="sales-target-info">
          <h3>
            <PhoneCall size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
            {isManager ? 'Sales Team Calling Desk' : 'My Daily Telecalling Desk'}
          </h3>
          <p>
            {callsCompleted} calls made today ({callsConnected} connected, {callsBusyOrNoAnswer} busy/no answer). 
            Daily target: {dailyTarget} calls. Connect rate: <strong>{connectRate}%</strong>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="sales-btn-primary" 
            style={{ background: '#38bdf8', color: '#0b1f3a' }}
            onClick={() => {
              setSubmitSuccess(null);
              setSubmitError(null);
              setIsLogModalOpen(true);
            }}
          >
            <Plus size={16} /> Log Call Outcome
          </button>
        </div>
      </div>

      {/* Global Success / Error Alerts */}
      {submitSuccess && !isLogModalOpen && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> {submitSuccess}
        </div>
      )}

      {/* Scoped Call History Section */}
      <div className="sales-panel">
        <div className="sales-panel-header">
          <div>
            <h2 className="sales-panel-title">
              <Clock size={20} color="#0284c7" />
              {isManager ? 'Real-Time Team Call Log Stream' : 'My Call History & Outcomes'}
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Every call record is synced directly with Firestore `/call_leads` and customer history.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select 
              className="sales-form-control"
              style={{ width: 'auto', fontSize: '0.8rem' }}
              value={filterOutcome}
              onChange={e => setFilterOutcome(e.target.value)}
            >
              <option value="all">All Outcomes</option>
              <option value="Connected">Connected</option>
              <option value="Connected - Interested">Connected - Interested</option>
              <option value="Connected - Callback">Connected - Callback</option>
              <option value="Connected - Not Interested">Connected - Not Interested</option>
              <option value="Busy">Busy</option>
              <option value="No Answer">No Answer</option>
              <option value="Switched Off">Switched Off</option>
              <option value="Invalid Number">Invalid Number</option>
            </select>

            {isManager && (
              <select 
                className="sales-form-control"
                style={{ width: 'auto', fontSize: '0.8rem' }}
                value={filterTelecaller}
                onChange={e => setFilterTelecaller(e.target.value)}
              >
                <option value="all">All Telecallers</option>
                {Array.from(new Set(callLogs.map(c => c.telecallerName))).filter(Boolean).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {scopedCallLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <PhoneMissed size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0b1f3a' }}>No call records found</h4>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Click "Log Call Outcome" above to record customer conversations.</p>
          </div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Customer & Mobile</th>
                  <th>Direction</th>
                  <th>Call Outcome</th>
                  <th>Duration</th>
                  <th>Customer Requirement / Notes</th>
                  <th>Scheduled Callback</th>
                  {isManager && <th>Logged By</th>}
                </tr>
              </thead>
              <tbody>
                {scopedCallLogs.slice(0, 50).map(log => {
                  const isConnected = log.outcome.startsWith('Connected') || log.outcome === 'Connected' || log.outcome === 'Interested';
                  const isBusy = log.outcome === 'Busy' || log.outcome === 'No Answer';
                  const timeFormatted = log.timestamp 
                    ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : (log.callTime || '11:00 AM');
                  const dateFormatted = log.timestamp 
                    ? new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    : (log.callDate || 'Today');

                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                        <div>{dateFormatted}</div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{timeFormatted}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{log.customerName}</div>
                        <div style={{ fontSize: '0.75rem' }}>
                          <a href={`tel:${log.phone}`} style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Phone size={11} /> {log.phone}
                          </a>
                        </div>
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
                        {log.customerRequirement && (
                          <div style={{ fontWeight: 600, color: '#0284c7', marginBottom: '2px' }}>
                            Req: {log.customerRequirement}
                          </div>
                        )}
                        <div>{log.notes}</div>
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
        <div className="sales-modal-overlay" onClick={() => !isSubmitting && setIsLogModalOpen(false)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3><PhoneCall size={18} style={{ display: 'inline', marginRight: '6px' }} /> Record Call Outcome & Notes</h3>
              <button 
                className="sales-modal-close-btn" 
                disabled={isSubmitting}
                onClick={() => {
                  setIsLogModalOpen(false);
                  if (onCloseCallModal) onCloseCallModal();
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitCallLog}>
              <div className="sales-modal-body">
                {/* Status Banners */}
                {submitSuccess && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <CheckCircle2 size={16} /> {submitSuccess}
                  </div>
                )}
                {submitError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <AlertTriangle size={16} /> {submitError}
                  </div>
                )}

                {/* Customer Selection if not preselected */}
                {!callForm.leadId ? (
                  <div className="sales-form-group">
                    <label>Select Customer from Assigned Leads *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={callForm.leadId}
                      onChange={e => {
                        const target = scopedLeads.find(l => l.id === e.target.value);
                        if (target) handleSelectLead(target);
                      }}
                    >
                      <option value="">-- Choose an assigned lead --</option>
                      {scopedLeads.map(l => (
                        <option key={l.id} value={l.id}>{l.customer} ({l.phone}) - {l.location}</option>
                      ))}
                    </select>
                    <div style={{ color: '#d97706', fontSize: '0.78rem', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertTriangle size={12} /> Lead selection is mandatory. Standalone call logs without an assigned lead are disabled.
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{callForm.customerName}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Phone: {callForm.phone}</div>
                    </div>
                    <a 
                      href={`tel:${callForm.phone}`} 
                      className="sales-btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#0284c7' }}
                    >
                      <Phone size={12} /> Call Customer
                    </a>
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
                      placeholder="e.g. 120"
                      value={callForm.durationSeconds}
                      onChange={e => setCallForm({ ...callForm, durationSeconds: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Call Outcome *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={callForm.outcome}
                      onChange={e => setCallForm({ ...callForm, outcome: e.target.value as CallOutcome })}
                    >
                      <option value="Connected">Connected</option>
                      <option value="Interested">Interested</option>
                      <option value="Connected - Interested">Connected - Interested</option>
                      <option value="Call Back Requested">Call Back Requested</option>
                      <option value="Connected - Callback">Connected - Callback</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Connected - Not Interested">Connected - Not Interested</option>
                      <option value="No Answer">No Answer / Ringing</option>
                      <option value="Busy">Busy / Disconnected</option>
                      <option value="Switched Off">Switched Off / Out of Coverage</option>
                      <option value="Invalid Number">Invalid Number</option>
                      <option value="Wrong Number">Wrong Number</option>
                    </select>
                  </div>

                  <div className="sales-form-group">
                    <label>Updated Lead Funnel Status</label>
                    <select 
                      className="sales-form-control"
                      value={callForm.updatedLeadStatus}
                      onChange={e => setCallForm({ ...callForm, updatedLeadStatus: e.target.value })}
                    >
                      <option value="Contacted">Contacted</option>
                      <option value="Interested">Interested</option>
                      <option value="Callback Scheduled">Callback Scheduled</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Lost / Disqualified">Lost / Disqualified</option>
                      <option value="In Progress">In Progress</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-group">
                  <label>Customer Solar Requirement Notes</label>
                  <textarea 
                    rows={2} 
                    className="sales-form-control"
                    placeholder="e.g. 3kW On-Grid, PM Surya Ghar subsidy interest, ₹3,200 monthly bill, RCC roof..."
                    value={callForm.customerRequirement}
                    onChange={e => setCallForm({ ...callForm, customerRequirement: e.target.value })}
                  />
                </div>

                <div className="sales-form-group">
                  <label>Freeform Call Notes *</label>
                  <textarea 
                    rows={2} 
                    required
                    className="sales-form-control"
                    placeholder="Record conversation details, objections, customer mood, key discussion points..."
                    value={callForm.notes}
                    onChange={e => setCallForm({ ...callForm, notes: e.target.value })}
                  />
                </div>

                {/* Conditional Follow-up Date/Time */}
                <div style={{ background: isFollowUpRequired ? '#f0f9ff' : 'transparent', padding: isFollowUpRequired ? '0.75rem 1rem' : 0, borderRadius: '8px', border: isFollowUpRequired ? '1px solid #bae6fd' : 'none' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isFollowUpRequired ? '#0369a1' : '#64748b', marginBottom: '0.5rem' }}>
                    {isFollowUpRequired ? '⏰ Next Follow-up (Mandatory for Interested / Callback Requested)' : 'Next Follow-up (Optional)'}
                  </div>
                  <div className="sales-form-row">
                    <div className="sales-form-group">
                      <label>Follow-up Date {isFollowUpRequired && '*'}</label>
                      <input 
                        type="date" 
                        required={isFollowUpRequired}
                        className="sales-form-control"
                        value={callForm.nextFollowUpDate}
                        onChange={e => setCallForm({ ...callForm, nextFollowUpDate: e.target.value })}
                      />
                    </div>
                    <div className="sales-form-group">
                      <label>Follow-up Time {isFollowUpRequired && '*'}</label>
                      <input 
                        type="time" 
                        required={isFollowUpRequired}
                        className="sales-form-control"
                        value={callForm.nextFollowUpTime}
                        onChange={e => setCallForm({ ...callForm, nextFollowUpTime: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="sales-modal-footer">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  className="sales-btn-secondary" 
                  onClick={() => {
                    setIsLogModalOpen(false);
                    if (onCloseCallModal) onCloseCallModal();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !callForm.leadId}
                  className="sales-btn-primary"
                  title={!callForm.leadId ? 'Select an assigned lead before submitting' : undefined}
                >
                  {isSubmitting ? 'Saving to Firestore...' : (!callForm.leadId ? 'Select Lead to Save Call' : 'Save Call Log & Update Lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
