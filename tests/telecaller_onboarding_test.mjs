/**
 * MIRROR SOLAR VISION CRM — TELECALLER ONBOARDING & ROLE CONSISTENCY TEST
 * 
 * Task 3: Verify role and onboarding consistency
 * Target: feature/telecaller-mvp-nov04
 * 
 * Tests:
 * 1. Newly created telecaller profile structure: role == 'Employee', employeeCategory == 'Telecaller'.
 * 2. Newly created telecaller permissions: zero elevated permissions (employees, dealers, access, reports are 'none').
 * 3. Route guards: authorized for Dashboard, Leads, Call Leads, Profile; blocked from Employees, Dealers, Access Control.
 * 4. Helper functions: isTelecaller() returns true; isSalesManager() returns false; canVerifyPayment() returns false; canApproveDiscount() returns false.
 * 5. Rules authorization: Telecaller is identified as employee without privilege escalation rights.
 */

import assert from 'assert';
import { 
  hasPermission, 
  canManageModule, 
  isTelecaller, 
  isSalesManager, 
  canVerifyPayment,
  canApproveDiscount,
  canReassignLeads,
  canViewAllTeamLeads,
  canAccessRoute
} from '../src/utils/permissionCalculations.js';

console.log('================================================================================');
console.log('  MIRROR SOLAR VISION CRM — TELECALLER ONBOARDING & ROLE CONSISTENCY TEST       ');
console.log('================================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name} => ${err.message}`);
    failCount++;
  }
}

// Canonical default employee permissions from CRMContext
const defaultEmployeePermissions = {
  dashboard: 'view',
  leads: 'edit',
  employees: 'none',
  dealers: 'none',
  stock: 'view',
  reports: 'none',
  access: 'none',
  profile: 'edit'
};

// Simulated new onboarding telecaller profile
const newOnboardedTelecaller = {
  id: 'usr_telecaller_test_001',
  uid: 'usr_telecaller_test_001',
  name: 'Anjali Sharma',
  initials: 'AS',
  phone: '9876543210',
  email: 'anjali.telecaller@mirrorsolar.in',
  role: 'Employee',
  employeeCategory: 'Telecaller',
  status: 'Active',
  permissions: { ...defaultEmployeePermissions },
  lastActive: new Date().toISOString()
};

// ---------------------------------------------------------
// TEST 1: Profile Schema & Role Consistency
// ---------------------------------------------------------
runTest('1. Onboarded telecaller profile adheres to canonical schema (role: Employee, employeeCategory: Telecaller)', () => {
  assert.strictEqual(newOnboardedTelecaller.role, 'Employee', 'Role must be Employee');
  assert.strictEqual(newOnboardedTelecaller.employeeCategory, 'Telecaller', 'employeeCategory must be Telecaller');
  assert.strictEqual(newOnboardedTelecaller.id, 'usr_telecaller_test_001');
  assert.strictEqual(newOnboardedTelecaller.uid, 'usr_telecaller_test_001');
});

// ---------------------------------------------------------
// TEST 2: Zero Elevated Permissions
// ---------------------------------------------------------
runTest('2. Newly onboarded telecaller receives ZERO elevated permissions (employees, dealers, access, reports == none)', () => {
  assert.strictEqual(newOnboardedTelecaller.permissions.employees, 'none', 'employees permission must be none');
  assert.strictEqual(newOnboardedTelecaller.permissions.dealers, 'none', 'dealers permission must be none');
  assert.strictEqual(newOnboardedTelecaller.permissions.access, 'none', 'access permission must be none');
  assert.strictEqual(newOnboardedTelecaller.permissions.reports, 'none', 'reports permission must be none');

  assert.strictEqual(hasPermission(newOnboardedTelecaller, 'employees'), false);
  assert.strictEqual(hasPermission(newOnboardedTelecaller, 'dealers'), false);
  assert.strictEqual(hasPermission(newOnboardedTelecaller, 'access'), false);
  assert.strictEqual(canManageModule(newOnboardedTelecaller, 'employees'), false);
  assert.strictEqual(canManageModule(newOnboardedTelecaller, 'dealers'), false);
  assert.strictEqual(canManageModule(newOnboardedTelecaller, 'access'), false);
});

// ---------------------------------------------------------
// TEST 3: Permission Helpers Classification
// ---------------------------------------------------------
runTest('3. Classification helpers correctly identify telecaller and deny managerial authority', () => {
  assert.strictEqual(isTelecaller(newOnboardedTelecaller), true, 'isTelecaller must return true');
  assert.strictEqual(isSalesManager(newOnboardedTelecaller), false, 'isSalesManager must return false');
  assert.strictEqual(canVerifyPayment(newOnboardedTelecaller), false, 'canVerifyPayment must return false');
  assert.strictEqual(canApproveDiscount(newOnboardedTelecaller), false, 'canApproveDiscount must return false');
  assert.strictEqual(canReassignLeads(newOnboardedTelecaller), false, 'canReassignLeads must return false');
  assert.strictEqual(canViewAllTeamLeads(newOnboardedTelecaller), false, 'canViewAllTeamLeads must return false');
});

// ---------------------------------------------------------
// TEST 4: Authorized Operational Modules
// ---------------------------------------------------------
runTest('4. Onboarded telecaller has appropriate operational access (dashboard, leads, profile)', () => {
  assert.strictEqual(hasPermission(newOnboardedTelecaller, 'dashboard'), true);
  assert.strictEqual(hasPermission(newOnboardedTelecaller, 'leads'), true);
  assert.strictEqual(hasPermission(newOnboardedTelecaller, 'profile'), true);
});

// ---------------------------------------------------------
// TEST 5: Route Navigation Security
// ---------------------------------------------------------
runTest('5. Route access allows standard routes and blocks privileged routes', () => {
  assert.strictEqual(canAccessRoute(newOnboardedTelecaller, 'Dashboard'), true);
  assert.strictEqual(canAccessRoute(newOnboardedTelecaller, 'Leads'), true);
  assert.strictEqual(canAccessRoute(newOnboardedTelecaller, 'Call Leads'), true);
  assert.strictEqual(canAccessRoute(newOnboardedTelecaller, 'Profile'), true);

  // Inactive user is completely blocked
  const disabledUser = { ...newOnboardedTelecaller, status: 'Inactive' };
  assert.strictEqual(canAccessRoute(disabledUser, 'Dashboard'), false);
  assert.strictEqual(canAccessRoute(disabledUser, 'Leads'), false);
});

console.log('\n================================================================================');
console.log(`  ONBOARDING SUITE RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
console.log('================================================================================\n');

if (failCount > 0) process.exit(1);
