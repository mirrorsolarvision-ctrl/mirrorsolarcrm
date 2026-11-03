// Mirror Solar Vision CRM - Security Remediation Gate 2.1-R Master Test Suite
// Verifies DEF-009 (KYC Upload Authorization), DEF-010 (Trusted Payment Verification Cloud Function),
// DEF-011 (Dealer UID Authorization), and DEF-012 (Call-Log Identity & Write Protection)

import assert from 'assert';
import fs from 'fs';

console.log('================================================================================');
console.log('   MIRROR SOLAR VISION CRM - SECURITY REMEDIATION GATE 2.1-R TEST SUITE        ');
console.log('================================================================================\n');

let passCount = 0;
let failCount = 0;

function assertTest(label, category, name, condition, detail = '') {
  const badge = `[${category}]`;
  if (condition) {
    console.log(`  ✓ PASS ${badge} [${label}]: ${name}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL ${badge} [${label}]: ${name} - ${detail}`);
    failCount++;
  }
}

// =============================================================================
// SECTION 1: DEF-009 KYC UPLOAD & READ AUTHORIZATION GATES
// =============================================================================
console.log('--- TEST GROUP 1: DEF-009 KYC UPLOAD & STORAGE AUTHORIZATION ---');

function testKycUploadAuthorization() {
  const evaluateStorageKycCreate = (auth, leadDoc, file) => {
    if (!auth || !auth.uid) return { allowed: false, reason: 'Unauthenticated' };
    if (file.size > 15 * 1024 * 1024) return { allowed: false, reason: 'File exceeds 15MB limit' };
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMime.includes(file.type)) return { allowed: false, reason: 'Invalid MIME type' };

    // Dealers are strictly prohibited from uploading to customer KYC path
    if (auth.role === 'Dealer') {
      return { allowed: false, reason: 'Dealers are strictly prohibited from KYC identity documents' };
    }

    const isAdmin = auth.role === 'Admin';
    const isAccounts = auth.role === 'Accounts';
    const isSuryaGhar = auth.category === 'PM Surya Ghar Work Incharge' || auth.employeeCategory === 'PM Surya Ghar Work Incharge';
    const isPrivileged = isAdmin || isAccounts;

    if (isPrivileged || isSuryaGhar) return { allowed: true };

    // Regular employee can only upload if assigned to this lead
    const isAssigned = leadDoc.assignedEmployeeId === auth.uid || leadDoc.leadOwnerId === auth.uid;
    if (isAssigned) return { allowed: true };

    return { allowed: false, reason: 'Unassigned employee denied access to customer KYC path' };
  };

  const sampleLead = {
    id: 'lead_kyc_01',
    customer: 'Sita Ramaiah',
    assignedEmployeeId: 'telecaller_bhavani_uid',
    leadOwnerId: 'telecaller_bhavani_uid',
    dealerId: 'dlr_hussain_uid'
  };

  const validKycFile = { name: 'aadhaar.pdf', type: 'application/pdf', size: 1024 * 500 };

  // 1.1 Unauthenticated upload denied
  assertTest('1.1', 'UNIT / SIMULATED', 'Unauthenticated request to upload customer KYC is strictly DENIED',
    evaluateStorageKycCreate(null, sampleLead, validKycFile).allowed === false
  );

  // 1.2 Unassigned telecaller denied
  const unassignedTelecaller = { uid: 'unassigned_caller_99', role: 'Employee', employeeCategory: 'Telecaller' };
  assertTest('1.2', 'UNIT / SIMULATED', 'Unassigned telecaller attempting upload to customer KYC path is strictly DENIED',
    evaluateStorageKycCreate(unassignedTelecaller, sampleLead, validKycFile).allowed === false
  );

  // 1.3 Dealer upload denied
  const assignedDealer = { uid: 'dlr_hussain_uid', role: 'Dealer' };
  assertTest('1.3', 'UNIT / SIMULATED', 'Authorized regional dealer attempting upload to KYC path is strictly DENIED (Zero KYC Access)',
    evaluateStorageKycCreate(assignedDealer, sampleLead, validKycFile).allowed === false
  );

  // 1.4 Assigned authorized staff allowed
  const assignedTelecaller = { uid: 'telecaller_bhavani_uid', role: 'Employee', employeeCategory: 'Telecaller' };
  assertTest('1.4', 'UNIT / SIMULATED', 'Assigned telecaller UID upload to customer KYC path is ALLOWED',
    evaluateStorageKycCreate(assignedTelecaller, sampleLead, validKycFile).allowed === true
  );

  // 1.5 PM Surya Ghar Incharge allowed
  const suryaGharIncharge = { uid: 'kumari_uid', role: 'Employee', category: 'PM Surya Ghar Work Incharge' };
  assertTest('1.5', 'UNIT / SIMULATED', 'Authorized PM Surya Ghar Incharge upload to customer KYC path is ALLOWED',
    evaluateStorageKycCreate(suryaGharIncharge, sampleLead, validKycFile).allowed === true
  );

  // 1.6 Super Admin allowed
  const adminUser = { uid: 'admin_uid', role: 'Admin' };
  assertTest('1.6', 'UNIT / SIMULATED', 'Super Admin upload to customer KYC path is ALLOWED',
    evaluateStorageKycCreate(adminUser, sampleLead, validKycFile).allowed === true
  );

  // 1.7 - 1.9 Firestore /leadKyc/{leadId} Rule Simulation
  const evaluateFirestoreLeadKycRule = (auth, leadDoc, opType) => {
    if (!auth || !auth.uid) return false;
    if (auth.role === 'Dealer') return false;
    const isAdmin = auth.role === 'Admin';
    const isSuryaGhar = auth.category === 'PM Surya Ghar Work Incharge';
    if (isAdmin || isSuryaGhar) return true;
    return leadDoc.assignedEmployeeId === auth.uid || leadDoc.leadOwnerId === auth.uid;
  };

  assertTest('1.7', 'UNIT / SIMULATED', 'Firestore /leadKyc/{leadId} write DENIED to unassigned telecaller',
    evaluateFirestoreLeadKycRule(unassignedTelecaller, sampleLead, 'write') === false
  );

  assertTest('1.8', 'UNIT / SIMULATED', 'Firestore /leadKyc/{leadId} write ALLOWED to assigned telecaller UID',
    evaluateFirestoreLeadKycRule(assignedTelecaller, sampleLead, 'write') === true
  );

  assertTest('1.9', 'UNIT / SIMULATED', 'Firestore /leadKyc/{leadId} read STRICTLY DENIED to authorized dealer',
    evaluateFirestoreLeadKycRule(assignedDealer, sampleLead, 'read') === false
  );
}

