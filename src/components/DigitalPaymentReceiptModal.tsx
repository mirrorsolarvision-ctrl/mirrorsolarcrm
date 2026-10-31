import React from 'react';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  Share2, 
  Copy, 
  Building2, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  CreditCard, 
  Calendar 
} from 'lucide-react';
import logoUrl from '../assets/mirrorsolarlogo.png';
import type { CustomerPaymentRecord, MockLead } from '../context/CRMContext';
import './DigitalPaymentReceiptModal.css';

export function amountInWordsIndian(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(num: number): string {
    if (num === 0) return '';
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    const unit = num % 10;
    const ten = Math.floor(num / 10);
    return tens[ten] + (unit ? ' ' + units[unit] : '');
  }

  function convertThreeDigits(num: number): string {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    let res = '';
    if (hundred > 0) {
      res += units[hundred] + ' Hundred';
      if (remainder > 0) res += ' and ';
    }
    if (remainder > 0) {
      res += convertTwoDigits(remainder);
    }
    return res;
  }

  const rounded = Math.floor(Math.abs(amount));
  let n = rounded;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remaining = n;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertThreeDigits(crore) + ' Crore');
  if (lakh > 0) parts.push(convertTwoDigits(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertTwoDigits(thousand) + ' Thousand');
  if (remaining > 0) parts.push(convertThreeDigits(remaining));

  return 'Rupees ' + parts.join(' ') + ' Only';
}

interface DigitalPaymentReceiptModalProps {
  payment: CustomerPaymentRecord;
  lead?: MockLead | null;
  onClose: () => void;
  onShareWhatsApp?: (phone: string, text: string) => void;
}

