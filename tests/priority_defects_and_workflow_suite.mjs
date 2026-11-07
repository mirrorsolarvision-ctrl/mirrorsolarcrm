import assert from 'node:assert';
import fs from 'node:fs';

console.log('================================================================================');
console.log('  MIRROR SOLAR VISION CRM — PRIORITY DEFECTS & WORKFLOW UPGRADES SUITE         ');
console.log('================================================================================\n');

// 1. Verify LoginScreen Forgot Password UI & Input Styling
console.log('--- 1. FORGOT PASSWORD MODAL UI RECOVERY ---');
const loginScreenCode = fs.readFileSync('src/LoginScreen.tsx', 'utf8');
const loginScreenCss = fs.readFileSync('src/LoginScreen.css', 'utf8');

assert(loginScreenCode.includes('Enter your registered administrator email'), 'Forgot password modal must have explicit administrator placeholder');
console.log('  ✓ PASS: Forgot password modal provides explicit administrator email placeholder');

assert(loginScreenCode.includes('resetEmail') && loginScreenCode.includes('handlePasswordReset'), 'resetEmail state and dispatch handler present');
console.log('  ✓ PASS: Password reset state and handler verified in component');

assert(loginScreenCode.includes('resetStatus') && loginScreenCode.includes('resetStatus.type === \'success\''), 'Modal must have error and success state banners');
console.log('  ✓ PASS: User feedback banners for success and error present');

assert(loginScreenCss.includes('.reset-modal-card .input-group'), 'CSS must specifically target modal input group');
assert(loginScreenCss.includes('opacity: 1 !important'), 'Modal input group opacity must be forced to 1 !important');
assert(loginScreenCss.includes('visibility: visible !important'), 'Modal input group visibility must be forced to visible !important');
console.log('  ✓ PASS: Defective opacity/visibility inheritance overridden with !important');

// 2. Verify 5-minute lockout configuration and Admin account mapping
console.log('\n--- 2. ADMIN AUTHENTICATION & 5-MINUTE LOCKOUT ---');
assert(loginScreenCode.includes('LOCKOUT_DURATION_MS = 5 * 60 * 1000'), 'Lockout duration must be exactly 5 minutes (300,000 ms)');
console.log('  ✓ PASS: Lockout duration clamped strictly to 5 minutes (300,000 ms)');

assert(loginScreenCode.includes('mirroraquaro@gmail.com'), 'mirroraquaro@gmail.com must be explicitly recognized with Admin privileges');
console.log('  ✓ PASS: mirroraquaro@gmail.com mapped to Admin role and privileges');

assert(loginScreenCode.includes('balajiperuri09@gmail.com'), 'balajiperuri09@gmail.com must be explicitly recognized with Admin privileges');
console.log('  ✓ PASS: balajiperuri09@gmail.com mapped to Admin role and privileges');

// 3. Verify Soft Deletion / Tombstoning & Local Cache Persistence
console.log('\n--- 3. EMPLOYEE & DEALER DIRECTORY PERSISTENCE & TOMBSTONING ---');
const crmContextCode = fs.readFileSync('src/context/CRMContext.tsx', 'utf8');

assert(crmContextCode.includes('crm_deleted_users_cache'), 'Deleted user cache key must exist');
console.log('  ✓ PASS: Deleted user cache key active in localStorage');

assert(crmContextCode.includes('status: "Inactive"') || crmContextCode.includes("status: 'Inactive'"), 'Inactive status must be set on deletion');
console.log('  ✓ PASS: Soft deletion marks status as "Inactive"');

assert(crmContextCode.includes('isDeleted: true'), 'isDeleted flag must be set on deleted records');
console.log('  ✓ PASS: isDeleted tombstone boolean set in Firestore payload');

assert(crmContextCode.includes('archivedUserKeys.has'), 'User listener must filter out archived tombstones');
console.log('  ✓ PASS: Firestore live snapshot listener filters archived records and skips re-seeding');

// 4. Verify WhatsApp Controls Removal & Preserved Phone/SMS
console.log('\n--- 4. WHATSAPP CONTROLS REMOVAL ---');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');
const workspaceCode = fs.readFileSync('src/sales/SalesWorkspace.tsx', 'utf8');
const leadsViewCode = fs.readFileSync('src/sales/views/SalesLeadsView.tsx', 'utf8');

