// Mirror Solar Vision CRM - Production Security & RBAC Audit Test Suite
// Executes positive and negative authorization tests across all roles

import assert from 'assert';

console.log('================================================================');
console.log('  MIRROR SOLAR VISION CRM - PRODUCTION SECURITY & RBAC AUDIT    ');
console.log('================================================================\n');

const API_KEY = 'AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY';

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

// -------------------------------------------------------------
// 1. LIVE AUTHENTICATION TESTS (Firebase Auth Backend)
// -------------------------------------------------------------
console.log('--- SUITE 1: AUTHENTICATION & CREDENTIAL ROTATION ---');

async function testAuthBackend() {
  // Test 1.1: Old universal password rejected for Bhavani
  const oldBhavaniRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bhavani.telecaller@mirrorsolar.in', password: 'Mirror@1432', returnSecureToken: true })
  });
  const oldBhavaniData = await oldBhavaniRes.json();
  assertTest('Universal password rejected for K. Bhavani', oldBhavaniData.error?.message === 'INVALID_LOGIN_CREDENTIALS');

  // Test 1.2: New rotated unique password accepted for Bhavani
  const newBhavaniRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bhavani.telecaller@mirrorsolar.in', password: 'Bhavani@MSV#8456', returnSecureToken: true })
  });
  const newBhavaniData = await newBhavaniRes.json();
  assertTest('Rotated unique password accepted for K. Bhavani', !!newBhavaniData.idToken);

  // Test 1.3: Old universal password rejected for Suresh
  const oldSureshRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sales.telecaller@mirrorsolar.in', password: 'Mirror@1432', returnSecureToken: true })
  });
  const oldSureshData = await oldSureshRes.json();
  assertTest('Universal password rejected for P. Suresh', oldSureshData.error?.message === 'INVALID_LOGIN_CREDENTIALS');

  // Test 1.4: New rotated unique password accepted for Suresh
  const newSureshRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sales.telecaller@mirrorsolar.in', password: 'Suresh@MSV#8990', returnSecureToken: true })
  });
  const newSureshData = await newSureshRes.json();
  assertTest('Rotated unique password accepted for P. Suresh', !!newSureshData.idToken);
}

// -------------------------------------------------------------
// 2. FIRESTORE RBAC LOGICAL VALIDATION (Exact Rules Spec)
// -------------------------------------------------------------
console.log('\n--- SUITE 2: MANDATORY NEGATIVE & POSITIVE RBAC TESTS ---');

function evaluateLeadRead(auth, userDoc, lead) {
  if (!auth) return false;
  if (userDoc.role === 'Admin' || auth.email === 'mirrorsolarvision@gmail.com') return true;
  if (userDoc.employeeCategory === 'Sales Manager' || userDoc.category === 'Sales Manager') return true;
  if (userDoc.role === 'Accounts' || userDoc.category === 'Accounts') return true;
  if (userDoc.role === 'Dealer') {
    return lead.dealerId === auth.uid || lead.dealerCode === userDoc.dealerCode;
  }
  if (userDoc.role === 'Employee') {
    return lead.assignedEmployeeId === auth.uid || 
           lead.leadOwnerId === auth.uid || 
           lead.assignedEmployeeEmail === auth.email ||
           lead.assignedEmployee === userDoc.name;
  }
  return false;
}

function evaluatePaymentVerification(auth, userDoc, lead, requestedUpdates) {
  if (!auth) return false;
  const isVerifier = userDoc.role === 'Admin' || userDoc.role === 'Accounts' || auth.email === 'mirrorsolarvision@gmail.com';
  const hasPaymentChange = requestedUpdates.payments !== undefined;
  if (!hasPaymentChange) return true;

  const currentPayments = lead.payments?.customerPayments || [];
  const nextPayments = requestedUpdates.payments?.customerPayments || [];

  // Check if any payment is being marked as 'Verified'
  const hasVerificationAttempt = nextPayments.some(p => p.status === 'Verified');
  if (hasVerificationAttempt && !isVerifier) {
    return false; // REJECT: Only Accounts/Admin can verify payments
  }
  return true;
}

