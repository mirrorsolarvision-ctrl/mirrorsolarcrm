// Automated Security Rules & Adversarial Validation Suite for Solar CRM VNext

import assert from 'assert';

console.log('=== STARTING SECURITY & ADVERSARIAL VALIDATION SUITE ===\n');

// 1. Simulate Firestore Security Rule Evaluator for Quotations
function evaluateQuotationRules(auth, operation, resource, requestResource) {
  const isAuthenticated = auth !== null;
  const isAdmin = isAuthenticated && auth.role === 'Admin';
  const getUserRole = () => auth ? auth.role : null;

  if (operation === 'read') {
    return isAdmin || (
      isAuthenticated && (
        resource.dealerId === auth.uid ||
        resource.createdById === auth.uid ||
        resource.assignedEmployeeId === auth.uid
      )
    );
  }

  if (operation === 'create') {
    return isAuthenticated && (
      isAdmin ||
      (getUserRole() === 'Dealer' && requestResource.dealerId === auth.uid && requestResource.createdById === auth.uid) ||
      (getUserRole() === 'Employee' && requestResource.createdById === auth.uid)
    );
  }

  if (operation === 'update') {
    if (isAdmin) return true;
    if (!isAuthenticated) return false;
    if (resource.status === 'Cancelled') return false;

    if (getUserRole() === 'Dealer') {
      return resource.dealerId === auth.uid && requestResource.dealerId === auth.uid && requestResource.createdById === auth.uid;
    }
    if (getUserRole() === 'Employee') {
      // Employee cannot reassign createdById OR change assignedEmployeeId (only Admin can reassign)
      return resource.createdById === auth.uid && 
             requestResource.createdById === auth.uid &&
             requestResource.assignedEmployeeId === resource.assignedEmployeeId;
    }
    return false;
  }

  if (operation === 'delete') {
    return isAdmin;
  }

  return false;
}

// 2. Simulate Firestore Security Rule Evaluator for Audit Logs
function evaluateAuditLogRules(auth, operation, resource, requestResource) {
  const isAuthenticated = auth !== null;
  const isAdmin = isAuthenticated && auth.role === 'Admin';
  const getUserRole = () => auth ? auth.role : null;

  if (operation === 'read') return isAdmin;
  if (operation === 'create') {
    if (!isAuthenticated) return false;
    if (requestResource.userId !== auth.uid) return false;
    if (requestResource.userRole !== getUserRole()) return false;
    // Check if non-admin is trying to claim an Admin action
    if (requestResource.action && requestResource.action.includes('ADMIN') && !isAdmin) {
      return false;
    }
    return true;
  }
  if (operation === 'update' || operation === 'delete') {
    return false; // Strictly immutable
  }
  return false;
}

// 3. Simulate Firestore Security Rule Evaluator for Attendance & Corrections
function evaluateAttendanceRules(auth, operation, resource, requestResource) {
  const isAuthenticated = auth !== null;
  const isAdmin = isAuthenticated && auth.role === 'Admin';

  if (operation === 'read') {
    return isAdmin || (isAuthenticated && resource.employeeId === auth.uid);
  }
  if (operation === 'create') {
    return isAuthenticated && requestResource.employeeId === auth.uid;
  }
  if (operation === 'update') {
    return isAdmin || (isAuthenticated && resource.employeeId === auth.uid && requestResource.employeeId === auth.uid);
  }
  if (operation === 'delete') {
    return isAdmin;
  }
  return false;
}

function evaluateCorrectionRules(auth, operation, resource, requestResource) {
  const isAuthenticated = auth !== null;
  const isAdmin = isAuthenticated && auth.role === 'Admin';

  if (operation === 'read') {
    return isAdmin || (isAuthenticated && resource.employeeId === auth.uid);
  }
  if (operation === 'create') {
    return isAuthenticated && requestResource.employeeId === auth.uid && requestResource.status === 'PENDING';
  }
  if (operation === 'update') {
    return isAdmin; // Only admin can approve/reject!
  }
  if (operation === 'delete') {
    return isAdmin;
  }
  return false;
}