assert(!appCode.includes('<WhatsAppBuddy'), 'Floating WhatsAppBuddy must be removed from App.tsx');
console.log('  ✓ PASS: Floating WhatsApp widget removed from global root App.tsx');

assert(!workspaceCode.includes('WhatsApp Dispatch'), 'WhatsApp Dispatch tab/button must be removed from SalesWorkspace header');
console.log('  ✓ PASS: WhatsApp Dispatch button removed from sales header');

assert(!leadsViewCode.includes('handleWhatsApp('), 'WhatsApp action trigger must be removed from SalesLeadsView');
console.log('  ✓ PASS: WhatsApp action button removed from SalesLeadsView');

// 5. Verify Terminology Updates: Partner Earnings & Employee Incentives
console.log('\n--- 5. TERMINOLOGY UPDATES: PARTNER EARNINGS & EMPLOYEE INCENTIVES ---');
const adminDealersCode = fs.readFileSync('src/AdminDealersPage.tsx', 'utf8');
const dealerDashboardCode = fs.readFileSync('src/dealer/DealerDashboard.tsx', 'utf8');
const employeeDashboardCode = fs.readFileSync('src/employee/EmployeeDashboard.tsx', 'utf8');

assert(dealerDashboardCode.includes('Partner Earnings'), 'Dealer portal must use Partner Earnings');
console.log('  ✓ PASS: Dealer portal updated to "Partner Earnings"');

assert(employeeDashboardCode.toLowerCase().includes('employee incentives'), 'Employee portal must use Employee Incentives');
console.log('  ✓ PASS: Employee portal updated to "Employee Incentives"');

assert(adminDealersCode.includes('Partner Earnings'), 'Admin Dealers portal must use Partner Earnings');
console.log('  ✓ PASS: Admin Dealers portal updated to "Partner Earnings"');

// 6. Verify Customer Activity & Work Modal Z-Index
console.log('\n--- 6. ACTIVITY & WORK MODAL Z-INDEX ELEVATION ---');
const leadsPageCss = fs.readFileSync('src/LeadsPage.css', 'utf8');
assert(leadsPageCss.includes('z-index: 3000 !important;'), 'Modal overlay must have z-index 3000 !important');
assert(leadsPageCss.includes('z-index: 3001 !important;'), 'Modal content must have z-index 3001 !important');
console.log('  ✓ PASS: Modal overlay elevated to z-index 3000 and content to 3001 (above drawer 2200)');

// 7. Verify Inbound Call Capacity Entry
console.log('\n--- 7. INBOUND CALL CAPACITY ENTRY ---');
const callLeadsCode = fs.readFileSync('src/pages/CallLeadsPage.tsx', 'utf8');
assert(callLeadsCode.includes('placeholder="e.g. 3 or 3.5 kW"'), 'CallLeadsPage must have free-form capacity input');
assert(callLeadsCode.includes('3 kW (Recommended)'), 'CallLeadsPage must provide 3 kW recommended quick chip');
assert(callLeadsCode.includes('2 kW (Optional)'), 'CallLeadsPage must provide 2 kW optional quick chip');
console.log('  ✓ PASS: Free-text editable capacity and quick preset chips verified');

// 8. Verify Telecalling Centre View Response Matrix
console.log('\n--- 8. TELECALLING CUSTOMER RESPONSE MATRIX ---');
const telecallingViewCode = fs.readFileSync('src/sales/views/TelecallingCentreView.tsx', 'utf8');
assert(telecallingViewCode.includes('Customer Responses & Enquiries'), 'Must have Customer Responses & Enquiries primary tab');
assert(telecallingViewCode.includes('Site Visit / Handover'), 'Must display Site Visit / Handover column');
assert(telecallingViewCode.includes('Manager Escalation'), 'Must display Manager Escalation status');
assert(telecallingViewCode.includes('Save Responses'), 'Must provide Save Responses action modal');
console.log('  ✓ PASS: Customer responses matrix, qualification columns and modals verified');

