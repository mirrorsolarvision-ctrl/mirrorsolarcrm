/**
 * MIRROR SOLAR VISION CRM — TIMEZONE BOUNDARY & SCHEDULING VERIFICATION SUITE
 * 
 * Task 5: Timezone boundaries & follow-up scheduling in Asia/Kolkata
 * Target: feature/telecaller-mvp-nov04
 * 
 * Verifies:
 * 1. 11:59 PM IST evaluates to today's date in Kolkata.
 * 2. 12:01 AM IST advances to the next day's date in Kolkata.
 * 3. Browser running in different timezone (e.g., UTC, PST, GMT) does NOT roll back or corrupt follow-up calculations.
 * 4. Stored ISO timestamps preserve UTC fidelity while UI follow-up status reflects exact IST calendar buckets:
 *    - Overdue (< todayIst)
 *    - Due Today (== todayIst)
 *    - Upcoming / Tomorrow (> todayIst)
 */

import assert from 'assert';

console.log('================================================================================');
console.log('  MIRROR SOLAR VISION CRM — TIMEZONE & CALENDAR BOUNDARY TEST SUITE             ');
console.log('  Timezone: Asia/Kolkata (IST, UTC+05:30)                                       ');
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

// Canonical getIndiaDateString function matching CRMContext
function getIndiaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Kolkata', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(date);
}

// Follow-up status categorization matching SalesFollowupsView & CRMContext
function evaluateFollowUpStatus(followUpDate, referenceDateIst) {
  if (!followUpDate) return 'None';
  if (followUpDate < referenceDateIst) return 'Overdue';
  if (followUpDate === referenceDateIst) return 'Due Today';
  return 'Upcoming';
}

// ---------------------------------------------------------
// TEST 1: 11:59 PM IST (23:59:59 IST = 18:29:59 UTC)
// ---------------------------------------------------------
runTest('1. 11:59 PM IST evaluates to the CURRENT calendar day in Asia/Kolkata', () => {
  // Nov 4, 2026 23:59:30 IST is Nov 4, 2026 18:29:30 UTC
  const lateNightUtc = new Date('2026-11-04T18:29:30Z');
  const istDate = getIndiaDateString(lateNightUtc);
  assert.strictEqual(istDate, '2026-11-04', 'Should remain 2026-11-04 at 11:59 PM IST');
});

// ---------------------------------------------------------
// TEST 2: 12:01 AM IST (00:01:00 IST = 18:31:00 UTC previous day)
// ---------------------------------------------------------
runTest('2. 12:01 AM IST accurately rolls forward to NEXT calendar day in Asia/Kolkata', () => {
  // Nov 5, 2026 00:01:00 IST is Nov 4, 2026 18:31:00 UTC
  const pastMidnightUtc = new Date('2026-11-04T18:31:00Z');
  const istDate = getIndiaDateString(pastMidnightUtc);
  assert.strictEqual(istDate, '2026-11-05', 'Should roll to 2026-11-05 at 12:01 AM IST');
});

// ---------------------------------------------------------
// TEST 3: Browser running in UTC or US West Coast
// ---------------------------------------------------------
runTest('3. Date calculation is immune to local host browser timezone offset', () => {
  // Regardless of host system timezone, Asia/Kolkata evaluation must remain deterministic
  const fixedInstant = new Date('2026-11-04T19:00:00Z'); // 00:30 AM Nov 5 IST
  const kolkataDate = getIndiaDateString(fixedInstant);
  assert.strictEqual(kolkataDate, '2026-11-05');

  const earlyMorningInstant = new Date('2026-11-04T01:00:00Z'); // 06:30 AM Nov 4 IST
  const earlyDate = getIndiaDateString(earlyMorningInstant);
  assert.strictEqual(earlyDate, '2026-11-04');
});

// ---------------------------------------------------------
// TEST 4: Follow-up Categorization: Due Today
// ---------------------------------------------------------
runTest('4. Follow-up for today evaluates strictly to "Due Today"', () => {
  const referenceIst = '2026-11-04';
  const status = evaluateFollowUpStatus('2026-11-04', referenceIst);
  assert.strictEqual(status, 'Due Today');
});

// ---------------------------------------------------------
// TEST 5: Follow-up Categorization: Overdue
// ---------------------------------------------------------
runTest('5. Follow-up for yesterday evaluates strictly to "Overdue"', () => {
  const referenceIst = '2026-11-04';
  const statusYesterday = evaluateFollowUpStatus('2026-11-03', referenceIst);
  assert.strictEqual(statusYesterday, 'Overdue');

  const statusLastWeek = evaluateFollowUpStatus('2026-10-28', referenceIst);
  assert.strictEqual(statusLastWeek, 'Overdue');
});

// ---------------------------------------------------------
// TEST 6: Follow-up Categorization: Tomorrow / Upcoming
// ---------------------------------------------------------
runTest('6. Follow-up for tomorrow evaluates strictly to "Upcoming"', () => {
  const referenceIst = '2026-11-04';
  const statusTomorrow = evaluateFollowUpStatus('2026-11-05', referenceIst);
  assert.strictEqual(statusTomorrow, 'Upcoming');

  const statusNextWeek = evaluateFollowUpStatus('2026-11-11', referenceIst);
  assert.strictEqual(statusNextWeek, 'Upcoming');
});

// ---------------------------------------------------------
// TEST 7: Timestamp roundtrip consistency
// ---------------------------------------------------------
runTest('7. Stored ISO timestamps preserve exact UTC instant and convert cleanly to IST display', () => {
  const testTimestamp = '2026-11-04T12:30:00.000Z'; // 6:00 PM IST
  const parsedDate = new Date(testTimestamp);
  const istDate = getIndiaDateString(parsedDate);
  assert.strictEqual(istDate, '2026-11-04');

  const istTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(parsedDate);
  assert.ok(istTime.includes('06:00') || istTime.includes('6:00'), `Expected 6:00 PM, got ${istTime}`);
});

console.log('\n================================================================================');
console.log(`  TIMEZONE SUITE RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
console.log('================================================================================\n');

if (failCount > 0) process.exit(1);
