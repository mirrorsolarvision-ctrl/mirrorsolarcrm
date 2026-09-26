import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { seedSampleLeads } from '../seedFirebase';

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
}

export type DocumentStatus = 'Pending' | 'Uploaded' | 'Additional Document Required' | 'Verified' | 'Rejected';

export interface LeadDocument {
  id: string;
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

export type CustomerPaymentType = 'Booking / Advance' | 'First Milestone' | 'Bank Loan Disbursal' | 'Final Payment' | 'Subsidy Received' | 'Other';
export type CustomerPaymentMode = 'UPI' | 'Bank Transfer / NEFT' | 'Net Banking' | 'Cheque' | 'Cash' | 'Bank Loan' | 'Credit / Debit Card' | 'Other';
export type CustomerPaymentStatus = 'Pending Verification' | 'Verified' | 'Rejected';

export interface CustomerPaymentRecord {
  id: string;
  leadId: string;
  customerName: string;
  amount: number;
  paymentType: CustomerPaymentType;
  paymentMode: CustomerPaymentMode;
  status: CustomerPaymentStatus;
  paidAt: string;
  recordedBy: string;
  recordedByRole: string;
  proofUrl?: string;
  proofFileName?: string;
  proofFileSize?: number;
  referenceNumber?: string; // UTR / Transaction ID / Cheque #
  notes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
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
  createdBy?: string;
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
}

export const defaultDealerFeatures: DealerFeatures = {
  myEmployees: true,
  attendance: true,
  quotations: true,
  leads: true,
  stock: true,
  payments: true,
  reports: false,
  tasks: true,
  calendar: true
};

export const defaultEmployeeFeatures: DealerFeatures = {
  myEmployees: false,
  attendance: true,
  quotations: true,
  leads: true,
  stock: true,
  payments: false,
  reports: false,
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
  password?: string; // Stored securely for Admin credential management
}

export type EmployeeStatus = 'Active' | 'Away' | 'Offline' | 'Inactive';

export interface Employee extends User {
  role: 'Employee';
  dealerId?: string | null; // null = Company Staff, string = Dealer's Staff
  authId?: string;
  responsibilities?: EmployeeResponsibilities;
  features?: DealerFeatures;
  password?: string;
}

export type DealerStatus = 'Active' | 'Inactive';

export interface Dealer extends User {
  role: 'Dealer';
  address: string;
  features?: DealerFeatures;
  password?: string;
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
  { id: 'RESP_MARKETING', name: 'Marketing & Outreach', description: 'Solar awareness campaigns, lead generation, and partner promotions', active: true, createdAt: '2026-01-01' }
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
  addEmployee: (emp: Omit<Employee, 'id' | 'permissions' | 'role'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  addDealer: (dealer: Omit<Dealer, 'id' | 'permissions' | 'role'>) => void;
  updateDealer: (id: string, updates: Partial<Dealer>) => void;
  addLead: (lead: Omit<MockLead, 'id'>) => void;
  updateLead: (id: string, updates: Partial<MockLead>) => void;
  updateLeadStage: (leadId: string, newStage: Stage) => void;
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
  addDealerEmployee: (dealerId: string, emp: Omit<Employee, 'id' | 'permissions' | 'role' | 'dealerId'>) => Promise<void>;
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

  // Seed Helper
  seedSampleLeads: () => Promise<number>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<MockLead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(defaultResponsibilities);
  const [approvedProducts, setApprovedProducts] = useState<ApprovedProduct[]>(defaultApprovedProducts);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const { currentUser: authUser } = useAuth();
  useEffect(() => {
    setCurrentUser(authUser);
  }, [authUser]);
  
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
      setDealers([]);
      setActivities([]);
      setTasks([]);
      setAttendances([]);
      return;
    }

