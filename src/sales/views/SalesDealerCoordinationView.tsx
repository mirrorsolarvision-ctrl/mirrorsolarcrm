import React, { useState, useMemo } from 'react';
import { 
  Building, Calendar, Clock, CheckCircle2, 
  AlertTriangle, Phone, MapPin, User, ArrowRight, 
  Check, X, ShieldAlert, FileText
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';

interface SalesDealerCoordinationViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
  initialLeadId?: string;
}

export default function SalesDealerCoordinationView({
  onNavigateSubView: _onNavigateSubView,
  initialLeadId
}: SalesDealerCoordinationViewProps) {
  const { currentUser, leads, dealers, updateLead, addActivity } = useCRM();
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
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [surveyDate, setSurveyDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [surveyTime, setSurveyTime] = useState<string>('11:00 AM');
  const [surveyNotes, setSurveyNotes] = useState<string>('Inspect RCC 2nd floor roof, measure cable route to ground floor net meter.');

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  // Active dealers list
  const activeDealers = useMemo(() => {
    return dealers.filter(d => d.status === 'Active');
  }, [dealers]);

  // Selected dealer details
  const activeDealerObj = useMemo(() => {
    return activeDealers.find(d => d.id === selectedDealerId || d.name === activeLead?.dealer);
  }, [activeDealers, selectedDealerId, activeLead]);

  // Handle Schedule Survey Request
  const handleScheduleSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;

    const chosenDealer = activeDealers.find(d => d.id === selectedDealerId) || activeDealers[0];

    await updateLead(activeLead.id, {
      dealer: chosenDealer ? chosenDealer.name : (activeLead.dealer || 'Authorized Dealer'),
      dealerId: chosenDealer ? chosenDealer.id : activeLead.dealerId,
      salesStage: 'Site Survey Scheduled',
      followUp: {
        date: surveyDate,
        time: surveyTime,
        type: 'Visit',
        status: 'Upcoming',
        notes: `Dealer Site Survey scheduled with ${chosenDealer ? chosenDealer.name : 'Dealer'}: ${surveyNotes}`
      }
    });

    addActivity({
      type: 'Site Survey Scheduled',
      message: `Site survey requested for ${activeLead.customer} with dealer ${chosenDealer ? chosenDealer.name : 'Dealer'} on ${surveyDate}`,
      user: currentUserName,
      leadId: activeLead.id
    });

    alert(`Site survey successfully coordinated with ${chosenDealer ? chosenDealer.name : 'Dealer'}!`);
  };

  // Pending handoff leads
  const pendingHandoffLeads = useMemo(() => {
    return scopedLeads.filter(l => 
      l.salesStage === 'Booking Confirmed' || l.salesStage === 'Site Survey Completed'
    );
  }, [scopedLeads]);

  return (
    <div className="sales-dealers-content">
      {/* Top Banner */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Site Survey & Dealer Field Coordination
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Coordinate rooftop physical feasibility inspections with authorized regional solar dealers.
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
                <option key={l.id} value={l.id}>{l.customer} ({l.phone}) - {l.dealer || 'No Dealer'}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeLead && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem' }}>
          {/* Left: Schedule Form */}
          <div className="sales-panel" style={{ margin: 0 }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0b1f3a' }}>
              Schedule Dealer Site Survey
            </h3>

            <form onSubmit={handleScheduleSurvey}>
              <div className="sales-form-group">
                <label>Select Regional Authorized Dealer *</label>
                <select 
                  className="sales-form-control"
                  value={selectedDealerId}
                  onChange={e => setSelectedDealerId(e.target.value)}
                >
                  <option value="">-- Choose Authorized Dealer --</option>
                  {activeDealers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} • {d.address || 'AP Territory'} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sales-form-row">
                <div className="sales-form-group">
                  <label>Scheduled Inspection Date *</label>
                  <input 
                    type="date" 
                    required 
                    className="sales-form-control"
                    value={surveyDate}
                    onChange={e => setSurveyDate(e.target.value)}
                  />
                </div>
                <div className="sales-form-group">
                  <label>Scheduled Time Slot *</label>
                  <input 
                    type="time" 
                    required 
                    className="sales-form-control"
                    value={surveyTime}
                    onChange={e => setSurveyTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="sales-form-group">
                <label>Technical Inspection Instructions / Customer Notes</label>
                <textarea 
                  rows={3}
                  className="sales-form-control"
                  value={surveyNotes}
                  onChange={e => setSurveyNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="sales-btn-primary" style={{ marginTop: '0.5rem' }}>
                <CheckCircle2 size={16} /> Assign Survey to Dealer & Notify
              </button>
            </form>
          </div>

          {/* Right: Dealer Profile & Technical Findings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="sales-panel" style={{ margin: 0 }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0b1f3a' }}>
                Dealer Contact Information
              </h4>

              {activeDealerObj ? (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0b1f3a' }}>{activeDealerObj.name}</div>
                  <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
                    <MapPin size={12} style={{ display: 'inline' }} /> {activeDealerObj.address || 'Regional Office'}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#0369a1', marginTop: '4px' }}>
                    <Phone size={12} style={{ display: 'inline' }} /> {activeDealerObj.phone}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '6px', fontWeight: 600 }}>
                    ✓ Authorized Mirror Solar Installation Partner
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.825rem', color: '#64748b' }}>Select a dealer on the left to review contact details.</p>
              )}
            </div>

            {/* Pending Handoff Monitor */}
            <div className="sales-panel" style={{ margin: 0 }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0b1f3a' }}>
                Pending Project Handoffs ({pendingHandoffLeads.length})
              </h4>
              <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
                Customers with confirmed bookings ready for dealer project execution.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                {pendingHandoffLeads.map(lead => (
                  <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{lead.customer}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Dealer: {lead.dealer || 'Pending'}</div>
                    </div>
                    <span className="sales-badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.7rem' }}>
                      Ready
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