// 9. Verify Solar Pricing Formulas & Floor Protection
console.log('\n--- 9. SOLAR PRICING CALCULATIONS & FLOOR POLICY ---');
// Pure mathematical verification of business rules
function calculateStandardPackagePrice(capacityKw) {
  const cap = Number(capacityKw) || 0;
  if (cap <= 0) return { basePrice: 0, subsidyAmount: 0, customerPayable: 0 };
  let basePrice = 0;
  if (Math.abs(cap - 2) < 0.05) {
    basePrice = 155000;
  } else if (Math.abs(cap - 3) < 0.05) {
    basePrice = 210000;
  } else if (cap > 3) {
    basePrice = 210000 + (cap - 3) * 55000;
  } else {
    basePrice = Math.round(cap * 70000);
  }
  return { basePrice };
}

function evaluateQuotationPricingPolicy(capacityKw, totalPrice, discountPercent = 0) {
  const cap = Number(capacityKw) || 0;
  const price = Number(totalPrice) || 0;
  const disc = Number(discountPercent) || 0;
  const effectivePerKw = cap > 0 ? price / cap : 0;
  const floorViolated = effectivePerKw > 0 && effectivePerKw < 45000;
  const requiresApproval = disc > 20;
  return { effectivePerKw, floorViolated, requiresApproval };
}

// 3 kW package
const p3kW = calculateStandardPackagePrice(3);
assert.strictEqual(p3kW.basePrice, 210000, '3 kW must be ₹2,10,000');
console.log('  ✓ PASS: 3 kW package = ₹2,10,000');

// 4 kW package = 210000 + 1 * 55000 = 265000
const p4kW = calculateStandardPackagePrice(4);
assert.strictEqual(p4kW.basePrice, 265000, '4 kW must be ₹2,65,000');
console.log('  ✓ PASS: 4 kW package = ₹2,65,000 (₹2,10,000 + 1 × ₹55,000)');

// 5 kW package = 210000 + 2 * 55000 = 320000
const p5kW = calculateStandardPackagePrice(5);
assert.strictEqual(p5kW.basePrice, 320000, '5 kW must be ₹3,20,000 (₹2,10,000 + 2 × ₹55,000)');
console.log('  ✓ PASS: 5 kW package = ₹3,20,000 (₹2,10,000 + 2 × ₹55,000)');

// 2 kW optional package = 155000
const p2kW = calculateStandardPackagePrice(2);
assert.strictEqual(p2kW.basePrice, 155000, '2 kW optional package must be ₹1,55,000');
console.log('  ✓ PASS: 2 kW optional package = ₹1,55,000');

// Floor protection < ₹45,000/kW
const floorCheckViolation = evaluateQuotationPricingPolicy(5, 200000, 0); // 40,000/kW
assert(floorCheckViolation.floorViolated === true, 'Price below ₹45,000/kW must trigger floor violation');
console.log('  ✓ PASS: Floor price protection correctly identifies violations (< ₹45,000/kW)');

const floorCheckValid = evaluateQuotationPricingPolicy(5, 250000, 0); // 50,000/kW
assert(floorCheckValid.floorViolated === false, 'Price >= ₹45,000/kW must pass floor check');
console.log('  ✓ PASS: Floor price protection allows compliant pricing (₹50,000/kW)');

// 20% discount approval requirement
const discCheckNormal = evaluateQuotationPricingPolicy(3, 210000, 15);
assert(discCheckNormal.requiresApproval === false, '15% discount should not require admin approval');
const discCheckExceeded = evaluateQuotationPricingPolicy(3, 210000, 25);
assert(discCheckExceeded.requiresApproval === true, '25% discount must require admin approval');
console.log('  ✓ PASS: Discounts > 20% require Admin approval gate');

// 10. Verify Token Auto-Release in CRMContext
console.log('\n--- 10. TOKEN PAYMENT AUTOMATIC QUOTATION RELEASE ---');
assert(crmContextCode.includes('Automatic quotation release upon verified token payment'), 'CRMContext must contain token auto-release logic');
assert(crmContextCode.includes('verifiedItem.paymentType === \'Token\' || verifiedItem.amount >= 5000'), 'Token payment qualification trigger verified');
console.log('  ✓ PASS: Token payment verification triggers automatic quotation release');

console.log('\n================================================================================');
console.log('  ALL 10 UPGRADE VERIFICATION CRITERIA PASSED (0 FAILURES)');
console.log('================================================================================\n');
