import React, { useState, useMemo } from 'react';
import { 
  FileText, Plus, CheckCircle2, AlertTriangle, 
  Download, Printer, Share2, ShieldCheck, DollarSign, 
  Send, Eye, X, ArrowRight
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';

interface SalesQuotationsViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
  initialLeadId?: string;
}

// Pricing catalog standards
const CAPACITY_PRICING: Record<number, { basePrice: number; subsidy: number; defaultDiscount: number; maxStandardDiscount: number }> = {
  1: { basePrice: 75000, subsidy: 30000, defaultDiscount: 1000, maxStandardDiscount: 2000 },
  2: { basePrice: 145000, subsidy: 60000, defaultDiscount: 1500, maxStandardDiscount: 3000 },
  3: { basePrice: 205000, subsidy: 78000, defaultDiscount: 2000, maxStandardDiscount: 4000 },
  4: { basePrice: 265000, subsidy: 78000, defaultDiscount: 2500, maxStandardDiscount: 5000 },
  5: { basePrice: 320000, subsidy: 78000, defaultDiscount: 3000, maxStandardDiscount: 6000 },
  8: { basePrice: 480000, subsidy: 78000, defaultDiscount: 4000, maxStandardDiscount: 8000 },
  10: { basePrice: 590000, subsidy: 78000, defaultDiscount: 5000, maxStandardDiscount: 10000 }
};

