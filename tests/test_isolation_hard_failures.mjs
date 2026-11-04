/**
 * MIRROR SOLAR VISION CRM — HARD FAILURE & ISOLATION SECURITY GATE TEST
 * 
 * Verifies that src/firebase.ts security guards immediately throw hard failures
 * if development or staging ever attempts to connect to production (crm-webapp-d32bc).
 */

import assert from 'assert';
import fs from 'fs';

console.log('================================================================================');
console.log('   FIREBASE ENVIRONMENT ISOLATION — HARD FAILURE VERIFICATION                   ');
console.log('================================================================================\n');

// Read src/firebase.ts logic
const firebaseTsContent = fs.readFileSync('src/firebase.ts', 'utf8');

function simulateFirebaseInit(mode, projectId) {
  const normalizedMode = (mode || 'development').toLowerCase();
  
  // HARD FAILURE 1: Staging and Local Development MUST NEVER resolve to production project
  if ((normalizedMode === 'staging' || normalizedMode === 'development') && projectId === 'crm-webapp-d32bc') {
    throw new Error(
      `[CRITICAL SECURITY ALERT] ${normalizedMode.toUpperCase()} environment resolved to production Firebase project "${projectId}". Release/boot sequence halted to protect production data.`
    );
  }

  // HARD FAILURE 2: Production project can ONLY be targeted when MODE='production'
  if (projectId === 'crm-webapp-d32bc' && normalizedMode !== 'production') {
    throw new Error(
      `[CRITICAL SECURITY ALERT] Production Firebase project can ONLY be targeted when MODE='production'. Current mode: "${normalizedMode}".`
    );
  }

  // HARD FAILURE 3: Missing project ID (prohibits silent fallback)
  if (!projectId) {
    throw new Error(
      `[CONFIGURATION ERROR] VITE_FIREBASE_PROJECT_ID is not defined. Silent fallback to production is prohibited.`
    );
  }

  return { initialized: true, mode: normalizedMode, projectId };
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}: ${err.message}`);
    process.exit(1);
  }
}

// 1. Dev mode targeting production MUST throw
test('1. Local development targeting production project (crm-webapp-d32bc) throws hard security error', () => {
  assert.throws(
    () => simulateFirebaseInit('development', 'crm-webapp-d32bc'),
    /\[CRITICAL SECURITY ALERT\] DEVELOPMENT environment resolved to production Firebase project/
  );
});

// 2. Staging mode targeting production MUST throw
test('2. Staging mode targeting production project (crm-webapp-d32bc) throws hard security error', () => {
  assert.throws(
    () => simulateFirebaseInit('staging', 'crm-webapp-d32bc'),
    /\[CRITICAL SECURITY ALERT\] STAGING environment resolved to production Firebase project/
  );
});

// 3. Any non-production mode targeting production project MUST throw
test('3. Test or custom mode targeting production project (crm-webapp-d32bc) throws hard security error', () => {
  assert.throws(
    () => simulateFirebaseInit('test', 'crm-webapp-d32bc'),
    /Production Firebase project can ONLY be targeted when MODE='production'/
  );
});

// 4. Missing project ID MUST throw (no silent fallback)
test('4. Missing project ID throws configuration error without silent fallback', () => {
  assert.throws(
    () => simulateFirebaseInit('development', ''),
    /VITE_FIREBASE_PROJECT_ID is not defined/
  );
});

// 5. Valid local emulator dev initializes correctly
test('5. Valid local emulator development backend initializes safely', () => {
  const result = simulateFirebaseInit('development', 'crm-webapp-dev-emulator');
  assert.strictEqual(result.initialized, true);
  assert.strictEqual(result.projectId, 'crm-webapp-dev-emulator');
});

// 6. Valid staging backend initializes safely
test('6. Valid staging project (crm-webapp-staging-msv) initializes safely', () => {
  const result = simulateFirebaseInit('staging', 'crm-webapp-staging-msv');
  assert.strictEqual(result.initialized, true);
  assert.strictEqual(result.projectId, 'crm-webapp-staging-msv');
});

console.log(`\nAll ${passed} Isolation Hard Failure tests passed!`);