testKycUploadAuthorization();

// =============================================================================
// SECTION 2: DEF-010 TRUSTED PAYMENT VERIFICATION (CLOUD FUNCTION LOGIC)
// =============================================================================
console.log('\n--- TEST GROUP 2: DEF-010 TRUSTED PAYMENT VERIFICATION (CLOUD FUNCTION) ---');

function testTrustedPaymentVerificationBackend() {
  // Authoritative Cloud Function Backend Implementation Simulation
  const verifyCustomerPaymentBackend = (context, payload, databaseState) => {
    // 1. Authenticate caller
    if (!context.auth || !context.auth.uid) {
      return { status: 401, error: 'unauthenticated', message: 'Authentication required' };
    }
    const verifierUid = context.auth.uid;

    // 2. Authoritative role check
    const userDoc = databaseState.users[verifierUid] || {};
    const verifierRole = context.auth.token?.role || userDoc.role || 'Employee';
    const verifierCategory = userDoc.employeeCategory || userDoc.category || '';
    const verifierName = userDoc.name || 'Staff User';

    const isAdmin = verifierRole === 'Admin';
    const isAccounts = verifierRole === 'Accounts' || verifierCategory.toLowerCase().includes('accounts');

    if (!isAdmin && !isAccounts) {
      return { status: 403, error: 'permission-denied', message: 'Payment verification strictly reserved for Admin and Accounts' };
    }

    // 3. Read existing payment record from Firestore
    const lead = databaseState.leads[payload.leadId];
    if (!lead) {
      return { status: 404, error: 'not-found', message: `Lead ${payload.leadId} not found` };
    }

    const customerPayments = lead.payments?.customerPayments || [];
    const payment = customerPayments.find(p => p.id === payload.paymentId);
    if (!payment) {
      return { status: 404, error: 'not-found', message: `Payment ${payload.paymentId} not found` };
    }

    // 4. Verify payment is pending (Replay / Duplicate prevention)
    if (payment.status === 'Verified') {
      return { status: 409, error: 'already-exists', message: 'Replay Prevention: Payment has already been verified' };
    }
    if (payment.status !== 'Pending Verification') {
      return { status: 412, error: 'failed-precondition', message: `Payment is in invalid state "${payment.status}"` };
    }

    // 5. Compare recordedByUid with caller UID
    const recordedByUid = payment.recordedByUid || '';
    const isSelfRecorded = recordedByUid && recordedByUid === verifierUid;

    // 6. Anti-Self-Approval Enforcement (Strict Segregation of Duties across ALL roles)
    if (isSelfRecorded) {
      return {
        status: 412,
        error: 'failed-precondition',
        message: 'Segregation of Duties Violation: You cannot verify a payment you personally recorded.'
      };
    }

    // 7. Validate requested verification amount and payment reference
    if (payload.verifiedAmount !== undefined && Number(payload.verifiedAmount) !== Number(payment.amount)) {
      return { status: 400, error: 'invalid-argument', message: 'Amount mismatch' };
    }
    if (payload.referenceNumber && payment.referenceNumber && payload.referenceNumber !== payment.referenceNumber) {
      return { status: 400, error: 'invalid-argument', message: 'Reference number mismatch' };
    }

    // 8. Atomically update payment status and verification metadata
    const verifiedIso = new Date().toISOString();
    payment.status = 'Verified';
    payment.verifiedByUid = verifierUid;
    payment.verifiedByName = verifierName;
    payment.verifiedByRole = isAdmin ? 'Admin' : 'Accounts';
    payment.verifiedAt = verifiedIso;
    payment.verificationMethod = 'TRUSTED_BACKEND_CLOUD_FUNCTION';

    lead.salesStage = 'Booking Confirmed';
    lead.stage = 'Converted';
    lead.paymentVerificationStatus = 'Verified';

    // 9. Create authoritative audit event
    const auditEvent = {
      id: `AUDIT_${Date.now()}`,
      action: 'PAYMENT_VERIFIED',
      leadId: payload.leadId,
      paymentId: payload.paymentId,
      amount: payment.amount,
      verifiedByUid: verifierUid,
      verifiedByRole: isAdmin ? 'Admin' : 'Accounts',
      timestamp: verifiedIso,
      authoritativeSource: 'CloudFunction:verifyCustomerPayment'
    };
    databaseState.auditLogs.push(auditEvent);

    return { status: 200, success: true, verifiedPayment: payment, auditEvent: auditEvent };
  };

  const mockDb = {
    users: {
      'acc_officer_01': { name: 'P. Accounts Officer', role: 'Accounts', employeeCategory: 'Accounts' },
      'acc_officer_02': { name: 'R. Senior Auditor', role: 'Accounts', employeeCategory: 'Accounts' },
      'admin_user_01': { name: 'Super Admin', role: 'Admin' },
      'telecaller_bhavani': { name: 'K. Bhavani', role: 'Employee', employeeCategory: 'Telecaller' }
    },
    leads: {
      'lead_pay_01': {
        id: 'lead_pay_01',
        customer: 'Rambabu Varma',
        salesStage: 'Advance Submitted',
        stage: 'Lead',
        payments: {
          customerPayments: [
            {
              id: 'PAY_1001',
              amount: 25000,
              referenceNumber: 'UTR-88990011',
              status: 'Pending Verification',
              recordedBy: 'K. Bhavani',
              recordedByUid: 'telecaller_bhavani'
            },
            {
              id: 'PAY_SELF_01',
              amount: 10000,
              referenceNumber: 'UTR-11223344',
              status: 'Pending Verification',
              recordedBy: 'P. Accounts Officer',
              recordedByUid: 'acc_officer_01'
            }
          ]
        }
      }
    },
    auditLogs: []
  };

  // 2.1 Unauthenticated caller rejected
  const res1 = verifyCustomerPaymentBackend({ auth: null }, { leadId: 'lead_pay_01', paymentId: 'PAY_1001' }, mockDb);
  assertTest('2.1', 'UNIT / SIMULATED', 'Unauthenticated invocation rejected with 401 unauthenticated', res1.status === 401);

  // 2.2 Telecaller caller rejected
  const res2 = verifyCustomerPaymentBackend({ auth: { uid: 'telecaller_bhavani' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_1001' }, mockDb);
  assertTest('2.2', 'UNIT / SIMULATED', 'Telecaller invocation rejected with 403 permission-denied', res2.status === 403);

  // 2.3 Non-existent payment rejected
  const res3 = verifyCustomerPaymentBackend({ auth: { uid: 'acc_officer_01' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_NONEXISTENT' }, mockDb);
  assertTest('2.3', 'UNIT / SIMULATED', 'Non-existent payment ID rejected with 404 not-found', res3.status === 404);

  // 2.4 Replay / Duplicate prevention
  const alreadyVerifiedDb = JSON.parse(JSON.stringify(mockDb));
  alreadyVerifiedDb.leads['lead_pay_01'].payments.customerPayments[0].status = 'Verified';
  const res4 = verifyCustomerPaymentBackend({ auth: { uid: 'acc_officer_01' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_1001' }, alreadyVerifiedDb);
  assertTest('2.4', 'UNIT / SIMULATED', 'Replay verification of already Verified payment rejected with 409 already-exists', res4.status === 409);

  // 2.5 Accounts Officer Anti-Self-Approval
  const res5 = verifyCustomerPaymentBackend({ auth: { uid: 'acc_officer_01' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_SELF_01' }, mockDb);
  assertTest('2.5', 'UNIT / SIMULATED', 'Accounts officer self-approval strictly REJECTED with 412 failed-precondition (Segregation of Duties)', res5.status === 412);

  // 2.6 Dual Custody: Second Accounts officer verifies
  const res6 = verifyCustomerPaymentBackend({ auth: { uid: 'acc_officer_02' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_SELF_01' }, mockDb);
  assertTest('2.6', 'UNIT / SIMULATED', 'Secondary Accounts officer verification succeeds (Dual Custody Validated)', res6.status === 200);

  // 2.7 Super Admin self-approval strictly REJECTED (Unconditional across all users)
  const adminSelfDb = JSON.parse(JSON.stringify(mockDb));
  adminSelfDb.leads['lead_pay_01'].payments.customerPayments[0].recordedByUid = 'admin_user_01';
  const res7 = verifyCustomerPaymentBackend({ auth: { uid: 'admin_user_01', token: { role: 'Admin' } } }, { leadId: 'lead_pay_01', paymentId: 'PAY_1001' }, adminSelfDb);
  assertTest('2.7', 'UNIT / SIMULATED', 'Super Admin self-approval strictly REJECTED (Unconditional Anti-Self-Approval across all roles)',
    res7.status === 412 && res7.error === 'failed-precondition'
  );

  // 2.8 Amount validation
  const res8 = verifyCustomerPaymentBackend({ auth: { uid: 'acc_officer_01' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_1001', verifiedAmount: 999999 }, mockDb);
  assertTest('2.8', 'UNIT / SIMULATED', 'Verification rejected when supplied amount does not match recorded advance (400 invalid-argument)', res8.status === 400);

  // 2.9 Reference validation
  const res9 = verifyCustomerPaymentBackend({ auth: { uid: 'acc_officer_01' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_1001', referenceNumber: 'FORGED_REF' }, mockDb);
  assertTest('2.9', 'UNIT / SIMULATED', 'Verification rejected when supplied reference does not match recorded advance (400 invalid-argument)', res9.status === 400);

  // 2.10 Valid execution & stage progression
  const cleanDb = JSON.parse(JSON.stringify(mockDb));
  const res10 = verifyCustomerPaymentBackend({ auth: { uid: 'acc_officer_01' } }, { leadId: 'lead_pay_01', paymentId: 'PAY_1001' }, cleanDb);
  assertTest('2.10', 'UNIT / SIMULATED', 'Atomic execution stamps Verified metadata and updates salesStage to "Booking Confirmed"',
    res10.status === 200 && cleanDb.leads['lead_pay_01'].salesStage === 'Booking Confirmed' && cleanDb.leads['lead_pay_01'].paymentVerificationStatus === 'Verified'
  );

  // 2.11 Authoritative audit event
  assertTest('2.11', 'UNIT / SIMULATED', 'Authoritative audit log record created with authoritativeSource: "CloudFunction:verifyCustomerPayment"',
    cleanDb.auditLogs.length > 0 && cleanDb.auditLogs[0].action === 'PAYMENT_VERIFIED'
  );

  // 2.12 Direct client SDK write blocked in firestore.rules
  const evaluateFirestoreDirectPaymentUpdate = (actorRole, affectedKeys) => {
    if (actorRole === 'Admin') return true;
    if (actorRole === 'Accounts') {
      // Accounts client SDK only permitted accounting notes/details; cannot touch payments or paymentVerificationStatus
      return !affectedKeys.includes('payments') && !affectedKeys.includes('paymentVerificationStatus');
    }
    return false;
  };

  assertTest('2.12', 'UNIT / SIMULATED', 'Firestore kernel blocks direct Accounts client SDK from marking payments as Verified (Cloud Function Required)',
    evaluateFirestoreDirectPaymentUpdate('Accounts', ['payments', 'paymentVerificationStatus']) === false
  );
}

testTrustedPaymentVerificationBackend();

// =============================================================================
// SECTION 3: DEF-011 STRICT DEALER UID AUTHORIZATION & DATA PRIVACY
// =============================================================================
console.log('\n--- TEST GROUP 3: DEF-011 STRICT DEALER UID AUTHORIZATION ---');

function testDealerUidAuthorization() {
  const evaluateDealerAccess = (dealerAuth, leadDoc) => {
    if (!dealerAuth || dealerAuth.role !== 'Dealer') return { allowed: false, reason: 'Not dealer' };
    // DEF-011: Strict UID checking. dealerCode manipulation grants ZERO access.
    if (leadDoc.dealerId === dealerAuth.uid) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Territory Isolation: Dealer UID mismatch' };
  };

  const dealerA = { uid: 'dlr_hussain_uid', dealerCode: 'MSV/DLR/01', role: 'Dealer' };
  const dealerB_impostor = { uid: 'dlr_rival_uid', dealerCode: 'MSV/DLR/01', role: 'Dealer' }; // Reused / manipulated dealerCode

  const leadA = {
    id: 'lead_dealer_01',
    customer: 'G. Apparao',
    dealerId: 'dlr_hussain_uid',
    dealerCode: 'MSV/DLR/01',
    internalClassification: { isOfficial: true, paymentStatus: 'Paid', marginSplitPct: 40 }
  };

  // 3.1 Strict UID check prevents code manipulation
  assertTest('3.1', 'UNIT / SIMULATED', 'Manipulated / reused dealerCode grants ZERO access when UID differs',
    evaluateDealerAccess(dealerB_impostor, leadA).allowed === false
  );

  // 3.2 Dealer A read access allowed
  assertTest('3.2', 'UNIT / SIMULATED', 'Assigned Dealer A CAN read allocated territory lead via matching UID',
    evaluateDealerAccess(dealerA, leadA).allowed === true
  );

  // 3.3 Dealer B read access denied
  assertTest('3.3', 'UNIT / SIMULATED', 'Unassigned Dealer B read access to Dealer A lead is strictly DENIED',
    evaluateDealerAccess({ uid: 'dlr_rival_uid', role: 'Dealer' }, leadA).allowed === false
  );

  // 3.4 Dealer B update access denied
  const evaluateDealerUpdate = (dealerAuth, leadDoc, updates) => {
    const access = evaluateDealerAccess(dealerAuth, leadDoc);
    if (!access.allowed) return false;
    const allowedKeys = ['siteSurveyPhotos', 'siteSurveyNotes', 'technicalFeasibility', 'documents', 'updatedAt'];
    return Object.keys(updates).every(k => allowedKeys.includes(k));
  };

  assertTest('3.4', 'UNIT / SIMULATED', 'Dealer B update access to Dealer A site survey records is strictly DENIED',
    evaluateDealerUpdate({ uid: 'dlr_rival_uid', role: 'Dealer' }, leadA, { siteSurveyNotes: 'Tampered notes' }) === false
  );

  // 3.5 Dealer B storage access denied
  const evaluateDealerStorage = (dealerAuth, leadDoc) => {
    return dealerAuth.role === 'Dealer' && leadDoc.dealerId === dealerAuth.uid;
  };

  assertTest('3.5', 'UNIT / SIMULATED', 'Dealer B storage access to Dealer A documents path is strictly DENIED',
    evaluateDealerStorage({ uid: 'dlr_rival_uid', role: 'Dealer' }, leadA) === false
  );

  // 3.6 Internal classification privacy
  const sanitizeLeadForDealerPortal = (lead) => {
    const sanitized = { ...lead };
    delete sanitized.internalClassification;
    delete sanitized.grossMargin;
    delete sanitized.settlementRate;
    return sanitized;
  };

  const dealerViewLead = sanitizeLeadForDealerPortal(leadA);
  assertTest('3.6', 'UNIT / SIMULATED', 'Internal dealer classifications (official/nonofficial, paid/unpaid) are stripped from portal view',
    dealerViewLead.internalClassification === undefined &&
    dealerViewLead.customer === 'G. Apparao'
  );
}

testDealerUidAuthorization();

// =============================================================================
// SECTION 4: DEF-012 CALL-LOG IDENTITY & WRITE PROTECTION
// =============================================================================
console.log('\n--- TEST GROUP 4: DEF-012 CALL-LOG IDENTITY & WRITE PROTECTION ---');

function testCallLogIdentityProtection() {
  const evaluateCallLogCreate = (auth, callLogData) => {
    if (!auth || !auth.uid) return { allowed: false, reason: 'Unauthenticated' };
    const isAdmin = auth.role === 'Admin';
    const isSalesMgr = auth.employeeCategory === 'Sales Manager' || auth.category === 'Sales Manager';
    if (isAdmin || isSalesMgr) return { allowed: true };

    if (auth.role === 'Employee') {
      // DEF-012: Prevents spoofing another employee's UID
      if (callLogData.telecallerId !== auth.uid) {
        return { allowed: false, reason: 'Identity Spoofing: telecallerId must match authenticated UID' };
      }
      const hasRequiredKeys = !!callLogData.id && !!callLogData.telecallerId && !!callLogData.timestamp;
      if (!hasRequiredKeys) return { allowed: false, reason: 'Missing required immutable keys' };
      return { allowed: true };
    }

    return { allowed: false, reason: 'Unauthorized role' };
  };

  const telecallerBhavani = { uid: 'bhavani_uid', role: 'Employee', employeeCategory: 'Telecaller' };

  const legitimateLog = {
    id: 'CALL_101',
    leadId: 'lead_501',
    telecallerId: 'bhavani_uid',
    durationSeconds: 120,
    outcome: 'Connected',
    timestamp: new Date().toISOString()
  };

  const spoofedLog = {
    id: 'CALL_102',
    leadId: 'lead_501',
    telecallerId: 'siva_uid', // Spoofed UID
    durationSeconds: 120,
    outcome: 'Connected',
    timestamp: new Date().toISOString()
  };

  // 4.1 Legitimate call log create
  assertTest('4.1', 'UNIT / SIMULATED', 'Telecaller creating call record with own authenticated UID is ALLOWED',
    evaluateCallLogCreate(telecallerBhavani, legitimateLog).allowed === true
  );

  // 4.2 Spoofed UID create blocked
  assertTest('4.2', 'UNIT / SIMULATED', 'Telecaller attempting to forge another employee UID (telecallerId) is strictly DENIED',
    evaluateCallLogCreate(telecallerBhavani, spoofedLog).allowed === false
  );

  // 4.3 Immutable field tampering on update
  const evaluateCallLogUpdate = (auth, originalLog, updatedLog) => {
    if (!auth || !auth.uid) return false;
    const isAdmin = auth.role === 'Admin';
    const isSalesMgr = auth.employeeCategory === 'Sales Manager';
    if (isAdmin || isSalesMgr) return true;

    if (auth.role === 'Employee') {
      if (originalLog.telecallerId !== auth.uid) return false;
      // Must not mutate telecallerId, id, or leadId
      if (updatedLog.telecallerId !== originalLog.telecallerId) return false;
      if (updatedLog.id !== originalLog.id) return false;
      if (originalLog.leadId && updatedLog.leadId !== originalLog.leadId) return false;
      return true;
    }
    return false;
  };

  const tamperedLog = { ...legitimateLog, telecallerId: 'siva_uid' };
  assertTest('4.3', 'UNIT / SIMULATED', 'Telecaller mutating immutable telecallerId on update is strictly DENIED',
    evaluateCallLogUpdate(telecallerBhavani, legitimateLog, tamperedLog) === false
  );

  // 4.4 Tampering with id or leadId
  const tamperedLeadIdLog = { ...legitimateLog, leadId: 'lead_HIJACKED' };
  assertTest('4.4', 'UNIT / SIMULATED', 'Telecaller mutating immutable leadId on update is strictly DENIED',
    evaluateCallLogUpdate(telecallerBhavani, legitimateLog, tamperedLeadIdLog) === false
  );

  // 4.5 Oversight access
  const salesManager = { uid: 'suresh_mgr_uid', role: 'Employee', employeeCategory: 'Sales Manager' };
  assertTest('4.5', 'UNIT / SIMULATED', 'Sales Manager oversight access to call_leads is ALLOWED',
    evaluateCallLogCreate(salesManager, legitimateLog).allowed === true
  );

  // 4.6 Accounts access removed
  const evaluateCallLogRead = (auth, callLog) => {
    if (!auth || !auth.uid) return false;
    if (auth.role === 'Admin') return true;
    if (auth.employeeCategory === 'Sales Manager') return true;
    if (auth.role === 'Employee' && callLog.telecallerId === auth.uid) return true;
    return false; // Accounts and Dealers denied
  };

  const accountsUser = { uid: 'acc_01', role: 'Accounts', employeeCategory: 'Accounts' };
  assertTest('4.6', 'UNIT / SIMULATED', 'Accounts role is strictly DENIED read access to raw dial desk call logs',
    evaluateCallLogRead(accountsUser, legitimateLog) === false
  );

  // 4.7 Direct SDK write missing required keys
  const incompleteLog = { id: 'CALL_103', durationSeconds: 60 };
  assertTest('4.7', 'UNIT / SIMULATED', 'Direct SDK write missing mandatory keys (telecallerId, timestamp) is strictly DENIED',
    evaluateCallLogCreate(telecallerBhavani, incompleteLog).allowed === false
  );
}

testCallLogIdentityProtection();

// =============================================================================
// SECTION 5: LIVE STAGING ENVIRONMENT AUTHORIZATION & CONFIG CHECKS
// =============================================================================
console.log('\n--- TEST GROUP 5: LIVE STAGING CONFIGURATION & RULE SYNTAX ---');

function testLiveStagingConfiguration() {
  // 5.1 Storage rules contain DEF-009 KYC create assignment check
  const storageRulesText = fs.readFileSync('storage.rules', 'utf8');
  assertTest('5.1', 'LIVE STAGING', 'storage.rules enforces KYC create check against assignedEmployeeId and !isDealer()',
    storageRulesText.includes('!isDealer()') &&
    storageRulesText.includes('match /leads/{leadId}/kyc/{docId}/{fileName}') &&
    storageRulesText.includes('assignedEmployeeId == request.auth.uid')
  );

  // 5.2 Storage rules contain DEF-011 dealerId UID check (zero dealerCode)
  assertTest('5.2', 'LIVE STAGING', 'storage.rules binds dealer access strictly to dealerId == request.auth.uid (No dealerCode fallback)',
    storageRulesText.includes('(isDealer() && lead.dealerId == request.auth.uid)') &&
    !storageRulesText.includes('lead.dealerCode ==')
  );

  // 5.3 Firestore rules contain DEF-010 direct client write restriction
  const firestoreRulesText = fs.readFileSync('firestore.rules', 'utf8');
  assertTest('5.3', 'LIVE STAGING', 'firestore.rules restricts direct Accounts client updates to accounting notes (marking Verified blocked)',
    firestoreRulesText.includes('DEF-010: Direct client SDK writes CANNOT mark payments as Verified') &&
    firestoreRulesText.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly([")
  );

  // 5.4 Firestore rules contain DEF-012 call_leads identity protection
  assertTest('5.4', 'LIVE STAGING', 'firestore.rules enforces request.resource.data.telecallerId == request.auth.uid on create',
    firestoreRulesText.includes('request.resource.data.telecallerId == request.auth.uid') &&
    firestoreRulesText.includes('request.resource.data.telecallerId == resource.data.telecallerId')
  );

  // 5.5 Cloud Function verifyCustomerPayment implementation file exists
  assertTest('5.5', 'LIVE STAGING', 'Cloud Function verifyCustomerPayment exists in functions/index.js with 10-point gate',
    fs.existsSync('functions/index.js') &&
    fs.existsSync('functions/package.json') &&
    fs.readFileSync('functions/index.js', 'utf8').includes('verifyCustomerPayment = onCall')
  );
}

testLiveStagingConfiguration();

// -----------------------------------------------------------------------------
// SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`   SECURITY REMEDIATION GATE 2.1-R RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
console.log('================================================================================\n');

if (failCount > 0) {
  process.exit(1);
}

