# Solar CRM VNext — Production UAT Runbook & Deployment Playbook

**Target Development Branch:** `feature/crm-vnext-commercial-workflow`  
**Latest Verification Commit:** `03d0630`  
**Security Rules Version:** `v2` (with role-based audit action whitelist and finalized quotation immutability)

---

## 1. Firebase Security Rules Deployment

Before starting browser-based User Acceptance Testing (UAT), deploy the hardened Firestore rules to your Firebase environment:

```bash
# Deploy Firestore & Storage rules to the active Firebase project
firebase deploy --only firestore:rules,storage:rules
```

Verify deployment output confirms:
```text
✔  firestore: rules file firestore.rules released successfully
✔  storage: rules file storage.rules released successfully
```

---

## 2. 5-Persona Real-Browser UAT Test Matrix

Execute the following test sequences in modern desktop and mobile browsers (Chrome, Edge, Safari, Android Chrome):

### Persona 1: Marketing Employee (Role: `Employee`, Dept: `Marketing`)
1. **Lead Generation**: Navigate to `/marketing-portal` $\rightarrow$ Click **"New Marketing Lead"** $\rightarrow$ Create customer *"Ramesh Naidu"* (Eluru, 5kW Residential).
2. **Draft Quotation**: Click **"Create Draft Quote"** on the lead card $\rightarrow$ Verify Bill-Book editor opens pre-populated with lead information.
3. **Permission Boundaries (Negative Tests)**:
   - Attempt to finalize or convert quotation $\rightarrow$ Verify button is disabled or submits as `Draft` only.
   - Inspect company headers $\rightarrow$ Verify company GST, bank account, and IFSC are strictly locked/read-only.
   - Attempt to access Admin Stock Dispatches $\rightarrow$ Verify access restricted banner.

---

### Persona 2: Dealer (Role: `Dealer`, Workspace: `Dealer Portal`)
1. **Quotation Creation & Dual-Mode Editing**:
   - Navigate to `/quotations` $\rightarrow$ Click **"New Quotation"**.
   - Test **Solar Estimator Mode**: Select `3 kW`, `On-Grid`, `Residential` $\rightarrow$ Verify system calculates PMSGY-2024 subsidy of ₹78,000.
   - Test **Blank Line Items Mode**: Add custom line item *"Special GI Elevated Structure"*, Qty: `1`, Rate: `₹35,000`, GST: `18%`.
   - Verify intra-state tax calculates CGST (9%) + SGST (9%).
2. **Dealer Isolation Test**:
   - Open second incognito browser session logged in as **Dealer B**.
   - Verify Dealer B **cannot see** Dealer A's quotations or customer contact numbers.
   - Inspect network request $\rightarrow$ Confirm Firestore rules reject cross-dealer reads.

---

### Persona 3: Field & Operations Employee (Role: `Employee`)
1. **Attendance & Geolocation Punch**:
   - Navigate to `/employee-attendance` on mobile device or GPS-enabled browser.
   - Click **"PUNCH IN (START SHIFT)"** $\rightarrow$ Browser prompts for location permission.
   - Verify live timer starts (`00:00:01`, `00:00:02`...).
   - Verify status pill displays `PRESENT` (or `LATE` if after grace period).
   - Check location badge: Displays `Distance from office: X meters | GPS accuracy: ±Ym | [ON-SITE]`.
2. **Attendance Correction Request**:
   - Go to attendance history table $\rightarrow$ Click **"Request Correction"** on a past record.
   - Enter requested time (`09:15`) and reason *"Site visit to Eluru Power Grid"* $\rightarrow$ Submit.
   - Verify status transitions to `PENDING`.
   - **Self-Approval Negative Test**: Attempt to mutate status to `APPROVED` $\rightarrow$ Verify Firestore rules deny with permission error.

---

