// Extended Financial & Tax Calculation Matrix Test Suite

import assert from 'assert';

function recalculateLineItem(item) {
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const unitRate = Math.max(0, Number(item.unitRate) || 0);
  const discount = Math.max(0, Number(item.discount) || 0);
  const taxRate = Math.max(0, Number(item.taxRatePercent) || 0);

  const baseBeforeDiscount = quantity * unitRate;
  const taxableLine = Math.max(0, baseBeforeDiscount - discount);
  const taxAmount = (taxableLine * taxRate) / 100;
  const lineTotal = taxableLine + taxAmount;

  return {
    ...item,
    quantity,
    unitRate,
    discount,
    taxRatePercent: taxRate,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(lineTotal * 100) / 100
  };
}

function evaluateSubsidy(capacityKw, customerType = 'Residential', isEligible = true, schemeId = 'PMSGY_2024', manualOverride) {
  if (manualOverride && typeof manualOverride.amount === 'number' && manualOverride.amount >= 0) {
    return {
      schemeName: 'PM Surya Ghar: Muft Bijli Yojana',
      ruleVersion: 'PMSGY-2024-V1',
      authority: 'MNRE, Govt. of India',
      effectiveFrom: '2024-02-13',
      eligible: isEligible && manualOverride.amount > 0,
      amount: manualOverride.amount,
      calculationBreakdown: `Manual Override Applied: ₹${manualOverride.amount} (Reason: ${manualOverride.reason || 'N/A'})`,
      isOverridden: true,
      overrideReason: manualOverride.reason
    };
  }

  if (!isEligible || capacityKw < 1 || customerType !== 'Residential') {
    return {
      schemeName: 'PM Surya Ghar: Muft Bijli Yojana',
      ruleVersion: 'PMSGY-2024-V1',
      authority: 'MNRE, Govt. of India',
      effectiveFrom: '2024-02-13',
      eligible: false,
      amount: 0,
      calculationBreakdown: customerType !== 'Residential' ? 'Residential only scheme' : 'Ineligible capacity',
      isOverridden: false
    };
  }

  let amount = 0;
  let breakdown = '';
  if (capacityKw >= 3) {
    amount = 78000;
    breakdown = `₹78,000 Maximum Ceiling CFA for ${capacityKw} kW`;
  } else if (capacityKw >= 2) {
    amount = 60000;
    breakdown = `₹60,000 (₹30,000/kW for 2 kW)`;
  } else if (capacityKw >= 1) {
    amount = 30000;
    breakdown = `₹30,000 for 1 kW`;
  }

  return {
    schemeName: 'PM Surya Ghar: Muft Bijli Yojana',
    ruleVersion: 'PMSGY-2024-V1',
    authority: 'MNRE, Govt. of India',
    effectiveFrom: '2024-02-13',
    eligible: true,
    amount,
    calculationBreakdown: breakdown,
    isOverridden: false
  };
}

function calculateQuotationFinancials(items, extraDiscount = 0, isSubsidyEligible = true, capacityKw = 3, customerType = 'Residential', isInterState = false, manualOverride) {
  let subtotal = 0;
  let totalItemDiscount = 0;
  let gstTotal = 0;

  items.forEach(rawItem => {
    const item = recalculateLineItem(rawItem);
    const lineGross = item.quantity * item.unitRate;
    subtotal += lineGross;
    totalItemDiscount += item.discount;
    gstTotal += item.taxAmount;
  });

  const cleanExtraDiscount = Math.max(0, Number(extraDiscount) || 0);
  const totalDiscounts = totalItemDiscount + cleanExtraDiscount;
  const taxableAmount = Math.max(0, subtotal - totalDiscounts);

  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) {
    igst = Math.round(gstTotal * 100) / 100;
  } else {
    cgst = Math.round((gstTotal / 2) * 100) / 100;
    sgst = Math.round((gstTotal / 2) * 100) / 100;
  }

  const subsidySnapshot = evaluateSubsidy(capacityKw, customerType, isSubsidyEligible, 'PMSGY_2024', manualOverride);
  const rawGrandTotal = taxableAmount + gstTotal;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;
  const netPayableByCustomer = Math.max(0, roundedGrandTotal - subsidySnapshot.amount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalItemDiscount: Math.round(totalItemDiscount * 100) / 100,
    extraDiscount: cleanExtraDiscount,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    gstTotal: Math.round(gstTotal * 100) / 100,
    cgst,
    sgst,
    igst,
    subsidySnapshot,
    subsidyEligible: subsidySnapshot.eligible,
    subsidyAmount: subsidySnapshot.amount,
    roundOff,
    grandTotal: roundedGrandTotal,
    netPayableByCustomer
  };
}

