// Automated Inventory Concurrency, Idempotency, and Insufficient Stock Test Suite

import assert from 'assert';

console.log('=== STARTING INVENTORY CONCURRENCY & TRANSACTION VALIDATION SUITE ===\n');

// Mock in-memory atomic transactional store mimicking Firestore Transaction behavior
class TransactionalInventoryEngine {
  constructor(initialDealerStock = 10, initialCentralStock = 50) {
    this.dealerStock = { 'Waaree 550W': initialDealerStock };
    this.centralStock = { 'Waaree 550W': initialCentralStock };
    this.consumptionRecords = new Map(); // Key: leadId -> consumption
    this.dispatchRecords = new Map(); // Key: dispatchId -> dispatch
    this.lock = false;
  }

  // Atomic deduction with idempotency key
  async deductDealerStockForInstallation(leadId, customerName, dealerName, requiredQty, actorName) {
    // Simulate transaction lock
    while (this.lock) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.lock = true;

    try {
      // 1. Idempotency Check (Duplicate request / Retry prevention)
      if (this.consumptionRecords.has(leadId)) {
        return {
          success: true,
          alreadyDeducted: true,
          message: `Stock already deducted for ${customerName} (Idempotent replay)`
        };
      }

      // 2. Stock Availability Check
      const available = this.dealerStock['Waaree 550W'] || 0;
      if (available < requiredQty) {
        throw new Error(`Insufficient dealer stock: Required ${requiredQty}, Available ${available}`);
      }

      // 3. Atomic Decrement
      this.dealerStock['Waaree 550W'] -= requiredQty;

      const record = {
        id: `MTR_${leadId}`,
        leadId,
        customerName,
        dealerName,
        deductedQty: requiredQty,
        deductedAt: new Date().toISOString(),
        actorName,
        isReversed: false
      };
      this.consumptionRecords.set(leadId, record);

      return {
        success: true,
        alreadyDeducted: false,
        deductedQty: requiredQty,
        remainingStock: this.dealerStock['Waaree 550W']
      };
    } finally {
      this.lock = false;
    }
  }

  // Reverse material consumption
  async reverseConsumption(leadId, actorName) {
    while (this.lock) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.lock = true;

    try {
      const record = this.consumptionRecords.get(leadId);
      if (!record) {
        throw new Error('Consumption record not found for reversal');
      }
      if (record.isReversed) {
        throw new Error('Consumption record already reversed (Double reversal blocked)');
      }

      this.dealerStock['Waaree 550W'] += record.deductedQty;
      record.isReversed = true;
      record.reversedAt = new Date().toISOString();
      record.reversedBy = actorName;

      return {
        success: true,
        restoredQty: record.deductedQty,
        newStock: this.dealerStock['Waaree 550W']
      };
    } finally {
      this.lock = false;
    }
  }

  // Atomic Central Dispatch
  async dispatchFromCentral(dispatchId, dealerId, qty, actorName) {
    while (this.lock) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.lock = true;

    try {
      if (this.dispatchRecords.has(dispatchId)) {
        return { success: true, alreadyDispatched: true };
      }

      const available = this.centralStock['Waaree 550W'] || 0;
      if (available < qty) {
        throw new Error(`Central stock insufficient: Required ${qty}, Available ${available}`);
      }

      this.centralStock['Waaree 550W'] -= qty;
      this.dispatchRecords.set(dispatchId, { dispatchId, dealerId, qty, status: 'Pending Dealer Confirmation' });

      return {
        success: true,
        remainingCentralStock: this.centralStock['Waaree 550W']
      };
    } finally {
      this.lock = false;
    }
  }
}

// --- TEST SCENARIOS ---

// TEST 1: Concurrent Installation Consumption (Stock = 10; Req A = 7, Req B = 6)
async function testConcurrentConsumption() {
  const engine = new TransactionalInventoryEngine(10);

  const promiseA = engine.deductDealerStockForInstallation('LEAD_1', 'Customer A', 'Sri Solar', 7, 'Admin');
  const promiseB = engine.deductDealerStockForInstallation('LEAD_2', 'Customer B', 'Sri Solar', 6, 'Admin');

  const results = await Promise.allSettled([promiseA, promiseB]);
  
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.strictEqual(succeeded.length, 1, 'Exactly one concurrent request should succeed');
  assert.strictEqual(rejected.length, 1, 'Exactly one concurrent request should be rejected due to insufficient stock');
  assert.strictEqual(engine.dealerStock['Waaree 550W'], 3, 'Final stock must be exactly 3 (10 - 7)');
  console.log('✅ PASS: Test 1 - Concurrent consumption resolved atomically without negative stock');
}

