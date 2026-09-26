import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Copy, ArrowDown, ArrowUp, Lock, CheckCircle2, 
  FileText, Calculator, Share2, Download, Printer, AlertCircle, 
  User, Zap, Sparkles, CreditCard, X, Eye, Check, ClipboardCopy,
  ShieldCheck, Building2, Phone, Mail, FileSpreadsheet
} from 'lucide-react';
import type { 
  Quotation, QuotationItem, QuotationCustomerDetails, 
  QuotationProjectDetails, CustomerType, PlantType, PhaseType, RoofType, StructureType 
} from '../types/quotation';
import { LOCKED_COMPANY_DETAILS } from '../config/companyDetails';
import { 
  recalculateLineItem, 
  calculateQuotationFinancials, 
  generateRecommendedBOM 
} from '../utils/quotationCalculations';
import { useQuotations } from '../context/QuotationContext';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import logoUrl from '../assets/mirrorsolarlogo.png';
import './QuotationEditor.css';

interface QuotationEditorProps {
  initialQuotation?: Quotation | null;
  initialLeadId?: string;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
}

export default function QuotationEditor({ initialQuotation, initialLeadId, onClose, onSuccess }: QuotationEditorProps) {
  const { createQuotation, updateQuotationDraft, finalizeQuotation } = useQuotations();
  const { leads } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  // Mode: Existing Lead vs New Lead
  const [mode, setMode] = useState<'existing' | 'new'>(initialLeadId || initialQuotation?.leadId ? 'existing' : 'new');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || initialQuotation?.leadId || '');


  // Customer Details Form
  const [customer, setCustomer] = useState<QuotationCustomerDetails>({
    customerName: initialQuotation?.customer.customerName || '',
    mobileNumber: initialQuotation?.customer.mobileNumber || '',
    alternateNumber: initialQuotation?.customer.alternateNumber || '',
    email: initialQuotation?.customer.email || '',
    address: initialQuotation?.customer.address || '',
    city: initialQuotation?.customer.city || 'Hyderabad',
    district: initialQuotation?.customer.district || '',
    state: initialQuotation?.customer.state || 'Telangana',
    pinCode: initialQuotation?.customer.pinCode || '',
    siteAddress: initialQuotation?.customer.siteAddress || '',
    installationAddress: initialQuotation?.customer.installationAddress || '',
    customerType: initialQuotation?.customer.customerType || 'Residential',
    gstin: initialQuotation?.customer.gstin || ''
  });

  // Project Details Form with exact 3 Structure Types
  const [project, setProject] = useState<QuotationProjectDetails>({
    systemCapacityKw: initialQuotation?.project.systemCapacityKw || 3,
    plantType: initialQuotation?.project.plantType || 'On-Grid',
    phaseType: initialQuotation?.project.phaseType || 'Single Phase',
    roofType: initialQuotation?.project.roofType || 'RCC Flat Roof',
    structureType: initialQuotation?.project.structureType || 'Hot Dip Company Structure',
    frontLegHeight: initialQuotation?.project.frontLegHeight || '4 ft',
    rearLegHeight: initialQuotation?.project.rearLegHeight || '7 ft',
    singleTotalPrice: initialQuotation?.project?.singleTotalPrice || initialQuotation?.financials?.grandTotal || 195000,
    sanctionedLoadKw: initialQuotation?.project?.sanctionedLoadKw || 3,
    discomName: initialQuotation?.project?.discomName || 'TSSPDCL',
    consumerNumber: initialQuotation?.project?.consumerNumber || '',
    serviceNumber: initialQuotation?.project?.serviceNumber || ''
  });

  // Items State (No individual prices shown on quotation)
  const [items, setItems] = useState<QuotationItem[]>(() => {
    if (initialQuotation && initialQuotation.items.length > 0) {
      return initialQuotation.items.map(recalculateLineItem);
    }
    return generateRecommendedBOM(3, 550, 'Single Phase', false);
  });

  // Financial Options
  const [isSubsidyEligible, setIsSubsidyEligible] = useState<boolean>(
    initialQuotation?.financials.subsidyEligible !== undefined ? initialQuotation.financials.subsidyEligible : true
  );
  const [isInterState, setIsInterState] = useState<boolean>(
    (initialQuotation?.financials.igst || 0) > 0
  );
  const [notes, setNotes] = useState<string>(initialQuotation?.notes || 'Comprehensive 5-Year Maintenance and 25-Year Panel Performance Warranty Included.');
  const [validityDays, setValidityDays] = useState<number>(initialQuotation?.validityDays || 15);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-populate when selecting an existing lead
  useEffect(() => {
    if (mode === 'existing' && selectedLeadId) {
      const lead = leads.find((l) => l.id === selectedLeadId);
      if (lead) {
        setCustomer((prev) => ({
          ...prev,
          customerName: lead.customer || prev.customerName,
          mobileNumber: lead.phone || prev.mobileNumber,
          email: lead.email || prev.email,
          address: lead.location || prev.address,
          city: lead.location ? lead.location.split(',')[0].trim() : prev.city
        }));
      }
    }
  }, [selectedLeadId, mode, leads]);

  // Dynamic Live Financial Calculation: Single Total Price with 5% GST Included Every Time
  const singlePackagePrice = Number(project.singleTotalPrice) > 0 ? Number(project.singleTotalPrice) : 195000;
  const financials = calculateQuotationFinancials(
    items,
    0,
    isSubsidyEligible,
    project.systemCapacityKw,
    customer.customerType,
    isInterState,
    undefined,
    singlePackagePrice
  );

  // Line Item Handlers (Description, Brand, Qty, Unit only)
  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };
      updated[index] = recalculateLineItem(target);
      return updated;
    });
  };

  const handleAddItem = (category: QuotationItem['category'] = 'Custom Item') => {
    const newItem: QuotationItem = {
      id: `item-custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category,
      name: category === 'Custom Item' ? 'Additional Service / Accessory' : `${category} Unit`,
      brand: 'Standard / Tier-1 Certified',
      model: '',
      quantity: 1,
      unit: 'Nos',
      unitRate: 0,
      discount: 0,
      taxRatePercent: 5,
      taxAmount: 0,
      total: 0
    };
    setItems((prev) => [...prev, recalculateLineItem(newItem)]);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      showToast('Quotation must contain at least one item', 'warning');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDuplicateItem = (index: number) => {
    const target = items[index];
    const duplicate: QuotationItem = {
      ...target,
      id: `item-dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${target.name} (Copy)`
    };
    setItems((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) return;
    setItems((prev) => {
      const next = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      const [moved] = next.splice(index, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  // Auto-Regenerate from Solar Estimator
  const handleAutoEstimate = () => {
    showConfirmModal(
      'Regenerate Recommended Equipment?',
      `This will generate standard solar equipment for ${project.systemCapacityKw} kW (${project.phaseType}).`,
      () => {
        const bom = generateRecommendedBOM(
          project.systemCapacityKw,
          550,
          project.phaseType,
          project.plantType === 'Hybrid' || project.plantType === 'Off-Grid'
        );
        setItems(bom);
        showToast('Generated recommended solar equipment list!', 'success');
      }
    );
  };

  // Submit & Save
  const handleSave = async (finalize: boolean = false) => {
    if (!customer.customerName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }
    if (!customer.mobileNumber.trim()) {
      showToast('Please enter customer mobile number', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialQuotation && initialQuotation.status === 'Draft') {
        await updateQuotationDraft(initialQuotation.id, {
          customer,
          project,
          items,
          extraDiscount: 0,
          isSubsidyEligible,
          notes,
          validityDays
        });
        if (finalize) {
          await finalizeQuotation(initialQuotation.id);
          showToast('Quotation finalized successfully!', 'success');
        } else {
          showToast('Quotation draft saved!', 'success');
        }
        if (onSuccess) onSuccess({ ...initialQuotation, customer, project, items, financials });
      } else {
        const created = await createQuotation({
          customer,
          project,
          items,
          extraDiscount: 0,
          isSubsidyEligible,
          leadId: mode === 'existing' ? selectedLeadId : undefined,
          notes,
          validityDays
        });
        if (finalize) {
          await finalizeQuotation(created.id);
          showToast('Quotation created and finalized!', 'success');
        } else {
          showToast('Quotation draft created successfully!', 'success');
        }
        if (onSuccess) onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save quotation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build Comprehensive WhatsApp Message
  const getWhatsAppMessage = () => {
    let msg = `*MIRROR SOLAR VISION — SOLAR PROPOSAL*\n` +
      `===================================\n` +
      `*Quotation No:* ${initialQuotation?.quotationNumber || 'PROPOSAL'}\n` +
      `*Customer:* ${customer.customerName}\n` +
      `*Mobile:* ${customer.mobileNumber}\n` +
      `*Location:* ${customer.address ? customer.address + ', ' : ''}${customer.city}\n` +
      `-----------------------------------\n` +
      `*PROJECT SPECIFICATIONS:*\n` +
      `• Plant Capacity: ${project.systemCapacityKw} kW (${project.plantType})\n` +
      `• Grid Phase: ${project.phaseType}\n` +
      `• Structure Type: ${project.structureType || 'Hot Dip Company Structure'}\n`;

    if (project.structureType === 'Hot Dip Company Structure') {
      msg += `• Front Leg Height: ${project.frontLegHeight || '4 ft'}\n` +
             `• Rear Leg Height: ${project.rearLegHeight || '7 ft'}\n`;
    }

    if (project.discomName) {
      msg += `• Electricity Board: ${project.discomName}\n`;
    }
    if (project.consumerNumber) {
      msg += `• Service Connection No: ${project.consumerNumber}\n`;
    }

    msg += `-----------------------------------\n` +
      `*EQUIPMENT SPECIFICATIONS:*\n`;

    items.forEach((it, idx) => {
      msg += `${idx + 1}. ${it.name} (${it.brand || 'Tier-1'}) — Qty: ${it.quantity} ${it.unit}\n`;
    });

    msg += `-----------------------------------\n` +
      `*COMMERCIAL PROPOSAL:*\n` +
      `• *Total Package Price: ₹${financials.grandTotal.toLocaleString('en-IN')}*\n` +
      `  (Single Total Price, Includes 5% GST: ₹${financials.gstTotal.toLocaleString('en-IN')})\n` +
      `  Taxable Amount: ₹${financials.taxableAmount.toLocaleString('en-IN')}\n\n` +
      `• *PM Surya Ghar Subsidy: ₹78,000/-*\n` +
      `  (Govt. Central Subsidy reimbursed directly into customer bank account via DBT; not deducted from company invoice)\n\n` +
      `• *Net Payable to Mirror Solar: ₹${financials.grandTotal.toLocaleString('en-IN')}*\n` +
      `-----------------------------------\n` +
      `*BANK SETTLEMENT DETAILS:*\n` +
      `• A/c Name: ${LOCKED_COMPANY_DETAILS.bankDetails.accountName}\n` +
      `• Bank: ${LOCKED_COMPANY_DETAILS.bankDetails.bankName}\n` +
      `• A/c No: ${LOCKED_COMPANY_DETAILS.bankDetails.accountNumber}\n` +
      `• IFSC: ${LOCKED_COMPANY_DETAILS.bankDetails.ifscCode}\n` +
      `• Branch: ${LOCKED_COMPANY_DETAILS.bankDetails.branch}\n` +
      `-----------------------------------\n` +
      `*Validity:* ${validityDays} Calendar Days\n` +
      `*Contact:* ${LOCKED_COMPANY_DETAILS.phone} | ${LOCKED_COMPANY_DETAILS.email}\n` +
      `*Mirror Solar Vision*`;

    return msg;
  };

  const handleShareWhatsApp = () => {
    const text = getWhatsAppMessage();
    const cleanPhone = customer.mobileNumber.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="quotation-modal-overlay">
      <div className="quotation-editor-modal">
        {/* Compact Sticky Top Action Bar - Minimal Height & Sleek */}
        <div className="qe-compact-topbar">
          <div className="qe-topbar-left">
            <div className="qe-topbar-icon">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="qe-topbar-title">
                {initialQuotation ? `Edit Quotation (${initialQuotation.quotationNumber})` : 'New Quotation'}
              </h2>
              <span className="qe-topbar-sub">Official Mirror Solar Bill-Book Engine • Turnkey Proposal</span>
            </div>
          </div>

          <div className="qe-topbar-actions">
            <button 
              type="button" 
              className="btn-hero-secondary qe-whatsapp-btn" 
              onClick={handleShareWhatsApp}
              title="Share quotation proposal directly on WhatsApp"
            >
              <Share2 size={15} /> <span>Send WhatsApp</span>
            </button>
            <button 
              type="button" 
              className="btn-hero-secondary" 
              onClick={handlePrint}
              title="Save or print official A4 PDF Bill-Book Proposal"
            >
              <Printer size={15} /> <span>Save / Print A4 PDF</span>
            </button>
            <button 
              type="button" 
              className="btn-hero-secondary" 
              onClick={() => handleSave(false)} 
              disabled={isSubmitting}
            >
              Save Draft
            </button>
            <button 
              type="button" 
              className="btn-hero-primary" 
              onClick={() => handleSave(true)} 
              disabled={isSubmitting}
            >
              <CheckCircle2 size={16} /> Finalize Quotation
            </button>
            <button 
              type="button" 
              className="btn-hero-close" 
              onClick={onClose} 
              disabled={isSubmitting} 
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Editor Body - Company & Bank Banner scrolls naturally */}
        <div className="qe-body">
          {/* Official Company Issuer & Bank Settlement Credentials Banner */}
          <div className="qe-hero-company-strip">
            <div className="qe-hero-company-card">
              <div className="qe-strip-badge">
                <ShieldCheck size={13} /> Official Issuer • Credentials Locked
              </div>
              <div className="qe-strip-comp-name">{LOCKED_COMPANY_DETAILS.name}</div>
              <div className="qe-strip-comp-sub">{LOCKED_COMPANY_DETAILS.tagline}</div>
              <div className="qe-strip-tags">
                <span className="qe-strip-tag">GSTIN: <strong>{LOCKED_COMPANY_DETAILS.gstin}</strong></span>
                <span className="qe-strip-tag">Phone: <strong>{LOCKED_COMPANY_DETAILS.phone}</strong></span>
                <span className="qe-strip-tag">Email: <strong>{LOCKED_COMPANY_DETAILS.email}</strong></span>
              </div>
            </div>

            <div className="qe-hero-bank-card">
              <div className="qe-strip-badge gold">
                <CreditCard size={13} /> Official Bank Settlement Details
              </div>
              <div className="qe-strip-bank-grid">
                <div className="qe-bank-item">
                  <span className="label">Bank Name</span>
                  <span className="val font-semibold">{LOCKED_COMPANY_DETAILS.bankDetails.bankName}</span>
                </div>
                <div className="qe-bank-item">
                  <span className="label">A/c Number</span>
                  <span className="val font-mono font-bold text-amber">{LOCKED_COMPANY_DETAILS.bankDetails.accountNumber}</span>
                </div>
                <div className="qe-bank-item">
                  <span className="label">IFSC Code</span>
                  <span className="val font-mono font-bold">{LOCKED_COMPANY_DETAILS.bankDetails.ifscCode}</span>
                </div>
                <div className="qe-bank-item">
                  <span className="label">Branch</span>
                  <span className="val">{LOCKED_COMPANY_DETAILS.bankDetails.branch}</span>
                </div>
              </div>
            </div>
          </div>

            {/* Section 2: Lead Selection Mode */}
            <div className="qe-section-card">
              <div className="qe-section-header">
                <h3><User size={18} /> Customer & Lead Association</h3>
                <div className="qe-mode-toggle">
                  <button 
                    className={`qe-toggle-btn ${mode === 'existing' ? 'active' : ''}`}
                    onClick={() => setMode('existing')}
                  >
                    Existing Lead
                  </button>
                  <button 
                    className={`qe-toggle-btn ${mode === 'new' ? 'active' : ''}`}
                    onClick={() => setMode('new')}
                  >
                    New Customer / Walk-in
                  </button>
                </div>
              </div>

              {mode === 'existing' && (
                <div className="qe-lead-picker">
                  <label>Select From Existing CRM Leads:</label>
                  <select 
                    value={selectedLeadId} 
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="qe-select"
                  >
                    <option value="">-- Choose a lead --</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.customer} ({l.id}) - {l.dealer} • {l.location}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer Inputs */}
              <div className="qe-form-grid">
                <div className="qe-input-group">
                  <label>Customer Name *</label>
                  <input 
                    type="text" 
                    value={customer.customerName} 
                    onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })}
                    placeholder="e.g. Balaji Rao"
                  />
                </div>
                <div className="qe-input-group">
                  <label>Mobile Number *</label>
                  <input 
                    type="tel" 
                    value={customer.mobileNumber} 
                    onChange={(e) => setCustomer({ ...customer, mobileNumber: e.target.value })}
                    placeholder="10-digit mobile"
                  />
                </div>
                <div className="qe-input-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={customer.email || ''} 
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="customer@email.com"
                  />
                </div>
                <div className="qe-input-group">
                  <label>Customer Type</label>
                  <select 
                    value={customer.customerType} 
                    onChange={(e) => setCustomer({ ...customer, customerType: e.target.value as CustomerType })}
                  >
                    <option value="Residential">Residential (PM Surya Ghar Eligible)</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Agricultural">Agricultural</option>
                    <option value="Institutional">Institutional</option>
                  </select>
                </div>
                <div className="qe-input-group qe-col-span-2">
                  <label>Site / Installation Address</label>
                  <input 
                    type="text" 
                    value={customer.address} 
                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                    placeholder="House/Plot No, Street, Landmark"
                  />
                </div>
                <div className="qe-input-group">
                  <label>City / Town</label>
                  <input 
                    type="text" 
                    value={customer.city} 
                    onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                  />
                </div>
                <div className="qe-input-group">
                  <label>PIN Code</label>
                  <input 
                    type="text" 
                    value={customer.pinCode} 
                    onChange={(e) => setCustomer({ ...customer, pinCode: e.target.value })}
                    placeholder="500081"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Solar Project Specifications & 3 Structure Types */}
            <div className="qe-section-card">
              <div className="qe-section-header">
                <h3><Zap size={18} /> Solar Plant Specifications</h3>
                <button className="qe-estimate-btn" onClick={handleAutoEstimate}>
                  <Calculator size={14} /> Auto-Generate Standard Equipment
                </button>
              </div>

              <div className="qe-form-grid">
                <div className="qe-input-group">
                  <label>System Capacity (kW) *</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    min="1" 
                    value={project.systemCapacityKw} 
                    onChange={(e) => setProject({ ...project, systemCapacityKw: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="qe-input-group">
                  <label>Plant Technology Type</label>
                  <select 
                    value={project.plantType} 
                    onChange={(e) => setProject({ ...project, plantType: e.target.value as PlantType })}
                  >
                    <option value="On-Grid">On-Grid (Grid-Tied with Net Meter)</option>
                    <option value="Hybrid">Hybrid (Solar + Battery Storage + Grid)</option>
                    <option value="Off-Grid">Off-Grid (Solar + Battery Standalone)</option>
                  </select>
                </div>
                <div className="qe-input-group">
                  <label>Grid Phase Type</label>
                  <select 
                    value={project.phaseType} 
                    onChange={(e) => setProject({ ...project, phaseType: e.target.value as PhaseType })}
                  >
                    <option value="Single Phase">Single Phase (1P - Up to 5kW)</option>
                    <option value="Three Phase">Three Phase (3P - Above 3kW)</option>
                  </select>
                </div>

                {/* Structure Type: EXACTLY 3 TYPES */}
                <div className="qe-input-group">
                  <label>Structure Type *</label>
                  <select 
                    value={project.structureType || 'Hot Dip Company Structure'} 
                    onChange={(e) => setProject({ ...project, structureType: e.target.value as StructureType })}
                    className="qe-structure-select"
                  >
                    <option value="Hot Dip Company Structure">Hot Dip Company Structure</option>
                    <option value="Mono Rail">Mono Rail</option>
                    <option value="Welding Structure">Welding Structure</option>
                  </select>
                </div>

                {/* Front and Rear Legs Height: ONLY SHOWN WHEN Hot Dip Company Structure is selected */}
                {project.structureType === 'Hot Dip Company Structure' && (
                  <>
                    <div className="qe-input-group qe-highlight-field">
                      <label>Front Leg Height *</label>
                      <input 
                        type="text" 
                        value={project.frontLegHeight || ''} 
                        onChange={(e) => setProject({ ...project, frontLegHeight: e.target.value })}
                        placeholder="e.g. 4 ft or 1.2 m"
                      />
                    </div>
                    <div className="qe-input-group qe-highlight-field">
                      <label>Rear Leg Height *</label>
                      <input 
                        type="text" 
                        value={project.rearLegHeight || ''} 
                        onChange={(e) => setProject({ ...project, rearLegHeight: e.target.value })}
                        placeholder="e.g. 7 ft or 2.1 m"
                      />
                    </div>
                  </>
                )}

                <div className="qe-input-group">
                  <label>DISCOM Electricity Board</label>
                  <input 
                    type="text" 
                    value={project.discomName || ''} 
                    onChange={(e) => setProject({ ...project, discomName: e.target.value })}
                    placeholder="e.g. TSSPDCL / TSNPDCL / APSPDCL"
                  />
                </div>
                <div className="qe-input-group">
                  <label>Electricity Consumer / USC No.</label>
                  <input 
                    type="text" 
                    value={project.consumerNumber || ''} 
                    onChange={(e) => setProject({ ...project, consumerNumber: e.target.value })}
                    placeholder="Service connection number"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Equipment & Service Line Items (NO INDIVIDUAL PRICES) */}
            <div className="qe-section-card">
              <div className="qe-section-header">
                <div>
                  <h3><FileText size={18} /> Equipment & Specification Bill of Materials</h3>
                  <p className="qe-section-sub">Standard quotation format: No individual line item rates; equipment items are bundled into the total turnkey project package.</p>
                </div>
                <div className="qe-item-actions">
                  <button className="btn-outline qe-sm-btn" onClick={() => handleAddItem('Custom Item')}>
                    <Plus size={14} /> Add Item
                  </button>
                </div>
              </div>

              <div className="qe-table-wrapper">
                <table className="qe-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th style={{ minWidth: '260px' }}>Item Description & Category</th>
                      <th style={{ minWidth: '200px' }}>Brand / Specification</th>
                      <th style={{ width: '100px' }}>Quantity</th>
                      <th style={{ width: '100px' }}>Unit</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="qe-td-idx">{idx + 1}</td>
                        <td>
                          <input 
                            type="text" 
                            className="qe-table-input font-bold" 
                            value={item.name} 
                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          />
                          <div className="qe-item-meta">
                            <select 
                              value={item.category} 
                              onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                              className="qe-cat-select"
                            >
                              <option value="Solar Panel">Solar Panel</option>
                              <option value="Inverter">Inverter</option>
                              <option value="Structure">Structure</option>
                              <option value="DC Cable">DC Cable</option>
                              <option value="AC Cable">AC Cable</option>
                              <option value="Earthing & Lightning">Earthing & LA</option>
                              <option value="ACDB & DCDB">ACDB / DCDB</option>
                              <option value="Battery Storage">Battery Storage</option>
                              <option value="Installation & Commissioning">Installation</option>
                              <option value="Transportation & Logistics">Transportation</option>
                              <option value="Civil Works & Foundation">Civil Works</option>
                              <option value="Accessories">Accessories</option>
                              <option value="Custom Item">Custom Item</option>
                            </select>
                          </div>
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="qe-table-input" 
                            value={item.brand || ''} 
                            onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                            placeholder="Brand / Model / Specs"
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            min="1" 
                            className="qe-table-input text-center font-bold" 
                            value={item.quantity} 
                            onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value) || 1)}
                          />
                        </td>
                        <td>
                          <select 
                            value={item.unit} 
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="qe-unit-select"
                          >
                            <option value="Nos">Nos</option>
                            <option value="Watts">Watts</option>
                            <option value="kW">kW</option>
                            <option value="Sets">Sets</option>
                            <option value="Meters">Meters</option>
                            <option value="Lots">Lots</option>
                            <option value="Unit">Unit</option>
                          </select>
                        </td>
                        <td>
                          <div className="qe-row-actions">
                            <button title="Move Up" onClick={() => handleMoveItem(idx, 'up')} disabled={idx === 0}>
                              <ArrowUp size={13} />
                            </button>
                            <button title="Move Down" onClick={() => handleMoveItem(idx, 'down')} disabled={idx === items.length - 1}>
                              <ArrowDown size={13} />
                            </button>
                            <button title="Duplicate" onClick={() => handleDuplicateItem(idx)}>
                              <Copy size={13} />
                            </button>
                            <button title="Delete" className="btn-del" onClick={() => handleDeleteItem(idx)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="qe-add-bar">
                <span>Quick add items:</span>
                <button className="qe-chip-btn" onClick={() => handleAddItem('Solar Panel')}>+ Solar Panel</button>
                <button className="qe-chip-btn" onClick={() => handleAddItem('Inverter')}>+ Inverter</button>
                <button className="qe-chip-btn" onClick={() => handleAddItem('Structure')}>+ Structure</button>
                <button className="qe-chip-btn" onClick={() => handleAddItem('DC Cable')}>+ DC Cable</button>
                <button className="qe-chip-btn" onClick={() => handleAddItem('AC Cable')}>+ AC Cable</button>
                <button className="qe-chip-btn" onClick={() => handleAddItem('Earthing & Lightning')}>+ Earthing & LA</button>
                <button className="qe-chip-btn" onClick={() => handleAddItem('Custom Item')}>+ Custom Line</button>
              </div>
            </div>

            {/* Section 5: Commercial Pricing Summary (Single Total Price with 5% GST Included Every Time) */}
            <div className="qe-financials-grid">
              <div className="qe-notes-card">
                <h4>Terms & Quotation Conditions</h4>
                <textarea 
                  rows={4} 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter quotation validity, warranty stipulations, installation timeline notes..."
                />
                <div className="qe-validity-row">
                  <label>Quotation Validity:</label>
                  <input 
                    type="number" 
                    value={validityDays} 
                    onChange={(e) => setValidityDays(Number(e.target.value) || 15)} 
                    style={{ width: '70px' }}
                  />
                  <span>Calendar Days</span>
                </div>
              </div>

              <div className="qe-summary-table-card">
                <h4>Commercial Turnkey Proposal</h4>

                {/* Single Total Package Price Input with 5% GST Included */}
                <div className="qe-single-price-input-box">
                  <label className="qe-single-price-label">
                    Total Project Package Price (Inclusive of 5% GST) *
                  </label>
                  <div className="qe-total-input-wrapper">
                    <span className="qe-currency-symbol">₹</span>
                    <input 
                      type="number" 
                      min="1000"
                      step="500"
                      className="qe-total-package-input"
                      value={project.singleTotalPrice || 195000}
                      onChange={(e) => setProject({ ...project, singleTotalPrice: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <span className="qe-single-price-hint">Includes turnkey engineering, supply, installation, testing, commissioning & 5% GST</span>
                </div>

                <div className="qe-summary-row qe-sub-divider">
                  <span>Taxable Project Base:</span>
                  <span>₹{financials.taxableAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="qe-summary-row">
                  <span>GST Amount (5% Included):</span>
                  <span>₹{financials.gstTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="qe-summary-row text-sm text-muted">
                  <span>GST Breakdown:</span>
                  <span>CGST (2.5%): ₹{financials.cgst.toLocaleString('en-IN')} | SGST (2.5%): ₹{financials.sgst.toLocaleString('en-IN')}</span>
                </div>

                <div className="qe-summary-row qe-total-row">
                  <span>Total Invoice Amount (Turnkey):</span>
                  <span>₹{financials.grandTotal.toLocaleString('en-IN')}</span>
                </div>

                {/* PM Surya Ghar Subsidy Box: Displayed clearly at ₹78,000/- WITHOUT subtracting from amount */}
                <div className="qe-subsidy-box">
                  <div className="qe-subsidy-toggle-row">
                    <label className="qe-switch-label">
                      <input 
                        type="checkbox" 
                        checked={isSubsidyEligible} 
                        onChange={(e) => setIsSubsidyEligible(e.target.checked)}
                      />
                      <span>PM Surya Ghar: Muft Bijli Yojana Central Subsidy</span>
                    </label>
                    {isSubsidyEligible && (
                      <span className="qe-subsidy-badge-green">
                        ₹78,000/- (Govt DBT)
                      </span>
                    )}
                  </div>
                  {isSubsidyEligible && (
                    <div className="qe-subsidy-explanation">
                      <p className="qe-subsidy-notice">
                        <strong>Important:</strong> Central Govt. subsidy of <strong>₹78,000/-</strong> is credited directly into the customer's bank account via Direct Benefit Transfer (DBT) post-commissioning.
                      </p>
                      <p className="qe-subsidy-subnotice">
                        * As per MNRE guidelines, the customer pays the full contract amount to Mirror Solar Vision, and the subsidy is claimed directly by the customer from Govt. of India.
                      </p>
                    </div>
                  )}
                </div>

                <div className="qe-payable-banner">
                  <div className="qe-payable-label">NET PAYABLE TO MIRROR SOLAR VISION:</div>
                  <div className="qe-payable-value">₹{financials.grandTotal.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden on screen, active on print: Standard A4 Proposal Sheet for PDF Download & Direct Print */}
        <div id="printable-a4-quotation" className="a4-quotation-sheet print-only-sheet">
          {/* Header with Logo & Locked Company Snapshot */}
          <div className="a4-header">
            <div className="a4-logo-col">
              <img src={logoUrl} alt="Mirror Solar Vision" className="a4-logo-img" />
              <div className="a4-tagline">{LOCKED_COMPANY_DETAILS.tagline}</div>
            </div>
            <div className="a4-company-meta">
              <h3>{LOCKED_COMPANY_DETAILS.name}</h3>
              <p>{LOCKED_COMPANY_DETAILS.address}, {LOCKED_COMPANY_DETAILS.city}, {LOCKED_COMPANY_DETAILS.state} - {LOCKED_COMPANY_DETAILS.pinCode}</p>
              <p><strong>Phone:</strong> {LOCKED_COMPANY_DETAILS.phone} | <strong>Email:</strong> {LOCKED_COMPANY_DETAILS.email}</p>
              <p><strong>GSTIN:</strong> {LOCKED_COMPANY_DETAILS.gstin} | <strong>PAN:</strong> {LOCKED_COMPANY_DETAILS.panNumber}</p>
            </div>
          </div>

          <div className="a4-title-bar">
            <span>COMMERCIAL SOLAR PROPOSAL & TURNKEY QUOTATION</span>
            <span>Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>

          {/* Quotation Ref & Customer Info Grid */}
          <div className="a4-info-grid">
            <div className="a4-info-box">
              <div className="a4-box-title">CUSTOMER INFORMATION</div>
              <div className="a4-info-row"><span>Name:</span> <strong>{customer.customerName}</strong></div>
              <div className="a4-info-row"><span>Contact:</span> <strong>+91 {customer.mobileNumber}</strong></div>
              {customer.email && <div className="a4-info-row"><span>Email:</span> {customer.email}</div>}
              <div className="a4-info-row"><span>Installation Site:</span> {customer.address || customer.city}, {customer.city} - {customer.pinCode}</div>
              <div className="a4-info-row"><span>Category:</span> {customer.customerType}</div>
            </div>
            <div className="a4-info-box">
              <div className="a4-box-title">PROPOSAL REFERENCE</div>
              <div className="a4-info-row"><span>Proposal No:</span> <strong>{initialQuotation?.quotationNumber || 'MSV-PROP-TURNKEY'}</strong></div>
              <div className="a4-info-row"><span>Validity:</span> {validityDays} Calendar Days</div>
              <div className="a4-info-row"><span>DISCOM Board:</span> {project.discomName || 'TSSPDCL'}</div>
              {project.consumerNumber && <div className="a4-info-row"><span>Service No:</span> {project.consumerNumber}</div>}
              <div className="a4-info-row"><span>Billing Model:</span> Turnkey Contract (5% GST Incl.)</div>
            </div>
          </div>

          {/* Plant Technical Specifications */}
          <div className="a4-specs-banner">
            <div className="a4-spec-cell">
              <span className="a4-spec-label">SYSTEM CAPACITY</span>
              <span className="a4-spec-val">{project.systemCapacityKw} kW</span>
            </div>
            <div className="a4-spec-cell">
              <span className="a4-spec-label">PLANT TECHNOLOGY</span>
              <span className="a4-spec-val">{project.plantType}</span>
            </div>
            <div className="a4-spec-cell">
              <span className="a4-spec-label">GRID PHASE</span>
              <span className="a4-spec-val">{project.phaseType}</span>
            </div>
            <div className="a4-spec-cell">
              <span className="a4-spec-label">STRUCTURE TYPE</span>
              <span className="a4-spec-val">{project.structureType || 'Hot Dip Company Structure'}</span>
            </div>
            {project.structureType === 'Hot Dip Company Structure' && (
              <div className="a4-spec-cell">
                <span className="a4-spec-label">LEG HEIGHT (F / R)</span>
                <span className="a4-spec-val">{project.frontLegHeight || '4 ft'} / {project.rearLegHeight || '7 ft'}</span>
              </div>
            )}
          </div>

          {/* Equipment Bill of Materials Table (No Individual Prices) */}
          <div className="a4-section-title">BILL OF MATERIALS & TECHNICAL SPECIFICATIONS</div>
          <table className="a4-bom-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }}>#</th>
                <th>Equipment & Service Description</th>
                <th>Brand / Technical Specification</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.brand || 'Tier-1 Certified / ISI Standard'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'center' }}>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Commercial Proposal & Subsidy Section */}
          <div className="a4-commercial-row">
            <div className="a4-subsidy-callout">
              <div className="a4-subsidy-header">
                GOVT. CENTRAL SUBSIDY (PM SURYA GHAR)
              </div>
              <div className="a4-subsidy-amount">
                ₹78,000/-
              </div>
              <p className="a4-subsidy-text">
                * Eligible Central Govt. Subsidy under PM Surya Ghar Muft Bijli Yojana is credited <strong>directly into customer's bank account via DBT</strong> by MNRE post-commissioning. 
                <br />
                <em>(Subsidy is claimed by the customer and is not subtracted from company turnkey invoice).</em>
              </p>
            </div>

            <div className="a4-pricing-table-wrap">
              <table className="a4-pricing-table">
                <tbody>
                  <tr>
                    <td>Project Taxable Base:</td>
                    <td className="text-right">₹{financials.taxableAmount.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>GST (5% Inclusive):</td>
                    <td className="text-right">₹{financials.gstTotal.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="a4-total-row">
                    <td><strong>TOTAL PACKAGE PRICE:</strong></td>
                    <td className="text-right"><strong>₹{financials.grandTotal.toLocaleString('en-IN')}</strong></td>
                  </tr>
                  <tr className="a4-payable-row">
                    <td><strong>NET PAYABLE TO COMPANY:</strong></td>
                    <td className="text-right"><strong>₹{financials.grandTotal.toLocaleString('en-IN')}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Bank Details Banner */}
          <div className="a4-bank-banner">
            <div className="a4-bank-col">
              <strong>Account Name:</strong> {LOCKED_COMPANY_DETAILS.bankDetails.accountName}
            </div>
            <div className="a4-bank-col">
              <strong>Bank:</strong> {LOCKED_COMPANY_DETAILS.bankDetails.bankName}
            </div>
            <div className="a4-bank-col">
              <strong>A/c Number:</strong> {LOCKED_COMPANY_DETAILS.bankDetails.accountNumber}
            </div>
            <div className="a4-bank-col">
              <strong>IFSC:</strong> {LOCKED_COMPANY_DETAILS.bankDetails.ifscCode}
            </div>
            <div className="a4-bank-col">
              <strong>Branch:</strong> {LOCKED_COMPANY_DETAILS.bankDetails.branch}
            </div>
          </div>

          {/* Terms and Signatures */}
          <div className="a4-footer-grid">
            <div className="a4-terms-box">
              <div className="a4-terms-title">Standard Terms & Conditions:</div>
              <ol>
                <li>50% Advance with order confirmation, 40% on material delivery, 10% on grid sync.</li>
                <li>Solar panels carry a 25-year performance warranty; Inverter carries 5-year warranty.</li>
                <li>Subsidy processing assistance is provided by Mirror Solar Vision under MNRE portal.</li>
                <li>Quotation valid for {validityDays} calendar days from issue date.</li>
              </ol>
            </div>
            <div className="a4-sign-box">
              <div className="a4-sign-space"></div>
              <div className="a4-sign-line">Authorized Signatory</div>
              <div className="a4-sign-comp">Mirror Solar Vision</div>
            </div>
          </div>
        </div>
      </div>
  );
}
