# Mirror Solar Vision CRM — Production Release 1.0 Specification
**Target Release Date**: November 6, 2026  
**System Architecture**: React 19 + TypeScript + Vite + Firebase (Authentication, Firestore, Cloud Storage, Cloud Functions)  
**Production URLs**:
- Primary Custom Domain: [https://crm.mirrorsolarvision.com](https://crm.mirrorsolarvision.com)
- Default Firebase Hosting: [https://crm-webapp-d32bc.web.app](https://crm-webapp-d32bc.web.app)
- Secondary Firebase Hosting: [https://crm-webapp-d32bc.firebaseapp.com](https://crm-webapp-d32bc.firebaseapp.com)

---

## 1. Executive Release Overview

Mirror Solar Vision CRM Release 1.0 provides an enterprise digital operating system for solar rooftop lead lifecycle management, PM Surya Ghar subsidy coordination, field dealer allocations, dual-custody advance payment verification, inventory tracking, and project installation handoffs.

### Key Milestones Achieved for 1.0 Release:
- **12 Fully Functional Core Modules**: Spanning lead creation, telecalling, dealer coordination, technical site surveys, automated quotation generation, accounting verification, and stock management.
- **Strict Role-Based Access Control (RBAC)**: 6 distinct enterprise roles with server-side Firestore and Storage rule enforcement.
- **Dual-Custody Financial Gate**: Advances must be verified by independent Accounts or Admin authority before project booking confirmation. Direct API bypass attempts are rejected server-side.
- **Zero-Knowledge KYC Partitioning**: Customer sensitive identity documents (Aadhaar, electricity bills) are stored in isolated partitions strictly inaccessible to authorized dealers.
- **Immutable Audit Trail**: Positive whitelist-governed audit logging (`/auditLogs`) with absolute update/delete restrictions.

---

## 2. Core Functional Modules (1 to 12)

| Module ID | Module Name | Primary Role(s) | Operational Scope & Capabilities |
| :--- | :--- | :--- | :--- |
| **MOD-01** | **Executive Dashboard & KPIs** | Super Admin, Admin | Real-time lead funnel analytics, monthly kilowatt pipeline, conversion velocity, revenue metrics, dealer coverage maps. |
| **MOD-02** | **Lead Lifecycle Management** | All Roles (Scoped) | 11-stage progressive sales pipeline from initial inquiry to final installation handoff with stage transition validations. |
| **MOD-03** | **Telecalling Desk & Call Log** | Telecaller, Sales Manager | Integrated calling interface, deduplicated call logs, follow-up scheduling, 4-pillar qualification (Sanctioned Load, Roof, Bill, Capacity). |
| **MOD-04** | **Sales Coordination Desk** | Sales Manager, Admin | Territory lead triage, telecaller team oversight, qualification sign-off, dealer survey requests, commercial quotation reviews. |
| **MOD-05** | **Dealer Coordination Desk** | Sales Manager, Admin | Regional dealership assignment, survey scheduling, installation territory allocation, SLA tracking. |
| **MOD-06** | **Dealer Field Survey Portal** | Authorized Dealer | Mobile-responsive field inspection portal, roof azimuth & shadow audit, physical site photos, structural feasibility submission. |
| **MOD-07** | **Quotation & Subsidy Engine** | Sales Manager, Admin | Real-time pricing calculator for 1kW–10kW On-Grid/Hybrid systems, PM Surya Ghar central subsidy deductions (up to ₹78,000), PDF generation. |
| **MOD-08** | **Advance Token & Payment Intake** | Telecaller, Sales Staff | Customer advance token intake (UTR, NEFT, Cheque, Cash), payment receipt image upload, status tagged as "Pending Verification". |
| **MOD-09** | **Accounts Verification Desk** | Accounts, Super Admin | Bank ledger reconciliation, anti-self-approval enforcement (recorder cannot verify own payment), formal verification timestamping. |
| **MOD-10** | **Booking Confirmation & Handoff**| Sales Manager, Super Admin | Automatic transition to "Booking Confirmed" upon payment verification; installation package dispatched to assigned dealer. |
| **MOD-11** | **Inventory & Stock Management** | Stock Incharge, Admin | Solar PV module serial tracking, inverter warehouse receipts, dispatch logs, low-stock threshold alerts. |
| **MOD-12** | **Attendance, Payroll & Staff** | Admin, HR | Biometric/app clock-in, daily EOD reports, monthly salary calculations, dealer incentive tiers. |

---

## 3. Role & Permission Governance Matrix

| Capability / Resource | Super Admin | Admin | Accounts | Sales Manager | Telecaller | Authorized Dealer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Global Pipeline Visibility** | Full | Full | Read (Finance) | Team Only | Own Leads | Assigned Leads |
| **Create New Customer Lead** | Yes | Yes | No | Yes | Yes | No |
| **Telecaller Lead Assignment** | Yes | Yes | No | Yes | No | No |
| **Submit Call Notes & Logs** | Yes | Yes | No | Yes | Yes (Own UID) | No |
| **Request Dealer Allocation** | Yes | Yes | No | Yes | No | No |
| **Approve Dealer Allocation** | **Yes** | **Yes** | No | **Blocked** | No | No |
| **Upload Site Survey Photos** | Yes | Yes | No | No | No | **Yes (Assigned)** |
| **Generate Formal Quotation** | Yes | Yes | No | Yes | No | No |
| **Record Advance Token Proof** | Yes | Yes | No | Yes | Yes | No |
| **Verify Customer Payment** | **Yes** | **Yes** | **Yes** | **Blocked** | **Blocked** | **Blocked** |
| **Self-Verify Own Payment** | Blocked | Blocked | **Blocked** | Blocked | Blocked | Blocked |
| **Confirm Project Booking** | Yes | Yes | Post-Verification | Post-Verification | Blocked | Blocked |
| **Access Sensitive KYC (Aadhaar)**| Yes | Yes | Audit Only | PM Surya Ghar Only| Assigned Only | **STRICTLY DENIED** |
| **System Settings & User Admin**| **Yes** | Yes | No | No | No | No |

---

## 4. Security & Compliance Invariants

1. **Dual Custody Payment Verification**:
   - Telecallers and Sales Managers can never mark a payment as `Verified`.
   - The system strictly enforces `paymentVerificationStatus == 'Verified'` before advancing to `Booking Confirmed`.
   - Accounts officers cannot verify payments they personally recorded (Anti-Self-Approval).
2. **Server-Side Enforcement**:
   - Direct Firestore client SDK tampering is defeated by server-side rules in `firestore.rules`.
   - `storage.rules` enforces 15MB file size ceilings and whitelists image/jpeg, image/png, image/webp, and application/pdf.
3. **Immutability of Audit Records**:
   - `/auditLogs` has `allow update, delete: if false;`.
   - Write operations enforce a strict positive action whitelist by role.
4. **Session Termination**:
   - `validSince` epoch timestamps in Firebase Authentication invalidate active refresh tokens upon administrative password rotation.
   - Frontend `AuthContext.tsx` purges `localStorage` session cache whenever Firebase Auth returns a null user or revoked token.

---

## 5. Verification & Test Evidence Summary

- **TypeScript Compilation**: `npx tsc -b` passes with **0 errors**.
- **Production Build**: `npm run build` generates production bundle in **833ms**.
- **Automated Test Matrix**:
  - `npm run test:security`: 23 / 23 Passed
  - `npm run test:penetration`: 16 / 16 Passed
  - `npm run test:phase2_1`: 46 / 46 Passed
  - `npm run test:gate2_1_r`: 39 / 39 Passed
  - `npm run test:acceptance`: 48 / 48 Passed
  - Google Cloud Official Rules Engine (`tests/official_rules_engine_verification.mjs`): 19 / 19 Passed
  - **Grand Total: 191 automated test validations passed**.