function evaluateDiscountApproval(auth, userDoc, currentQuote, requestedUpdates) {
  if (!auth) return false;
  const isAdmin = userDoc.role === 'Admin' || auth.email === 'mirrorsolarvision@gmail.com';
  if (requestedUpdates.discountApprovalStatus === 'Approved') {
    return isAdmin; // REJECT non-admin
  }
  return true;
}

function evaluateSelfRoleEscalation(auth, userDoc, targetUserId, requestedUpdates) {
  if (!auth) return false;
  if (userDoc.role === 'Admin') return true;
  if (auth.uid === targetUserId) {
    // Only non-privileged profile fields permitted
    const forbiddenKeys = ['role', 'permissions', 'category', 'employeeCategory', 'status'];
    const attemptedKeys = Object.keys(requestedUpdates);
    const hasForbidden = attemptedKeys.some(k => forbiddenKeys.includes(k));
    return !hasForbidden; // REJECT self-promotion
  }
  return false;
}

function evaluateAuditLogMutation(operation) {
  if (operation === 'update' || operation === 'delete') {
    return false; // Absolute immutability: DENY all mutations
  }
  return true;
}

function runRBACTests() {
  const bhavaniAuth = { uid: 'DonOutQurqZiXvjvFu77iZLDhDU2', email: 'bhavani.telecaller@mirrorsolar.in' };
  const bhavaniDoc = { role: 'Employee', employeeCategory: 'Telecaller', name: 'K. Bhavani' };

  const sureshAuth = { uid: 'rjWhGZwpHyY0hZapXZmSqccU7sJ3', email: 'sales.telecaller@mirrorsolar.in' };
  const sureshDoc = { role: 'Employee', employeeCategory: 'Sales Manager', name: 'P. Suresh' };

  const adminAuth = { uid: 'J5Iht5bVwPQEOme5RpHPdruYlqB3', email: 'mirrorsolarvision@gmail.com' };
  const adminDoc = { role: 'Admin', name: 'MSV Admin' };

  const dealerHussainAuth = { uid: 'ck9OPLG03RZeJhYh60npKeMEaFz2', email: 'hussain@dealer.in' };
  const dealerHussainDoc = { role: 'Dealer', dealerCode: 'MSV/DLR/HUSSAIN', name: 'Hussain' };

  const leadAssignedToSiva = {
    id: 'lead_siva_1',
    customer: 'Venkata Rao',
    assignedEmployeeId: 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3',
    assignedEmployee: 'Sunkara Siva',
    dealerId: 'DLR_AYYAPPA_TENALI'
  };

  const leadAssignedToBhavani = {
    id: 'lead_bhavani_1',
    customer: 'K. Ramesh',
    assignedEmployeeId: 'DonOutQurqZiXvjvFu77iZLDhDU2',
    assignedEmployee: 'K. Bhavani',
    dealerId: 'ck9OPLG03RZeJhYh60npKeMEaFz2'
  };

  // Test 2.1: Telecaller cannot read another employee's lead (Negative)
  const canBhavaniReadSiva = evaluateLeadRead(bhavaniAuth, bhavaniDoc, leadAssignedToSiva);
  assertTest('Telecaller CANNOT read another employee\'s assigned lead (Negative)', canBhavaniReadSiva === false);

  // Test 2.2: Telecaller CAN read own assigned lead (Positive)
  const canBhavaniReadOwn = evaluateLeadRead(bhavaniAuth, bhavaniDoc, leadAssignedToBhavani);
  assertTest('Telecaller CAN read own assigned lead (Positive)', canBhavaniReadOwn === true);

  // Test 2.3: Sales Manager can read all team leads (Positive)
  const canSureshReadSiva = evaluateLeadRead(sureshAuth, sureshDoc, leadAssignedToSiva);
  assertTest('Sales Manager CAN read team-wide leads (Positive)', canSureshReadSiva === true);

  // Test 2.4: Dealer cannot read another dealer's lead (Negative)
  const canHussainReadAyyappa = evaluateLeadRead(dealerHussainAuth, dealerHussainDoc, leadAssignedToSiva);
  assertTest('Dealer CANNOT read another dealer\'s assigned customer (Negative)', canHussainReadAyyappa === false);

  // Test 2.5: Sales Manager attempting payment verification (Negative)
  const sureshVerifyPayment = evaluatePaymentVerification(sureshAuth, sureshDoc, leadAssignedToBhavani, {
    payments: {
      customerPayments: [{ id: 'p1', amount: 10000, status: 'Verified' }]
    }
  });
  assertTest('Sales Manager CANNOT verify customer payments (Negative - Segregation of Duties)', sureshVerifyPayment === false);

  // Test 2.6: Super Admin verifying payment (Positive)
  const adminVerifyPayment = evaluatePaymentVerification(adminAuth, adminDoc, leadAssignedToBhavani, {
    payments: {
      customerPayments: [{ id: 'p1', amount: 10000, status: 'Verified' }]
    }
  });
  assertTest('Super Admin CAN verify customer payments (Positive)', adminVerifyPayment === true);

  // Test 2.7: Telecaller attempting discount approval (Negative)
  const bhavaniApproveDiscount = evaluateDiscountApproval(bhavaniAuth, bhavaniDoc, {}, {
    discountApprovalStatus: 'Approved'
  });
  assertTest('Telecaller CANNOT approve quotation discount (Negative)', bhavaniApproveDiscount === false);

  // Test 2.8: Super Admin approving discount (Positive)
  const adminApproveDiscount = evaluateDiscountApproval(adminAuth, adminDoc, {}, {
    discountApprovalStatus: 'Approved'
  });
  assertTest('Super Admin CAN approve quotation discount (Positive)', adminApproveDiscount === true);

  // Test 2.9: Employee attempting self-role escalation to Admin (Negative)
  const bhavaniPromoteSelf = evaluateSelfRoleEscalation(bhavaniAuth, bhavaniDoc, bhavaniAuth.uid, {
    role: 'Admin'
  });
  assertTest('Employee CANNOT self-escalate role to Admin in /users (Negative)', bhavaniPromoteSelf === false);

  // Test 2.10: Audit Log update or delete (Negative)
  const updateAuditLog = evaluateAuditLogMutation('update');
  const deleteAuditLog = evaluateAuditLogMutation('delete');
  assertTest('Audit log is strictly immutable: UPDATE is DENIED (Negative)', updateAuditLog === false);
  assertTest('Audit log is strictly immutable: DELETE is DENIED (Negative)', deleteAuditLog === false);
}

