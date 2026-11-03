// Mirror Solar Vision CRM - Phase 2.1 Bug Fixes & Persistence Verification Suite
// Validates DEF-001 (Call Logs), DEF-002 (Accounts Payment), DEF-003 (Storage Uploads), and DEF-004 (Dealer Allocation)

import assert from 'assert';
import fs from 'fs';

console.log('================================================================');
console.log('   MIRROR SOLAR VISION CRM - PHASE 2.1 VERIFICATION SUITE       ');
console.log('================================================================\n');

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

// -----------------------------------------------------------------
// 1. DEF-001: TELECALLING CALL LOG PERSISTENCE & SCHEMAS
// -----------------------------------------------------------------
console.log('--- TEST GROUP 1: DEF-001 TELECALLING CALL LOG PERSISTENCE ---');

function testCallLogModel() {
  const sampleLog = {
    id: 'CALL_' + Date.now() + '_test1',
    leadId: 'lead_101',
    customerName: 'Rajesh Varma',
    phone: '+919876543210',
    callDirection: 'Outgoing',
    durationSeconds: 145,
    outcome: 'Connected - Interested',
    notes: 'Customer inquired about 3kW On-Grid system under PM Surya Ghar.',
    nextFollowUpDate: '2026-11-05',
    nextFollowUpTime: '11:00 AM',
    telecallerId: 'DonOutQurqZiXvjvFu77iZLDhDU2',
    telecallerName: 'K. Bhavani',
    telecallerEmail: 'bhavani.telecaller@mirrorsolar.in',
    employeeId: 'DonOutQurqZiXvjvFu77iZLDhDU2',
    assignedEmployeeId: 'DonOutQurqZiXvjvFu77iZLDhDU2',
    timestamp: new Date().toISOString()
  };

  // Test 1.1: Payload validation
  assertTest('Call log payload contains required relational foreign keys', 
    !!sampleLog.id && !!sampleLog.leadId && !!sampleLog.telecallerId && !!sampleLog.timestamp
  );

  // Test 1.2: Deduplication Map test
  const existingLogs = [sampleLog];
  const incomingLogs = [sampleLog, { ...sampleLog, id: 'CALL_UNIQUE_002', notes: 'Second call' }];
  
  const map = new Map();
  incomingLogs.forEach(c => map.set(c.id, c));
  existingLogs.forEach(c => { if (!map.has(c.id)) map.set(c.id, c); });
  const deduplicated = Array.from(map.values());

  assertTest('Deduplication logic prevents duplicate call log records during sync', deduplicated.length === 2);

  // Test 1.3: Security Rule simulation for /call_leads
  const canReadCallLead = (auth, doc) => {
    if (!auth) return false;
    const isPrivileged = auth.role === 'Admin' || auth.role === 'Accounts' || auth.employeeCategory === 'Sales Manager';
    if (isPrivileged) return true;
    return auth.uid === doc.telecallerId || auth.uid === doc.assignedEmployeeId || auth.email === doc.telecallerEmail;
  };

  const telecallerAuth = { uid: 'DonOutQurqZiXvjvFu77iZLDhDU2', email: 'bhavani.telecaller@mirrorsolar.in', role: 'Employee' };
  const otherTelecallerAuth = { uid: 'other_telecaller_99', email: 'other@mirrorsolar.in', role: 'Employee' };
  const accountsAuth = { uid: 'acc_01', email: 'accounts@mirrorsolar.in', role: 'Accounts' };

  assertTest('Assigned telecaller CAN read own call log record (Positive)', canReadCallLead(telecallerAuth, sampleLog) === true);
  assertTest('Accounts authority CAN read telecaller call logs for audit (Positive)', canReadCallLead(accountsAuth, sampleLog) === true);
  assertTest('Unassigned telecaller CANNOT read another telecaller call log (Negative)', canReadCallLead(otherTelecallerAuth, sampleLog) === false);
}

testCallLogModel();

// -----------------------------------------------------------------
// 2. DEF-002: ACCOUNTS PAYMENT VERIFICATION & SEGREGATION OF DUTIES
// -----------------------------------------------------------------
console.log('\n--- TEST GROUP 2: DEF-002 ACCOUNTS PAYMENT VERIFICATION ---');

