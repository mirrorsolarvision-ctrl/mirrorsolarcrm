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
 * 6. PM Surya Ghar KYC & Subsidy Document Checklist Template
 */
export function generateDocChecklistWhatsAppMessage(data: {
  customerName: string;
  portalName?: string;
}): string {
  return (
    `📋 *PM SURYA GHAR YOJANA - REQUIRED DOCUMENTS CHECKLIST* 📋\n\n` +
    `Dear *${data.customerName}*,\n\n` +
    `To process your Central Government Solar Subsidy (up to ₹78,000 DBT), please keep the following documents ready for our verification:\n\n` +
    `1️⃣ *Electricity Bill:* Latest copy (name must match consumer registration)\n` +
    `2️⃣ *Aadhaar Card:* Customer Aadhaar (Front & Back)\n` +
    `3️⃣ *Bank Passbook / Cancelled Cheque:* With clear Account No. & IFSC Code (for direct DBT subsidy transfer)\n` +
    `4️⃣ *House Tax Receipt / Proof of Ownership*\n` +
    `5️⃣ *Rooftop & Meter Photos:* Clear view of roof space and current meter box\n\n` +
    `You can simply reply and attach these photos directly here on WhatsApp, and our team will initiate the portal registration right away! 🚀\n\n` +
    `*Mirror Solar Vision Operations*\n` +
    `📞 Support: +91 98765 43210`
  );
}

/**
 * 7. Site Survey & Installation Appointment Template
 */
export function generateSiteSurveyWhatsAppMessage(data: {
  customerName: string;
  surveyDate: string;
  surveyTime?: string;
  engineerName?: string;
  engineerPhone?: string;
}): string {
  return (
    `📅 *MIRROR SOLAR - SITE SURVEY APPOINTMENT CONFIRMATION* 📅\n\n` +
    `Hello *${data.customerName}*,\n\n` +
    `Your rooftop solar site survey and shadow analysis has been scheduled:\n\n` +
    `🗓️ *Date:* ${data.surveyDate}\n` +
    (data.surveyTime ? `⏰ *Time:* ${data.surveyTime}\n` : '') +
    (data.engineerName ? `👷‍♂️ *Solar Engineer:* ${data.engineerName} ${data.engineerPhone ? `(${data.engineerPhone})` : ''}\n` : '') +
    `\nOur engineer will assess roof orientation, shadow-free area, and inverter-meter cabling pathway to maximize your solar generation.\n\n` +
    `See you soon!\n*Mirror Solar Technical Team*`
  );
}

/**
 * 8. Friendly Follow-up & Subsidy Urgency Nudge
 */
export function generateFollowUpWhatsAppMessage(data: {
  customerName: string;
  capacityKw?: number;
  lastDiscussionTopic?: string;
}): string {
  const capText = data.capacityKw ? `for your *${data.capacityKw} kW system*` : 'for your rooftop solar';
  return (
    `👋 *HELLO FROM MIRROR SOLAR VISION!* ☀️\n\n` +
    `Dear *${data.customerName}*,\n\n` +
    `Hope you are having a wonderful day!\n\n` +
    `We wanted to check in regarding your rooftop solar proposal ${capText}. As you know, the *PM Surya Ghar Muft Bijli Yojana* offers a direct government subsidy of up to *₹78,000* right now.\n\n` +
    `⚡ Locking in your solar installation this month protects your home from upcoming peak summer tariff hikes and gives you free electricity for 25+ years.\n\n` +
    `Would you have 5 minutes today for a quick call to address any questions or finalize the installation dates?\n\n` +
    `Best regards,\n*Mirror Solar Vision*\n🌐 www.mirrorsolar.in`
  );
}

/**
 * 9. Hinglish / Regional Persuasive Pitch
 */
export function generateHinglishPitchMessage(data: {
  customerName: string;
  capacityKw: number;
  monthlyBill?: number;
  monthlySavings: number;
}): string {
  return (
    `☀️ *MIRROR SOLAR - BIJLI BILL ZERO KAREIN!* ☀️\n\n` +
    `Namaste *${data.customerName}* ji,\n\n` +
    `Kripya dekhein aapka *${data.capacityKw} kW* Rooftop Solar System se kitna fayda hoga:\n\n` +
    (data.monthlyBill ? `⚡ *Abhi ka Monthly Bill:* ~₹${data.monthlyBill.toLocaleString()}/mahina\n` : '') +
    `💰 *Solar Lagane Ke Baad Monthly Bachat:* ₹${data.monthlySavings.toLocaleString()}/mahina\n` +
    `🏛️ *PM Surya Ghar Sarkari Subsidy:* Direct Bank Account me ₹78,000 tak DBT!\n` +
    `⏳ *Payback:* Sirf 3 se 4 saal me poora paisa vasool, agle 20+ saal tak FREE Bijli!\n\n` +
    `Kripya batayein kab hum aapke ghar free rooftop inspection aur quotation handover kar sakte hain?\n\n` +
    `*Mirror Solar Vision*\n📞 Phone: +91 98765 43210`
  );
}

/**
 * Estimate solar capacity and savings from monthly electricity bill
 */
export function estimateSolarFromBill(monthlyBill: number) {
  const safeBill = Math.max(500, Number(monthlyBill) || 3000);
  const tariffPerUnit = 7.5;
  const unitsPerMonth = safeBill / tariffPerUnit;
  // 1 kW generates approx 120-130 units per month
  const rawKw = unitsPerMonth / 125;
  const capacityKw = Math.max(1, Math.min(20, Math.round(rawKw * 2) / 2)); // Round to nearest 0.5 kW
  
  // PM Surya Ghar Subsidy
  let subsidy = 0;
  if (capacityKw <= 1) subsidy = 30000;
  else if (capacityKw <= 2) subsidy = 60000;
  else subsidy = 78000;

  const costPerKw = capacityKw <= 3 ? 65000 : 58000;
  const totalCost = capacityKw * costPerKw;
  const netInvestment = Math.max(0, totalCost - subsidy);
  const monthlySavings = Math.round(capacityKw * 4.3 * 30 * tariffPerUnit);
  const annualSavings = monthlySavings * 12;
  const paybackYears = Number((netInvestment / annualSavings).toFixed(1));

  return {
    capacityKw,
    totalCost,
    subsidy,
    netInvestment,
    monthlySavings,
    annualSavings,
    paybackYears,
  };
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
