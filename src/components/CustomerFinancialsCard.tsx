import React, { useState } from 'react';
import { 
  CreditCard, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, 
  AlertCircle, Download, ExternalLink, Plus, Edit2, Check, X,
  IndianRupee, ShieldCheck, FileText, Eye, Building2, User
} from 'lucide-react';
import type { MockLead, CustomerPaymentRecord, PaymentMilestone } from '../context/CRMContext';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import './CustomerFinancialsCard.css';

interface CustomerFinancialsCardProps {
  lead: MockLead;
  onOpenRecordModal: (type: 'customer_to_vendor' | 'vendor_to_dealer') => void;
}

export default function CustomerFinancialsCard({ lead, onOpenRecordModal }: CustomerFinancialsCardProps) {
  const { updateLead, currentUser } = useCRM();
  const { showToast } = useUI();
  const isAdmin = currentUser?.role === 'Admin';

  // Inline edit state for total project cost and agreed commission
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [editProjectCost, setEditProjectCost] = useState(String(lead.payments?.totalProjectCost || ''));
  const [editAgreedCommission, setEditAgreedCommission] = useState(String(lead.payments?.totalAgreedAmount || ''));

  // 1. Customer -> Vendor Financials
  const customerPayments = lead.payments?.customerPayments || [];
  const totalCustomerPaid = customerPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalProjectCost = lead.payments?.totalProjectCost || 0;
  const customerBalanceRemaining = Math.max(0, totalProjectCost - totalCustomerPaid);

  let customerPaymentStatus: 'done' | 'partial' | 'pending' = 'pending';
  if (totalCustomerPaid > 0 && totalProjectCost > 0 && totalCustomerPaid >= totalProjectCost) {
    customerPaymentStatus = 'done';
  } else if (totalCustomerPaid > 0) {
    customerPaymentStatus = 'partial';
  }

  // 2. Vendor -> Dealer Commission Financials
  const preMilestone = lead.payments?.preInstallation;
  const postMilestone = lead.payments?.postInstallation;
  const totalAgreedCommission = lead.payments?.totalAgreedAmount || 0;

  const isPreSettled = preMilestone?.status === 'Settled' || preMilestone?.status === 'Received';
  const isPostSettled = postMilestone?.status === 'Settled' || postMilestone?.status === 'Received';

  const totalDealerSettled = 
    (isPreSettled ? (preMilestone?.amount || 0) : 0) +
    (isPostSettled ? (postMilestone?.amount || 0) : 0);

  const dealerCommissionRemaining = Math.max(0, totalAgreedCommission - totalDealerSettled);

  let dealerCommissionStatus: 'done' | 'partial' | 'pending' = 'pending';
  if (isPreSettled && isPostSettled) {
    dealerCommissionStatus = 'done';
  } else if (isPreSettled || isPostSettled || totalDealerSettled > 0) {
    dealerCommissionStatus = 'partial';
  }

  const handleSaveCosts = async () => {
    try {
      const numCost = editProjectCost ? parseFloat(editProjectCost) : 0;
      const numCommission = editAgreedCommission ? parseFloat(editAgreedCommission) : 0;

      await updateLead(lead.id, {
        payments: {
          ...lead.payments,
          totalProjectCost: numCost,
          totalAgreedAmount: numCommission
        }
      });

      showToast('Project cost and agreed commission updated!', 'success');
      setIsEditingCosts(false);
    } catch (err: any) {
      showToast('Failed to update cost settings.', 'error');
    }
  };

  return (
    <div className="customer-financials-ledger-card">
      {/* Header Bar */}
      <div className="financials-card-header">
        <div className="title-left">
          <div className="fin-icon-wrap">
            <CreditCard size={20} />
          </div>
          <div>
            <h3>Financials & Commission Tracking</h3>
            <span className="subtitle">Real-time status for Customer Collections and Dealer Payouts</span>
          </div>
        </div>

        <div className="header-actions">
          {isAdmin && !isEditingCosts && (
            <button 
              className="btn-edit-costs"
              onClick={() => {
                setEditProjectCost(String(lead.payments?.totalProjectCost || ''));
                setEditAgreedCommission(String(lead.payments?.totalAgreedAmount || ''));
                setIsEditingCosts(true);
              }}
            >
              <Edit2 size={14} /> Set Project / Commission Cost
            </button>
          )}

          {isEditingCosts && (
            <div className="inline-cost-edit-form">
              <div className="cost-input-group">
                <label>Project Cost (₹):</label>
                <input 
                  type="number" 
                  value={editProjectCost}
                  onChange={e => setEditProjectCost(e.target.value)}
                  placeholder="E.g. 250000"
                />
              </div>
              <div className="cost-input-group">
                <label>Dealer Commission (₹):</label>
                <input 
                  type="number" 
                  value={editAgreedCommission}
                  onChange={e => setEditAgreedCommission(e.target.value)}
                  placeholder="E.g. 25000"
                />
              </div>
              <button className="btn-save-sm" onClick={handleSaveCosts}><Check size={14} /> Save</button>
              <button className="btn-cancel-sm" onClick={() => setIsEditingCosts(false)}><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* DUAL PAYMENT SPLIT COLUMNS */}
      <div className="financials-dual-grid">
        {/* ========================================================= */}
        {/* 1. CUSTOMER TO VENDOR PAYMENT SECTION                     */}
        {/* ========================================================= */}
        <div className="payment-column customer-inflow-col">
          <div className="col-top-bar">
            <div className="col-title-flex">
              <span className="type-badge incoming">
                <ArrowDownLeft size={14} /> Type 1: Inflow
              </span>
              <h4>Customer ➔ Vendor Amount</h4>
            </div>

            {/* STATUS BADGE: DONE vs PARTIAL vs PENDING */}
            <div className={`grand-status-pill ${customerPaymentStatus}`}>
              {customerPaymentStatus === 'done' && (
                <>
                  <CheckCircle2 size={15} />
                  <span>Payment Done (Paid)</span>
                </>
              )}
              {customerPaymentStatus === 'partial' && (
                <>
                  <Clock size={15} />
                  <span>Partially Paid (₹{totalCustomerPaid.toLocaleString('en-IN')})</span>
                </>
              )}
              {customerPaymentStatus === 'pending' && (
                <>
                  <AlertCircle size={15} />
                  <span>Payment Not Done (Pending)</span>
                </>
              )}
            </div>
          </div>

          {/* Metric Bar */}
          <div className="fin-metric-strip green-strip">
            <div className="fin-metric-cell">
              <span className="metric-caption">Total Project Value</span>
              <span className="metric-val">
                {totalProjectCost > 0 ? `₹${totalProjectCost.toLocaleString('en-IN')}` : 'Not Specified'}
              </span>
            </div>
            <div className="fin-metric-cell">
              <span className="metric-caption">Total Received</span>
              <span className="metric-val text-emerald">₹{totalCustomerPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className="fin-metric-cell">
              <span className="metric-caption">Balance Due</span>
              <span className="metric-val text-amber">
                {totalProjectCost > 0 ? `₹${customerBalanceRemaining.toLocaleString('en-IN')}` : '₹0'}
              </span>
            </div>
          </div>

          {/* Customer Payments Breakdown List */}
          <div className="payments-breakdown-box">
            <div className="breakdown-header">
              <strong>Recorded Receipts ({customerPayments.length})</strong>
              <button 
                type="button"
                className="btn-quick-record green-btn"
                onClick={() => onOpenRecordModal('customer_to_vendor')}
              >
                <Plus size={14} /> Record Customer Payment
              </button>
            </div>

            {customerPayments.length === 0 ? (
              <div className="empty-payments-notice">
                <AlertCircle size={18} color="#94a3b8" />
                <span>No customer receipts recorded yet. Click above to log advance or milestone payments.</span>
              </div>
            ) : (
              <div className="records-mini-table">
                {customerPayments.map((p, idx) => (
                  <div key={p.id || idx} className="record-table-row">
                    <div className="row-left">
                      <div className="row-primary-line">
                        <span className="rec-cat">{p.paymentType}</span>
                        <span className="rec-amount">₹{p.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="row-secondary-line">
                        <span>{p.paymentMode}</span>
                        {p.referenceNumber && <span>• UTR: {p.referenceNumber}</span>}
                        <span>• {new Date(p.paidAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="row-right">
                      <span className={`verif-badge ${p.status === 'Verified' ? 'verified' : 'pending'}`}>
                        {p.status === 'Verified' ? '✓ Verified' : '⏳ Pending'}
                      </span>
                      {p.proofUrl && (
                        <a 
                          href={p.proofUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="proof-link-btn" 
                          title="View Receipt Screenshot"
                        >
                          <FileText size={14} /> Receipt
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. VENDOR TO DEALER COMMISSION SECTION                    */}
        {/* ========================================================= */}
        <div className="payment-column dealer-outflow-col">
          <div className="col-top-bar">
            <div className="col-title-flex">
              <span className="type-badge outgoing">
                <ArrowUpRight size={14} /> Type 2: Outflow
              </span>
              <h4>Vendor ➔ Dealer Commission</h4>
            </div>

            {/* STATUS BADGE: DONE vs PARTIAL vs PENDING */}
            <div className={`grand-status-pill ${dealerCommissionStatus}`}>
              {dealerCommissionStatus === 'done' && (
                <>
                  <CheckCircle2 size={15} />
                  <span>Commission Done (Settled)</span>
                </>
              )}
              {dealerCommissionStatus === 'partial' && (
                <>
                  <Clock size={15} />
                  <span>Partially Settled (₹{totalDealerSettled.toLocaleString('en-IN')})</span>
                </>
              )}
              {dealerCommissionStatus === 'pending' && (
                <>
                  <AlertCircle size={15} />
                  <span>Commission Not Done (Pending)</span>
                </>
              )}
            </div>
          </div>

          {/* Metric Bar */}
          <div className="fin-metric-strip blue-strip">
            <div className="fin-metric-cell">
              <span className="metric-caption">Agreed Commission</span>
              <span className="metric-val">
                {totalAgreedCommission > 0 ? `₹${totalAgreedCommission.toLocaleString('en-IN')}` : 'Not Specified'}
              </span>
            </div>
            <div className="fin-metric-cell">
              <span className="metric-caption">Total Settled</span>
              <span className="metric-val text-blue">₹{totalDealerSettled.toLocaleString('en-IN')}</span>
            </div>
            <div className="fin-metric-cell">
              <span className="metric-caption">Commission Due</span>
              <span className="metric-val text-rose">
                {totalAgreedCommission > 0 ? `₹${dealerCommissionRemaining.toLocaleString('en-IN')}` : '₹0'}
              </span>
            </div>
          </div>

          {/* Dealer Milestones Breakdown */}
          <div className="payments-breakdown-box">
            <div className="breakdown-header">
              <strong>Dealer Milestones ({lead.dealer || 'Assigned Dealer'})</strong>
              <button 
                type="button"
                className="btn-quick-record blue-btn"
                onClick={() => onOpenRecordModal('vendor_to_dealer')}
              >
                <Plus size={14} /> Record Dealer Commission
              </button>
            </div>

            <div className="milestones-vertical-list">
              {/* Pre-Installation Milestone */}
              <div className={`milestone-card-item ${isPreSettled ? 'settled' : 'pending'}`}>
                <div className="mile-left">
                  <div className="mile-title">
                    <span className="num-circle">1</span>
                    <strong>Pre-Installation Milestone</strong>
                  </div>
                  <div className="mile-meta">
                    {preMilestone?.amount ? (
                      <span className="mile-amt">₹{preMilestone.amount.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="mile-amt text-muted">Amount not set</span>
                    )}
                    {preMilestone?.utrNumber && <span>• UTR: {preMilestone.utrNumber}</span>}
                    {preMilestone?.settledAt && <span>• {new Date(preMilestone.settledAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="mile-right">
                  <span className={`mile-status-tag ${isPreSettled ? 'done' : 'pending'}`}>
                    {preMilestone?.status === 'Received' ? '✓ Received by Dealer' : preMilestone?.status === 'Settled' ? '✓ Settled' : '⚠️ Pending'}
                  </span>
                  {preMilestone?.proofUrl && (
                    <a href={preMilestone.proofUrl} target="_blank" rel="noreferrer" className="proof-link-btn" title="View Transfer Proof">
                      <FileText size={14} /> Voucher
                    </a>
                  )}
                </div>
              </div>

              {/* Post-Installation Milestone */}
              <div className={`milestone-card-item ${isPostSettled ? 'settled' : 'pending'}`}>
                <div className="mile-left">
                  <div className="mile-title">
                    <span className="num-circle">2</span>
                    <strong>Post-Installation Milestone</strong>
                  </div>
                  <div className="mile-meta">
                    {postMilestone?.amount ? (
                      <span className="mile-amt">₹{postMilestone.amount.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="mile-amt text-muted">Amount not set</span>
                    )}
                    {postMilestone?.utrNumber && <span>• UTR: {postMilestone.utrNumber}</span>}
                    {postMilestone?.settledAt && <span>• {new Date(postMilestone.settledAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="mile-right">
                  <span className={`mile-status-tag ${isPostSettled ? 'done' : 'pending'}`}>
                    {postMilestone?.status === 'Received' ? '✓ Received by Dealer' : postMilestone?.status === 'Settled' ? '✓ Settled' : '⚠️ Pending'}
                  </span>
                  {postMilestone?.proofUrl && (
                    <a href={postMilestone.proofUrl} target="_blank" rel="noreferrer" className="proof-link-btn" title="View Transfer Proof">
                      <FileText size={14} /> Voucher
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