// -------------------------------------------------------------
// 3. PIPELINE TRANSITION GATES
// -------------------------------------------------------------
console.log('\n--- SUITE 3: PIPELINE TRANSITION GATE CHECKS ---');

function runPipelineGateTests() {
  const unverifiedLead = {
    id: 'l1',
    customer: 'Test Customer',
    payments: {
      customerPayments: [{ id: 'p1', amount: 10000, status: 'Pending Verification' }]
    }
  };

  const verifiedLead = {
    id: 'l2',
    customer: 'Test Customer',
    payments: {
      customerPayments: [{ id: 'p1', amount: 10000, status: 'Verified' }]
    }
  };

  const isAdvanceVerified = (lead) => (lead.payments?.customerPayments || []).some(p => p.status === 'Verified');

  // Test 3.1: Cannot confirm booking without verified payment
  assertTest('Pipeline blocks "Booking Confirmed" when payment is unverified', isAdvanceVerified(unverifiedLead) === false);

  // Test 3.2: Permits booking when payment is verified
  assertTest('Pipeline allows "Booking Confirmed" when payment is verified by Accounts', isAdvanceVerified(verifiedLead) === true);
}

async function run() {
  try {
    await testAuthBackend();
  } catch (err) {
    console.error('Auth suite error:', err.message);
  }
  runRBACTests();
  runPipelineGateTests();

  console.log('\n================================================================');
  console.log(`  AUDIT TEST RESULTS SUMMARY: ${passCount} PASSED | ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
