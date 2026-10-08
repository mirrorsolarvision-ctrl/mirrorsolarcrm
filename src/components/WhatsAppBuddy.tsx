import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Copy, 
  Check, 
  Send, 
  User, 
  Zap, 
  FileText, 
  Landmark, 
  Truck, 
  CreditCard, 
  Calendar, 
  Clock, 
  Sparkles, 
  Search, 
  ChevronDown, 
  RefreshCw, 
  ExternalLink,
  Sliders,
  History,
  AlertCircle,
  Minimize2,
  Maximize2,
  CheckCircle2
} from 'lucide-react';
import { useCRM, type MockLead } from '../context/CRMContext';
import { useQuotations } from '../context/QuotationContext';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../context/AuditLogContext';
import {
  generateQuotationWhatsAppMessage,
  generateRoiPitchWhatsAppMessage,
  generateLoanUpdateWhatsAppMessage,
  generateMaterialDispatchWhatsAppMessage,
  generatePaymentReminderWhatsAppMessage,
  generateDocChecklistWhatsAppMessage,
  generateSiteSurveyWhatsAppMessage,
  generateFollowUpWhatsAppMessage,
  generateHinglishPitchMessage,
  estimateSolarFromBill,
  getWhatsAppDirectUrl
} from '../utils/whatsappTemplates';
import './WhatsAppBuddy.css';

export type WhatsAppBuddyTab = 'dispatch' | 'urgent' | 'estimator' | 'history';

export type BuddyTemplateKey = 
  | 'proposal'
  | 'roi'
  | 'docChecklist'
  | 'loan'
  | 'dispatch'
  | 'payment'
  | 'survey'
  | 'followup'
  | 'hinglish'
  | 'custom';

interface DispatchHistoryItem {
  id: string;
  timestamp: string;
  recipientName: string;
  recipientPhone: string;
  templateKey: BuddyTemplateKey;
  templateLabel: string;
  messageText: string;
}

const TEMPLATE_CONFIGS: { key: BuddyTemplateKey; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { key: 'proposal', label: 'Quotation & Subsidy', icon: <FileText size={16} />, color: '#10B981', desc: 'Detailed cost, PM Surya Ghar DBT subsidy & net payable' },
  { key: 'roi', label: 'ROI & 25-Yr Savings', icon: <Zap size={16} />, color: '#F59E0B', desc: 'Electricity savings breakdown & fast payback pitch' },
  { key: 'docChecklist', label: 'PM Surya Ghar KYC Docs', icon: <CheckCircle2 size={16} />, color: '#06B6D4', desc: 'Checklist of Aadhaar, Bill, Passbook & rooftop photos' },
  { key: 'followup', label: 'Follow-Up Nudge', icon: <Clock size={16} />, color: '#8B5CF6', desc: 'Warm follow-up regarding solar quotation & subsidy expiry' },
  { key: 'hinglish', label: 'Bijli Bill Zero (Hindi)', icon: <Sparkles size={16} />, color: '#EC4899', desc: 'High-converting Hindi/Hinglish direct pitch' },
  { key: 'survey', label: 'Site Survey Schedule', icon: <Calendar size={16} />, color: '#3B82F6', desc: 'Surveyor visit date, time, and rooftop inspection details' },
  { key: 'loan', label: 'Bank Loan / JanSamarth', icon: <Landmark size={16} />, color: '#6366F1', desc: 'Sanction, disbursement, and verification status' },
  { key: 'dispatch', label: 'Material Dispatch & LR', icon: <Truck size={16} />, color: '#14B8A6', desc: 'Dispatched panels, inverter & LR tracking number' },
  { key: 'payment', label: 'Payment / Milestone UPI', icon: <CreditCard size={16} />, color: '#EF4444', desc: 'Advance / milestone balance due & bank details' },
  { key: 'custom', label: 'Custom Message', icon: <MessageSquare size={16} />, color: '#64748B', desc: 'Craft any custom message with dynamic smart tags' }
];

