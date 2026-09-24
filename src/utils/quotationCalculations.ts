import type { QuotationItem, QuotationFinancials, QuotationProjectDetails } from '../types/quotation';

/**
 * Recalculates line item values strictly:
 * Line Base = (Unit Rate * Qty) - Discount
 * Tax Amount = Line Base * (Tax Rate % / 100)
 * Total = Line Base + Tax Amount
 */
export function recalculateLineItem(item: QuotationItem): QuotationItem {
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

/**
 * Calculates national PM Surya Ghar subsidy based on plant capacity (kW)
 */
export function calculateSuryaGharSubsidy(capacityKw: number, isEligible: boolean = true): number {
  if (!isEligible || capacityKw <= 0) return 0;
  
  if (capacityKw >= 3) {
    return 78000; // Ceiling subsidy for 3kW and above
  } else if (capacityKw >= 2) {
    return 60000; // 2kW subsidy
  } else if (capacityKw >= 1) {
    return 30000; // 1kW subsidy
  }
  return 0;
}

/**
 * Recalculates all quotation financials from line items
 */
export function calculateQuotationFinancials(
  items: QuotationItem[],
  extraDiscount: number = 0,
  isSubsidyEligible: boolean = true,
  capacityKw: number = 3
): QuotationFinancials {
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

  // Equal split CGST and SGST for intra-state
  const cgst = Math.round((gstTotal / 2) * 100) / 100;
  const sgst = Math.round((gstTotal / 2) * 100) / 100;
  const igst = 0;

  const subsidyAmount = calculateSuryaGharSubsidy(capacityKw, isSubsidyEligible);
  const rawGrandTotal = taxableAmount + gstTotal;
  
  // Exact round off
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  const netPayableByCustomer = Math.max(0, roundedGrandTotal - subsidyAmount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalItemDiscount: Math.round(totalItemDiscount * 100) / 100,
    extraDiscount: cleanExtraDiscount,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    gstTotal: Math.round(gstTotal * 100) / 100,
    cgst,
    sgst,
    igst,
    subsidyEligible: isSubsidyEligible,
    subsidyAmount,
    roundOff,
    grandTotal: roundedGrandTotal,
    netPayableByCustomer
  };
}

/**
 * Generates initial recommended Bill-Of-Materials (BOM) from Solar Estimator specs
 */
export function generateRecommendedBOM(
  capacityKw: number,
  panelWattage: number = 550,
  phaseType: 'Single Phase' | 'Three Phase' = 'Single Phase',
  hasBattery: boolean = false
): QuotationItem[] {
  const panelCount = Math.ceil((capacityKw * 1000) / panelWattage);
  const structureCount = panelCount;
  const dcCableMeters = Math.max(30, capacityKw * 20);
  const acCableMeters = 25;

  const items: QuotationItem[] = [
    {
      id: `item-panel-${Date.now()}-1`,
      category: 'Solar Panel',
      name: `Mono PERC Half-Cut DCR Solar Modules (${panelWattage}W)`,
      brand: 'Waaree / Vikram Solar',
      model: `${panelWattage}Wp Bifacial`,
      specifications: `${panelCount} modules x ${panelWattage}W = ${(panelCount * panelWattage) / 1000} kWp total capacity`,
      hsnCode: '85414300',
      quantity: panelCount,
      unit: 'Nos',
      unitRate: 11500,
      discount: 0,
      taxRatePercent: 12,
      taxAmount: 0,
      total: 0
    },
    {
      id: `item-inverter-${Date.now()}-2`,
      category: 'Inverter',
      name: `Solar Grid-Tied Inverter (${capacityKw} kW, ${phaseType})`,
      brand: 'Growatt / Solis / Sungrow',
      model: `${capacityKw}kW-${phaseType === 'Single Phase' ? '1P' : '3P'} Dual MPPT`,
      specifications: 'WiFi Monitoring, IP65 protection, 5-Year Standard Warranty',
      hsnCode: '85044090',
      quantity: 1,
      unit: 'Sets',
      unitRate: capacityKw <= 3 ? 36000 : capacityKw <= 5 ? 52000 : 78000,
      discount: 0,
      taxRatePercent: 12,
      taxAmount: 0,
      total: 0
    },
    {
      id: `item-structure-${Date.now()}-3`,
      category: 'Structure',
      name: 'Galvanized Iron (GI) Heavy Duty Mounting Structure (80 Micron)',
      brand: 'Standard GI 80 Micron',
      model: 'Elevated High-Rise / Standard Tilt (15°-25°)',
      specifications: 'Wind speed endurance up to 150 km/h with SS304 Fasteners',
      hsnCode: '73089090',
      quantity: structureCount,
      unit: 'Nos',
      unitRate: 1850,
      discount: 0,
      taxRatePercent: 18,
      taxAmount: 0,
      total: 0
    },
    {
      id: `item-dc-cable-${Date.now()}-4`,
      category: 'DC Cable',
      name: '4 sq.mm UV Resistant Solar DC Cable (Red & Black)',
      brand: 'Polycab / Havells',
      specifications: 'Tinned Copper, XLPO Insulation, Dual Layer',
      hsnCode: '85444999',
      quantity: dcCableMeters,
      unit: 'Meters',
      unitRate: 48,
      discount: 0,
      taxRatePercent: 18,
      taxAmount: 0,
      total: 0
    },
    {
      id: `item-ac-cable-${Date.now()}-5`,
      category: 'AC Cable',
      name: '4 sq.mm 3-Core/4-Core Copper Armoured AC Cable',
      brand: 'Polycab / RR Kabel',
      specifications: 'Heavy Duty ISI Certified Armoured',
      hsnCode: '85444999',
      quantity: acCableMeters,
      unit: 'Meters',
      unitRate: 110,
      discount: 0,
      taxRatePercent: 18,
      taxAmount: 0,
      total: 0
    },
    {
      id: `item-earthing-${Date.now()}-6`,
      category: 'Earthing & Lightning',
      name: 'Chemical Earthing Kit with Copper Bonded Electrodes & Lightning Arrester',
      brand: 'Erico / Standard Solar',
      specifications: '3 Earthing Pits (DC, AC, LA) + 1m Copper LA with ESE Spike',
      hsnCode: '85354030',
      quantity: 1,
      unit: 'Sets',
      unitRate: 9500,
      discount: 0,
      taxRatePercent: 18,
      taxAmount: 0,
      total: 0
    },
    {
      id: `item-dcdb-acdb-${Date.now()}-7`,
      category: 'ACDB & DCDB',
      name: 'IP65 ACDB & DCDB Protection Distribution Boxes with SPD & MCB/MCCB',
      brand: 'Schneider / Hensel',
      specifications: 'Type II Surge Protection Device, 1000V DC Fuse, Rotary Isolator',
      hsnCode: '85371000',
      quantity: 1,
      unit: 'Sets',
      unitRate: 6800,
      discount: 0,
      taxRatePercent: 18,
      taxAmount: 0,
      total: 0
    },
    {
      id: `item-installation-${Date.now()}-8`,
      category: 'Installation & Commissioning',
      name: 'Complete Mechanical & Electrical Installation, Testing & Commissioning',
      brand: 'Mirror Solar Certified Engineering Team',
      specifications: 'Includes structural alignment, cabling conduit, safety audit, DISCOM liaisoning',
      hsnCode: '995461',
      quantity: 1,
      unit: 'Lots',
      unitRate: capacityKw * 3500,
      discount: 0,
      taxRatePercent: 18,
      taxAmount: 0,
      total: 0
    }
  ];

  if (hasBattery) {
    items.push({
      id: `item-battery-${Date.now()}-9`,
      category: 'Battery Storage',
      name: 'Lithium Iron Phosphate (LiFePO4) 48V 100Ah Solar Battery',
      brand: 'Luminous / Exide / Eastman',
      model: '48V 5kWh Wall Mount Energy Storage',
      specifications: '6000 cycles at 80% DoD with integrated smart BMS',
      hsnCode: '85076000',
      quantity: 1,
      unit: 'Sets',
      unitRate: 98000,
      discount: 0,
      taxRatePercent: 18,
      taxAmount: 0,
      total: 0
    });
  }

  // Recalculate each item totals
  return items.map(recalculateLineItem);
}