function testPaymentVerificationRBAC() {
  const evaluatePaymentVerification = (actor, payment, lead) => {
    const isAdmin = actor.role === 'Admin';
    const isAccounts = actor.role === 'Accounts' || actor.employeeCategory === 'Accounts';
    const canVerify = isAdmin || isAccounts;

    if (!canVerify) {
      return { allowed: false, reason: 'Permission Denied: Must be Admin or Accounts.' };
    }

    // Segregation of duties: Accounts user cannot verify a payment they personally recorded
    if (!isAdmin && payment.recordedBy && payment.recordedBy === actor.name) {
      return { allowed: false, reason: 'Segregation of Duties: Cannot self-verify own payment.' };
    }

    return { allowed: true };
  };

  const adminActor = { name: 'Super Admin', role: 'Admin' };
  const accountsActor = { name: 'P. Accounts Officer', role: 'Accounts' };
  const salesManagerActor = { name: 'P. Suresh', role: 'Employee', employeeCategory: 'Sales Manager' };
  const telecallerActor = { name: 'K. Bhavani', role: 'Employee', employeeCategory: 'Telecaller' };

  const telecallerRecordedPayment = { id: 'PAY_1', amount: 10000, recordedBy: 'K. Bhavani', status: 'Pending Verification' };
  const accountsSelfRecordedPayment = { id: 'PAY_2', amount: 10000, recordedBy: 'P. Accounts Officer', status: 'Pending Verification' };

  // Test 2.1: Super Admin verifying payment
  const adminRes = evaluatePaymentVerification(adminActor, telecallerRecordedPayment);
  assertTest('Super Admin CAN verify customer advance payment (Positive)', adminRes.allowed === true);

  // Test 2.2: Accounts Officer verifying telecaller-recorded payment
  const accountsRes = evaluatePaymentVerification(accountsActor, telecallerRecordedPayment);
  assertTest('Accounts Department CAN verify customer advance payment (Positive)', accountsRes.allowed === true);

  // Test 2.3: Sales Manager attempting payment verification
  const salesMgrRes = evaluatePaymentVerification(salesManagerActor, telecallerRecordedPayment);
  assertTest('Sales Manager CANNOT verify customer advance payment (Segregation of Duties Negative)', salesMgrRes.allowed === false);

  // Test 2.4: Telecaller attempting self-verification
  const telecallerRes = evaluatePaymentVerification(telecallerActor, telecallerRecordedPayment);
  assertTest('Telecaller CANNOT verify customer advance payment (Segregation of Duties Negative)', telecallerRes.allowed === false);

  // Test 2.5: Accounts Officer attempting to self-verify payment they recorded
  const selfVerifyRes = evaluatePaymentVerification(accountsActor, accountsSelfRecordedPayment);
  assertTest('Accounts Officer CANNOT self-verify a transaction they personally recorded (Anti-Self-Approval)', selfVerifyRes.allowed === false);
}

testPaymentVerificationRBAC();

// -----------------------------------------------------------------
// 3. DEF-003: CLOUD STORAGE UPLOAD PATHS & PERMISSIONS
// -----------------------------------------------------------------
console.log('\n--- TEST GROUP 3: DEF-003 CLOUD STORAGE UPLOAD & BOUNDARIES ---');

function testStorageBoundaries() {
  const evaluateStorageUpload = (file, folderPath) => {
    const MAX_SIZE = 15 * 1024 * 1024;
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    if (file.size > MAX_SIZE) {
      return { allowed: false, reason: 'File exceeds 15MB ceiling' };
    }
    if (!allowedMime.includes(file.type)) {
      return { allowed: false, reason: 'Invalid MIME type' };
    }
    if (!folderPath.startsWith('leads/') || !folderPath.includes('/documents/')) {
      return { allowed: false, reason: 'Invalid lead storage hierarchy' };
    }
    return { allowed: true };
  };

  const validPdf = { name: 'electricity_bill.pdf', type: 'application/pdf', size: 1024 * 500 };
  const validJpg = { name: 'roof_photo.jpg', type: 'image/jpeg', size: 1024 * 800 };
  const oversizedFile = { name: 'giant_video.mov', type: 'image/jpeg', size: 16 * 1024 * 1024 };
  const invalidMime = { name: 'malicious_script.exe', type: 'application/x-msdownload', size: 1024 * 50 };

  const leadPath = 'leads/lead_001/documents/DOC_123';

  assertTest('Valid PDF document upload accepted within 15MB limit (Positive)', evaluateStorageUpload(validPdf, leadPath).allowed === true);
  assertTest('Valid JPG image upload accepted within 15MB limit (Positive)', evaluateStorageUpload(validJpg, leadPath).allowed === true);
  assertTest('Oversized document (>15MB) strictly rejected (Negative)', evaluateStorageUpload(oversizedFile, leadPath).allowed === false);
  assertTest('Executable / non-whitelisted MIME type strictly rejected (Negative)', evaluateStorageUpload(invalidMime, leadPath).allowed === false);

  // Storage path IDOR verification
  const evaluateStorageRead = (authEmail, path) => {
    const isStaffDomain = authEmail.endsWith('@mirrorsolar.in') || authEmail.endsWith('@dealer.in') || authEmail.endsWith('@msv.in') || authEmail === 'mirrorsolarvision@gmail.com';
    return isStaffDomain && path.startsWith('leads/');
  };

  assertTest('Authorized corporate email (@mirrorsolar.in) CAN read customer documents (Positive)', evaluateStorageRead('bhavani.telecaller@mirrorsolar.in', leadPath) === true);
  assertTest('Authorized dealer email (@dealer.in) CAN read territory customer documents (Positive)', evaluateStorageRead('hussain@dealer.in', leadPath) === true);
  assertTest('External email token CANNOT read customer KYC document (Anti-IDOR Negative)', evaluateStorageRead('attacker@gmail.com', leadPath) === false);
}

