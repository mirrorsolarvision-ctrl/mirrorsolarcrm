/**
 * Mirror Solar WhatsApp Dynamic Notification & Proposal Dispatch Engine
 */

export interface WhatsAppProposalData {
  customerName: string;
  customerPhone?: string;
  capacityKw: number;
  quotationNumber?: string;
  grandTotal: number;
  subsidyAmount: number;
  netPayable: number;
  monthlySavings?: number;
  paybackPeriod?: string;
  proposalDownloadUrl?: string;
  dealerName?: string;
  dealerPhone?: string;
}

export interface WhatsAppLoanUpdateData {
  customerName: string;
  customerPhone?: string;
  bankName?: string;
  applicationNumber?: string;
  status: 'Submitted' | 'Approved' | 'Disbursed' | 'Under Verification';
  loanAmount?: number;
}

export interface WhatsAppDispatchUpdateData {
  customerName: string;
  customerPhone?: string;
  systemCapacity: string;
  itemsDispatched: string;
  lorryReceiptNumber?: string;
  expectedDeliveryDate?: string;
}

export interface WhatsAppPaymentReminderData {
  customerName: string;
  customerPhone?: string;
  totalQuotationAmount: number;
  totalPaid: number;
  balanceDue: number;
  dueDate?: string;
  upiPaymentLink?: string;
}

/**
 * Strips non-digit characters and normalizes Indian numbers to 91XXXXXXXXXX
 */
