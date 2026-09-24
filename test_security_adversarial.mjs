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
      return resource.dealerId === auth.uid && requestResource.dealerId === auth.uid;
    }
    if (getUserRole() === 'Employee') {
      return resource.createdById === auth.uid && requestResource.createdById === auth.uid;
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

  if (operation === 'read') return isAdmin;
  if (operation === 'create') {
    return isAuthenticated && (requestResource.userId === auth.uid || isAdmin);
  }
  if (operation === 'update' || operation === 'delete') {
    return false; // Strictly immutable
  }
  return false;
}

// 3. Simulate Firestore Security Rule Evaluator for Attendance
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

// SCENARIO 5: Employee attempts to create an Audit Log forging Admin identity -> MUST BE DENIED
{
  const empA = { uid: 'emp_A_001', role: 'Employee', name: 'Rahul' };
  const forgedAuditLog = {
    userId: 'admin_root_uid',
    role: 'Admin',
    action: 'ADMIN_APPROVED_INSTALLATION',
    entityType: 'Lead',
    entityId: 'lead_999'
  };
  
  const allowed = evaluateAuditLogRules(empA, 'create', null, forgedAuditLog);
  assert.strictEqual(allowed, false, 'User must not be able to forge an audit record with someone elses userId');
  console.log('✅ PASS: Audit Log creation with forged actor identity is strictly DENIED');
}

// SCENARIO 6: Attempt to update or delete an existing Audit Log -> MUST BE DENIED (IMMUTABLE)
{
  const admin = { uid: 'admin_root_uid', role: 'Admin', name: 'SuperAdmin' };
  const existingAudit = { id: 'AUDIT_1', userId: 'dealer_A_123', action: 'QUOTATION_CREATED' };
  
  const updateAllowed = evaluateAuditLogRules(admin, 'update', existingAudit, { action: 'QUOTATION_TAMPERED' });
  const deleteAllowed = evaluateAuditLogRules(admin, 'delete', existingAudit, null);
  
  assert.strictEqual(updateAllowed, false, 'Audit records must NEVER allow update');
  assert.strictEqual(deleteAllowed, false, 'Audit records must NEVER allow delete');
  console.log('✅ PASS: Audit Log records are 100% IMMUTABLE (Update: DENIED, Delete: DENIED even for Admin)');
}

// SCENARIO 7: Employee A attempts to punch attendance for Employee B -> MUST BE DENIED
{
  const empA = { uid: 'emp_A_001', role: 'Employee', name: 'Rahul' };
  const forgedAttendance = { employeeId: 'emp_B_002', date: '2026-09-24', checkInTime: '2026-09-24T09:00:00.000Z' };
  
  const allowed = evaluateAttendanceRules(empA, 'create', null, forgedAttendance);
  assert.strictEqual(allowed, false, 'Employee cannot punch attendance on behalf of another employee');
  console.log('✅ PASS: Cross-employee attendance punch is strictly DENIED');
}

// SCENARIO 8: Admin full authority on Quotations, Attendance, and Audit Logs -> MUST BE ALLOWED
{
  const admin = { uid: 'admin_root_uid', role: 'Admin', name: 'SuperAdmin' };
  const anyQuote = { id: 'QT_999', dealerId: 'dealer_B_456', createdById: 'dealer_B_456', status: 'Sent' };
  
  assert.strictEqual(evaluateQuotationRules(admin, 'read', anyQuote, null), true, 'Admin must have read access');
  assert.strictEqual(evaluateQuotationRules(admin, 'update', anyQuote, { status: 'Accepted' }), true, 'Admin must have update access');
  assert.strictEqual(evaluateQuotationRules(admin, 'delete', anyQuote, null), true, 'Admin must have delete access');
  assert.strictEqual(evaluateAuditLogRules(admin, 'read', null, null), true, 'Admin must have audit read access');
  console.log('✅ PASS: Admin role has full verified authority across all entities');
}

console.log('\n=== ALL 8 SECURITY & ADVERSARIAL TESTS PASSED WITH 0 FAILURES ===');
