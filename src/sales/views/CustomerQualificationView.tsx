import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, Home, DollarSign, CheckCircle2, 
  AlertTriangle, ArrowRight, Check, MapPin, 
  HelpCircle, ShieldCheck
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
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
  const currentUserId = currentUser?.id || currentUser?.uid || '';

  // Scope leads: Telecaller sees assigned leads only
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      ((l.assignedEmployee && currentUserName && l.assignedEmployee.trim().toLowerCase() === currentUserName.trim().toLowerCase()) || 
       (l.assignedEmployeeId && currentUserId && l.assignedEmployeeId === currentUserId) || 
       (l.leadOwnerId && currentUserId && l.leadOwnerId === currentUserId))
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || (scopedLeads[0]?.id || ''));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialLeadId) setSelectedLeadId(initialLeadId);
  }, [initialLeadId]);

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  // Form State
  const [qualForm, setQualForm] = useState<CustomerQualificationData>({
    location: '',
    pincode: '',
    monthlyUnitsKwh: 350,
    monthlyBill: 2800,
    sanctionedLoadKw: 3,
    phase: 'Single Phase',
    discom: 'APCPDCL',
    roofOwnership: 'Owned',
    roofType: 'RCC',
    approxRoofAreaSqFt: 450,
    shadingCondition: 'None',
    preferredCapacityKw: 3,
    budgetPreference: 'JanSamarth Bank Loan',
    decisionMaker: 'Self',
    expectedTimeline: 'Immediate',
    pmSuryaGharSubsidyInterest: 'Yes',
    siteVisitRequired: 'Yes',
    qualificationResult: 'Qualified',
    notes: ''
  });

  // Sync state when active lead changes
  useEffect(() => {
    if (activeLead) {
      setSaveSuccessMsg(null);
      setSaveErrorMsg(null);
      const existing = activeLead.qualificationData;

      // Extract existing roof ownership & map
      let roofOwn = existing?.roofOwnership || 'Owned';
      if (roofOwn.includes('Own')) roofOwn = 'Owned';
      else if (roofOwn.includes('Rented')) roofOwn = 'Rented';
      else if (roofOwn.includes('Apartment') || roofOwn.includes('Shared')) roofOwn = 'Shared';

      // Extract existing timeline & map
      let timeline = existing?.expectedTimeline || 'Immediate';
      if (timeline.includes('30')) timeline = 'Within 1 month';
      else if (timeline.includes('Later')) timeline = '1-3 months';

      setQualForm({
        location: existing?.location || activeLead.location || '',
        pincode: existing?.pincode || activeLead.pincode || '',
        monthlyUnitsKwh: existing?.monthlyUnitsKwh || 350,
        monthlyBill: existing?.monthlyBill || activeLead.monthlyBill || 2800,
        sanctionedLoadKw: existing?.sanctionedLoadKw || 3,
        phase: existing?.phase || 'Single Phase',
        discom: existing?.discom || 'APCPDCL',
        roofOwnership: roofOwn,
        roofType: existing?.roofType || 'RCC',
        approxRoofAreaSqFt: existing?.approxRoofAreaSqFt || 450,
        shadingCondition: existing?.shadingCondition || 'None',
        preferredCapacityKw: existing?.preferredCapacityKw || (activeLead.capacityKw ? Number(activeLead.capacityKw) : 3),
        budgetPreference: existing?.budgetPreference || 'JanSamarth Bank Loan',
        decisionMaker: existing?.decisionMaker || 'Self',
        expectedTimeline: timeline,
        pmSuryaGharSubsidyInterest: existing?.pmSuryaGharSubsidyInterest || 'Yes',
        siteVisitRequired: existing?.siteVisitRequired || 'Yes',
        qualificationResult: existing?.qualificationResult || 'Qualified',
        notes: existing?.notes || activeLead.notes || ''
      });
    }
  }, [activeLead]);

  // Real-Time Qualification Score Preview
  const liveScore = useMemo(() => {
    return calculateLeadScore({
      monthlyUnitsKwh: Number(qualForm.monthlyUnitsKwh) || 300,
      monthlyBill: Number(qualForm.monthlyBill) || 2500,
      roofOwnership: qualForm.roofOwnership === 'Owned' ? 'Own' : qualForm.roofOwnership,
      roofType: qualForm.roofType,
      shadingStatus: qualForm.shadingCondition === 'None' ? 'No' : 'Yes',
      purchaseTimeline: qualForm.expectedTimeline === 'Within 1 month' ? 'Within 30 Days' : qualForm.expectedTimeline,
      decisionMaker: qualForm.decisionMaker !== 'Landlord',
      financingRequirement: qualForm.budgetPreference
    });
  }, [qualForm]);

  // Handle Save Qualification
  const handleSaveQualification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;

    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      await updateLeadQualification(activeLead.id, {
        ...qualForm,
        leadScore: liveScore,
        qualifiedAt: new Date().toISOString(),
        qualifiedBy: currentUserName || 'Telecaller'
      });

      const successText = `Customer qualification successfully saved to Firestore! Result: ${qualForm.qualificationResult}. Lead Score: ${liveScore.total}/100 (${liveScore.category}).`;
      setSaveSuccessMsg(successText);
      alert(successText);
    } catch (err: any) {
      console.error('Qualification save error:', err);
      const errMsg = err?.message || 'Failed to save qualification to Firestore.';
      setSaveErrorMsg(errMsg);
      alert(`Error saving qualification: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="customer-qualification-content">
      {/* Lead Selector Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Solar Feasibility & Technical Qualification Desk
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Verify customer roof feasibility, monthly bill, sanctioned load, PM Surya Ghar subsidy, and site visit readiness.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>Select Customer:</label>
            <select 
              className="sales-form-control"
              style={{ width: 'auto', minWidth: '240px' }}
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

      {/* Confirmation / Error Banners */}
      {saveSuccessMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
          <CheckCircle2 size={18} /> {saveSuccessMsg}
        </div>
      )}
      {saveErrorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} /> {saveErrorMsg}
        </div>
      )}

      {activeLead ? (
        <form onSubmit={handleSaveQualification}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            {/* Left: Qualification Form Pillars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Customer Location & Pincode */}
              <div className="sales-panel" style={{ margin: 0 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={18} color="#0284c7" /> Customer Location & Postal Details
                </h3>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>District / Town / Area *</label>
                    <input 
                      type="text" 
                      required
                      className="sales-form-control"
                      placeholder="e.g. Tenali, Guntur District"
                      value={qualForm.location || ''}
                      onChange={e => setQualForm({ ...qualForm, location: e.target.value })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Postal Pincode *</label>
                    <input 
                      type="text" 
                      required
                      maxLength={6}
                      className="sales-form-control"
                      placeholder="e.g. 522201"
                      value={qualForm.pincode || ''}
                      onChange={e => setQualForm({ ...qualForm, pincode: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Pillar 1: Electricity & Connection */}
              <div className="sales-panel" style={{ margin: 0 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={18} color="#0284c7" /> 1. Electricity Consumption & Connection Details
                </h3>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Average Monthly Bill (₹) *</label>
                    <input 
                      type="number" 
                      required
                      className="sales-form-control"
                      placeholder="e.g. 3200"
                      value={qualForm.monthlyBill}
                      onChange={e => setQualForm({ ...qualForm, monthlyBill: Number(e.target.value) })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Monthly Consumption (Units / kWh)</label>
                    <input 
                      type="number" 
                      className="sales-form-control"
                      value={qualForm.monthlyUnitsKwh}
                      onChange={e => setQualForm({ ...qualForm, monthlyUnitsKwh: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Sanctioned Load (kW) *</label>
                    <input 
                      type="number" 
                      step="0.5"
                      required
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
                  <label>DISCOM Electricity Provider</label>
                  <select 
                    className="sales-form-control"
                    value={qualForm.discom}
                    onChange={e => setQualForm({ ...qualForm, discom: e.target.value })}
                  >
                    <option value="APCPDCL">APCPDCL (Central Andhra Pradesh)</option>
                    <option value="APEPDCL">APEPDCL (Eastern Andhra Pradesh)</option>
                    <option value="APSPDCL">APSPDCL (Southern Andhra Pradesh)</option>
                    <option value="TSSPDCL">TSSPDCL (Telangana)</option>
                    <option value="Other">Other State DISCOM</option>
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
                    <label>Roof Ownership / Permission *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={qualForm.roofOwnership}
                      onChange={e => setQualForm({ ...qualForm, roofOwnership: e.target.value })}
                    >
                      <option value="Owned">Owned (Sole owner of house & roof)</option>
                      <option value="Rented">Rented (Requires Landlord NOC)</option>
                      <option value="Shared">Shared / Apartment (Requires Society/RWA NOC)</option>
                    </select>
                  </div>
                  <div className="sales-form-group">
                    <label>Roof Type *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={qualForm.roofType}
                      onChange={e => setQualForm({ ...qualForm, roofType: e.target.value })}
                    >
                      <option value="RCC">RCC (Concrete Flat Roof)</option>
                      <option value="Tin Shed">Tin Shed / Metal Sheet</option>
                      <option value="Slanted">Slanted / Clay Tile Roof</option>
                      <option value="Ground">Ground Mount / Open Land</option>
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

              {/* Pillar 3 & 4: Capacity, Subsidy & Purchase Timeline */}
              <div className="sales-panel" style={{ margin: 0 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={18} color="#d97706" /> 3 & 4. Capacity, PM Surya Ghar Subsidy & Timeline
                </h3>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Required Solar Capacity (kW) *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={qualForm.preferredCapacityKw}
                      onChange={e => setQualForm({ ...qualForm, preferredCapacityKw: Number(e.target.value) })}
                    >
                      <option value="1">1 kW (₹30,000 Subsidy)</option>
                      <option value="2">2 kW (₹60,000 Subsidy)</option>
                      <option value="3">3 kW (₹78,000 Subsidy - Most Popular)</option>
                      <option value="4">4 kW (₹78,000 Subsidy)</option>
                      <option value="5">5 kW (₹78,000 Subsidy)</option>
                      <option value="6">6 kW (₹78,000 Subsidy)</option>
                      <option value="7">7 kW (₹78,000 Subsidy)</option>
                      <option value="8">8 kW (₹78,000 Subsidy)</option>
                      <option value="10">10 kW (Commercial / High Usage)</option>
                    </select>
                  </div>

                  <div className="sales-form-group">
                    <label>PM Surya Ghar Subsidy Interest *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={qualForm.pmSuryaGharSubsidyInterest || 'Yes'}
                      onChange={e => setQualForm({ ...qualForm, pmSuryaGharSubsidyInterest: e.target.value as any })}
                    >
                      <option value="Yes">Yes (Applying for Central Subsidy)</option>
                      <option value="No">No (Commercial / Non-subsidy install)</option>
                      <option value="Needs explanation">Needs explanation (Send WhatsApp Explainer)</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Purchase Timeline *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={qualForm.expectedTimeline}
                      onChange={e => setQualForm({ ...qualForm, expectedTimeline: e.target.value })}
                    >
                      <option value="Immediate">Immediate (Within 7 Days - Hot)</option>
                      <option value="Within 1 month">Within 1 month (Active Planning)</option>
                      <option value="1-3 months">1-3 months (Upcoming Season / Budget)</option>
                      <option value="Exploring">Exploring (Information Gathering)</option>
                    </select>
                  </div>

                  <div className="sales-form-group">
                    <label>Site Visit Requirement *</label>
                    <select 
                      required
                      className="sales-form-control"
                      value={qualForm.siteVisitRequired || 'Yes'}
                      onChange={e => setQualForm({ ...qualForm, siteVisitRequired: e.target.value as any })}
                    >
                      <option value="Yes">Yes (Assign Dealer for Physical Roof Survey)</option>
                      <option value="No">No (Customer provided clear photos/measurements)</option>
                    </select>
                  </div>
                </div>

                {/* Final Qualification Outcome */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '0.75rem' }}>
                  <div className="sales-form-group" style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontWeight: 700, color: '#0b1f3a' }}>Final Qualification Result *</label>
                    <select 
                      required
                      className="sales-form-control"
                      style={{ fontWeight: 600, fontSize: '0.95rem' }}
                      value={qualForm.qualificationResult || 'Qualified'}
                      onChange={e => setQualForm({ ...qualForm, qualificationResult: e.target.value as any })}
                    >
                      <option value="Qualified">✅ Qualified (Ready for Proposal / Site Survey)</option>
                      <option value="Needs Follow-up">⏳ Needs Follow-up (Pending Document / Bill Verification)</option>
                      <option value="Not Qualified">❌ Not Qualified (Unsuitable Roof / No Owner Consent / Zero Budget)</option>
                    </select>
                  </div>

                  <div className="sales-form-group" style={{ marginBottom: 0 }}>
                    <label>Technical Qualification Notes</label>
                    <textarea 
                      rows={2} 
                      className="sales-form-control"
                      placeholder="e.g. Customer has 600 sq ft RCC terrace in Tenali. ₹3,200 bill, wants 3kW system with PM Surya Ghar subsidy..."
                      value={qualForm.notes}
                      onChange={e => setQualForm({ ...qualForm, notes: e.target.value })}
                    />
                  </div>
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
                  disabled={isSaving}
                  className="sales-btn-primary" 
                  style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center', background: '#38bdf8', color: '#0b1f3a' }}
                >
                  <CheckCircle2 size={16} /> {isSaving ? 'Saving to Firestore...' : 'Save Solar Qualification'}
                </button>
              </div>

              {/* Next Steps Card */}
              <div className="sales-panel">
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0b1f3a' }}>Recommended Next Steps</h4>
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
                    <ArrowRight size={14} /> Send PM Surya Ghar Subsidy Guide
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="sales-panel" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
          <h4>No assigned leads found for qualification</h4>
          <p>Please check your assigned leads desk or select a lead to begin qualification.</p>
        </div>
      )}
    </div>
  );
}
