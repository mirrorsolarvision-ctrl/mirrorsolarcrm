/**
 * Sales Manager & Inbound Conversion Types
 * Mirror Solar CRM — Version 2.3 Architecture
 */

export type SalesStage = 
  | 'New Lead'
  | 'Contacted'
  | 'Qualified'
  | 'Site Survey Scheduled'
  | 'Quotation Sent'
  | 'Negotiation'
  | 'Advance Submitted'
  | 'Booking Confirmed'
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
