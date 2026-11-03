# Mirror Solar Vision CRM &mdash; Role-Based Access Control (RBAC) Matrix

**Project Owner:** Mirror Solar Vision  
**Repository:** `mirrorsolarvision-ctrl/mirrorsolarcrm`  
**Security Framework:** Kernel-Level Cloud Firestore Rules & Cloud Storage Rules  
**Version:** 3.0.0-PROD  
**Date:** November 3, 2026  

---

## 1. Role Profiles & Departmental Responsibilities

| Role Identifier | Department / Specialization | Scope of Responsibility |
|---|---|---|
| **Super Admin** | Executive Management | Master operational authority, user creation, discount approval, dealer allocation sign-off, system configuration, backup execution. |
| **Accounts** | Finance & Audit | Segregation of duties financial authority: Verification of customer advance receipts, bank reconciliation, GST tax invoice generation, payroll disbursement. |
| **Sales Manager** | Sales Leadership | Sales pipeline monitoring, lead reassignment, team SLA leakage oversight, telecaller leaderboard, dealer survey handoff coordination. |
| **Telecaller (Sales)** | Sales Execution | Lead calling desk (35 calls/day), 4-pillar qualification, scheduled follow-up execution, WhatsApp template dispatch, quotation drafting. |
| **PM Surya Ghar Incharge** | Subsidy & DISCOM Ops | Central subsidy management, national portal document verification (Aadhaar, electricity bill), DISCOM net-metering approvals. |
| **Stock Incharge** | Warehousing & Supply Chain | Central warehouse inventory management, SKU intake, dealer stock dispatch, serial number assignment, BOM consumption tracking. |
| **Authorized Dealer** | Regional Execution Partner | Territory-specific site surveys, shadow analysis, rooftop structural verification, local plant installation, warranty servicing. |

---

## 2. Granular Capability & Permission Matrix

| Capability / Action | Super Admin | Accounts | Sales Manager | Telecaller | PM Surya Ghar | Stock Incharge | Regional Dealer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Lead Management** | | | | | | | |
| Create New Lead | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| View Global Leads (All Staff) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Own Assigned Leads Only | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ *(Territory)* |
| Edit Operational Lead Fields | ✅ | ✅ | ✅ | ✅ *(Assigned)* | ❌ | ❌ | ❌ |
| Reassign Lead to Another Rep | ✅ | ❌ | ✅ | ❌ *(Request Only)* | ❌ | ❌ | ❌ |
| Delete Lead Document | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Telecalling & Follow-ups** | | | | | | | |
| Dial & Log Call Record | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Team Call Logs & Connect Rate | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Schedule & Reschedule Follow-up | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **WhatsApp Communication** | | | | | | | |
| Dispatch Pre-Approved Template | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Edit Custom WhatsApp Text | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Outbound Message Trail | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Quotations & Commercials** | | | | | | | |
| Generate Standard Sizing Proposal | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Request Special Commercial Discount | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Approve Commercial Discount** | **✅** | **✅** | **❌** | **❌** | **❌** | **❌** | **❌** |
| Lock & Finalize Quotation Version | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Financials & Payments (Segregation of Duties)** | | | | | | | |
| Submit Customer Advance UTR / Proof | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Verify Customer Payment (Confirm Booking)** | **✅** | **✅** | **❌ (BLOCKED)** | **❌ (BLOCKED)** | **❌** | **❌** | **❌ (BLOCKED)** |
| Access `/leadFinancials` (Margins/Banks) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate GST Tax Invoice | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Access Employee Payroll & Advances | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Dealer Operations & Site Survey** | | | | | | | |
| Request Dealer Site Survey | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Approve Regional Dealer Allocation** | **✅** | **❌** | **❌ (BLOCKED)** | **❌ (BLOCKED)** | **❌** | **❌** | **❌** |
| Submit Site Survey Photos & Report | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View Dealer Commission Ledger | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ *(Own)* |
| **PM Surya Ghar & DISCOM Documentation** | | | | | | | |
| Access `/leadKyc` (Aadhaar & Consumer No) | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Submit DISCOM Net Metering Pack | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Track Central Subsidy Bank Disbursement | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Inventory & Warehousing** | | | | | | | |
| Adjust Central Warehouse Quantities | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Dispatch Stock to Regional Dealer | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Accept Stock Dispatch at Territory Hub | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **System Security & Audit Trail** | | | | | | | |
| View Append-Only Audit Trail | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Fabricate Sensitive Audit Action | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* |
| Modify or Delete Existing Audit Record | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* | ❌ *(DENIED)* |
| Create / Deactivate User Accounts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. Strict Segregation of Duties Rules

1. **Rule of Financial Verification:**
   Under no circumstances can an employee in the Sales Department (Telecaller or Sales Manager) verify a customer payment. Only Accounts or Super Admin can mark a payment as `'Verified'`, which is required before a lead can enter `'Booking Confirmed'`.
2. **Rule of Commercial Discount Approval:**
   Sales representatives may request discounts above the standard ceiling ($> ₹4,000$), but approval authority is locked exclusively to Super Admin or Accounts.
3. **Rule of Dealer Allocation Governance:**
   Sales Managers can coordinate and request site surveys with regional dealers (`dealerStatus: 'Requested'`), but formal dealer contract allocation requires Super Admin approval (`dealerStatus: 'Approved'`).
4. **Rule of Identity & KYC Document Scoping:**
   Private identity numbers (Aadhaar, PAN) are sequestered in `/leadKyc/{leadId}`. Ordinary sales personnel cannot access private customer KYC data.
