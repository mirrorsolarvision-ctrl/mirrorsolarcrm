import React from 'react';

interface WhatsAppCentreViewProps {
  onNavigateSubView: (view: any, params?: any) => void;
  initialLeadId?: string;
}

export default function WhatsAppCentreView({
  onNavigateSubView: _onNavigateSubView,
  initialLeadId: _initialLeadId
}: WhatsAppCentreViewProps) {
  // Decommissioned: Replaced by Customer Responses & Enquiries and direct telecalling
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
      <h3>Direct Calling Mode Active</h3>
      <p>WhatsApp dispatch has been replaced with direct telecalling and call logs. Use the Telecalling Centre to manage calls and log customer responses.</p>
    </div>
  );
}
