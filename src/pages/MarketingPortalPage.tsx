import React, { useState, useMemo } from 'react';
import { 
  Megaphone, Plus, Search, Filter, Phone, Calendar, Clock, 
  CheckCircle2, ArrowRight, UserCheck, TrendingUp, AlertCircle,
  FileText, MessageSquare, Tag, Users, ChevronRight, X
} from 'lucide-react';
import { useMarketing } from '../context/MarketingContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import type { MarketingLead, LeadSource, MarketingStage } from '../types/marketing';
import { LOCKED_COMPANY_DETAILS } from '../config/companyDetails';
import QuotationEditor from '../components/QuotationEditor';
import './MarketingPortalPage.css';

const STAGE_LABELS: Record<MarketingStage, string> = {
  NEW_LEAD: 'New Enquiry',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  SITE_SURVEY_BOOKED: 'Survey Booked',
  QUOTATION_SENT: 'Quotation Sent',
  FOLLOW_UP: 'Follow-up Required',
  WON: 'Won / Converted',
  LOST: 'Lost'
};

const LEAD_SOURCES: LeadSource[] = [
  'Facebook', 'Instagram', 'Google', 'WhatsApp', 'Website',
  'YouTube', 'Referral', 'Dealer', 'Walk-in', 'Exhibition', 'Other'
];

