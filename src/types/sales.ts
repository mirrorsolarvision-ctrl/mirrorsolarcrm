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
  location?: string;
  pincode?: string;
  roofOwnership?: 'Own' | 'Owned' | 'Rented' | 'Shared' | 'Commercial' | string;
  roofType?: 'RCC' | 'Tin Shed' | 'Metal Sheet' | 'Asbestos' | 'Tile' | 'Slanted' | 'Ground' | 'Other' | string;
  approxRoofAreaSqFt?: number;
  shadingCondition?: 'None' | 'Partial' | 'Heavy' | string;
  preferredCapacityKw?: number;
  budgetPreference?: 'JanSamarth Bank Loan' | 'Self-Funded Direct Payment' | string;
  decisionMaker?: string;
  expectedTimeline?: 'Immediate' | 'Within 7 Days' | 'Within 1 month' | 'Within 30 Days' | '1-3 months' | 'Exploring' | 'Later' | string;
  pmSuryaGharSubsidyInterest?: 'Yes' | 'No' | 'Needs explanation' | string;
  siteVisitRequired?: 'Yes' | 'No';
  qualificationResult?: 'Qualified' | 'Not Qualified' | 'Needs Follow-up' | string;
  qualifiedAt?: string;
  qualifiedBy?: string;
  leadScore?: any;
  notes?: string;
}

/**
 * Telecalling Call Record Data Model
 */
export type CallOutcome = 
  | 'Connected'
  | 'No Answer'
  | 'Busy'
  | 'Switched Off'
  | 'Switch Off'
  | 'Invalid Number'
  | 'Wrong Number'
  | 'Interested'
  | 'Connected - Interested'
  | 'Not Interested'
  | 'Connected - Not Interested'
  | 'Call Back Requested'
  | 'Connected - Callback';

export interface TelecallerCallLog {
  id: string;
  leadId?: string;
  customerName: string;
  phone: string;
  callDirection: 'Outgoing' | 'Incoming';
  durationSeconds?: number;
  outcome: CallOutcome;
  notes: string;
  customerRequirement?: string;
  updatedLeadStatus?: string;
  callDate?: string;
  callTime?: string;
  date?: string;
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
  | 'Passport Photo'
  | 'Bank Passbook / Cheque'
  | 'Property Tax Receipt'
  | 'PM Surya Ghar Application'
  | 'Site Photo'
  | 'Consent Form'
  | 'Payment Proof'
  | 'Other'
  | string;

export interface CustomerDocumentItem {
  id: string;
  docType: CustomerDocType;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByRole: string;
  fileSizeBytes: number;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

/**
 * Subview Navigation Types for Sales Department Workspace
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
