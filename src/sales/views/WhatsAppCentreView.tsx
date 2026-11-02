import React, { useState, useMemo } from 'react';
import { 
  MessageSquare, Send, Copy, Check, ExternalLink, 
  User, ShieldCheck, Sparkles, Building, FileText
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';

interface WhatsAppCentreViewProps {
  onNavigateSubView: (view: any, params?: any) => void;
  initialLeadId?: string;
}

interface TemplateItem {
  id: string;
  title: string;
  category: string;
  renderText: (lead: MockLead) => string;
}

export default function WhatsAppCentreView({
  onNavigateSubView: _onNavigateSubView,
  initialLeadId
}: WhatsAppCentreViewProps) {
  const { currentUser, leads, addActivity } = useCRM();
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl_intro');
  const [customizedMessage, setCustomizedMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  // 6 Approved Templates
  const templates: TemplateItem[] = useMemo(() => [
    {
      id: 'tpl_intro',
      title: '1. PM Surya Ghar Subsidy Introduction & Brochure',
      category: 'Initial Contact',
      renderText: (lead: MockLead) => 
`Namaste ${lead.customer || 'Sir/Madam'},

Greetings from *Mirror Solar Vision*! ☀️

Under the Central Government *PM Surya Ghar Muft Bijli Yojana*, you can save up to 100% on your monthly electricity bill with massive government subsidies:
• 1 kW System: ₹30,000 Direct Subsidy
• 2 kW System: ₹60,000 Direct Subsidy
• 3 kW System: ₹78,000 Direct Subsidy

We offer Tier-1 Mono PERC Bifacial Solar Panels with 25-Year Warranty, smart on-grid inverters, and fast DISCOM net-metering approvals.

Would you like to schedule a free rooftop technical inspection this week?

Warm regards,
${currentUserName} | Sales Department
Mirror Solar Vision CRM
📞 Contact: +91 94401 88990`
    },
    {
      id: 'tpl_qualification',
      title: '2. Technical Qualification & Bill Review',
      category: 'Qualification',
      renderText: (lead: MockLead) => 
`Dear ${lead.customer || 'Customer'},

Thank you for discussing your solar requirement with us today.

To determine your optimal solar plant size and maximize your *₹78,000 Central Subsidy*, please share:
1. A photo of your latest Electricity Bill (Service Number visible)
2. Approximate shadow-free roof area (RCC / Sheet)
3. Sanctioned load details

Once received, our engineering team will calculate your estimated solar generation and payback period.

Best regards,
${currentUserName} | Mirror Solar Vision`
    },
    {
      id: 'tpl_survey',
      title: '3. Site Survey Appointment Confirmation',
      category: 'Survey',
      renderText: (lead: MockLead) => 
`Hello ${lead.customer || 'Sir/Madam'},

Your free rooftop solar site inspection has been confirmed!

📍 Location: ${lead.location || 'Your Registered Address'}
📅 Preferred Date: ${lead.followUp?.date || 'As discussed'}
⏰ Time Slot: ${lead.followUp?.time || '11:00 AM'}
👷 Coordinated with Authorized Solar Dealer

Our technician will verify shadow angles, cable routing to the meter box, and structural roof load. Please keep your electricity bill handy.

Thank you,
Mirror Solar Vision Team`
    },
    {
      id: 'tpl_quotation',
      title: '4. Official Quotation & System Estimate Summary',
      category: 'Quotation',
      renderText: (lead: MockLead) => 
`Dear ${lead.customer || 'Customer'},

We have prepared your official Mirror Solar Vision system quotation:

☀️ System Size: ${lead.qualificationData?.preferredCapacityKw || 3} kW On-Grid Rooftop Solar
🔋 Tier-1 High-Efficiency Bifacial Solar Modules
⚡ Smart On-Grid String Inverter (10-Yr Warranty)
🏛️ PM Surya Ghar Central Subsidy: Up to ₹78,000 Direct Bank Credit
💡 Estimated Monthly Generation: ~360 to 420 Units

We have attached your official PDF proposal. Please review and feel free to reach out for any questions.

Warm regards,
${currentUserName} | Mirror Solar Vision`
    },
    {
      id: 'tpl_booking',
      title: '5. Advance Booking & Bank Details',
      category: 'Booking',
      renderText: (lead: MockLead) => 
`Dear ${lead.customer || 'Sir/Madam'},

Thank you for choosing *Mirror Solar Vision* for your clean energy journey! 🌿

To confirm your solar booking and lock in equipment allotment, please submit your advance booking deposit:
• Booking Amount: ₹5,000 / ₹10,000
• Bank Name: State Bank of India
• Account Name: Mirror Solar Vision
• A/C No: 42890123456
• IFSC Code: SBIN0001234
• UPI ID: mirrorsolarvision@sbi

Kindly reply with the payment screenshot or UTR number so our Accounts team can verify and issue your official booking receipt.

Thank you,
Mirror Solar Vision`
    },
    {
      id: 'tpl_followup',
      title: '6. Callback & Follow-up Reminder',
      category: 'Follow-up',
      renderText: (lead: MockLead) => 
`Hello ${lead.customer || 'Customer'},

Just checking in as per our discussion regarding your rooftop solar installation. 

Government PM Surya Ghar subsidies of *up to ₹78,000* are currently being processed rapidly through the national portal.

Let me know if you would like us to call you today to finalize your project details.

Best regards,
${currentUserName} | Mirror Solar Vision`
    }
  ], [currentUserName]);

  // Initialize or update text when lead or template changes
  useMemo(() => {
    if (activeLead) {
      const tpl = templates.find(t => t.id === selectedTemplateId) || templates[0];
      setCustomizedMessage(tpl.renderText(activeLead));
    }
  }, [activeLead, selectedTemplateId, templates]);

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(customizedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open WhatsApp Web/App
  const handleOpenWhatsApp = () => {
    if (!activeLead?.phone) return;
    const cleanPhone = activeLead.phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const encodedMsg = encodeURIComponent(customizedMessage);
    const url = `https://wa.me/${phoneWithCode}?text=${encodedMsg}`;

    window.open(url, '_blank');

    addActivity({
      type: 'WhatsApp Sent',
      message: `WhatsApp message (${selectedTemplateId}) dispatched to ${activeLead.customer}`,
      user: currentUserName,
      leadId: activeLead.id
    });
  };

  return (
    <div className="whatsapp-centre-content">
      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              WhatsApp Customer Communication Centre
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Send pre-approved brochures, subsidy details, quotation summaries, and payment requests with 1-click WhatsApp chat.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>Target Customer:</label>
            <select 
              className="sales-form-control"
              style={{ width: 'auto', minWidth: '220px' }}
              value={selectedLeadId}
              onChange={e => setSelectedLeadId(e.target.value)}
            >
              {scopedLeads.map(l => (
                <option key={l.id} value={l.id}>{l.customer} ({l.phone})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeLead && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Left: Template Selector List */}
          <div className="sales-panel" style={{ margin: 0 }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a' }}>
              Approved Message Templates
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  className="sales-btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    borderColor: selectedTemplateId === tpl.id ? '#16a34a' : '#e2e8f0',
                    background: selectedTemplateId === tpl.id ? '#f0fdf4' : 'white',
                    color: selectedTemplateId === tpl.id ? '#166534' : '#334155',
                    fontWeight: selectedTemplateId === tpl.id ? 700 : 500
                  }}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem' }}>{tpl.title}</div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
                      {tpl.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
              ℹ️ Version 1 utilizes the official WhatsApp Business Web/App dispatch flow with automatic customer data injection.
            </div>
          </div>

          {/* Right: Interactive Message Preview & Action Strip */}
          <div className="sales-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 700, color: '#0b1f3a' }}>
                  Live Message Preview: {activeLead.customer}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
                  Recipient Phone: {activeLead.phone}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="sales-btn-secondary" 
                  style={{ fontSize: '0.8rem' }}
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
                <button 
                  className="sales-btn-primary" 
                  style={{ background: '#16a34a', fontSize: '0.8rem' }}
                  onClick={handleOpenWhatsApp}
                >
                  <Send size={14} /> Send via WhatsApp
                </button>
              </div>
            </div>

            {/* Editable Textarea for Customization */}
            <div className="sales-form-group">
              <label>Message Content (Personalize before sending):</label>
              <textarea 
                rows={14}
                className="sales-form-control"
                style={{ fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: '1.5' }}
                value={customizedMessage}
                onChange={e => setCustomizedMessage(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
