import React from 'react';

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
  isOpen: _isOpen,
  onClose: _onClose,
  defaultTemplate: _defaultTemplate = 'proposal',
  customerData: _customerData
}: WhatsAppDispatchModalProps) {
  // Decommissioned: direct phone calling (tel:) is used instead
  return null;
}