export default function DigitalPaymentReceiptModal({
  payment,
  lead,
  onClose,
  onShareWhatsApp
}: DigitalPaymentReceiptModalProps) {
  const receiptNo = `MSV-${payment.paidAt ? payment.paidAt.split('T')[0].replace(/-/g, '') : 'REC'}-${payment.id.slice(-5).toUpperCase()}`;
  const amountWords = amountInWordsIndian(payment.amount);
  const formattedDate = payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) : new Date().toLocaleDateString('en-IN');

  const customerName = payment.customerName || lead?.customer || 'Customer';
  const customerPhone = lead?.phone || '';
  const customerAddress = lead?.location || 'India';
  const systemCapacity = lead?.dealerSpecifications?.systemCapacityKw 
    ? `${lead.dealerSpecifications.systemCapacityKw} kW` 
    : 'Rooftop Solar Plant';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyDetails = () => {
    const text = `*MIRROR SOLAR VISION - PAYMENT RECEIPT*\n` +
      `Receipt No: ${receiptNo}\n` +
      `Customer: ${customerName}\n` +
      `Amount: ₹${payment.amount.toLocaleString('en-IN')} (${amountWords})\n` +
      `Milestone: ${payment.paymentType}\n` +
      `Mode: ${payment.paymentMode}\n` +
      `Ref / UTR: ${payment.referenceNumber || 'N/A'}\n` +
      `Date: ${formattedDate}\n` +
      `Status: VERIFIED & CONFIRMED\n\n` +
      `Thank you for powering with Mirror Solar Vision!`;
    navigator.clipboard.writeText(text);
    alert('✓ Receipt summary copied to clipboard!');
  };

  const handleWhatsAppShare = () => {
    const rawMessage = `*MIRROR SOLAR VISION - PAYMENT RECEIPT*\n\n` +
      `Dear ${customerName},\n` +
      `We have received your payment of *₹${payment.amount.toLocaleString('en-IN')}* towards your *${systemCapacity}* Solar Project.\n\n` +
      `📄 *Receipt No:* ${receiptNo}\n` +
      `📅 *Date:* ${formattedDate}\n` +
      `💳 *Mode:* ${payment.paymentMode}\n` +
      `🔖 *Ref / UTR:* ${payment.referenceNumber || 'Recorded in CRM'}\n` +
      `📝 *Milestone:* ${payment.paymentType}\n` +
      `✅ *Status:* Verified & Credited\n\n` +
      `Amount in words: _${amountWords}_\n\n` +
      `Thank you for choosing *Mirror Solar Vision Pvt Ltd*! ☀️`;

    if (onShareWhatsApp) {
      onShareWhatsApp(customerPhone, rawMessage);
      return;
    }

    const text = encodeURIComponent(rawMessage);
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
      window.open(`https://wa.me/91${cleanPhone}?text=${text}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  return (
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal-container" onClick={e => e.stopPropagation()}>
        {/* Top Control Bar (Hidden when printing) */}
        <div className="receipt-actions-bar no-print">
          <div className="receipt-bar-left">
            <span className="receipt-verified-chip">
              <CheckCircle2 size={15} /> Official Payment Receipt
            </span>
          </div>
          <div className="receipt-bar-right">
            <button className="receipt-btn-icon" onClick={handleCopyDetails} title="Copy Receipt Text">
              <Copy size={16} /> Copy
            </button>
            <button className="receipt-btn-wa" onClick={handleWhatsAppShare} title="Share Receipt on WhatsApp">
              <Share2 size={16} /> WhatsApp
            </button>
            <button className="receipt-btn-print" onClick={handlePrint} title="Print / PDF">
              <Printer size={16} /> Print Receipt
            </button>
            <button className="receipt-btn-close" onClick={onClose} title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Physical Receipt Sheet */}
        <div className="receipt-paper" id="printable-solar-receipt">
          {/* Header */}
          <div className="receipt-header">
            <div className="receipt-logo-block">
              <img src={logoUrl} alt="Mirror Solar Vision Logo" className="receipt-logo" />
              <div className="receipt-brand-text">
                <h1>MIRROR SOLAR VISION PVT LTD</h1>
                <p>Ministry of New & Renewable Energy (MNRE) Empanelled Vendor</p>
                <span>PM Surya Ghar Muft Bijli Yojana Partner • ISO 9001:2015</span>
              </div>
            </div>
            <div className="receipt-number-block">
              <div className="receipt-title-badge">PAYMENT RECEIPT</div>
              <div className="receipt-meta-row">
                <span className="lbl">Receipt #:</span>
                <span className="val highlight">{receiptNo}</span>
              </div>
              <div className="receipt-meta-row">
                <span className="lbl">Date:</span>
                <span className="val">{formattedDate}</span>
              </div>
            </div>
          </div>

          <div className="receipt-divider" />

          {/* Customer & Project Details Grid */}
          <div className="receipt-parties-grid">
            <div className="receipt-party-card">
              <div className="party-card-title">RECEIVED WITH THANKS FROM</div>
              <div className="party-name">{customerName}</div>
              {customerPhone && <div className="party-row"><Phone size={13} /> +91 {customerPhone}</div>}
              {customerAddress && <div className="party-row"><MapPin size={13} /> {customerAddress}</div>}
              {lead?.id && <div className="party-row-code">Project Lead ID: {lead.id}</div>}
            </div>

            <div className="receipt-party-card">
              <div className="party-card-title">PROJECT SPECIFICATIONS</div>
              <div className="party-name" style={{ color: '#0369a1' }}>{systemCapacity}</div>
              <div className="party-row">Rooftop Solar EPC & Grid Sync</div>
              <div className="party-row">Dealer / Channel: {lead?.dealer || 'Direct Company'}</div>
              <div className="party-row-code">Financing: {lead?.financingType || 'Self-Funded / Direct'}</div>
            </div>
          </div>

          {/* Payment Particulars Table */}
          <div className="receipt-table-wrapper">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>PARTICULARS / MILESTONE</th>
                  <th style={{ width: '25%' }}>PAYMENT MODE & REF</th>
                  <th style={{ width: '15%' }}>STATUS</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="item-title">{payment.paymentType}</div>
                    <div className="item-sub">
                      Payment towards solar photovoltaic generation system installation & commissioning
                    </div>
                    {payment.notes && <div className="item-notes">Remarks: {payment.notes}</div>}
                  </td>
                  <td>
                    <div className="mode-pill">{payment.paymentMode}</div>
                    <div className="mode-ref">
                      {payment.referenceNumber ? `Ref: ${payment.referenceNumber}` : 'Direct Verification'}
                    </div>
                  </td>
                  <td>
                    <span className="status-confirmed-badge">
                      <CheckCircle2 size={13} /> Verified
                    </span>
                  </td>
                  <td className="amount-col">
                    ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="total-label-cell">TOTAL RECEIVED:</td>
                  <td className="total-value-cell">
                    ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount In Words Banner */}
          <div className="receipt-words-banner">
            <span className="words-label">AMOUNT IN WORDS:</span>
            <span className="words-text">{amountWords}</span>
          </div>

          {/* Footer & Authorized Signatory Block */}
          <div className="receipt-footer">
            <div className="receipt-terms">
              <h4>TERMS & NOTES:</h4>
              <ol>
                <li>This is an authentic computer-generated digital receipt issued by Mirror Solar Vision Pvt Ltd.</li>
                <li>All payments are credited towards project milestones and adjusted against final invoice.</li>
                <li>Cheques / electronic payments are subject to actual realization in company account.</li>
              </ol>
            </div>

            <div className="receipt-signatures-col">
              <div className="receipt-official-stamp">
                <div className="stamp-circle">
                  <ShieldCheck size={28} color="#059669" />
                  <span className="stamp-text-1">MIRROR SOLAR VISION</span>
                  <span className="stamp-text-2">★ VERIFIED & PAID ★</span>
                </div>
              </div>
              <div className="signature-line" />
              <div className="signature-caption">Authorized Signatory / Accounts</div>
              <div className="signature-sub">Mirror Solar Vision Pvt Ltd</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
