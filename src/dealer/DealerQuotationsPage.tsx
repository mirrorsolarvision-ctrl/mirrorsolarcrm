import { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Sparkles, 
  Sun, 
  ShieldCheck, 
  AlertTriangle, 
  Send,
  Eye,
  X,
  Zap,
  Info,
  Layers,
  IndianRupee,
  User
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import type { Quotation, QuotationStatus, ApprovedProduct } from '../context/CRMContext';
import logoUrl from '../assets/mirrorsolarlogo.png';
import './DealerQuotationsPage.css';

export default function DealerQuotationsPage() {
  const { leads, currentUser, approvedProducts, quotations, createQuotation, updateQuotationStatus } = useCRM();
  const { showToast } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  // Form State
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customPanelCount, setCustomPanelCount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [quotationNotes, setQuotationNotes] = useState('');

  // Strict isolation: Leads belonging ONLY to this dealer
  const dealerLeads = useMemo(() => {
    if (!currentUser) return [];
    return leads.filter(l => l.dealer === currentUser.name && !l.archived);
  }, [leads, currentUser]);

  // Strict isolation: Quotations belonging ONLY to this dealer
  const dealerQuotations = useMemo(() => {
    if (!currentUser) return [];
    return quotations.filter(q => q.dealerId === currentUser.id);
  }, [quotations, currentUser]);

  const filteredQuotations = useMemo(() => {
    return dealerQuotations.filter(q => {
      const matchesSearch = 
        q.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.customerPhone.includes(searchQuery);

      const matchesStatus = statusFilter === 'All' || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [dealerQuotations, searchQuery, statusFilter]);

  // Selected Lead Object
  const currentLead = useMemo(() => {
    return dealerLeads.find(l => l.id === selectedLeadId);
  }, [dealerLeads, selectedLeadId]);

  // Selected Product Object
  const currentProduct = useMemo(() => {
    return approvedProducts.find(p => p.id === selectedProductId);
  }, [approvedProducts, selectedProductId]);

  // When product changes, reset defaults
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = approvedProducts.find(p => p.id === prodId);
    if (prod) {
      setCustomPanelCount(prod.defaultPanelCount);
      setDiscountAmount(0);
    }
  };

  // Pricing calculations
  const basePrice = currentProduct?.customerPrice || 0;
  const maxDiscount = currentProduct?.maxAllowedDiscount || 0;
  const effectiveDiscount = Math.min(Math.max(0, discountAmount), maxDiscount);
  const finalAmount = Math.max(0, basePrice - effectiveDiscount);
  const subsidyEstimate = currentProduct?.subsidyEstimate || 0;
  const netCustomerCost = Math.max(0, finalAmount - subsidyEstimate);

  const handleOpenCreateModal = () => {
    setSelectedLeadId(dealerLeads[0]?.id || '');
    if (approvedProducts[0]) {
      handleProductChange(approvedProducts[0].id);
    }
    setDiscountAmount(0);
    setValidityDays(30);
    setQuotationNotes('');
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLead) {
      showToast('Please select a customer lead', 'warning');
      return;
    }
    if (!currentProduct) {
      showToast('Please select a solar package', 'warning');
      return;
    }
    if (!currentUser) return;

    if (discountAmount > maxDiscount) {
      showToast(`Discount cannot exceed maximum allowed ₹${maxDiscount.toLocaleString('en-IN')}`, 'error');
      return;
    }

    try {
      const newQuote = await createQuotation({
        dealerId: currentUser.id,
        dealerName: currentUser.name,
        leadId: currentLead.id,
        customerName: currentLead.customer,
        customerPhone: currentLead.phone,
        customerAddress: currentLead.location,
        productId: currentProduct.id,
        productName: currentProduct.name,
        systemSizeKw: currentProduct.systemSizeKw,
        panelType: currentProduct.panelType,
        panelQuantity: customPanelCount || currentProduct.defaultPanelCount,
        inverterType: currentProduct.inverterType,
        structureType: currentProduct.structureType,
        basePriceAtCreation: basePrice,
        discount: effectiveDiscount,
        finalAmount: finalAmount,
        subsidyEstimateAtCreation: subsidyEstimate,
        netCustomerCost: netCustomerCost,
        validityDays: validityDays || 30,
        notes: quotationNotes,
        status: 'Draft',
        createdBy: currentUser.id,
        createdByName: currentUser.name
      });

      showToast(`Quotation ${newQuote.quotationNumber} created successfully!`, 'success');
      setIsCreateModalOpen(false);
      setSelectedQuotation(newQuote);
    } catch (err) {
      showToast('Failed to generate quotation', 'error');
    }
  };

  const handleUpdateStatus = async (quoteId: string, newStatus: QuotationStatus) => {
    try {
      await updateQuotationStatus(quoteId, newStatus);
      showToast(`Quotation status updated to ${newStatus}`, 'success');
      if (selectedQuotation && selectedQuotation.id === quoteId) {
        setSelectedQuotation({ ...selectedQuotation, status: newStatus });
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="dealer-quotations-container">
      {/* Header */}
      <div className="quotations-header">
        <div>
          <h1 className="page-title">Customer Quotations</h1>
          <p className="page-subtitle">Generate and share solar installation quotations for your customer leads</p>
        </div>

        <button className="create-quote-btn" onClick={handleOpenCreateModal}>
          <Plus size={18} />
          <span>Generate New Quotation</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="quotes-metrics-grid">
        <div className="quote-metric-card">
          <div className="metric-icon-box icon-blue">
            <FileText size={20} />
          </div>
          <div>
            <span className="metric-val">{dealerQuotations.length}</span>
            <span className="metric-lbl">Total Quotations</span>
          </div>
        </div>

        <div className="quote-metric-card">
          <div className="metric-icon-box icon-purple">
            <Send size={20} />
          </div>
          <div>
            <span className="metric-val">{dealerQuotations.filter(q => q.status === 'Sent').length}</span>
            <span className="metric-lbl">Sent to Customers</span>
          </div>
        </div>

        <div className="quote-metric-card">
          <div className="metric-icon-box icon-emerald">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="metric-val">{dealerQuotations.filter(q => q.status === 'Accepted').length}</span>
            <span className="metric-lbl">Accepted / Closed</span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="quotes-filter-bar">
        <div className="quotes-search-input">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by quote #, customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="quotes-status-tabs">
          {['All', 'Draft', 'Sent', 'Accepted', 'Rejected'].map(status => (
            <button
              key={status}
              className={`status-tab-btn ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="quotes-table-card">
        {filteredQuotations.length === 0 ? (
          <div className="empty-quotes-state">
            <FileText size={44} className="empty-icon" />
            <h3>No quotations found</h3>
            <p>
              {dealerQuotations.length === 0
                ? "You haven't generated any quotations yet. Click 'Generate New Quotation' to get started."
                : "No quotations match the active filter criteria."}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="quotes-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Customer</th>
                  <th>Solar System</th>
                  <th>Final Amount</th>
                  <th>Subsidy Est.</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map(q => (
                  <tr key={q.id}>
                    <td>
                      <span className="quote-num-tag">{q.quotationNumber}</span>
                      <span className="quote-date-sub">{new Date(q.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-name">{q.customerName}</span>
                        <span className="customer-phone">{q.customerPhone}</span>
                      </div>
                    </td>
                    <td>
                      <div className="system-cell">
                        <span className="system-name">{q.productName}</span>
                        <span className="system-specs">{q.systemSizeKw} kW • {q.panelQuantity} Panels</span>
                      </div>
                    </td>
                    <td>
                      <span className="price-bold">₹{q.finalAmount.toLocaleString('en-IN')}</span>
                      {q.discount > 0 && (
                        <span className="discount-sub">-₹{q.discount.toLocaleString('en-IN')} off</span>
                      )}
                    </td>
                    <td>
                      {q.subsidyEstimateAtCreation > 0 ? (
                        <span className="subsidy-tag">₹{q.subsidyEstimateAtCreation.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge badge-${q.status.toLowerCase()}`}>
                        {q.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn-view-quote"
                        onClick={() => setSelectedQuotation(q)}
                        title="View / Print Quotation"
                      >
                        <Eye size={15} />
                        <span>View Quote</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Quotation Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-card modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <FileText size={22} className="text-blue" />
                <h3>Generate Customer Solar Quotation</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              {/* Step 1: Select Lead */}
              <div className="form-group">
                <label className="section-label">1. Select Customer Lead *</label>
                {dealerLeads.length === 0 ? (
                  <div className="alert-warning-box">
                    <AlertTriangle size={16} />
                    <span>No leads available. Please add a lead first in My Leads.</span>
                  </div>
                ) : (
                  <select 
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    required
                  >
                    {dealerLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.customer} ({l.phone}) — {l.location}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Step 2: Select Solar System Package */}
              <div className="form-group">
                <label className="section-label">2. Select Approved Solar Package *</label>
                <div className="packages-select-grid">
                  {approvedProducts.map(prod => (
                    <div 
                      key={prod.id}
                      className={`package-card ${selectedProductId === prod.id ? 'selected' : ''}`}
                      onClick={() => handleProductChange(prod.id)}
                    >
                      <div className="pkg-header">
                        <span className="pkg-name">{prod.name}</span>
                        <span className="pkg-price">₹{prod.customerPrice.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="pkg-specs-list">
                        <span>⚡ {prod.systemSizeKw} kW System</span>
                        <span>☀️ {prod.panelType}</span>
                        <span>🔌 {prod.inverterType}</span>
                      </div>
                      {prod.subsidyEstimate > 0 && (
                        <div className="pkg-subsidy-badge">
                          PM Surya Ghar: ₹{prod.subsidyEstimate.toLocaleString('en-IN')} Subsidy
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Commercial & Discount Configuration */}
              {currentProduct && (
                <div className="pricing-config-card">
                  <h4 className="config-title">Commercial Summary & Discounts</h4>
                  
                  <div className="pricing-grid-inputs">
                    <div className="input-group">
                      <label>Standard Package Price</label>
                      <input 
                        type="text" 
                        disabled 
                        value={`₹${basePrice.toLocaleString('en-IN')}`}
                        className="input-disabled"
                      />
                    </div>

                    <div className="input-group">
                      <label>
                        Dealer Discount (Max: ₹{maxDiscount.toLocaleString('en-IN')})
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        max={maxDiscount}
                        value={discountAmount || ''}
                        placeholder="0"
                        onChange={(e) => setDiscountAmount(Number(e.target.value))}
                      />
                    </div>

                    <div className="input-group">
                      <label>Quote Validity</label>
                      <select 
                        value={validityDays}
                        onChange={(e) => setValidityDays(Number(e.target.value))}
                      >
                        <option value={15}>15 Days</option>
                        <option value={30}>30 Days</option>
                        <option value={45}>45 Days</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculations Live Breakdown */}
                  <div className="calc-breakdown-box">
                    <div className="calc-row">
                      <span>Package Base Price:</span>
                      <span>₹{basePrice.toLocaleString('en-IN')}</span>
                    </div>
                    {effectiveDiscount > 0 && (
                      <div className="calc-row text-discount">
                        <span>Dealer Applied Discount:</span>
                        <span>- ₹{effectiveDiscount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="calc-row row-total">
                      <span>Customer Quotation Price:</span>
                      <span>₹{finalAmount.toLocaleString('en-IN')}</span>
                    </div>

                    {subsidyEstimate > 0 && (
                      <div className="calc-row row-subsidy">
                        <span>PM Surya Ghar Estimated Subsidy:</span>
                        <span>- ₹{subsidyEstimate.toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="calc-row row-net">
                      <span>Estimated Effective Cost:</span>
                      <span>₹{netCustomerCost.toLocaleString('en-IN')}</span>
                    </div>
                    <span className="subsidy-disclaimer-note">
                      * Estimated subsidy — subject to applicable government eligibility and approval.
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="form-group">
                <label>Special Terms / Remarks (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Includes 5-year inverter warranty and net-metering liaison"
                  value={quotationNotes}
                  onChange={(e) => setQuotationNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={dealerLeads.length === 0}>
                  Generate Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View & Print Quotation Modal */}
      {selectedQuotation && (
        <div className="modal-overlay" onClick={() => setSelectedQuotation(null)}>
          <div className="modal-card quote-view-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header no-print">
              <div className="modal-title-wrap">
                <FileText size={20} className="text-blue" />
                <h3>Quotation: {selectedQuotation.quotationNumber}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedQuotation(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Printable Sheet View */}
            <div className="quotation-print-sheet" id="printable-quote">
              {/* Sheet Header */}
              <div className="sheet-header">
                <div className="brand-stack">
                  <img src={logoUrl} alt="Mirror Solar" className="sheet-logo" />
                  <div>
                    <h2 className="company-title">MIRROR SOLAR CRM</h2>
                    <span className="dealership-title">Authorized Dealer: {selectedQuotation.dealerName}</span>
                  </div>
                </div>
                <div className="quote-id-stack">
                  <span className="quote-badge-num">{selectedQuotation.quotationNumber}</span>
                  <span className="quote-date-line">
                    Date: {new Date(selectedQuotation.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="quote-validity-line">
                    Valid for: {selectedQuotation.validityDays} Days
                  </span>
                </div>
              </div>

              <div className="sheet-divider"></div>

              {/* Customer & Dealer Info Row */}
              <div className="sheet-parties-grid">
                <div className="party-box">
                  <h4 className="party-title">QUOTATION PREPARED FOR:</h4>
                  <div className="party-details">
                    <strong>{selectedQuotation.customerName}</strong>
                    <span>📞 {selectedQuotation.customerPhone}</span>
                    {selectedQuotation.customerAddress && <span>📍 {selectedQuotation.customerAddress}</span>}
                  </div>
                </div>

                <div className="party-box">
                  <h4 className="party-title">OFFICIAL DEALERSHIP:</h4>
                  <div className="party-details">
                    <strong>{selectedQuotation.dealerName}</strong>
                    <span>Representative: {selectedQuotation.createdByName || 'Dealer Staff'}</span>
                    <span className="verified-stamp">✓ Verified Quotation</span>
                  </div>
                </div>
              </div>

              {/* Technical Specifications Table */}
              <div className="sheet-section">
                <h4 className="sheet-sec-title">1. System Specifications</h4>
                <table className="sheet-specs-table">
                  <tbody>
                    <tr>
                      <td className="spec-label">System Capacity</td>
                      <td className="spec-val"><strong>{selectedQuotation.systemSizeKw} kW Rooftop Solar Power Plant</strong></td>
                    </tr>
                    <tr>
                      <td className="spec-label">Solar Modules</td>
                      <td className="spec-val">{selectedQuotation.panelQuantity}x {selectedQuotation.panelType}</td>
                    </tr>
                    <tr>
                      <td className="spec-label">Solar Inverter</td>
                      <td className="spec-val">{selectedQuotation.inverterType}</td>
                    </tr>
                    <tr>
                      <td className="spec-label">Mounting Structure</td>
                      <td className="spec-val">{selectedQuotation.structureType}</td>
                    </tr>
                    {selectedQuotation.notes && (
                      <tr>
                        <td className="spec-label">Special Remarks</td>
                        <td className="spec-val">{selectedQuotation.notes}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Commercial Cost Breakdown */}
              <div className="sheet-section">
                <h4 className="sheet-sec-title">2. Commercial Price Summary</h4>
                <table className="sheet-pricing-table">
                  <tbody>
                    <tr>
                      <td>System Package Price</td>
                      <td className="text-right">₹{selectedQuotation.basePriceAtCreation.toLocaleString('en-IN')}</td>
                    </tr>
                    {selectedQuotation.discount > 0 && (
                      <tr className="row-discount-text">
                        <td>Special Dealership Discount</td>
                        <td className="text-right">- ₹{selectedQuotation.discount.toLocaleString('en-IN')}</td>
                      </tr>
                    )}
                    <tr className="row-total-bold">
                      <td>Customer Net Price (Incl. GST & Installation)</td>
                      <td className="text-right price-highlight">₹{selectedQuotation.finalAmount.toLocaleString('en-IN')}</td>
                    </tr>
                    {selectedQuotation.subsidyEstimateAtCreation > 0 && (
                      <tr className="row-subsidy-text">
                        <td>PM Surya Ghar Direct Subsidy Benefit (Eligible)</td>
                        <td className="text-right">- ₹{selectedQuotation.subsidyEstimateAtCreation.toLocaleString('en-IN')}</td>
                      </tr>
                    )}
                    <tr className="row-effective-bold">
                      <td>Estimated Effective Investment for Customer</td>
                      <td className="text-right price-effective">₹{selectedQuotation.netCustomerCost.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="sheet-subsidy-disclaimer">
                  * Disclaimer: Direct subsidy is deposited into the customer's bank account directly by the Ministry of New & Renewable Energy (MNRE) post grid-synchronization and inspection under PM Surya Ghar Muft Bijli Yojana.
                </p>
              </div>

              {/* Terms & Signature */}
              <div className="sheet-footer-signatures">
                <div className="terms-col">
                  <h5>Standard Terms:</h5>
                  <ul>
                    <li>Quote valid for {selectedQuotation.validityDays} days from date of issue.</li>
                    <li>Includes complete liaison support for DISCOM approvals.</li>
                  </ul>
                </div>
                <div className="sig-col">
                  <div className="sig-line"></div>
                  <span>Authorized Dealer Signature</span>
                  <small>{selectedQuotation.dealerName}</small>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions-bar no-print">
              <div className="status-change-buttons">
                <span className="status-label">Update Status:</span>
                {(['Draft', 'Sent', 'Accepted', 'Rejected'] as QuotationStatus[]).map(st => (
                  <button 
                    key={st}
                    className={`btn-status-toggle ${selectedQuotation.status === st ? 'active' : ''}`}
                    onClick={() => handleUpdateStatus(selectedQuotation.id, st)}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="right-action-buttons">
                <button className="btn-print" onClick={handlePrint}>
                  <Printer size={16} />
                  <span>Print / Save PDF</span>
                </button>
                <button className="btn-cancel" onClick={() => setSelectedQuotation(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