// --- TEST SCENARIOS ---

// SCENARIO 1: Dealer A attempts to read Dealer B's quotation -> MUST BE DENIED
{
  const dealerA = { uid: 'dealer_A_123', role: 'Dealer', name: 'Sri Solar' };
  const dealerBQuote = { id: 'QT_999', dealerId: 'dealer_B_456', createdById: 'dealer_B_456', status: 'Sent' };
  
  const allowed = evaluateQuotationRules(dealerA, 'read', dealerBQuote, null);
  assert.strictEqual(allowed, false, 'Dealer A should NOT be able to read Dealer B quotation');
  console.log('✅ PASS: Dealer A read access to Dealer B quotation is strictly DENIED');
}

// SCENARIO 2: Dealer A attempts to create a quotation assigned to Dealer B -> MUST BE DENIED
{
  const dealerA = { uid: 'dealer_A_123', role: 'Dealer', name: 'Sri Solar' };
  const forgedQuotePayload = { id: 'QT_NEW', dealerId: 'dealer_B_456', createdById: 'dealer_A_123', status: 'Draft' };
  
  const allowed = evaluateQuotationRules(dealerA, 'create', null, forgedQuotePayload);
  assert.strictEqual(allowed, false, 'Dealer A should NOT be able to create quote claiming Dealer B dealerId');
  console.log('✅ PASS: Dealer A spoofing Dealer B dealerId during create is strictly DENIED');
}

// SCENARIO 3: Dealer A attempts to update own quotation to reassign dealerId to Dealer B -> MUST BE DENIED
{
  const dealerA = { uid: 'dealer_A_123', role: 'Dealer', name: 'Sri Solar' };
  const existingQuote = { id: 'QT_101', dealerId: 'dealer_A_123', createdById: 'dealer_A_123', status: 'Draft' };
  const forgedUpdatePayload = { id: 'QT_101', dealerId: 'dealer_B_456', createdById: 'dealer_A_123', status: 'Draft' };
  
  const allowed = evaluateQuotationRules(dealerA, 'update', existingQuote, forgedUpdatePayload);
  assert.strictEqual(allowed, false, 'Dealer A should NOT be able to reassign quotation to Dealer B on update');
  console.log('✅ PASS: Dealer A reassigning dealerId to Dealer B on update is strictly DENIED');
}

// SCENARIO 4: Employee A attempts to read Employee B's quotation -> MUST BE DENIED
{
  const empA = { uid: 'emp_A_001', role: 'Employee', name: 'Rahul' };
  const empBQuote = { id: 'QT_555', dealerId: null, createdById: 'emp_B_002', assignedEmployeeId: 'emp_B_002', status: 'Draft' };
  
  const allowed = evaluateQuotationRules(empA, 'read', empBQuote, null);
  assert.strictEqual(allowed, false, 'Employee A should NOT be able to read Employee B quotation');
  console.log('✅ PASS: Employee A reading Employee B quotation is strictly DENIED');
}

// SCENARIO 5: Employee attempts to reassign assignedEmployeeId on update -> MUST BE DENIED
{
  const empA = { uid: 'emp_A_001', role: 'Employee', name: 'Rahul' };
  const existingQuote = { id: 'QT_555', dealerId: null, createdById: 'emp_A_001', assignedEmployeeId: 'emp_A_001', status: 'Draft' };
  const forgedUpdate = { id: 'QT_555', dealerId: null, createdById: 'emp_A_001', assignedEmployeeId: 'emp_B_002', status: 'Draft' };

  const allowed = evaluateQuotationRules(empA, 'update', existingQuote, forgedUpdate);
  assert.strictEqual(allowed, false, 'Employee cannot reassign assignedEmployeeId (Only Admin permitted)');
  console.log('✅ PASS: Employee unauthorized quotation reassignment is strictly DENIED');
}

