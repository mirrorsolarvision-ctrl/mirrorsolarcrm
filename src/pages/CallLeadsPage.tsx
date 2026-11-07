import React, { useState, useEffect, useMemo } from 'react';
import { 
  PhoneIncoming, PhoneCall, Plus, Search, X, CheckCircle2, 
  Lock, ShieldCheck, ArrowRight, Clock, User, Building, 
  MessageSquare, Calendar, AlertCircle, RefreshCw, Phone
} from 'lucide-react';
import PageHero from '../components/PageHero';
import { useCRM, type CallLead } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import { canForwardCallLeadToDealer } from '../utils/permissionCalculations';
import { normalizePhoneForWhatsApp } from '../utils/whatsappTemplates';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import './CallLeadsPage.css';

// Initial fallback mock data if Firestore is empty
const INITIAL_CALL_LEADS: CallLead[] = [
  {
    id: 'CL-1729574001',
    customerName: 'K. Satyanarayana',
    phone: '+91 98480 12345',
    alternatePhone: '+91 94401 54321',
    location: 'Eluru Town (Main Bazar)',
    capacityKw: '3 kW',
    callReceivedBy: 'Sunkara Siva',
    callReceivedById: 'MSV-SIVA-001',
    callReceivedByRole: 'Employee',
    callDate: new Date().toISOString().split('T')[0],
    callTime: '09:40 AM',
    notes: 'Inquired about PM Surya Ghar 3kW rooftop subsidy and net metering process.',
    priority: 'High',
    status: 'New Call',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'CL-1729574002',
    customerName: 'P. Rambabu',
    phone: '+91 98492 88776',
    location: 'Bhimavaram',
    capacityKw: '5 kW',
    callReceivedBy: 'Admin Office',
    callReceivedById: 'admin-001',
    callReceivedByRole: 'Admin',
    callDate: new Date().toISOString().split('T')[0],
    callTime: '09:15 AM',
    notes: 'Commercial grocery store rooftop setup inquiry. Looking for dealer site visit.',
    priority: 'Medium',
    status: 'Forwarded to Dealer',
    forwardedToDealer: 'VIJAY KUMAR',
    forwardedToDealerId: 'DLR-VIJAY',
    forwardedBy: 'Admin Office',
    forwardedAt: new Date(Date.now() - 1800000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString()
  }
];

export default function CallLeadsPage() {
  const { dealers, currentUser, addLead, addActivity } = useCRM();
  const { showToast } = useUI();

  // Permissions
  const isAdmin = currentUser?.role === 'Admin';
  const hasForwardPermission = canForwardCallLeadToDealer(currentUser);

  // Live Firestore State
  const [callLeads, setCallLeads] = useState<CallLead[]>(INITIAL_CALL_LEADS);
  const [isSyncing, setIsSyncing] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'Week'>('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [forwardModalLead, setForwardModalLead] = useState<CallLead | null>(null);
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [forwardingNotes, setForwardingNotes] = useState('');
  const [syncToCrmPipeline, setSyncToCrmPipeline] = useState(true);

  // New Call Lead Form State
  const [newForm, setNewForm] = useState({
    customerName: '',
    phone: '',
    alternatePhone: '',
    location: '',
    capacityKw: '3 kW',
    priority: 'High' as 'High' | 'Medium' | 'Low',
    notes: ''
  });

  // Real-time Firestore sync
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      if (currentUser?.role === 'Dealer') {
        setCallLeads([]);
        return;
      }
      const isAccounts = (currentUser as any)?.role === 'Accounts' || ((currentUser as any)?.employeeCategory || '').toLowerCase().includes('accounts');
      const isPrivileged = isAdmin || isAccounts || hasForwardPermission;
      const q = isPrivileged
        ? query(collection(db, 'call_leads'))
        : query(collection(db, 'call_leads'), where('telecallerId', '==', currentUser?.id || ''));
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const fetched: CallLead[] = [];
          snapshot.forEach((d) => {
            fetched.push({ id: d.id, ...d.data() } as CallLead);
          });
          setCallLeads(fetched);
        }
      }, (err) => {
        console.warn('Real-time call_leads sync error, keeping current state:', err.message);
      });
    } catch (e) {
      console.warn('Firestore subscription failed, running in local state:', e);
    }
    return () => unsubscribe();
  }, [currentUser, isAdmin, hasForwardPermission]);

  // Today Date Strings
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = callLeads.length;
    const today = callLeads.filter(c => c.callDate === todayIso).length;
    const forwarded = callLeads.filter(c => c.status === 'Forwarded to Dealer').length;
    const converted = callLeads.filter(c => c.status === 'Converted to Lead').length;
    return { total, today, forwarded, converted };
  }, [callLeads, todayIso]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return callLeads.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && !(
        item.customerName.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        (item.alternatePhone && item.alternatePhone.includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.forwardedToDealer && item.forwardedToDealer.toLowerCase().includes(q))
      )) {
        return false;
      }

      if (statusFilter !== 'All' && item.status !== statusFilter) return false;

      if (dateFilter === 'Today' && item.callDate !== todayIso) return false;

      return true;
    });
  }, [callLeads, searchQuery, statusFilter, dateFilter, todayIso]);

  // Handlers
  const handleCreateCallLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.customerName.trim() || !newForm.phone.trim()) {
      showToast('Please enter customer name and contact phone number', 'error');
      return;
    }

    const now = new Date();
    const callTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const leadId = `CL-${Date.now()}`;
    const nowIso = now.toISOString();

    const newLead: CallLead = {
      id: leadId,
      customerName: newForm.customerName.trim(),
      phone: newForm.phone.trim(),
      alternatePhone: newForm.alternatePhone.trim() || undefined,
      location: newForm.location.trim() || undefined,
      capacityKw: newForm.capacityKw,
      callReceivedBy: currentUser?.name || 'Office Staff',
      callReceivedById: currentUser?.id || 'staff-001',
      callReceivedByRole: (currentUser?.role === 'Admin' ? 'Admin' : 'Employee'),
      callDate: now.toISOString().split('T')[0],
      callTime: callTimeStr,
      notes: newForm.notes.trim() || undefined,
      priority: newForm.priority,
      status: 'New Call',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    try {
      await setDoc(doc(db, 'call_leads', leadId), newLead);
    } catch (err: any) {
      console.warn('Firestore setDoc failed, saving in memory:', err);
    }

    setCallLeads(prev => [newLead, ...prev]);

    addActivity({
      type: 'Office Call Recorded',
      message: `Inbound office phone call logged for ${newLead.customerName} (${newLead.phone}) by ${currentUser?.name || 'Staff'}`,
      user: currentUser?.name || 'Staff'
    });

    showToast(`✓ Call lead for ${newLead.customerName} logged successfully!`, 'success');
    setShowAddModal(false);
    setNewForm({
      customerName: '',
      phone: '',
      alternatePhone: '',
      location: '',
      capacityKw: '3 kW',
      priority: 'High',
      notes: ''
    });
  };

  const handleOpenForwardModal = (lead: CallLead) => {
    if (!hasForwardPermission) {
      showToast('🔒 Forwarding to Dealer requires Administrator permission. Please contact Admin.', 'warning');
      return;
    }
    setForwardModalLead(lead);
    setSelectedDealerId(dealers.length > 0 ? dealers[0].id : '');
    setForwardingNotes('');
    setSyncToCrmPipeline(true);
  };

  const handleConfirmForwardToDealer = async () => {
    if (!forwardModalLead) return;
    if (!selectedDealerId) {
      showToast('Please select a dealer to forward this lead to', 'error');
      return;
    }

    const matchedDealer = dealers.find(d => d.id === selectedDealerId);
    const dealerName = matchedDealer ? matchedDealer.name : selectedDealerId;
    const nowIso = new Date().toISOString();

    const updates: Partial<CallLead> = {
      status: 'Forwarded to Dealer',
      forwardedToDealer: dealerName,
      forwardedToDealerId: selectedDealerId,
      forwardedAt: nowIso,
      forwardedBy: currentUser?.name || 'Staff',
      forwardedById: currentUser?.id || '',
      forwardingNotes: forwardingNotes.trim() || undefined,
      updatedAt: nowIso
    };

    // If sync to CRM pipeline is selected, create regular Lead in CRMContext
    let crmLeadId = '';
    if (syncToCrmPipeline) {
      try {
        crmLeadId = `LEAD_CALL_${Date.now()}`;
        await addLead({
          customer: forwardModalLead.customerName,
          phone: forwardModalLead.phone,
          email: '',
          location: forwardModalLead.location || '',
          dealer: dealerName,
          dealerId: selectedDealerId,
          assignedEmployee: '',
          assignedEmployeeId: '',
          leadOwnerId: currentUser?.id || '',
          leadOwnerName: currentUser?.name || 'Staff',
          salesStage: 'New Lead',
          slaStatus: 'Timer Running',
          createdBy: currentUser?.id || 'Staff',
          createdByName: currentUser?.name || 'Staff',
          createdByRole: currentUser?.role || 'Employee',
          notes: `[Office Phone Lead]: ${forwardModalLead.notes || ''} | Forwarding remarks: ${forwardingNotes || 'None'}`,
          stage: 'Lead',
          priority: forwardModalLead.priority || 'Medium',
          leadType: 'project',
          source: 'Office Phone Call',
          followUp: { date: todayIso, time: '11:00 AM', type: 'Call', status: 'Due Today' },
          createdAt: nowIso,
          updatedAt: nowIso,
          archived: false
        });
        updates.crmLeadId = crmLeadId;
      } catch (err: any) {
        console.warn('Could not sync to CRM pipeline:', err);
      }
    }

    // Update in Firestore
    try {
      await updateDoc(doc(db, 'call_leads', forwardModalLead.id), updates);
    } catch (err) {
      console.warn('Firestore updateDoc failed, updated in memory:', err);
    }

    setCallLeads(prev => prev.map(item => item.id === forwardModalLead.id ? { ...item, ...updates } : item));

    addActivity({
      type: 'Lead Forwarded to Dealer',
      message: `Office phone call lead for ${forwardModalLead.customerName} forwarded to Dealer ${dealerName} by ${currentUser?.name || 'Staff'}`,
      user: currentUser?.name || 'Staff',
      dealer: dealerName
    });

    showToast(`✓ Call lead forwarded to Dealer ${dealerName} successfully!`, 'success');
    setForwardModalLead(null);
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'New Call': return 'new';
      case 'In Follow-up': return 'followup';
      case 'Forwarded to Dealer': return 'forwarded';
      case 'Converted to Lead': return 'converted';
      default: return 'dropped';
    }
  };

  return (
    <div className="call-leads-page">
      {/* Page Hero */}
      <PageHero
        badge="Office Inbound Channel"
        icon={<PhoneIncoming size={26} />}
        title="Office Phone Call Leads"
        subtitle="Record inbound inquiries from the office phone and manage authorized dealer forwarding."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              type="button" 
              className="cl-btn-secondary"
              onClick={() => {
                setIsSyncing(true);
                setTimeout(() => {
                  setIsSyncing(false);
                  showToast('✓ Call leads synchronized!', 'info');
                }, 500);
              }}
              title="Refresh leads"
            >
              <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh</span>
            </button>
            <button 
              type="button" 
              className="cl-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={18} /> Log New Call Lead
            </button>
          </div>
        }
      />

      {/* Permission Notice Banner */}
      {hasForwardPermission ? (
        <div className="cl-permission-banner">
          <ShieldCheck size={20} color="#2563eb" />
          <span>
            <strong>Dealer Forwarding Authorized:</strong> You have permission to forward office phone call leads directly to our authorized dealer network.
          </span>
        </div>
      ) : (
        <div className="cl-permission-banner restricted">
          <Lock size={20} color="#d97706" />
          <span>
            <strong>Dealer Forwarding Policy:</strong> You can record call leads freely. Forwarding call leads to dealers is restricted to Administrators (or staff with granted permission).
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="cl-metrics-grid">
        <div className="cl-metric-card">
          <div className="cl-metric-icon blue">
            <PhoneCall size={24} />
          </div>
          <div className="cl-metric-info">
            <span className="cl-metric-label">Total Inbound Calls</span>
            <span className="cl-metric-value">{metrics.total}</span>
          </div>
        </div>

        <div className="cl-metric-card">
          <div className="cl-metric-icon amber">
            <Clock size={24} />
          </div>
          <div className="cl-metric-info">
            <span className="cl-metric-label">Calls Today</span>
            <span className="cl-metric-value">{metrics.today}</span>
          </div>
        </div>

        <div className="cl-metric-card">
          <div className="cl-metric-icon purple">
            <Building size={24} />
          </div>
          <div className="cl-metric-info">
            <span className="cl-metric-label">Forwarded to Dealers</span>
            <span className="cl-metric-value">{metrics.forwarded}</span>
          </div>
        </div>

        <div className="cl-metric-card">
          <div className="cl-metric-icon green">
            <CheckCircle2 size={24} />
          </div>
          <div className="cl-metric-info">
            <span className="cl-metric-label">Converted Leads</span>
            <span className="cl-metric-value">{metrics.converted}</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="cl-controls-card">
        <div className="cl-search-row">
          <div className="cl-search-box">
            <Search size={18} className="cl-search-icon" />
            <input 
              type="text" 
              placeholder="Search call leads by caller name, phone number, location, or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="cl-search-clear" 
                onClick={() => setSearchQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="cl-filter-selects">
            <select 
              className="cl-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Call Statuses</option>
              <option value="New Call">New Call</option>
              <option value="In Follow-up">In Follow-up</option>
              <option value="Forwarded to Dealer">Forwarded to Dealer</option>
              <option value="Converted to Lead">Converted to Lead</option>
              <option value="Dropped">Dropped</option>
            </select>

            <select 
              className="cl-select"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
            >
              <option value="All">All Call Dates</option>
              <option value="Today">Today's Calls Only</option>
            </select>

            {(searchQuery || statusFilter !== 'All' || dateFilter !== 'All') && (
              <button 
                type="button" 
                className="cl-btn-reset"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setDateFilter('All');
                }}
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="cl-table-container">
        {filteredLeads.length === 0 ? (
          <div className="cl-empty-state">
            <div className="cl-empty-icon">
              <PhoneCall size={30} />
            </div>
            <h3>No Office Call Leads Found</h3>
            <p>No phone call records match your current search or filter criteria.</p>
            <button 
              type="button" 
              className="cl-btn-primary" 
              style={{ marginTop: '1rem' }}
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} /> Log First Inbound Call
            </button>
          </div>
        ) : (
          <table className="cl-table">
            <thead>
              <tr>
                <th>Caller & Contact</th>
                <th>Requirement</th>
                <th>Received By</th>
                <th>Call Time</th>
                <th>Status</th>
                <th>Dealer Assigned</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((item) => {
                const isForwarded = item.status === 'Forwarded to Dealer' && !!item.forwardedToDealer;
                const waUrl = `https://wa.me/${normalizePhoneForWhatsApp(item.phone)}?text=${encodeURIComponent(`Hello ${item.customerName}, thank you for contacting Mirror Solar Vision regarding your solar inquiry.`)}`;

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="cl-customer-title">
                        <span>{item.customerName}</span>
                        {item.priority === 'High' && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', fontWeight: 800 }}>
                            HIGH
                          </span>
                        )}
                      </div>
                      <div className="cl-phone-row">
                        <span className="cl-phone-text">{item.phone}</span>
                        <a 
                          href={`tel:${item.phone.replace(/\s+/g, '')}`} 
                          className="cl-quick-action-btn call"
                          title="Call phone number"
                        >
                          <Phone size={13} />
                        </a>
                        <a 
                          href={waUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="cl-quick-action-btn whatsapp"
                          title="Message on WhatsApp"
                        >
                          <MessageSquare size={13} />
                        </a>
                      </div>
                      {item.location && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          📍 {item.location}
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: '#0b1f3a' }}>
                        ⚡ {item.capacityKw || '3 kW'} System
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.notes}>
                        {item.notes || 'Inquiry from office phone'}
                      </div>
                    </td>

                    <td>
                      <div className="cl-receiver-tag">
                        {item.callReceivedBy}
                      </div>
                      <div className="cl-receiver-sub">
                        {item.callReceivedByRole}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>
                        {item.callTime}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {item.callDate}
                      </div>
                    </td>

                    <td>
                      <span className={`cl-status-pill ${getStatusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>

                    <td>
                      {isForwarded ? (
                        <div className="cl-dealer-tag" title={`Forwarded by ${item.forwardedBy || 'Admin'}`}>
                          <Building size={14} />
                          <span>{item.forwardedToDealer}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Not Forwarded
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="cl-row-actions" style={{ justifyContent: 'flex-end' }}>
                        {isForwarded ? (
                          <button 
                            type="button" 
                            className="cl-btn-secondary"
                            onClick={() => handleOpenForwardModal(item)}
                            title="Reassign or change dealer"
                          >
                            <ArrowRight size={14} /> Reassign
                          </button>
                        ) : (
                          <button 
                            type="button" 
                            className={`cl-btn-forward ${!hasForwardPermission ? 'locked' : ''}`}
                            onClick={() => handleOpenForwardModal(item)}
                            title={hasForwardPermission ? 'Forward this call lead to an authorized dealer' : 'Forwarding requires Admin authorization'}
                          >
                            {hasForwardPermission ? <ArrowRight size={14} /> : <Lock size={14} />}
                            <span>Forward to Dealer</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL 1: LOG NEW CALL LEAD --- */}
      {showAddModal && (
        <div className="cl-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cl-modal-card" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h3><PhoneIncoming size={20} className="text-blue" /> Log Inbound Office Phone Call</h3>
              <button className="cl-modal-close-btn" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateCallLead}>
              <div className="cl-modal-body">
                <div className="cl-form-grid">
                  <div className="cl-form-group">
                    <label>Caller / Customer Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. K. Satyanarayana"
                      value={newForm.customerName}
                      onChange={e => setNewForm({ ...newForm, customerName: e.target.value })}
                    />
                  </div>

                  <div className="cl-form-group">
                    <label>Phone Number *</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="e.g. +91 98480 12345"
                      value={newForm.phone}
                      onChange={e => setNewForm({ ...newForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="cl-form-group">
                    <label>Alternate Contact Number</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. +91 94401 54321 (Optional)"
                      value={newForm.alternatePhone}
                      onChange={e => setNewForm({ ...newForm, alternatePhone: e.target.value })}
                    />
                  </div>

                  <div className="cl-form-group">
                    <label>Caller Location / City</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Eluru, Bhimavaram, Vijayawada"
                      value={newForm.location}
                      onChange={e => setNewForm({ ...newForm, location: e.target.value })}
                    />
                  </div>

                  <div className="cl-form-group">
                    <label>Required Solar Capacity</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        placeholder="e.g. 3 or 3.5 kW"
                        value={newForm.capacityKw}
                        onChange={e => setNewForm({ ...newForm, capacityKw: e.target.value })}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setNewForm({ ...newForm, capacityKw: '3 kW' })}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          borderRadius: '4px',
                          border: newForm.capacityKw.startsWith('3') ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          background: newForm.capacityKw.startsWith('3') ? '#e0f2fe' : '#f8fafc',
                          color: newForm.capacityKw.startsWith('3') ? '#0369a1' : '#475569',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        3 kW (Recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewForm({ ...newForm, capacityKw: '2 kW' })}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          borderRadius: '4px',
                          border: newForm.capacityKw.startsWith('2') ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          background: newForm.capacityKw.startsWith('2') ? '#e0f2fe' : '#f8fafc',
                          color: newForm.capacityKw.startsWith('2') ? '#0369a1' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        2 kW (Optional)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewForm({ ...newForm, capacityKw: '5 kW' })}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          borderRadius: '4px',
                          border: newForm.capacityKw.startsWith('5') ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          background: newForm.capacityKw.startsWith('5') ? '#e0f2fe' : '#f8fafc',
                          color: newForm.capacityKw.startsWith('5') ? '#0369a1' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        5 kW
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewForm({ ...newForm, capacityKw: '10 kW' })}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          borderRadius: '4px',
                          border: newForm.capacityKw.startsWith('10') ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          background: newForm.capacityKw.startsWith('10') ? '#e0f2fe' : '#f8fafc',
                          color: newForm.capacityKw.startsWith('10') ? '#0369a1' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        10 kW
                      </button>
                    </div>
                  </div>

                  <div className="cl-form-group">
                    <label>Priority</label>
                    <select 
                      value={newForm.priority}
                      onChange={e => setNewForm({ ...newForm, priority: e.target.value as any })}
                    >
                      <option value="High">High (Immediate Requirement)</option>
                      <option value="Medium">Medium (General Inquiry)</option>
                      <option value="Low">Low (Future Planning)</option>
                    </select>
                  </div>

                  <div className="cl-form-group full-width">
                    <label>Call Discussion Notes / Customer Inquiry *</label>
                    <textarea 
                      rows={3} 
                      placeholder="Customer rooftop details, average electricity bill amount, query about subsidy, or notes discussed..."
                      value={newForm.notes}
                      onChange={e => setNewForm({ ...newForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="cl-modal-footer">
                <button type="button" className="cl-btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="cl-btn-primary">
                  <CheckCircle2 size={16} /> Save Call Lead Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: FORWARD TO DEALER MODAL --- */}
      {forwardModalLead && (
        <div className="cl-modal-overlay" onClick={() => setForwardModalLead(null)}>
          <div className="cl-modal-card" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h3><Building size={20} className="text-blue" /> Forward Call Lead to Authorized Dealer</h3>
              <button className="cl-modal-close-btn" onClick={() => setForwardModalLead(null)}><X size={20} /></button>
            </div>

            <div className="cl-modal-body">
              {/* Lead Summary Info */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0b1f3a' }}>
                    {forwardModalLead.customerName}
                  </span>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>
                    {forwardModalLead.capacityKw || '3 kW'} System
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                  📞 {forwardModalLead.phone} {forwardModalLead.location ? `• 📍 ${forwardModalLead.location}` : ''}
                </div>
                {forwardModalLead.notes && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
                    "{forwardModalLead.notes}"
                  </div>
                )}
              </div>

              <div className="cl-form-group" style={{ marginBottom: '1rem' }}>
                <label>Select Authorized Dealer *</label>
                <select 
                  value={selectedDealerId}
                  onChange={e => setSelectedDealerId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {dealers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.address ? `(${d.address})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cl-form-group" style={{ marginBottom: '1rem' }}>
                <label>Forwarding Instructions / Notes for Dealer</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Customer requested immediate site survey visit this weekend..."
                  value={forwardingNotes}
                  onChange={e => setForwardingNotes(e.target.value)}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
                <input 
                  type="checkbox"
                  checked={syncToCrmPipeline}
                  onChange={e => setSyncToCrmPipeline(e.target.checked)}
                />
                <span>Automatically sync as an active project lead in the Dealer's CRM pipeline</span>
              </label>
            </div>

            <div className="cl-modal-footer">
              <button type="button" className="cl-btn-cancel" onClick={() => setForwardModalLead(null)}>Cancel</button>
              <button 
                type="button" 
                className="cl-btn-primary"
                onClick={handleConfirmForwardToDealer}
              >
                <ArrowRight size={16} /> Confirm & Forward to Dealer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
