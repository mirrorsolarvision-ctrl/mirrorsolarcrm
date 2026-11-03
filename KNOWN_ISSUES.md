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

| Defect ID | Component / File | Severity | Root Cause & Description | Status | Resolved In |
|---|---|:---:|---|:---:|:---:|
| **DEF-001** | `CRMContext.tsx` (`addCallLog`) | **HIGH** | `addCallLog` previously updated local state without saving to `/call_leads`. | **RESOLVED & TESTED** | Phase 2.1 (Added `/call_leads` listener, Firestore `setDoc`, deduplication, and lead association) |
| **DEF-002** | `SalesBookingsView.tsx` (Line 108) | **HIGH** | Payment verification handler previously checked `if (!isAdmin)` locking out Accounts. | **RESOLVED & TESTED** | Phase 2.1 (Expanded to `canVerifyPayment = isAdmin \|\| isAccounts`, anti-self-approval gate) |
| **DEF-003** | `CustomerDocumentsView.tsx` | **MEDIUM** | Upload handler accepted a text string with `fileUrl: ''` without Cloud Storage upload. | **RESOLVED & TESTED** | Phase 2.1 (Connected to `DocumentUploadModal` & `uploadFileToStorage`, 15MB limit, view/download links) |
| **DEF-004** | `SalesDealerCoordinationView.tsx` | **MEDIUM** | When a dealer was selected for survey, `dealerStatus: 'Requested'` was not set. | **RESOLVED & TESTED** | Phase 2.1 (Explicitly passes `dealerStatus: 'Requested'`, `dealerCode`, and requested metadata) |
| **DEF-005** | `LeadsPage.tsx` / `vite.config.ts` | **LOW** | `dist/assets/LeadsPage-*.js` bundle size is ~608 kB minified, exceeding 500 kB chunk threshold. | **PLANNED** | Phase 2.4 (React.lazy code splitting) |
| **DEF-006** | `WhatsAppCentreView.tsx` | **MEDIUM** | Operates via `wa.me` browser deep links rather than automated Meta Cloud API. | **PLANNED** | Phase 2.3 (Meta WABA integration) |
| **DEF-007** | Lead Distribution Architecture | **MEDIUM** | Lead distribution is currently manual via dropdown selector. | **PLANNED** | Phase 2.2 (Automated round-robin engine) |
| **DEF-008** | SLA Breach Escalation | **LOW** | 15-minute SLA timer calculated in client browser, not enforced by backend cron. | **PLANNED** | Phase 2.4 (Cloud Function cron worker) |

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