export function normalizePhoneForWhatsApp(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

/**
 * 1. High-Converting Solar Quotation & PM Surya Ghar Subsidy Proposal Template
 */
export function generateQuotationWhatsAppMessage(data: WhatsAppProposalData): string {
  const quoteRef = data.quotationNumber ? ` (Ref: ${data.quotationNumber})` : '';
  const estSavings = data.monthlySavings ? `\n⚡ *Estimated Monthly Savings:* ₹${data.monthlySavings.toLocaleString()}/month` : '';
  const estPayback = data.paybackPeriod ? `\n⏳ *Estimated Payback Period:* ${data.paybackPeriod}` : '';
  const linkText = data.proposalDownloadUrl ? `\n\n📄 *View & Download Official Proposal:* \n${data.proposalDownloadUrl}` : '';

  return (
    `🌞 *MIRROR SOLAR VISION - SOLAR QUOTATION PROPOSAL* 🌞\n\n` +
    `Dear *${data.customerName}*,\n\n` +
    `Thank you for choosing Mirror Solar Vision. We are pleased to present your customized rooftop solar proposal${quoteRef}:\n\n` +
    `📌 *System Capacity:* ${data.capacityKw} kW On-Grid System\n` +
    `💰 *Total Project Cost:* ₹${data.grandTotal.toLocaleString()}\n` +
    `🏛️ *PM Surya Ghar Subsidy:* ₹${data.subsidyAmount.toLocaleString()} *(Direct DBT)*\n` +
    `👉 *Net Payable by Customer:* ₹${data.netPayable.toLocaleString()}` +
    estSavings +
    estPayback +
    linkText +
    `\n\n✅ *Key Inclusions:* TopCon/Mono PERC High-Efficiency Panels, Dual MPPT Inverter, 80-Micron GI Structure, Net Metering & 5-Year Comprehensive Warranty.` +
    `\n\nFor any questions or installation scheduling, please reply directly to this message.\n\n` +
    `Warm regards,\n*Mirror Solar Vision Team*\n🌐 www.mirrorsolar.in`
  );
}

/**
 * 2. Solar ROI & Savings Pitch Template
 */
export function generateRoiPitchWhatsAppMessage(data: {
  customerName: string;
  capacityKw: number;
  monthlySavings: number;
  annualSavings: number;
  lifetimeSavings: number;
  netInvestment: number;
  paybackYears: number;
  paybackMonths: number;
}): string {
  return (
    `💡 *HOW MUCH WILL YOU SAVE WITH SOLAR?* 💡\n\n` +
    `Hello *${data.customerName}*,\n\n` +
    `Here is your estimated savings breakdown with a *${data.capacityKw} kW* Mirror Solar Rooftop System:\n\n` +
    `💵 *Monthly Electricity Bill Savings:* ₹${data.monthlySavings.toLocaleString()}/mo\n` +
    `📅 *Annual Savings (Year 1):* ₹${data.annualSavings.toLocaleString()}/yr\n` +
    `📈 *25-Year Cumulative Savings:* ₹${data.lifetimeSavings.toLocaleString()}\n` +
    `⏳ *Payback Period:* ${data.paybackYears} Years ${data.paybackMonths > 0 ? `& ${data.paybackMonths} Months` : ''}\n` +
    `💰 *Net One-Time Investment:* ₹${data.netInvestment.toLocaleString()}\n\n` +
    `After payback, enjoy *FREE electricity for the remaining 20+ years!* ☀️⚡\n\n` +
    `Ready to switch to solar? Let us know when we can conduct your free rooftop survey.\n\n` +
    `*Mirror Solar Vision*`
  );
}

/**
 * 3. JanSamarth / Bank Loan Status Notification
 */
export function generateLoanUpdateWhatsAppMessage(data: WhatsAppLoanUpdateData): string {
  return (
    `🏦 *MIRROR SOLAR - BANK LOAN UPDATE* 🏦\n\n` +
    `Dear *${data.customerName}*,\n\n` +
    `Your solar financing application status has been updated:\n\n` +
    `📋 *Status:* *${data.status.toUpperCase()}*\n` +
    (data.bankName ? `🏛️ *Bank:* ${data.bankName}\n` : '') +
    (data.applicationNumber ? `🔢 *Application / E-Token No:* ${data.applicationNumber}\n` : '') +
    (data.loanAmount ? `💵 *Sanctioned Amount:* ₹${data.loanAmount.toLocaleString()}\n` : '') +
    `\nOur processing team is coordinating with the branch for swift disbursement.\n\n` +
    `Best regards,\n*Mirror Solar Vision Team*`
  );
}

/**
 * 4. Material Dispatch Alert Template
 */
export function generateMaterialDispatchWhatsAppMessage(data: WhatsAppDispatchUpdateData): string {
  return (
    `🚚 *SOLAR MATERIAL DISPATCHED FROM CENTRAL WAREHOUSE* 🚚\n\n` +
    `Dear *${data.customerName}*,\n\n` +
    `Good news! The solar equipment for your *${data.systemCapacity}* plant has been dispatched:\n\n` +
    `📦 *Items In Transit:* ${data.itemsDispatched}\n` +
    (data.lorryReceiptNumber ? `📄 *Lorry Receipt / LR No:* ${data.lorryReceiptNumber}\n` : '') +
    (data.expectedDeliveryDate ? `📅 *Expected Site Delivery:* ${data.expectedDeliveryDate}\n` : '') +
    `\nOur installation team will arrive once materials are delivered for site setup.\n\n` +
    `*Mirror Solar Vision Operations*`
  );
}

/**
 * 5. Payment Milestone & Balance Due Reminder Template
 */
export function generatePaymentReminderWhatsAppMessage(data: WhatsAppPaymentReminderData): string {
  return (
    `💳 *MIRROR SOLAR - PAYMENT STATEMENT & RECEIPT* 💳\n\n` +
    `Dear *${data.customerName}*,\n\n` +
    `Please find your project payment summary below:\n\n` +
    `💰 *Total Project Value:* ₹${data.totalQuotationAmount.toLocaleString()}\n` +
    `✅ *Total Amount Paid:* ₹${data.totalPaid.toLocaleString()}\n` +
    `🔴 *Outstanding Balance Due:* ₹${data.balanceDue.toLocaleString()}\n` +
    (data.dueDate ? `📅 *Due By:* ${data.dueDate}\n` : '') +
    `\nBank transfers / UPI payments can be made directly to our registered Mirror Solar business account.\n\n` +
    `Thank you for your prompt cooperation!\n*Mirror Solar Accounts Team*`
  );
}

/**
 * Generates an openable WhatsApp Web / App intent URL
 */
export function getWhatsAppDirectUrl(phone: string, text: string): string {
  const normPhone = normalizePhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text);
  if (normPhone) {
    return `https://api.whatsapp.com/send?phone=${normPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
