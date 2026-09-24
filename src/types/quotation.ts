import type { CompanyDetails } from '../config/companyDetails';

export type QuotationStatus = 
  | 'Draft' 
  | 'Sent' 
  | 'Accepted' 
  | 'Amended' 
  | 'Rejected' 
  | 'Cancelled' 
  | 'Converted';

export type CustomerType = 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural' | 'Institutional';

export type PhaseType = 'Single Phase' | 'Three Phase';
export type PlantType = 'On-Grid' | 'Off-Grid' | 'Hybrid';
export type RoofType = 'RCC Flat Roof' | 'Slanted Tile Roof' | 'Tin Shed / Metal Sheet' | 'Ground Mount';

export interface QuotationCustomerDetails {
  customerName: string;
  mobileNumber: string;
  alternateNumber?: string;
  email?: string;
  address: string;
  city: string;
  district?: string;
  state: string;
  pinCode: string;
  siteAddress?: string;
  installationAddress?: string;
  customerType: CustomerType;
  gstin?: string;
}

export interface QuotationProjectDetails {
  systemCapacityKw: number;
  plantType: PlantType;
  phaseType: PhaseType;
  roofType: RoofType;
  sanctionedLoadKw?: number;
  discomName?: string;
  consumerNumber?: string;
  serviceNumber?: string;
  estimatedUnitsPerMonth?: number;
  estimatedAnnualSavings?: number;
}

export interface QuotationItem {
  id: string;
  category: 
    | 'Solar Panel'
    | 'Inverter'
    | 'Structure'
    | 'DC Cable'
    | 'AC Cable'
    | 'MC4 Connectors'
    | 'Earthing & Lightning'
    | 'ACDB & DCDB'
    | 'Installation & Commissioning'
    | 'Transportation & Logistics'
    | 'Civil Works & Foundation'
    | 'Battery Storage'
    | 'Net Metering & DISCOM Liasoning'
    | 'Accessories'
    | 'Custom Item';
  name: string;
  brand?: string;
  model?: string;
  specifications?: string;
  hsnCode?: string;
  quantity: number;
  unit: 'Nos' | 'Watts' | 'kW' | 'Sets' | 'Meters' | 'Lots' | 'Kg' | 'Sq.Ft' | 'Unit';
  unitRate: number;
  discount: number; // Flat discount per item or line
  taxRatePercent: number; // 0%, 5%, 12%, 18%, 28%
  taxAmount: number;
  total: number;
  notes?: string;
  isLocked?: boolean;
}

export interface QuotationFinancials {
  subtotal: number;
  totalItemDiscount: number;
  extraDiscount: number;
  taxableAmount: number;
  gstTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  subsidyEligible: boolean;
  subsidyAmount: number; // PM Surya Ghar Subsidy (e.g. ₹78,000 for 3kW)
  stateSubsidyAmount?: number;
  roundOff: number;
  grandTotal: number;
  netPayableByCustomer: number;
}

export interface QuotationVersionRecord {
  version: number;
  quotationId: string;
  createdAt: string;
  createdBy: string;
  grandTotal: number;
  status: QuotationStatus;
  notes?: string;
}

export interface Quotation {
  id: string; // e.g. QT-2026-0012
  quotationNumber: string;
  version: number;
  parentQuotationId?: string; // Links to V1 when amended
  
  // Relations
  leadId?: string;
  customerId?: string;
  dealerId?: string;
  dealerName?: string;
  
  // Author & Permissions
  createdBy: string;
  createdByRole: 'Admin' | 'Dealer' | 'Employee';
  createdById: string;
  
  // Status
  status: QuotationStatus;
  
  // Document Data
  customer: QuotationCustomerDetails;
  project: QuotationProjectDetails;
  items: QuotationItem[];
  financials: QuotationFinancials;
  
  // Notes & Payment terms
  notes?: string;
  customTerms?: string[];
  validityDays: number;
  
  // Locked Snapshots (Preserved for historical authenticity)
  companySnapshot: CompanyDetails;
  
  // Dates
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  convertedAt?: string;
  
  // Version Tree
  versionHistory?: QuotationVersionRecord[];
}
