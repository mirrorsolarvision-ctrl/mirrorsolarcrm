import React, { useState, useMemo } from 'react';
import { 
  FileText, Plus, Search, Filter, Download, Share2, Printer, 
  Copy, Edit3, Trash2, CheckCircle2, AlertCircle, Eye, RefreshCw,
  Clock, CheckCircle, XCircle, ArrowRight, User, Shield, Lock, Layers, Zap
} from 'lucide-react';
import { useQuotations } from '../context/QuotationContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import type { Quotation, QuotationStatus } from '../types/quotation';
import QuotationEditor from '../components/QuotationEditor';
import './QuotationsPortalPage.css';

export default function QuotationsPortalPage() {
  const { myQuotations, amendQuotation, duplicateQuotation, cancelQuotation, finalizeQuotation, updateQuotationStatus } = useQuotations();
  const { currentUser } = useAuth();
  const { showToast, showConfirmModal } = useUI();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  
  // Editor & Preview Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [selectedLeadIdForNew, setSelectedLeadIdForNew] = useState<string | undefined>(undefined);
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);

  // Filtered list
  const filteredQuotations = useMemo(() => {
    return myQuotations.filter((q) => {
      const query = searchQuery.toLowerCase().trim();
      if (query && !(
        q.quotationNumber.toLowerCase().includes(query) ||
        q.customer.customerName.toLowerCase().includes(query) ||
        q.customer.mobileNumber.includes(query) ||
        (q.dealerName && q.dealerName.toLowerCase().includes(query))
      )) return false;

      if (statusFilter !== 'All' && q.status !== statusFilter) return false;
      return true;
    });
  }, [myQuotations, searchQuery, statusFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = myQuotations.length;
    const drafts = myQuotations.filter((q) => q.status === 'Draft').length;
    const sent = myQuotations.filter((q) => q.status === 'Sent').length;
    const accepted = myQuotations.filter((q) => q.status === 'Accepted' || q.status === 'Converted').length;
    const totalValue = myQuotations.reduce((sum, q) => sum + q.financials.grandTotal, 0);
    const totalSubsidy = myQuotations.reduce((sum, q) => sum + (q.financials.subsidyAmount || 0), 0);

    return { total, drafts, sent, accepted, totalValue, totalSubsidy };
  }, [myQuotations]);

  const handleOpenNew = (leadId?: string) => {
    setEditingQuotation(null);
    setSelectedLeadIdForNew(leadId);
    setIsEditorOpen(true);
  };

  const handleEdit = (q: Quotation) => {
    setEditingQuotation(q);
    setIsEditorOpen(true);
  };

  const handleAmend = async (q: Quotation) => {
    showConfirmModal(
      `Amend Quotation ${q.quotationNumber}?`,
      `This will create version V${q.version + 1} as an editable draft. Original version V${q.version} will be preserved in history.`,
      async () => {
        try {
          const amended = await amendQuotation(q.id, 'Customer requested commercial revisions');
          showToast(`Created version V${amended.version} draft!`, 'success');
          handleEdit(amended);
        } catch (err: any) {
          showToast(err.message || 'Failed to amend quotation', 'error');
        }
      }
    );
  };

  const handleDuplicate = async (q: Quotation) => {
    try {
      const dup = await duplicateQuotation(q.id);
      showToast(`Duplicated as draft ${dup.quotationNumber}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate quotation', 'error');
    }
  };

  const handleCancel = (q: Quotation) => {
    showConfirmModal(
      `Cancel Quotation ${q.quotationNumber}?`,
      'This will mark the quotation as Cancelled.',
      async () => {
        await cancelQuotation(q.id, 'Cancelled by user');
        showToast('Quotation cancelled', 'info');
      }
    );
  };

  const handleShareWhatsApp = (q: Quotation) => {
    const text = `*SOLAR PROPOSAL — ${q.companySnapshot.name}*\n` +
      `Quotation No: ${q.quotationNumber}\n` +
      `Customer: ${q.customer.customerName}\n` +
      `System: ${q.project.systemCapacityKw} kW (${q.project.plantType})\n` +
      `Grand Total: ₹${q.financials.grandTotal.toLocaleString('en-IN')}\n` +
      (q.financials.subsidyAmount > 0 ? `PM Surya Ghar Subsidy: ₹${q.financials.subsidyAmount.toLocaleString('en-IN')}\n` : '') +
      `*Net Payable: ₹${q.financials.netPayableByCustomer.toLocaleString('en-IN')}*\n\n` +
      `Validity: ${q.validityDays} Days.\nContact: ${q.companySnapshot.phone}`;
    window.open(`https://api.whatsapp.com/send?phone=91${q.customer.mobileNumber}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="quotations-portal-page">
      {/* Top Header */}
      <div className="qp-header">
        <div>
          <div className="qp-breadcrumb">Dashboard / Quotations</div>
          <div className="qp-title-row">
            <h1>Commercial Quotation Engine</h1>
            <span className="qp-role-badge">
              <Shield size={13} /> {currentUser?.role} Workspace
            </span>
          </div>
          <p className="qp-sub">Create, amend, calculate PM Surya Ghar subsidies, and print bill-book proposals.</p>
        </div>
        <button className="btn-primary qp-create-btn" onClick={() => handleOpenNew()}>
          <Plus size={18} /> New Quotation
        </button>
      </div>

      {/* Summary Stat Grid */}
      <div className="qp-stats-grid">
        <div className="qp-stat-card">
          <div className="qp-stat-icon navy"><FileText size={20} /></div>
          <div className="qp-stat-info">
            <span className="qp-stat-label">Total Quotations</span>
            <span className="qp-stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="qp-stat-card">
          <div className="qp-stat-icon yellow"><Clock size={20} /></div>
          <div className="qp-stat-info">
            <span className="qp-stat-label">Drafts & Sent</span>
            <span className="qp-stat-value">{stats.drafts + stats.sent}</span>
          </div>
        </div>
        <div className="qp-stat-card">
          <div className="qp-stat-icon success"><CheckCircle size={20} /></div>
          <div className="qp-stat-info">
            <span className="qp-stat-label">Accepted / Converted</span>
            <span className="qp-stat-value">{stats.accepted}</span>
          </div>
        </div>
        <div className="qp-stat-card">
          <div className="qp-stat-icon orange"><Zap size={20} /></div>
          <div className="qp-stat-info">
            <span className="qp-stat-label">Total Pipeline Value</span>
            <span className="qp-stat-value">₹{(stats.totalValue / 100000).toFixed(2)} L</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="qp-main-panel">
        <div className="qp-toolbar">
          <div className="qp-search-box">
            <Search size={16} color="#64748B" />
            <input 
              type="text" 
              placeholder="Search by quote #, customer name, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="qp-filter-select" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Converted">Converted to Project</option>
            <option value="Amended">Amended (Historical)</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="qp-table-wrapper">
          <table className="qp-table">
            <thead>
              <tr>
                <th>QUOTATION #</th>
                <th>CUSTOMER</th>
                <th>CAPACITY</th>
                <th>SUBTOTAL</th>
                <th>SUBSIDY</th>
                <th>NET PAYABLE</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th style={{ textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((q) => (
                <tr key={q.id} className={q.status === 'Cancelled' ? 'row-cancelled' : ''}>
                  <td>
                    <div className="qp-qnum-cell">
                      <span className="qp-qnum">{q.quotationNumber}</span>
                      {q.version > 1 && <span className="qp-ver-tag">V{q.version}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="qp-cust-cell">
                      <span className="qp-cust-name">{q.customer.customerName}</span>
                      <span className="qp-cust-phone">{q.customer.mobileNumber} • {q.customer.city}</span>
                    </div>
                  </td>
                  <td>
                    <span className="qp-cap-badge">{q.project.systemCapacityKw} kW</span>
                    <span className="qp-plant-type">{q.project.plantType}</span>
                  </td>
                  <td className="font-semibold">₹{q.financials.subtotal.toLocaleString('en-IN')}</td>
                  <td>
                    {q.financials.subsidyAmount > 0 ? (
                      <span className="qp-subsidy-val">-₹{q.financials.subsidyAmount.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="qp-payable-cell">
                    ₹{q.financials.netPayableByCustomer.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className={`qp-status-pill status-${q.status.toLowerCase()}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="text-muted text-sm">
                    {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <div className="qp-actions-row">
                      {q.status === 'Draft' ? (
                        <button className="qp-btn-act" title="Edit Draft" onClick={() => handleEdit(q)}>
                          <Edit3 size={14} />
                        </button>
                      ) : (
                        <button className="qp-btn-act" title="Amend (Create V2)" onClick={() => handleAmend(q)}>
                          <Layers size={14} />
                        </button>
                      )}
                      <button className="qp-btn-act" title="Share via WhatsApp" onClick={() => handleShareWhatsApp(q)}>
                        <Share2 size={14} />
                      </button>
                      <button className="qp-btn-act" title="Duplicate" onClick={() => handleDuplicate(q)}>
                        <Copy size={14} />
                      </button>
                      {q.status === 'Draft' && (
                        <button className="qp-btn-act danger" title="Cancel" onClick={() => handleCancel(q)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="qp-empty">
                      <FileText size={48} />
                      <h4>No Quotations Found</h4>
                      <p>Create a new quotation attached to a lead or walk-in customer.</p>
                      <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => handleOpenNew()}>
                        <Plus size={16} /> Create First Quotation
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full-Screen Bill-Book Quotation Editor Modal */}
      {isEditorOpen && (
        <QuotationEditor 
          initialQuotation={editingQuotation}
          initialLeadId={selectedLeadIdForNew}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
}
