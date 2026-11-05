# Mirror Solar Vision CRM — User Access & Onboarding Guide

**System URL**: [https://crm.mirrorsolarvision.com](https://crm.mirrorsolarvision.com)  
**Alternative URL**: [https://crm-webapp-d32bc.web.app](https://crm-webapp-d32bc.web.app)  
**System Version**: 1.0.0 Production  

---

## 1. First-Time Authentication & Password Establishment

All user accounts have been protected with zero-trust credentials and refresh-token invalidation. To establish your permanent personal password, follow the instructions for your role below:

### 1.1 Super Admin (`mirrorsolarvision@gmail.com`)
1. Open your inbox at `mirrorsolarvision@gmail.com`.
2. Locate the official email from `noreply@crm-webapp-d32bc.firebaseapp.com` with the subject: **"Reset your password for crm-webapp"**.
3. Click the secure reset link in the email.
4. Set a strong password (minimum 12 characters, including uppercase, lowercase, numbers, and special symbols).
5. Navigate to [https://crm.mirrorsolarvision.com](https://crm.mirrorsolarvision.com) and log in.

### 1.2 Employees & Operational Staff (Telecallers, Sales Managers, Accounts)
1. Navigate to the login portal at [https://crm.mirrorsolarvision.com](https://crm.mirrorsolarvision.com).
2. Click **"Forgot Password?"** beneath the sign-in form.
3. Enter your registered work email (e.g. `bhavani.telecaller@mirrorsolar.in`, `sales.telecaller@mirrorsolar.in`, etc.).
4. Check your email for the password-reset link and establish your new password.
5. Alternatively, your Super Admin can set a temporary password for you via the Admin Users Directory (`/admin/users`).

### 1.3 Authorized Regional Dealers (`@dealer.in`)
1. Navigate to [https://crm.mirrorsolarvision.com](https://crm.mirrorsolarvision.com).
2. Select the **"Dealer"** role tab on the login screen.
3. If logging in for the first time or if you have forgotten your password, click **"Forgot Password?"** and enter your dealership email (e.g. `hussain@dealer.in`, `srinivas@dealer.in`).
4. Follow the reset link received in your inbox to activate your dealership account.

---

## 2. Role-by-Role Operational Guides

### 2.1 Super Admin & Admin
- **Primary Dashboard**: Real-time sales funnel KPIs, active lead volume, aggregate revenue, monthly kilowatt installation totals.
- **Key Responsibilities**:
  - Employee and dealer lifecycle management.
  - Final approval of regional dealer allocations.
  - Commercial discount authorizations exceeding sales representative thresholds.
  - Super Admin payment verification override when required.
  - System configuration and audit trail surveillance (`/auditLogs`).

### 2.2 Accounts Authority
- **Primary Workspace**: Finance, Ledger & Payments Verification Desk.
- **Key Responsibilities**:
  - Review incoming customer advance token deposits (`Pending Verification`).
  - Cross-reference bank deposit statements with customer transaction references (UTR / Cheque).
  - Execute formal verification sign-off.
  - **Segregation of Duties**: You cannot verify a payment you personally recorded. Independent verification is required.

### 2.3 Sales Manager
- **Primary Workspace**: Sales Workspace & Dealer Coordination Desk.
- **Key Responsibilities**:
  - Triage new leads and assign them to telecallers.
  - Review 4-pillar qualification submissions (Load, Roof Area, Monthly Bill, Preferred Capacity).
  - Request authorized regional dealer allocation for physical site surveys.
  - Generate customized PM Surya Ghar subsidy quotations.
  - Dispatch installation packages to dealers once Accounts confirms payment.
  - **Security Gate**: You cannot self-approve dealer allocations or mark payments as verified.

### 2.4 Telecaller
- **Primary Workspace**: Telecalling Desk & Call Queue.
- **Key Responsibilities**:
  - Review daily assigned call queue.
  - Log call outcomes (Interested, Follow-up Scheduled, Unreachable, Disqualified).
  - Complete 4-pillar technical qualification fields with the prospective customer.
  - Upload customer advance token receipts (UTR, Cheque, Bank Deposit slip).
  - Upload initial rooftop photos and electricity bill KYC documents.
  - **Security Gate**: You can only access leads assigned to your employee account. Direct pipeline advancement to Booking Confirmed is blocked.

### 2.5 Authorized Regional Dealer
- **Primary Workspace**: Dealer Mobile Field App.
- **Key Responsibilities**:
  - Receive allocated site survey requests for your territory.
  - Conduct on-site rooftop structural and shadow analysis.
  - Upload survey photos, roof measurements, and engineering notes.
  - Submit technical feasibility approval.
  - **Security Gate**: You cannot view competing dealerships' leads or access customer Aadhaar KYC identity documents.

---

## 3. Security & Operational Rules for All Staff

1. **Password Confidentiality**: Never share your password or authentication token with colleagues or external third parties.
2. **Device Security**: Always click **"Sign Out"** when leaving a shared desktop or terminal unattended.
3. **Customer Data Privacy**: Customer phone numbers, Aadhaar records, and electricity bills are strictly confidential under company data governance rules. Downloading or redistributing customer records outside official CRM workflows is strictly prohibited.
4. **Suspicious Activity Reporting**: If you receive unexpected password reset notifications or observe discrepancies in customer payment records, immediately notify the Super Admin.
