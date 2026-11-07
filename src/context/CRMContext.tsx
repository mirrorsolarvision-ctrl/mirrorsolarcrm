import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, addDoc, deleteDoc, query, where, writeBatch, getDocs } from 'firebase/firestore';
import { seedSampleLeads, defaultSeedLeads } from '../seedFirebase';
import { sanitizeForFirestore } from '../utils/firestoreUtils';
import { dispatchToast } from './UIContext';
import type { 
  SalesStage, 
  LeadScoreBreakdown, 
  AvailabilityStatus, 
  SlaStatus, 
  SalesLeakageMetrics,
  CustomerQualificationData,
  TelecallerCallLog
} from '../types/sales';
import { generateSecureId } from '../utils/idUtils';
import { calculateLeadScore } from '../utils/salesCalculations';
import { evaluateSlaStatus } from '../utils/salesCalculations';
import { isLeadAssignedToEmployee } from '../utils/employeeCalculations';

export const getIndiaDateString = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Kolkata', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(date);
};

export type Stage = 'Lead' | 'Converted' | 'Loan' | 'Material' | 'Installation' | 'Completed';
export const STAGES: Stage[] = ['Lead', 'Converted', 'Loan', 'Material', 'Installation', 'Completed'];

// --- 5 PROJECT DOCUMENT CATEGORIES & SPECIFICATIONS ---

// 1. First Doc: Dealer KYC & Site Survey
export const SECTION_1_DEALER_KYC_DOCS = [
  'Aadhaar Card',
  'PAN Card',
  'Bank Passbook or Cancelled Cheque',
  'Current Bill',
  'House Tax',
  'Passport Size Photo of Customer',
  'Site Photo',
  'Building Photo',
  'Signature Photo',
  'Meter Photo'
];

// 2. Second Doc: Bank First Payment Docs
export const SECTION_2_BANK_FIRST_PAYMENT_DOCS = [
  'E-Token',
  'Application Acknowledgement',
  'Net Metering Agreement',
  'Site Feasibility Report',
  'Quotation Document',
  'Feasibility Letter',
  'Advance Payment Receipt',
  'Digital Letter - JanSamarth Doc'
];

// Auto-linked in Section 2 from Section 1:
export const SECTION_2_LINKED_KYC_DOCS = [
  'Aadhaar Card',
  'PAN Card',
  'Current Bill',
  'House Tax',
  'Bank Passbook or Cancelled Cheque'
];

// 3. Third Doc: Site Installation Photos
export const SECTION_3_SITE_INSTALLATION_DOCS = [
  'Geo-Tagged Photo with Customer in Plant',
  'Earthing Image',
  'Panels Serial Numbers Images',
  'Inverter Serial Number'
];

// 4. Fourth Doc: Bank Second Payment Docs
export const SECTION_4_BANK_SECOND_PAYMENT_DOCS = [
  'PROJECT COMPLETION REPORT',
  'Tax Invoice Bill'
];

// 5. Fifth Doc: Grid or Current Office (DISCOM) Docs
export const SECTION_5_GRID_OFFICE_DOCS = [
  'Annexure - A',
  'Annexure - C',
  'SYNCHRONISATION',
  'PROJECT COMPLETION REPORT',
  'S Number Photo',
  'DCR Certificate Documents'
];

// Combined unique list of all project document types
export const ALL_DOCUMENT_TYPES = Array.from(new Set([
  ...SECTION_1_DEALER_KYC_DOCS,
  ...SECTION_2_BANK_FIRST_PAYMENT_DOCS,
  ...SECTION_3_SITE_INSTALLATION_DOCS,
  ...SECTION_4_BANK_SECOND_PAYMENT_DOCS,
  ...SECTION_5_GRID_OFFICE_DOCS
]));

// Backward-compatibility aliases
export const DEALER_KYC_DOCS = SECTION_1_DEALER_KYC_DOCS;
export const EMPLOYEE_PROCESSING_DOCS = SECTION_2_BANK_FIRST_PAYMENT_DOCS;
export const INSTALLATION_COMPLETION_DOCS = [
  ...SECTION_3_SITE_INSTALLATION_DOCS,
  ...SECTION_4_BANK_SECOND_PAYMENT_DOCS,
  ...SECTION_5_GRID_OFFICE_DOCS
];

export interface DocRequirementConfig {
  maxImages: number;
  minImages?: number;
  notice?: string;
  allowMultiple?: boolean;
}

export const DOC_REQUIREMENTS: Record<string, DocRequirementConfig> = {
  'Aadhaar Card': { maxImages: 2, notice: '1 or 2 images (Front & Back). Must be clear.' },
  'PAN Card': { maxImages: 1, notice: '1 clear image' },
  'Bank Passbook or Cancelled Cheque': { maxImages: 2, notice: '1 or 2 images. We need clear images with legible account number & IFSC code.' },
  'Current Bill': { maxImages: 2, notice: '1 or 2 images (Latest electricity bill)' },
  'House Tax': { maxImages: 1, notice: '1 image (Latest tax receipt)' },
  'Passport Size Photo of Customer': { maxImages: 1, notice: '1 passport photo of customer' },
  'Site Photo': { maxImages: 1, notice: '1 rooftop/site photo' },
  'Building Photo': { maxImages: 1, notice: '1 full building exterior photo' },
  'Signature Photo': { maxImages: 1, notice: '1 customer signature photo' },
  'Meter Photo': { maxImages: 2, notice: '1 or 2 images of existing meter & reading' },
  'Geo-Tagged Photo with Customer in Plant': { maxImages: 1, notice: '1 geo-tagged photo with customer at installed solar plant' },
  'Earthing Image': { maxImages: 1, notice: '1 earthing setup photo' },
  'Panels Serial Numbers Images': { maxImages: 999, minImages: 2, allowMultiple: true, notice: 'Min 2 to multiple images. All panel barcodes/serial numbers must be clearly readable.' },
  'Inverter Serial Number': { maxImages: 1, notice: '1 clear photo of inverter serial number & rating plate' },
  'PROJECT COMPLETION REPORT': { maxImages: 1, notice: '1 Project Completion Report (PCR)' },
  'Tax Invoice Bill': { maxImages: 1, notice: '1 Tax invoice bill copy' },
  'Annexure - A': { maxImages: 1, notice: 'Annexure - A form copy' },
  'Annexure - C': { maxImages: 1, notice: 'Annexure - C form copy' },
  'SYNCHRONISATION': { maxImages: 1, notice: 'Synchronisation report' },
  'S Number Photo': { maxImages: 1, notice: '1 clear S-Number photo' },
  'DCR Certificate Documents': { maxImages: 2, notice: 'DCR certificate documents' },
};

export interface DealerProjectSpecifications {
  email?: string;
  phone?: string;
  fullName?: string;
  panelWp?: string; // e.g., '540 Wp', '610 Wp', '550 Wp'
  phase?: '1 Phase' | '3 Phase';
  systemCapacityKw?: string; // e.g., '3 kW', '5 kW'
  buildingFloors?: string; // e.g., '1 Floor', '2 Floors'
  structureHeightAndType?: string; // e.g., 'Company Structure', 'Custom Welding Structure'
  lightningArresterStand?: 'Yes' | 'No';
  pipes10FeetCount?: string;
  longLBendsCount?: string;
  shortLBendsCount?: string;
  tBendsCount?: string;
  straightJointConnectorsCount?: string;
  dcRedWireLength?: string;
  dcBlackWireLength?: string;
  acRedWireLength?: string;
  acBlackWireLength?: string;
  greenWireLength?: string;
  bankIfscCode?: string;
  emailProofUrl?: string;
  emailProofFileName?: string;
}

export type LeadPriority = 'High' | 'Medium' | 'Low';
export type FollowUpStatus = 'Due Today' | 'Overdue' | 'Upcoming' | 'No Follow-up' | 'Completed';
export type FollowUpType = 'Call' | 'Visit' | 'Document' | 'Payment' | 'Other';

export interface FollowUp {
  date: string;
  time: string;
  type: FollowUpType;
  status: FollowUpStatus;
  notes?: string;
}

export type DocumentStatus = 'Pending' | 'Uploaded' | 'Additional Document Required' | 'Verified' | 'Rejected';

export interface LeadDocument {
  id: string;
  name?: string;
  category?: string;
  leadId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedByRole: string;
  uploadedByUserId: string;
  uploadedAt: string;
  notes?: string;
  status: DocumentStatus;
  isKycSecured?: boolean;
}

export type EmployeeWorkStatus = 'Not Started' | 'In Progress' | 'Waiting for Documents' | 'Waiting for Customer' | 'Waiting for Approval' | 'Completed';

export interface ProjectUpdate {
  id: string;
  description: string;
  status: EmployeeWorkStatus;
  updatedByUserId: string;
  updatedByRole: string;
  updatedAt: string;
}

export type InstallationApprovalStatus = 'None' | 'Pending' | 'Approved' | 'Rejected';

export type PaymentMilestoneType = 'Pre-Installation' | 'Post-Installation';
export type PaymentMilestoneStatus = 'Pending Settlement' | 'Settled' | 'Received';

export type CustomerPaymentType = 'Booking / Advance' | 'Token' | 'First Milestone' | 'Bank Loan Disbursal' | 'Final Payment' | 'Subsidy Received' | 'Other';
export type CustomerPaymentMode = 'UPI' | 'Bank Transfer / NEFT' | 'Net Banking' | 'Cheque' | 'Cash' | 'Bank Loan' | 'Credit / Debit Card' | 'Other';
export type CustomerPaymentStatus = 'Pending Verification' | 'Verified' | 'Rejected';

export interface CustomerPaymentRecord {
  id: string;
  date?: string;
  mode?: string;
  leadId: string;
  customerName: string;
  amount: number;
  paymentType: CustomerPaymentType;
  paymentMode: CustomerPaymentMode;
  status: CustomerPaymentStatus;
  paidAt: string;
  recordedBy: string;
  recordedByUid?: string;
  recordedByEmail?: string;
  recordedByRole: string;
  proofUrl?: string;
  proofFileName?: string;
  proofFileSize?: number;
  referenceNumber?: string; // UTR / Transaction ID / Cheque #
  notes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedByUid?: string;
  verifiedByRole?: string;
  settledBy?: string;
  settledByRole?: string;
  rejectionReason?: string;
}

export interface PaymentMilestone {
  id: string;
  type: PaymentMilestoneType;
  amount?: number;
  status: PaymentMilestoneStatus;
  settledAt?: string;
  settledBy?: string;
  proofUrl?: string;
  proofFileName?: string;
  proofFileSize?: number;
  utrNumber?: string;
  adminNotes?: string;
  receivedAt?: string;
  receivedBy?: string;
  dealerNotes?: string;
}

export interface LeadPayments {
  // Admin to Dealer Payouts
  preInstallation?: PaymentMilestone;
  postInstallation?: PaymentMilestone;
  totalAgreedAmount?: number;
  
  // Customer to Admin Payments
  customerPayments?: CustomerPaymentRecord[];
  totalProjectCost?: number;
}

export interface MockLead {
  id: string;
  customer: string;
  phone: string;
  email: string;
  location: string;
  dealer: string;
  dealerId?: string;
  dealerCode?: string;
  dealerStatus?: 'None' | 'Requested' | 'Pending' | 'Approved' | 'Rejected';
  dealerRequestedAt?: string;
  dealerRequestedBy?: string;
  dealerNotes?: string;
  assignedEmployee: string;
  assignedEmployeeId?: string;
  stage: Stage;
  priority: LeadPriority;
  followUp: FollowUp;
  updatedAt: string;
  createdAt: string;
  convertedAt?: string;
  archived: boolean;
  notes?: string;
  leadType?: 'tracking' | 'project';
  documents?: LeadDocument[];
  workStatus?: EmployeeWorkStatus;
  projectUpdates?: ProjectUpdate[];
  installationApprovalStatus?: InstallationApprovalStatus;
  installationRejectionReason?: string;
  payments?: LeadPayments;
  dealerSpecifications?: DealerProjectSpecifications;
  paymentVerificationStatus?: 'Verified' | 'Pending Verification' | 'Rejected' | 'None';
  createdBy?: string;
  createdByName?: string;
  createdByRole?: string;
  source?: string;
  marketingEmployee?: string;
  sourceMarketingEmployee?: string;
  sourceDealer?: string;
  reassignmentRequest?: LeadReassignmentRequest;
  customerCode?: string;
  code?: string;
  // Sales Manager & Conversion Funnel Properties (Version 2.3)
  salesStage?: SalesStage;
  leadOwnerId?: string;
  leadOwnerName?: string;
  customerId?: string;
  leadScore?: LeadScoreBreakdown;
  firstCallAttemptAt?: string;
  slaStatus?: SlaStatus;
  pincode?: string;
  lastCallDate?: string;
  customerRequirement?: string;
  financingType?: 'Bank Loan (JanSamarth)' | 'Self-Funded (Direct Payment)';
  commercialClearanceStatus?: 'Cleared' | 'Pending';
  handoffAcceptedAt?: string;
  availabilityStatus?: AvailabilityStatus;
  qualificationData?: CustomerQualificationData;
  callLogs?: TelecallerCallLog[];
  town?: string;
  district?: string;
  capacityKw?: string;
  capacity?: string;
  customerInterest?: 'Interested' | 'Not Interested' | 'Evaluating';
  budgetReadiness?: 'Budget Ready' | 'Seeking Loan' | 'Price Sensitive';
  roofSuitability?: 'RCC Flat Roof Suitable' | 'Tin Shed' | 'Tiled Roof' | 'Site Survey Required';
  siteVisitRequired?: boolean;
  managerEscalated?: boolean;
  managerEscalationReason?: string;
  lastContactDate?: string;
  monthlyBill?: number;
  date?: string;
}

