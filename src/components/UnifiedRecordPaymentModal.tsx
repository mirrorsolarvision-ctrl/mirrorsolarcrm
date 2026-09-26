import React, { useState, useEffect } from 'react';
import { 
  X, ArrowDownLeft, ArrowUpRight, Upload, 
  IndianRupee, CheckCircle2, Clock, AlertCircle, FileText, Loader2, Sparkles, Building2, User
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import type { 
  MockLead, 
  PaymentMilestoneType, 
  CustomerPaymentType, 
  CustomerPaymentMode 
} from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import './UnifiedRecordPaymentModal.css';

export type PaymentRecordModalType = 'customer_to_vendor' | 'vendor_to_dealer';

interface UnifiedRecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: PaymentRecordModalType;
  defaultLeadId?: string;
  onSuccess?: () => void;
}

export default function UnifiedRecordPaymentModal({
  isOpen,
  onClose,
  defaultType = 'customer_to_vendor',
  defaultLeadId,
  onSuccess
}: UnifiedRecordPaymentModalProps) {
  const { 
    leads, 
    currentUser, 
    addCustomerPayment, 
    settleLeadPayment 
  } = useCRM();
  const { showToast } = useUI();

  const [activeType, setActiveType] = useState<PaymentRecordModalType>(defaultType);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(defaultLeadId || '');

  // Form State for Customer -> Vendor
  const [customerForm, setCustomerForm] = useState({
    amount: '',
    paymentType: 'Booking / Advance' as CustomerPaymentType,
    paymentMode: 'UPI' as CustomerPaymentMode,
    referenceNumber: '',
    paidAt: new Date().toISOString().split('T')[0],
    notes: '',
    file: null as File | null
  });

  // Form State for Vendor -> Dealer Commission
  const [dealerForm, setDealerForm] = useState({
    milestoneType: 'Pre-Installation' as PaymentMilestoneType,
    amount: '',
    utrNumber: '',
    paidAt: new Date().toISOString().split('T')[0],
    adminNotes: '',
    file: null as File | null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync defaults when props change
  useEffect(() => {
    if (isOpen) {
      setActiveType(defaultType);
      if (defaultLeadId) {
        setSelectedLeadId(defaultLeadId);
      } else if (leads.length > 0 && !selectedLeadId) {
        setSelectedLeadId(leads[0].id);
      }
    }
  }, [isOpen, defaultType, defaultLeadId, leads]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Selected Lead Financial Calculations
  const customerPayments = selectedLead?.payments?.customerPayments || [];
  const totalCustomerPaid = customerPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalProjectCost = selectedLead?.payments?.totalProjectCost || 0;
  const customerBalanceDue = Math.max(0, totalProjectCost - totalCustomerPaid);

  const preMilestone = selectedLead?.payments?.preInstallation;
  const postMilestone = selectedLead?.payments?.postInstallation;
  const totalAgreedCommission = selectedLead?.payments?.totalAgreedAmount || 0;
  const totalDealerSettled = 
    (preMilestone?.status === 'Settled' || preMilestone?.status === 'Received' ? (preMilestone?.amount || 0) : 0) +
    (postMilestone?.status === 'Settled' || postMilestone?.status === 'Received' ? (postMilestone?.amount || 0) : 0);
  const dealerCommissionDue = Math.max(0, totalAgreedCommission - totalDealerSettled);

  // Auto-fill milestone amount if available
  useEffect(() => {
    if (selectedLead && activeType === 'vendor_to_dealer') {
      const milestone = dealerForm.milestoneType === 'Pre-Installation' ? preMilestone : postMilestone;
      if (milestone?.amount && !dealerForm.amount) {
        setDealerForm(prev => ({ ...prev, amount: String(milestone.amount) }));
      }
    }
  }, [dealerForm.milestoneType, selectedLead, activeType]);

  if (!isOpen) return null;

  const uploadToFirebase = async (file: File, folder: string): Promise<string> => {
    const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const handleCustomerPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      showToast('Please select a customer / project lead.', 'error');
      return;
    }
    const numAmount = parseFloat(customerForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount collected.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      let proofUrl = '';
      let proofFileName = '';
      let proofFileSize = 0;

      if (customerForm.file) {
        proofUrl = await uploadToFirebase(customerForm.file, 'payments/customer_receipts');
        proofFileName = customerForm.file.name;
        proofFileSize = customerForm.file.size;
      }

      await addCustomerPayment(selectedLeadId, {
        amount: numAmount,
        paymentType: customerForm.paymentType,
        paymentMode: customerForm.paymentMode,
        paidAt: customerForm.paidAt ? new Date(customerForm.paidAt).toISOString() : new Date().toISOString(),
        referenceNumber: customerForm.referenceNumber.trim(),
        notes: customerForm.notes.trim(),
        proofUrl,
        proofFileName,
        proofFileSize
      });

      showToast(`Customer payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to record customer payment:', err);
      showToast(err.message || 'Failed to record customer payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDealerCommissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      showToast('Please select a project lead.', 'error');
      return;
    }
    const numAmount = parseFloat(dealerForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid commission amount.', 'error');
      return;
    }

    const currentMilestone = dealerForm.milestoneType === 'Pre-Installation' ? preMilestone : postMilestone;

    try {
      setIsSubmitting(true);
      let proofUrl = currentMilestone?.proofUrl || '';
      let proofFileName = currentMilestone?.proofFileName || 'Commission_Voucher.jpg';
      let proofFileSize = currentMilestone?.proofFileSize || 0;

      if (dealerForm.file) {
        proofUrl = await uploadToFirebase(dealerForm.file, 'payments/commission_proofs');
        proofFileName = dealerForm.file.name;
        proofFileSize = dealerForm.file.size;
      }

      await settleLeadPayment(selectedLeadId, dealerForm.milestoneType, {
        amount: numAmount,
        proofUrl,
        proofFileName,
        proofFileSize,
        utrNumber: dealerForm.utrNumber.trim(),
        adminNotes: dealerForm.adminNotes.trim()
      });

      showToast(`Vendor to Dealer Commission of ₹${numAmount.toLocaleString('en-IN')} (${dealerForm.milestoneType}) settled!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to settle commission:', err);
      showToast(err.message || 'Failed to record dealer commission.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="unified-record-modal-overlay" onClick={onClose}>
      <div className="unified-record-modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="unified-modal-header">
          <div className="modal-title-group">
            <div className={`modal-title-icon ${activeType === 'customer_to_vendor' ? 'green-bg' : 'blue-bg'}`}>
              {activeType === 'customer_to_vendor' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
            </div>
            <div>
              <h2>Record Payment Transaction</h2>
              <p>Select whether this is incoming Customer money or Dealer Commission payout</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={20} />
          </button>
        </div>

        {/* 2-TYPE SEGMENTED SELECTOR TABS */}
        <div className="payment-type-selector-bar">
          <button
            type="button"
            className={`type-tab-btn ${activeType === 'customer_to_vendor' ? 'active-green' : ''}`}
            onClick={() => setActiveType('customer_to_vendor')}
          >
            <ArrowDownLeft size={18} />
            <div className="tab-label-text">
              <strong>1. Customer ➔ Vendor Amount</strong>
              <small>Incoming Customer Collections</small>
            </div>
          </button>

          <button
            type="button"
            className={`type-tab-btn ${activeType === 'vendor_to_dealer' ? 'active-blue' : ''}`}
            onClick={() => setActiveType('vendor_to_dealer')}
          >
            <ArrowUpRight size={18} />
            <div className="tab-label-text">
              <strong>2. Vendor ➔ Dealer Commission</strong>
              <small>Dealer Commission Milestone Payout</small>
            </div>
          </button>
        </div>

        {/* PROJECT / CUSTOMER SELECTION */}
        <div className="modal-lead-picker-box">
          <label className="picker-label">Select Customer / Project Lead *</label>
          <select 
            className="picker-select"
            value={selectedLeadId}
            onChange={e => setSelectedLeadId(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">-- Choose Project Lead --</option>
            {leads.map(lead => (
              <option key={lead.id} value={lead.id}>
                {lead.customer} ({lead.phone}) — Stage: {lead.stage} | Dealer: {lead.dealer}
              </option>
            ))}
          </select>
        </div>

        {/* REAL-TIME LEAD SUMMARY CHIPS */}
        {selectedLead && (
          <div className="selected-lead-summary-strip">
            {activeType === 'customer_to_vendor' ? (
              <div className="lead-summary-grid green-theme">
                <div className="summary-item">
                  <span className="lbl">Customer</span>
                  <strong>{selectedLead.customer}</strong>
                </div>
                <div className="summary-item">
                  <span className="lbl">Project Cost</span>
                  <strong>{totalProjectCost > 0 ? `₹${totalProjectCost.toLocaleString('en-IN')}` : 'Not Specified'}</strong>
                </div>
                <div className="summary-item">
                  <span className="lbl">Total Collected</span>
                  <strong className="text-emerald">₹{totalCustomerPaid.toLocaleString('en-IN')}</strong>
                </div>
                <div className="summary-item">
                  <span className="lbl">Payment Status</span>
                  <span className={`status-pill-mini ${totalProjectCost > 0 && totalCustomerPaid >= totalProjectCost ? 'done' : totalCustomerPaid > 0 ? 'partial' : 'pending'}`}>
                    {totalProjectCost > 0 && totalCustomerPaid >= totalProjectCost ? '✓ Fully Paid' : totalCustomerPaid > 0 ? '⏳ Partially Paid' : '⚠️ Pending'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="lead-summary-grid blue-theme">
                <div className="summary-item">
                  <span className="lbl">Beneficiary Dealer</span>
                  <strong>{selectedLead.dealer}</strong>
                </div>
                <div className="summary-item">
                  <span className="lbl">Agreed Commission</span>
                  <strong>{totalAgreedCommission > 0 ? `₹${totalAgreedCommission.toLocaleString('en-IN')}` : 'Not Specified'}</strong>
                </div>
                <div className="summary-item">
                  <span className="lbl">Total Settled</span>
                  <strong className="text-blue">₹{totalDealerSettled.toLocaleString('en-IN')}</strong>
                </div>
                <div className="summary-item">
                  <span className="lbl">Commission Status</span>
                  <span className={`status-pill-mini ${totalDealerSettled > 0 && (totalAgreedCommission === 0 || totalDealerSettled >= totalAgreedCommission) ? 'done' : totalDealerSettled > 0 ? 'partial' : 'pending'}`}>
                    {totalDealerSettled > 0 && (totalAgreedCommission === 0 || totalDealerSettled >= totalAgreedCommission) ? '✓ Settled' : totalDealerSettled > 0 ? '⏳ Partial' : '⚠️ Pending'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1 FORM: CUSTOMER TO VENDOR AMOUNT */}
        {activeType === 'customer_to_vendor' && (
          <form onSubmit={handleCustomerPaymentSubmit} className="modal-tab-form">
            <div className="form-two-col">
              <div className="form-field">
                <label>Amount Collected (₹) *</label>
                <div className="input-with-icon">
                  <span className="input-icon">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="E.g. 50000"
                    value={customerForm.amount}
                    onChange={e => setCustomerForm({ ...customerForm, amount: e.target.value })}
                    className="amount-input green"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Payment Category *</label>
                <select
                  value={customerForm.paymentType}
                  onChange={e => setCustomerForm({ ...customerForm, paymentType: e.target.value as CustomerPaymentType })}
                >
                  <option value="Booking / Advance">Booking / Advance</option>
                  <option value="First Milestone">First Milestone</option>
                  <option value="Bank Loan Disbursal">Bank Loan Disbursal</option>
                  <option value="Final Payment">Final Payment</option>
                  <option value="Subsidy Received">Subsidy Received</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-two-col">
              <div className="form-field">
                <label>Payment Mode *</label>
                <select
                  value={customerForm.paymentMode}
                  onChange={e => setCustomerForm({ ...customerForm, paymentMode: e.target.value as CustomerPaymentMode })}
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                  <option value="Bank Transfer / NEFT">Bank Transfer / NEFT / IMPS</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Loan">Bank Loan Direct</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label>Date Paid</label>
                <input
                  type="date"
                  value={customerForm.paidAt}
                  onChange={e => setCustomerForm({ ...customerForm, paidAt: e.target.value })}
                />
              </div>
            </div>

            <div className="form-field">
              <label>UTR Number / Transaction ID / Cheque #</label>
              <input
                type="text"
                placeholder="E.g. UTR29104810294 or Cheque #883921"
                value={customerForm.referenceNumber}
                onChange={e => setCustomerForm({ ...customerForm, referenceNumber: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>Upload Customer Receipt Screenshot / Proof</label>
              <div 
                className="upload-drop-area"
                onClick={() => document.getElementById('unified-cust-file')?.click()}
              >
                <Upload size={24} />
                <input
                  type="file"
                  id="unified-cust-file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      setCustomerForm({ ...customerForm, file: e.target.files[0] });
                    }
                  }}
                />
                <span>Browse receipt file or screenshot</span>
                {customerForm.file && (
                  <div className="selected-file-notice">
                    ✓ Attached: {customerForm.file.name} ({(customerForm.file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </div>

            <div className="form-field">
              <label>Internal Notes / Remarks</label>
              <textarea
                placeholder="E.g. Received from customer's personal HDFC account..."
                value={customerForm.notes}
                onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="modal-actions-bar">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-submit green-submit"
                disabled={isSubmitting || !customerForm.amount || !selectedLeadId}
              >
                {isSubmitting ? <><Loader2 size={18} className="spin" /> Recording...</> : '✓ Record Customer Payment'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2 FORM: VENDOR TO DEALER COMMISSION */}
        {activeType === 'vendor_to_dealer' && (
          <form onSubmit={handleDealerCommissionSubmit} className="modal-tab-form">
            <div className="form-two-col">
              <div className="form-field">
                <label>Commission Milestone *</label>
                <select
                  value={dealerForm.milestoneType}
                  onChange={e => setDealerForm({ ...dealerForm, milestoneType: e.target.value as PaymentMilestoneType })}
                >
                  <option value="Pre-Installation">1. Pre-Installation Commission Milestone</option>
                  <option value="Post-Installation">2. Post-Installation Commission Milestone</option>
                </select>
              </div>

              <div className="form-field">
                <label>Commission Amount (₹) *</label>
                <div className="input-with-icon">
                  <span className="input-icon">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="E.g. 15000"
                    value={dealerForm.amount}
                    onChange={e => setDealerForm({ ...dealerForm, amount: e.target.value })}
                    className="amount-input blue"
                  />
                </div>
              </div>
            </div>

            <div className="form-two-col">
              <div className="form-field">
                <label>UTR Number / Banking Ref *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. CMS92019482019"
                  value={dealerForm.utrNumber}
                  onChange={e => setDealerForm({ ...dealerForm, utrNumber: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Date Settled</label>
                <input
                  type="date"
                  value={dealerForm.paidAt}
                  onChange={e => setDealerForm({ ...dealerForm, paidAt: e.target.value })}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Upload Payment Proof / Transfer Voucher *</label>
              <div 
                className="upload-drop-area"
                onClick={() => document.getElementById('unified-dealer-file')?.click()}
              >
                <Upload size={24} />
                <input
                  type="file"
                  id="unified-dealer-file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      setDealerForm({ ...dealerForm, file: e.target.files[0] });
                    }
                  }}
                />
                <span>Browse bank transfer screenshot or PDF voucher</span>
                {dealerForm.file && (
                  <div className="selected-file-notice">
                    ✓ Attached: {dealerForm.file.name} ({(dealerForm.file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </div>

            <div className="form-field">
              <label>Admin Remarks / Payout Notes</label>
              <textarea
                placeholder="E.g. Commission transferred to dealer registered bank account..."
                value={dealerForm.adminNotes}
                onChange={e => setDealerForm({ ...dealerForm, adminNotes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="modal-actions-bar">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-submit blue-submit"
                disabled={isSubmitting || !dealerForm.amount || !selectedLeadId}
              >
                {isSubmitting ? <><Loader2 size={18} className="spin" /> Settling...</> : '✓ Settle & Record Dealer Commission'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
