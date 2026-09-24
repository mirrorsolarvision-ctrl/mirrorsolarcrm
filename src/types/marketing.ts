export type LeadSource = 
  | 'Facebook'
  | 'Instagram'
  | 'Google'
  | 'WhatsApp'
  | 'Website'
  | 'YouTube'
  | 'Referral'
  | 'Dealer'
  | 'Walk-in'
  | 'Exhibition'
  | 'Other';

export type MarketingStage = 
  | 'NEW_LEAD'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'SITE_SURVEY_BOOKED'
  | 'QUOTATION_SENT'
  | 'FOLLOW_UP'
  | 'WON'
  | 'LOST';

export interface MarketingCampaign {
  id: string;
  name: string;
  source: LeadSource;
  budget?: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  notes?: string;
}

export interface MarketingFollowUp {
  id: string;
  leadId: string;
  scheduledAt: string;
  completedAt?: string;
  assignedTo: string;
  notes: string;
  status: 'PENDING' | 'COMPLETED' | 'MISSED';
  outcome?: string;
}

export interface MarketingLead {
  id: string;
  customerName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  city: string;
  state: string;
  address?: string;
  roofType?: string;
  monthlyElectricityBill?: number;
  desiredCapacityKw?: number;
  
  source: LeadSource;
  campaignId?: string;
  campaignName?: string;
  
  stage: MarketingStage;
  assignedMarketingEmployeeId?: string;
  assignedMarketingEmployeeName?: string;
  assignedDealerId?: string;
  assignedDealerName?: string;
  
  quotationId?: string;
  quotationAmount?: number;
  
  callCount: number;
  lastContactedAt?: string;
  nextFollowUpDate?: string;
  nextFollowUpTime?: string;
  
  notes: {
    id: string;
    text: string;
    author: string;
    createdAt: string;
  }[];
  
  createdAt: string;
  updatedAt: string;
}