export interface LeadReassignmentRequest {
  requestedBy?: string;
  requestedByRole?: string;
  requestedByUserId?: string;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: string;
  targetEmployee?: string;
  targetEmployeeId?: string;
  targetDealer?: string;
  targetDealerId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  rejectionReason?: string;
}

export type PermissionLevel = 'full' | 'edit' | 'view' | 'none';

export type ActivityType = string;

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  user: string;
  leadId?: string;
  dealer?: string;
  employee?: string;
  createdAt: string;
}

export type TaskType = 'Follow-up' | 'Project Work' | 'Document Required' | 'Document Review' | 'Customer Visit' | 'Installation' | 'Payment' | 'General Task' | 'Other';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string;
  title: string;
  description: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  dueTime?: string;
  assignedToUserId: string;
  assignedByUserId: string;
  leadId?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface UserPermissions {
  dashboard: PermissionLevel;
  leads: PermissionLevel;
  employees: PermissionLevel;
  dealers: PermissionLevel;
  stock: PermissionLevel;
  reports: PermissionLevel;
  access: PermissionLevel;
  profile: PermissionLevel;
  forwardCallLeadToDealer?: boolean;
}

export type UserRole = 'Admin' | 'Employee' | 'Dealer';
export type UserStatus = 'Active' | 'Away' | 'Offline' | 'Inactive';

export interface DealerFeatures {
  myEmployees: boolean;
  attendance: boolean;
  quotations: boolean;
  leads: boolean;
  stock: boolean;
  payments: boolean;
  reports: boolean;
  tasks: boolean;
  calendar: boolean;
  forwardCallLeadToDealer?: boolean;
}

export interface CallLead {
  id: string;
  customerName: string;
  phone: string;
  alternatePhone?: string;
  location?: string;
  capacityKw?: string;
  callReceivedBy: string;
  callReceivedById: string;
  callReceivedByRole: 'Admin' | 'Employee';
  callDate: string;
  callTime: string;
  notes?: string;
  priority?: 'High' | 'Medium' | 'Low';
  status: 'New Call' | 'In Follow-up' | 'Forwarded to Dealer' | 'Converted to Lead' | 'Dropped';
  forwardedToDealer?: string;
  forwardedToDealerId?: string;
  forwardedAt?: string;
  forwardedBy?: string;
  forwardedById?: string;
  forwardingNotes?: string;
  crmLeadId?: string;
  createdAt: string;
  updatedAt: string;
}

export const defaultDealerFeatures: DealerFeatures = {
  myEmployees: true,
  attendance: true,
  quotations: true,
  leads: true,
  stock: true,
  payments: true,
  reports: true,
  tasks: true,
  calendar: true,
  forwardCallLeadToDealer: false
};

export const defaultEmployeeFeatures: DealerFeatures = {
  myEmployees: false,
  attendance: true,
  quotations: true,
  leads: true,
  stock: true,
  payments: true,
  reports: true,
  tasks: true,
  calendar: true
};