// SCENARIO 6: Non-admin attempts to create an Audit Log with their own UID but claiming an ADMIN action -> MUST BE DENIED
{
  const dealerA = { uid: 'dealer_A_123', role: 'Dealer', name: 'Sri Solar' };
  const spoofedAuditLog = {
    userId: 'dealer_A_123', // matching UID
    userRole: 'Dealer',
    action: 'ADMIN_APPROVED_INSTALLATION', // Admin action spoof!
    entityType: 'Lead',
    entityId: 'lead_999'
  };
  
  const allowed = evaluateAuditLogRules(dealerA, 'create', null, spoofedAuditLog);
  assert.strictEqual(allowed, false, 'Non-admin cannot create an audit entry with an ADMIN action');
  console.log('✅ PASS: Audit Log write path prevents non-admin from creating ADMIN actions');
}

// SCENARIO 7: Non-admin attempts to forge userRole in Audit Log -> MUST BE DENIED
{
  const dealerA = { uid: 'dealer_A_123', role: 'Dealer', name: 'Sri Solar' };
  const forgedRoleAuditLog = {
    userId: 'dealer_A_123',
    userRole: 'Admin', // Forged role!
    action: 'QUOTATION_EDITED',
    entityType: 'Quotation',
    entityId: 'qt_123'
  };
  
  const allowed = evaluateAuditLogRules(dealerA, 'create', null, forgedRoleAuditLog);
  assert.strictEqual(allowed, false, 'User cannot forge userRole in audit log');
  console.log('✅ PASS: Audit Log write path prevents userRole forgery');
}

// SCENARIO 8: Attempt to update or delete an existing Audit Log -> MUST BE DENIED (IMMUTABLE)
{
  const admin = { uid: 'admin_root_uid', role: 'Admin', name: 'SuperAdmin' };
  const existingAudit = { id: 'AUDIT_1', userId: 'dealer_A_123', action: 'QUOTATION_CREATED' };
  
  const updateAllowed = evaluateAuditLogRules(admin, 'update', existingAudit, { action: 'QUOTATION_TAMPERED' });
  const deleteAllowed = evaluateAuditLogRules(admin, 'delete', existingAudit, null);
  
  assert.strictEqual(updateAllowed, false, 'Audit records must NEVER allow update');
  assert.strictEqual(deleteAllowed, false, 'Audit records must NEVER allow delete');
  console.log('✅ PASS: Audit Log records are 100% IMMUTABLE (Update: DENIED, Delete: DENIED even for Admin)');
}

// SCENARIO 9: Employee attempts to self-approve Attendance Correction -> MUST BE DENIED
{
  const empA = { uid: 'emp_A_001', role: 'Employee', name: 'Rahul' };
  const existingCorr = { id: 'CORR_1', employeeId: 'emp_A_001', date: '2026-09-24', status: 'PENDING' };
  const selfApprovePayload = { ...existingCorr, status: 'APPROVED' };

  const allowed = evaluateCorrectionRules(empA, 'update', existingCorr, selfApprovePayload);
  assert.strictEqual(allowed, false, 'Employee CANNOT self-approve attendance corrections');
  console.log('✅ PASS: Attendance correction self-approval by employee is strictly DENIED');
}

// SCENARIO 10: Admin approving Attendance Correction -> MUST BE ALLOWED
{
  const admin = { uid: 'admin_root_uid', role: 'Admin', name: 'SuperAdmin' };
  const existingCorr = { id: 'CORR_1', employeeId: 'emp_A_001', date: '2026-09-24', status: 'PENDING' };
  const approvePayload = { ...existingCorr, status: 'APPROVED', reviewedBy: 'Admin' };

  const allowed = evaluateCorrectionRules(admin, 'update', existingCorr, approvePayload);
  assert.strictEqual(allowed, true, 'Admin MUST be allowed to approve attendance corrections');
  console.log('✅ PASS: Admin attendance correction approval is ALLOWED');
}

console.log('\n=== ALL 10 SECURITY & ADVERSARIAL TESTS PASSED WITH 0 FAILURES ===');
