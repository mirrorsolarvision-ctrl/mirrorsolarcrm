import React, { useState, useMemo } from 'react';
import { MessageSquare, X, Copy, Check, Send, FileText, TrendingUp, Landmark, Truck, CreditCard } from 'lucide-react';
import { 
  generateQuotationWhatsAppMessage, 
  generateRoiPitchWhatsAppMessage, 
  generateLoanUpdateWhatsAppMessage,
  generateMaterialDispatchWhatsAppMessage,
  generatePaymentReminderWhatsAppMessage,
  getWhatsAppDirectUrl
} from '../utils/whatsappTemplates';
import './WhatsAppDispatchModal.css';

export type WhatsAppTemplateType = 'proposal' | 'roi' | 'loan' | 'dispatch' | 'payment';

interface WhatsAppDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTemplate?: WhatsAppTemplateType;
  customerData: {
    customerName: string;
    customerPhone?: string;
    capacityKw?: number;
    quotationNumber?: string;
    grandTotal?: number;
    subsidyAmount?: number;
    netPayable?: number;
    monthlySavings?: number;
    paybackPeriod?: string;
    proposalDownloadUrl?: string;
    bankName?: string;
    applicationNumber?: string;
    totalPaid?: number;
    balanceDue?: number;
    itemsDispatched?: string;
    lorryReceiptNumber?: string;
  };
}

export default function WhatsAppDispatchModal({
  isOpen,
  onClose,
  defaultTemplate = 'proposal',
  customerData
}: WhatsAppDispatchModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateType>(defaultTemplate);
  const [phone, setPhone] = useState<string>(customerData.customerPhone || '');
  const [copied, setCopied] = useState<boolean>(false);

  const messageText = useMemo(() => {
    const name = customerData.customerName || 'Customer';
    const capacity = customerData.capacityKw || 3;

    switch (selectedTemplate) {
      case 'proposal':
        return generateQuotationWhatsAppMessage({
          customerName: name,
          customerPhone: phone,
          capacityKw: capacity,
          quotationNumber: customerData.quotationNumber,
          grandTotal: customerData.grandTotal || (capacity * 60000),
          subsidyAmount: customerData.subsidyAmount || (capacity <= 2 ? capacity * 30000 : 78000),
          netPayable: customerData.netPayable || ((customerData.grandTotal || capacity * 60000) - (customerData.subsidyAmount || 78000)),
          monthlySavings: customerData.monthlySavings,
          paybackPeriod: customerData.paybackPeriod,
          proposalDownloadUrl: customerData.proposalDownloadUrl
        });

      case 'roi':
        return generateRoiPitchWhatsAppMessage({
          customerName: name,
          capacityKw: capacity,
          monthlySavings: customerData.monthlySavings || Math.round(capacity * 4.3 * 30 * 7.5),
          annualSavings: Math.round(capacity * 4.3 * 365 * 7.5),
          lifetimeSavings: Math.round(capacity * 4.3 * 365 * 7.5 * 22),
          netInvestment: (customerData.netPayable || (capacity * 60000 - 78000)),
          paybackYears: 3,
          paybackMonths: 4
        });

      case 'loan':
        return generateLoanUpdateWhatsAppMessage({
          customerName: name,
          customerPhone: phone,
          bankName: customerData.bankName || 'State Bank of India (SBI)',
          applicationNumber: customerData.applicationNumber || 'JANSAMARTH-2026-9842',
          status: 'Under Verification',
          loanAmount: customerData.netPayable || 135000
        });

      case 'dispatch':
        return generateMaterialDispatchWhatsAppMessage({
          customerName: name,
          customerPhone: phone,
          systemCapacity: `${capacity} kW On-Grid`,
          itemsDispatched: customerData.itemsDispatched || `${capacity * 2}x Solar Panels (540Wp TOPCon), 1x ${capacity}kW Dual-MPPT Inverter, 80u GI Structure Kits & DC/AC Cables`,
          lorryReceiptNumber: customerData.lorryReceiptNumber || 'LR-HYD-7821',
          expectedDeliveryDate: 'Within 2-3 Business Days'
        });

      case 'payment':
        return generatePaymentReminderWhatsAppMessage({
          customerName: name,
          customerPhone: phone,
          totalQuotationAmount: customerData.grandTotal || (capacity * 60000),
          totalPaid: customerData.totalPaid || 50000,
          balanceDue: customerData.balanceDue || Math.max(0, (customerData.grandTotal || capacity * 60000) - (customerData.totalPaid || 50000))
        });

      default:
        return '';
    }
  }, [selectedTemplate, customerData, phone]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleSendWhatsApp = () => {
    const url = getWhatsAppDirectUrl(phone, messageText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wa-modal-header">
          <div className="wa-header-brand">
            <div className="wa-header-icon">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="wa-modal-title">WhatsApp Smart Communication</h3>
              <p className="wa-modal-subtitle">Instant verified template dispatch to {customerData.customerName}</p>
            </div>
          </div>
          <button className="wa-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="wa-modal-body">
          {/* TEMPLATE TABS */}
          <div className="wa-template-selector">
            <button 
              className={`wa-template-tab ${selectedTemplate === 'proposal' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('proposal')}
            >
              📄 Proposal & Subsidy
            </button>
            <button 
              className={`wa-template-tab ${selectedTemplate === 'roi' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('roi')}
            >
              ⚡ Solar ROI Pitch
            </button>
            <button 
              className={`wa-template-tab ${selectedTemplate === 'loan' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('loan')}
            >
              🏛️ Bank Loan Update
            </button>
            <button 
              className={`wa-template-tab ${selectedTemplate === 'dispatch' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('dispatch')}
            >
              🚚 Material Dispatch
            </button>
            <button 
              className={`wa-template-tab ${selectedTemplate === 'payment' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('payment')}
            >
              💳 Payment Statement
            </button>
          </div>

          {/* PHONE NUMBER INPUT */}
          <div className="wa-phone-input-group">
            <label className="wa-phone-label">Customer WhatsApp Number</label>
            <input 
              type="text" 
              className="wa-phone-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9848012345 or +919848012345"
            />
          </div>

          {/* MESSAGE PREVIEW */}
          <div className="wa-preview-box">
            <div className="wa-bubble">
              {messageText}
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="wa-modal-actions">
          <button className="wa-btn wa-btn-copy" onClick={handleCopy}>
            {copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
            {copied ? 'Copied to Clipboard' : 'Copy Message'}
          </button>

          <button className="wa-btn wa-btn-send" onClick={handleSendWhatsApp}>
            <Send size={15} /> Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
