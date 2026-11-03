import React, { useState, useMemo } from 'react';
import { 
  CreditCard, Award, CheckCircle2, AlertTriangle, 
  Upload, ShieldAlert, FileText, Check, X, ShieldCheck
} from 'lucide-react';
import { useCRM, type MockLead, type CustomerPaymentRecord } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';

interface SalesBookingsViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
  initialLeadId?: string;
}

export default function SalesBookingsView({
  onNavigateSubView: _onNavigateSubView,
  initialLeadId
}: SalesBookingsViewProps) {
  const { currentUser, leads, updateLead, addActivity } = useCRM();
  const isManager = isSalesManager(currentUser);
  const isAdmin = currentUser?.role === 'Admin';
  const isAccounts = (currentUser?.role as any) === 'Accounts' || 
                     currentUser?.employeeCategory === 'Accounts' || 
                     (currentUser as any)?.category === 'Accounts';
  const canVerifyPayment = isAdmin || isAccounts;
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
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Form State for Payment Submission
  const [paymentForm, setPaymentForm] = useState({
    amount: 10000,
    paymentMode: 'UPI' as 'UPI' | 'NEFT / RTGS' | 'Cheque' | 'Cash',
    referenceNumber: '',
    proofFileName: '',
    notes: 'Advance booking deposit for rooftop solar equipment allotment.'
  });

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  // Leads with advance payments submitted
  const leadsWithPayments = useMemo(() => {
    return scopedLeads.filter(l => 
      l.payments?.customerPayments && l.payments.customerPayments.length > 0
    );
  }, [scopedLeads]);

  // Handle Payment Submit
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !paymentForm.amount) return;

    const paymentModeNormalized = 
      paymentForm.paymentMode === 'NEFT / RTGS' ? 'Bank Transfer / NEFT' as const : 
      paymentForm.paymentMode === 'UPI' ? 'UPI' as const : 
      paymentForm.paymentMode === 'Cheque' ? 'Cheque' as const : 'Cash' as const;

    const newPaymentRecord: CustomerPaymentRecord = {
      id: `PAY-${Date.now()}`,
      leadId: activeLead.id,
      customerName: activeLead.customer,
      amount: Number(paymentForm.amount),
      paymentType: 'Booking / Advance',
      paymentMode: paymentModeNormalized,
      status: 'Pending Verification',
      paidAt: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      mode: paymentModeNormalized,
      recordedBy: currentUserName,
      recordedByUid: currentUserId,
      recordedByEmail: currentUser?.email || '',
      recordedByRole: isManager ? 'Sales Manager' : 'Telecaller',
      referenceNumber: paymentForm.referenceNumber || `UTR-${Date.now().toString().slice(-8)}`,
      proofFileName: paymentForm.proofFileName || 'payment_receipt.jpg',
      notes: paymentForm.notes
    };

    const existingPayments = activeLead.payments?.customerPayments || [];
    const updatedPayments = [...existingPayments, newPaymentRecord];

    await updateLead(activeLead.id, {
      salesStage: 'Advance Submitted',
      payments: {
        ...activeLead.payments,
        customerPayments: updatedPayments,
        totalProjectCost: activeLead.payments?.totalProjectCost || 205000
      }
    });

    addActivity({
      type: 'Advance Payment Submitted',
      message: `Advance payment of ₹${paymentForm.amount.toLocaleString()} (${paymentForm.paymentMode} - Ref: ${paymentForm.referenceNumber}) submitted for customer ${activeLead.customer}`,
      user: currentUserName,
      leadId: activeLead.id
    });

    setIsSubmitModalOpen(false);
    alert('Payment evidence successfully submitted! Status set to Pending Accounts Verification.');
  };

  // Admin/Accounts Only Verification
  const handleVerifyPayment = async (lead: MockLead, paymentId: string) => {
    if (!canVerifyPayment) {
      alert('Permission Denied: Payment verification is strictly reserved for Admin & Accounts authority.');
      return;
    }

    const targetPayment = (lead.payments?.customerPayments || []).find(p => p.id === paymentId);
    if (!targetPayment) return;

    // Segregation of duties: prevent self-approval using immutable UID & fallback name check
    // Anti-self-approval is strictly enforced across ALL users (including Super Admin)
    const isSelfRecorded = (
      (targetPayment.recordedByUid && targetPayment.recordedByUid === currentUserId) ||
      (targetPayment.recordedBy && targetPayment.recordedBy.toLowerCase().trim() === currentUserName.toLowerCase().trim())
    );

    if (isSelfRecorded) {
      alert('Segregation of Duties Violation: You cannot verify a payment you personally recorded. Verification must be performed by an independent secondary verifier.');
      return;
    }

    try {
      // 1. Invoke Trusted Backend Cloud Function
      const verifyPaymentFn = httpsCallable(functions, 'verifyCustomerPayment');
      await verifyPaymentFn({
        leadId: lead.id,
        paymentId: paymentId,
        verifiedAmount: targetPayment.amount,
        referenceNumber: targetPayment.referenceNumber
      });

      alert(`Payment ${paymentId} verified successfully via trusted backend! Project booking is now confirmed.`);

      addActivity({
        type: 'Payment Verified & Booking Confirmed',
        message: `Advance payment of ₹${targetPayment.amount?.toLocaleString()} verified by ${isAdmin ? 'Admin' : 'Accounts'} (${currentUserName}). Booking Confirmed for ${lead.customer}.`,
        user: currentUserName,
        leadId: lead.id
      });
    } catch (backendErr: any) {
      console.error("Trusted backend verification failed:", backendErr);
      // Hardened Financial Control: Never fallback to client write on function failure.
      // The payment remains in 'Pending Verification' state until verified by authoritative Cloud Function.
      alert(`Payment verification failed: ${backendErr.message || 'Operation requires trusted backend verification authority.'}\n\nThe payment status remains "Pending Verification".`);
    }
  };

  return (
    <div className="sales-bookings-content">
      {/* RBAC Notice Banner */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid #0284c7', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#0b1f3a', fontSize: '0.95rem' }}>
          <ShieldAlert size={18} color="#0284c7" />
          Authorized Financial Controls & Segregation of Duties
        </div>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.825rem', color: '#475569' }}>
          Sales Managers and Telecalling Employees have authority to collect and submit customer advance booking evidence. 
          Final payment verification and operational project confirmation is <strong>strictly reserved for Admin & Accounts</strong>.
        </p>
      </div>

      {/* Top Panel */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Booking & Advance Payment Submission
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Record customer advance tokens, upload bank transfer receipts, and track accounts verification.
            </p>
          </div>

          <button className="sales-btn-primary" onClick={() => setIsSubmitModalOpen(true)}>
            <CreditCard size={16} /> Submit Advance Payment
          </button>
        </div>
      </div>

      {/* Bookings & Payments Table */}
      <div className="sales-panel">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0b1f3a' }}>
          Submitted Customer Advance Records
        </h3>

        {leadsWithPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <Award size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0b1f3a' }}>No advance payments recorded yet</h4>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Click "Submit Advance Payment" to record a customer booking deposit.</p>
          </div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Customer Name & Phone</th>
                  <th>System Size</th>
                  <th>Advance Amount</th>
                  <th>Payment Mode & Ref</th>
                  <th>Date</th>
                  <th>Verification Status</th>
                  <th>Booking Status</th>
                  {canVerifyPayment && <th>Verification Action</th>}
                </tr>
              </thead>
              <tbody>
                {leadsWithPayments.map(lead => {
                  return (lead.payments?.customerPayments || []).map(payment => {
                    const isVerified = payment.status === 'Verified';

                    return (
                      <tr key={payment.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{lead.customer}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.phone}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', color: '#0369a1' }}>
                            {lead.qualificationData?.preferredCapacityKw || 3} kW
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0b1f3a' }}>
                            ₹{payment.amount.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.825rem', fontWeight: 500 }}>{payment.paymentMode}</div>
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Ref: {payment.referenceNumber || 'N/A'}</div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {payment.date || (payment.paidAt ? payment.paidAt.split('T')[0] : 'N/A')}
                        </td>
                        <td>
                          <span className={`sales-badge ${isVerified ? 'connected' : 'warm'}`}>
                            {isVerified ? '✓ Verified by Accounts' : '⏳ Pending Accounts Verification'}
                          </span>
                        </td>
                        <td>
                          <span className="sales-badge" style={{ background: isVerified ? '#dcfce7' : '#fef3c7', color: isVerified ? '#15803d' : '#b45309' }}>
                            {isVerified ? 'Booking Confirmed' : 'Advance Submitted'}
                          </span>
                        </td>
                        {canVerifyPayment && (
                          <td>
                            {!isVerified && (
                              <button 
                                className="sales-btn-primary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: '#16a34a' }}
                                onClick={() => handleVerifyPayment(lead, payment.id)}
                              >
                                <Check size={12} /> Verify Payment
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Advance Modal */}
      {isSubmitModalOpen && (
        <div className="sales-modal-overlay" onClick={() => setIsSubmitModalOpen(false)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3><CreditCard size={18} style={{ display: 'inline', marginRight: '6px' }} /> Record Advance Booking Payment</h3>
              <button className="sales-modal-close-btn" onClick={() => setIsSubmitModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="sales-modal-body">
                <div className="sales-form-group">
                  <label>Select Customer *</label>
                  <select 
                    className="sales-form-control"
                    value={selectedLeadId}
                    onChange={e => setSelectedLeadId(e.target.value)}
                  >
                    {scopedLeads.map(l => (
                      <option key={l.id} value={l.id}>{l.customer} ({l.phone}) - {l.salesStage || 'New'}</option>
                    ))}
                  </select>
                </div>

                <div className="sales-form-row">
                  <div className="sales-form-group">
                    <label>Advance Amount (₹) *</label>
                    <input 
                      type="number" 
                      required
                      step="500"
                      className="sales-form-control"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="sales-form-group">
                    <label>Payment Mode *</label>
                    <select 
                      className="sales-form-control"
                      value={paymentForm.paymentMode}
                      onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value as any })}
                    >
                      <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                      <option value="NEFT / RTGS">NEFT / RTGS / Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash Receipt</option>
                    </select>
                  </div>
                </div>

                <div className="sales-form-group">
                  <label>Transaction Reference / UTR Number *</label>
                  <input 
                    type="text" 
                    required
                    className="sales-form-control"
                    placeholder="e.g. 428901239876 or SBI Cheque #123456"
                    value={paymentForm.referenceNumber}
                    onChange={e => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  />
                </div>

                <div className="sales-form-group">
                  <label>Upload Payment Evidence / Receipt (Filename / Screenshot)</label>
                  <input 
                    type="text" 
                    className="sales-form-control"
                    placeholder="e.g. upi_screenshot_ramesh.png"
                    value={paymentForm.proofFileName}
                    onChange={e => setPaymentForm({ ...paymentForm, proofFileName: e.target.value })}
                  />
                </div>

                <div className="sales-form-group">
                  <label>Booking Notes</label>
                  <textarea 
                    rows={2}
                    className="sales-form-control"
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="sales-modal-footer">
                <button type="button" className="sales-btn-secondary" onClick={() => setIsSubmitModalOpen(false)}>Cancel</button>
                <button type="submit" className="sales-btn-primary">Submit for Accounts Verification</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