export default function WhatsAppBuddy() {
  const { leads } = useCRM();
  const { quotations } = useQuotations();
  const { currentUser } = useAuth();
  const { logAction } = useAudit();

  // Widget visibility & window states
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    return localStorage.getItem('wa_buddy_open') === 'true';
  });
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WhatsAppBuddyTab>('dispatch');

  // Lead selection & search
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');

  // Form parameters
  const [recipientName, setRecipientName] = useState<string>('Valued Customer');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<BuddyTemplateKey>('proposal');
  
  // Customization parameters
  const [capacityKw, setCapacityKw] = useState<number>(3);
  const [grandTotal, setGrandTotal] = useState<number>(180000);
  const [subsidyAmount, setSubsidyAmount] = useState<number>(78000);
  const [netPayable, setNetPayable] = useState<number>(102000);
  const [monthlySavings, setMonthlySavings] = useState<number>(2700);
  const [quotationNumber, setQuotationNumber] = useState<string>('');
  const [surveyDate, setSurveyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [surveyTime, setSurveyTime] = useState<string>('11:00 AM');
  const [engineerName, setEngineerName] = useState<string>('Mirror Solar Technical Team');
  const [bankName, setBankName] = useState<string>('State Bank of India (SBI)');
  const [applicationNumber, setApplicationNumber] = useState<string>('');
  const [loanStatus, setLoanStatus] = useState<'Submitted' | 'Approved' | 'Disbursed' | 'Under Verification'>('Under Verification');
  const [totalPaid, setTotalPaid] = useState<number>(50000);
  const [balanceDue, setBalanceDue] = useState<number>(52000);
  const [itemsDispatched, setItemsDispatched] = useState<string>('6x 540Wp Solar Panels, 1x 3kW Inverter, GI Structure Kits & Cables');
  const [lorryReceiptNumber, setLorryReceiptNumber] = useState<string>('');
  
  // Custom Message Body (Live Editable)
  const [customDraft, setCustomDraft] = useState<string>('');
  const [isEditingManually, setIsEditingManually] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [logSuccess, setLogSuccess] = useState<boolean>(false);

  // Estimator Tab State
  const [monthlyBillInput, setMonthlyBillInput] = useState<number>(3500);

  // History state
  const [history, setHistory] = useState<DispatchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('wa_buddy_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wa_buddy_history', JSON.stringify(history.slice(0, 30)));
    } catch (e) {
      console.error(e);
    }
  }, [history]);

  // Save open state
  useEffect(() => {
    localStorage.setItem('wa_buddy_open', isOpen ? 'true' : 'false');
  }, [isOpen]);

  // Click outside to close lead dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter leads for search
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return (leads as MockLead[]).slice(0, 15);
    const q = searchQuery.toLowerCase();
    return (leads as MockLead[]).filter(l => 
      l.customer?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.location?.toLowerCase().includes(q) ||
      l.stage?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [leads, searchQuery]);

  // Urgent leads for nudges (Follow ups due, new leads, loan verification, material pending)
  const urgentLeads = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return (leads as MockLead[]).filter(l => {
      const isDueToday = l.followUp?.date === todayStr;
      const isOverdue = l.followUp?.status === 'Overdue';
      const isNewLead = l.stage === 'Lead' && !l.dealerSpecifications?.systemCapacityKw;
      const isLoanPending = l.stage === 'Loan';
      return isDueToday || isOverdue || isNewLead || isLoanPending;
    }).slice(0, 10);
  }, [leads]);

  // Auto-fill lead info when selected
  const handleSelectLead = (lead: MockLead) => {
    setSelectedLeadId(lead.id);
    setRecipientName(lead.customer || 'Customer');
    setRecipientPhone(lead.phone || '');
    setIsDropdownOpen(false);
    setIsEditingManually(false);

    // Try to match with related quotation
    const leadQuote = quotations.find(q => q.leadId === lead.id || q.customer?.mobileNumber === lead.phone);
    if (leadQuote) {
      const cap = leadQuote.project?.systemCapacityKw || 3;
      setCapacityKw(cap);
      setGrandTotal(leadQuote.financials?.grandTotal || 180000);
      setSubsidyAmount(leadQuote.financials?.subsidyAmount || 78000);
      setNetPayable(leadQuote.financials?.netPayableByCustomer || 102000);
      setMonthlySavings(Math.round(cap * 4.3 * 30 * 7.5));
      setQuotationNumber(leadQuote.quotationNumber || '');
    } else {
      const capNum = parseFloat(lead.dealerSpecifications?.systemCapacityKw || '3') || 3;
      setCapacityKw(capNum);
      const estTotal = capNum <= 3 ? capNum * 65000 : capNum * 58000;
      let estSub = 78000;
      if (capNum <= 1) estSub = 30000;
      else if (capNum <= 2) estSub = 60000;
      setGrandTotal(estTotal);
      setSubsidyAmount(estSub);
      setNetPayable(Math.max(0, estTotal - estSub));
      setMonthlySavings(Math.round(capNum * 4.3 * 30 * 7.5));
    }

    if (lead.stage === 'Loan') {
      setSelectedTemplate('loan');
      setApplicationNumber(lead.dealerSpecifications?.bankIfscCode || 'JANSAMARTH-789');
    } else if (lead.stage === 'Material') {
      setSelectedTemplate('dispatch');
    } else if (lead.stage === 'Lead') {
      setSelectedTemplate('proposal');
    }
  };

  // Compute generated message based on template
  const generatedTemplateMessage = useMemo(() => {
    const name = recipientName || 'Valued Customer';
    const cap = capacityKw || 3;

    switch (selectedTemplate) {
      case 'proposal':
        return generateQuotationWhatsAppMessage({
          customerName: name,
          customerPhone: recipientPhone,
          capacityKw: cap,
          quotationNumber: quotationNumber || undefined,
          grandTotal: grandTotal || 180000,
          subsidyAmount: subsidyAmount || 78000,
          netPayable: netPayable || 102000,
          monthlySavings: monthlySavings || Math.round(cap * 4.3 * 30 * 7.5),
          paybackPeriod: `${(netPayable / ((monthlySavings || 2700) * 12)).toFixed(1)} Years`,
          proposalDownloadUrl: quotationNumber ? `https://mirrorsolar.in/proposal/${quotationNumber}` : undefined
        });

      case 'roi':
        return generateRoiPitchWhatsAppMessage({
          customerName: name,
          capacityKw: cap,
          monthlySavings: monthlySavings || Math.round(cap * 4.3 * 30 * 7.5),
          annualSavings: (monthlySavings || Math.round(cap * 4.3 * 30 * 7.5)) * 12,
          lifetimeSavings: (monthlySavings || Math.round(cap * 4.3 * 30 * 7.5)) * 12 * 22,
          netInvestment: netPayable || 102000,
          paybackYears: Math.floor((netPayable || 102000) / (((monthlySavings || 2700)) * 12)),
          paybackMonths: 4
        });

      case 'docChecklist':
        return generateDocChecklistWhatsAppMessage({
          customerName: name
        });

      case 'followup':
        return generateFollowUpWhatsAppMessage({
          customerName: name,
          capacityKw: cap
        });

      case 'hinglish':
        return generateHinglishPitchMessage({
          customerName: name,
          capacityKw: cap,
          monthlySavings: monthlySavings || Math.round(cap * 4.3 * 30 * 7.5)
        });

      case 'survey':
        return generateSiteSurveyWhatsAppMessage({
          customerName: name,
          surveyDate: surveyDate,
          surveyTime: surveyTime,
          engineerName: engineerName,
          engineerPhone: '+91 98765 43210'
        });

      case 'loan':
        return generateLoanUpdateWhatsAppMessage({
          customerName: name,
          customerPhone: recipientPhone,
          bankName: bankName,
          applicationNumber: applicationNumber || 'JANSAMARTH-2026-9842',
          status: loanStatus,
          loanAmount: netPayable || 102000
        });

      case 'dispatch':
        return generateMaterialDispatchWhatsAppMessage({
          customerName: name,
          customerPhone: recipientPhone,
          systemCapacity: `${cap} kW On-Grid Solar Plant`,
          itemsDispatched: itemsDispatched,
          lorryReceiptNumber: lorryReceiptNumber || 'LR-HYD-84210',
          expectedDeliveryDate: 'Within 2-3 Business Days'
        });

      case 'payment':
        return generatePaymentReminderWhatsAppMessage({
          customerName: name,
          customerPhone: recipientPhone,
          totalQuotationAmount: grandTotal || 180000,
          totalPaid: totalPaid || 50000,
          balanceDue: balanceDue || Math.max(0, (grandTotal || 180000) - (totalPaid || 50000)),
          dueDate: new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        });

      case 'custom':
        return (
          `🌞 *MIRROR SOLAR VISION* 🌞\n\n` +
          `Hello *${name}*,\n\n` +
          `Thank you for your interest in Mirror Solar rooftop systems. Your ${cap} kW solar plant will qualify for ₹${subsidyAmount.toLocaleString()} PM Surya Ghar Subsidy.\n\n` +
          `Please let us know if you have any questions!\n\n` +
          `*Mirror Solar Vision Team*`
        );

      default:
        return '';
    }
  }, [
    selectedTemplate, 
    recipientName, 
    recipientPhone, 
    capacityKw, 
    quotationNumber, 
    grandTotal, 
    subsidyAmount, 
    netPayable, 
    monthlySavings, 
    surveyDate, 
    surveyTime, 
    engineerName, 
    bankName, 
    applicationNumber, 
    loanStatus, 
    itemsDispatched, 
    lorryReceiptNumber, 
    totalPaid, 
    balanceDue
  ]);

  // Active message is manual draft or template message
  const activeMessageText = isEditingManually ? customDraft : generatedTemplateMessage;

  // Set initial draft on template change
  useEffect(() => {
    if (!isEditingManually) {
      setCustomDraft(generatedTemplateMessage);
    }
  }, [generatedTemplateMessage, isEditingManually]);

  // Recalculate capacity / subsidy when slider changes
  const handleCapacityChange = (kw: number) => {
    setCapacityKw(kw);
    const estTotal = kw <= 3 ? kw * 65000 : kw * 58000;
    let estSub = 78000;
    if (kw <= 1) estSub = 30000;
    else if (kw <= 2) estSub = 60000;
    const net = Math.max(0, estTotal - estSub);
    const savings = Math.round(kw * 4.3 * 30 * 7.5);
    setGrandTotal(estTotal);
    setSubsidyAmount(estSub);
    setNetPayable(net);
    setMonthlySavings(savings);
    setIsEditingManually(false);
  };

  // Bill estimator calculation
  const billEstimate = useMemo(() => {
    return estimateSolarFromBill(monthlyBillInput);
  }, [monthlyBillInput]);

  const handleApplyBillEstimate = () => {
    handleCapacityChange(billEstimate.capacityKw);
    setActiveTab('dispatch');
    setSelectedTemplate('roi');
  };

  // Action: Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeMessageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };

  // Action: Send via WhatsApp
  const handleSendWhatsApp = () => {
    const url = getWhatsAppDirectUrl(recipientPhone, activeMessageText);
    window.open(url, '_blank', 'noopener,noreferrer');

    // Add to history
    const historyItem: DispatchHistoryItem = {
      id: `wa_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
      recipientName: recipientName || 'Customer',
      recipientPhone: recipientPhone || 'N/A',
      templateKey: selectedTemplate,
      templateLabel: TEMPLATE_CONFIGS.find(t => t.key === selectedTemplate)?.label || 'Message',
      messageText: activeMessageText
    };
    setHistory(prev => [historyItem, ...prev]);

    // Auto log to CRM
    handleLogToCRM();
  };

  // Action: Log WhatsApp activity to CRM Audit & Lead notes
  const handleLogToCRM = () => {
    if (selectedLeadId && logAction) {
      const templateLabel = TEMPLATE_CONFIGS.find(t => t.key === selectedTemplate)?.label || 'WhatsApp Message';

      logAction({
        action: 'Lead Updated' as any,
        entityType: 'Lead' as any,
        entityId: selectedLeadId,
        entityLabel: recipientName,
        diffSummary: `Dispatched ${templateLabel} via WhatsApp Buddy to ${recipientName} (${recipientPhone || 'No Phone'})`
      }).catch(err => console.warn('Audit log error:', err));

      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 2500);
    }
  };

  // Trigger from urgent lead nudge
  const handleNudgeLead = (lead: MockLead) => {
    handleSelectLead(lead);
    setActiveTab('dispatch');
    if (lead.stage === 'Loan') {
      setSelectedTemplate('loan');
    } else if (lead.stage === 'Material') {
      setSelectedTemplate('dispatch');
    } else if (lead.followUp?.status === 'Due Today' || lead.followUp?.status === 'Overdue') {
      setSelectedTemplate('followup');
    } else {
      setSelectedTemplate('proposal');
    }
  };

  // Insert tag into custom message
  const handleInsertTag = (tag: string) => {
    setIsEditingManually(true);
    setCustomDraft(prev => prev + ` ${tag} `);
  };

  return (
    <>
      {/* 1. FLOATING LAUNCHER BUDDY BUTTON */}
      <div 
        className={`wa-buddy-launcher ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        title="WhatsApp Buddy • Smart Solar Message Dispatcher"
      >
        <div className="wa-buddy-launcher-ring"></div>
        <div className="wa-buddy-launcher-inner">
          <MessageSquare className="wa-buddy-icon" size={24} />
          <span className="wa-buddy-sun">☀️</span>
        </div>
        
        {urgentLeads.length > 0 && !isOpen && (
          <span className="wa-buddy-badge" title={`${urgentLeads.length} leads requiring WhatsApp follow-up`}>
            {urgentLeads.length}
          </span>
        )}

        <div className="wa-buddy-tooltip">
          <span className="wa-buddy-tooltip-title">WhatsApp Buddy</span>
          <span className="wa-buddy-tooltip-sub">Instant Solar Proposal & Follow-up Assistant</span>
        </div>
      </div>

      {/* 2. MAIN FLOATING BUDDY PANEL */}
      {isOpen && (
        <div className={`wa-buddy-window ${isExpanded ? 'expanded' : ''}`}>
          
          {/* WINDOW HEADER */}
          <div className="wa-buddy-header">
            <div className="wa-buddy-header-brand">
              <div className="wa-buddy-avatar">
                <MessageSquare size={18} className="wa-avatar-icon" />
                <span className="wa-avatar-sun">☀️</span>
                <span className="wa-avatar-dot"></span>
              </div>
              <div className="wa-buddy-title-group">
                <div className="wa-buddy-title">
                  WhatsApp Buddy
                  <span className="wa-buddy-badge-copilot">CRM Copilot</span>
                </div>
                <div className="wa-buddy-status">
                  <span className="wa-status-pulse"></span> Instant Dispatcher & Solar Pitches
                </div>
              </div>
            </div>

            <div className="wa-buddy-header-actions">
              <button 
                className="wa-icon-btn"
                onClick={() => setIsExpanded(prev => !prev)}
                title={isExpanded ? 'Normal Size' : 'Expand Dock'}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button 
                className="wa-icon-btn wa-close-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize WhatsApp Buddy"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="wa-buddy-tabs">
            <button 
              className={`wa-tab-btn ${activeTab === 'dispatch' ? 'active' : ''}`}
              onClick={() => setActiveTab('dispatch')}
            >
              <Send size={14} /> Quick Dispatch
            </button>
            <button 
              className={`wa-tab-btn ${activeTab === 'urgent' ? 'active' : ''}`}
              onClick={() => setActiveTab('urgent')}
            >
              <Zap size={14} /> 
              Urgent Nudges
              {urgentLeads.length > 0 && <span className="wa-tab-count">{urgentLeads.length}</span>}
            </button>
            <button 
              className={`wa-tab-btn ${activeTab === 'estimator' ? 'active' : ''}`}
              onClick={() => setActiveTab('estimator')}
            >
              <Sparkles size={14} /> Bill Estimator
            </button>
            <button 
              className={`wa-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={14} /> History
            </button>
          </div>

          {/* TAB CONTENT: QUICK DISPATCH */}
          {activeTab === 'dispatch' && (
            <div className="wa-buddy-content">
              
              {/* RECIPIENT SELECTOR */}
              <div className="wa-section-card">
                <div className="wa-card-header">
                  <span className="wa-card-title"><User size={14} /> Recipient / CRM Lead</span>
                  {selectedLeadId && (
                    <button 
                      className="wa-card-action-text" 
                      onClick={() => { setSelectedLeadId(''); setRecipientName('Customer'); setRecipientPhone(''); }}
                    >
                      Clear Lead
                    </button>
                  )}
                </div>

                <div className="wa-search-dropdown-wrapper" ref={dropdownRef}>
                  <div 
                    className="wa-lead-selector-input"
                    onClick={() => setIsDropdownOpen(true)}
                  >
                    <Search size={14} className="wa-search-icon" />
                    <input 
                      id="waLeadSearchInput"
                      name="waLeadSearch"
                      type="text" 
                      placeholder="Search CRM Lead by Name, Phone, City..."
                      value={searchQuery || (selectedLeadId ? `${recipientName} (${recipientPhone || 'No Phone'})` : '')}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                    />
                    <ChevronDown size={14} className="wa-dropdown-chevron" />
                  </div>

                  {isDropdownOpen && (
                    <div className="wa-dropdown-menu">
                      <div className="wa-dropdown-header">Select a CRM Lead or type manual number below:</div>
                      {filteredLeads.length === 0 ? (
                        <div className="wa-dropdown-empty">No matching leads found</div>
                      ) : (
                        filteredLeads.map(lead => (
                          <div 
                            key={lead.id} 
                            className={`wa-dropdown-item ${selectedLeadId === lead.id ? 'selected' : ''}`}
                            onClick={() => handleSelectLead(lead)}
                          >
                            <div className="wa-item-main">
                              <div className="wa-item-name">{lead.customer}</div>
                              <div className="wa-item-sub">{lead.phone || 'No phone'} • {lead.location || 'Location N/A'}</div>
                            </div>
                            <div className="wa-item-tags">
                              <span className={`wa-tag stage-${lead.stage.toLowerCase()}`}>{lead.stage}</span>
                              {lead.dealerSpecifications?.systemCapacityKw && (
                                <span className="wa-tag-cap">{lead.dealerSpecifications.systemCapacityKw}</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* MANUAL PHONE & NAME OVERRIDES */}
                <div className="wa-input-grid">
                  <div className="wa-input-field">
                    <label htmlFor="waCustomerNameInput">Customer Name</label>
                    <input 
                      id="waCustomerNameInput"
                      name="waCustomerName"
                      type="text" 
                      value={recipientName} 
                      onChange={(e) => { setRecipientName(e.target.value); setIsEditingManually(false); }}
                      placeholder="e.g. Rajesh Sharma"
                    />
                  </div>
                  <div className="wa-input-field">
                    <label htmlFor="waCustomerPhoneInput">WhatsApp Phone</label>
                    <div className="wa-phone-input-group">
                      <span className="wa-phone-prefix">+91</span>
                      <input 
                        id="waCustomerPhoneInput"
                        name="waCustomerPhone"
                        type="tel" 
                        value={recipientPhone} 
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="10-digit number"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* TEMPLATE PICKER */}
              <div className="wa-section-card">
                <div className="wa-card-header">
                  <span className="wa-card-title"><Sliders size={14} /> Select Smart Template</span>
                  <span className="wa-card-badge">{TEMPLATE_CONFIGS.length} Templates</span>
                </div>

                <div className="wa-template-pills">
                  {TEMPLATE_CONFIGS.map(t => (
                    <button
                      key={t.key}
                      className={`wa-template-pill ${selectedTemplate === t.key ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTemplate(t.key);
                        setIsEditingManually(false);
                      }}
                      title={t.desc}
                    >
                      <span className="wa-pill-icon" style={{ color: t.color }}>{t.icon}</span>
                      <span className="wa-pill-text">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DYNAMIC PARAMETERS CARD */}
              <div className="wa-section-card">
                <div className="wa-card-header">
                  <span className="wa-card-title"><Zap size={14} /> Template Parameters</span>
                  <span className="wa-card-desc">Auto-calculated</span>
                </div>

                {/* Proposal / ROI / Hinglish Parameter Controls */}
                {(selectedTemplate === 'proposal' || selectedTemplate === 'roi' || selectedTemplate === 'hinglish' || selectedTemplate === 'followup' || selectedTemplate === 'custom') && (
                  <div className="wa-params-group">
                    <div className="wa-param-row">
                      <div className="wa-slider-header">
                        <label htmlFor="waCapacitySlider">System Capacity: <strong>{capacityKw} kW</strong></label>
                        <span className="wa-slider-stat">Subsidy: ₹{subsidyAmount.toLocaleString()}</span>
                      </div>
                      <input 
                        id="waCapacitySlider"
                        name="waCapacityKw"
                        type="range" 
                        min="1" 
                        max="15" 
                        step="0.5" 
                        value={capacityKw} 
                        onChange={(e) => handleCapacityChange(parseFloat(e.target.value))}
                        className="wa-capacity-slider"
                      />
                      <div className="wa-quick-kw-buttons">
                        {[2, 3, 5, 8, 10].map(kw => (
                          <button 
                            key={kw} 
                            className={`wa-kw-btn ${capacityKw === kw ? 'active' : ''}`}
                            onClick={() => handleCapacityChange(kw)}
                          >
                            {kw} kW
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="wa-stats-grid">
                      <div className="wa-stat-box">
                        <span className="wa-stat-label">Total Cost</span>
                        <span className="wa-stat-val">₹{grandTotal.toLocaleString()}</span>
                      </div>
                      <div className="wa-stat-box highlight">
                        <span className="wa-stat-label">PM Surya Subsidy</span>
                        <span className="wa-stat-val">₹{subsidyAmount.toLocaleString()}</span>
                      </div>
                      <div className="wa-stat-box primary">
                        <span className="wa-stat-label">Net Payable</span>
                        <span className="wa-stat-val">₹{netPayable.toLocaleString()}</span>
                      </div>
                      <div className="wa-stat-box">
                        <span className="wa-stat-label">Est. Savings</span>
                        <span className="wa-stat-val">₹{monthlySavings.toLocaleString()}/mo</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Site Survey Specific Inputs */}
                {selectedTemplate === 'survey' && (
                  <div className="wa-params-grid">
                    <div className="wa-input-field">
                      <label htmlFor="waSurveyDateInput">Survey Date</label>
                      <input 
                        id="waSurveyDateInput"
                        name="waSurveyDate"
                        type="date" 
                        value={surveyDate} 
                        onChange={(e) => { setSurveyDate(e.target.value); setIsEditingManually(false); }} 
                      />
                    </div>
                    <div className="wa-input-field">
                      <label htmlFor="waSurveyTimeInput">Survey Time</label>
                      <input 
                        id="waSurveyTimeInput"
                        name="waSurveyTime"
                        type="text" 
                        value={surveyTime} 
                        onChange={(e) => { setSurveyTime(e.target.value); setIsEditingManually(false); }} 
                        placeholder="e.g. 11:30 AM"
                      />
                    </div>
                    <div className="wa-input-field full-width">
                      <label htmlFor="waEngineerNameInput">Engineer / Executive Name</label>
                      <input 
                        id="waEngineerNameInput"
                        name="waEngineerName"
                        type="text" 
                        value={engineerName} 
                        onChange={(e) => { setEngineerName(e.target.value); setIsEditingManually(false); }} 
                      />
                    </div>
                  </div>
                )}

                {/* Bank Loan Inputs */}
                {selectedTemplate === 'loan' && (
                  <div className="wa-params-grid">
                    <div className="wa-input-field">
                      <label htmlFor="waBankNameInput">Bank Name</label>
                      <input 
                        id="waBankNameInput"
                        name="waBankName"
                        type="text" 
                        value={bankName} 
                        onChange={(e) => { setBankName(e.target.value); setIsEditingManually(false); }} 
                      />
                    </div>
                    <div className="wa-input-field">
                      <label htmlFor="waApplicationNumberInput">Application / E-Token</label>
                      <input 
                        id="waApplicationNumberInput"
                        name="waApplicationNumber"
                        type="text" 
                        value={applicationNumber} 
                        onChange={(e) => { setApplicationNumber(e.target.value); setIsEditingManually(false); }} 
                        placeholder="e.g. JS-2026-871"
                      />
                    </div>
                    <div className="wa-input-field full-width">
                      <label htmlFor="waLoanStatusSelect">Status</label>
                      <select 
                        id="waLoanStatusSelect"
                        name="waLoanStatus"
                        value={loanStatus} 
                        onChange={(e: any) => { setLoanStatus(e.target.value); setIsEditingManually(false); }}
                        className="wa-select"
                      >
                        <option value="Under Verification">Under Verification</option>
                        <option value="Approved">Approved / Sanctioned</option>
                        <option value="Disbursed">Disbursed to Mirror Solar</option>
                        <option value="Submitted">Submitted on JanSamarth</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Dispatch Inputs */}
                {selectedTemplate === 'dispatch' && (
                  <div className="wa-params-grid">
                    <div className="wa-input-field full-width">
                      <label htmlFor="waItemsDispatchedInput">Dispatched Items</label>
                      <input 
                        id="waItemsDispatchedInput"
                        name="waItemsDispatched"
                        type="text" 
                        value={itemsDispatched} 
                        onChange={(e) => { setItemsDispatched(e.target.value); setIsEditingManually(false); }} 
                      />
                    </div>
                    <div className="wa-input-field">
                      <label htmlFor="waLorryReceiptInput">LR / Tracking No.</label>
                      <input 
                        id="waLorryReceiptInput"
                        name="waLorryReceipt"
                        type="text" 
                        value={lorryReceiptNumber} 
                        onChange={(e) => { setLorryReceiptNumber(e.target.value); setIsEditingManually(false); }} 
                        placeholder="LR-12345"
                      />
                    </div>
                  </div>
                )}

                {/* Payment Milestone Inputs */}
                {selectedTemplate === 'payment' && (
                  <div className="wa-params-grid">
                    <div className="wa-input-field">
                      <label htmlFor="waPaymentGrandTotal">Total Project Cost (₹)</label>
                      <input 
                        id="waPaymentGrandTotal"
                        name="waGrandTotal"
                        type="number" 
                        value={grandTotal} 
                        onChange={(e) => { setGrandTotal(Number(e.target.value)); setIsEditingManually(false); }} 
                      />
                    </div>
                    <div className="wa-input-field">
                      <label htmlFor="waPaymentTotalPaid">Amount Paid (₹)</label>
                      <input 
                        id="waPaymentTotalPaid"
                        name="waTotalPaid"
                        type="number" 
                        value={totalPaid} 
                        onChange={(e) => { 
                          const paid = Number(e.target.value);
                          setTotalPaid(paid); 
                          setBalanceDue(Math.max(0, grandTotal - paid));
                          setIsEditingManually(false);
                        }} 
                      />
                    </div>
                    <div className="wa-input-field full-width">
                      <label htmlFor="waPaymentBalanceDue">Balance Due (₹)</label>
                      <input 
                        id="waPaymentBalanceDue"
                        name="waBalanceDue"
                        type="number" 
                        value={balanceDue} 
                        onChange={(e) => { setBalanceDue(Number(e.target.value)); setIsEditingManually(false); }} 
                      />
                    </div>
                  </div>
                )}

                {/* Quick Smart Tag Inserters */}
                <div className="wa-tags-container">
                  <span className="wa-tags-label">Quick Tags:</span>
                  <button type="button" className="wa-chip-btn" onClick={() => handleInsertTag(`*${recipientName}*`)}>+ Name</button>
                  <button type="button" className="wa-chip-btn" onClick={() => handleInsertTag(`*${capacityKw} kW*`)}>+ Capacity</button>
                  <button type="button" className="wa-chip-btn" onClick={() => handleInsertTag(`₹${subsidyAmount.toLocaleString()}`)}>+ Subsidy</button>
                  <button type="button" className="wa-chip-btn" onClick={() => handleInsertTag(`₹${netPayable.toLocaleString()}`)}>+ Net Payable</button>
                  <button type="button" className="wa-chip-btn" onClick={() => handleInsertTag(`₹${monthlySavings.toLocaleString()}/mo`)}>+ Savings</button>
                </div>
              </div>

              {/* LIVE WHATSAPP CHAT PREVIEW */}
              <div className="wa-preview-card">
                <div className="wa-preview-header">
                  <div className="wa-preview-phone-bar">
                    <div className="wa-avatar-mini">
                      <span>{recipientName.charAt(0) || 'C'}</span>
                    </div>
                    <div className="wa-phone-details">
                      <div className="wa-chat-name">{recipientName || 'Customer'}</div>
                      <div className="wa-chat-status">{recipientPhone ? `+91 ${recipientPhone}` : 'WhatsApp Ready'}</div>
                    </div>
                  </div>
                  {isEditingManually && (
                    <button 
                      className="wa-reset-draft-btn" 
                      onClick={() => setIsEditingManually(false)}
                      title="Reset to template auto-generation"
                    >
                      <RefreshCw size={12} /> Reset to Auto
                    </button>
                  )}
                </div>

                <div className="wa-chat-container">
                  <div className="wa-bubble-outgoing">
                    <textarea 
                      className="wa-bubble-textarea"
                      value={activeMessageText}
                      onChange={(e) => {
                        setCustomDraft(e.target.value);
                        setIsEditingManually(true);
                      }}
                      rows={9}
                      placeholder="Type your WhatsApp message..."
                    />
                    <div className="wa-bubble-footer">
                      <span className="wa-bubble-time">
                        {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span className="wa-bubble-checks">✓✓</span>
                    </div>
                  </div>
                </div>

                {/* DISPATCH ACTION BUTTONS */}
                <div className="wa-dispatch-actions">
                  <button 
                    className="wa-action-btn wa-btn-copy" 
                    onClick={handleCopy}
                    title="Copy message text to clipboard"
                  >
                    {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                    <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>

                  {selectedLeadId && (
                    <button 
                      className="wa-action-btn wa-btn-log" 
                      onClick={handleLogToCRM}
                      title="Log this communication to CRM Lead Notes & History"
                    >
                      <CheckCircle2 size={16} />
                      <span>{logSuccess ? 'Logged!' : 'Log in CRM'}</span>
                    </button>
                  )}

                  <button 
                    className="wa-action-btn wa-btn-send-main" 
                    onClick={handleSendWhatsApp}
                    title="Open WhatsApp Web or App to dispatch directly"
                  >
                    <Send size={16} />
                    <span>Send via WhatsApp</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB CONTENT: URGENT NUDGES */}
          {activeTab === 'urgent' && (
            <div className="wa-buddy-content">
              <div className="wa-urgent-intro">
                <div className="wa-urgent-icon-circle">
                  <Zap size={20} />
                </div>
                <div className="wa-urgent-text">
                  <h4>Smart Action Hub</h4>
                  <p>One-click follow-up dispatch for high-priority solar leads, bank verifications, and due tasks.</p>
                </div>
              </div>

              {urgentLeads.length === 0 ? (
                <div className="wa-empty-card">
                  <CheckCircle2 size={36} className="text-success" />
                  <h4>All Caught Up!</h4>
                  <p>No overdue follow-ups or pending urgent actions right now.</p>
                </div>
              ) : (
                <div className="wa-urgent-list">
                  {urgentLeads.map(lead => {
                    const isDueToday = lead.followUp?.date === new Date().toISOString().split('T')[0];
                    const isOverdue = lead.followUp?.status === 'Overdue';

                    return (
                      <div key={lead.id} className="wa-urgent-item">
                        <div className="wa-urgent-header">
                          <div className="wa-urgent-lead-info">
                            <span className="wa-lead-title">{lead.customer}</span>
                            <span className="wa-lead-phone">{lead.phone || 'No phone'} • {lead.location || 'Location N/A'}</span>
                          </div>
                          <span className={`wa-badge stage-${lead.stage.toLowerCase()}`}>
                            {lead.stage}
                          </span>
                        </div>

                        <div className="wa-urgent-reason">
                          {isDueToday && <span className="wa-reason-tag today"><Clock size={12} /> Follow-up Due Today</span>}
                          {isOverdue && <span className="wa-reason-tag overdue"><AlertCircle size={12} /> Follow-up Overdue</span>}
                          {lead.stage === 'Loan' && <span className="wa-reason-tag loan"><Landmark size={12} /> Bank Loan Verification</span>}
                          {lead.stage === 'Lead' && <span className="wa-reason-tag proposal"><FileText size={12} /> Ready for Quotation</span>}
                        </div>

                        <div className="wa-urgent-footer">
                          <span className="wa-urgent-cap">{lead.dealerSpecifications?.systemCapacityKw || '3 kW System'}</span>
                          <button 
                            className="wa-nudge-btn"
                            onClick={() => handleNudgeLead(lead)}
                          >
                            <Send size={13} /> Nudge on WhatsApp
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: BILL ESTIMATOR */}
          {activeTab === 'estimator' && (
            <div className="wa-buddy-content">
              <div className="wa-estimator-card">
                <div className="wa-estimator-header">
                  <Sparkles size={20} className="text-warning" />
                  <div>
                    <h4>Electricity Bill to Solar Pitch</h4>
                    <p>Enter the customer's average monthly electricity bill to automatically calculate system capacity, subsidy, and savings.</p>
                  </div>
                </div>

                <div className="wa-bill-input-box">
                  <label htmlFor="waMonthlyBillInput">Customer's Monthly Electricity Bill</label>
                  <div className="wa-bill-input-row">
                    <span className="wa-currency">₹</span>
                    <input 
                      id="waMonthlyBillInput"
                      name="waMonthlyBill"
                      type="number" 
                      value={monthlyBillInput} 
                      onChange={(e) => setMonthlyBillInput(Math.max(500, Number(e.target.value)))}
                      step="500"
                    />
                    <span className="wa-period">/ month</span>
                  </div>

                  <div className="wa-bill-quick-presets">
                    {[1500, 2500, 3500, 5000, 8000, 12000].map(amt => (
                      <button 
                        key={amt}
                        className={`wa-preset-btn ${monthlyBillInput === amt ? 'active' : ''}`}
                        onClick={() => setMonthlyBillInput(amt)}
                      >
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ESTIMATOR RESULTS */}
                <div className="wa-estimator-results">
                  <div className="wa-result-hero">
                    <span className="wa-hero-label">Recommended System</span>
                    <span className="wa-hero-val">{billEstimate.capacityKw} kW Rooftop System</span>
                    <span className="wa-hero-sub">Generates ~{Math.round(billEstimate.capacityKw * 125)} units/month</span>
                  </div>

                  <div className="wa-result-grid">
                    <div className="wa-result-item">
                      <span className="wa-res-label">Gross Cost</span>
                      <span className="wa-res-val">₹{billEstimate.totalCost.toLocaleString()}</span>
                    </div>
                    <div className="wa-result-item subsidy">
                      <span className="wa-res-label">PM Surya Subsidy (DBT)</span>
                      <span className="wa-res-val">₹{billEstimate.subsidy.toLocaleString()}</span>
                    </div>
                    <div className="wa-result-item net">
                      <span className="wa-res-label">Net Investment</span>
                      <span className="wa-res-val">₹{billEstimate.netInvestment.toLocaleString()}</span>
                    </div>
                    <div className="wa-result-item">
                      <span className="wa-res-label">Annual Savings</span>
                      <span className="wa-res-val">₹{billEstimate.annualSavings.toLocaleString()}/yr</span>
                    </div>
                    <div className="wa-result-item payback">
                      <span className="wa-res-label">Payback Period</span>
                      <span className="wa-res-val">{billEstimate.paybackYears} Years</span>
                    </div>
                    <div className="wa-result-item free">
                      <span className="wa-res-label">Remaining Free Power</span>
                      <span className="wa-res-val">20+ Years</span>
                    </div>
                  </div>

                  <button 
                    className="wa-apply-estimate-btn"
                    onClick={handleApplyBillEstimate}
                  >
                    <Send size={15} /> Create WhatsApp Pitch with this Calculation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: HISTORY */}
          {activeTab === 'history' && (
            <div className="wa-buddy-content">
              <div className="wa-history-header">
                <h4>Recent WhatsApp Dispatches</h4>
                {history.length > 0 && (
                  <button 
                    className="wa-clear-history-btn"
                    onClick={() => setHistory([])}
                  >
                    Clear History
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="wa-empty-card">
                  <History size={32} />
                  <h4>No History Yet</h4>
                  <p>Messages dispatched through WhatsApp Buddy will appear here with quick resend options.</p>
                </div>
              ) : (
                <div className="wa-history-list">
                  {history.map(item => (
                    <div key={item.id} className="wa-history-card">
                      <div className="wa-history-top">
                        <div className="wa-history-user">
                          <strong>{item.recipientName}</strong>
                          <span>{item.recipientPhone}</span>
                        </div>
                        <span className="wa-history-time">{item.timestamp}</span>
                      </div>

                      <div className="wa-history-template-tag">
                        <FileText size={12} /> {item.templateLabel}
                      </div>

                      <p className="wa-history-preview-text">
                        {item.messageText.slice(0, 110)}...
                      </p>

                      <div className="wa-history-actions">
                        <button 
                          className="wa-history-resend-btn"
                          onClick={() => {
                            setRecipientName(item.recipientName);
                            setRecipientPhone(item.recipientPhone);
                            setSelectedTemplate(item.templateKey);
                            setCustomDraft(item.messageText);
                            setIsEditingManually(true);
                            setActiveTab('dispatch');
                          }}
                        >
                          <RefreshCw size={12} /> Load into Editor
                        </button>
                        <button 
                          className="wa-history-direct-btn"
                          onClick={() => {
                            const url = getWhatsAppDirectUrl(item.recipientPhone, item.messageText);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <Send size={12} /> Resend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DOCK FOOTER */}
          <div className="wa-buddy-footer">
            <div className="wa-footer-left">
              <span className="wa-footer-dot"></span>
              <span>Mirror Solar Vision Official Dispatcher</span>
            </div>
            <div className="wa-footer-right">
              <a 
                href="https://web.whatsapp.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="wa-footer-link"
              >
                Open WhatsApp Web <ExternalLink size={11} />
              </a>
            </div>
          </div>

        </div>
      )}
    </>
  );
}