export default function MarketingPortalPage() {
  const { leads, createLead, updateLeadStage, addLeadNote, getMetrics } = useMarketing();
  const { currentUser } = useAuth();
  const { showToast } = useUI();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [stageFilter, setStageFilter] = useState<string>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeLeadDetails, setActiveLeadDetails] = useState<MarketingLead | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [quoteLead, setQuoteLead] = useState<MarketingLead | null>(null);

  // New Lead Form
  const [newForm, setNewForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    city: 'Hyderabad',
    state: 'Telangana',
    source: 'Facebook' as LeadSource,
    desiredCapacityKw: 3,
    monthlyElectricityBill: 3500,
    stage: 'NEW_LEAD' as MarketingStage
  });

  const metrics = useMemo(() => getMetrics(), [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && !(
        l.customerName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.city.toLowerCase().includes(q)
      )) return false;

      if (sourceFilter !== 'All' && l.source !== sourceFilter) return false;
      if (stageFilter !== 'All' && l.stage !== stageFilter) return false;
      return true;
    });
  }, [leads, searchQuery, sourceFilter, stageFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.customerName.trim() || !newForm.phone.trim()) {
      showToast('Please enter customer name and phone', 'error');
      return;
    }

    try {
      await createLead({
        ...newForm,
        assignedMarketingEmployeeId: currentUser?.id,
        assignedMarketingEmployeeName: currentUser?.name
      });
      showToast('New marketing enquiry added!', 'success');
      setIsAddModalOpen(false);
      setNewForm({
        customerName: '',
        phone: '',
        email: '',
        city: 'Hyderabad',
        state: 'Telangana',
        source: 'Facebook',
        desiredCapacityKw: 3,
        monthlyElectricityBill: 3500,
        stage: 'NEW_LEAD'
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to create lead', 'error');
    }
  };

  const handleAddNote = async () => {
    if (!activeLeadDetails || !newNoteText.trim()) return;
    await addLeadNote(activeLeadDetails.id, newNoteText.trim());
    setNewNoteText('');
    showToast('Call note recorded', 'success');
    // Refresh active lead in drawer
    const refreshed = leads.find((l) => l.id === activeLeadDetails.id);
    if (refreshed) setActiveLeadDetails(refreshed);
  };

  return (
    <div className="marketing-portal-page">
      {/* Header */}
      <div className="mp-header">
        <div>
          <div className="mp-breadcrumb">Employee Workspace / Marketing Operations</div>
          <div className="mp-title-row">
            <h1>Marketing & Lead Generation Hub</h1>
          </div>
          <p className="mp-sub">Track digital campaigns, enquiries, customer calls, surveys, and conversion funnels.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} /> New Campaign Lead
        </button>
      </div>

      {/* Metrics Funnel Bar */}
      <div className="mp-funnel-grid">
        <div className="mp-funnel-card">
          <span className="mp-card-label">Total Enquiries</span>
          <span className="mp-card-val">{metrics.totalLeads}</span>
          <span className="mp-card-foot text-navy font-semibold">100% Volume</span>
        </div>
        <div className="mp-funnel-card">
          <span className="mp-card-label">Surveys Booked</span>
          <span className="mp-card-val text-blue">{metrics.surveysBooked}</span>
          <span className="mp-card-foot text-muted">Technical Feasibility</span>
        </div>
        <div className="mp-funnel-card">
          <span className="mp-card-label">Quotations Sent</span>
          <span className="mp-card-val text-amber">{metrics.quotationsSent}</span>
          <span className="mp-card-foot text-muted">Bill-Book Proposals</span>
        </div>
        <div className="mp-funnel-card">
          <span className="mp-card-label">Deals Won</span>
          <span className="mp-card-val text-green">{metrics.won}</span>
          <span className="mp-card-foot text-green font-semibold">{metrics.conversionRate}% Conversion</span>
        </div>
      </div>

      {/* Lead Sources Distribution Chips */}
      <div className="mp-source-chips-card">
        <span className="mp-source-title"><Tag size={14} /> Campaign Source Breakdown:</span>
        <div className="mp-chips-row">
          {LEAD_SOURCES.map((src) => {
            const count = metrics.sourceBreakdown[src] || 0;
            return (
              <div 
                key={src} 
                className={`mp-source-chip ${sourceFilter === src ? 'active' : ''}`}
                onClick={() => setSourceFilter(sourceFilter === src ? 'All' : src)}
              >
                <span>{src}</span>
                <span className="mp-chip-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leads Table Panel */}
      <div className="mp-main-panel">
        <div className="mp-toolbar">
          <div className="mp-search-box">
            <Search size={16} color="#64748B" />
            <input 
              type="text" 
              placeholder="Search enquiries by name, phone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="mp-select" 
            value={stageFilter} 
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="All">All Stages</option>
            {Object.entries(STAGE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select 
            className="mp-select" 
            value={sourceFilter} 
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="All">All Sources</option>
            {LEAD_SOURCES.map((src) => (
              <option key={src} value={src}>{src}</option>
            ))}
          </select>
        </div>

        <div className="mp-table-wrapper">
          <table className="mp-table">
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>SOURCE</th>
                <th>DESIRED CAPACITY</th>
                <th>STAGE</th>
                <th>CALLS</th>
                <th>DATE ADDED</th>
                <th style={{ textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="mp-cust-cell">
                      <span className="mp-cust-name">{lead.customerName}</span>
                      <span className="mp-cust-sub">{lead.phone} • {lead.city}</span>
                    </div>
                  </td>
                  <td>
                    <span className="mp-source-badge">{lead.source}</span>
                  </td>
                  <td>
                    <span className="font-bold text-navy">{lead.desiredCapacityKw || 3} kW</span>
                    {lead.monthlyElectricityBill && (
                      <span className="mp-cust-sub">Bill: ₹{lead.monthlyElectricityBill.toLocaleString('en-IN')}</span>
                    )}
                  </td>
                  <td>
                    <select 
                      className={`mp-stage-dropdown stage-${lead.stage.toLowerCase()}`}
                      value={lead.stage}
                      onChange={(e) => updateLeadStage(lead.id, e.target.value as MarketingStage)}
                    >
                      {Object.entries(STAGE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="mp-calls-badge">
                      <Phone size={11} /> {lead.callCount} Calls
                    </span>
                  </td>
                  <td className="text-muted text-sm">
                    {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td>
                    <div className="mp-actions-row">
                      <button 
                        className="btn-outline mp-btn-sm" 
                        title="View Call Notes"
                        onClick={() => setActiveLeadDetails(lead)}
                      >
                        <MessageSquare size={13} /> Notes
                      </button>
                      <button 
                        className="btn-primary mp-btn-sm" 
                        title="Generate Quotation"
                        onClick={() => setQuoteLead(lead)}
                      >
                        <FileText size={13} /> Quote
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="mp-empty">
                      <Megaphone size={44} />
                      <h4>No Marketing Leads Match</h4>
                      <p>Try clearing filters or add a new enquiry from social campaigns.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Marketing Lead Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <h2>Add New Marketing Enquiry</h2>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label>Customer Name *</label>
                <input 
                  type="text" 
                  required
                  value={newForm.customerName} 
                  onChange={(e) => setNewForm({ ...newForm, customerName: e.target.value })}
                  placeholder="e.g. Anji Reddy"
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input 
                    type="tel" 
                    required
                    value={newForm.phone} 
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    placeholder="10-digit mobile"
                  />
                </div>
                <div className="form-group">
                  <label>Lead Source</label>
                  <select 
                    value={newForm.source} 
                    onChange={(e) => setNewForm({ ...newForm, source: e.target.value as LeadSource })}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Desired Capacity (kW)</label>
                  <input 
                    type="number" 
                    value={newForm.desiredCapacityKw} 
                    onChange={(e) => setNewForm({ ...newForm, desiredCapacityKw: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Power Bill (₹)</label>
                  <input 
                    type="number" 
                    value={newForm.monthlyElectricityBill} 
                    onChange={(e) => setNewForm({ ...newForm, monthlyElectricityBill: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>City / Location</label>
                <input 
                  type="text" 
                  value={newForm.city} 
                  onChange={(e) => setNewForm({ ...newForm, city: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Notes & Call Activity Slide-over Drawer */}
      {activeLeadDetails && (
        <div className="modal-overlay" onClick={() => setActiveLeadDetails(null)}>
          <div className="mp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mp-drawer-header">
              <div>
                <h3>{activeLeadDetails.customerName}</h3>
                <span className="mp-drawer-sub">{activeLeadDetails.phone} • {activeLeadDetails.source} Campaign</span>
              </div>
              <button className="mp-drawer-close" onClick={() => setActiveLeadDetails(null)}><X size={20}/></button>
            </div>
            
            <div className="mp-drawer-body">
              <div className="mp-add-note-box">
                <label>Add Call Log / Customer Follow-Up:</label>
                <textarea 
                  rows={3}
                  value={newNoteText} 
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Details of call, customer requirements, site survey preference..."
                />
                <button className="btn-primary" style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }} onClick={handleAddNote}>
                  Save Call Log
                </button>
              </div>

              <div className="mp-notes-history">
                <h4>Call & Note Activity ({activeLeadDetails.notes?.length || 0})</h4>
                {activeLeadDetails.notes && activeLeadDetails.notes.length > 0 ? (
                  activeLeadDetails.notes.map((note) => (
                    <div key={note.id} className="mp-note-card">
                      <p>{note.text}</p>
                      <div className="mp-note-meta">
                        <span>By {note.author}</span>
                        <span>•</span>
                        <span>{new Date(note.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '1rem' }}>
                    No call logs recorded yet. Add your first note above.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Editor Integration */}
      {quoteLead && (
        <QuotationEditor 
          initialQuotation={{
            id: `QT_${Date.now()}`,
            quotationNumber: `MSV-QT-${new Date().getFullYear()}-DRAFT`,
            version: 1,
            status: 'Draft',
            createdBy: currentUser?.name || 'Marketing Rep',
            createdByRole: 'Employee',
            createdById: currentUser?.id || 'mkt',
            customer: {
              customerName: quoteLead.customerName,
              mobileNumber: quoteLead.phone,
              email: quoteLead.email || '',
              address: quoteLead.address || quoteLead.city,
              city: quoteLead.city,
              state: quoteLead.state,
              pinCode: '500081',
              customerType: 'Residential'
            },
            project: {
              systemCapacityKw: quoteLead.desiredCapacityKw || 3,
              plantType: 'On-Grid',
              phaseType: 'Single Phase',
              roofType: 'RCC Flat Roof'
            },
            items: [],
            financials: {
              subtotal: 0, totalItemDiscount: 0, extraDiscount: 0, taxableAmount: 0,
              gstTotal: 0, cgst: 0, sgst: 0, igst: 0, subsidyEligible: true, subsidyAmount: 78000,
              roundOff: 0, grandTotal: 0, netPayableByCustomer: 0
            },
            companySnapshot: { ...LOCKED_COMPANY_DETAILS },
            validityDays: 15,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as any}
          onClose={() => setQuoteLead(null)}
          onSuccess={() => {
            updateLeadStage(quoteLead.id, 'QUOTATION_SENT');
            setQuoteLead(null);
          }}
        />
      )}
    </div>
  );
}
