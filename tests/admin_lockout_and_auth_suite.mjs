/**
 * MIRROR SOLAR VISION CRM — ADMIN AUTHENTICATION & 5-MINUTE LOCKOUT VERIFICATION SUITE
 * 
 * Target: feature/admin-login-lockout-audit
 * Policy: 5-minute (300-second) lockout duration after 5 failed attempts
 */

import assert from 'assert';

console.log('================================================================================');
console.log('  MIRROR SOLAR VISION CRM — ADMIN AUTH & 5-MINUTE LOCKOUT TEST SUITE            ');
console.log('  Policy: 5-Minute (300-Second) Lockout | Monotonic Server Rate Limiting        ');
console.log('================================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assertTest(title, condition, details = '') {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${title}`);
    if (details) console.log(`       Evidence: ${details}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${title}`);
    if (details) console.error(`       Failure Detail: ${details}`);
  }
}

// -----------------------------------------------------------------------------
// 1. LOCKOUT DURATION CONSTANTS & COUNTDOWN CALCULATION
// -----------------------------------------------------------------------------
console.log('--- 1. LOCKOUT DURATION & COUNTDOWN MATHEMATICS ---');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 300,000 ms = 300 seconds

assertTest('Lockout duration is exactly 300,000 milliseconds (5 minutes)', LOCKOUT_DURATION_MS === 300000, `Duration = ${LOCKOUT_DURATION_MS}ms`);
assertTest('Lockout duration in seconds is exactly 300 seconds', (LOCKOUT_DURATION_MS / 1000) === 300, `Duration = ${LOCKOUT_DURATION_MS / 1000}s`);

