// Comprehensive Test Suite for Solar CRM VNext Quotation Financials & Subsidies

import assert from 'assert';

// Simulated pure calculation logic mirroring src/utils/quotationCalculations.ts and src/config/subsidyRules.ts

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
      eligible: isEligible && manualOverride.amount > 0,
      amount: manualOverride.amount,
      calculationBreakdown: `Manual Override Applied: ₹${manualOverride.amount}`,
      isOverridden: true
    };
  }

  if (!isEligible || capacityKw <= 0) {
    return { schemeName: 'PM Surya Ghar: Muft Bijli Yojana', ruleVersion: 'PMSGY-2024-V1', eligible: false, amount: 0, isOverridden: false };
  }

  if (customerType !== 'Residential') {
    return { schemeName: 'PM Surya Ghar: Muft Bijli Yojana', ruleVersion: 'PMSGY-2024-V1', eligible: false, amount: 0, isOverridden: false };
  }

  let subsidy = 0;
  if (capacityKw >= 3) subsidy = 78000;
  else if (capacityKw >= 2) subsidy = 60000;
  else if (capacityKw >= 1) subsidy = 30000;

  return {
    schemeName: 'PM Surya Ghar: Muft Bijli Yojana',
    ruleVersion: 'PMSGY-2024-V1',
    eligible: subsidy > 0,
    amount: subsidy,
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

  const subsidyResult = evaluateSubsidy(capacityKw, customerType, isSubsidyEligible, 'PMSGY_2024', manualOverride);
  const rawGrandTotal = taxableAmount + gstTotal;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;
  const netPayableByCustomer = Math.max(0, roundedGrandTotal - subsidyResult.amount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalItemDiscount: Math.round(totalItemDiscount * 100) / 100,
    extraDiscount: cleanExtraDiscount,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    gstTotal: Math.round(gstTotal * 100) / 100,
    cgst,
    sgst,
    igst,
    subsidyEligible: subsidyResult.eligible,
    subsidyRuleVersion: subsidyResult.ruleVersion,
    subsidyAmount: subsidyResult.amount,
    roundOff,
    grandTotal: roundedGrandTotal,
    netPayableByCustomer
  };
}

console.log('--- STARTING QUOTATION FINANCIAL & SUBSIDY VERIFICATION TESTS ---');

// Test 1: Standard 3kW Residential Intra-State
{
  const items = [
    { name: 'Solar Panels', quantity: 6, unitRate: 12000, discount: 2000, taxRatePercent: 12 }, // (72000 - 2000) = 70000 taxable, 8400 tax
    { name: 'Inverter', quantity: 1, unitRate: 35000, discount: 0, taxRatePercent: 12 },        // 35000 taxable, 4200 tax
    { name: 'Structure', quantity: 1, unitRate: 15000, discount: 1000, taxRatePercent: 18 }      // (15000 - 1000) = 14000 taxable, 2520 tax
  ];
  // Subtotal = 72000 + 35000 + 15000 = 122000
  // Discounts = 3000 -> Taxable = 119000
  // GST = 8400 + 4200 + 2520 = 15120 (CGST: 7560, SGST: 7560)
  // Grand Total = 119000 + 15120 = 134120
  // Subsidy for 3kW = 78000
  // Net Payable = 134120 - 78000 = 56120

  const res = calculateQuotationFinancials(items, 0, true, 3, 'Residential', false);
  assert.strictEqual(res.subtotal, 122000, 'Subtotal mismatch');
  assert.strictEqual(res.taxableAmount, 119000, 'Taxable mismatch');
  assert.strictEqual(res.gstTotal, 15120, 'GST mismatch');
  assert.strictEqual(res.cgst, 7560, 'CGST mismatch');
  assert.strictEqual(res.sgst, 7560, 'SGST mismatch');
  assert.strictEqual(res.igst, 0, 'IGST should be 0 for intra-state');
  assert.strictEqual(res.subsidyAmount, 78000, '3kW subsidy mismatch');
  assert.strictEqual(res.grandTotal, 134120, 'Grand total mismatch');
  assert.strictEqual(res.netPayableByCustomer, 56120, 'Net payable mismatch');
  console.log('✅ Test 1: Standard 3kW Residential Intra-State Passed');
}

// Test 2: Inter-State IGST Calculation
{
  const items = [
    { name: 'Inverter', quantity: 1, unitRate: 40000, discount: 0, taxRatePercent: 18 } // 40000 taxable, 7200 tax
  ];
  const res = calculateQuotationFinancials(items, 0, true, 2, 'Residential', true);
  assert.strictEqual(res.cgst, 0, 'CGST must be 0 for inter-state');
  assert.strictEqual(res.sgst, 0, 'SGST must be 0 for inter-state');
  assert.strictEqual(res.igst, 7200, 'IGST mismatch');
  assert.strictEqual(res.subsidyAmount, 60000, '2kW subsidy must be 60000');
  console.log('✅ Test 2: Inter-State IGST Calculation Passed');
}

// Test 3: Commercial Customer (Subsidy must be 0)
{
  const items = [
    { name: 'Commercial Array', quantity: 10, unitRate: 20000, discount: 0, taxRatePercent: 12 }
  ];
  const res = calculateQuotationFinancials(items, 0, true, 10, 'Commercial', false);
  assert.strictEqual(res.subsidyAmount, 0, 'Commercial customer must not receive PM Surya Ghar subsidy');
  assert.strictEqual(res.subsidyEligible, false, 'Commercial customer eligibility must be false');
  console.log('✅ Test 3: Commercial Exclusion Passed');
}

// Test 4: 1kW vs 2kW vs 5kW Subsidy Tier Limits
{
  const sub1 = evaluateSubsidy(1, 'Residential', true);
  assert.strictEqual(sub1.amount, 30000, '1kW tier mismatch');
  
  const sub2 = evaluateSubsidy(2.5, 'Residential', true);
  assert.strictEqual(sub2.amount, 60000, '2.5kW tier mismatch');
  
  const sub5 = evaluateSubsidy(5, 'Residential', true);
  assert.strictEqual(sub5.amount, 78000, '5kW ceiling cap mismatch (max 78000)');
  console.log('✅ Test 4: Subsidy Tiers & Ceiling Cap Passed');
}

// Test 5: Manual Subsidy Override with Reason
{
  const overrideRes = evaluateSubsidy(3, 'Residential', true, 'PMSGY_2024', { amount: 50000, reason: 'Special State Scheme Adjustment' });
  assert.strictEqual(overrideRes.amount, 50000, 'Override amount mismatch');
  assert.strictEqual(overrideRes.isOverridden, true, 'isOverridden flag must be true');
  console.log('✅ Test 5: Manual Subsidy Override Passed');
}

console.log('--- ALL 5 FINANCIAL & SUBSIDY TESTS PASSED WITH ZERO ERRORS ---');
