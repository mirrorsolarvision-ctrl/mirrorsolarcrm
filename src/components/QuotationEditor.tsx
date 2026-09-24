import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Copy, ArrowDown, ArrowUp, Lock, CheckCircle2, 
  FileText, Calculator, Share2, Download, Printer, AlertCircle, 
  HelpCircle, User, Zap, Sparkles, Building2, CreditCard, ChevronRight, X
} from 'lucide-react';
import type { 
  Quotation, QuotationItem, QuotationCustomerDetails, 
  QuotationProjectDetails, CustomerType, PlantType, PhaseType, RoofType 
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
import './QuotationEditor.css';

interface QuotationEditorProps {
  initialQuotation?: Quotation | null;
  initialLeadId?: string;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
}

export default function QuotationEditor({ initialQuotation, initialLeadId, onClose, onSuccess }: QuotationEditorProps) {
  const { createQuotation, updateQuotationDraft, finalizeQuotation } = useQuotations();
  const { leads, dealers } = useCRM();
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

  // Project Details Form
  const [project, setProject] = useState<QuotationProjectDetails>({
    systemCapacityKw: initialQuotation?.project.systemCapacityKw || 3,
    plantType: initialQuotation?.project.plantType || 'On-Grid',
    phaseType: initialQuotation?.project.phaseType || 'Single Phase',
    roofType: initialQuotation?.project.roofType || 'RCC Flat Roof',
    sanctionedLoadKw: initialQuotation?.project.sanctionedLoadKw || 3,
    discomName: initialQuotation?.project.discomName || 'TSSPDCL',
    consumerNumber: initialQuotation?.project.consumerNumber || '',
    serviceNumber: initialQuotation?.project.serviceNumber || ''
  });

  // Items State (Bill Book style)
  const [items, setItems] = useState<QuotationItem[]>(() => {
    if (initialQuotation && initialQuotation.items.length > 0) {
      return initialQuotation.items.map(recalculateLineItem);
    }
    return generateRecommendedBOM(3, 550, 'Single Phase', false);
  });

  // Financial Options
  const [extraDiscount, setExtraDiscount] = useState<number>(initialQuotation?.financials.extraDiscount || 0);
  const [isSubsidyEligible, setIsSubsidyEligible] = useState<boolean>(
    initialQuotation?.financials.subsidyEligible !== undefined ? initialQuotation.financials.subsidyEligible : true
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

  // Dynamic Live Financial Calculation
  const financials = calculateQuotationFinancials(items, extraDiscount, isSubsidyEligible, project.systemCapacityKw);

  // Line Item Handlers
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
      brand: 'Standard / ISI Certified',
      model: '',
      quantity: 1,
      unit: 'Nos',
      unitRate: 1000,
      discount: 0,
      taxRatePercent: 18,
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
      'Regenerate Recommended BOM?',
      `This will generate optimized solar equipment for ${project.systemCapacityKw} kW (${project.phaseType}). Custom edits will be reset to standard specs.`,
      () => {
        const bom = generateRecommendedBOM(
          project.systemCapacityKw,
          550,
          project.phaseType,
          project.plantType === 'Hybrid' || project.plantType === 'Off-Grid'
        );
        setItems(bom);
        showToast('Generated recommended solar bill of materials!', 'success');
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
          extraDiscount,
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
          extraDiscount,
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

  const handleShareWhatsApp = () => {
    const text = `*SOLAR QUOTATION — ${LOCKED_COMPANY_DETAILS.name}*\n` +
      `Customer: ${customer.customerName}\n` +
      `Plant Capacity: ${project.systemCapacityKw} kW (${project.plantType})\n` +
      `Grand Total: ₹${financials.grandTotal.toLocaleString('en-IN')}\n` +
      (financials.subsidyAmount > 0 ? `PM Surya Ghar Subsidy: ₹${financials.subsidyAmount.toLocaleString('en-IN')}\n` : '') +
      `*Net Customer Payable: ₹${financials.netPayableByCustomer.toLocaleString('en-IN')}*\n\n` +
      `View official proposal: ${window.location.origin}`;
    window.open(`https://api.whatsapp.com/send?phone=91${customer.mobileNumber}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="quotation-modal-overlay">
      <div className="quotation-editor-modal">
        {/* Top Sticky Header */}
        <div className="qe-header">
          <div className="qe-header-left">
            <div className="qe-badge">
              <Sparkles size={14} /> Bill-Book Quotation Engine
            </div>
            <h2>{initialQuotation ? `Edit Quotation (${initialQuotation.quotationNumber})` : 'New Commercial Quotation'}</h2>
          </div>
          <div className="qe-header-actions">
            <button className="btn-outline" onClick={onClose} disabled={isSubmitting}>
              <X size={16} /> Close
            </button>
            <button className="btn-outline" onClick={handleShareWhatsApp}>
              <Share2 size={16} /> WhatsApp
            </button>
            <button className="btn-outline" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
            <button className="btn-outline" onClick={() => handleSave(false)} disabled={isSubmitting}>
              Save Draft
            </button>
            <button className="btn-primary" onClick={() => handleSave(true)} disabled={isSubmitting}>
              <CheckCircle2 size={16} /> Finalize Quotation
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="qe-body">
          {/* Section 1: Locked Company Header & Bank Info Banner */}
          <div className="qe-locked-banner">
            <div className="qe-locked-badge">
              <Lock size={14} /> 🔒 Company Information — Locked
            </div>
            <div className="qe-locked-grid">
              <div className="qe-locked-company">
                <div className="qe-comp-title">{LOCKED_COMPANY_DETAILS.name}</div>
                <div className="qe-comp-sub">{LOCKED_COMPANY_DETAILS.tagline}</div>
                <div className="qe-comp-details">
                  <span>GSTIN: <strong>{LOCKED_COMPANY_DETAILS.gstin}</strong></span>
                  <span>•</span>
                  <span>Email: {LOCKED_COMPANY_DETAILS.email}</span>
                  <span>•</span>
                  <span>Phone: {LOCKED_COMPANY_DETAILS.phone}</span>
                </div>
              </div>
              <div className="qe-locked-bank">
                <div className="qe-bank-header">
                  <CreditCard size={14} /> Official Bank Settlement Details
                </div>
                <div className="qe-bank-row">
                  <span>Bank: <strong>{LOCKED_COMPANY_DETAILS.bankDetails.bankName}</strong></span>
                  <span>A/c: <strong>{LOCKED_COMPANY_DETAILS.bankDetails.accountNumber}</strong></span>
                </div>
                <div className="qe-bank-row">
                  <span>IFSC: <strong>{LOCKED_COMPANY_DETAILS.bankDetails.ifscCode}</strong></span>
                  <span>Branch: {LOCKED_COMPANY_DETAILS.bankDetails.branch}</span>
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
                  <option value="Residential">Residential (Subsidy Eligible)</option>
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

          {/* Section 3: Solar Project Specifications */}
          <div className="qe-section-card">
            <div className="qe-section-header">
              <h3><Zap size={18} /> Solar Plant Specifications</h3>
              <button className="qe-estimate-btn" onClick={handleAutoEstimate}>
                <Calculator size={14} /> Auto-Generate BOM for Capacity
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
              <div className="qe-input-group">
                <label>Roof / Structure Type</label>
                <select 
                  value={project.roofType} 
                  onChange={(e) => setProject({ ...project, roofType: e.target.value as RoofType })}
                >
                  <option value="RCC Flat Roof">RCC Flat Roof</option>
                  <option value="Slanted Tile Roof">Slanted Tile Roof</option>
                  <option value="Tin Shed / Metal Sheet">Tin Shed / Industrial Sheet</option>
                  <option value="Ground Mount">Ground Mount</option>
                </select>
              </div>
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

          {/* Section 4: Bill-Book Style Editable Line Items */}
          <div className="qe-section-card">
            <div className="qe-section-header">
              <div>
                <h3><FileText size={18} /> Bill-Book Equipment & Service Line Items</h3>
                <p className="qe-section-sub">Add, delete, duplicate, change rates, and reorder any item in real-time.</p>
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
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ minWidth: '220px' }}>Item Description & Category</th>
                    <th style={{ minWidth: '130px' }}>Brand / Model</th>
                    <th style={{ width: '90px' }}>Qty</th>
                    <th style={{ width: '85px' }}>Unit</th>
                    <th style={{ width: '110px' }}>Rate (₹)</th>
                    <th style={{ width: '90px' }}>Disc (₹)</th>
                    <th style={{ width: '80px' }}>GST %</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Total (₹)</th>
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
                          placeholder="Brand / Model"
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          min="0" 
                          className="qe-table-input text-center" 
                          value={item.quantity} 
                          onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value) || 0)}
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
                        <input 
                          type="number" 
                          min="0" 
                          className="qe-table-input text-right" 
                          value={item.unitRate} 
                          onChange={(e) => handleItemChange(idx, 'unitRate', Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          min="0" 
                          className="qe-table-input text-right" 
                          value={item.discount} 
                          onChange={(e) => handleItemChange(idx, 'discount', Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <select 
                          value={item.taxRatePercent} 
                          onChange={(e) => handleItemChange(idx, 'taxRatePercent', Number(e.target.value) || 0)}
                          className="qe-tax-select"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="qe-td-total">
                        ₹{item.total.toLocaleString('en-IN')}
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
              <button className="qe-chip-btn" onClick={() => handleAddItem('Battery Storage')}>+ Battery</button>
              <button className="qe-chip-btn" onClick={() => handleAddItem('Transportation & Logistics')}>+ Transport</button>
              <button className="qe-chip-btn" onClick={() => handleAddItem('Custom Item')}>+ Custom Line</button>
            </div>
          </div>

          {/* Section 5: Financial Breakdown & Subsidy Calculator */}
          <div className="qe-financials-grid">
            <div className="qe-notes-card">
              <h4>Terms & Special Notes</h4>
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
              <h4>Commercial Price Summary</h4>
              <div className="qe-summary-row">
                <span>Equipment Subtotal:</span>
                <span>₹{financials.subtotal.toLocaleString('en-IN')}</span>
              </div>
              {financials.totalItemDiscount > 0 && (
                <div className="qe-summary-row text-discount">
                  <span>Item Discounts:</span>
                  <span>-₹{financials.totalItemDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="qe-summary-row">
                <span>Lump-Sum Extra Discount:</span>
                <div className="qe-discount-input-wrap">
                  <span>₹</span>
                  <input 
                    type="number" 
                    min="0" 
                    value={extraDiscount} 
                    onChange={(e) => setExtraDiscount(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="qe-summary-row qe-sub-divider">
                <span>Taxable Amount:</span>
                <span>₹{financials.taxableAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="qe-summary-row">
                <span>GST (CGST + SGST):</span>
                <span>+₹{financials.gstTotal.toLocaleString('en-IN')}</span>
              </div>
              {financials.roundOff !== 0 && (
                <div className="qe-summary-row text-muted">
                  <span>Round Off Adjustment:</span>
                  <span>{financials.roundOff > 0 ? `+₹${financials.roundOff}` : `-₹${Math.abs(financials.roundOff)}`}</span>
                </div>
              )}
              <div className="qe-summary-row qe-total-row">
                <span>Grand Total (All-Inclusive):</span>
                <span>₹{financials.grandTotal.toLocaleString('en-IN')}</span>
              </div>

              {/* Subsidy Toggle & Calculation */}
              <div className="qe-subsidy-box">
                <div className="qe-subsidy-toggle-row">
                  <label className="qe-switch-label">
                    <input 
                      type="checkbox" 
                      checked={isSubsidyEligible} 
                      onChange={(e) => setIsSubsidyEligible(e.target.checked)}
                    />
                    <span>Apply PM Surya Ghar National Subsidy</span>
                  </label>
                  {isSubsidyEligible && (
                    <span className="qe-subsidy-badge">
                      -₹{financials.subsidyAmount.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {isSubsidyEligible && (
                  <p className="qe-subsidy-notice">
                    Govt. Central Subsidy for {project.systemCapacityKw} kW residential installation credited directly to customer bank account.
                  </p>
                )}
              </div>

              <div className="qe-payable-banner">
                <div className="qe-payable-label">NET CUSTOMER PAYABLE:</div>
                <div className="qe-payable-value">₹{financials.netPayableByCustomer.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