export interface Responsibility {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface EmployeeResponsibilities {
  primaryResponsibilityId?: string;
  secondaryResponsibilityIds?: string[];
  notes?: string;
  assignedAt?: string;
  assignedBy?: string;
}

export interface ApprovedProduct {
  id: string;
  name: string;
  category: 'Residential' | 'Commercial' | 'Agricultural';
  systemSizeKw: number;
  panelType: string;
  inverterType: string;
  structureType: string;
  defaultPanelCount: number;
  customerPrice: number;
  maxAllowedDiscount: number;
  subsidyEstimate: number;
  subsidyDisclaimer: string;
  active: boolean;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface Quotation {
  id: string;
  quotationNumber: string;
  dealerId: string;
  dealerName: string;
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  productId: string;
  productName: string;
  systemSizeKw: number;
  panelType: string;
  panelQuantity: number;
  inverterType: string;
  structureType: string;
  basePriceAtCreation: number;
  discount: number;
  finalAmount: number;
  subsidyEstimateAtCreation: number;
  netCustomerCost: number;
  validityDays: number;
  notes?: string;
  status: QuotationStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface User {
  id: string;
  uid?: string;
  name: string;
  initials: string;
  phone: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  lastActive: string;
  address?: string; // specific to dealers
  features?: DealerFeatures;
  employeeCategory?: 'Surya Ghar Incharge' | 'Commercial Project Incharge' | 'Stock Incharge' | string;
  employeeId?: string;
  employeeCode?: string;
  dealerCode?: string;
  code?: string;
  displayId?: string;
  canForwardToDealer?: boolean;
  responsibilities?: any;
}

export type EmployeeStatus = 'Active' | 'Away' | 'Offline' | 'Inactive';

export interface Employee extends User {
  role: 'Employee';
  dealerId?: string | null; // null = Company Staff, string = Dealer's Staff
  authId?: string;
  responsibilities?: EmployeeResponsibilities;
  features?: DealerFeatures;
}

export type DealerStatus = 'Active' | 'Inactive';

export interface DealerCommissionRecord {
  id: string;
  dealerId: string;
  dealerName: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string;
  paidAt: string;
  recordedBy: string;
  notes?: string;
}

export interface Dealer extends User {
  role: 'Dealer';
  address: string;
  features?: DealerFeatures;
  commissionRatePerKw?: number; // e.g. 1500 (₹/kW)
  commissionType?: 'PER_KW' | 'PERCENTAGE';
  commissionPercent?: number; // e.g. 5 (%)
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
  commissionPayouts?: DealerCommissionRecord[];
  settledCommissionTotal?: number;
  classification?: 'Paid' | string;
}

export interface AttendanceRecord {
  id: string; // e.g. `${employeeId}_${date}`
  employeeId: string;
  dealerId: string | null; // null for company employee, string for dealer staff
  date: string; // YYYY-MM-DD
  status: 'PRESENT';
  markedAt: string; // e.g. "09:14 AM"
}

// Default Permissions
const defaultEmployeePermissions: UserPermissions = {
  dashboard: 'view',
  leads: 'edit',
  employees: 'none',
  dealers: 'none',
  stock: 'view',
  reports: 'none',
  access: 'none',
  profile: 'edit'
};

const defaultDealerPermissions: UserPermissions = {
  dashboard: 'view',
  leads: 'edit',
  employees: 'edit',
  dealers: 'none',
  stock: 'view',
  reports: 'none',
  access: 'none',
  profile: 'edit'
};

const defaultAdminPermissions: UserPermissions = {
  dashboard: 'full',
  leads: 'full',
  employees: 'full',
  dealers: 'full',
  stock: 'edit',
  reports: 'view',
  access: 'full',
  profile: 'edit'
};

// Initial Masters
export const defaultResponsibilities: Responsibility[] = [
  { id: 'RESP_STOCK', name: 'Stock In-Charge', description: 'Warehouse inventory, material receipts, and dispatches', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_SURYAGHAR', name: 'PM Surya Ghar Work In-Charge', description: 'PM Surya Ghar rooftop portal filings, DISCOM approvals, and subsidies', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_INSTALL', name: 'Installation Coordination', description: 'Site technician scheduling, plant commissioning, and field QA', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_DEALER', name: 'Dealer Support', description: 'Assisting dealers with leads, stock allocations, and technical queries', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_CUST', name: 'Customer Support', description: 'Customer onboarding, status updates, and post-installation support', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_QUOT', name: 'Quotation Management', description: 'Preparing, reviewing, and approving customized solar project quotes', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_PURCHASE', name: 'Purchase & Procurement', description: 'Vendor coordination, module/inverter ordering, and OEM warranty', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_ACCOUNTS', name: 'Accounts & Billing', description: 'Customer payment verification, dealer milestone settlements, and invoicing', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_SERVICE', name: 'Service & Maintenance', description: 'AMC renewals, inverter troubleshooting, and generation monitoring', active: true, createdAt: '2026-01-01' },
  { id: 'RESP_MARKETING', name: 'Marketing & Outreach', description: 'Solar awareness campaigns, lead generation, and partner promotions', active: true, createdAt: '2026-01-01' },
  { id: 'resp_sales_manager', name: 'Sales Manager', description: 'Team lead assignment, 15-minute response SLA monitoring, commercial quotations, dealer survey coordination, and booking handoff', active: true, createdAt: '2026-01-01' },
  { id: 'resp_telecaller', name: 'Telecaller', description: 'Assigned enquiry outbound calling, 15-minute first call SLA, 4-pillar qualification, callback follow-ups, and WhatsApp communication', active: true, createdAt: '2026-01-01' }
];

export const defaultCompanyEmployees: Employee[] = [
  {
    id: 'emp_telecaller_bhavani',
    name: 'K. Bhavani',
    employeeId: 'MSV-TC-001',
    code: 'MSV-TC-001',
    displayId: 'MSV-TC-001',
    email: 'bhavani.telecaller@mirrorsolar.in',
    phone: '9848123456',
    role: 'Employee',
    employeeCategory: 'Telecaller',
    status: 'Active',
    initials: 'KB',
    canForwardToDealer: false,
    permissions: { 
      ...defaultEmployeePermissions, 
      leads: 'edit',
      profile: 'edit',
      forwardCallLeadToDealer: false
    },
    features: {
      payments: true,
      tasks: true,
      reports: false,
      leads: true,
      stock: false,
      myEmployees: false,
      attendance: true,
      calendar: true,
      quotations: true,
      forwardCallLeadToDealer: false
    },
    responsibilities: {
      primaryResponsibilityId: 'resp_telecaller',
      secondaryResponsibilityIds: ['RESP_QUOT', 'RESP_CUST'],
      assignedAt: '2026-01-01T00:00:00.000Z',
      assignedBy: 'Admin'
    },
    lastActive: 'Just now'
  },

  {
    id: 'emp_telecaller_sales',
    name: 'P. Suresh',
    employeeId: 'MSV-SALES-001',
    code: 'MSV-SALES-001',
    displayId: 'MSV-SALES-001',
    email: 'sales.telecaller@mirrorsolar.in',
    phone: '9440188990',
    role: 'Employee',
    employeeCategory: 'Sales Manager (Telecaller)',
    status: 'Active',
    initials: 'PS',
    canForwardToDealer: true,
    permissions: { 
      ...defaultEmployeePermissions, 
      leads: 'edit',
      profile: 'edit',
      forwardCallLeadToDealer: true
    },
    features: {
      payments: true,
      tasks: true,
      reports: false,
      leads: true,
      stock: false,
      myEmployees: false,
      attendance: true,
      calendar: true,
      quotations: true,
      forwardCallLeadToDealer: true
    },
    responsibilities: {
      primaryResponsibilityId: 'resp_sales_manager',
      secondaryResponsibilityIds: ['RESP_QUOT', 'RESP_CUST'],
      assignedAt: '2026-01-01T00:00:00.000Z',
      assignedBy: 'Admin'
    },
    lastActive: 'Just now'
  },
  {
    id: 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3',
    name: 'Sunkara Siva',
    initials: 'SS',
    email: 'siva.mirrorsolarvision@gmail.com',
    phone: '8985141432',
    role: 'Employee',
    status: 'Active',
    employeeId: 'MSV-SIVA-001',
    code: 'MSV/EMP/SUNKARASIVA',
    displayId: 'MSV/EMP/SUNKARASIVA',
    employeeCategory: 'Marketing Employee',
    lastActive: 'Just now',
    permissions: { ...defaultEmployeePermissions },
    features: {
      payments: true,
      tasks: true,
      reports: false,
      leads: true,
      stock: true,
      myEmployees: false,
      attendance: true,
      calendar: true,
      quotations: true,
      forwardCallLeadToDealer: true
    },
    responsibilities: {
      primaryResponsibilityId: 'RESP_MARKETING',
      secondaryResponsibilityIds: ['RESP_QUOT'],
      assignedAt: '2026-01-01T00:00:00.000Z',
      assignedBy: 'Admin'
    }
  },
  {
    id: 'tLB8hvGPTQXynRLk4fYI1yPeBkF3',
    name: 'Kumari',
    initials: 'KU',
    email: 'kumari.mirrorsolarvision@gmail.com',
    phone: '7670920748',
    role: 'Employee',
    status: 'Active',
    employeeId: 'MSV-KUMARI-001',
    code: 'MSV-KUMARI-001',
    displayId: 'MSV-KUMARI-001',
    employeeCategory: 'PM Surya Ghar Work Incharge',
    lastActive: 'Just now',
    permissions: { ...defaultEmployeePermissions },
    features: {
      payments: true,
      tasks: true,
      reports: false,
      leads: true,
      stock: true,
      myEmployees: false,
      attendance: true,
      calendar: true,
      quotations: true
    },
    responsibilities: {
      primaryResponsibilityId: 'RESP_SURYAGHAR',
      secondaryResponsibilityIds: ['RESP_CUST'],
      assignedAt: '2026-01-01T00:00:00.000Z',
      assignedBy: 'Admin'
    }
  },
  {
    id: 'QRWLhJpqCUUMi4U9mVNpUGQPu713',
    name: 'Sai Gopal',
    initials: 'SG',
    email: 'gopal.mirrorsolarvision@gmail.com',
    phone: '9876543210',
    role: 'Employee',
    status: 'Active',
    employeeId: 'MSV-EMP-003',
    code: 'MSV-EMP-003',
    displayId: 'MSV-EMP-003',
    employeeCategory: 'Stock Incharge',
    lastActive: 'Just now',
    permissions: { ...defaultEmployeePermissions, stock: 'edit' },
    features: {
      payments: false,
      tasks: true,
      reports: false,
      leads: false,
      stock: true,
      myEmployees: false,
      attendance: true,
      calendar: true,
      quotations: false
    },
    responsibilities: {
      primaryResponsibilityId: 'RESP_STOCK',
      secondaryResponsibilityIds: ['RESP_INSTALL'],
      assignedAt: '2026-01-01T00:00:00.000Z',
      assignedBy: 'Admin'
    }
  }
];

export const defaultCompanyDealers: Dealer[] = [
  // Existing Dealers (Preserved exactly)
  {
    id: 'ck9OPLG03RZeJhYh60npKeMEaFz2',
    name: 'Hussain',
    address: 'Kurnool',
    phone: '9100309431',
    email: 'hussain@dealer.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'HU',
    dealerCode: 'MSV/DLR/HUSSAIN',
    code: 'MSV/DLR/HUSSAIN',
    displayId: 'MSV/DLR/HUSSAIN',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR1791784111454',
    name: 'JAGAPATHI',
    address: 'VIJAYAWADA',
    phone: '9959591855',
    email: 'jagapathi@msv.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'JA',
    dealerCode: 'MSV/DLR/JAGAPATHI',
    code: 'MSV/DLR/JAGAPATHI',
    displayId: 'MSV/DLR/JAGAPATHI',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR1791785666743',
    name: 'SRINIVAS',
    address: 'AMALAPURAM',
    phone: '7815851917',
    email: 'srinivas@msv.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'SR',
    dealerCode: 'MSV/DLR/SRINIVAS',
    code: 'MSV/DLR/SRINIVAS',
    displayId: 'MSV/DLR/SRINIVAS',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },

  // 8 New Dealer Records (Internal classification: 'Paid')
  {
    id: 'DLR_AYYAPPA_TENALI',
    name: 'Ayyappa',
    address: 'Tenali & Guntur',
    phone: '9848011001',
    email: 'ayyappa.dealer@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'AY',
    dealerCode: 'MSV/DLR/AYYAPPA',
    code: 'MSV/DLR/AYYAPPA',
    displayId: 'MSV/DLR/AYYAPPA',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR_VIJAY_KAKINADA',
    name: 'Vijay Kumar',
    address: 'Kakinada',
    phone: '9848011002',
    email: 'vijaykumar.dealer@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'VK',
    dealerCode: 'MSV/DLR/VIJAYK',
    code: 'MSV/DLR/VIJAYK',
    displayId: 'MSV/DLR/VIJAYK',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR_ASHOK_MYLAVARAM',
    name: 'Ashok',
    address: 'Mylavaram',
    phone: '9848011003',
    email: 'ashok.dealer@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'AS',
    dealerCode: 'MSV/DLR/ASHOK',
    code: 'MSV/DLR/ASHOK',
    displayId: 'MSV/DLR/ASHOK',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR_SHIVA_KUCHIMPUDI',
    name: 'Shiva',
    address: 'Kuchimpudi',
    phone: '9848011004',
    email: 'shiva.dealer@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'SH',
    dealerCode: 'MSV/DLR/SHIVA',
    code: 'MSV/DLR/SHIVA',
    displayId: 'MSV/DLR/SHIVA',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR_RAJU_AKIVEEDU',
    name: 'Raju',
    address: 'Akiveedu',
    phone: '9848011005',
    email: 'raju.dealer@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'RJ',
    dealerCode: 'MSV/DLR/RAJU',
    code: 'MSV/DLR/RAJU',
    displayId: 'MSV/DLR/RAJU',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR_SRINIVAS_ELURU',
    name: 'Srinivas',
    address: 'Eluru',
    phone: '9848011006',
    email: 'srinivas.eluru@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'SE',
    dealerCode: 'MSV/DLR/SRINIVASE',
    code: 'MSV/DLR/SRINIVASE',
    displayId: 'MSV/DLR/SRINIVASE',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR_PRATHAP_TPG',
    name: 'Prathap',
    address: 'Tadepalligudem',
    phone: '9848011007',
    email: 'prathap.dealer@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'PR',
    dealerCode: 'MSV/DLR/PRATHAP',
    code: 'MSV/DLR/PRATHAP',
    displayId: 'MSV/DLR/PRATHAP',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  },
  {
    id: 'DLR_VIJAY_HANUMAN',
    name: 'Vijay',
    address: 'Hanuman Junction',
    phone: '9848011008',
    email: 'vijay.hj@mirrorsolar.in',
    role: 'Dealer',
    status: 'Active',
    initials: 'VH',
    dealerCode: 'MSV/DLR/VIJAYHJ',
    code: 'MSV/DLR/VIJAYHJ',
    displayId: 'MSV/DLR/VIJAYHJ',
    classification: 'Paid',
    permissions: { ...defaultDealerPermissions },
    features: { ...defaultDealerFeatures },
    commissionRatePerKw: 1500,
    commissionType: 'PER_KW',
    commissionPercent: 5,
    lastActive: 'Just now'
  }
];

export const defaultApprovedProducts: ApprovedProduct[] = [
  {
    id: 'PROD_3KW_RES',
    name: '3kW Rooftop Solar On-Grid Package',
    category: 'Residential',
    systemSizeKw: 3,
    panelType: 'Mono Perc DCR 550W',
    inverterType: '3kW Single Phase High-Efficiency On-Grid',
    structureType: 'Galvanized Iron Elevated Structure',
    defaultPanelCount: 6,
    customerPrice: 195000,
    maxAllowedDiscount: 10000,
    subsidyEstimate: 78000,
    subsidyDisclaimer: 'Estimated subsidy — subject to applicable government eligibility and approval under PM Surya Ghar Muft Bijli Yojana.',
    active: true
  },
  {
    id: 'PROD_5KW_RES',
    name: '5kW Rooftop Solar On-Grid Package',
    category: 'Residential',
    systemSizeKw: 5,
    panelType: 'TOPCon Bi-facial 550W',
    inverterType: '5kW Three Phase Smart Inverter',
    structureType: 'Heavy Duty Elevated Mounting Structure',
    defaultPanelCount: 10,
    customerPrice: 310000,
    maxAllowedDiscount: 15000,
    subsidyEstimate: 78000,
    subsidyDisclaimer: 'Estimated subsidy — subject to applicable government eligibility and approval under PM Surya Ghar Muft Bijli Yojana.',
    active: true
  },
  {
    id: 'PROD_10KW_COM',
    name: '10kW Commercial Solar Power Plant',
    category: 'Commercial',
    systemSizeKw: 10,
    panelType: 'Bi-facial Dual Glass 550W',
    inverterType: '10kW Three Phase Dual MPPT Inverter',
    structureType: 'Industrial Super Structure (Elevated)',
    defaultPanelCount: 20,
    customerPrice: 580000,
    maxAllowedDiscount: 25000,
    subsidyEstimate: 0,
    subsidyDisclaimer: 'Commercial installation — Accelerated depreciation & tax benefits apply.',
    active: true
  }
];

// Real-time data will be fetched from Firestore

interface CRMContextType {
  leads: MockLead[];
  employees: Employee[];
  dealers: Dealer[];
  users: User[];
  activities: Activity[];
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  addEmployee: (emp: Omit<Employee, 'id' | 'permissions' | 'role'> & { id?: string; password?: string }) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  addDealer: (dealer: Omit<Dealer, 'id' | 'permissions' | 'role'> & { id?: string; password?: string }) => Promise<void>;
  updateDealer: (id: string, updates: Partial<Dealer>) => Promise<void>;
  deleteDealer: (id: string) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  deleteUser: (id: string, role?: string) => Promise<void>;
  addLead: (lead: Omit<MockLead, 'id'>) => Promise<string | void>;
  updateLead: (id: string, updates: Partial<MockLead>) => Promise<void>;
  updateLeadStage: (leadId: string, newStage: Stage) => void;
  deleteLead: (id: string) => Promise<void>;
  deleteBulkLeads: (ids: string[]) => Promise<void>;
  updateUserPermissions: (userId: string, permissions: UserPermissions) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  updateUserStatus: (userId: string, status: UserStatus) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  settleLeadPayment: (
    leadId: string, 
    milestoneType: PaymentMilestoneType, 
    data: { amount: number; proofUrl: string; proofFileName: string; proofFileSize?: number; utrNumber?: string; adminNotes?: string }
  ) => Promise<void>;
  acknowledgeLeadPayment: (
    leadId: string, 
    milestoneType: PaymentMilestoneType, 
    data?: { dealerNotes?: string }
  ) => Promise<void>;
  addCustomerPayment: (
    leadId: string,
    data: {
      amount: number;
      paymentType: CustomerPaymentType;
      paymentMode: CustomerPaymentMode;
      paidAt?: string;
      proofUrl?: string;
      proofFileName?: string;
      proofFileSize?: number;
      referenceNumber?: string;
      notes?: string;
    }
  ) => Promise<void>;
  verifyCustomerPayment: (
    leadId: string,
    paymentId: string,
    status: 'Verified' | 'Rejected',
    reason?: string
  ) => Promise<void>;
  deleteCustomerPayment: (
    leadId: string,
    paymentId: string
  ) => Promise<void>;
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  resetData: () => void;

  // Attendance & Dealer Feature Management
  attendances: AttendanceRecord[];
  markAttendance: (employeeId: string, date?: string, dealerId?: string | null, customTime?: string) => Promise<void>;
  removeAttendance: (employeeId: string, date: string) => Promise<void>;
  isEmployeePresent: (employeeId: string, date: string) => boolean;
  getEmployeeAttendance: (employeeId: string, date: string) => AttendanceRecord | undefined;
  getAttendanceForDate: (date: string, dealerId?: string | null) => AttendanceRecord[];
  getEmployeeAttendanceHistory: (employeeId: string) => AttendanceRecord[];
  updateDealerFeatures: (dealerId: string, features: Partial<DealerFeatures>) => Promise<void>;
  updateEmployeeFeatures: (employeeId: string, features: Partial<DealerFeatures>) => Promise<void>;
  updateUserPassword: (userId: string, role: 'Employee' | 'Dealer', newPassword: string) => Promise<void>;
  updateUserFeatures: (userId: string, role: 'Employee' | 'Dealer', features: Partial<DealerFeatures>) => Promise<void>;
  updateUserCredentials: (
    userId: string,
    role: 'Employee' | 'Dealer' | 'Admin',
    updates: {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      employeeCategory?: string;
      status?: UserStatus;
      address?: string;
    }
  ) => Promise<void>;
  addDealerEmployee: (dealerId: string, emp: Omit<Employee, 'id' | 'permissions' | 'role' | 'dealerId'> & { id?: string; password?: string }) => Promise<void>;
  updateDealerEmployee: (employeeId: string, dealerId: string, updates: Partial<Employee>) => Promise<void>;

  // Responsibilities Management
  responsibilities: Responsibility[];
  addResponsibility: (name: string, description?: string) => Promise<void>;
  updateResponsibility: (id: string, updates: Partial<Responsibility>) => Promise<void>;
  assignEmployeeResponsibilities: (employeeId: string, primaryId?: string, secondaryIds?: string[], notes?: string) => Promise<void>;

  // Products & Quotations
  approvedProducts: ApprovedProduct[];
  quotations: Quotation[];
  createQuotation: (quoteData: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt'>) => Promise<Quotation>;
  updateQuotationStatus: (id: string, status: QuotationStatus) => Promise<void>;
  getDealerQuotations: (dealerId: string) => Quotation[];
  getLeadQuotations: (leadId: string, dealerId: string) => Quotation[];

  // Lead Reassignment Helpers
  assignLead: (leadId: string, assignment: any, employeeId?: string) => Promise<void>;
  requestLeadReassignment: (leadId: string, request: any, reason?: string) => Promise<void>;
  resolveLeadReassignment: (leadId: string, status: any, rejectionReason?: string) => Promise<void>;

  // Seed Helper
  seedSampleLeads: () => Promise<number>;

  // Dealer Commission Management
  recordDealerCommissionPayout: (
    dealerId: string,
    amount: number,
    paymentMode: string,
    referenceNumber: string,
    notes?: string
  ) => Promise<void>;

  // Sales Manager & Leakage Monitor (Version 2.3)
  salesLeakageMetrics: SalesLeakageMetrics;
  recordFirstCallAttempt: (leadId: string) => Promise<void>;
  updateLeadSalesStage: (leadId: string, salesStage: SalesStage, notes?: string) => Promise<void>;
  callLogs: TelecallerCallLog[];
  addCallLog: (log: Omit<TelecallerCallLog, 'id' | 'timestamp'>) => Promise<void>;
  updateLeadQualification: (leadId: string, data: CustomerQualificationData) => Promise<void>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);


export const INITIAL_MOCK_CALL_LOGS: TelecallerCallLog[] = [
  {
    id: 'CALL-001',
    leadId: 'sample-lead-01',
    customerName: 'K. Satyanarayana',
    phone: '+919848012345',
    callDirection: 'Outgoing',
    durationSeconds: 185,
    outcome: 'Connected - Interested',
    notes: 'Customer interested in 3kW PM Surya Ghar setup. Requested subsidy calculation and quotation.',
    nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    nextFollowUpTime: '11:30 AM',
    telecallerId: 'emp_telecaller_sales',
    telecallerName: 'P. Suresh',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'CALL-002',
    leadId: 'sample-lead-02',
    customerName: 'P. Rambabu',
    phone: '+919849288776',
    callDirection: 'Outgoing',
    durationSeconds: 90,
    outcome: 'Connected - Callback',
    notes: 'In meeting right now. Asked to callback tomorrow afternoon around 3:00 PM.',
    nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    nextFollowUpTime: '03:00 PM',
    telecallerId: 'emp_telecaller_sales',
    telecallerName: 'P. Suresh',
    timestamp: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'CALL-003',
    customerName: 'V. Venkatesh',
    phone: '+919440155667',
    callDirection: 'Outgoing',
    durationSeconds: 0,
    outcome: 'No Answer',
    notes: 'Phone was ringing but customer did not pick up. Second attempt scheduled.',
    nextFollowUpDate: new Date().toISOString().split('T')[0],
    nextFollowUpTime: '04:30 PM',
    telecallerId: 'emp_telecaller_bhavani',
    telecallerName: 'K. Bhavani',
    timestamp: new Date(Date.now() - 10800000).toISOString()
  }
];

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<MockLead[]>(defaultSeedLeads);
  const [employees, setEmployees] = useState<Employee[]>(defaultCompanyEmployees);
  const [dealers, setDealers] = useState<Dealer[]>(() => {
    try {
      const cached = localStorage.getItem('crm_dealers_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const filtered = parsed.filter((d: any) => 
          d.id !== 'DLR1790601644299' &&
          d.id !== 'dealer_balaji' &&
          d.id !== 'DLR1790302393152' &&
          d.id !== 'dealer_hussain' &&
          d.id !== 'hussain_dealer_in' &&
          !((d.name || '').toLowerCase().includes('balaji peruri')) &&
          (d.email || '').toLowerCase() !== 'balajiperuri09@gmail.com'
        );
        if (Array.isArray(filtered) && filtered.length >= defaultCompanyDealers.length) return filtered;
      }
      return defaultCompanyDealers;
    } catch {
      return defaultCompanyDealers;
    }
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(defaultResponsibilities);
  const [approvedProducts, setApprovedProducts] = useState<ApprovedProduct[]>(defaultApprovedProducts);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const debounceMap = useRef<Map<string, number>>(new Map());
  
  const { currentUser: authUser } = useAuth();
  useEffect(() => {
    setCurrentUser(authUser);
  }, [authUser]);


  useEffect(() => {
    if (dealers.length > 0) {
      try {
        const sanitized = dealers.filter(d => 
          d.id !== 'DLR1790601644299' &&
          d.id !== 'dealer_balaji' &&
          !((d.name || '').toLowerCase().includes('balaji peruri')) &&
          (d.email || '').toLowerCase() !== 'balajiperuri09@gmail.com'
        );
        const safeDealers = sanitized.map(({ password: _, ...d }: any) => d);
        localStorage.setItem('crm_dealers_cache', JSON.stringify(safeDealers));
      } catch (e) {
        console.warn("Could not cache dealers:", e);
      }
    }
  }, [dealers]);
  
  const [adminUser, setAdminUser] = useState<User>({
    id: 'ADM01',
    name: 'Admin',
    initials: 'AD',
    email: 'admin@mirrorsolar.in',
    phone: '+91 99999 99999',
    role: 'Admin',
    status: 'Active',
    permissions: { ...defaultAdminPermissions },
    lastActive: 'Just now'
  });

  useEffect(() => {
    if (!authUser) {
      setLeads([]);
      setEmployees([]);
      setActivities([]);
      setTasks([]);
      setAttendances([]);
      return;
    }

    // 1. Listen for Live Users (Employees & Dealers)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const archivedUserKeys = new Set<string>();
      try {
        const cached = JSON.parse(localStorage.getItem('crm_deleted_users_cache') || '[]');
        if (Array.isArray(cached)) {
          cached.forEach(k => archivedUserKeys.add(String(k).toLowerCase().trim()));
        }
      } catch (e) {}

      const userMap = new Map<string, User>();
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        const key = (data.id || docSnap.id).toLowerCase().trim();
        if (data.isDeleted === true || (data.status as any) === 'Archived' || (data.status as any) === 'Deleted') {
          archivedUserKeys.add(key);
          if (data.email) archivedUserKeys.add(data.email.toLowerCase().trim());
          if (data.code) archivedUserKeys.add(data.code.toLowerCase().trim());
          if (data.employeeId) archivedUserKeys.add(data.employeeId.toLowerCase().trim());
          if (data.dealerCode) archivedUserKeys.add(data.dealerCode.toLowerCase().trim());
          if (data.name) archivedUserKeys.add(data.name.toLowerCase().trim());
          if (data.address && data.name) archivedUserKeys.add(`${data.name.toLowerCase().trim()}_${data.address.toLowerCase().trim()}`);
          return;
        }
        userMap.set(key, { ...data, id: data.id || docSnap.id });
      });
      const allUsers = Array.from(userMap.values());
      // Deduplicate users by role + unique identifier (email, phone, or doc ID)
      const uniqueUsers: User[] = [];
      const seenIdentity = new Set<string>();
      allUsers.forEach(u => {
        if ((u as any).isDeleted || (u.status as any) === 'Archived' || (u.status as any) === 'Deleted') return;
        const rawEmail = (u.email || '').trim().toLowerCase();
        const isValidEmail = rawEmail.includes('@') && rawEmail.length > 5 && rawEmail !== '-';
        const emailKey = isValidEmail ? rawEmail : '';

        const rawDigits = (u.phone || '').replace(/\D/g, '').slice(-10);
        const isValidPhone = rawDigits.length === 10 && !/^0+$/.test(rawDigits);
        const phoneKey = isValidPhone ? rawDigits : '';

        const nameKey = (u.name || '').trim().toLowerCase();
        const docId = (u.id || '').trim().toLowerCase();
        // Fallback to name or unique docId so distinct users without email/phone are never dropped
        const fallbackKey = nameKey ? `${u.role}_${nameKey}` : `${u.role}_${docId}`;
        const identityKey = emailKey ? `${u.role}_${emailKey}` : (phoneKey ? `${u.role}_${phoneKey}` : fallbackKey);
        
        if (!seenIdentity.has(identityKey)) {
          seenIdentity.add(identityKey);
          uniqueUsers.push(u);
        }
      });

      const empList = uniqueUsers.filter(u => (u.role || '').toLowerCase() === 'employee') as Employee[];
      
      // Strict Dealers Sanitization:
      // 1. Exclude both Balaji Peruri dealers (Balaji is strictly an Admin)
      // 2. Discard legacy duplicate Hussain documents so Hussain only appears once
      const filteredDealers = uniqueUsers.filter(u => {
        if (u.role !== 'Dealer') return false;
        const nameLower = (u.name || '').toLowerCase().trim();
        const emailLower = (u.email || '').toLowerCase().trim();
        const idLower = (u.id || '').toLowerCase().trim();
        
        if (
          idLower === 'dlr1790601644299' ||
          idLower === 'dealer_balaji' ||
          idLower === 'dlr1790302393152' ||
          nameLower.includes('balaji peruri') ||
          emailLower === 'balajiperuri09@gmail.com'
        ) {
          return false;
        }

        if (idLower === 'dealer_hussain' || idLower === 'hussain_dealer_in') {
          return false;
        }

        return true;
      }) as Dealer[];

      // Ensure single instance per unique dealer (ID or name + address)
      const seenDealerKeys = new Set<string>();
      const finalDealers: Dealer[] = [];
      filteredDealers.forEach(d => {
        const normName = (d.name || '').toLowerCase().trim();
        const normAddr = (d.address || '').toLowerCase().trim();
        const dealerKey = (d.id || '').trim().toLowerCase() || `${normName}_${normAddr}`;
        if (!seenDealerKeys.has(dealerKey)) {
          seenDealerKeys.add(dealerKey);
          finalDealers.push(d);
        }
      });

      const mergedDealersMap = new Map<string, Dealer>();
      defaultCompanyDealers.forEach(d => {
        const normName = (d.name || '').toLowerCase().trim();
        const normAddr = (d.address || '').toLowerCase().trim();
        const k = normName + '_' + normAddr;
        const dId = (d.id || '').toLowerCase().trim();
        const dCode = (d.code || d.dealerCode || '').toLowerCase().trim();
        if (archivedUserKeys.has(dId) || archivedUserKeys.has(k) || archivedUserKeys.has(normName) || archivedUserKeys.has(dCode)) return;
        mergedDealersMap.set(k, d);
      });
      finalDealers.forEach(d => {
        const normName = (d.name || '').toLowerCase().trim();
        const normAddr = (d.address || '').toLowerCase().trim();
        const k = normName + '_' + normAddr;
        const dId = (d.id || '').toLowerCase().trim();
        const dCode = (d.code || d.dealerCode || '').toLowerCase().trim();
        if (archivedUserKeys.has(dId) || archivedUserKeys.has(k) || archivedUserKeys.has(normName) || archivedUserKeys.has(dCode)) return;
        mergedDealersMap.set(k, { ...mergedDealersMap.get(k), ...d });
      });
      const resolvedDealers = Array.from(mergedDealersMap.values());

      const mergedEmpMap = new Map<string, Employee>();
      defaultCompanyEmployees.forEach(emp => {
        const key = (emp.id || emp.code || emp.email || emp.name).toLowerCase().trim();
        if (archivedUserKeys.has(key) || (emp.email && archivedUserKeys.has(emp.email.toLowerCase().trim())) || (emp.code && archivedUserKeys.has(emp.code.toLowerCase().trim())) || (emp.name && archivedUserKeys.has(emp.name.toLowerCase().trim()))) return;
        mergedEmpMap.set(key, emp);
      });
      empList.forEach(emp => {
        const key = (emp.id || emp.code || emp.email || emp.name).toLowerCase().trim();
        if (archivedUserKeys.has(key) || (emp.email && archivedUserKeys.has(emp.email.toLowerCase().trim())) || (emp.code && archivedUserKeys.has(emp.code.toLowerCase().trim())) || (emp.name && archivedUserKeys.has(emp.name.toLowerCase().trim()))) return;
        mergedEmpMap.set(key, { ...mergedEmpMap.get(key), ...emp });
      });
      setEmployees(Array.from(mergedEmpMap.values()));
      setDealers(resolvedDealers);
    }, (err) => {
      console.warn("Users listener error:", err);
    });

    // 1b. Listen for Dedicated Dealers Collection in Firestore (if used)
    const unsubscribeDealers = onSnapshot(collection(db, 'dealers'), (snapshot) => {
      const explicitDealers: Dealer[] = [];
      snapshot.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() } as Dealer;
        const nameLower = (d.name || '').toLowerCase().trim();
        const idLower = (d.id || '').toLowerCase().trim();
        if (
          idLower !== 'dlr1790601644299' &&
          idLower !== 'dealer_balaji' &&
          idLower !== 'dealer_hussain' &&
          idLower !== 'hussain_dealer_in' &&
          !nameLower.includes('balaji peruri')
        ) {
          explicitDealers.push(d);
        }
      });
      if (explicitDealers.length > 0) {
        setDealers(prev => {
          const map = new Map<string, Dealer>();
          prev.forEach(d => map.set(d.id, d));
          explicitDealers.forEach(d => map.set(d.id, { ...map.get(d.id), ...d }));
          return Array.from(map.values());
        });
      }
    }, (err) => {
      console.warn("Dealers collection listener warning:", err);
    });

    // 2. Listen for Live Leads (Role-Scoped Firestore Query)
    let unsubscribeLeads = () => {};
    const eName = (authUser.name || '').toLowerCase().trim();
    const empCategory = ((authUser as any).employeeCategory || (authUser as any).category || '').toLowerCase();
    const isSuryaGhar = empCategory.includes('surya') || empCategory.includes('pm surya') || empCategory.includes('surya ghar') || eName.includes('kumari');
    const isStockIncharge = empCategory.includes('stock') || eName.includes('gopal');
    const isAccountsRole = ((authUser as any).role === 'Accounts') || empCategory.includes('accounts');
    const isSalesMgr = authUser.role === 'Admin' || isAccountsRole || 
      empCategory.includes('sales manager') || 
      (authUser as any).responsibilities?.primaryResponsibilityId === 'resp_sales_manager';
    const isPrivilegedLeadViewer = authUser.role === 'Admin' || isAccountsRole || isSalesMgr || isSuryaGhar || isStockIncharge;

    const userUid = auth.currentUser?.uid || authUser.id;
    const isSiva = eName.includes('siva') || userUid === 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3' || userUid === 'DHIl07h9rJPBlfzc7Cg8hrfVaWj2';
    const sivaUids = ['bkTpWQKgmsXRBjCHEcwD8uO9nrJ3', 'DHIl07h9rJPBlfzc7Cg8hrfVaWj2', 'MSV-SIVA-001'];

    const leadsQuery = isPrivilegedLeadViewer
      ? collection(db, 'leads')
      : authUser.role === 'Dealer'
        ? query(collection(db, 'leads'), where('dealerId', '==', userUid))
        : isSiva
          ? query(collection(db, 'leads'), where('assignedEmployeeId', 'in', sivaUids))
          : query(collection(db, 'leads'), where('assignedEmployeeId', '==', userUid));

    unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const allLeads: MockLead[] = [];
      snapshot.forEach(docSnap => {
        allLeads.push({ id: docSnap.id, ...docSnap.data() } as MockLead);
      });
      allLeads.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      if (isPrivilegedLeadViewer) {
        setLeads(allLeads);
      } else if (authUser.role === 'Dealer') {
        setLeads(allLeads.filter(l => l.dealerId === userUid));
      } else if (authUser.role === 'Employee') {
        const matchingLeads = allLeads.filter(l => isLeadAssignedToEmployee(authUser, l));
        // If employee is Sunkara Siva and Firestore returns fewer than the verified baseline (e.g. unmigrated docs or offline), merge cleanly
        if (isSiva && matchingLeads.length < defaultSeedLeads.length) {
          const leadMap = new Map<string, MockLead>();
          defaultSeedLeads.forEach(l => leadMap.set(l.id, l));
          matchingLeads.forEach(l => leadMap.set(l.id, l));
          setLeads(Array.from(leadMap.values()));
        } else {
          setLeads(matchingLeads);
        }
      } else {
        setLeads(allLeads);
      }
    }, (err) => {
      console.warn("Leads listener error (scoped query):", err);
      if (isSiva) {
        setLeads(defaultSeedLeads);
      }
    });

    // 3. Listen for Live Quotations
    const unsubscribeQuotations = onSnapshot(collection(db, 'quotations'), (snapshot) => {
      const allQuotes: Quotation[] = [];
      snapshot.forEach(docSnap => {
        allQuotes.push({ id: docSnap.id, ...docSnap.data() } as Quotation);
      });
      setQuotations(allQuotes);
    }, (err) => {
      console.warn("Quotations listener error:", err);
    });

    // 4. Listen for Live Activities
    const unsubscribeActivities = onSnapshot(collection(db, 'activities'), (snapshot) => {
      const allActivities: Activity[] = [];
      snapshot.forEach(doc => {
        allActivities.push({ id: doc.id, ...doc.data() } as Activity);
      });
      allActivities.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setActivities(allActivities);
    }, (err) => {
      console.warn("Activities listener error:", err);
    });

    // 5. Listen for Live Tasks
    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const allTasks: Task[] = [];
      snapshot.forEach(doc => {
        allTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setTasks(allTasks);
    }, (err) => {
      console.warn("Tasks listener error:", err);
    });

    // 6. Listen for Live Attendance Records
    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      const allRecords: AttendanceRecord[] = [];
      snapshot.forEach(doc => {
        allRecords.push(doc.data() as AttendanceRecord);
      });
      setAttendances(allRecords);
    }, (err) => {
      console.warn("Attendance listener error:", err);
    });

    // 7. Listen for Live Call Logs (/call_leads - Role-Scoped Query)
    let unsubscribeCallLogs = () => {};

    if (authUser.role === 'Dealer') {
      // Dealers are strictly prohibited from accessing internal telecaller dial desk logs
      setCallLogs([]);
    } else {
      const isCallAdmin = authUser.role === 'Admin' || isAccountsRole || isSalesMgr;

      // Rules are NOT filters: Non-admin telecallers query strictly by their assigned UID
      const callLogsQuery = isCallAdmin
        ? collection(db, 'call_leads')
        : query(collection(db, 'call_leads'), where('telecallerId', '==', authUser.id));

      unsubscribeCallLogs = onSnapshot(callLogsQuery, (snapshot) => {
        const liveCallLogs: TelecallerCallLog[] = [];
        snapshot.forEach(docSnap => {
          liveCallLogs.push({ id: docSnap.id, ...docSnap.data() } as TelecallerCallLog);
        });
        liveCallLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        setCallLogs(prev => {
          const map = new Map<string, TelecallerCallLog>();
          liveCallLogs.forEach(c => map.set(c.id, c));
          prev.forEach(c => {
            if (!map.has(c.id)) map.set(c.id, c);
          });
          const merged = Array.from(map.values()).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          try { localStorage.setItem('crm_call_logs_cache', JSON.stringify(merged)); } catch (e) {}
          return merged;
        });
      }, (err) => {
        console.warn("Call leads listener error (scoped query):", err);
      });
    }

    return () => {
      unsubscribeUsers();
      unsubscribeDealers();
      unsubscribeLeads();
      unsubscribeQuotations();
      unsubscribeActivities();
      unsubscribeTasks();
      unsubscribeAttendance();
      unsubscribeCallLogs();
    };
  }, [authUser]);

  const users: User[] = [adminUser, ...employees, ...dealers];

  const addEmployee = async (emp: Omit<Employee, 'id' | 'permissions' | 'role'> & { id?: string; password?: string }) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can add employees");
      return;
    }
    const cleanName = (emp.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const empCode = emp.id?.startsWith('MSV/EMP/') ? emp.id : `MSV/EMP/${cleanName || String(employees.length + 1).padStart(2, '0')}`;
    const newId = emp.id?.trim() || empCode;
    const newEmployee: Employee = { 
      ...emp, 
      id: newId, 
      employeeCode: empCode,
      code: empCode,
      displayId: empCode,
      role: 'Employee', 
      permissions: { ...defaultEmployeePermissions },
      status: emp.status || 'Active',
      features: (emp as any).features || { ...defaultEmployeeFeatures }
    };
    delete (newEmployee as any).password;
    
    // Optimistic local state update
    setEmployees(prev => [...prev.filter(e => e.id !== newId), newEmployee]);

    try {
      await setDoc(doc(db, 'users', newId), sanitizeForFirestore(newEmployee));
    } catch (err) {
      console.error("Error adding employee:", err);
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const target = employees.find(e => e.id === id);
    const merged = { ...target, ...updates, id, role: 'Employee' };
    try {
      await setDoc(doc(db, 'users', id), sanitizeForFirestore(merged), { merge: true });
    } catch (err) {
      console.warn("Error updating employee in users:", err);
    }
  };

  const addDealer = async (dealer: Omit<Dealer, 'id' | 'permissions' | 'role'> & { id?: string; password?: string }) => {
    const cleanName = (dealer.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const dealerCode = dealer.id?.startsWith('MSV/DLR/') ? dealer.id : `MSV/DLR/${cleanName || String(dealers.length + 1).padStart(2, '0')}`;
    const newId = dealer.id?.trim() || dealerCode;
    const newDealer: Dealer = { 
      ...dealer, 
      id: newId, 
      dealerCode: dealerCode,
      code: dealerCode,
      displayId: dealerCode,
      role: 'Dealer', 
      permissions: { ...defaultDealerPermissions },
      status: dealer.status || 'Active',
      features: dealer.features || { ...defaultDealerFeatures }
    };
    delete (newDealer as any).password;

    // 1. Optimistic local state update
    setDealers(prev => [newDealer, ...prev.filter(d => d.id !== newId)]);

    // 2. Persist to localStorage cache
    try {
      const cached = localStorage.getItem('crm_dealers_cache');
      const list = cached ? JSON.parse(cached) : [];
      localStorage.setItem('crm_dealers_cache', JSON.stringify([newDealer, ...list.filter((d: any) => d.id !== newId)]));
    } catch (e) {
      console.warn("Storage warning:", e);
    }

    // 3. Persist to Firestore: BOTH 'users' AND 'dealers' collections!
    try {
      await setDoc(doc(db, 'users', newId), sanitizeForFirestore(newDealer), { merge: true });
    } catch (err) {
      console.warn("Firestore users collection write warning:", err);
    }

    try {
      await setDoc(doc(db, 'dealers', newId), sanitizeForFirestore(newDealer), { merge: true });
    } catch (err) {
      console.warn("Firestore dealers collection write warning:", err);
    }
  };

  const updateDealer = async (id: string, updates: Partial<Dealer>) => {
    setDealers(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    const target = dealers.find(d => d.id === id);
    const merged = { ...target, ...updates, id, role: 'Dealer' };
    try {
      await setDoc(doc(db, 'users', id), sanitizeForFirestore(merged), { merge: true });
    } catch (err) {
      console.warn("Error updating dealer in users:", err);
    }
    try {
      await setDoc(doc(db, 'dealers', id), sanitizeForFirestore(merged), { merge: true });
    } catch (err) {
      console.warn("Error updating dealer in dealers:", err);
    }
  };

  const recordDealerCommissionPayout = async (
    dealerId: string,
    amount: number,
    paymentMode: string,
    referenceNumber: string,
    notes?: string
  ) => {
    const target = dealers.find(d => d.id === dealerId);
    if (!target) throw new Error('Dealer not found');

    const payoutRecord: DealerCommissionRecord = {
      id: `PAYOUT-${Date.now()}`,
      dealerId,
      dealerName: target.name,
      amount,
      paymentMode,
      referenceNumber,
      paidAt: new Date().toISOString(),
      recordedBy: authUser?.name || 'Admin',
      notes
    };

    const currentPayouts = target.commissionPayouts || [];
    const updatedPayouts = [payoutRecord, ...currentPayouts];
    const newSettledTotal = (target.settledCommissionTotal || 0) + amount;

    await updateDealer(dealerId, {
      commissionPayouts: updatedPayouts,
      settledCommissionTotal: newSettledTotal
    });

    try {
      await addActivity({
        type: 'Payment',
        message: `Commission payout of ₹${amount.toLocaleString('en-IN')} paid to dealer ${target.name} via ${paymentMode} (Ref: ${referenceNumber || 'N/A'})`,
        user: authUser?.name || 'Admin',
        dealer: target.name
      });
    } catch (err) {
      console.warn("Activity logging for commission payout fallback:", err);
    }
  };

  const deleteDealer = async (id: string) => {
    const target = dealers.find(d => d.id === id);
    const tombstoneKeys = [id.toLowerCase().trim()];
    if (target?.email) tombstoneKeys.push(target.email.toLowerCase().trim());
    if (target?.code) tombstoneKeys.push(target.code.toLowerCase().trim());
    if (target?.dealerCode) tombstoneKeys.push(target.dealerCode.toLowerCase().trim());
    if (target?.name) tombstoneKeys.push(target.name.toLowerCase().trim());
    if (target?.name && target?.address) tombstoneKeys.push(`${target.name.toLowerCase().trim()}_${target.address.toLowerCase().trim()}`);

    try {
      const cached = JSON.parse(localStorage.getItem('crm_deleted_users_cache') || '[]');
      const updated = Array.from(new Set([...cached, ...tombstoneKeys]));
      localStorage.setItem('crm_deleted_users_cache', JSON.stringify(updated));
    } catch (e) {}

    setDealers(prev => prev.filter(d => d.id !== id));
    try {
      await updateDoc(doc(db, "users", id), {
        status: "Inactive",
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
    } catch (err) {
      try {
        await setDoc(doc(db, 'users', id), {
          id,
          isDeleted: true,
          status: 'Inactive',
          deletedAt: new Date().toISOString(),
          ...(target?.email ? { email: target.email } : {}),
          ...(target?.name ? { name: target.name } : {})
        }, { merge: true });
      } catch (e2) {
        console.warn("Error archiving dealer in users:", e2);
      }
    }
    try {
      await deleteDoc(doc(db, 'dealers', id));
    } catch (err) {
      console.warn("Error deleting dealer from dealers:", err);
    }
    try {
      const cached = localStorage.getItem('crm_dealers_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const filtered = parsed.filter((d: any) => d.id !== id);
        localStorage.setItem('crm_dealers_cache', JSON.stringify(filtered));
      }
    } catch (e) {}
  };

  const deleteEmployee = async (id: string) => {
    const target = employees.find(e => e.id === id);
    const tombstoneKeys = [id.toLowerCase().trim()];
    if (target?.email) tombstoneKeys.push(target.email.toLowerCase().trim());
    if (target?.code) tombstoneKeys.push(target.code.toLowerCase().trim());
    if (target?.employeeId) tombstoneKeys.push(target.employeeId.toLowerCase().trim());
    if (target?.name) tombstoneKeys.push(target.name.toLowerCase().trim());

    try {
      const cached = JSON.parse(localStorage.getItem('crm_deleted_users_cache') || '[]');
      const updated = Array.from(new Set([...cached, ...tombstoneKeys]));
      localStorage.setItem('crm_deleted_users_cache', JSON.stringify(updated));
    } catch (e) {}

    setEmployees(prev => prev.filter(e => e.id !== id));
    try {
      await updateDoc(doc(db, "users", id), {
        status: "Inactive",
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
    } catch (err) {
      try {
        await setDoc(doc(db, 'users', id), {
          id,
          isDeleted: true,
          status: 'Inactive',
          deletedAt: new Date().toISOString(),
          ...(target?.email ? { email: target.email } : {}),
          ...(target?.name ? { name: target.name } : {})
        }, { merge: true });
      } catch (e2) {
        console.warn("Error archiving employee in users:", e2);
      }
    }
    try {
      await deleteDoc(doc(db, 'employees', id));
    } catch (err) {}
  };

  const deleteUser = async (id: string, role?: string) => {
    if (role === 'Dealer') {
      await deleteDealer(id);
    } else {
      await deleteEmployee(id);
    }
  };

  const addLead = async (lead: Omit<MockLead, 'id'>) => {
    try {
      const assignedEmp = lead.assignedEmployee !== undefined && lead.assignedEmployee !== null
        ? lead.assignedEmployee
        : (authUser?.role === 'Employee' ? authUser.name : '');
      const assignedEmpId = lead.assignedEmployeeId !== undefined && lead.assignedEmployeeId !== null
        ? lead.assignedEmployeeId
        : (authUser?.role === 'Employee' ? authUser.id : '');
      const dealer = lead.dealer !== undefined && lead.dealer !== null
        ? lead.dealer
        : (authUser?.role === 'Dealer' ? authUser.name : 'Direct (Company)');
      const dealerId = lead.dealerId !== undefined && lead.dealerId !== null
        ? lead.dealerId
        : (authUser?.role === 'Dealer' ? authUser.id : '');

      const nextNum = String(leads.length + 1).padStart(3, '0');
      const customerCode = (lead as any).customerCode?.startsWith('MSV/CUS/')
        ? (lead as any).customerCode
        : `MSV/CUS/${nextNum}`;

      const leadPayload = {
        ...lead,
        customerCode: customerCode,
        code: customerCode,
        dealerId: dealerId || '',
        dealer: dealer || 'Direct (Company)',
        assignedEmployee: assignedEmp || '',
        assignedEmployeeId: assignedEmpId || '',
        createdAt: lead.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const cleanPayload = sanitizeForFirestore(leadPayload);
      const docRef = await addDoc(collection(db, 'leads'), cleanPayload);

      // Optimistic local state update so the new lead is immediately available in UI
      const createdLead: MockLead = {
        ...cleanPayload,
        id: docRef.id,
        customerCode: customerCode,
        code: customerCode
      } as MockLead;
      setLeads(prev => [createdLead, ...prev.filter(l => l.id !== docRef.id)]);

      return docRef.id;
    } catch (err: any) {
      console.error("Error adding lead:", err);
      dispatchToast(`Failed to save lead: ${err.message || String(err)}`, 'error');
      throw err;
    }
  };

  const updateLead = async (id: string, updates: Partial<MockLead>) => {
    // 1. Instant optimistic frontend update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates, updatedAt: updates.updatedAt || 'Just now' } : l));
    try {
      const cleanUpdates = sanitizeForFirestore(updates);
      await updateDoc(doc(db, 'leads', id), cleanUpdates);
      console.log("Successfully updated lead in Firestore", cleanUpdates);
    } catch (err: any) {
      console.error("Error updating lead:", err);
      dispatchToast(`Firestore Update Failed: ${err.message || String(err)}`, 'error');
      throw err;
    }
  };

  const updateLeadStage = async (leadId: string, newStage: Stage) => {
    // 1. Instant optimistic frontend update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage, updatedAt: 'Just now' } : l));
    try {
      const updates: any = { stage: newStage, updatedAt: 'Just now' };
      if (['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(newStage)) {
        updates.convertedAt = new Date().toISOString();
      }
      await updateDoc(doc(db, 'leads', leadId), sanitizeForFirestore(updates));
    } catch (err) {
      console.error("Error updating lead stage:", err);
    }
  };

  const deleteLead = async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    try {
      await deleteDoc(doc(db, 'leads', id));
      dispatchToast('Lead deleted successfully', 'success');
    } catch (err: any) {
      console.error("Error deleting lead:", err);
      dispatchToast(`Failed to delete lead: ${err.message || String(err)}`, 'error');
      throw err;
    }
  };

  const deleteBulkLeads = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setLeads(prev => prev.filter(l => !idSet.has(l.id)));
    try {
      const batchSize = 400;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = ids.slice(i, i + batchSize);
        chunk.forEach(leadId => {
          batch.delete(doc(db, 'leads', leadId));
        });
        await batch.commit();
      }
      dispatchToast(`${ids.length} leads deleted successfully`, 'success');
    } catch (err: any) {
      console.error("Error deleting bulk leads:", err);
      dispatchToast(`Failed to delete leads: ${err.message || String(err)}`, 'error');
      throw err;
    }
  };

  const updateUserPermissions = async (userId: string, permissions: UserPermissions) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can update permissions");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { permissions });
    } catch (err) {
      console.error("Error updating user permissions:", err);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can update roles");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (err) {
      console.error("Error updating user role:", err);
    }
  };

  const updateUserStatus = async (userId: string, status: UserStatus) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can update user status");
      return;
    }
    if (userId.startsWith('ADM')) {
      setAdminUser({ ...adminUser, status });
    } else {
      try {
        await updateDoc(doc(db, 'users', userId), { status });
      } catch (err) {
        console.error("Error updating user status:", err);
      }
    }
  };

  const addActivity = async (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    try {
      await addDoc(collection(db, 'activities'), {
        ...activity,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding activity:", err);
    }
  };

  const resetData = () => {
    console.warn("resetData called but data is now live from Firestore!");
  };

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        ...task,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const settleLeadPayment = async (
    leadId: string,
    milestoneType: PaymentMilestoneType,
    data: { amount: number; proofUrl: string; proofFileName: string; proofFileSize?: number; utrNumber?: string; adminNotes?: string }
  ) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const currentPayments = lead.payments || {};
      const key = milestoneType === 'Pre-Installation' ? 'preInstallation' : 'postInstallation';
      
      const updatedMilestone: PaymentMilestone = {
        ...(currentPayments[key] || { id: `${milestoneType === 'Pre-Installation' ? 'PRE' : 'POST'}_${leadId}`, type: milestoneType }),
        amount: data.amount,
        status: 'Settled',
        proofUrl: data.proofUrl,
        proofFileName: data.proofFileName,
        proofFileSize: data.proofFileSize || 0,
        utrNumber: data.utrNumber || '',
        adminNotes: data.adminNotes || '',
        settledAt: new Date().toISOString(),
        settledBy: currentUser?.name || 'Admin',
      };

      const updatedPayments: LeadPayments = {
        ...currentPayments,
        [key]: updatedMilestone
      };

      await updateDoc(doc(db, 'leads', leadId), {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });

      await addActivity({
        type: 'Payment Settled',
        message: `Admin settled ${milestoneType} payment (₹${data.amount.toLocaleString('en-IN')}) for ${lead.customer}`,
        user: currentUser?.name || 'Admin',
        leadId: lead.id,
        dealer: lead.dealer
      });
    } catch (err) {
      console.error("Error settling payment:", err);
      throw err;
    }
  };

  const acknowledgeLeadPayment = async (
    leadId: string,
    milestoneType: PaymentMilestoneType,
    data?: { dealerNotes?: string }
  ) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const currentPayments = lead.payments || {};
      const key = milestoneType === 'Pre-Installation' ? 'preInstallation' : 'postInstallation';
      const existingMilestone = currentPayments[key];
      if (!existingMilestone) return;

      const updatedMilestone: PaymentMilestone = {
        ...existingMilestone,
        status: 'Received',
        receivedAt: new Date().toISOString(),
        receivedBy: currentUser?.name || 'Dealer',
        dealerNotes: data?.dealerNotes || ''
      };

      const updatedPayments: LeadPayments = {
        ...currentPayments,
        [key]: updatedMilestone
      };

      await updateDoc(doc(db, 'leads', leadId), {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });

      await addActivity({
        type: 'Payment Received',
        message: `Dealer ${currentUser?.name || lead.dealer} confirmed receipt of ${milestoneType} payment for ${lead.customer}`,
        user: currentUser?.name || 'Dealer',
        leadId: lead.id,
        dealer: lead.dealer
      });
    } catch (err) {
      console.error("Error acknowledging payment:", err);
      throw err;
    }
  };

  const addCustomerPayment = async (
    leadId: string,
    data: {
      amount: number;
      paymentType: CustomerPaymentType;
      paymentMode: CustomerPaymentMode;
      paidAt?: string;
      proofUrl?: string;
      proofFileName?: string;
      proofFileSize?: number;
      referenceNumber?: string;
      notes?: string;
    }
  ) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const currentPayments = lead.payments || {};
      const existingList = currentPayments.customerPayments || [];

      const newRecord: CustomerPaymentRecord = {
        id: generateSecureId('CP_'),
        leadId: lead.id,
        customerName: lead.customer,
        amount: data.amount,
        paymentType: data.paymentType,
        paymentMode: data.paymentMode,
        status: currentUser?.role === 'Admin' ? 'Verified' : 'Pending Verification',
        paidAt: data.paidAt || new Date().toISOString(),
        recordedBy: currentUser?.name || 'Staff',
        recordedByRole: currentUser?.role || 'Admin',
        proofUrl: data.proofUrl || '',
        proofFileName: data.proofFileName || '',
        proofFileSize: data.proofFileSize || 0,
        referenceNumber: data.referenceNumber || '',
        notes: data.notes || '',
        verifiedAt: currentUser?.role === 'Admin' ? new Date().toISOString() : undefined,
        verifiedBy: currentUser?.role === 'Admin' ? currentUser.name : undefined,
      };

      const updatedCustomerPayments = [newRecord, ...existingList];
      const updatedPayments: LeadPayments = {
        ...currentPayments,
        customerPayments: updatedCustomerPayments
      };

      // 1. Instant optimistic update
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, payments: updatedPayments, updatedAt: 'Just now' } : l));

      await updateDoc(doc(db, 'leads', leadId), {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });

      await addActivity({
        type: 'Customer Payment Recorded',
        message: `${currentUser?.name || 'Staff'} recorded Customer payment of ₹${data.amount.toLocaleString('en-IN')} (${data.paymentType} via ${data.paymentMode}) for ${lead.customer}`,
        user: currentUser?.name || 'Staff',
        leadId: lead.id,
        dealer: lead.dealer
      });
    } catch (err) {
      console.error("Error adding customer payment:", err);
      throw err;
    }
  };

  const verifyCustomerPayment = async (
    leadId: string,
    paymentId: string,
    status: 'Verified' | 'Rejected',
    reason?: string
  ) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const currentPayments = lead.payments || {};
      const existingList = currentPayments.customerPayments || [];

      const updatedList = existingList.map(item => {
        if (item.id === paymentId) {
          return {
            ...item,
            status,
            verifiedAt: new Date().toISOString(),
            verifiedBy: currentUser?.name || 'Admin',
            rejectionReason: reason || item.rejectionReason
          };
        }
        return item;
      });

      const updatedPayments: LeadPayments = {
        ...currentPayments,
        customerPayments: updatedList
      };

      await updateDoc(doc(db, 'leads', leadId), {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });

      // Automatic quotation release upon verified token payment (₹5,000 - ₹15,000 or Token type)
      if (status === 'Verified') {
        const verifiedItem = existingList.find(p => p.id === paymentId);
        if (verifiedItem && (verifiedItem.paymentType === 'Token' || verifiedItem.amount >= 5000)) {
          try {
            const quotationsQuery = query(collection(db, 'quotations'), where('leadId', '==', leadId));
            const qSnap = await getDocs(quotationsQuery);
            qSnap.forEach(async (qDoc) => {
              await updateDoc(doc(db, 'quotations', qDoc.id), {
                isReleased: true,
                releasedAt: new Date().toISOString(),
                releasedBy: currentUser?.name || 'Accounts Admin (Auto-Release)',
                tokenPaymentStatus: 'Verified',
                tokenPaymentReceived: verifiedItem.amount,
                tokenPaymentRef: verifiedItem.referenceNumber || '',
                updatedAt: new Date().toISOString()
              });
            });
          } catch (qErr) {
            console.warn('Auto quotation release check notice:', qErr);
          }
        }
      }

      await addActivity({
        type: status === 'Verified' ? 'Customer Payment Verified' : 'Customer Payment Rejected',
        message: `Admin ${status.toLowerCase()} customer payment for ${lead.customer}${reason ? ` (Reason: ${reason})` : ''}`,
        user: currentUser?.name || 'Admin',
        leadId: lead.id,
        dealer: lead.dealer
      });
    } catch (err) {
      console.error("Error verifying customer payment:", err);
      throw err;
    }
  };

  const deleteCustomerPayment = async (leadId: string, paymentId: string) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const currentPayments = lead.payments || {};
      const existingList = currentPayments.customerPayments || [];
      const updatedList = existingList.filter(item => item.id !== paymentId);

      const updatedPayments: LeadPayments = {
        ...currentPayments,
        customerPayments: updatedList
      };

      await updateDoc(doc(db, 'leads', leadId), {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });

      await addActivity({
        type: 'Customer Payment Deleted',
        message: `${currentUser?.name || 'Admin'} deleted customer payment record for ${lead.customer}`,
        user: currentUser?.name || 'Admin',
        leadId: lead.id,
        dealer: lead.dealer
      });
    } catch (err) {
      console.error("Error deleting customer payment:", err);
      throw err;
    }
  };

  // --- Attendance Management ---
  const markAttendance = async (employeeId: string, date?: string, dealerId?: string | null, customTime?: string) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (targetDate > todayStr) {
      console.warn("Rejected: Cannot mark attendance for future dates", targetDate);
      throw new Error("Cannot mark attendance for future dates");
    }

    const time = customTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    
    // Find employee to resolve dealerId if not provided
    const targetEmp = employees.find(e => e.id === employeeId);
    const targetDealerId = dealerId !== undefined ? dealerId : (targetEmp?.dealerId || null);

    const recordId = `${employeeId}_${targetDate}`;
    const record: AttendanceRecord = {
      id: recordId,
      employeeId,
      dealerId: targetDealerId,
      date: targetDate,
      status: 'PRESENT',
      markedAt: time
    };

    // Update local state first for instant UX
    setAttendances(prev => {
      const filtered = prev.filter(a => !(a.employeeId === employeeId && a.date === targetDate));
      return [...filtered, record];
    });

    try {
      await setDoc(doc(db, 'attendance', recordId), record);
    } catch (err) {
      console.warn("Could not persist attendance to Firestore, keeping in local state:", err);
    }
  };

  const removeAttendance = async (employeeId: string, date: string) => {
    const recordId = `${employeeId}_${date}`;
    
    // Update local state first
    setAttendances(prev => prev.filter(a => !(a.employeeId === employeeId && a.date === date)));

    try {
      await deleteDoc(doc(db, 'attendance', recordId));
    } catch (err) {
      console.warn("Could not remove attendance from Firestore, updated local state:", err);
    }
  };

  const isEmployeePresent = (employeeId: string, date: string): boolean => {
    return attendances.some(a => a.employeeId === employeeId && a.date === date && a.status === 'PRESENT');
  };

  const getEmployeeAttendance = (employeeId: string, date: string): AttendanceRecord | undefined => {
    return attendances.find(a => a.employeeId === employeeId && a.date === date && a.status === 'PRESENT');
  };

  const getAttendanceForDate = (date: string, dealerId?: string | null): AttendanceRecord[] => {
    return attendances.filter(a => {
      if (a.date !== date || a.status !== 'PRESENT') return false;
      if (dealerId !== undefined) {
        return a.dealerId === dealerId;
      }
      return true;
    });
  };

  const getEmployeeAttendanceHistory = (employeeId: string): AttendanceRecord[] => {
    return attendances
      .filter(a => a.employeeId === employeeId && a.status === 'PRESENT')
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  // --- Dealer & Employee Feature & Staff Management ---
  const updateDealerFeatures = async (dealerId: string, newFeatures: Partial<DealerFeatures>) => {
    const targetDealer = dealers.find(d => d.id === dealerId);
    const existingFeatures = targetDealer?.features || defaultDealerFeatures;
    const updatedFeatures: DealerFeatures = { ...existingFeatures, ...newFeatures };

    setDealers(prev => prev.map(d => d.id === dealerId ? { ...d, features: updatedFeatures } : d));

    try {
      await updateDoc(doc(db, 'users', dealerId), { features: updatedFeatures });
    } catch (err) {
      console.warn("Error updating dealer features in Firestore:", err);
    }
  };

  const updateEmployeeFeatures = async (employeeId: string, newFeatures: Partial<DealerFeatures>) => {
    const targetEmp = employees.find(e => e.id === employeeId);
    const existingFeatures = targetEmp?.features || defaultEmployeeFeatures;
    const updatedFeatures: DealerFeatures = { ...existingFeatures, ...newFeatures };

    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, features: updatedFeatures } : e));

    try {
      await updateDoc(doc(db, 'users', employeeId), { features: updatedFeatures });
    } catch (err) {
      console.warn("Error updating employee features in Firestore:", err);
    }
  };

  const updateUserFeatures = async (userId: string, role: 'Employee' | 'Dealer', newFeatures: Partial<DealerFeatures>) => {
    if (role === 'Dealer') {
      await updateDealerFeatures(userId, newFeatures);
    } else {
      await updateEmployeeFeatures(userId, newFeatures);
    }
  };

  const updateUserPassword = async (userId: string, _role: 'Employee' | 'Dealer', _newPassword: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { lastPasswordReset: new Date().toISOString() });
    } catch (err) {
      console.warn("Could not save password reset timestamp in Firestore:", err);
    }
  };

  const updateUserCredentials = async (
    userId: string,
    role: 'Employee' | 'Dealer' | 'Admin',
    updates: {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      employeeCategory?: string;
      status?: UserStatus;
      address?: string;
    }
  ) => {
    // Generate initials if name is updated
    const initials = updates.name 
      ? updates.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase()
      : undefined;

    const { password: _pw, ...cleanUpdates } = updates as any;
    const fullUpdates = {
      ...cleanUpdates,
      ...(initials ? { initials } : {})
    };

    if (role === 'Dealer') {
      setDealers(prev => prev.map(d => d.id === userId ? { ...d, ...fullUpdates } : d));
    } else if (role === 'Employee') {
      setEmployees(prev => prev.map(e => e.id === userId ? { ...e, ...fullUpdates } : e));
    } else if (role === 'Admin') {
      setAdminUser(prev => ({ ...prev, ...fullUpdates }));
    }

    try {
      const cleanUpdates: any = { ...fullUpdates };
      Object.keys(cleanUpdates).forEach(key => {
        if (cleanUpdates[key] === undefined) delete cleanUpdates[key];
      });
      cleanUpdates.updatedAt = new Date().toISOString();

      // Find user to check if secondary doc key exists (e.g. employeeId)
      const targetUser = employees.find(e => e.id === userId) || dealers.find(d => d.id === userId);

      await updateDoc(doc(db, 'users', userId), cleanUpdates);

      if (targetUser && (targetUser as any).employeeId && (targetUser as any).employeeId !== userId) {
        try {
          await updateDoc(doc(db, 'users', (targetUser as any).employeeId), cleanUpdates);
        } catch (e) {
          // secondary doc optional
        }
      }
    } catch (err) {
      console.warn("Error updating user credentials in Firestore:", err);
    }
  };

  const addDealerEmployee = async (dealerId: string, emp: Omit<Employee, 'id' | 'permissions' | 'role' | 'dealerId'> & { id?: string; password?: string }) => {
    const newId = emp.id?.trim() || `EMP${Date.now()}`;
    const newEmployee: Employee = {
      ...emp,
      id: newId,
      dealerId,
      role: 'Employee',
      permissions: { ...defaultEmployeePermissions },
      status: emp.status || 'Active'
    };
    delete (newEmployee as any).password;

    setEmployees(prev => [...prev.filter(e => e.id !== newId), newEmployee]);

    try {
      await setDoc(doc(db, 'users', newId), sanitizeForFirestore(newEmployee));
    } catch (err) {
      console.warn("Error adding dealer employee to Firestore:", err);
    }
  };

  const updateDealerEmployee = async (employeeId: string, dealerId: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => (e.id === employeeId && e.dealerId === dealerId) ? { ...e, ...updates } : e));

    try {
      await updateDoc(doc(db, 'users', employeeId), sanitizeForFirestore(updates));
    } catch (err) {
      console.warn("Error updating dealer employee in Firestore:", err);
    }
  };

  // --- Responsibility Management ---
  const addResponsibility = async (name: string, description?: string) => {
    const newId = `RESP_${Date.now()}`;
    const newResp: Responsibility = {
      id: newId,
      name,
      description,
      active: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setResponsibilities(prev => [...prev, newResp]);

    try {
      await setDoc(doc(db, 'responsibilities', newId), newResp);
    } catch (err) {
      console.warn("Error saving responsibility to Firestore:", err);
    }
  };

  const updateResponsibility = async (id: string, updates: Partial<Responsibility>) => {
    setResponsibilities(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

    try {
      await updateDoc(doc(db, 'responsibilities', id), updates);
    } catch (err) {
      console.warn("Error updating responsibility in Firestore:", err);
    }
  };

  const assignEmployeeResponsibilities = async (
    employeeId: string, 
    primaryId?: string, 
    secondaryIds?: string[], 
    notes?: string
  ) => {
    const targetEmp = employees.find(e => e.id === employeeId);
    if (!targetEmp) return;

    const updatedResp: EmployeeResponsibilities = {
      primaryResponsibilityId: primaryId || '',
      secondaryResponsibilityIds: secondaryIds || [],
      notes: notes || '',
      assignedAt: new Date().toISOString(),
      assignedBy: currentUser?.name || 'Admin'
    };

    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, responsibilities: updatedResp } : e));

    try {
      await updateDoc(doc(db, 'users', employeeId), { responsibilities: updatedResp });
      await addActivity({
        type: 'Responsibilities Assigned',
        message: `Admin updated operational responsibilities for ${targetEmp.name}`,
        user: currentUser?.name || 'Admin',
        employee: targetEmp.name
      });
    } catch (err) {
      console.warn("Error assigning responsibilities in Firestore:", err);
    }
  };

  // --- Quotations Management ---
  const createQuotation = async (quoteData: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt'>): Promise<Quotation> => {
    const newId = `QT_${Date.now()}`;
    const seqNum = String(quotations.length + 1).padStart(3, '0');
    const quotationNumber = `MS-QT-2026-${seqNum}`;

    const newQuotation: Quotation = {
      ...quoteData,
      id: newId,
      quotationNumber,
      createdAt: new Date().toISOString()
    };

    setQuotations(prev => [newQuotation, ...prev]);

    try {
      await setDoc(doc(db, 'quotations', newId), newQuotation);
      await addActivity({
        type: 'Quotation Generated',
        message: `${quoteData.createdByName || 'Dealer'} generated Quote ${quotationNumber} (₹${quoteData.finalAmount.toLocaleString('en-IN')}) for ${quoteData.customerName}`,
        user: quoteData.createdByName || currentUser?.name || 'Dealer',
        dealer: quoteData.dealerName,
        leadId: quoteData.leadId
      });
    } catch (err) {
      console.warn("Error saving quotation to Firestore:", err);
    }

    return newQuotation;
  };

  const updateQuotationStatus = async (id: string, status: QuotationStatus) => {
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));

    try {
      await updateDoc(doc(db, 'quotations', id), { status });
    } catch (err) {
      console.warn("Error updating quotation status in Firestore:", err);
    }
  };

  const getDealerQuotations = (dealerId: string): Quotation[] => {
    return quotations
      .filter(q => q.dealerId === dealerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getLeadQuotations = (leadId: string, dealerId: string): Quotation[] => {
    return quotations
      .filter(q => q.leadId === leadId && q.dealerId === dealerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const assignLead = async (leadId: string, assignment: any, employeeId?: string) => {
    try {
      let updates: any = { updatedAt: new Date().toISOString() };
      if (typeof assignment === 'string') {
        let targetName = assignment;
        let targetId = employeeId || '';
        const matchedEmp = employees.find(e => e.id === assignment || e.name === assignment);
        if (matchedEmp) {
          targetName = matchedEmp.name;
          targetId = matchedEmp.id;
        }
        updates.assignedEmployee = targetName;
        updates.assignedEmployeeId = targetId;
      } else if (assignment && typeof assignment === 'object') {
        if (assignment.employeeName) updates.assignedEmployee = assignment.employeeName;
        if (assignment.employeeId) updates.assignedEmployeeId = assignment.employeeId;
        if (assignment.dealerName) updates.dealer = assignment.dealerName;
        if (assignment.dealerId) updates.dealerId = assignment.dealerId;
      }
      await updateDoc(doc(db, 'leads', leadId), sanitizeForFirestore(updates));
      addActivity({
        type: 'Lead Assigned',
        message: `Lead assignment updated`,
        user: currentUser?.name || 'Admin',
        leadId
      });
    } catch (err) {
      console.warn("Error assigning lead in Firestore:", err);
    }
  };

  const requestLeadReassignment = async (
    leadId: string, 
    requestOrUser: any, 
    reason?: string
  ) => {
    try {
      const payload: LeadReassignmentRequest = typeof requestOrUser === 'string'
        ? {
            requestedBy: requestOrUser,
            reason: reason || '',
            status: 'Pending',
            requestedAt: new Date().toISOString()
          }
        : {
            requestedBy: currentUser?.name || 'User',
            ...requestOrUser,
            status: 'Pending',
            requestedAt: new Date().toISOString()
          };

      await updateDoc(doc(db, 'leads', leadId), sanitizeForFirestore({
        reassignmentRequest: payload,
        updatedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.warn("Error requesting lead reassignment in Firestore:", err);
    }
  };

  const resolveLeadReassignment = async (
    leadId: string, 
    statusOrApproved: any, 
    rejectionReason?: string
  ) => {
    try {
      const status: 'Approved' | 'Rejected' = typeof statusOrApproved === 'boolean'
        ? (statusOrApproved ? 'Approved' : 'Rejected')
        : (statusOrApproved || 'Approved');

      const updates: any = {
        'reassignmentRequest.status': status,
        'reassignmentRequest.resolvedAt': new Date().toISOString(),
        'reassignmentRequest.resolvedBy': currentUser?.name || 'Admin',
        updatedAt: new Date().toISOString()
      };
      if (rejectionReason) {
        updates['reassignmentRequest.rejectionReason'] = rejectionReason;
      }
      await updateDoc(doc(db, 'leads', leadId), sanitizeForFirestore(updates));
    } catch (err) {
      console.warn("Error resolving lead reassignment in Firestore:", err);
    }
  };

  // --- SALES LEAKAGE & EXCEPTION METRICS (Version 2.3 Architecture) ---
  const salesLeakageMetrics = React.useMemo<SalesLeakageMetrics>(() => {
    let unassignedCount = 0;
    let slaBreachCount = 0;
    let overdueFollowupCount = 0;
    let quotationLeakageCount = 0;
    let pendingPaymentVerificationCount = 0;
    let pendingDealerHandoffCount = 0;
    let hotLeadsCount = 0;

    leads.forEach(l => {
      if (l.archived) return;

      // 1. Unassigned Leads
      if (!l.leadOwnerId && !l.assignedEmployeeId && !l.assignedEmployee) {
        unassignedCount++;
      }

      // 2. 15-Minute SLA Breach
      if (l.slaStatus === 'SLA Breached') {
        slaBreachCount++;
      } else if (!l.firstCallAttemptAt && l.createdAt && (l.salesStage === 'New Lead' || !l.salesStage)) {
        const sla = evaluateSlaStatus(l.createdAt);
        if (sla.status === 'SLA Breached') {
          slaBreachCount++;
        }
      }

      // 3. Overdue Followup
      if (l.followUp?.status === 'Overdue') {
        overdueFollowupCount++;
      }

      // 4. Quotation Leakage (>48h in Qualified stage without proposal)
      if (l.salesStage === 'Qualified') {
        const daysOld = (Date.now() - new Date(l.updatedAt || l.createdAt).getTime()) / (1000 * 3600 * 24);
        if (daysOld >= 2) quotationLeakageCount++;
      }

      // 5. Pending Payment Verification
      const pendingPayments = l.payments?.customerPayments?.filter(p => p.status === 'Pending Verification') || [];
      if (pendingPayments.length > 0) {
        pendingPaymentVerificationCount += pendingPayments.length;
      }

      // 6. Pending Dealer Handoff
      if (l.salesStage === 'Booking Confirmed' && !l.handoffAcceptedAt) {
        pendingDealerHandoffCount++;
      }

      // 7. Hot Leads
      if (l.leadScore?.category === 'Hot') {
        hotLeadsCount++;
      }
    });

    return {
      unassignedCount,
      slaBreachCount,
      overdueFollowupCount,
      quotationLeakageCount,
      pendingPaymentVerificationCount,
      pendingDealerHandoffCount,
      totalLeadsInFunnel: leads.filter(l => !l.archived).length,
      hotLeadsCount
    };
  }, [leads]);

  // Log first phone call attempt to calculate and fulfill 15-min SLA
  const recordFirstCallAttempt = async (leadId: string) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;
      const nowIso = new Date().toISOString();
      const sla = evaluateSlaStatus(lead.createdAt || nowIso, nowIso);
      await updateDoc(doc(db, 'leads', leadId), {
        firstCallAttemptAt: nowIso,
        slaStatus: sla.status,
        salesStage: lead.salesStage === 'New Lead' || !lead.salesStage ? 'Contacted' : lead.salesStage,
        updatedAt: nowIso
      });
      addActivity({
        type: 'Call Attempt',
        message: `Initial call attempt logged (${sla.status})`,
        user: currentUser?.name || 'Sales Staff',
        leadId
      });
    } catch (err) {
      console.warn("Error logging first call attempt:", err);
    }
  };


  const [callLogs, setCallLogs] = useState<TelecallerCallLog[]>(() => {
    try {
      const cached = localStorage.getItem('crm_call_logs_cache');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return INITIAL_MOCK_CALL_LOGS;
  });

  const addCallLog = async (logData: Omit<TelecallerCallLog, 'id' | 'timestamp'>) => {
    // 0. Debounce duplicate submissions within 1500ms
    const debounceKey = `call_${logData.leadId || ''}_${logData.phone || ''}_${logData.outcome || ''}`;
    const now = Date.now();
    const lastSubmission = debounceMap.current.get(debounceKey);
    if (lastSubmission && now - lastSubmission < 1500) {
      console.warn("Duplicate call log submission ignored:", debounceKey);
      return;
    }
    debounceMap.current.set(debounceKey, now);

    const callerUid = auth.currentUser?.uid || (currentUser as any)?.uid || currentUser?.id || 'emp_user';
    const callerName = currentUser?.name || logData.telecallerName || 'Telecaller';
    const callerEmail = currentUser?.email || '';

    if (!logData.leadId) {
      throw new Error("Lead ID is mandatory for creating a call log.");
    }

    const operationId = (logData as any).operationId || (logData as any).id || generateSecureId('CALL_');
    const newLog: TelecallerCallLog & { telecallerEmail?: string; employeeId?: string; assignedEmployeeId?: string; callerId?: string; operationId?: string } = {
      ...logData,
      id: operationId,
      operationId: operationId,
      timestamp: (logData as any).timestamp || new Date().toISOString(),
      telecallerId: callerUid,
      callerId: callerUid,
      employeeId: callerUid,
      assignedEmployeeId: callerUid,
      telecallerName: callerName,
      telecallerEmail: callerEmail
    };

    // Prepare lead updates if leadId is provided
    let leadUpdates: Partial<MockLead> | null = null;
    if (logData.leadId) {
      const targetLead = leads.find(l => l.id === logData.leadId);
      const existingCallLogs = targetLead?.callLogs || [];
      const updatedLeadCallLogs = [newLog, ...existingCallLogs.filter(c => c.id !== newLog.id)];

      const todayIst = getIndiaDateString();
      leadUpdates = {
        callLogs: updatedLeadCallLogs as any,
        lastCallDate: newLog.timestamp,
        updatedAt: newLog.timestamp
      };

      if (logData.customerRequirement) {
        leadUpdates.customerRequirement = logData.customerRequirement;
      }

      if (logData.updatedLeadStatus) {
        leadUpdates.salesStage = logData.updatedLeadStatus as any;
      } else if (!targetLead?.firstCallAttemptAt || targetLead?.salesStage === 'New Lead') {
        leadUpdates.firstCallAttemptAt = newLog.timestamp;
        leadUpdates.salesStage = (logData.outcome.startsWith('Connected') || logData.outcome === 'Interested') ? 'Contacted' : 'Contact Attempted';
      }

      if (logData.nextFollowUpDate) {
        leadUpdates.followUp = {
          date: logData.nextFollowUpDate,
          time: logData.nextFollowUpTime || '11:00 AM',
          type: 'Call',
          status: logData.nextFollowUpDate === todayIst ? 'Due Today' : logData.nextFollowUpDate < todayIst ? 'Overdue' : 'Upcoming',
          notes: logData.notes || logData.customerRequirement || 'Customer callback scheduled'
        };
      }
    }

    // 1. Atomic Firestore writeBatch commit (eliminates partial-success states)
    try {
      const batch = writeBatch(db);
      const callDocRef = doc(db, 'call_leads', newLog.id);
      batch.set(callDocRef, sanitizeForFirestore(newLog));

      if (logData.leadId && leadUpdates) {
        const leadDocRef = doc(db, 'leads', logData.leadId);
        batch.update(leadDocRef, sanitizeForFirestore(leadUpdates));
      }

      await batch.commit();
    } catch (err) {
      console.error("Error committing atomic call log batch to Firestore:", err);
      throw err;
    }

    // 2. Update local optimistic state and log activity upon successful commit
    setCallLogs(prev => {
      const updated = [newLog, ...prev.filter(c => c.id !== newLog.id)];
      try { localStorage.setItem('crm_call_logs_cache', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    if (logData.leadId && leadUpdates) {
      setLeads(prev => prev.map(l => l.id === logData.leadId ? { ...l, ...leadUpdates! } : l));
      addActivity({
        type: 'Call Logged',
        message: `${logData.callDirection || 'Outgoing'} call (${logData.outcome}) logged: ${logData.notes ? logData.notes.slice(0, 60) : ''}`,
        user: callerName,
        leadId: logData.leadId
      });
    }
  };

  const updateLeadQualification = async (leadId: string, qualificationData: CustomerQualificationData) => {
    // 0. Debounce duplicate qualification submissions within 1500ms
    const qualDebounceKey = `qual_${leadId}`;
    const now = Date.now();
    const lastSubmission = debounceMap.current.get(qualDebounceKey);
    if (lastSubmission && now - lastSubmission < 1500) {
      console.warn("Duplicate qualification submission ignored:", qualDebounceKey);
      return;
    }
    debounceMap.current.set(qualDebounceKey, now);

    try {
      const target = leads.find(l => l.id === leadId);
      const score = calculateLeadScore({
        monthlyUnitsKwh: qualificationData.monthlyUnitsKwh,
        monthlyBill: qualificationData.monthlyBill,
        roofOwnership: qualificationData.roofOwnership,
        roofType: qualificationData.roofType,
        shadingStatus: qualificationData.shadingCondition === 'None' ? 'No' : 'Yes',
        purchaseTimeline: qualificationData.expectedTimeline,
        decisionMaker: qualificationData.decisionMaker !== 'Landlord',
        financingRequirement: qualificationData.budgetPreference
      });

      const nowIso = new Date().toISOString();
      const updates: any = {
        qualificationData: sanitizeForFirestore(qualificationData),
        leadScore: score,
        updatedAt: nowIso
      };

      if (qualificationData.pincode) {
        updates.pincode = qualificationData.pincode;
      }
      if (qualificationData.location) {
        updates.location = qualificationData.location;
      }

      if (qualificationData.qualificationResult === 'Qualified') {
        updates.salesStage = 'Qualified';
      } else if (qualificationData.qualificationResult === 'Not Qualified') {
        updates.salesStage = 'Lost';
      } else if (qualificationData.qualificationResult === 'Needs Follow-up') {
        updates.salesStage = 'Contacted';
      } else if (target?.salesStage === 'New Lead' || target?.salesStage === 'Contacted') {
        updates.salesStage = 'Qualified';
      }

      await updateDoc(doc(db, 'leads', leadId), updates);

      // Local optimistic update
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));

      addActivity({
        type: 'Customer Qualified',
        message: `Customer qualified: Score ${score.total}/100 (${score.category}) - ${qualificationData.preferredCapacityKw || 3} kW solar preference`,
        user: currentUser?.name || 'Telecaller',
        leadId
      });
    } catch (err) {
      console.error("Error updating lead qualification:", err);
      throw err;
    }
  };

  // Update salesStage with activity log
  const updateLeadSalesStage = async (leadId: string, salesStage: SalesStage, notes?: string) => {
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'leads', leadId), {
        salesStage,
        updatedAt: nowIso
      });
      addActivity({
        type: 'Sales Stage Updated',
        message: `Sales stage updated to ${salesStage}${notes ? ` (${notes})` : ''}`,
        user: currentUser?.name || 'Sales Staff',
        leadId
      });
    } catch (err) {
      console.warn("Error updating sales stage:", err);
    }
  };

  return (
    <CRMContext.Provider value={{ 
      leads, employees, dealers, users, activities, currentUser, setCurrentUser,
      addEmployee, updateEmployee, deleteEmployee,
      addDealer, updateDealer, deleteDealer, deleteUser,
      addLead, updateLead, updateLeadStage, deleteLead, deleteBulkLeads,
      updateUserPermissions, updateUserRole, updateUserStatus,
      addActivity, settleLeadPayment, acknowledgeLeadPayment,
      addCustomerPayment, verifyCustomerPayment, deleteCustomerPayment,
      tasks, addTask, updateTask, deleteTask, resetData,

      // Attendance & Dealer/Employee Feature Management
      attendances, markAttendance, removeAttendance, isEmployeePresent,
      getEmployeeAttendance, getAttendanceForDate, getEmployeeAttendanceHistory,
      updateDealerFeatures, updateEmployeeFeatures, updateUserFeatures, updateUserPassword,
      updateUserCredentials,
      addDealerEmployee, updateDealerEmployee,

      // Responsibilities Management
      responsibilities, addResponsibility, updateResponsibility, assignEmployeeResponsibilities,

      // Products & Quotations
      approvedProducts, quotations, createQuotation, updateQuotationStatus,
      getDealerQuotations, getLeadQuotations,

      // Reassignment Helpers
      assignLead, requestLeadReassignment, resolveLeadReassignment,

      // Seed Helper
      seedSampleLeads,

      // Dealer Commission Management
      recordDealerCommissionPayout,

      // Sales Manager & Leakage Monitor (Version 2.3)
      salesLeakageMetrics,
      recordFirstCallAttempt,
      updateLeadSalesStage,
      callLogs, addCallLog, updateLeadQualification
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (context === undefined) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
