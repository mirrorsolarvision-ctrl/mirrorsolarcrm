# Mirror Solar Vision CRM &mdash; Known Issues, Defects & Technical Debt Register

**Project Owner:** Mirror Solar Vision  
**Repository:** `mirrorsolarvision-ctrl/mirrorsolarcrm`  
**Quality Authority:** ChatGPT & Antigravity Engineering  
**Version:** 3.0.0-PROD  
**Date:** November 3, 2026  

---

## 1. Executive Summary

This register documents actual implementation defects, architectural gaps, and technical debt identified during the element-by-element inspection of the codebase. Every item is prioritized, mapped to its root cause, and scheduled for resolution in its respective roadmap phase.

---

## 2. Active Defect Register

| Defect ID | Component / File | Severity | Root Cause & Description | Impact | Target Phase |
|---|---|:---:|---|---|:---:|
| **DEF-001** | `CRMContext.tsx` (`addCallLog`) | **HIGH** | `addCallLog` updates local state and writes an entry to `/activities`, but **does not persist the call record to Firestore `/call_leads`**. | Call logs reset to mock defaults if browser cache is cleared or when switching devices. Disaster recovery reports `call_leads: 0 docs`. | **Phase 2** (Task 2.1) |
| **DEF-002** | `SalesBookingsView.tsx` (Line 108) | **HIGH** | The frontend payment verification handler checks `if (!isAdmin)` rather than `if (!isAdmin && !isAccounts)`. | Users in the **Accounts** department cannot verify customer advance payments from the Sales Bookings workbench, violating segregation of duties. | **Phase 2** (Task 2.1) |
| **DEF-003** | `CustomerDocumentsView.tsx` (Line 60) | **MEDIUM** | Upload handler accepts a manual file name string and appends a mock document with `fileUrl: ''` instead of invoking Firebase Storage SDK. | Uploaded documents are not stored in Cloud Storage from this view; downloads fail because `fileUrl` is empty. | **Phase 2** (Task 2.1) |
| **DEF-004** | `SalesDealerCoordinationView.tsx` | **MEDIUM** | When a dealer is selected for site survey, the form updates `dealer` and `dealerId`, but does not set `dealerStatus: 'Requested'`. | Regional dealers do not receive a formal acceptance notification in their dealer portal workflow. | **Phase 2** (Task 2.2) |
| **DEF-005** | `LeadsPage.tsx` / `vite.config.ts` | **LOW** | `dist/assets/LeadsPage-*.js` bundle size is 614.97 kB minified, exceeding the 500 kB chunk warning threshold. | Slower initial asset download on 3G mobile connections. Needs `React.lazy()` code splitting. | **Phase 2** (Task 2.4) |
| **DEF-006** | `WhatsAppCentreView.tsx` | **MEDIUM** | Operates via `wa.me` browser deep links rather than automated server-to-server Meta Cloud API. | Requires sales staff to manually click "Send" in WhatsApp Web; incoming customer replies are not captured automatically. | **Phase 2** (Task 2.3) |
| **DEF-007** | Lead Distribution Architecture | **MEDIUM** | Lead distribution is currently manual (Sales Manager assigns telecallers from a dropdown). | Leads can sit in "New Lead" inbox unassigned if the Sales Manager is away. | **Phase 2** (Task 2.1) |
| **DEF-008** | SLA Breach Escalation | **LOW** | 15-minute SLA timer is calculated on render in the client browser, not enforced by a persistent backend cron worker. | If no user opens the CRM, SLA breach alerts are not dispatched via SMS/Email to management. | **Phase 2** (Task 2.4) |

---

## 3. Prioritized Resolution Plan

1. **Immediate Quick Fixes (Phase 2 &mdash; Task 2.1):**
   - **Fix DEF-001:** Add `setDoc(doc(db, 'call_leads', newLog.id), newLog)` to `addCallLog` in `CRMContext.tsx`.
   - **Fix DEF-002:** Update `handleVerifyPayment` in `SalesBookingsView.tsx` to `const canVerify = isAdmin || currentUser?.role === 'Accounts' || currentUser?.employeeCategory === 'Accounts'`.
   - **Fix DEF-003:** Connect `CustomerDocumentsView.tsx` to `DocumentUploadModal.tsx` for real Firebase Storage file uploads with download URLs.
   - **Fix DEF-004:** Ensure `dealerStatus: 'Requested'` is passed in `updateLead` during site survey scheduling.

2. **Automated Infrastructure (Phase 2 &mdash; Tasks 2.2 - 2.4):**
   - Deploy Meta WhatsApp Cloud API webhooks.
   - Implement automated round-robin lead distribution engine.
   - Code-split `LeadsPage` with `React.lazy()`.