export default function SalesQuotationsView({
  onNavigateSubView: _onNavigateSubView,
  initialLeadId
}: SalesQuotationsViewProps) {
  const { currentUser, leads, createQuotation, updateLead, addActivity } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  // Scoped leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || (scopedLeads[0]?.id || ''));
  const [selectedCapacity, setSelectedCapacity] = useState<number>(3);
  const [panelType, setPanelType] = useState<string>('Mono PERC 550W Bifacial (Tier-1)');
  const [inverterType, setInverterType] = useState<string>('Smart On-Grid String Inverter (IP65)');
  const [customDiscount, setCustomDiscount] = useState<number>(2000);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [discountApprovalRequested, setDiscountApprovalRequested] = useState(false);

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  // Pricing calculations
  const priceSpec = CAPACITY_PRICING[selectedCapacity] || CAPACITY_PRICING[3];
  const basePrice = priceSpec.basePrice;
  const centralSubsidy = priceSpec.subsidy;
  const maxPermittedDiscount = priceSpec.maxStandardDiscount;
  const requiresAdminApproval = customDiscount > maxPermittedDiscount;

  const netPayable = Math.max(0, basePrice - customDiscount - centralSubsidy);
  const grossInvoiceAmount = Math.max(0, basePrice - customDiscount);

  // Handle Save Quotation
  const handleSaveQuotation = async () => {
    if (!activeLead) return;

    const saved = await createQuotation({
      dealerId: activeLead.dealerId || 'dlr_official',
      dealerName: activeLead.dealer || 'Mirror Solar Official Dealer',
      leadId: activeLead.id,
      customerName: activeLead.customer,
      customerPhone: activeLead.phone,
      customerAddress: activeLead.location,
      productId: `PROD-${selectedCapacity}KW`,
      productName: `${selectedCapacity} kW Rooftop Solar System`,
      systemSizeKw: selectedCapacity,
      panelType,
      panelQuantity: Math.ceil((selectedCapacity * 1000) / 550),
      inverterType,
      structureType: 'HDG Elevated Roof Structure (1.5m Clearance)',
      basePriceAtCreation: basePrice,
      discount: customDiscount,
      finalAmount: grossInvoiceAmount,
      subsidyEstimateAtCreation: centralSubsidy,
      netCustomerCost: netPayable,
      validityDays: 15,
      notes: requiresAdminApproval ? 'Special discount requested by sales staff.' : 'Standard approved pricing',
      status: 'Sent',
      createdBy: currentUserId,
      createdByName: currentUserName
    });

    // Advance salesStage to Quotation Sent
    await updateLead(activeLead.id, {
      salesStage: 'Quotation Sent'
    });

    addActivity({
      type: 'Quotation Generated',
      message: `Quotation ${saved.quotationNumber} (${selectedCapacity} kW - Net ₹${netPayable.toLocaleString()}) created for ${activeLead.customer}`,
      user: currentUserName,
      leadId: activeLead.id
    });

    alert(`Quotation ${saved.quotationNumber} successfully generated for ${activeLead.customer}!`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="sales-quotations-content">
      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Quotation & Commercial Pricing Builder
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Generate official PM Surya Ghar system proposals, apply permitted discounts, and share quotations.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>Customer:</label>
            <select 
              className="sales-form-control"
              style={{ width: 'auto', minWidth: '220px' }}
              value={selectedLeadId}
              onChange={e => setSelectedLeadId(e.target.value)}
            >
              {scopedLeads.map(l => (
                <option key={l.id} value={l.id}>{l.customer} ({l.phone})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeLead && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem' }}>
          {/* Left: Configuration Form */}
          <div className="sales-panel" style={{ margin: 0 }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a' }}>
              Solar System Specifications & Capacity
            </h3>

            {/* Capacity Selector Tabs */}
            <div className="sales-form-group">
              <label>System Capacity (kW) *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5, 8, 10].map(kw => (
                  <button
                    key={kw}
                    type="button"
                    className="sales-btn-secondary"
                    style={{
                      justifyContent: 'center',
                      padding: '0.6rem 0.5rem',
                      borderColor: selectedCapacity === kw ? '#0284c7' : '#cbd5e1',
                      background: selectedCapacity === kw ? '#e0f2fe' : 'white',
                      color: selectedCapacity === kw ? '#0369a1' : '#334155',
                      fontWeight: selectedCapacity === kw ? 700 : 500
                    }}
                    onClick={() => {
                      setSelectedCapacity(kw);
                      setCustomDiscount(CAPACITY_PRICING[kw]?.defaultDiscount || 2000);
                    }}
                  >
                    {kw} kW
                  </button>
                ))}
              </div>
            </div>

            <div className="sales-form-row">
              <div className="sales-form-group">
                <label>Solar Modules</label>
                <select 
                  className="sales-form-control"
                  value={panelType}
                  onChange={e => setPanelType(e.target.value)}
                >
                  <option value="Mono PERC 550W Bifacial (Tier-1)">Mono PERC 550W Bifacial (Tier-1 Top Quality)</option>
                  <option value="Mono PERC 540W Monofacial">Mono PERC 540W Monofacial</option>
                  <option value="TOPCon 580W N-Type Ultra High Output">TOPCon 580W N-Type Ultra High Output</option>
                </select>
              </div>
              <div className="sales-form-group">
                <label>Inverter Specification</label>
                <select 
                  className="sales-form-control"
                  value={inverterType}
                  onChange={e => setInverterType(e.target.value)}
                >
                  <option value="Smart On-Grid String Inverter (IP65)">Smart On-Grid String Inverter (IP65, WiFi Monitoring)</option>
                  <option value="Hybrid Inverter with Battery Backup Ready">Hybrid Inverter (Battery Backup Ready)</option>
                </select>
              </div>
            </div>

            <div className="sales-form-row">
              <div className="sales-form-group">
                <label>Permitted Standard Discount (₹)</label>
                <input 
                  type="number" 
                  step="500"
                  className="sales-form-control"
                  value={customDiscount}
                  onChange={e => setCustomDiscount(Number(e.target.value))}
                />
                <span style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Max permitted without Admin approval: ₹{maxPermittedDiscount.toLocaleString()}
                </span>
              </div>
              <div className="sales-form-group">
                <label>Elevated Mounting Structure</label>
                <input 
                  type="text" 
                  readOnly 
                  className="sales-form-control"
                  value="HDG Galvanized Elevated Structure (1.5m Clearance)"
                  style={{ background: '#f8fafc' }}
                />
              </div>
            </div>

            {/* Admin Approval Notice Banner */}
            {requiresAdminApproval && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.85rem 1rem', borderRadius: '8px', margin: '1rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#b45309', fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} /> Discount Exceeds Standard Threshold (₹{maxPermittedDiscount})
                </div>
                <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.775rem', color: '#78350f' }}>
                  A discount of ₹{customDiscount.toLocaleString()} requires authorized Admin approval before formal invoice issuance.
                </p>
                <button 
                  type="button" 
                  className="sales-btn-secondary" 
                  style={{ fontSize: '0.75rem', background: 'white', borderColor: '#f59e0b', color: '#b45309' }}
                  onClick={() => {
                    setDiscountApprovalRequested(true);
                    addActivity({
                      type: 'Discount Approval Requested',
                      message: `Special discount of ₹${customDiscount} requested for ${activeLead.customer}`,
                      user: currentUserName,
                      leadId: activeLead.id
                    });
                    alert('Admin discount approval request submitted successfully!');
                  }}
                  disabled={discountApprovalRequested}
                >
                  {discountApprovalRequested ? '✓ Approval Requested from Admin' : 'Request Admin Discount Approval'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="sales-btn-primary"
                onClick={handleSaveQuotation}
              >
                <CheckCircle2 size={16} /> Generate & Record Quotation
              </button>
              <button 
                type="button" 
                className="sales-btn-secondary"
                onClick={() => setIsPreviewOpen(true)}
              >
                <Eye size={16} /> Preview Official PDF Quote
              </button>
            </div>
          </div>

          {/* Right: Commercial Pricing Summary Card */}
          <div className="sales-panel" style={{ background: '#0b1f3a', color: 'white', border: 'none', margin: 0 }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#38bdf8', fontWeight: 700 }}>
              Commercial Pricing Breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#cbd5e1' }}>System Base Price:</span>
                <span style={{ fontWeight: 600 }}>₹{basePrice.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#f87171' }}>
                <span>Applied Discount:</span>
                <span style={{ fontWeight: 600 }}>- ₹{customDiscount.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#cbd5e1' }}>Gross Invoice Amount:</span>
                <span style={{ fontWeight: 700, color: '#fde047' }}>₹{grossInvoiceAmount.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#34d399' }}>
                <span>Central Subsidy (PM Surya Ghar):</span>
                <span style={{ fontWeight: 700 }}>- ₹{centralSubsidy.toLocaleString()}</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '1rem', borderRadius: '10px', marginTop: '0.5rem' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#93c5fd' }}>Net Customer Payable Cost:</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>
                  ₹{netPayable.toLocaleString()}
                </span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginTop: '4px' }}>
                  Direct bank credit subsidy transferred post commissioning.
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              * Official quotation valid for 15 days from issuance. Subject to DISCOM net-metering technical clearance.
            </div>
          </div>
        </div>
      )}

      {/* Official PDF Quotation Preview Modal */}
      {isPreviewOpen && activeLead && (
        <div className="sales-modal-overlay" onClick={() => setIsPreviewOpen(false)}>
          <div className="sales-modal-content" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3>Official Solar Quotation Document</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="sales-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={handlePrint}>
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button className="sales-modal-close-btn" onClick={() => setIsPreviewOpen(false)}><X size={20} /></button>
              </div>
            </div>

            <div className="sales-modal-body" style={{ background: '#ffffff', color: '#0f172a', padding: '2rem' }}>
              {/* Official Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0b1f3a', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0b1f3a', fontSize: '1.4rem', fontWeight: 800 }}>MIRROR SOLAR VISION</h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Clean Energy Solutions • PM Surya Ghar Registered Channel Partner</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📞 +91 94401 88990 • 🌐 crm.mirrorsolarvision.com</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#0284c7' }}>OFFICIAL PROPOSAL</div>
                  <div style={{ fontSize: '0.8rem' }}>Date: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* Customer Details */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0b1f3a', textTransform: 'uppercase' }}>Customer Information</div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0b1f3a', marginTop: '2px' }}>{activeLead.customer}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>Phone: {activeLead.phone}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>Location: {activeLead.location}</div>
              </div>

              {/* Technical Specifications Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ background: '#0b1f3a', color: 'white' }}>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Component</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Specification</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Warranty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>System Capacity</td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>{selectedCapacity} kW On-Grid Rooftop Solar</td>
                    <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>5-Year System AMC</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>Solar Modules</td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>{panelType}</td>
                    <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>25-Year Performance</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>Solar Inverter</td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>{inverterType}</td>
                    <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>10-Year Replacement</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>Mounting Structure</td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>Hot-Dip Galvanized Elevated 1.5m Roof Structure</td>
                    <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>10-Year Structural</td>
                  </tr>
                </tbody>
              </table>

              {/* Price Calculation Summary */}
              <div style={{ marginLeft: 'auto', width: '280px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                  <span>Base System Cost:</span>
                  <span>₹{basePrice.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', color: '#dc2626' }}>
                  <span>Special Discount:</span>
                  <span>- ₹{customDiscount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontWeight: 700, borderTop: '1px solid #e2e8f0' }}>
                  <span>Gross Cost:</span>
                  <span>₹{grossInvoiceAmount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', color: '#16a34a', fontWeight: 600 }}>
                  <span>Central Govt Subsidy:</span>
                  <span>- ₹{centralSubsidy.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 800, fontSize: '1.1rem', color: '#0b1f3a', borderTop: '2px solid #0b1f3a' }}>
                  <span>Net Payable:</span>
                  <span>₹{netPayable.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="sales-modal-footer">
              <button className="sales-btn-secondary" onClick={() => setIsPreviewOpen(false)}>Close</button>
              <button className="sales-btn-primary" onClick={handlePrint}>Print / Export PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
