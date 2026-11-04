import React, { useState, useMemo } from 'react';
import { 
  Users, Search, Plus, PhoneCall, MessageSquare, 
  AlertTriangle, MapPin, RefreshCw, X, Phone, 
  ChevronLeft, ChevronRight, Calendar, Zap
} from 'lucide-react';
import { useCRM, type MockLead, getIndiaDateString } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import { findDuplicateLeadByPhone } from '../../utils/salesCalculations';
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
  const currentUserId = currentUser?.id || currentUser?.uid || '';

  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
    pincode: '',
    source: 'Website Form',
    priority: 'Warm' as 'Hot' | 'Warm' | 'Cold',
    capacityKw: '3',
    monthlyBill: '',
    assignedEmployee: isManager ? 'P. Suresh' : currentUserName,
    notes: ''
  });

  // Duplicate Phone Warning Detector
  const duplicateCheck = useMemo((): DuplicateCheckResult | { hasDuplicate: false } => {
    if (!newLeadForm.phone || newLeadForm.phone.length < 10) return { hasDuplicate: false };
    return findDuplicateLeadByPhone(leads, newLeadForm.phone);
  }, [leads, newLeadForm.phone]);

  const dupResult = duplicateCheck.hasDuplicate ? (duplicateCheck as DuplicateCheckResult) : null;

  // Telecallers only see their assigned leads strictly by authenticated UID; Sales Managers see all team leads
  const scopedLeads = useMemo(() => {
    let list = leads.filter(l => !l.archived);
    if (!isManager) {
      list = list.filter(l => 
        (l.assignedEmployeeId && currentUserId && l.assignedEmployeeId === currentUserId) || 
        (l.leadOwnerId && currentUserId && l.leadOwnerId === currentUserId)
      );
    }
    return list;
  }, [leads, isManager, currentUserId]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return scopedLeads.filter(lead => {
      // Search match
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const matchName = lead.customer?.toLowerCase().includes(query);
        const matchPhone = lead.phone?.includes(query);
        const matchLoc = lead.location?.toLowerCase().includes(query);
        const matchTown = lead.town?.toLowerCase().includes(query);
        const matchPin = lead.pincode?.includes(query);
        const matchStage = lead.salesStage?.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchLoc && !matchTown && !matchPin && !matchStage) return false;
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

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredLeads.slice(startIndex, startIndex + pageSize);
  }, [filteredLeads, safeCurrentPage, pageSize]);

  // Reset page when filter or search changes
  const handleFilterChange = (filterId: string) => {
    setActiveFilter(filterId);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

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

    const mappedPriority: 'High' | 'Medium' | 'Low' = 
      newLeadForm.priority === 'Hot' ? 'High' : 
      newLeadForm.priority === 'Warm' ? 'Medium' : 'Low';

    const nowIso = new Date().toISOString();
    const todayYmd = getIndiaDateString();

    await addLead({
      customer: newLeadForm.customer,
      phone: newLeadForm.phone,
      email: '',
      location: fullLocation,
      district: newLeadForm.district,
      town: newLeadForm.town,
      pincode: newLeadForm.pincode,
      source: newLeadForm.source,
      priority: mappedPriority,
      capacityKw: newLeadForm.capacityKw,
      monthlyBill: newLeadForm.monthlyBill ? Number(newLeadForm.monthlyBill) : undefined,
      dealer: 'Company Direct',
      stage: 'Lead',
      assignedEmployee: assignedEmp,
      assignedEmployeeId: targetEmpObj?.id || currentUserId,
      leadOwnerId: currentUserId,
      leadOwnerName: currentUserName,
      salesStage: 'New Lead',
      followUp: {
        date: todayYmd,
        time: '11:00 AM',
        type: 'Call',
        status: 'Due Today',
        notes: 'Initial contact call'
      },
      updatedAt: nowIso,
      createdAt: nowIso,
      archived: false,
      callLogs: [],
      notes: newLeadForm.notes
    });

    setIsAddModalOpen(false);
    setNewLeadForm({
      customer: '',
      phone: '',
      district: 'Krishna',
      town: '',
      pincode: '',
      source: 'Website Form',
      priority: 'Warm',
      capacityKw: '3',
      monthlyBill: '',
      assignedEmployee: isManager ? 'P. Suresh' : currentUserName,
      notes: ''
    });
  };

  // Handle Reassignment
  const handleSaveReassignment = async () => {
    if (!reassignModalLead) return;

    if (isManager) {
      const targetEmp = employees.find(e => e.name === reassignTargetEmp);
      await updateLead(reassignModalLead.id, {
        assignedEmployee: reassignTargetEmp,
        assignedEmployeeId: targetEmp?.id || '',
        reassignmentRequest: undefined
      });
      addActivity({
        type: 'Lead Reassigned',
        message: `Lead ${reassignModalLead.customer} reassigned to ${reassignTargetEmp}`,
        user: currentUserName,
        leadId: reassignModalLead.id
      });
    } else {
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
                onClick={() => handleFilterChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search customer, phone, town, pincode..."
              className="sales-form-control"
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
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
                  <th>Customer & Mobile (Click to Call)</th>
                  <th>Location & Pincode</th>
                  <th>Lead Source</th>
                  <th>Capacity / Bill</th>
                  <th>Creation Date</th>
                  <th>Funnel Stage</th>
                  {isManager && <th>Assigned Telecaller</th>}
                  <th>Last Call Date</th>
                  <th>Next Follow-up</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map(lead => {
                  const isHot = lead.leadScore?.category === 'Hot' || lead.priority === 'High';
                  const isWarm = lead.leadScore?.category === 'Warm' || lead.priority === 'Medium';
                  const isSlaBreached = lead.slaStatus === 'SLA Breached';

                  const locDisplay = lead.town 
                    ? `${lead.town}, ${lead.district || lead.location || 'AP'}`
                    : (lead.location || lead.district || 'Andhra Pradesh');

                  const capacityDisplay = lead.capacityKw 
                    ? `${lead.capacityKw} kW` 
                    : (lead.qualificationData?.preferredCapacityKw 
                        ? `${lead.qualificationData.preferredCapacityKw} kW` 
                        : (lead.monthlyBill ? `₹${lead.monthlyBill}/mo` : '3 kW'));

                  const createdDisplay = lead.createdAt 
                    ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) 
                    : (lead.date || 'Today');

                  const lastCallDisplay = lead.lastCallDate 
                    || (lead.callLogs && lead.callLogs.length > 0 ? lead.callLogs[lead.callLogs.length - 1].date : null);

                  return (
                    <tr key={lead.id}>
                      {/* Customer & Click to Call */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{lead.customer}</div>
                        <div style={{ marginTop: '3px' }}>
                          <a 
                            href={`tel:${lead.phone}`}
                            style={{ 
                              color: '#0284c7', 
                              textDecoration: 'none', 
                              fontSize: '0.8rem', 
                              fontWeight: 600, 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px' 
                            }}
                            title="Click to dial customer phone"
                          >
                            <Phone size={13} /> {lead.phone}
                          </a>
                        </div>
                        {lead.reassignmentRequest?.status === 'Pending' && (
                          <span style={{ fontSize: '0.7rem', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', marginTop: '3px', display: 'inline-block' }}>
                            ⚠️ Reassignment Requested
                          </span>
                        )}
                      </td>

                      {/* Location & Pincode */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.825rem' }}>
                          <MapPin size={13} color="#64748b" /> {locDisplay}
                        </div>
                        {lead.pincode && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: '17px' }}>
                            PIN: <strong>{lead.pincode}</strong>
                          </div>
                        )}
                      </td>

                      {/* Lead Source */}
                      <td>
                        <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#334155' }}>
                          {lead.source || 'Website Form'}
                        </span>
                      </td>

                      {/* Capacity / Monthly Bill */}
                      <td>
                        <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={13} color="#d97706" /> {capacityDisplay}
                        </div>
                        {lead.monthlyBill && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            ₹{lead.monthlyBill}/mo bill
                          </div>
                        )}
                      </td>

                      {/* Creation Date */}
                      <td>
                        <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} color="#64748b" /> {createdDisplay}
                        </div>
                      </td>

                      {/* Funnel Stage */}
                      <td>
                        <span className="sales-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                          {lead.salesStage || 'New Lead'}
                        </span>
                        <div style={{ marginTop: '3px' }}>
                          <span className={`sales-badge ${isHot ? 'hot' : isWarm ? 'warm' : 'cold'}`} style={{ fontSize: '0.7rem' }}>
                            {isHot ? '🔥 Hot' : isWarm ? '⚡ Warm' : '❄️ Cold'} ({lead.leadScore?.total || 50} pts)
                          </span>
                        </div>
                        {isSlaBreached && (
                          <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
                            15m SLA Breached
                          </div>
                        )}
                      </td>

                      {/* Manager view: Assigned To */}
                      {isManager && (
                        <td>
                          <div style={{ fontSize: '0.825rem', fontWeight: 500, color: '#0b1f3a' }}>
                            {lead.assignedEmployee || lead.leadOwnerName || 'Unassigned'}
                          </div>
                        </td>
                      )}

                      {/* Last Call Date */}
                      <td>
                        {lastCallDisplay ? (
                          <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                            {lastCallDisplay}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No calls yet</span>
                        )}
                      </td>

                      {/* Next Follow-up */}
                      <td>
                        {lead.followUp?.date ? (
                          <div style={{ fontSize: '0.8rem', color: '#0b1f3a' }}>
                            {lead.followUp.date}
                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>
                              {lead.followUp.time || '11:00 AM'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            className="sales-btn-primary"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                            title="Log Call"
                            onClick={() => onOpenCallLogModal ? onOpenCallLogModal(lead) : onNavigateSubView('telecalling')}
                          >
                            <PhoneCall size={13} /> Call
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
                            title="Solar Feasibility Qualification"
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

            {/* Pagination Controls */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '1rem', 
              borderTop: '1px solid #e2e8f0', 
              flexWrap: 'wrap', 
              gap: '0.75rem' 
            }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Showing <strong>{filteredLeads.length > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0}</strong> to <strong>{Math.min(safeCurrentPage * pageSize, filteredLeads.length)}</strong> of <strong>{filteredLeads.length}</strong> leads
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Rows per page:</span>
                <select 
                  className="sales-form-control" 
                  style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                  <button 
                    className="sales-btn-secondary"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span style={{ padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#0b1f3a' }}>
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <button 
                    className="sales-btn-secondary"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
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
                  <div className="sales-form-group">
                    <label>Pincode</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      className="sales-form-control" 
                      placeholder="e.g. 520001"
                      value={newLeadForm.pincode}
                      onChange={e => setNewLeadForm({ ...newLeadForm, pincode: e.target.value })}
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
                      <option value="Website Form">Website Form</option>
                      <option value="Facebook Ads">Facebook Ads</option>
                      <option value="Google Ads">Google Ads</option>
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

                  <div className="sales-form-group">
                    <label>Approx. Monthly Bill (₹)</label>
                    <input 
                      type="number"
                      className="sales-form-control"
                      placeholder="e.g. 3500"
                      value={newLeadForm.monthlyBill}
                      onChange={e => setNewLeadForm({ ...newLeadForm, monthlyBill: e.target.value })}
                    />
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
