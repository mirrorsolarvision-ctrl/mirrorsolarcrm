import React, { useState, useMemo } from 'react';
import { 
  Users, Search, Plus, Filter, PhoneCall, MessageSquare, 
  Flame, CheckCircle2, AlertTriangle, ArrowRight, UserCheck, 
  MapPin, Tag, RefreshCw, X, ShieldAlert, Sparkles, Building
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import { findDuplicateLeadByPhone, toE164Phone } from '../../utils/salesCalculations';
import type { DuplicateCheckResult } from '../../types/sales';

interface SalesLeadsViewProps {
  onNavigateSubView: (view: any, params?: any) => void;
  onOpenCallLogModal?: (lead?: MockLead) => void;
  onOpenWhatsApp?: (lead: MockLead) => void;
  initialFilter?: string;
}

export default function SalesLeadsView({
  onNavigateSubView,
  onOpenCallLogModal,
  onOpenWhatsApp,
  initialFilter = 'all'
}: SalesLeadsViewProps) {
  const { currentUser, leads, employees, addLead, updateLead, addActivity } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reassignModalLead, setReassignModalLead] = useState<MockLead | null>(null);
  const [reassignTargetEmp, setReassignTargetEmp] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    customer: '',
    phone: '',
    district: 'Krishna',
    town: '',
    location: '',
    source: 'Website',
    priority: 'Warm' as 'Hot' | 'Warm' | 'Cold',
    capacityKw: '3',
    assignedEmployee: isManager ? 'P. Suresh' : currentUserName,
    notes: ''
  });

  // Duplicate Phone Warning Detector
  const duplicateCheck = useMemo((): DuplicateCheckResult | { hasDuplicate: false } => {
    if (!newLeadForm.phone || newLeadForm.phone.length < 10) return { hasDuplicate: false };
    return findDuplicateLeadByPhone(leads, newLeadForm.phone);
  }, [leads, newLeadForm.phone]);

  const dupResult = duplicateCheck.hasDuplicate ? (duplicateCheck as DuplicateCheckResult) : null;

  // Telecallers only see their assigned leads; Sales Managers see all team leads
  const scopedLeads = useMemo(() => {
    let list = leads.filter(l => !l.archived);
    if (!isManager) {
      list = list.filter(l => 
        l.assignedEmployee === currentUserName || 
        l.assignedEmployeeId === currentUserId || 
        l.leadOwnerId === currentUserId
      );
    }
    return list;
  }, [leads, isManager, currentUserName, currentUserId]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return scopedLeads.filter(lead => {
      // Search match
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const matchName = lead.customer?.toLowerCase().includes(query);
        const matchPhone = lead.phone?.includes(query);
        const matchLoc = lead.location?.toLowerCase().includes(query);
        const matchStage = lead.salesStage?.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchLoc && !matchStage) return false;
      }

      // Tab filter
      if (activeFilter === 'new') return lead.salesStage === 'New Lead' || !lead.salesStage;
      if (activeFilter === 'hot') return lead.leadScore?.category === 'Hot' || lead.priority === 'High';
      if (activeFilter === 'warm') return lead.leadScore?.category === 'Warm' || lead.priority === 'Medium';
      if (activeFilter === 'cold') return lead.leadScore?.category === 'Cold' || lead.priority === 'Low';
      if (activeFilter === 'reassign') return !!lead.reassignmentRequest && lead.reassignmentRequest.status === 'Pending';
      if (activeFilter === 'sla_breach') return lead.slaStatus === 'SLA Breached';
      if (activeFilter === 'uncontacted') return !lead.firstCallAttemptAt;

      return true;
    });
  }, [scopedLeads, searchQuery, activeFilter]);

  // Active Telecallers for Assignment
  const activeTelecallers = useMemo(() => {
    return employees.filter(e => 
      e.status === 'Active' && 
      (e.employeeCategory?.toLowerCase().includes('telecaller') || 
       e.employeeCategory?.toLowerCase().includes('sales') || 
       e.responsibilities?.primaryResponsibilityId?.includes('sales') ||
       e.responsibilities?.primaryResponsibilityId?.includes('telecaller'))
    );
  }, [employees]);

  // Handle Create Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.customer || !newLeadForm.phone) return;

    const fullLocation = newLeadForm.town 
      ? `${newLeadForm.town}, ${newLeadForm.district}` 
      : newLeadForm.district;

    const assignedEmp = isManager ? newLeadForm.assignedEmployee : currentUserName;
    const targetEmpObj = employees.find(emp => emp.name === assignedEmp);

    await addLead({
      customer: newLeadForm.customer,
      phone: toE164Phone(newLeadForm.phone),
      email: '',
      location: fullLocation,
      dealer: 'Pending Allocation',
      assignedEmployee: assignedEmp,
      assignedEmployeeId: targetEmpObj?.id || currentUserId,
      leadOwnerId: targetEmpObj?.id || currentUserId,
      leadOwnerName: assignedEmp,
      stage: 'Lead',
      salesStage: 'New Lead',
      priority: newLeadForm.priority === 'Hot' ? 'High' : newLeadForm.priority === 'Warm' ? 'Medium' : 'Low',
      source: newLeadForm.source,
      notes: newLeadForm.notes,
      qualificationData: {
        preferredCapacityKw: Number(newLeadForm.capacityKw) || 3,
        discom: 'APCPDCL',
        expectedTimeline: newLeadForm.priority === 'Hot' ? 'Immediate' : 'Within 30 Days'
      },
      leadScore: {
        total: newLeadForm.priority === 'Hot' ? 80 : newLeadForm.priority === 'Warm' ? 60 : 35,
        category: newLeadForm.priority,
        readinessScore: 20,
        unitsScore: 20,
        roofScore: 20,
        financingScore: 20,
        calculatedAt: new Date().toISOString()
      },
      followUp: {
        date: new Date().toISOString().split('T')[0],
        time: '11:00 AM',
        type: 'Call',
        status: 'Due Today',
        notes: 'Initial 15-minute response call'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false
    });

    addActivity({
      type: 'Lead Created',
      message: `New solar lead added: ${newLeadForm.customer} (${newLeadForm.source}) - Assigned to ${assignedEmp}`,
      user: currentUserName || 'Sales Staff'
    });

    setIsAddModalOpen(false);
    setNewLeadForm({
      customer: '',
      phone: '',
      district: 'Krishna',
      town: '',
      location: '',
      source: 'Website',
      priority: 'Warm',
      capacityKw: '3',
      assignedEmployee: isManager ? 'P. Suresh' : currentUserName,
      notes: ''
    });
  };

  // Handle Lead Reassignment
  const handleSaveReassignment = async () => {
    if (!reassignModalLead) return;

    if (isManager) {
      // Direct Reassign by Manager
      const targetEmpObj = employees.find(e => e.name === reassignTargetEmp);
      await updateLead(reassignModalLead.id, {
        assignedEmployee: reassignTargetEmp,
        assignedEmployeeId: targetEmpObj?.id || '',
        leadOwnerName: reassignTargetEmp,
        leadOwnerId: targetEmpObj?.id || '',
        reassignmentRequest: undefined
      });
      addActivity({
        type: 'Lead Reassigned',
        message: `Lead ${reassignModalLead.customer} reassigned to ${reassignTargetEmp} by Sales Manager`,
        user: currentUserName,
        leadId: reassignModalLead.id
      });
    } else {
      // Reassignment Request by Telecaller
      await updateLead(reassignModalLead.id, {
        reassignmentRequest: {
          requestedBy: currentUserName,
          requestedByRole: 'Telecaller',
          requestedByUserId: currentUserId,
          reason: reassignReason || 'Reassignment requested by telecaller',
          status: 'Pending',
          requestedAt: new Date().toISOString()
        }
      });
      addActivity({
        type: 'Reassignment Requested',
        message: `Reassignment requested for ${reassignModalLead.customer}: ${reassignReason}`,
        user: currentUserName,
        leadId: reassignModalLead.id
      });
    }

    setReassignModalLead(null);
    setReassignTargetEmp('');
    setReassignReason('');
  };

  return (
    <div className="sales-leads-content">
      {/* Top Action Bar */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              {isManager ? 'Team Leads Management' : 'My Assigned Leads'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              {isManager 
                ? 'Full team view of inbound solar enquiries, automatic assignment & lead monitoring' 
                : 'Your dedicated enquiry list. Call, qualify and guide customers towards solar booking.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              className="sales-btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={16} /> Add New Enquiry
            </button>
          </div>
        </div>

        {/* Search & Tabs Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {[
              { id: 'all', label: `All (${scopedLeads.length})` },
              { id: 'new', label: 'New / Inbox' },
              { id: 'hot', label: '🔥 Hot' },
              { id: 'warm', label: '⚡ Warm' },
              { id: 'cold', label: '❄️ Cold' },
              ...(isManager ? [{ id: 'reassign', label: 'Reassignment Requests' }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                className={`sales-subnav-btn ${activeFilter === tab.id ? 'active' : ''}`}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                onClick={() => setActiveFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder="Search customer, mobile, city..."
              className="sales-form-control"
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="sales-panel">
        {filteredLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <Users size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0b1f3a' }}>No matching leads found</h4>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Try clearing filters or search query, or add a new enquiry.</p>
          </div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Customer & Mobile</th>
                  <th>Location</th>
                  <th>Lead Source</th>
                  <th>Priority & Score</th>
                  <th>Sales Funnel Stage</th>
                  {isManager && <th>Assigned To</th>}
                  <th>Next Follow-up</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => {
                  const isHot = lead.leadScore?.category === 'Hot' || lead.priority === 'High';
                  const isWarm = lead.leadScore?.category === 'Warm' || lead.priority === 'Medium';
                  const isSlaBreached = lead.slaStatus === 'SLA Breached';

                  return (
                    <tr key={lead.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{lead.customer}</div>
                        <div style={{ fontSize: '0.775rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {lead.phone}
                        </div>
                        {lead.reassignmentRequest?.status === 'Pending' && (
                          <span style={{ fontSize: '0.7rem', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
                            ⚠️ Reassignment Requested
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.825rem' }}>
                          <MapPin size={13} color="#64748b" /> {lead.location || 'Andhra Pradesh'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#334155' }}>
                          {lead.source || 'Website'}
                        </span>
                      </td>
                      <td>
                        <span className={`sales-badge ${isHot ? 'hot' : isWarm ? 'warm' : 'cold'}`}>
                          {isHot ? '🔥 Hot' : isWarm ? '⚡ Warm' : '❄️ Cold'} ({lead.leadScore?.total || 50} pts)
                        </span>
                        {isSlaBreached && (
                          <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
                            15m SLA Breached
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="sales-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                          {lead.salesStage || 'New Lead'}
                        </span>
                      </td>
                      {isManager && (
                        <td>
                          <div style={{ fontSize: '0.825rem', fontWeight: 500, color: '#0b1f3a' }}>
                            {lead.assignedEmployee || lead.leadOwnerName || 'Unassigned'}
                          </div>
                        </td>
                      )}
                      <td>
                        {lead.followUp?.date ? (
                          <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                            {lead.followUp.date}
                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>
                              {lead.followUp.time || '11:00 AM'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            className="sales-btn-primary"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                            title="Log Call"
                            onClick={() => onOpenCallLogModal ? onOpenCallLogModal(lead) : onNavigateSubView('telecalling')}
                          >
                            <PhoneCall size={13} />
                          </button>
                          <button
                            className="sales-btn-secondary"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: '#16a34a', borderColor: '#bbf7d0' }}
                            title="WhatsApp Chat"
                            onClick={() => onOpenWhatsApp ? onOpenWhatsApp(lead) : onNavigateSubView('whatsapp')}
                          >
                            <MessageSquare size={13} />
                          </button>
                          <button
                            className="sales-btn-secondary"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                            title="4-Pillar Qualification"
                            onClick={() => onNavigateSubView('qualification', { leadId: lead.id })}
                          >
                            Qualify
                          </button>
                          <button
                            className="sales-btn-secondary"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: '#0369a1' }}
                            title={isManager ? "Reassign to Telecaller" : "Request Reassignment"}
                            onClick={() => {
                              setReassignModalLead(lead);
                              setReassignTargetEmp(lead.assignedEmployee || '');
                            }}
                          >
                            <RefreshCw size={13} />
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

      {/* Add New Enquiry Modal */}
      {isAddModalOpen && (
        <div className="sales-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3><Plus size={18} style={{ display: 'inline', marginRight: '6px' }} /> Add New Solar Enquiry</h3>
              <button className="sales-modal-close-btn" onClick={() => setIsAddModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateLead}>
              <div className="sales-modal-body">
                {/* Duplicate Phone Alert Warning */}
                {dupResult && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', color: '#b91c1c', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <AlertTriangle size={16} /> Duplicate Customer Warning!
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem' }}>
                      This mobile number is already registered under <strong>{dupResult.customerName}</strong> ({dupResult.salesStage || 'Active Lead'}) assigned to {dupResult.leadOwnerName}.
                    </p>
                  </div>
                )}

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Customer Name *</label>
                    <input 
                      type="text" 
                      required 
                      className="sales-form-control" 
                      placeholder="e.g. Ramesh Varma"
                      value={newLeadForm.customer}
                      onChange={e => setNewLeadForm({ ...newLeadForm, customer: e.target.value })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Mobile Number (E.164) *</label>
                    <input 
                      type="tel" 
                      required 
                      className="sales-form-control" 
                      placeholder="e.g. 9848012345"
                      value={newLeadForm.phone}
                      onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>District</label>
                    <select 
                      className="sales-form-control"
                      value={newLeadForm.district}
                      onChange={e => setNewLeadForm({ ...newLeadForm, district: e.target.value })}
                    >
                      <option value="Krishna">Krishna</option>
                      <option value="Guntur">Guntur</option>
                      <option value="East Godavari">East Godavari</option>
                      <option value="West Godavari">West Godavari</option>
                      <option value="Eluru">Eluru</option>
                      <option value="NTR">NTR</option>
                      <option value="Visakhapatnam">Visakhapatnam</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Town / Mandal / Area</label>
                    <input 
                      type="text" 
                      className="sales-form-control" 
                      placeholder="e.g. Tenali, Kakinada, Mylavaram"
                      value={newLeadForm.town}
                      onChange={e => setNewLeadForm({ ...newLeadForm, town: e.target.value })}
                    />
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Lead Source</label>
                    <select 
                      className="sales-form-control"
                      value={newLeadForm.source}
                      onChange={e => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    >
                      <option value="Facebook Ads">Facebook Ads</option>
                      <option value="Google Ads">Google Ads</option>
                      <option value="Website Form">Website Form</option>
                      <option value="WhatsApp Business">WhatsApp Business</option>
                      <option value="Customer Referral">Customer Referral</option>
                      <option value="Dealer Walk-in">Dealer Walk-in</option>
                      <option value="Direct Call">Direct Office Phone</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Initial Priority</label>
                    <select 
                      className="sales-form-control"
                      value={newLeadForm.priority}
                      onChange={e => setNewLeadForm({ ...newLeadForm, priority: e.target.value as any })}
                    >
                      <option value="Hot">🔥 Hot (High Intent)</option>
                      <option value="Warm">⚡ Warm (Considering)</option>
                      <option value="Cold">❄️ Cold (Information only)</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Preferred Capacity (kW)</label>
                    <select 
                      className="sales-form-control"
                      value={newLeadForm.capacityKw}
                      onChange={e => setNewLeadForm({ ...newLeadForm, capacityKw: e.target.value })}
                    >
                      <option value="1">1 kW (₹30,000 Subsidy)</option>
                      <option value="2">2 kW (₹60,000 Subsidy)</option>
                      <option value="3">3 kW (₹78,000 Subsidy - Popular)</option>
                      <option value="4">4 kW</option>
                      <option value="5">5 kW</option>
                      <option value="10">10 kW (Commercial)</option>
                    </select>
                  </div>

                  {isManager && (
                    <div className="sales-form-group">
                      <label>Assign to Telecaller</label>
                      <select 
                        className="sales-form-control"
                        value={newLeadForm.assignedEmployee}
                        onChange={e => setNewLeadForm({ ...newLeadForm, assignedEmployee: e.target.value })}
                      >
                        {activeTelecallers.map(emp => (
                          <option key={emp.id} value={emp.name}>{emp.name} ({emp.employeeCategory || 'Telecaller'})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="sales-form-group">
                  <label>Initial Notes / Requirement</label>
                  <textarea 
                    rows={2} 
                    className="sales-form-control"
                    placeholder="Customer inquired about PM Surya Ghar 3kW setup..."
                    value={newLeadForm.notes}
                    onChange={e => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="sales-modal-footer">
                <button type="button" className="sales-btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="sales-btn-primary">Save & Assign Enquiry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Lead Modal */}
      {reassignModalLead && (
        <div className="sales-modal-overlay" onClick={() => setReassignModalLead(null)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3>
                <RefreshCw size={18} style={{ display: 'inline', marginRight: '6px' }} />
                {isManager ? 'Reassign Lead to Telecaller' : 'Request Lead Reassignment'}
              </h3>
              <button className="sales-modal-close-btn" onClick={() => setReassignModalLead(null)}><X size={20} /></button>
            </div>
            <div className="sales-modal-body">
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#475569' }}>
                Customer: <strong>{reassignModalLead.customer}</strong> ({reassignModalLead.phone})<br />
                Currently Assigned: <strong>{reassignModalLead.assignedEmployee || 'Unassigned'}</strong>
              </p>

              {isManager ? (
                <div className="sales-form-group">
                  <label>Assign to New Telecaller</label>
                  <select 
                    className="sales-form-control"
                    value={reassignTargetEmp}
                    onChange={e => setReassignTargetEmp(e.target.value)}
                  >
                    <option value="">-- Select Active Telecaller --</option>
                    {activeTelecallers.map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="sales-form-group">
                  <label>Reason for Reassignment Request</label>
                  <textarea 
                    rows={3} 
                    className="sales-form-control" 
                    placeholder="e.g. Customer requests Telugu speaker only, or out of my designated territory..."
                    value={reassignReason}
                    onChange={e => setReassignReason(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="sales-modal-footer">
              <button className="sales-btn-secondary" onClick={() => setReassignModalLead(null)}>Cancel</button>
              <button 
                className="sales-btn-primary" 
                onClick={handleSaveReassignment}
                disabled={isManager ? !reassignTargetEmp : !reassignReason}
              >
                {isManager ? 'Confirm Reassignment' : 'Submit Request to Manager'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