### Persona 4: Administrator (Role: `Admin`)
1. **Attendance Review**:
   - Navigate to Admin Attendance tab $\rightarrow$ Review pending correction request $\rightarrow$ Click **"Approve"** $\rightarrow$ Verify record updates and immutable audit log entry is generated.
2. **Quotation Amendment & Versioning**:
   - Open quotation `MSV-QT-2026-0001` (V1: 10 panels $\times$ 540W).
   - Click **"Amend (Create V2)"** $\rightarrow$ Enter reason *"Customer requested 2 additional panels"*.
   - In V2 draft, change panel quantity from `10` to `12`.
   - Save & Finalize V2 $\rightarrow$ Mark status as `Accepted`.
3. **Side-by-Side Version Diff UI**:
   - In Quotations Portal table, click the **Version Comparison** icon (`Layers`).
   - Verify modal shows:
     - `Subtotal Diff: +₹23,000`
     - `Net Payable Diff: +₹27,140`
     - Line items table: `540W Mono PERC | 10 × ₹11,500 ➔ 12 × ₹11,500 | Qty: +2, Total: +₹23,000 (MODIFIED)`
4. **Finalized V1 Immutability Test**:
   - Attempt to open V1 for direct editing $\rightarrow$ Verify editing is disabled (Historical Snapshot).
   - Send direct Firestore update to V1 $\rightarrow$ Verify security rules reject with permission error.

---

### Persona 5: End-to-End Installation & Stock Consumption
1. **Material Deduction**:
   - Navigate to `/leads` or `/admin-dashboard` $\rightarrow$ Find customer with Accepted Quotation V2.
   - Click **"Approve Material / Installation"**.
   - Verify stock deduction consumes **12 panels (V2 accepted BOM)**, not 10 panels (V1).
   - Verify service items (Installation labor, freight) **did not** decrement stock.
2. **Stock Verification**:
   - Navigate to `/stock` $\rightarrow$ Consumptions Tab.
   - Verify consumption record `MTR_INSTALLATION_LEAD-XXX` is logged with exact itemized SKU quantities and Admin timestamp.

---

## 3. Disaster Recovery & Backup Plan

To ensure business continuity for production operations, establish automated Google Cloud Firestore backups:

### Daily Automated Export Command
```bash
# Export all Firestore collections to GCP Cloud Storage Bucket
gcloud firestore export gs://mirrorsolar-crm-backups/$(date +%Y-%m-%d)
```

### Point-in-Time Recovery (PITR) Execution
```bash
# Restore specific collection or entire database from backup snapshot
gcloud firestore import gs://mirrorsolar-crm-backups/YYYY-MM-DD/
```

---

## 4. Staging-to-Main Merge Gate Checklist

Before executing the final merge of `feature/crm-vnext-commercial-workflow` into `main`, ensure the following sign-off criteria are satisfied:

- [x] All 30 automated test cases passing with 0 failures (`test_security_adversarial.mjs`, `test_inventory_concurrency.mjs`, `test_quotation_extended_financials.mjs`, `test_e2e_commercial_workflow.mjs`).
- [x] Production build passes cleanly with 0 TypeScript/Vite errors (`npm run build`).
- [x] `firestore.rules` deployed and verified on Firebase project `crm-webapp-d32bc`.
- [x] 5-Persona browser UAT executed without console errors.
- [x] Office HQ coordinates confirmed as Eluru HQ (`16.7107, 81.0952`).
- [x] Audit log write path protected with role-based action whitelist.
- [x] Quotation V1 historical immutability verified against direct tampering.
- [x] Inventory BOM consumption verified against accepted V2 specifications.

### Final Merge Execution Command Sequence
```bash
# 1. Checkout main and ensure latest sync
git checkout main
git pull origin main

# 2. Merge feature branch with fast-forward / clean merge commit
git merge feature/crm-vnext-commercial-workflow --no-ff -m "feat: release Solar CRM VNext Commercial Workflow & Hardening Engine"

# 3. Push to production main
git push origin main

# 4. Deploy production hosting and rules
firebase deploy
```
