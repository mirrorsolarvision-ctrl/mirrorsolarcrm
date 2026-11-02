import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserCheck, Zap, Home, DollarSign, Calendar, 
  CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, 
  Flame, Award, Search, Sparkles
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import { calculateLeadScore } from '../../utils/salesCalculations';
import type { CustomerQualificationData } from '../../types/sales';

interface CustomerQualificationViewProps {
  onNavigateSubView: (view: any, params?: any) => void;
  initialLeadId?: string;
}

export default function CustomerQualificationView({
  onNavigateSubView,
  initialLeadId
}: CustomerQualificationViewProps) {
  const { currentUser, leads, updateLeadQualification } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  // Scope leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || (scopedLeads[0]?.id || ''));

  useEffect(() => {
    if (initialLeadId) setSelectedLeadId(initialLeadId);
  }, [initialLeadId]);

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  // Form State
  const [qualForm, setQualForm] = useState<CustomerQualificationData>({
    monthlyUnitsKwh: 350,
    monthlyBill: 2800,
    sanctionedLoadKw: 3,
    phase: 'Single Phase',
    discom: 'APCPDCL',
    roofOwnership: 'Own',
    roofType: 'RCC',
    approxRoofAreaSqFt: 450,
    shadingCondition: 'None',
    preferredCapacityKw: 3,
    budgetPreference: 'JanSamarth Bank Loan',
    decisionMaker: 'Self',
    expectedTimeline: 'Immediate',
    notes: ''
  });

  // Sync state when active lead changes
  useEffect(() => {
    if (activeLead?.qualificationData) {
      setQualForm({
        monthlyUnitsKwh: activeLead.qualificationData.monthlyUnitsKwh || 350,
        monthlyBill: activeLead.qualificationData.monthlyBill || 2800,
        sanctionedLoadKw: activeLead.qualificationData.sanctionedLoadKw || 3,
        phase: activeLead.qualificationData.phase || 'Single Phase',
        discom: activeLead.qualificationData.discom || 'APCPDCL',
        roofOwnership: activeLead.qualificationData.roofOwnership || 'Own',
        roofType: activeLead.qualificationData.roofType || 'RCC',
        approxRoofAreaSqFt: activeLead.qualificationData.approxRoofAreaSqFt || 450,
        shadingCondition: activeLead.qualificationData.shadingCondition || 'None',
        preferredCapacityKw: activeLead.qualificationData.preferredCapacityKw || 3,
        budgetPreference: activeLead.qualificationData.budgetPreference || 'JanSamarth Bank Loan',
        decisionMaker: activeLead.qualificationData.decisionMaker || 'Self',
        expectedTimeline: activeLead.qualificationData.expectedTimeline || 'Immediate',
        notes: activeLead.qualificationData.notes || ''
      });
    }
  }, [activeLead]);

  // Real-Time Qualification Score Preview
  const liveScore = useMemo(() => {
    return calculateLeadScore({
      monthlyUnitsKwh: Number(qualForm.monthlyUnitsKwh),
      monthlyBill: Number(qualForm.monthlyBill),
      roofOwnership: qualForm.roofOwnership,
      roofType: qualForm.roofType,
      shadingStatus: qualForm.shadingCondition === 'None' ? 'No' : 'Yes',
      purchaseTimeline: qualForm.expectedTimeline,
      decisionMaker: qualForm.decisionMaker !== 'Landlord',
      financingRequirement: qualForm.budgetPreference
    });
  }, [qualForm]);

  // Handle Save Qualification
  const handleSaveQualification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;

    await updateLeadQualification(activeLead.id, {
      ...qualForm,
      qualifiedAt: new Date().toISOString(),
      qualifiedBy: currentUserName
    });

    alert(`Customer qualification successfully saved! Lead Score: ${liveScore.total}/100 (${liveScore.category})`);
  };

  return (
    <div className="customer-qualification-content">
      {/* Lead Selector Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Customer Technical & Financial Qualification
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Capture the 4 pillars: electricity consumption, roof feasibility, preferred solar capacity, and purchase timeline.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>Select Customer:</label>
            <select 
              className="sales-form-control"
              style={{ width: 'auto', minWidth: '220px' }}
              value={selectedLeadId}
              onChange={e => setSelectedLeadId(e.target.value)}
            >
              {scopedLeads.map(l => (
                <option key={l.id} value={l.id}>
                  {l.customer} ({l.phone}) - {l.salesStage || 'New'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeLead && (
        <form onSubmit={handleSaveQualification}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            {/* Left: 4 Qualification Pillars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Pillar 1: Electricity & Connection */}
              <div className="sales-panel" style={{ margin: 0 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={18} color="#0284c7" /> 1. Electricity Consumption & Connection Details
                </h3>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Monthly Consumption (Units / kWh) *</label>
                    <input 
                      type="number" 
                      required
                      className="sales-form-control"
                      value={qualForm.monthlyUnitsKwh}
                      onChange={e => setQualForm({ ...qualForm, monthlyUnitsKwh: Number(e.target.value) })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Average Monthly Bill (₹) *</label>
                    <input 
                      type="number" 
                      required
                      className="sales-form-control"
                      value={qualForm.monthlyBill}
                      onChange={e => setQualForm({ ...qualForm, monthlyBill: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Sanctioned Load (kW)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="sales-form-control"
                      value={qualForm.sanctionedLoadKw}
                      onChange={e => setQualForm({ ...qualForm, sanctionedLoadKw: Number(e.target.value) })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Connection Phase</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.phase}
                      onChange={e => setQualForm({ ...qualForm, phase: e.target.value as any })}
                    >
                      <option value="Single Phase">Single Phase (1-Ph)</option>
                      <option value="Three Phase">Three Phase (3-Ph)</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-group">
                  <label>DISCOM & Service Circle</label>
                  <select 
                    className="sales-form-control"
                    value={qualForm.discom}
                    onChange={e => setQualForm({ ...qualForm, discom: e.target.value })}
                  >
                    <option value="APCPDCL">APCPDCL (Central Andhra Pradesh)</option>
                    <option value="APEPDCL">APEPDCL (Eastern Andhra Pradesh)</option>
                    <option value="APSPDCL">APSPDCL (Southern Andhra Pradesh)</option>
                    <option value="TSSPDCL">TSSPDCL (Telangana)</option>
                    <option value="Other">Other / Commercial</option>
                  </select>
                </div>
              </div>

              {/* Pillar 2: Rooftop Suitability */}
              <div className="sales-panel" style={{ margin: 0 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Home size={18} color="#16a34a" /> 2. Rooftop Ownership & Technical Feasibility
                </h3>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Roof Ownership *</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.roofOwnership}
                      onChange={e => setQualForm({ ...qualForm, roofOwnership: e.target.value })}
                    >
                      <option value="Own">Own Independent House / Villa (Best)</option>
                      <option value="Apartment Top Floor">Apartment Top Floor (Permission Needed)</option>
                      <option value="Rented">Rented House (Requires Landlord Consent)</option>
                      <option value="Commercial">Commercial / Factory Shed</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Roof Construction Type</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.roofType}
                      onChange={e => setQualForm({ ...qualForm, roofType: e.target.value })}
                    >
                      <option value="RCC">RCC Concrete Flat Roof</option>
                      <option value="Metal Sheet">Metal GI/Color Coated Sheet</option>
                      <option value="Asbestos">Asbestos Sheet</option>
                      <option value="Tile">Clay Tile / Sloped Roof</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Approx. Shadow-Free Roof Area (sq. ft)</label>
                    <input 
                      type="number" 
                      className="sales-form-control"
                      value={qualForm.approxRoofAreaSqFt}
                      onChange={e => setQualForm({ ...qualForm, approxRoofAreaSqFt: Number(e.target.value) })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Shading Condition</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.shadingCondition}
                      onChange={e => setQualForm({ ...qualForm, shadingCondition: e.target.value })}
                    >
                      <option value="None">None (100% Shadow-Free Solar Window)</option>
                      <option value="Partial">Partial (Morning/Evening tree shadow)</option>
                      <option value="Heavy">Heavy (Surrounded by multi-storey buildings)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Pillar 3 & 4: Capacity, Budget & Timeline */}
              <div className="sales-panel" style={{ margin: 0 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={18} color="#d97706" /> 3 & 4. Capacity, Financing & Decision Timeline
                </h3>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Customer Preferred Capacity *</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.preferredCapacityKw}
                      onChange={e => setQualForm({ ...qualForm, preferredCapacityKw: Number(e.target.value) })}
                    >
                      <option value="1">1 kW (₹30,000 Subsidy)</option>
                      <option value="2">2 kW (₹60,000 Subsidy)</option>
                      <option value="3">3 kW (₹78,000 Subsidy - Optimal)</option>
                      <option value="4">4 kW (₹78,000 Subsidy)</option>
                      <option value="5">5 kW (₹78,000 Subsidy)</option>
                      <option value="10">10 kW (Commercial)</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Financing Preference</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.budgetPreference}
                      onChange={e => setQualForm({ ...qualForm, budgetPreference: e.target.value })}
                    >
                      <option value="JanSamarth Bank Loan">JanSamarth Central Bank Loan (Low Interest)</option>
                      <option value="Self-Funded Direct Payment">Self-Funded (Direct Payment - Fast Track)</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Decision Maker</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.decisionMaker}
                      onChange={e => setQualForm({ ...qualForm, decisionMaker: e.target.value })}
                    >
                      <option value="Self">Self (Sole decision maker & bill owner)</option>
                      <option value="Spouse">Spouse / Joint decision</option>
                      <option value="Parent">Parent / Family Elder</option>
                      <option value="Landlord">Landlord (Approval required)</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Expected Installation Timeline *</label>
                    <select 
                      className="sales-form-control"
                      value={qualForm.expectedTimeline}
                      onChange={e => setQualForm({ ...qualForm, expectedTimeline: e.target.value })}
                    >
                      <option value="Immediate">Immediate / Within 7 Days (Hot Intent)</option>
                      <option value="Within 30 Days">Within 30 Days (Active Planning)</option>
                      <option value="Later">Later / Exploring Options (Nurture)</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-group">
                  <label>Qualification Notes</label>
                  <textarea 
                    rows={2} 
                    className="sales-form-control"
                    placeholder="Customer owns RCC 2-storey house. Wants 3kW bifacial system to reduce ₹3,000 monthly bill..."
                    value={qualForm.notes}
                    onChange={e => setQualForm({ ...qualForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Right: Dynamic Qualification Score Card & Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="sales-panel" style={{ background: '#0b1f3a', color: 'white', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: 600 }}>Real-time Lead Score</span>
                  <span className={`sales-badge ${liveScore.category === 'Hot' ? 'hot' : liveScore.category === 'Warm' ? 'warm' : 'cold'}`}>
                    {liveScore.category === 'Hot' ? '🔥 Hot Intent' : liveScore.category === 'Warm' ? '⚡ Warm' : '❄️ Cold'}
                  </span>
                </div>

                <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 800, color: '#38bdf8' }}>{liveScore.total}</div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>out of 100 maximum points</div>
                </div>

                {/* Score breakdown bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.75rem', marginTop: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#93c5fd' }}>Electricity Consumption</span>
                      <span>{liveScore.unitsScore} / 25</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(liveScore.unitsScore / 25) * 100}%`, background: '#38bdf8' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#93c5fd' }}>Roof Feasibility</span>
                      <span>{liveScore.roofScore} / 25</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(liveScore.roofScore / 25) * 100}%`, background: '#34d399' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#93c5fd' }}>Readiness & Timeline</span>
                      <span>{liveScore.readinessScore} / 25</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(liveScore.readinessScore / 25) * 100}%`, background: '#fbbf24' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#93c5fd' }}>Financing & Decision</span>
                      <span>{liveScore.financingScore} / 25</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(liveScore.financingScore / 25) * 100}%`, background: '#a78bfa' }}></div>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="sales-btn-primary" 
                  style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center', background: '#38bdf8', color: '#0b1f3a' }}
                >
                  <CheckCircle2 size={16} /> Save Lead Qualification
                </button>
              </div>

              {/* Next Steps Card */}
              <div className="sales-panel">
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0b1f3a' }}>Recommended Next Step</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="sales-btn-secondary" 
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => onNavigateSubView('dealers', { leadId: activeLead.id })}
                  >
                    <ArrowRight size={14} /> Schedule Site Survey with Dealer
                  </button>
                  <button 
                    type="button" 
                    className="sales-btn-secondary" 
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => onNavigateSubView('quotations', { leadId: activeLead.id })}
                  >
                    <ArrowRight size={14} /> Create Quotation Proposal
                  </button>
                  <button 
                    type="button" 
                    className="sales-btn-secondary" 
                    style={{ width: '100%', justifyContent: 'flex-start', color: '#16a34a', borderColor: '#bbf7d0' }}
                    onClick={() => onNavigateSubView('whatsapp', { leadId: activeLead.id })}
                  >
                    <ArrowRight size={14} /> Send Subsidy Details on WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

