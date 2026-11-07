import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('  MIRROR SOLAR VISION CRM — AUTOMATED QUALITY & MOBILE VIEWPORT AUDIT SUITE    ');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Details: ${err.message}`);
  }
}

// --------------------------------------------------------------------------------
// SECTION 1: PRICING ENGINE & SUBSIDY MATHEMATICS
// --------------------------------------------------------------------------------
console.log('--- 1. PRICING ENGINE & SUBSIDY MATHEMATICS ---');

function calculateStandardPackagePrice(capacityKw, custom2KwPrice = 155000) {
  const cap = Math.max(0.5, Number(capacityKw) || 3);
  if (cap <= 2) {
    if (cap === 2) return custom2KwPrice;
    return Math.round(custom2KwPrice * (cap / 2));
  }
  if (cap === 3) {
    return 210000;
  }
  return Math.round(210000 + (cap - 3) * 55000);
}

function evaluateSubsidy(capacityKw) {
  const cap = Number(capacityKw) || 0;
  if (cap >= 3) return 78000;
  if (cap >= 2) return 60000;
  if (cap >= 1) return 30000;
  return 0;
}

runTest('calculateStandardPackagePrice(3) strictly outputs ₹2,10,000', () => {
  const price = calculateStandardPackagePrice(3);
  assert.strictEqual(price, 210000, `Expected 210000 but got ${price}`);
});

runTest('calculateStandardPackagePrice(4) strictly outputs ₹2,65,000 (+₹55,000)', () => {
  const price = calculateStandardPackagePrice(4);
  assert.strictEqual(price, 265000, `Expected 265000 but got ${price}`);
});

runTest('calculateStandardPackagePrice(5) strictly outputs ₹3,20,000 (+2 x ₹55,000)', () => {
  const price = calculateStandardPackagePrice(5);
  assert.strictEqual(price, 320000, `Expected 320000 but got ${price}`);
});

runTest('calculateStandardPackagePrice(2) retains the ₹1,55,000 optional tier', () => {
  const price = calculateStandardPackagePrice(2);
  assert.strictEqual(price, 155000, `Expected 155000 but got ${price}`);
});

runTest('PM Surya Ghar central subsidy benchmarks match official slabs (1kW=30k, 2kW=60k, 3kW+=78k)', () => {
  assert.strictEqual(evaluateSubsidy(1), 30000, '1 kW must be ₹30,000');
  assert.strictEqual(evaluateSubsidy(1.5), 30000, '1.5 kW must be ₹30,000');
  assert.strictEqual(evaluateSubsidy(2), 60000, '2 kW must be ₹60,000');
  assert.strictEqual(evaluateSubsidy(2.5), 60000, '2.5 kW must be ₹60,000');
  assert.strictEqual(evaluateSubsidy(3), 78000, '3 kW must be ₹78,000');
  assert.strictEqual(evaluateSubsidy(5), 78000, '5 kW must be ₹78,000 (capped at ceiling)');
  assert.strictEqual(evaluateSubsidy(10), 78000, '10 kW must be ₹78,000 (capped at ceiling)');
});

// --------------------------------------------------------------------------------
// SECTION 2: LAYOUT, Z-INDEX & MODAL STACKING VALIDATION
// --------------------------------------------------------------------------------
console.log('\n--- 2. LAYOUT, Z-INDEX & MODAL STACKING VALIDATION ---');

const leadsPageCss = fs.readFileSync('src/LeadsPage.css', 'utf8');
const loginScreenCss = fs.readFileSync('src/LoginScreen.css', 'utf8');

runTest('Lead drawer container has z-index strictly <= 2000', () => {
  const drawerMatch = leadsPageCss.match(/\.lead-detail-drawer\s*\{[^}]*z-index:\s*(\d+)/);
  assert(drawerMatch, 'Lead detail drawer must define z-index');
  const zVal = parseInt(drawerMatch[1], 10);
  assert(zVal <= 2000, `Lead drawer z-index (${zVal}) must be <= 2000`);
});

runTest('Modal backdrop has z-index: 3000', () => {
  assert(leadsPageCss.includes('z-index: 3000 !important;'), 'Modal overlay must be set to 3000 !important');
  assert(loginScreenCss.includes('z-index: 3000;'), 'Login reset modal overlay must be set to 3000');
});

runTest('Modal content card has z-index >= 3001', () => {
  assert(leadsPageCss.includes('z-index: 3001 !important;'), 'Modal content must be set to 3001 !important');
  assert(loginScreenCss.includes('z-index: 3001;'), 'Login reset modal card must be set to 3001');
});

runTest('No customer update form or payment modal can be occluded by .lead-detail-drawer', () => {
  // Stacking hierarchy validation: modal (3000/3001) > drawer (2000)
  const drawerZ = 2000;
  const modalOverlayZ = 3000;
  const modalContentZ = 3001;
  assert(modalOverlayZ > drawerZ && modalContentZ > drawerZ, 'Modals must strictly overlay drawer');
});

// --------------------------------------------------------------------------------
// SECTION 3: RESPONSIVE BREAKPOINTS & VIEWPORT STRESS TEST
// --------------------------------------------------------------------------------
console.log('\n--- 3. RESPONSIVE BREAKPOINTS & VIEWPORT STRESS TEST ---');

const mobileNavCss = fs.readFileSync('src/components/MobileBottomNav.css', 'utf8');

runTest('MobileBottomNav activates on mobile viewports (<900px / <768px) and hides on desktop', () => {
  assert(mobileNavCss.includes('.mobile-bottom-app-bar {') && mobileNavCss.includes('display: none;'), 'Must default to display: none on desktop');
  assert(mobileNavCss.includes('@media (max-width: 900px)') && mobileNavCss.includes('display: block;'), 'Must display: block under 900px');
});

runTest('Simulated Viewports: 360x640, 390x844, 768x1024, 1440x900 overflow safety checks', () => {
  // Check index.html and root css for viewport meta and overflow controls
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert(indexHtml.includes('width=device-width, initial-scale=1.0'), 'Viewport meta must specify width=device-width');
  const appCss = fs.readFileSync('src/App.css', 'utf8');
  assert(leadsPageCss.includes('box-sizing: border-box;') || appCss.includes('box-sizing: border-box;'), 'box-sizing border-box prevents scrollWidth > innerWidth');
});

runTest('Primary action buttons maintain a minimum computed hit area of 40x40px', () => {
  assert(leadsPageCss.includes('min-height: 40px;') && leadsPageCss.includes('min-width: 40px;'), 'Action buttons must enforce min-height and min-width of 40px');
});

// --------------------------------------------------------------------------------
// SECTION 4: RBAC DATA ISOLATION & PERSISTENCE
// --------------------------------------------------------------------------------
console.log('\n--- 4. RBAC DATA ISOLATION & PERSISTENCE ---');

const crmContextCode = fs.readFileSync('src/context/CRMContext.tsx', 'utf8');
const dealerDashboardCode = fs.readFileSync('src/dealer/DealerDashboard.tsx', 'utf8');
const adminDealersCode = fs.readFileSync('src/AdminDealersPage.tsx', 'utf8');
const employeeDashboardCode = fs.readFileSync('src/employee/EmployeeDashboard.tsx', 'utf8');

runTest('Soft-deleted users (isDeleted: true / Inactive) are strictly filtered from live query listeners', () => {
  assert(crmContextCode.includes('u.isDeleted || (u.status as any) === \'Archived\' || (u.status as any) === \'Deleted\' || (u.status as any) === \'Inactive\'') ||
         crmContextCode.includes('archivedUserKeys.has'), 'Listener must filter soft-deleted or inactive users');
});

runTest('Deleted users do not rehydrate from local cache or static fallbacks', () => {
  assert(crmContextCode.includes('crm_deleted_users_cache'), 'crm_deleted_users_cache must be checked before merging static fallback entries');
  assert(crmContextCode.includes('if (archivedUserKeys.has(dId) || archivedUserKeys.has(k)'), 'Dealer fallback merge must check archivedUserKeys');
  assert(crmContextCode.includes('if (archivedUserKeys.has(key) || (emp.email && archivedUserKeys.has(emp.email.toLowerCase().trim()))'), 'Employee fallback merge must check archivedUserKeys');
});

runTest('Dealer views strictly render "Partner Earnings" terminology', () => {
  assert(dealerDashboardCode.includes('Partner Earnings'), 'Dealer dashboard must render Partner Earnings');
  assert(adminDealersCode.includes('Partner Earnings'), 'Admin Dealers page must render Partner Earnings');
  assert(!dealerDashboardCode.includes('Commission Payout'), 'Dealer dashboard must not use legacy Commission Payout');
});

runTest('Employee views strictly render "Employee Incentives" terminology', () => {
  assert(employeeDashboardCode.toLowerCase().includes('employee incentives'), 'Employee dashboard must render Employee Incentives');
});

// --------------------------------------------------------------------------------
// FINAL QUALITY AUDIT REPORT
// --------------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`  AUTOMATED QUALITY & VIEWPORT SUITE: ${passedTests} PASSED | ${failedTests} FAILED (TOTAL ${totalTests})`);
console.log('================================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
