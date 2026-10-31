import * as XLSX from 'xlsx';
import type { MockLead, Stage, LeadPriority } from '../context/CRMContext';
import type { LeadScoreBreakdown, SlaStatus, FinancingType } from '../types/sales';
import { toE164Phone, findDuplicateLeadByPhone, calculateLeadScore } from './salesCalculations';
import { formatCustomerCode } from './idUtils';

export interface ParsedExcelLead {
  tempId: string;
  customer: string;
  phone: string;
  rawPhone: string;
  email: string;
  location: string;
  monthlyBill: number;
  sanctionedLoad: number;
  requiredKw: number;
  source: string;
  financingType: FinancingType;
  assignedEmployee: string;
  dealer: string;
  notes: string;
  leadScore: LeadScoreBreakdown;
  leadPriority: LeadPriority;
  isDuplicate: boolean;
  duplicateWith?: { id?: string; customer?: string; stage?: string };
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

/**
 * Standard column headers for lead export
 */
export const LEAD_EXPORT_HEADERS = [
  'Customer ID',
  'Customer Name',
  'Phone Number',
  'Email',
  'Location / City',
  'Pipeline Stage',
  'Sales Funnel Stage',
  'Lead Score',
  'Priority',
  'Lead Source',
  'Assigned Employee',
  'Assigned Dealer',
  'Work Status',
  'System Capacity (kW)',
  'Monthly Bill (Rs)',
  'Sanctioned Load (kW)',
  'Financing Type',
  'Total Project Cost (Rs)',
  'Follow-up Date',
  'Follow-up Time',
  'Follow-up Status',
  'Created Date',
  'Last Updated',
  'Notes'
];

/**
 * Exports leads list to an Excel (.xlsx) or CSV file with auto-fitted column widths
 */
export function exportLeadsToSpreadsheet(
  leads: MockLead[],
  filenamePrefix = 'MirrorSolar_Leads',
  format: 'xlsx' | 'csv' = 'xlsx'
): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const finalFileName = `${filenamePrefix}_${dateStr}.${format}`;

