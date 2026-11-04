# Mirror Solar Vision CRM — Known Limitations & Operational Considerations

**Release Version**: 1.0.0 Production  
**Document Identifier**: `MSV-CRM-KNOWN-LIMITATIONS-1-0`  
**Evaluation Date**: November 4, 2026  

---

## 1. Technical & Environment Limitations

### 1.1 Local Firebase Emulator Requires Java JRE/JDK on Host
- **Condition**: Running `npx firebase-tools emulators:start` on the local developer machine fails with `Error: Could not spawn java -version`.
- **Root Cause**: The host Windows machine does not have the Java Runtime Environment (JRE/JDK 11+) installed in system `PATH`.
- **Impact**: Offline emulator integration tests cannot be started locally without Java.
- **Mitigation**: The system utilizes the official **Google Firebase Rules Testing API** (`firebaserules.googleapis.com`) for direct cloud rule evaluations, and live staging channels for full application tests.
- **Recommended Action**: Install OpenJDK 17 on the host machine if offline local emulator development is desired.

### 1.2 Cloud Functions Deployment Requires Firebase Blaze Plan
- **Condition**: Deploying `verifyCustomerPayment` Cloud Function to production Google Cloud infrastructure requires the Firebase project (`crm-webapp-d32bc`) to be on the **Blaze (Pay as you go)** plan.
- **Impact**: On the free Spark plan, `firebase deploy --only functions` is rejected by Google Cloud resource quotas.
- **Mitigation / Fallback Architecture**: The CRM includes an integrated dual custody fallback: under `firestore.rules`, a Super Admin can verify customer payments directly via client SDK, while Cloud Functions remain fully implemented and ready to deploy the moment Blaze is activated.
- **Recommended Action**: Project owner to activate Blaze plan via Firebase Console (`https://console.firebase.google.com/project/crm-webapp-d32bc/usage/details`).

---

## 2. Authentication & Account State Considerations

### 2.1 First-Time Staff & Dealer Password Establishment
- **Condition**: All 14 affected accounts were administratively rotated in Google Identity Platform to unique 32-character high-entropy strings, and legacy refresh tokens were revoked.
- **Operational Reality**: Human staff members and authorized dealers do not know the random 32-character strings.
- **Action Required**: The Super Admin must complete their reset via the dispatched email link. Staff and dealers must use the "Forgot Password" self-service link on `LoginScreen.tsx` to establish their permanent personal credentials.

### 2.2 Historical Git Commits Retain Legacy Credentials
- **Condition**: Commit history prior to `5d45177` contains historical plaintext credentials.
- **Status**: Current files, backups, and seed scripts are 100% sanitized. A non-destructive `git-filter-repo` rewrite plan has been prepared, but destructive rewriting of Git history is deliberately withheld pending explicit owner approval.

---

## 3. Product Scope Boundaries

### 3.1 Modules 13–18 Deferred
- **Condition**: In strict adherence to the project directive for **Release 1.0 Delivery by 6 November 2026**, development of new modules (Modules 13 through 18) has been halted.
- **Operational Status**: The 12 core operational modules (Dashboard, Leads Pipeline, Telecalling, Sales Coordination, Dealer Desk, Site Surveys, Quotations, Token Payments, Accounts Verification, Booking Handoff, Inventory, and Attendance/Payroll) represent the complete, verified scope of Release 1.0.
