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

## 3. Transactional Audit & Server-Side Generation Verification

During browser UAT, verify that privileged operations generate audit logs directly within the business transaction path rather than relying on uncoordinated client events:

1. **Installation Approval Path**:
   - Trigger `Approve Material / Installation` on a lead.
   - Inspect Firestore collection `auditLogs`:
     - `action`: `MATERIAL_CONSUMPTION`
     - `userId`: Admin UID
     - `userRole`: `Admin`
     - `entityId`: `MTR_INSTALLATION_LEAD-XXX`
     - `beforeValue` & `newValue`: Shows exact stock count change (e.g., Panels: $20 \rightarrow 8$)
     - `timestamp`: Server timestamp ISO string
2. **Negative Forgery Test**:
   - As an Employee or Dealer, open browser DevTools console.
   - Attempt direct write: `setDoc(doc(db, 'auditLogs', 'FAKE_LOG'), { userId: myUid, userRole: 'Dealer', action: 'MATERIAL_CONSUMPTION' })`
   - **Expected Result**: Network request rejected with `FirebaseError: Missing or insufficient permissions.`

---

## 4. Mobile Device GPS Field Testing Matrix

Test the live attendance portal on physical Android and iPhone devices to validate real-world geolocation behaviors:

| Test Scenario | Physical Condition | Expected System Behavior |
|---|---|---|
| **1. Inside Office HQ** | Within 500m of Eluru HQ (`16.7107, 81.0952`) | Punch In: **Allowed** $\rightarrow$ Status: `[ON-SITE: Xm] (±Ym)` |
| **2. Outside Geofence** | > 500m from Eluru Office | Punch In: **Allowed with Flag** $\rightarrow$ Status: `[OUT OF GEOFENCE: Xm] (±Ym)` |
| **3. GPS Disabled** | Location Services toggled OFF on device | Modal / Toast prompt: *"Please enable device GPS / Location access"* $\rightarrow$ Punch blocked |
| **4. Permission Denied** | User clicks "Block" on browser location prompt | Warning banner displayed with step-by-step instructions to re-enable in site settings |
| **5. Poor GPS Accuracy** | Signal accuracy > 150 meters (indoor basement) | Accuracy flagged in record: `(±220m) [LOW ACCURACY]` |
| **6. Employee Correction** | Employee requests time correction on past record | Status: `PENDING` $\rightarrow$ Self-approval blocked in rules $\rightarrow$ Admin approves |

*Note: Verify that `16.7107, 81.0952` accurately matches your office entrance before final sign-off. If required, update the geofence center in Admin Attendance settings.*

---

## 5. Disaster Recovery: Backup & Test-Restore Verification

Before production release, prove that Firestore backups are restorable into a separate test environment:

```bash
# 1. Export Firestore database to Cloud Storage
gcloud firestore export gs://mirrorsolar-crm-backups/pre-vnext-$(date +%Y-%m-%d)

# 2. Verify export metadata file exists in bucket
gsutil ls gs://mirrorsolar-crm-backups/pre-vnext-$(date +%Y-%m-%d)

# 3. Test restoration into isolated test project (e.g. crm-test-staging)
gcloud firestore import gs://mirrorsolar-crm-backups/pre-vnext-$(date +%Y-%m-%d) --project=crm-test-staging
```

**Verification Checklist in Test Project:**
- [x] `users`: All dealer, admin, and employee credentials and roles intact.
- [x] `leads`: Customer records, stages, and assigned dealers preserved.
- [x] `quotations`: Complete version history (V1, V2), subsidy snapshots, and financials preserved.
- [x] `dealerStock` & `materialConsumptions`: Exact inventory counts match pre-export state.
- [x] `auditLogs`: Append-only historical log unbroken.

---

## 6. Release Gate Pipeline & Semantic Versioning

Follow this strict progression from development branch to production release:

```
┌────────────────────────────────────────────────────────┐
│                   VNEXT RELEASE GATE                   │
└────────────────────────────────────────────────────────┘
                           │
           feature/crm-vnext-commercial-workflow
                           │
                           ▼
             [Automated QA Suite: 30/30 PASS]
                           │
                           ▼
             [Clean Build: 0 Errors / 597ms]
                           │
                           ▼
            [Staging Deployment & 5-Persona UAT]
                           │
                           ▼
             [Security & Backup Restore Verified]
                           │
                           ▼
                  [Formal UAT Sign-Off]
                           │
                           ▼
                   git checkout main
              git merge feature/... --no-ff
                           │
                           ▼
                  [Production Deploy]
                           │
                           ▼
              [10-Point Post-Deploy Smoke Test]
                           │
                           ▼
             git tag -a v2.0.0-commercial-vnext
```

---

## 7. 10-Point Post-Deployment Production Smoke Test

Immediately upon deploying to production, verify all critical operational paths before opening the system to general staff:

- [ ] **1. Admin Authentication**: Log in as Admin $\rightarrow$ Verify dashboard metrics, user directory, and stock overview load.
- [ ] **2. Employee Authentication**: Log in as Field Employee $\rightarrow$ Verify assigned leads and attendance portal load.
- [ ] **3. Dealer Authentication**: Log in as Dealer $\rightarrow$ Verify dealer stock balance and dealer quotation portal load.
- [ ] **4. Lead Lifecycle**: Create new test lead in Marketing Portal $\rightarrow$ Assign to Dealer $\rightarrow$ Verify lead appears in Dealer queue.
- [ ] **5. Draft Quotation Generation**: Create 3kW residential proposal $\rightarrow$ Verify PMSGY-2024 ₹78,000 subsidy applies.
- [ ] **6. Quotation Amendment**: Amend quotation to V2 $\rightarrow$ Verify V1 is locked and side-by-side diff modal functions.
- [ ] **7. Quotation Acceptance**: Mark V2 as `Accepted` $\rightarrow$ Verify status updates across all connected sessions.
- [ ] **8. Inventory BOM Deduction**: Approve installation $\rightarrow$ Verify exact V2 panel/inverter quantities deduct from dealer stock.
- [ ] **9. Transactional Audit Generation**: Verify audit log records `MATERIAL_CONSUMPTION` with Admin actor and timestamp.
- [ ] **10. Attendance Punch**: Perform GPS punch-in $\rightarrow$ Verify live timer starts and location accuracy is logged.

---

## 8. Staging-to-Main Merge & Deployment Commands

Once all UAT criteria and smoke tests are confirmed:

```bash
# 1. Sync and checkout main
git checkout main
git pull origin main

# 2. Merge feature branch cleanly
git merge feature/crm-vnext-commercial-workflow --no-ff -m "feat: release Solar CRM VNext Commercial Workflow (v2.0.0)"

# 3. Push to production repository
git push origin main

# 4. Deploy production hosting and security rules
firebase deploy

# 5. Tag production release
git tag -a v2.0.0-commercial-vnext -m "Production Release v2.0.0: Commercial Workflow, Bill-Book Quotations, Inventory Hardening, Live Attendance"
git push origin v2.0.0-commercial-vnext
```