    // 1. Listen for Live Users (Employees & Dealers)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers: User[] = [];
      snapshot.forEach(doc => {
        allUsers.push(doc.data() as User);
      });
      setEmployees(allUsers.filter(u => u.role === 'Employee') as Employee[]);
      setDealers(allUsers.filter(u => u.role === 'Dealer') as Dealer[]);
    });

    // 2. Listen for Live Leads - SCOPED BY ROLE
    let leadsQuery = collection(db, 'leads');
    if (authUser.role === 'Dealer') {
      leadsQuery = query(collection(db, 'leads'), where('dealer', '==', authUser.name)) as any;
    } else if (authUser.role === 'Employee') {
      leadsQuery = query(collection(db, 'leads'), where('assignedEmployee', '==', authUser.name)) as any;
    }
    
    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const allLeads: MockLead[] = [];
      snapshot.forEach(doc => {
        allLeads.push({ id: doc.id, ...doc.data() } as MockLead);
      });
      allLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLeads(allLeads);
    });

    // 3. Listen for Live Activities - SCOPED BY ROLE
    let activitiesQuery = collection(db, 'activities');
    if (authUser.role === 'Dealer') {
      activitiesQuery = query(collection(db, 'activities'), where('dealer', '==', authUser.name)) as any;
    } else if (authUser.role === 'Employee') {
      activitiesQuery = query(collection(db, 'activities'), where('assignedEmployee', '==', authUser.name)) as any;
    }

    const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
      const allActivities: Activity[] = [];
      snapshot.forEach(doc => {
        allActivities.push({ id: doc.id, ...doc.data() } as Activity);
      });
      allActivities.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setActivities(allActivities);
    });

    // 4. Listen for Live Tasks - SCOPED BY ROLE
    let tasksQuery = collection(db, 'tasks');
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const allTasks: Task[] = [];
      snapshot.forEach(doc => {
        allTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setTasks(allTasks);
    });

    // 5. Listen for Live Attendance Records
    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      const allRecords: AttendanceRecord[] = [];
      snapshot.forEach(doc => {
        allRecords.push(doc.data() as AttendanceRecord);
      });
      setAttendances(allRecords);
    }, (err) => {
      console.warn("Attendance collection listener fallback to local state:", err);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLeads();
      unsubscribeActivities();
      unsubscribeTasks();
      unsubscribeAttendance();
    };
  }, [authUser]);

  const users: User[] = [adminUser, ...employees, ...dealers];

  const addEmployee = async (emp: Omit<Employee, 'id' | 'permissions' | 'role'>) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can add employees");
      return;
    }
    const newId = `EMP${Date.now()}`;
    const newEmployee: Employee = { ...emp, id: newId, role: 'Employee', permissions: { ...defaultEmployeePermissions } };
    try {
      await setDoc(doc(db, 'users', newId), newEmployee);
    } catch (err) {
      console.error("Error adding employee:", err);
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
    } catch (err) {
      console.error("Error updating employee:", err);
    }
  };

  const addDealer = async (dealer: Omit<Dealer, 'id' | 'permissions' | 'role'>) => {
    if (authUser?.role !== 'Admin') {
      console.error("Unauthorized: Only Admins can add dealers");
      return;
    }
    const newId = `DLR${Date.now()}`;
    const newDealer: Dealer = { ...dealer, id: newId, role: 'Dealer', permissions: { ...defaultDealerPermissions } };
    try {
      await setDoc(doc(db, 'users', newId), newDealer);
    } catch (err) {
      console.error("Error adding dealer:", err);
    }
  };

  const updateDealer = async (id: string, updates: Partial<Dealer>) => {
    try {
      await updateDoc(doc(db, 'users', id), updates);
    } catch (err) {
      console.error("Error updating dealer:", err);
    }
  };

  const addLead = async (lead: Omit<MockLead, 'id'>) => {
    try {
      const assignedEmp = lead.assignedEmployee || (authUser?.role === 'Employee' ? authUser.name : '');
      const assignedEmpId = lead.assignedEmployeeId || (authUser?.role === 'Employee' ? authUser.id : undefined);
      const leadPayload = {
        ...lead,
        dealerId: lead.dealerId || (authUser?.role === 'Dealer' ? authUser.id : undefined),
        dealer: lead.dealer || (authUser?.role === 'Dealer' ? authUser.name : ''),
        assignedEmployee: assignedEmp,
        assignedEmployeeId: assignedEmpId
      };
      await addDoc(collection(db, 'leads'), leadPayload);
    } catch (err: any) {
      console.error("Error adding lead:", err);
      alert(`Failed to save lead to database: ${err.message || String(err)}`);
    }
  };

  const updateLead = async (id: string, updates: Partial<MockLead>) => {
    try {
      await updateDoc(doc(db, 'leads', id), updates);
      console.log("Successfully updated lead in Firestore", updates);
    } catch (err: any) {
      console.error("Error updating lead:", err);
      alert(`Firestore Update Failed: ${err.message || String(err)}`);
    }
  };

  const updateLeadStage = async (leadId: string, newStage: Stage) => {
    try {
      const updates: any = { stage: newStage, updatedAt: 'Just now' };
      if (['Converted', 'Installation', 'Loan', 'Material', 'Completed'].includes(newStage)) {
        updates.convertedAt = new Date().toISOString();
      }
      await updateDoc(doc(db, 'leads', leadId), updates);
    } catch (err) {
      console.error("Error updating lead stage:", err);
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
        id: `CP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

  const updateUserPassword = async (userId: string, role: 'Employee' | 'Dealer', newPassword: string) => {
    if (role === 'Dealer') {
      setDealers(prev => prev.map(d => d.id === userId ? { ...d, password: newPassword } : d));
    } else {
      setEmployees(prev => prev.map(e => e.id === userId ? { ...e, password: newPassword } : e));
    }

    try {
      await updateDoc(doc(db, 'users', userId), { password: newPassword, lastPasswordReset: new Date().toISOString() });
    } catch (err) {
      console.warn("Error updating password in Firestore:", err);
    }
  };

  const addDealerEmployee = async (dealerId: string, emp: Omit<Employee, 'id' | 'permissions' | 'role' | 'dealerId'>) => {
    const newId = `EMP${Date.now()}`;
    const newEmployee: Employee = {
      ...emp,
      id: newId,
      dealerId,
      role: 'Employee',
      permissions: { ...defaultEmployeePermissions }
    };

    setEmployees(prev => [...prev, newEmployee]);

    try {
      await setDoc(doc(db, 'users', newId), newEmployee);
    } catch (err) {
      console.warn("Error adding dealer employee to Firestore:", err);
    }
  };

  const updateDealerEmployee = async (employeeId: string, dealerId: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => (e.id === employeeId && e.dealerId === dealerId) ? { ...e, ...updates } : e));

    try {
      await updateDoc(doc(db, 'users', employeeId), updates);
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

  return (
    <CRMContext.Provider value={{ 
      leads, employees, dealers, users, activities, currentUser, setCurrentUser,
      addEmployee, updateEmployee, 
      addDealer, updateDealer, 
      addLead, updateLead, updateLeadStage,
      updateUserPermissions, updateUserRole, updateUserStatus,
      addActivity, settleLeadPayment, acknowledgeLeadPayment,
      addCustomerPayment, verifyCustomerPayment, deleteCustomerPayment,
      tasks, addTask, updateTask, deleteTask, resetData,

      // Attendance & Dealer/Employee Feature Management
      attendances, markAttendance, removeAttendance, isEmployeePresent,
      getEmployeeAttendance, getAttendanceForDate, getEmployeeAttendanceHistory,
      updateDealerFeatures, updateEmployeeFeatures, updateUserFeatures, updateUserPassword,
      addDealerEmployee, updateDealerEmployee,

      // Responsibilities Management
      responsibilities, addResponsibility, updateResponsibility, assignEmployeeResponsibilities,

      // Products & Quotations
      approvedProducts, quotations, createQuotation, updateQuotationStatus,
      getDealerQuotations, getLeadQuotations,

      // Seed Helper
      seedSampleLeads
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
