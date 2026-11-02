/**
 * Sales Manager & Telecalling Module Types
 * Mirror Solar CRM — Sales Department Architecture
 */

export type SalesStage = 
  | 'New Lead'
  | 'Contact Attempted'
  | 'Contacted'
  | 'Qualified'
  | 'Site Survey Scheduled'
  | 'Site Survey Completed'
  | 'Quotation Sent'
  | 'Negotiation'
  | 'Advance Submitted'
  | 'Booking Confirmed'
  | 'Project Handoff'
  | 'Lost';

export type LeadScoreCategory = 'Hot' | 'Warm' | 'Cold';

export interface LeadScoreBreakdown {
  total: number;
  category: LeadScoreCategory;
  readinessScore: number;
  unitsScore: number;
  roofScore: number;
  financingScore: number;
  calculatedAt: string;
}

export type AvailabilityStatus = 'Active' | 'On Leave' | 'Temporarily Unavailable' | 'Inactive';

export type SlaStatus = 'SLA Met' | 'SLA Breached' | 'Timer Running' | 'Pending First Call';

export type FinancingType = 'Bank Loan (JanSamarth)' | 'Self-Funded (Direct Payment)';

export type CommercialClearanceStatus = 'Cleared' | 'Pending';

export interface SalesLeakageMetrics {
  unassignedCount: number;
  slaBreachCount: number;
  overdueFollowupCount: number;
  quotationLeakageCount: number;
  pendingPaymentVerificationCount: number;
  pendingDealerHandoffCount: number;
  totalLeadsInFunnel: number;
  hotLeadsCount: number;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  matchingLeadId?: string;
  customerName?: string;
  leadOwnerName?: string;
  salesStage?: string;
  location?: string;
  normalizedPhone: string;
}

export interface IngestedEventRecord {
  eventId: string;
  source: string;
  leadId?: string;
  ingestedAt: string;
  status: 'PROCESSED' | 'DUPLICATE_IGNORED' | 'ERROR';
}

/**
 * 4-Pillar Customer Qualification Data Model
 */
export interface CustomerQualificationData {
  monthlyUnitsKwh?: number;
  monthlyBill?: number;
  sanctionedLoadKw?: number;
  phase?: 'Single Phase' | 'Three Phase';
  discom?: string;
  roofOwnership?: 'Own' | 'Rented' | 'Commercial' | string;
  roofType?: 'RCC' | 'Metal Sheet' | 'Asbestos' | 'Tile' | 'Other' | string;
  approxRoofAreaSqFt?: number;
  shadingCondition?: 'None' | 'Partial' | 'Heavy' | string;
  preferredCapacityKw?: number;
  budgetPreference?: 'JanSamarth Bank Loan' | 'Self-Funded Direct Payment' | string;
  decisionMaker?: string;
  expectedTimeline?: 'Immediate' | 'Within 7 Days' | 'Within 30 Days' | 'Later' | string;
  qualifiedAt?: string;
  qualifiedBy?: string;
  notes?: string;
}

/**
 * Telecalling Call Record Data Model
 */
export type CallOutcome = 
  | 'Connected - Interested'
  | 'Connected - Callback'
  | 'Connected - Not Interested'
  | 'Busy'
  | 'No Answer'
  | 'Switch Off'
  | 'Wrong Number';

export interface TelecallerCallLog {
  id: string;
  leadId?: string;
  customerName: string;
  phone: string;
  callDirection: 'Outgoing' | 'Incoming';
  durationSeconds?: number;
  outcome: CallOutcome;
  notes: string;
  nextFollowUpDate?: string;
  nextFollowUpTime?: string;
  telecallerId: string;
  telecallerName: string;
  timestamp: string;
}

/**
 * Customer Document Item Data Model
 */
export type CustomerDocType = 
  | 'Electricity Bill'
  | 'Aadhaar Card'
  | 'Roof Document'
  | 'Site Photo'
  | 'Consent Form'
  | 'Payment Proof'
  | 'Other';

export interface CustomerDocumentItem {
  id: string;
  leadId: string;
  customerName: string;
  docType: CustomerDocType;
  title: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  status: 'Pending' | 'Uploaded' | 'Verified' | 'Rejected';
  uploadedAt?: string;
  uploadedBy?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
}

/**
 * Subviews in the Sales Department Module
 */
export type SalesSubView = 
  | 'dashboard'
  | 'leads'
  | 'telecalling'
  | 'qualification'
  | 'pipeline'
  | 'followups'
  | 'whatsapp'
  | 'quotations'
  | 'bookings'
  | 'dealers'
  | 'documents'
  | 'reports'
  | 'performance';
