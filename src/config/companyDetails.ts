/**
 * ============================================================================
 * LOCKED COMPANY CONFIGURATION & BANK DETAILS
 * ============================================================================
 * Critical Rule:
 * Company Logo, Name, Address, Contact, GSTIN, and Bank Account Details
 * are strictly LOCKED and non-editable in the Quotation Editor.
 * Historical quotation snapshots preserve these for reproducibility.
 */

export interface CompanyDetails {
  name: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  alternatePhone?: string;
  email: string;
  website: string;
  gstin: string;
  panNumber: string;
  cinNumber?: string;
  authorizedSignatory: string;
  designation: string;
  bankDetails: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
    accountType: 'Current' | 'Savings';
    upiId?: string;
  };
  termsAndConditions: string[];
}

export const LOCKED_COMPANY_DETAILS: CompanyDetails = {
  name: "Mirror Solar Vision",
  tagline: "Smart Solar Management & Renewable Energy Solutions",
  address: "Plot No. 42, Green Energy Corridor, Industrial Area",
  city: "Hyderabad",
  state: "Telangana",
  pinCode: "500081",
  phone: "+91 91826 12420",
  alternatePhone: "+91 98765 43210",
  email: "mirrorsolarvision@gmail.com",
  website: "https://crm-webapp-d32bc.web.app",
  gstin: "36AAECM8921R1Z9",
  panNumber: "AAECM8921R",
  cinNumber: "U40106TG2022PTC160000",
  authorizedSignatory: "Managing Director",
  designation: "Authorized Representative",
  bankDetails: {
    accountName: "MIRROR SOLAR VISION",
    bankName: "HDFC Bank",
    accountNumber: "50200081928374",
    ifscCode: "HDFC0001234",
    branch: "HITEC City Branch, Hyderabad",
    accountType: "Current",
    upiId: "mirrorsolar@hdfcbank"
  },
  termsAndConditions: [
    "1. 50% advance payment along with work order confirmation.",
    "2. 40% on material delivery at site before installation commences.",
    "3. 10% on successful commissioning, synchronization & DISCOM grid connection.",
    "4. PM Surya Ghar subsidy processing assistance provided; credit subject to Govt. approvals.",
    "5. Solar panels carry a 25-year performance warranty as per manufacturer standard.",
    "6. Inverter carries a standard 5-year warranty (extendable up to 10 years).",
    "7. Validity of this quotation is 15 calendar days from the date of issue."
  ]
};