console.log('=== STARTING EXTENDED FINANCIAL MATRIX TEST SUITE ===\n');

// 1. Mixed Tax Rates (0%, 5%, 12%, 18%, 28%)
{
  const mixedItems = [
    { name: 'DISCOM Liaisoning', quantity: 1, unitRate: 5000, discount: 0, taxRatePercent: 0 },    // Tax: 0
    { name: 'Solar Panels', quantity: 10, unitRate: 10000, discount: 0, taxRatePercent: 12 },      // Tax: 12000
    { name: 'Mounting Structure', quantity: 1, unitRate: 15000, discount: 0, taxRatePercent: 18 }, // Tax: 2700
    { name: 'Special Battery Aircon', quantity: 1, unitRate: 20000, discount: 0, taxRatePercent: 28 } // Tax: 5600
  ];
  // Subtotal = 5000 + 100000 + 15000 + 20000 = 140000
  // Total Tax = 0 + 12000 + 2700 + 5600 = 20300 (CGST: 10150, SGST: 10150)
  // Grand Total = 140000 + 20300 = 160300
  const res = calculateQuotationFinancials(mixedItems, 0, true, 3, 'Residential', false);
  assert.strictEqual(res.subtotal, 140000);
  assert.strictEqual(res.gstTotal, 20300);
  assert.strictEqual(res.cgst, 10150);
  assert.strictEqual(res.sgst, 10150);
  assert.strictEqual(res.grandTotal, 160300);
  console.log('✅ PASS: Case 1 - Mixed Tax Matrix (0%, 12%, 18%, 28%) accurately aggregated');
}

// 2. Extra Discount Exceeding Subtotal (Negative Prevention)
{
  const items = [{ name: 'Test Line', quantity: 1, unitRate: 1000, discount: 0, taxRatePercent: 18 }];
  // Subtotal = 1000, Extra discount = 2500
  const res = calculateQuotationFinancials(items, 2500, true, 1, 'Residential', false);
  assert.strictEqual(res.taxableAmount, 0, 'Taxable amount must not go negative');
  assert.strictEqual(res.netPayableByCustomer >= 0, true, 'Net payable must be >= 0');
  console.log('✅ PASS: Case 2 - Excessive discount handled with negative total prevention');
}

// 3. Decimal Quantities & Fractional Rounding
{
  const items = [
    { name: '4 sq.mm DC Cable', quantity: 37.5, unitRate: 48.25, discount: 0, taxRatePercent: 18 }
    // 37.5 * 48.25 = 1809.375 -> Taxable: 1809.38, Tax: 325.69, Total: 2135.07
  ];
  const res = calculateQuotationFinancials(items, 0, false, 0);
  assert.strictEqual(res.subtotal, 1809.38);
  assert.strictEqual(res.grandTotal, 2135);
  console.log('✅ PASS: Case 3 - Decimal quantities and round-off adjustments precision validated');
}

// 4. Subsidy Exact Boundary Testing
{
  // 0.99 kW (Below 1kW threshold) -> 0
  assert.strictEqual(evaluateSubsidy(0.99).amount, 0);
  // 1.00 kW -> 30000
  assert.strictEqual(evaluateSubsidy(1.00).amount, 30000);
  // 1.99 kW -> 30000
  assert.strictEqual(evaluateSubsidy(1.99).amount, 30000);
  // 2.00 kW -> 60000
  assert.strictEqual(evaluateSubsidy(2.00).amount, 60000);
  // 2.99 kW -> 60000
  assert.strictEqual(evaluateSubsidy(2.99).amount, 60000);
  // 3.00 kW -> 78000
  assert.strictEqual(evaluateSubsidy(3.00).amount, 78000);
  // 10.00 kW (Cap) -> 78000
  assert.strictEqual(evaluateSubsidy(10.00).amount, 78000);
  console.log('✅ PASS: Case 4 - All 7 Subsidy boundary thresholds verified');
}

// 5. Complete Subsidy Snapshot Structure Check
{
  const snap = evaluateSubsidy(3, 'Residential', true);
  assert.strictEqual(snap.ruleVersion, 'PMSGY-2024-V1');
  assert.strictEqual(snap.schemeName, 'PM Surya Ghar: Muft Bijli Yojana');
  assert.strictEqual(snap.authority, 'MNRE, Govt. of India');
  assert.strictEqual(snap.amount, 78000);
  console.log('✅ PASS: Case 5 - Full immutable subsidy rule snapshot verified for historical audit');
}

console.log('\n=== ALL EXTENDED FINANCIAL MATRIX TESTS PASSED WITH ZERO FAILURES ===');
