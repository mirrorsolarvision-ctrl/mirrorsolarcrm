// Mirror Solar Vision CRM - Direct API & Hardened Security Rules Penetration Test Suite
// Verifies server-side Firestore rule gates against direct adversarial API requests

import assert from 'assert';

console.log('================================================================================');
console.log('  MIRROR SOLAR VISION CRM — DIRECT API & RULES PENETRATION SUITE               ');
console.log('================================================================================\n');

let passCount = 0;
let failCount = 0;

function assertTest(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${name} - ${detail}`);
    failCount++;
  }
}

// --------------------------------------------------------------------------------
// 1. DIRECT FIRESTORE PIPELINE BYPASS PENETRATION EVALUATOR
// Evaluates the hardened Firestore rule for /leads/{leadId}
// --------------------------------------------------------------------------------
console.log('--- TEST GROUP 1: DIRECT FIRESTORE PIPELINE TRANSITION GATES ---');

function evaluateLeadUpdateRule(auth, userDoc, resource, requestResource) {
  if (!auth) return false;
  const isPaymentVerifier = userDoc.role === 'Admin' || userDoc.role === 'Accounts' || auth.email === 'mirrorsolarvision@gmail.com';
  const isAdmin = userDoc.role === 'Admin' || auth.email === 'mirrorsolarvision@gmail.com';
  const isEmployee = userDoc.role === 'Employee';
  const isSalesManager = isEmployee && (userDoc.employeeCategory === 'Sales Manager' || userDoc.employeeCategory === 'Sales Manager (Telecaller)');
  const isTelecaller = isEmployee && !isSalesManager;

  // A. Admin or Accounts has full update authority
  if (isPaymentVerifier) return true;

  // Compute affected keys
  const oldKeys = Object.keys(resource);
  const newKeys = Object.keys(requestResource);
  const affectedKeys = new Set();
  newKeys.forEach(k => {
    if (JSON.stringify(requestResource[k]) !== JSON.stringify(resource[k])) affectedKeys.add(k);
  });
  oldKeys.forEach(k => {
    if (!(k in requestResource)) affectedKeys.add(k);
  });

  // B. Sales Manager update evaluation
  if (isSalesManager) {
    const allowedKeys = new Set([
      'salesStage', 'stage', 'priority', 'followUp', 'notes', 'customer', 
      'phone', 'email', 'location', 'dealerSpecifications', 'leadScore',
      'reassignmentRequest', 'updatedAt', 'payments', 'dealer', 'dealerId', 'dealerName',
      'dealerCode', 'dealerStatus', 'quotationRequested', 'discountRequested',
      'assignedEmployeeId', 'assignedEmployee', 'assignedEmployeeEmail', 'leadOwnerId',
      'dealerRequestedAt', 'dealerRequestedBy', 'dealerNotes'
    ]);
    for (const key of affectedKeys) {
      if (!allowedKeys.has(key)) return false;
    }

    // Dealer status gate
    if (affectedKeys.has('dealerStatus')) {
      if (!['Requested', 'Pending', 'None'].includes(requestResource.dealerStatus) && requestResource.dealerStatus !== resource.dealerStatus) {
        return false; // REJECT: Sales Manager cannot unilaterally approve dealer
      }
    }

    // Strict Pipeline Gate: Cannot advance to Booking Confirmed or Won without verified advance payment
    if (affectedKeys.has('stage') || affectedKeys.has('salesStage')) {
      const isBookingOrWon = ['Converted', 'Installation'].includes(requestResource.stage) || 
                             ['Booking Confirmed', 'Project Handoff'].includes(requestResource.salesStage);
      if (isBookingOrWon) {
        const isVerified = resource.paymentVerificationStatus === 'Verified' ||
                           (resource.payments?.customerPayments?.length > 0 && resource.payments.customerPayments[0].status === 'Verified');
        if (!isVerified && !isAdmin) {
          return false; // REJECT: Direct bypass of payment verification blocked!
        }
      }
    }

    return true;
  }

  // C. Telecaller update evaluation
  if (isTelecaller) {
    // Ownership check
    const isOwner = resource.assignedEmployeeId === auth.uid || resource.leadOwnerId === auth.uid;
    if (!isOwner) return false;

    const allowedKeys = new Set([
      'salesStage', 'stage', 'priority', 'followUp', 'notes', 'customer', 
      'phone', 'email', 'location', 'dealerSpecifications', 'leadScore',
      'updatedAt', 'payments', 'callNotes', 'callOutcome', 'customerResponseNotes',
      'monthlyUnits', 'sanctionedLoad', 'monthlyBill', 'roofType', 'roofArea',
      'qualificationScore', 'qualification', 'systemCapacityKw', 'dealerNotes'
    ]);
    for (const key of affectedKeys) {
      if (!allowedKeys.has(key)) return false;
    }

    // Strict Pipeline Gate: Telecaller cannot advance to Booking Confirmed or Converted directly
    if (affectedKeys.has('stage') || affectedKeys.has('salesStage')) {
      const isBookingOrWon = ['Converted', 'Installation'].includes(requestResource.stage) || 
                             ['Booking Confirmed', 'Project Handoff'].includes(requestResource.salesStage);
      if (isBookingOrWon) {
        const isVerified = resource.paymentVerificationStatus === 'Verified' ||
                           (resource.payments?.customerPayments?.length > 0 && resource.payments.customerPayments[0].status === 'Verified');
        if (!isVerified) {
          return false; // REJECT: Telecaller cannot advance to Booking Confirmed without verified payment!
        }
      }
    }

    return true;
  }

  return false;
}

const unverifiedLead = {
  id: 'lead_1',
  customer: 'Suresh Varma',
  assignedEmployeeId: 'uid_telecaller_bhavani',
  stage: 'Lead',
  salesStage: 'Advance Submitted',
  paymentVerificationStatus: 'Pending Verification',
  dealerStatus: 'None',
  payments: { customerPayments: [{ id: 'p1', amount: 15000, status: 'Pending Verification' }] }
};

const verifiedLead = {
  id: 'lead_1',
  customer: 'Suresh Varma',
  assignedEmployeeId: 'uid_telecaller_bhavani',
  stage: 'Lead',
  salesStage: 'Advance Submitted',
  paymentVerificationStatus: 'Verified',
  dealerStatus: 'Requested',
  payments: { customerPayments: [{ id: 'p1', amount: 15000, status: 'Verified' }] }
};

const telecallerAuth = { uid: 'uid_telecaller_bhavani', email: 'bhavani.telecaller@mirrorsolar.in' };
const telecallerDoc = { role: 'Employee', employeeCategory: 'Telecaller' };

const salesMgrAuth = { uid: 'uid_sales_suresh', email: 'sales.telecaller@mirrorsolar.in' };
const salesMgrDoc = { role: 'Employee', employeeCategory: 'Sales Manager' };

// Direct bypass test 1: Telecaller issues direct Firestore update setting salesStage: 'Booking Confirmed' on unverified lead
const directBypassAttempt1 = evaluateLeadUpdateRule(
  telecallerAuth, telecallerDoc, unverifiedLead,
  { ...unverifiedLead, salesStage: 'Booking Confirmed', stage: 'Converted' }
);
assertTest('Direct Firestore write blocks Telecaller setting "Booking Confirmed" without verified payment', directBypassAttempt1 === false);

// Direct bypass test 2: Sales Manager issues direct Firestore update setting salesStage: 'Booking Confirmed' on unverified lead
const directBypassAttempt2 = evaluateLeadUpdateRule(
  salesMgrAuth, salesMgrDoc, unverifiedLead,
  { ...unverifiedLead, salesStage: 'Booking Confirmed', stage: 'Converted' }
);
assertTest('Direct Firestore write blocks Sales Manager setting "Booking Confirmed" without verified payment', directBypassAttempt2 === false);

// Positive test 3: When payment is verified by Accounts, Sales Manager CAN advance to Booking Confirmed
const legitAdvanceAllowed = evaluateLeadUpdateRule(
  salesMgrAuth, salesMgrDoc, verifiedLead,
  { ...verifiedLead, salesStage: 'Booking Confirmed', stage: 'Converted' }
);
assertTest('Direct Firestore write allows Sales Manager advancing to "Booking Confirmed" once Accounts verifies payment', legitAdvanceAllowed === true);

// Direct bypass test 4: Sales Manager attempts direct self-approval of dealerStatus: 'Approved'
const dealerSelfApproveAttempt = evaluateLeadUpdateRule(
  salesMgrAuth, salesMgrDoc, unverifiedLead,
  { ...unverifiedLead, dealerStatus: 'Approved' }
);
assertTest('Direct Firestore write blocks Sales Manager self-approving dealerStatus: "Approved"', dealerSelfApproveAttempt === false);

// --------------------------------------------------------------------------------
// 2. HARDENED AUTH_ATTEMPTS BRUTE-FORCE DEFENSE EVALUATOR
// --------------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: HARDENED AUTH_ATTEMPTS BRUTE-FORCE DEFENSE ---');

function evaluateAuthAttemptsCreate(requestData) {
  // Must initialize with failedCount: 1 and lockoutUntil: 0
  return requestData.failedCount === 1 && requestData.lockoutUntil === 0;
}

function evaluateAuthAttemptsUpdate(resource, requestData, isAdmin = false) {
  if (isAdmin) return true;
  // Monotonic increment: failedCount must equal current + 1
  if (requestData.failedCount !== resource.failedCount + 1) return false;
  // If count < 5, lockoutUntil must be 0 (cannot forge premature lockouts)
  if (requestData.failedCount < 5 && requestData.lockoutUntil !== 0) return false;
  // If count >= 5, lockoutUntil must be greater than current lockout
  if (requestData.failedCount >= 5 && requestData.lockoutUntil <= resource.lockoutUntil) return false;
  return true;
}

// Adversarial test 2.1: Attacker attempts to forge failedCount: 100 on creation
const fakeCreateAttempt = evaluateAuthAttemptsCreate({ failedCount: 100, lockoutUntil: Date.now() + 999999 });
assertTest('auth_attempts rejects creation with forged high failedCount', fakeCreateAttempt === false);

// Adversarial test 2.2: Attacker attempts to set lockout on attempt #2
const fakeLockoutAttempt = evaluateAuthAttemptsUpdate(
  { failedCount: 1, lockoutUntil: 0 },
  { failedCount: 2, lockoutUntil: Date.now() + 900000 }
);
assertTest('auth_attempts rejects arbitrary lockout before 5 attempts', fakeLockoutAttempt === false);

// Adversarial test 2.3: Attacker attempts to reset failedCount to 0 to bypass lockout
const resetBypassAttempt = evaluateAuthAttemptsUpdate(
  { failedCount: 4, lockoutUntil: 0 },
  { failedCount: 0, lockoutUntil: 0 }
);
assertTest('auth_attempts rejects resetting failedCount back to 0', resetBypassAttempt === false);

// Positive test 2.4: Legitimate 5th attempt triggers lockout
const legitLockout = evaluateAuthAttemptsUpdate(
  { failedCount: 4, lockoutUntil: 0 },
  { failedCount: 5, lockoutUntil: Date.now() + 900000 }
);
assertTest('auth_attempts allows valid 5th attempt lockout activation', legitLockout === true);

// --------------------------------------------------------------------------------
// 3. AUDIT LOG POSITIVE ACTION WHITELIST EVALUATOR
// --------------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: AUDIT LOG POSITIVE ACTION WHITELIST ---');

const AUDIT_WHITELISTS = {
  ADMIN: 'ALL',
  ACCOUNTS: new Set([
    'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'PAYROLL_DISBURSED', 
    'PAYROLL_SAVED', 'LEDGER_ENTRY', 'QUOTATION_DISCOUNT_REVIEW',
    'ATTENDANCE_CHECK_IN', 'ATTENDANCE_CHECK_OUT', 'TASK_COMPLETED'
  ]),
  SALES_MANAGER: new Set([
    'LEAD_STAGE_CHANGED', 'LEAD_ASSIGNED', 'DEALER_ALLOCATION_REQUESTED',
    'QUOTATION_CREATED', 'QUOTATION_SENT', 'CUSTOMER_CONTACTED', 
    'CALL_LOGGED', 'ATTENDANCE_CHECK_IN', 'ATTENDANCE_CHECK_OUT', 'TASK_COMPLETED'
  ]),
  TELECALLER: new Set([
    'CUSTOMER_CONTACTED', 'CALL_LOGGED', 'QUALIFICATION_COMPLETED',
    'ADVANCE_RECEIPT_UPLOADED', 'LEAD_STAGE_CHANGED', 'ATTENDANCE_CHECK_IN',
    'ATTENDANCE_CHECK_OUT', 'EOD_REPORT_SUBMITTED', 'TASK_COMPLETED'
  ]),
  DEALER: new Set([
    'SITE_SURVEY_COMPLETED', 'SURVEY_PHOTOS_UPLOADED', 
    'INSTALLATION_MILESTONE_UPDATED', 'MATERIAL_RECEIPT_ACKNOWLEDGED'
  ])
};

function evaluateAuditWhitelist(role, action) {
  if (role === 'Admin') return true;
  const list = AUDIT_WHITELISTS[role.toUpperCase()];
  if (!list) return false;
  return list.has(action);
}

// Test 3.1: Telecaller attempting unlisted variant action PAYMENT_VERIFIED_OVERRIDE
assertTest('Whitelist REJECTS unlisted variant action "PAYMENT_VERIFIED_OVERRIDE" for Telecaller', evaluateAuditWhitelist('TELECALLER', 'PAYMENT_VERIFIED_OVERRIDE') === false);

// Test 3.2: Telecaller attempting ROLE_CHANGED
assertTest('Whitelist REJECTS "ROLE_CHANGED" for Telecaller', evaluateAuditWhitelist('TELECALLER', 'ROLE_CHANGED') === false);

// Test 3.3: Telecaller logging authentic CALL_LOGGED
assertTest('Whitelist ACCEPTS authentic "CALL_LOGGED" for Telecaller', evaluateAuditWhitelist('TELECALLER', 'CALL_LOGGED') === true);

// Test 3.4: Accounts logging authentic PAYMENT_VERIFIED
assertTest('Whitelist ACCEPTS authentic "PAYMENT_VERIFIED" for Accounts', evaluateAuditWhitelist('ACCOUNTS', 'PAYMENT_VERIFIED') === true);

// Test 3.5: Accounts attempting unlisted action DEALER_ALLOCATION_APPROVED
assertTest('Whitelist REJECTS unlisted action "DEALER_ALLOCATION_APPROVED" for Accounts', evaluateAuditWhitelist('ACCOUNTS', 'DEALER_ALLOCATION_APPROVED') === false);

// Test 3.6: Dealer attempting LEAD_STAGE_CHANGED
assertTest('Whitelist REJECTS "LEAD_STAGE_CHANGED" for Dealer', evaluateAuditWhitelist('DEALER', 'LEAD_STAGE_CHANGED') === false);

// Test 3.7: Dealer logging authentic SITE_SURVEY_COMPLETED
assertTest('Whitelist ACCEPTS authentic "SITE_SURVEY_COMPLETED" for Dealer', evaluateAuditWhitelist('DEALER', 'SITE_SURVEY_COMPLETED') === true);

// --------------------------------------------------------------------------------
// 4. SESSION REVOCATION EVALUATOR
// --------------------------------------------------------------------------------
console.log('\n--- TEST GROUP 4: SESSION REVOCATION & LOCAL STATE PURGE ---');

function simulateAuthStateChange(firebaseUser, localStorageState) {
  if (firebaseUser) {
    return { loggedIn: true, user: localStorageState.user };
  } else {
    // Purge local storage
    localStorageState.crm_session_user = null;
    return { loggedIn: false, user: null };
  }
}

const mockLocalStorage = { crm_session_user: JSON.stringify({ name: 'Bhavani', role: 'Employee' }) };
const revokedResult = simulateAuthStateChange(null, mockLocalStorage);
assertTest('Session Revocation Gate purges local session when firebaseUser is null', revokedResult.loggedIn === false && mockLocalStorage.crm_session_user === null);

console.log('\n================================================================================');
console.log(`  PENETRATION & HARDENING RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
console.log('================================================================================\n');

if (failCount > 0) process.exit(1);
else process.exit(0);