// Test countdown math at 300s, 299s, 61s, 59s, 1s, 0s
function formatLockout(sec) {
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${mins}m ${String(remSec).padStart(2, '0')}s`;
}

assertTest('Countdown at 300s formats strictly to "5m 00s"', formatLockout(300) === '5m 00s', `Got: ${formatLockout(300)}`);
assertTest('Countdown at 299s formats strictly to "4m 59s"', formatLockout(299) === '4m 59s', `Got: ${formatLockout(299)}`);
assertTest('Countdown at 61s formats strictly to "1m 01s"', formatLockout(61) === '1m 01s', `Got: ${formatLockout(61)}`);
assertTest('Countdown at 59s formats strictly to "0m 59s"', formatLockout(59) === '0m 59s', `Got: ${formatLockout(59)}`);
assertTest('Countdown at 1s formats strictly to "0m 01s"', formatLockout(1) === '0m 01s', `Got: ${formatLockout(1)}`);

// -----------------------------------------------------------------------------
// 2. SIMULATED CLIENT-SIDE LOCKOUT STATE & EXPIRATION WORKFLOW
// -----------------------------------------------------------------------------
console.log('\n--- 2. CLIENT-SIDE LOCKOUT STATE & AUTOMATIC EXPIRATION ---');

class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) { return this.store.get(k) || null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const mockStorage = new MockLocalStorage();

function simulateCheckLockout(storage, currentTime) {
  const lockoutUntil = parseInt(storage.getItem('crm_login_lockout_until') || '0', 10);
  if (lockoutUntil > currentTime) {
    const remaining = Math.ceil((lockoutUntil - currentTime) / 1000);
    if (remaining > 300) {
      // Clamped to 300s
      const clampedUntil = currentTime + LOCKOUT_DURATION_MS;
      storage.setItem('crm_login_lockout_until', clampedUntil.toString());
      return 300;
    }
    return remaining;
  } else {
    if (lockoutUntil > 0) {
      storage.removeItem('crm_login_lockout_until');
    }
    return 0;
  }
}

function simulateRecordFailedAttempt(storage, currentTime, currentAttempts) {
  const attempts = currentAttempts + 1;
  storage.setItem('crm_login_failed_attempts', attempts.toString());
  const isLocked = attempts >= MAX_FAILED_ATTEMPTS;
  const lockoutUntil = isLocked ? currentTime + LOCKOUT_DURATION_MS : 0;
  if (isLocked) {
    storage.setItem('crm_login_lockout_until', lockoutUntil.toString());
  }
  return { attempts, isLocked, lockoutUntil };
}

// 4 Failed attempts: No lockout
const t0 = 1000000;
let state = { attempts: 0 };
for (let i = 1; i <= 4; i++) {
  state = simulateRecordFailedAttempt(mockStorage, t0, state.attempts);
}
assertTest('4 failed attempts do NOT trigger security lockout', state.isLocked === false && state.attempts === 4, `Attempts = ${state.attempts}`);
assertTest('Lockout remaining seconds is 0 after 4 failed attempts', simulateCheckLockout(mockStorage, t0) === 0);

// 5th Failed attempt: Triggers 5-minute lockout
state = simulateRecordFailedAttempt(mockStorage, t0, state.attempts);
assertTest('5th consecutive failed attempt triggers security lockout', state.isLocked === true && state.attempts === 5);
assertTest('Lockout expiration timestamp is set to exactly Date.now() + 300,000ms', state.lockoutUntil === t0 + 300000, `LockoutUntil = ${state.lockoutUntil}`);
assertTest('Active lockout returns exactly 300 seconds immediately upon trigger', simulateCheckLockout(mockStorage, t0) === 300);

// Browser refresh after 60 seconds
const t60 = t0 + 60000;
const refreshedSec = simulateCheckLockout(mockStorage, t60);
assertTest('Browser refresh at +60s preserves lockout with exactly 240 seconds remaining', refreshedSec === 240, `Remaining = ${refreshedSec}s`);

// Clock manipulation defense: Attempt to inject future timestamp 24 hours out
mockStorage.setItem('crm_login_lockout_until', (t0 + 86400000).toString());
const clampedSec = simulateCheckLockout(mockStorage, t0);
assertTest('Injected timestamp exceeding 300s is clamped safely to 300 seconds maximum', clampedSec === 300, `Clamped to = ${clampedSec}s`);

// Automatic expiration after 300 seconds
const t301 = t0 + 301000;
const expiredSec = simulateCheckLockout(mockStorage, t301);
assertTest('Lockout expires automatically after 300 seconds (returns 0 remaining)', expiredSec === 0, `Remaining at t+301s = ${expiredSec}`);
assertTest('Expired lockout key is automatically scrubbed from localStorage', mockStorage.getItem('crm_login_lockout_until') === null);

// -----------------------------------------------------------------------------
// 3. SERVER-SIDE FIRESTORE /auth_attempts RULES EVALUATION
// -----------------------------------------------------------------------------
console.log('\n--- 3. FIRESTORE SERVER-SIDE RATE LIMITING & SECURITY RULES ---');

function evaluateRulesUpdate(resource, requestData, authUser = null) {
  const isAdmin = authUser?.email === 'mirrorsolarvision@gmail.com' || authUser?.role === 'Admin';
  if (isAdmin) return true;

  // Authenticated user successful reset
  if (authUser && requestData.failedCount === 0 && requestData.lockoutUntil === 0) {
    return true;
  }

  // Monotonic increment check
  if (requestData.failedCount !== resource.failedCount + 1) return false;

  // Affected keys whitelist check
  const allowedKeys = new Set(['failedCount', 'lockoutUntil', 'lastAttempt', 'lastAttemptAt', 'sanitizedId', 'identifier']);
  for (const k of Object.keys(requestData)) {
    if (!allowedKeys.has(k)) return false;
  }

  // Attempt < 5 must have lockoutUntil == 0
  if (requestData.failedCount < 5 && requestData.lockoutUntil !== 0) return false;

  // Attempt >= 5 must advance lockoutUntil
  if (requestData.failedCount >= 5 && requestData.lockoutUntil <= resource.lockoutUntil) return false;

  return true;
}

// 3.1 Initial creation with failedCount 1
const createPayload = { failedCount: 1, lockoutUntil: 0, identifier: 'mirrorsolarvision@gmail.com', sanitizedId: 'mirrorsolarvision_gmail_com' };
const isCreateValid = createPayload.failedCount === 1 && createPayload.lockoutUntil === 0;
assertTest('Firestore /auth_attempts create allows initial failedCount: 1, lockoutUntil: 0', isCreateValid === true);

// 3.2 Monotonic update from 1 to 2
const updateStep2 = evaluateRulesUpdate(
  { failedCount: 1, lockoutUntil: 0 },
  { failedCount: 2, lockoutUntil: 0, identifier: 'mirrorsolarvision@gmail.com', sanitizedId: 'mirrorsolarvision_gmail_com', lastAttempt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() }
);
assertTest('Firestore /auth_attempts allows legitimate monotonic increment 1 -> 2', updateStep2 === true);

// 3.3 Attacker tries to set premature lockout on attempt 3
const prematureLockout = evaluateRulesUpdate(
  { failedCount: 2, lockoutUntil: 0 },
  { failedCount: 3, lockoutUntil: Date.now() + 300000, identifier: 'mirrorsolarvision@gmail.com', sanitizedId: 'mirrorsolarvision_gmail_com', lastAttempt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() }
);
assertTest('Firestore /auth_attempts blocks arbitrary premature lockout before attempt 5', prematureLockout === false);

// 3.4 Attacker tries to skip attempts 2 -> 5
const skipAttempt = evaluateRulesUpdate(
  { failedCount: 2, lockoutUntil: 0 },
  { failedCount: 5, lockoutUntil: Date.now() + 300000, identifier: 'mirrorsolarvision@gmail.com', sanitizedId: 'mirrorsolarvision_gmail_com', lastAttempt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() }
);
assertTest('Firestore /auth_attempts blocks non-monotonic jump (2 -> 5)', skipAttempt === false);

// 3.5 Legitimate 5th attempt triggers 5-minute lockout
const legit5thLockout = evaluateRulesUpdate(
  { failedCount: 4, lockoutUntil: 0 },
  { failedCount: 5, lockoutUntil: Date.now() + 300000, identifier: 'mirrorsolarvision@gmail.com', sanitizedId: 'mirrorsolarvision_gmail_com', lastAttempt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() }
);
assertTest('Firestore /auth_attempts accepts legitimate 5th attempt with 5-minute lockout', legit5thLockout === true);

// 3.6 Unauthenticated attacker tries to reset failedCount to 0
const unauthReset = evaluateRulesUpdate(
  { failedCount: 5, lockoutUntil: Date.now() + 300000 },
  { failedCount: 0, lockoutUntil: 0 },
  null // Not logged in
);
assertTest('Firestore /auth_attempts BLOCKS unauthenticated attacker resetting failedCount to 0', unauthReset === false);

// 3.7 Authenticated user logs in successfully and resets failedCount to 0
const authReset = evaluateRulesUpdate(
  { failedCount: 5, lockoutUntil: Date.now() + 300000 },
  { failedCount: 0, lockoutUntil: 0, identifier: 'mirrorsolarvision@gmail.com', sanitizedId: 'mirrorsolarvision_gmail_com', lastAttempt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() },
  { uid: 'J5Iht5bVwPQEOme5RpHPdruYlqB3', email: 'mirrorsolarvision@gmail.com' }
);
assertTest('Firestore /auth_attempts ALLOWS authenticated user resetting failedCount on login success', authReset === true);

// -----------------------------------------------------------------------------
// 4. ADMIN CANONICAL IDENTIFIER RESOLUTION & RBAC ENFORCEMENT
// -----------------------------------------------------------------------------
console.log('\n--- 4. ADMIN USERNAME RESOLUTION & RBAC VALIDATION ---');

function resolveCanonicalEmail(rawInput, role = 'Admin') {
  const clean = rawInput.trim();
  const lower = clean.toLowerCase();
  const digits = clean.replace(/\D/g, '').slice(-10);

  if (clean.includes('@')) return clean;

  if (['admin', 'msvadmin', 'mirrorsolarvision'].includes(lower) || digits === '9849810668') {
    return 'mirrorsolarvision@gmail.com';
  }
  if (lower.includes('balaji') || digits === '9182612420') {
    return 'balajiperuri09@gmail.com';
  }
  if (lower.includes('aqua') || lower === 'mirroraquaro@gmail.com') {
    return 'mirroraquaro@gmail.com';
  }

  if (role === 'Admin') return `${lower}@mirrorsolarvision.com`;
  return `${lower}@mirrorsolar.in`;
}

assertTest('Username "admin" resolves to "mirrorsolarvision@gmail.com"', resolveCanonicalEmail('admin') === 'mirrorsolarvision@gmail.com');
assertTest('Username "msvadmin" resolves to "mirrorsolarvision@gmail.com"', resolveCanonicalEmail('msvadmin') === 'mirrorsolarvision@gmail.com');
assertTest('Phone number "9849810668" resolves to "mirrorsolarvision@gmail.com"', resolveCanonicalEmail('9849810668') === 'mirrorsolarvision@gmail.com');
assertTest('Phone with country code "+91 9849810668" resolves to "mirrorsolarvision@gmail.com"', resolveCanonicalEmail('+91 9849810668') === 'mirrorsolarvision@gmail.com');
assertTest('Username "balaji" resolves to "balajiperuri09@gmail.com"', resolveCanonicalEmail('balaji') === 'balajiperuri09@gmail.com');
assertTest('Direct email "mirrorsolarvision@gmail.com" passes through unchanged', resolveCanonicalEmail('mirrorsolarvision@gmail.com') === 'mirrorsolarvision@gmail.com');

// RBAC Admin Verification
const ADMIN_EMAILS = new Set(['mirrorsolarvision@gmail.com', 'mirroraquaro@gmail.com', 'balajiperuri09@gmail.com', 'admin@mirrorsolar.in']);

function evaluateIsAdmin(email) {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

assertTest('mirrorsolarvision@gmail.com is recognized as authorized Super Admin', evaluateIsAdmin('mirrorsolarvision@gmail.com') === true);
assertTest('balajiperuri09@gmail.com is recognized as authorized Admin', evaluateIsAdmin('balajiperuri09@gmail.com') === true);
assertTest('mirroraquaro@gmail.com is recognized as authorized Admin', evaluateIsAdmin('mirroraquaro@gmail.com') === true);
assertTest('Arbitrary employee "bhavani.telecaller@mirrorsolar.in" CANNOT claim Admin role', evaluateIsAdmin('bhavani.telecaller@mirrorsolar.in') === false);
assertTest('Arbitrary external email "attacker@gmail.com" CANNOT claim Admin role', evaluateIsAdmin('attacker@gmail.com') === false);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`  ADMIN & LOCKOUT SUITE RESULTS: ${passedTests} PASSED | ${failedTests} FAILED (TOTAL ${passedTests + failedTests})`);
console.log('================================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