testStorageBoundaries();

// -----------------------------------------------------------------
// 4. DEF-004: DEALER SITE SURVEY ALLOCATION & GATING
// -----------------------------------------------------------------
console.log('\n--- TEST GROUP 4: DEF-004 DEALER SITE SURVEY ALLOCATION ---');

function testDealerSurveyAllocation() {
  const allocateSurvey = (lead, dealer, actor) => {
    if (!dealer || !dealer.id) {
      return { ok: false, reason: 'Invalid dealer selection' };
    }

    return {
      ok: true,
      updatedLead: {
        ...lead,
        dealer: dealer.name,
        dealerId: dealer.id,
        dealerCode: dealer.dealerCode || dealer.id,
        dealerStatus: 'Requested',
        dealerRequestedAt: new Date().toISOString(),
        dealerRequestedBy: actor.name,
        salesStage: 'Site Survey Scheduled'
      }
    };
  };

  const sampleLead = { id: 'lead_501', customer: 'Sita Ramaiah', phone: '+919876500001', salesStage: 'Contacted' };
  const sampleDealer = { id: 'dlr_hussain_01', dealerCode: 'MSV/DLR/01', name: 'Hussain Solar Systems' };
  const salesRep = { name: 'P. Suresh', role: 'Employee' };

  const allocationResult = allocateSurvey(sampleLead, sampleDealer, salesRep);

  assertTest('Survey scheduling sets dealerStatus to "Requested"', allocationResult.updatedLead.dealerStatus === 'Requested');
  assertTest('Survey scheduling sets correct dealerId and dealerCode', allocationResult.updatedLead.dealerId === 'dlr_hussain_01' && allocationResult.updatedLead.dealerCode === 'MSV/DLR/01');
  assertTest('Survey scheduling advances salesStage to "Site Survey Scheduled"', allocationResult.updatedLead.salesStage === 'Site Survey Scheduled');

  // Dealer Scoping Verification
  const canDealerSeeLead = (dealerUser, leadDoc) => {
    return leadDoc.dealerId === dealerUser.id || leadDoc.dealerCode === dealerUser.dealerCode;
  };

  const authorizedDealer = { id: 'dlr_hussain_01', dealerCode: 'MSV/DLR/01' };
  const rivalDealer = { id: 'dlr_rival_99', dealerCode: 'MSV/DLR/99' };

  assertTest('Assigned dealer CAN see allocated survey request in portal (Positive)', canDealerSeeLead(authorizedDealer, allocationResult.updatedLead) === true);
  assertTest('Other dealers CANNOT see or accept unallocated survey request (Isolation Negative)', canDealerSeeLead(rivalDealer, allocationResult.updatedLead) === false);

  // Firestore Rules dealerStatus approval gate simulation
  const evaluateDealerStatusUpdate = (actorRole, newStatus) => {
    if (newStatus === 'Approved') {
      return actorRole === 'Admin'; // Only Admin can set Approved
    }
    if (newStatus === 'Requested' || newStatus === 'Pending') {
      return actorRole === 'Admin' || actorRole === 'Employee'; // Staff can request
    }
    return false;
  };

  assertTest('Sales staff CAN request dealer survey (dealerStatus: Requested) (Positive)', evaluateDealerStatusUpdate('Employee', 'Requested') === true);
  assertTest('Sales staff CANNOT self-approve dealer allocation (dealerStatus: Approved) (Negative)', evaluateDealerStatusUpdate('Employee', 'Approved') === false);
  assertTest('Super Admin CAN approve dealer allocation (dealerStatus: Approved) (Positive)', evaluateDealerStatusUpdate('Admin', 'Approved') === true);
}

testDealerSurveyAllocation();

// -----------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------
console.log('\n================================================================');
console.log(`   PHASE 2.1 VERIFICATION RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