// TEST 2: Insufficient Stock Rejection
async function testInsufficientStock() {
  const engine = new TransactionalInventoryEngine(15);

  try {
    await engine.deductDealerStockForInstallation('LEAD_3', 'Customer C', 'Sri Solar', 20, 'Admin');
    assert.fail('Should have thrown insufficient stock error');
  } catch (err) {
    assert.match(err.message, /Insufficient dealer stock/, 'Expected insufficient stock error');
    assert.strictEqual(engine.dealerStock['Waaree 550W'], 15, 'Stock must remain unchanged at 15');
    assert.strictEqual(engine.consumptionRecords.has('LEAD_3'), false, 'No consumption record should be created');
  }
  console.log('✅ PASS: Test 2 - Insufficient stock correctly rejected with zero state mutations');
}

// TEST 3: Network Timeout / Retry Idempotency
async function testIdempotentRetry() {
  const engine = new TransactionalInventoryEngine(10);

  // User clicks Approve (Req 1)
  const res1 = await engine.deductDealerStockForInstallation('LEAD_4', 'Customer D', 'Sri Solar', 4, 'Admin');
  assert.strictEqual(res1.alreadyDeducted, false);
  assert.strictEqual(engine.dealerStock['Waaree 550W'], 6);

  // Browser retries due to simulated timeout (Req 2 with same leadId)
  const res2 = await engine.deductDealerStockForInstallation('LEAD_4', 'Customer D', 'Sri Solar', 4, 'Admin');
  assert.strictEqual(res2.alreadyDeducted, true);
  assert.strictEqual(engine.dealerStock['Waaree 550W'], 6, 'Stock must NOT be deducted twice on retry');
  console.log('✅ PASS: Test 3 - Idempotent retry prevents duplicate stock consumption');
}

// TEST 4: Double Reversal Prevention
async function testDoubleReversal() {
  const engine = new TransactionalInventoryEngine(10);
  await engine.deductDealerStockForInstallation('LEAD_5', 'Customer E', 'Sri Solar', 4, 'Admin');
  assert.strictEqual(engine.dealerStock['Waaree 550W'], 6);

  // First reversal
  const rev1 = await engine.reverseConsumption('LEAD_5', 'Admin');
  assert.strictEqual(rev1.newStock, 10);

  // Second reversal attempt -> MUST FAIL
  try {
    await engine.reverseConsumption('LEAD_5', 'Admin');
    assert.fail('Should have blocked double reversal');
  } catch (err) {
    assert.match(err.message, /already reversed/, 'Expected double reversal blocked');
    assert.strictEqual(engine.dealerStock['Waaree 550W'], 10, 'Stock must not be restored again');
  }
  console.log('✅ PASS: Test 4 - Double reversal strictly blocked');
}

// TEST 5: Concurrent Central Warehouse Dispatches
async function testConcurrentDispatch() {
  const engine = new TransactionalInventoryEngine(0, 25); // Central stock: 25

  const p1 = engine.dispatchFromCentral('DISP_1', 'Dealer_A', 15, 'Admin');
  const p2 = engine.dispatchFromCentral('DISP_2', 'Dealer_B', 15, 'Admin');

  const results = await Promise.allSettled([p1, p2]);
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.strictEqual(succeeded.length, 1, 'Only one dispatch of 15 should succeed on 25 stock');
  assert.strictEqual(rejected.length, 1, 'Second dispatch of 15 should fail');
  assert.strictEqual(engine.centralStock['Waaree 550W'], 10, 'Remaining central stock must be 10');
  console.log('✅ PASS: Test 5 - Central warehouse concurrent dispatch validated');
}

async function runAll() {
  await testConcurrentConsumption();
  await testInsufficientStock();
  await testIdempotentRetry();
  await testDoubleReversal();
  await testConcurrentDispatch();
  console.log('\n=== ALL 5 INVENTORY CONCURRENCY TESTS PASSED WITH ZERO FAILURES ===');
}

runAll();