  const rows = leads.map(lead => ({
    'Customer ID': formatCustomerCode(lead),
    'Customer Name': lead.customer || '',
    'Phone Number': lead.phone || '',
    'Email': lead.email || '',
    'Location / City': lead.location || '',
    'Pipeline Stage': lead.stage || 'Lead',
    'Sales Funnel Stage': lead.salesStage || 'New Lead',
    'Lead Score': lead.leadScore ? `${lead.leadScore.total} (${lead.leadScore.category})` : '',
    'Priority': lead.priority || 'Medium',
    'Lead Source': lead.source || 'Direct',
    'Assigned Employee': lead.assignedEmployee || 'Unassigned',
    'Assigned Dealer': lead.dealer || 'Direct (Company)',
    'Work Status': lead.workStatus || 'Not Started',
    'System Capacity (kW)': lead.dealerSpecifications?.systemCapacityKw || '',
    'Monthly Bill (Rs)': '',
    'Sanctioned Load (kW)': '',
    'Financing Type': lead.financingType || 'Self-Funded (Direct Payment)',
    'Total Project Cost (Rs)': lead.payments?.totalProjectCost || lead.payments?.totalAgreedAmount || '',
    'Follow-up Date': lead.followUp?.date || '',
    'Follow-up Time': lead.followUp?.time || '',
    'Follow-up Status': lead.followUp?.status || '',
    'Created Date': lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '',
    'Last Updated': lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString() : '',
    'Notes': (lead.notes || '').replace(/[\r\n]+/g, ' ')
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: LEAD_EXPORT_HEADERS });

  // Compute column widths for high-quality Excel presentation
  const colWidths = LEAD_EXPORT_HEADERS.map(header => {
    let maxLen = header.length;
    rows.forEach(row => {
      const val = String((row as Record<string, any>)[header] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Pipeline');

  XLSX.writeFile(workbook, finalFileName, { bookType: format });
}

/**
 * Downloads a pre-formatted blank template with sample rows for data entry
 */
export function downloadLeadTemplate(format: 'xlsx' | 'csv' = 'xlsx'): void {
  const sampleRows = [
    {
      'Customer Name': 'Ramesh Kumar',
      'Phone Number': '9876543210',
      'Email': 'ramesh.kumar@example.com',
      'Location / City': 'Coimbatore',
      'Monthly Bill (Rs)': 6500,
      'Sanctioned Load (kW)': 5,
      'Required System (kW)': 5,
      'Lead Source': 'Meta Ads',
      'Financing Type': 'Bank Loan (JanSamarth)',
      'Assigned Employee': 'Kumari',
      'Dealer': 'Direct (Company)',
      'Notes': 'Interested in PM Surya Ghar rooftop solar. Has 500 sqft shadow-free RCC roof.'
    },
    {
      'Customer Name': 'Anand Solar Industries',
      'Phone Number': '9443322110',
      'Email': 'anand@industries.in',
      'Location / City': 'Tiruppur',
      'Monthly Bill (Rs)': 28000,
      'Sanctioned Load (kW)': 25,
      'Required System (kW)': 20,
      'Lead Source': 'Google Ads',
      'Financing Type': 'Self-Funded (Direct Payment)',
      'Assigned Employee': '',
      'Dealer': 'Direct (Company)',
      'Notes': 'Commercial unit seeking 20kW on-grid solar plant.'
    }
  ];

  const headers = Object.keys(sampleRows[0]);
  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });

  worksheet['!cols'] = [
    { wch: 24 }, // Customer Name
    { wch: 16 }, // Phone Number
    { wch: 25 }, // Email
    { wch: 18 }, // Location / City
    { wch: 18 }, // Monthly Bill (Rs)
    { wch: 22 }, // Sanctioned Load (kW)
    { wch: 22 }, // Required System (kW)
    { wch: 16 }, // Lead Source
    { wch: 25 }, // Financing Type
    { wch: 20 }, // Assigned Employee
    { wch: 20 }, // Dealer
    { wch: 45 }  // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Template');

  const fileName = `MirrorSolar_Leads_Template.${format}`;
  XLSX.writeFile(workbook, fileName, { bookType: format });
}

/**
 * Normalizes field key to match known properties
 */
function normalizeKey(rawKey: string): string {
  return rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file into validated lead rows
 */
export async function parseSpreadsheetFile(
  file: File,
  existingLeads: MockLead[]
): Promise<ParsedExcelLead[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Spreadsheet has no sheets.');
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: ''
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('Spreadsheet contains no data rows.');
  }

  const parsedResults: ParsedExcelLead[] = [];

  rawRows.forEach((row, index) => {
    // Map normalized keys
    const rowMap = new Map<string, any>();
    Object.entries(row).forEach(([k, v]) => {
      rowMap.set(normalizeKey(k), v);
    });

    const getVal = (...keys: string[]): any => {
      for (const k of keys) {
        const norm = normalizeKey(k);
        if (rowMap.has(norm)) {
          const val = rowMap.get(norm);
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return val;
          }
        }
      }
      return '';
    };

    const customer = String(getVal('customername', 'customer', 'name', 'clientname', 'client') || '').trim();
    const rawPhone = String(getVal('phonenumber', 'phone', 'mobile', 'mobilenumber', 'contact', 'contactnumber') || '').trim();
    const email = String(getVal('email', 'emailid', 'emailaddress') || '').trim();
    const location = String(getVal('location', 'city', 'address', 'area', 'district') || '').trim();
    
    const monthlyBillRaw = getVal('monthlybill', 'monthlybillrs', 'bill', 'ebbill', 'electricitybill');
    const monthlyBill = Number(String(monthlyBillRaw).replace(/[^0-9.]/g, '')) || 0;

    const sanctionedLoadRaw = getVal('sanctionedload', 'sanctionedloadkw', 'load', 'connectedload');
    const sanctionedLoad = Number(String(sanctionedLoadRaw).replace(/[^0-9.]/g, '')) || 0;

    const requiredKwRaw = getVal('requiredsystem', 'requiredsystemkw', 'requiredkw', 'kw', 'capacity', 'systemcapacity');
    const requiredKw = Number(String(requiredKwRaw).replace(/[^0-9.]/g, '')) || (sanctionedLoad > 0 ? sanctionedLoad : 3);

    const sourceRaw = String(getVal('leadsource', 'source', 'campaign', 'channel') || '').trim();
    const source = sourceRaw || 'Excel Import';

    const financingRaw = String(getVal('financingtype', 'financing', 'type') || '').trim().toLowerCase();
    let financingType: FinancingType = 'Self-Funded (Direct Payment)';
    if (financingRaw.includes('loan') || financingRaw.includes('bank') || financingRaw.includes('jansamarth')) {
      financingType = 'Bank Loan (JanSamarth)';
    }

    const assignedEmployee = String(getVal('assignedemployee', 'employee', 'salesrep', 'owner') || '').trim();
    const dealer = String(getVal('dealer', 'dealername', 'partner') || 'Direct (Company)').trim();
    const notes = String(getVal('notes', 'remarks', 'comments', 'description') || '').trim();

    // Validations & E.164 phone formatting
    const validationErrors: string[] = [];
    if (!customer) {
      validationErrors.push('Missing customer name');
    }

    let phone = rawPhone;
    if (!rawPhone) {
      validationErrors.push('Missing phone number');
    } else {
      const e164 = toE164Phone(rawPhone);
      if (!e164) {
        validationErrors.push(`Invalid phone format: "${rawPhone}"`);
      } else {
        phone = e164;
      }
    }

    // Duplicate detection against current CRM leads
    const duplicateCheck = phone 
      ? findDuplicateLeadByPhone(existingLeads, phone) 
      : { hasDuplicate: false, normalizedPhone: phone };
    const isDuplicate = duplicateCheck.hasDuplicate;

    // Lead Scoring
    const leadScoreBreakdown = calculateLeadScore({
      monthlyBill,
      monthlyUnitsKwh: monthlyBill > 0 ? Math.round(monthlyBill / 7.5) : (requiredKw * 120),
      roofOwnership: 'Own',
      roofType: 'RCC',
      shadingStatus: 'No',
      purchaseTimeline: 'Within 7 Days',
      decisionMaker: true,
      financingRequirement: financingType === 'Bank Loan (JanSamarth)' ? 'Bank Loan' : 'Self-Funded'
    });

    const leadPriority: LeadPriority = leadScoreBreakdown.category === 'Hot' ? 'High' : leadScoreBreakdown.category === 'Warm' ? 'Medium' : 'Low';
    const isValid = validationErrors.length === 0;

    parsedResults.push({
      tempId: `IMP_${Date.now()}_${index}`,
      customer,
      phone,
      rawPhone,
      email,
      location,
      monthlyBill,
      sanctionedLoad,
      requiredKw,
      source,
      financingType,
      assignedEmployee,
      dealer: dealer || 'Direct (Company)',
      notes,
      leadScore: leadScoreBreakdown,
      leadPriority,
      isDuplicate,
      duplicateWith: duplicateCheck.hasDuplicate ? {
        id: duplicateCheck.matchingLeadId,
        customer: duplicateCheck.customerName,
        stage: duplicateCheck.salesStage
      } : undefined,
      isValid,
      validationError: validationErrors.join(', '),
      selected: isValid && !isDuplicate
    });
  });

  return parsedResults;
}

/**
 * Builds standard MockLead payload from a parsed spreadsheet row
 */
export function buildLeadFromParsedExcel(
  parsed: ParsedExcelLead,
  currentUser?: { id?: string; name?: string; role?: string }
): Partial<MockLead> {
  const now = new Date().toISOString();
  
  return {
    customer: parsed.customer,
    phone: parsed.phone,
    email: parsed.email,
    location: parsed.location,
    dealer: parsed.dealer || 'Direct (Company)',
    assignedEmployee: parsed.assignedEmployee || '',
    stage: 'Lead' as Stage,
    salesStage: 'New Lead',
    priority: parsed.leadPriority,
    leadScore: parsed.leadScore,
    source: parsed.source,
    financingType: parsed.financingType,
    slaStatus: 'Pending First Call' as SlaStatus,
    followUp: {
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '11:00',
      type: 'Call',
      status: 'Upcoming'
    },
    archived: false,
    notes: parsed.notes ? `[Excel Import ${now.split('T')[0]}]: ${parsed.notes}` : `Imported via spreadsheet on ${now.split('T')[0]}`,
    dealerSpecifications: {
      systemCapacityKw: `${parsed.requiredKw} kW`,
      phase: parsed.requiredKw > 5 ? '3 Phase' : '1 Phase'
    },
    createdBy: currentUser?.id || 'import',
    createdByName: currentUser?.name || 'Excel Importer',
    createdByRole: currentUser?.role || 'Admin',
    leadType: 'project',
    documents: [],
    projectUpdates: [
      {
        id: `UPD_${Date.now()}`,
        description: `Lead created from spreadsheet import (${parsed.source})`,
        status: 'Not Started',
        updatedByUserId: currentUser?.id || 'sys',
        updatedByRole: currentUser?.role || 'Admin',
        updatedAt: now
      }
    ]
  };
}
