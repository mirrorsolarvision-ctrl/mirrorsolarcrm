import React, { useState, useMemo, useEffect } from 'react';
import { 
  PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, 
  Calendar, CheckCircle2, AlertCircle, Plus, Search, 
  Filter, User, ChevronRight, X, PhoneMissed, PhoneForwarded,
  AlertTriangle, Check, Phone, ThumbsUp, ThumbsDown, 
  ArrowRight, ShieldCheck, MapPin, Building, Edit3, Send, UserCheck
} from 'lucide-react';
import { useCRM, type MockLead, getIndiaDateString } from '../../context/CRMContext';
import { generateSecureId } from '../../utils/idUtils';
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
  const { currentUser, leads, callLogs, addCallLog, updateLead, addActivity } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || 'Telecaller';
  const currentUserId = currentUser?.id || currentUser?.uid || 'emp_user';

  // Desk Mode: 'responses' (Customer Response Table) vs 'logs' (Call Activity Stream)
  const [deskTab, setDeskTab] = useState<'responses' | 'logs'>('responses');

  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState(!!selectedLeadForCall);
  const [responseModalLead, setResponseModalLead] = useState<MockLead | null>(null);
  const [rescheduleModalLead, setRescheduleModalLead] = useState<MockLead | null>(null);
  const [escalateModalLead, setEscalateModalLead] = useState<MockLead | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInterest, setFilterInterest] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterSiteVisit, setFilterSiteVisit] = useState<string>('all');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterTelecaller, setFilterTelecaller] = useState<string>('all');

  // Submission feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Scoped Leads: Telecaller sees strictly assigned leads, manager sees all non-archived leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      ((l.assignedEmployeeId && currentUserId && l.assignedEmployeeId === currentUserId) || 
       (l.leadOwnerId && currentUserId && l.leadOwnerId === currentUserId))
    );
  }, [leads, isManager, currentUserId]);

  // Filtered responses leads
  const filteredCustomerLeads = useMemo(() => {
    return scopedLeads.filter(lead => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (lead.customer || '').toLowerCase().includes(q);
        const phoneMatch = (lead.phone || '').includes(q);
        const locMatch = (lead.location || '').toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !locMatch) return false;
      }

      if (filterInterest !== 'all') {
        const interest = lead.customerInterest || 'Evaluating';
        if (interest !== filterInterest) return false;
      }

      if (filterStage !== 'all') {
        const stage = lead.salesStage || lead.stage || 'New Lead';
        if (stage !== filterStage) return false;
      }

      if (filterSiteVisit !== 'all') {
        if (filterSiteVisit === 'yes' && !lead.siteVisitRequired) return false;
        if (filterSiteVisit === 'no' && lead.siteVisitRequired) return false;
      }

      return true;
    });
  }, [scopedLeads, searchQuery, filterInterest, filterStage, filterSiteVisit]);

  // Scoped Call Logs
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

  // Today's Stats
  const todayStr = getIndiaDateString();
  const todayCalls = useMemo(() => {
    return scopedCallLogs.filter(c => c.timestamp?.startsWith(todayStr) || c.callDate === todayStr);
  }, [scopedCallLogs, todayStr]);

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

  // Responses Overview Metrics
  const totalEnquiries = scopedLeads.length;
  const interestedCount = scopedLeads.filter(l => l.customerInterest === 'Interested').length;
  const siteVisitsNeeded = scopedLeads.filter(l => l.siteVisitRequired).length;
  const followupsDueToday = scopedLeads.filter(l => l.followUp?.date === todayStr || l.followUp?.status === 'Due Today').length;

  // Manual Call Form State
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

  // Sync if selectedLeadForCall changes
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

  const isFollowUpRequired = useMemo(() => {
    return (
      callForm.outcome === 'Interested' ||
      callForm.outcome === 'Connected - Interested' ||
      callForm.outcome === 'Call Back Requested' ||
      callForm.outcome === 'Connected - Callback'
    );
  }, [callForm.outcome]);

  // Customer Response Editing Form
  const [responseForm, setResponseForm] = useState({
    customerInterest: 'Interested' as 'Interested' | 'Not Interested' | 'Evaluating',
    budgetReadiness: 'Budget Ready' as 'Budget Ready' | 'Seeking Loan' | 'Price Sensitive',
    roofSuitability: 'RCC Flat Roof Suitable' as 'RCC Flat Roof Suitable' | 'Tin Shed' | 'Tiled Roof' | 'Site Survey Required',
    requestedCapacity: '3 kW',
    salesStage: 'Qualified',
    notes: '',
    siteVisitRequired: false,
    nextFollowUpDate: '',
    nextFollowUpTime: '11:00 AM'
  });

  const handleOpenResponseModal = (lead: MockLead) => {
    setResponseModalLead(lead);
    setResponseForm({
      customerInterest: lead.customerInterest || 'Evaluating',
      budgetReadiness: lead.budgetReadiness || 'Budget Ready',
      roofSuitability: lead.roofSuitability || 'RCC Flat Roof Suitable',
      requestedCapacity: lead.capacity || lead.capacityKw || '3 kW',
      salesStage: lead.salesStage || lead.stage || 'Qualified',
      notes: lead.notes || '',
      siteVisitRequired: !!lead.siteVisitRequired,
      nextFollowUpDate: lead.followUp?.date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      nextFollowUpTime: lead.followUp?.time || '11:00 AM'
    });
  };

  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseModalLead) return;

    try {
      setIsSubmitting(true);
      const updates: Partial<MockLead> = {
        customerInterest: responseForm.customerInterest,
        budgetReadiness: responseForm.budgetReadiness,
        roofSuitability: responseForm.roofSuitability,
        capacity: responseForm.requestedCapacity,
        capacityKw: responseForm.requestedCapacity,
        salesStage: responseForm.salesStage as any,
        siteVisitRequired: responseForm.siteVisitRequired,
        notes: responseForm.notes,
        lastContactDate: getIndiaDateString(),
        followUp: responseForm.nextFollowUpDate ? {
          date: responseForm.nextFollowUpDate,
          time: responseForm.nextFollowUpTime || '11:00 AM',
          type: 'Call',
          status: 'Due Today'
        } : responseModalLead.followUp,
        updatedAt: new Date().toISOString()
      };

      await updateLead(responseModalLead.id, updates);
      await addActivity({
        type: 'Customer Response Recorded',
        message: `Telecaller ${currentUserName} updated responses for ${responseModalLead.customer}: ${responseForm.customerInterest}, ${responseForm.budgetReadiness}, ${responseForm.roofSuitability}`,
        user: currentUserName,
        leadId: responseModalLead.id
      });
      setSubmitSuccess(`✓ Saved qualification responses for ${responseModalLead.customer}`);
      setResponseModalLead(null);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to update customer response');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick 1-click updates
  const handleQuickInterest = async (lead: MockLead, interest: 'Interested' | 'Not Interested') => {
    try {
      await updateLead(lead.id, {
        customerInterest: interest,
        salesStage: (interest === 'Interested' ? 'Qualified' : 'Lost / Disqualified') as any,
        lastContactDate: getIndiaDateString(),
        updatedAt: new Date().toISOString()
      });
      await addActivity({
        type: 'Customer Status Updated',
        message: `Telecaller ${currentUserName} marked ${lead.customer} as ${interest}`,
        user: currentUserName,
        leadId: lead.id
      });
      setSubmitSuccess(`✓ Marked ${lead.customer} as ${interest}`);
    } catch (err: any) {
      alert(`Error updating interest: ${err?.message}`);
    }
  };

  const handleToggleSiteVisit = async (lead: MockLead) => {
    const nextVal = !lead.siteVisitRequired;
    try {
      await updateLead(lead.id, {
        siteVisitRequired: nextVal,
        updatedAt: new Date().toISOString()
      });
      await addActivity({
        type: 'Site Visit Status Updated',
        message: `Telecaller ${currentUserName} ${nextVal ? 'requested' : 'removed'} site visit requirement for ${lead.customer}`,
        user: currentUserName,
        leadId: lead.id
      });
      setSubmitSuccess(`✓ Site visit ${nextVal ? 'requested' : 'cleared'} for ${lead.customer}`);
    } catch (err: any) {
      alert(`Error updating site visit: ${err?.message}`);
    }
  };

  // Reschedule Form State
  const [rescheduleData, setRescheduleData] = useState({
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '11:00 AM',
    remarks: ''
  });

  const handleOpenRescheduleModal = (lead: MockLead) => {
    setRescheduleModalLead(lead);
    setRescheduleData({
      date: lead.followUp?.date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: lead.followUp?.time || '11:00 AM',
      remarks: ''
    });
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalLead) return;

    try {
      setIsSubmitting(true);
      await updateLead(rescheduleModalLead.id, {
        followUp: {
          date: rescheduleData.date,
          time: rescheduleData.time,
          type: 'Call',
          status: 'Upcoming'
        },
        notes: rescheduleData.remarks 
          ? `${rescheduleModalLead.notes || ''}\n[Rescheduled to ${rescheduleData.date} ${rescheduleData.time}]: ${rescheduleData.remarks}`.trim()
          : rescheduleModalLead.notes,
        updatedAt: new Date().toISOString()
      });
      await addActivity({
        type: 'Follow-up Rescheduled',
        message: `Telecaller ${currentUserName} rescheduled follow-up for ${rescheduleModalLead.customer} to ${rescheduleData.date} at ${rescheduleData.time}`,
        user: currentUserName,
        leadId: rescheduleModalLead.id
      });
      setSubmitSuccess(`✓ Follow-up rescheduled for ${rescheduleModalLead.customer}`);
      setRescheduleModalLead(null);
    } catch (err: any) {
      alert(`Error rescheduling: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Escalate to Manager State
  const [escalateReason, setEscalateReason] = useState('');
  const handleOpenEscalateModal = (lead: MockLead) => {
    setEscalateModalLead(lead);
    setEscalateReason('');
  };

  const handleConfirmEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateModalLead) return;

    try {
      setIsSubmitting(true);
      await updateLead(escalateModalLead.id, {
        managerEscalated: true,
        managerEscalationReason: escalateReason.trim() || 'Telecaller requested Manager review / guidance',
        notes: `${escalateModalLead.notes || ''}\n[Manager Escalation]: ${escalateReason.trim() || 'Review needed'}`.trim(),
        updatedAt: new Date().toISOString()
      });
      await addActivity({
        type: 'Manager Escalation',
        message: `Telecaller ${currentUserName} escalated ${escalateModalLead.customer} to Sales Manager. Reason: ${escalateReason || 'Review requested'}`,
        user: currentUserName,
        leadId: escalateModalLead.id
      });
      setSubmitSuccess(`✓ Escalated ${escalateModalLead.customer} to Sales Manager`);
      setEscalateModalLead(null);
    } catch (err: any) {
      alert(`Error escalating: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
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

    setIsSubmitting(true);
    setSubmitError(null);

    const callLogId = generateSecureId('clog_');
    const indiaDate = getIndiaDateString();
    const nowIso = new Date().toISOString();

    const newLog = {
      id: callLogId,
      leadId: callForm.leadId,
      customerName: callForm.customerName,
      phone: callForm.phone,
      callDirection: callForm.callDirection,
      durationSeconds: Number(callForm.durationSeconds) || 0,
      outcome: callForm.outcome,
      customerRequirement: callForm.customerRequirement.trim() || undefined,
      notes: callForm.notes.trim() || 'Call completed',
      nextFollowUpDate: callForm.nextFollowUpDate || undefined,
      nextFollowUpTime: callForm.nextFollowUpTime || '11:00 AM',
      telecallerId: currentUserId,
      telecallerName: currentUserName,
      callDate: indiaDate,
      timestamp: nowIso
    };

    try {
      await addCallLog(newLog);

      const isInterested = 
        callForm.outcome === 'Interested' || 
        callForm.outcome === 'Connected - Interested';

      const isNotInterested = 
        callForm.outcome === 'Not Interested' || 
        callForm.outcome === 'Connected - Not Interested';

      const updates: Partial<MockLead> = {
        lastContactDate: indiaDate,
        salesStage: (callForm.updatedLeadStatus || 'Contacted') as any,
        customerInterest: isInterested ? 'Interested' : isNotInterested ? 'Not Interested' : 'Evaluating',
        notes: `${callForm.notes}${callForm.customerRequirement ? ` | Req: ${callForm.customerRequirement}` : ''}`,
        updatedAt: nowIso
      };

      if (callForm.nextFollowUpDate) {
        updates.followUp = {
          date: callForm.nextFollowUpDate,
          time: callForm.nextFollowUpTime || '11:00 AM',
          type: 'Call',
          status: 'Due Today'
        };
      }

      await updateLead(callForm.leadId, updates);
      setSubmitSuccess(`✓ Call log recorded for ${callForm.customerName}.`);

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
      }, 1000);

    } catch (err: any) {
      console.error('Call log submission error:', err);
      setSubmitError(err?.message || 'Failed to persist call log.');
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
            {isManager ? 'Sales Team Telecalling & Customer Response Centre' : 'My Daily Telecalling & Customer Response Desk'}
          </h3>
          <p>
            {callsCompleted} calls made today ({callsConnected} connected, {callsBusyOrNoAnswer} busy/no answer). 
            Connect rate: <strong>{connectRate}%</strong>. Follow-ups due today: <strong>{followupsDueToday}</strong>.
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

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Active Enquiries</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{totalEnquiries}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Interested Customers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>{interestedCount}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>Site Visits Needed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0369a1', marginTop: '2px' }}>{siteVisitsNeeded}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Follow-ups Due Today</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>{followupsDueToday}</div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setDeskTab('responses')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: deskTab === 'responses' ? '#0284c7' : '#f1f5f9',
            color: deskTab === 'responses' ? '#ffffff' : '#475569',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <UserCheck size={16} /> Customer Responses & Enquiries ({filteredCustomerLeads.length})
        </button>
        <button
          type="button"
          onClick={() => setDeskTab('logs')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: deskTab === 'logs' ? '#0284c7' : '#f1f5f9',
            color: deskTab === 'logs' ? '#ffffff' : '#475569',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Clock size={16} /> Call Activity Logs ({scopedCallLogs.length})
        </button>
      </div>

      {/* TAB 1: CUSTOMER RESPONSES & ENQUIRIES TABLE */}
      {deskTab === 'responses' && (
        <div className="sales-panel">
          <div className="sales-panel-header">
            <div>
              <h2 className="sales-panel-title">
                <UserCheck size={20} color="#0284c7" />
                Customer Responses & Follow-Up Action Matrix
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Track customer qualification answers, budget readiness, roof suitability, and follow-up actions.
              </p>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text"
                  placeholder="Search customer, phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="sales-form-control"
                  style={{ paddingLeft: '28px', fontSize: '0.8rem', width: '200px' }}
                />
              </div>

              <select 
                className="sales-form-control"
                style={{ width: 'auto', fontSize: '0.8rem' }}
                value={filterInterest}
                onChange={e => setFilterInterest(e.target.value)}
              >
                <option value="all">All Interests</option>
                <option value="Interested">Interested</option>
                <option value="Evaluating">Evaluating</option>
                <option value="Not Interested">Not Interested</option>
              </select>

              <select 
                className="sales-form-control"
                style={{ width: 'auto', fontSize: '0.8rem' }}
                value={filterSiteVisit}
                onChange={e => setFilterSiteVisit(e.target.value)}
              >
                <option value="all">Site Visit: All</option>
                <option value="yes">Site Visit Required</option>
                <option value="no">No Site Visit</option>
              </select>
            </div>
          </div>

          {filteredCustomerLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <UserCheck size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#0b1f3a' }}>No matching customer responses</h4>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Adjust your filters or add new leads to start telecalling qualification.</p>
            </div>
          ) : (
            <div className="sales-table-wrapper">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Customer & Mobile</th>
                    <th>Capacity & Stage</th>
                    <th>Customer Answers & Qualification</th>
                    <th>Assigned Staff</th>
                    <th>Follow-Up & Schedule</th>
                    <th>Site Visit / Handover</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomerLeads.map(lead => {
                    const interest = lead.customerInterest || 'Evaluating';
                    const budget = lead.budgetReadiness || 'Budget Ready';
                    const roof = lead.roofSuitability || 'RCC Flat Roof Suitable';
                    const capacity = lead.capacity || lead.capacityKw || '3 kW';
                    const stage = lead.salesStage || lead.stage || 'New Lead';
                    const nextFollowUp = lead.followUp?.date;
                    const isDueToday = nextFollowUp === todayStr;

                    return (
                      <tr key={lead.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{lead.customer}</div>
                          <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                            <a href={`tel:${lead.phone}`} style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                              <Phone size={12} /> {lead.phone}
                            </a>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            {lead.location || 'Direct Inbound'} • Source: {lead.source || 'Phone Call'}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 700, color: '#0369a1' }}>{capacity}</div>
                          <span style={{ 
                            display: 'inline-block', 
                            fontSize: '0.7rem', 
                            fontWeight: 700, 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            marginTop: '4px',
                            background: stage.includes('Qualified') || stage.includes('Interested') ? '#ecfdf5' : '#f1f5f9',
                            color: stage.includes('Qualified') || stage.includes('Interested') ? '#15803d' : '#475569',
                            border: `1px solid ${stage.includes('Qualified') || stage.includes('Interested') ? '#a7f3d0' : '#cbd5e1'}`
                          }}>
                            {stage}
                          </span>
                        </td>

                        <td style={{ maxWidth: '240px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: interest === 'Interested' ? '#ecfdf5' : interest === 'Not Interested' ? '#fef2f2' : '#f0f9ff',
                              color: interest === 'Interested' ? '#15803d' : interest === 'Not Interested' ? '#b91c1c' : '#0369a1',
                              border: `1px solid ${interest === 'Interested' ? '#a7f3d0' : interest === 'Not Interested' ? '#fecaca' : '#bae6fd'}`
                            }}>
                              {interest}
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #cbd5e1'
                            }}>
                              {budget}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                            🏠 {roof}
                          </div>
                          {lead.notes && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              "{lead.notes}"
                            </div>
                          )}
                        </td>

                        <td>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {lead.assignedEmployee || lead.createdByName || 'Unassigned'}
                          </div>
                          {lead.managerEscalated && (
                            <span style={{ display: 'inline-block', fontSize: '0.68rem', fontWeight: 700, color: '#b91c1c', background: '#fef2f2', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fecaca', marginTop: '2px' }}>
                              ⚠️ Escalated to Manager
                            </span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                            Last contact: <strong>{lead.lastContactDate || lead.updatedAt?.split('T')[0] || '—'}</strong>
                          </div>
                          {nextFollowUp ? (
                            <div style={{ marginTop: '3px' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isDueToday ? '#fef3c7' : '#ecfdf5',
                                color: isDueToday ? '#b45309' : '#15803d',
                                border: `1px solid ${isDueToday ? '#fde68a' : '#a7f3d0'}`
                              }}>
                                📅 {nextFollowUp} {lead.followUp?.time || ''}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>No follow-up set</span>
                          )}
                        </td>

                        <td>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleToggleSiteVisit(lead)}
                              style={{
                                background: lead.siteVisitRequired ? '#ecfdf5' : '#f1f5f9',
                                color: lead.siteVisitRequired ? '#15803d' : '#64748b',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: `1px solid ${lead.siteVisitRequired ? '#a7f3d0' : '#cbd5e1'}`
                              }}
                              title="Click to toggle site visit requirement"
                            >
                              <MapPin size={12} /> {lead.siteVisitRequired ? 'Site Visit Required' : 'No Site Visit'}
                            </button>
                          </div>
                          {lead.dealer && lead.dealer !== 'Direct (Company)' && (
                            <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '3px' }}>
                              Dealer: {lead.dealer}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="sales-btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#0284c7' }}
                              onClick={() => handleOpenResponseModal(lead)}
                              title="Update qualification answers & responses"
                            >
                              <Edit3 size={13} /> Update
                            </button>
                            <button
                              type="button"
                              className="sales-btn-primary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setCallForm(prev => ({
                                  ...prev,
                                  leadId: lead.id,
                                  customerName: lead.customer,
                                  phone: lead.phone,
                                  customerRequirement: lead.customerRequirement || lead.notes || '',
                                  updatedLeadStatus: lead.salesStage || 'Contacted'
                                }));
                                setIsLogModalOpen(true);
                              }}
                              title="Log Call Outcome"
                            >
                              <PhoneCall size={13} /> Call
                            </button>
                            <button
                              type="button"
                              className="sales-btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleOpenRescheduleModal(lead)}
                              title="Schedule or reschedule follow-up"
                            >
                              <Calendar size={13} />
                            </button>
                            <button
                              type="button"
                              className="sales-btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#16a34a' }}
                              onClick={() => handleQuickInterest(lead, 'Interested')}
                              title="Mark as Interested"
                            >
                              <ThumbsUp size={13} />
                            </button>
                            <button
                              type="button"
                              className="sales-btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#dc2626' }}
                              onClick={() => handleQuickInterest(lead, 'Not Interested')}
                              title="Mark as Not Interested"
                            >
                              <ThumbsDown size={13} />
                            </button>
                            <button
                              type="button"
                              className="sales-btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#d97706' }}
                              onClick={() => handleOpenEscalateModal(lead)}
                              title="Escalate enquiry to Sales Manager"
                            >
                              <ShieldCheck size={13} /> Escalate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CALL LOGS STREAM */}
      {deskTab === 'logs' && (
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
      )}

      {/* MODAL 1: CUSTOMER RESPONSE & QUALIFICATION ANSWERS */}
      {responseModalLead && (
        <div className="sales-modal-overlay" onClick={() => !isSubmitting && setResponseModalLead(null)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="sales-modal-header">
              <h3><UserCheck size={18} style={{ display: 'inline', marginRight: '6px' }} /> Customer Qualification Responses: {responseModalLead.customer}</h3>
              <button 
                className="sales-modal-close-btn" 
                disabled={isSubmitting}
                onClick={() => setResponseModalLead(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveResponse}>
              <div className="sales-modal-body">
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{responseModalLead.customer}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Phone: {responseModalLead.phone} • {responseModalLead.location || 'Direct'}</div>
                  </div>
                  <a href={`tel:${responseModalLead.phone}`} className="sales-btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#0284c7' }}>
                    <Phone size={12} /> Call Customer
                  </a>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Customer Interest Status *</label>
                    <select
                      className="sales-form-control"
                      value={responseForm.customerInterest}
                      onChange={e => setResponseForm({ ...responseForm, customerInterest: e.target.value as any })}
                    >
                      <option value="Interested">Interested (Ready to proceed)</option>
                      <option value="Evaluating">Evaluating (Considering proposal)</option>
                      <option value="Not Interested">Not Interested (Closed inquiry)</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Budget Readiness</label>
                    <select
                      className="sales-form-control"
                      value={responseForm.budgetReadiness}
                      onChange={e => setResponseForm({ ...responseForm, budgetReadiness: e.target.value as any })}
                    >
                      <option value="Budget Ready">Budget Ready (Direct payment)</option>
                      <option value="Seeking Loan">Seeking Loan (JanSamarth / Bank)</option>
                      <option value="Price Sensitive">Price Sensitive (Requires discount/subsidy)</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Roof Suitability</label>
                    <select
                      className="sales-form-control"
                      value={responseForm.roofSuitability}
                      onChange={e => setResponseForm({ ...responseForm, roofSuitability: e.target.value as any })}
                    >
                      <option value="RCC Flat Roof Suitable">RCC Flat Roof Suitable</option>
                      <option value="Tin Shed">Tin Shed / Metal Sheet</option>
                      <option value="Tiled Roof">Tiled / Slanted Roof</option>
                      <option value="Site Survey Required">Site Survey Required (Needs Engineer Visit)</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Requested Capacity</label>
                    <input 
                      type="text" 
                      className="sales-form-control"
                      value={responseForm.requestedCapacity}
                      onChange={e => setResponseForm({ ...responseForm, requestedCapacity: e.target.value })}
                      placeholder="e.g. 3 kW"
                    />
                  </div>
                </div>

                <div className="sales-form-group">
                  <label>Sales Pipeline Stage</label>
                  <select
                    className="sales-form-control"
                    value={responseForm.salesStage}
                    onChange={e => setResponseForm({ ...responseForm, salesStage: e.target.value })}
                  >
                    <option value="New Lead">1. New Lead</option>
                    <option value="Contacted">2. Contacted</option>
                    <option value="Interested">3. Interested</option>
                    <option value="Qualified">4. Qualified</option>
                    <option value="Site Survey">5. Site Survey Requested</option>
                    <option value="Not Interested">Lost / Not Interested</option>
                  </select>
                </div>

                <div className="sales-form-group">
                  <label>Customer Qualification Discussion Notes</label>
                  <textarea
                    rows={2}
                    className="sales-form-control"
                    placeholder="Record answers about electricity bill, roof shadow, customer timeline, decision maker..."
                    value={responseForm.notes}
                    onChange={e => setResponseForm({ ...responseForm, notes: e.target.value })}
                  />
                </div>

                <div style={{ background: '#f0f9ff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#0369a1', fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox"
                      checked={responseForm.siteVisitRequired}
                      onChange={e => setResponseForm({ ...responseForm, siteVisitRequired: e.target.checked })}
                    />
                    Rooftop Site Visit Required by Technical Engineer / Dealer
                  </label>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Next Follow-Up Date</label>
                    <input 
                      type="date"
                      className="sales-form-control"
                      value={responseForm.nextFollowUpDate}
                      onChange={e => setResponseForm({ ...responseForm, nextFollowUpDate: e.target.value })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Next Follow-Up Time</label>
                    <input 
                      type="time"
                      className="sales-form-control"
                      value={responseForm.nextFollowUpTime}
                      onChange={e => setResponseForm({ ...responseForm, nextFollowUpTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="sales-modal-footer">
                <button type="button" className="sales-btn-secondary" onClick={() => setResponseModalLead(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="sales-btn-primary">
                  {isSubmitting ? 'Saving...' : 'Save Responses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESCHEDULE FOLLOW-UP */}
      {rescheduleModalLead && (
        <div className="sales-modal-overlay" onClick={() => !isSubmitting && setRescheduleModalLead(null)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="sales-modal-header">
              <h3><Calendar size={18} style={{ display: 'inline', marginRight: '6px' }} /> Schedule Callback: {rescheduleModalLead.customer}</h3>
              <button className="sales-modal-close-btn" onClick={() => setRescheduleModalLead(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleConfirmReschedule}>
              <div className="sales-modal-body">
                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Follow-Up Date *</label>
                    <input 
                      type="date"
                      required
                      className="sales-form-control"
                      value={rescheduleData.date}
                      onChange={e => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Follow-Up Time *</label>
                    <input 
                      type="time"
                      required
                      className="sales-form-control"
                      value={rescheduleData.time}
                      onChange={e => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="sales-form-group">
                  <label>Reschedule Remarks / Reason</label>
                  <textarea 
                    rows={2}
                    className="sales-form-control"
                    placeholder="e.g. Customer requested call after 6 PM, discussing with family..."
                    value={rescheduleData.remarks}
                    onChange={e => setRescheduleData({ ...rescheduleData, remarks: e.target.value })}
                  />
                </div>
              </div>
              <div className="sales-modal-footer">
                <button type="button" className="sales-btn-secondary" onClick={() => setRescheduleModalLead(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="sales-btn-primary">
                  {isSubmitting ? 'Updating...' : 'Set Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ESCALATE TO MANAGER */}
      {escalateModalLead && (
        <div className="sales-modal-overlay" onClick={() => !isSubmitting && setEscalateModalLead(null)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="sales-modal-header">
              <h3><ShieldCheck size={18} style={{ display: 'inline', marginRight: '6px', color: '#d97706' }} /> Escalate to Sales Manager</h3>
              <button className="sales-modal-close-btn" onClick={() => setEscalateModalLead(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleConfirmEscalate}>
              <div className="sales-modal-body">
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                  Escalate <strong>{escalateModalLead.customer}</strong> ({escalateModalLead.phone}) to Sales Manager for review, custom commercial terms, or assistance.
                </p>
                <div className="sales-form-group">
                  <label>Reason for Escalation *</label>
                  <textarea 
                    rows={3}
                    required
                    className="sales-form-control"
                    placeholder="e.g. Customer requesting special pricing for 10kW commercial system, competitor counter-offer..."
                    value={escalateReason}
                    onChange={e => setEscalateReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="sales-modal-footer">
                <button type="button" className="sales-btn-secondary" onClick={() => setEscalateModalLead(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="sales-btn-primary" style={{ background: '#d97706' }}>
                  {isSubmitting ? 'Escalating...' : 'Confirm Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: MANUAL CALL LOGGING */}
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

                {!callForm.leadId ? (
                  <div className="sales-form-group">
                    <label>Select Customer from Assigned Leads *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={callForm.leadId}
                      onChange={e => {
                        const target = scopedLeads.find(l => l.id === e.target.value);
                        if (target) {
                          setCallForm({
                            ...callForm,
                            leadId: target.id,
                            customerName: target.customer,
                            phone: target.phone,
                            customerRequirement: target.customerRequirement || '',
                            updatedLeadStatus: target.salesStage || 'Contacted'
                          });
                        }
                      }}
                    >
                      <option value="">-- Choose an assigned lead --</option>
                      {scopedLeads.map(l => (
                        <option key={l.id} value={l.id}>{l.customer} ({l.phone}) - {l.location}</option>
                      ))}
                    </select>
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
