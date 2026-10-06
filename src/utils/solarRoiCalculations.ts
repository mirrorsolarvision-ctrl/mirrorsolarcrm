/**
 * Comprehensive Solar ROI, Generation & Financial Savings Calculation Engine
 * Tailored for Indian Residential (PM Surya Ghar) and Commercial Rooftop Solar.
 */

export interface SolarRoiInput {
  capacityKw: number;
  totalSystemCost?: number;
  subsidyAmount?: number;
  tariffPerUnit?: number; // In ₹/kWh (e.g. ₹7.50)
  annualDegradationPercent?: number; // Panel degradation, e.g. 0.6%
  annualTariffInflationPercent?: number; // Electricity price hike, e.g. 4.0%
  peakSunHoursPerDay?: number; // Average sunny hours, default: 4.3
}

export interface YearProjection {
  year: number;
  generationKwh: number;
  tariffPerUnit: number;
  annualSavings: number;
  cumulativeSavings: number;
  netCashFlow: number;
}

export interface SolarRoiResult {
  capacityKw: number;
  totalSystemCost: number;
  subsidyAmount: number;
  netInvestment: number;
  dailyGenerationUnits: number;
  monthlyGenerationUnits: number;
  annualGenerationUnits: number;
  monthlySavings: number;
  annualSavingsYear1: number;
  paybackPeriodYears: number;
  paybackPeriodMonths: number;
  lifetime25YearSavings: number;
  lifetimeNetProfit: number;
  returnOnInvestmentPercent: number;
  co2OffsetLifetimeTons: number;
  equivalentTreesPlanted: number;
  recommendedRooftopSqFt: number;
  yearProjections: YearProjection[];
}

/**
 * Calculates complete Solar ROI, Energy Generation, and 25-Year Cash Flow Projection
 */
export function calculateSolarRoi(input: SolarRoiInput): SolarRoiResult {
  const capacityKw = Math.max(0.5, Number(input.capacityKw) || 3);
  const peakHours = input.peakSunHoursPerDay || 4.3;
  const tariff = input.tariffPerUnit || 7.5;
  const degradation = (input.annualDegradationPercent ?? 0.6) / 100;
  const inflation = (input.annualTariffInflationPercent ?? 4.0) / 100;

  // Approximate baseline benchmark cost in India if not provided (₹55,000 - ₹65,000 per kW)
  const defaultCost = capacityKw <= 3 ? capacityKw * 65000 : capacityKw <= 10 ? capacityKw * 58000 : capacityKw * 52000;
  const totalSystemCost = input.totalSystemCost !== undefined && input.totalSystemCost > 0 
    ? input.totalSystemCost 
    : defaultCost;

  // PM Surya Ghar: 1kW=₹30,000, 2kW=₹60,000, 3kW+=₹78,000 max
  let defaultSubsidy = 0;
  if (capacityKw <= 1) defaultSubsidy = 30000;
  else if (capacityKw <= 2) defaultSubsidy = 60000;
  else defaultSubsidy = 78000;

  const subsidyAmount = input.subsidyAmount !== undefined ? input.subsidyAmount : defaultSubsidy;
  const netInvestment = Math.max(0, totalSystemCost - subsidyAmount);

  // Daily, Monthly, and Annual Generation (Year 1)
  const dailyGenerationUnits = Math.round(capacityKw * peakHours * 10) / 10;
  const monthlyGenerationUnits = Math.round(dailyGenerationUnits * 30);
  const annualGenerationUnits = Math.round(dailyGenerationUnits * 365);

  const monthlySavings = Math.round(monthlyGenerationUnits * tariff);
  const annualSavingsYear1 = Math.round(annualGenerationUnits * tariff);

  // Simple and Compound Payback Period
  const paybackPeriodYearsRaw = netInvestment > 0 && annualSavingsYear1 > 0 ? (netInvestment / annualSavingsYear1) : 0;
  const paybackPeriodYears = Math.floor(paybackPeriodYearsRaw);
  const paybackPeriodMonths = Math.round((paybackPeriodYearsRaw - paybackPeriodYears) * 12);

  // 25-Year Projection Simulation
  const yearProjections: YearProjection[] = [];
  let cumulativeSavings = 0;
  let currentGeneration = annualGenerationUnits;
  let currentTariff = tariff;

  for (let year = 1; year <= 25; year++) {
    if (year > 1) {
      currentGeneration = Math.round(currentGeneration * (1 - degradation));
      currentTariff = currentTariff * (1 + inflation);
    }
    const annualSavings = Math.round(currentGeneration * currentTariff);
    cumulativeSavings += annualSavings;

    yearProjections.push({
      year,
      generationKwh: currentGeneration,
      tariffPerUnit: Math.round(currentTariff * 100) / 100,
      annualSavings,
      cumulativeSavings,
      netCashFlow: cumulativeSavings - netInvestment
    });
  }

  const lifetime25YearSavings = cumulativeSavings;
  const lifetimeNetProfit = Math.max(0, lifetime25YearSavings - netInvestment);
  const returnOnInvestmentPercent = netInvestment > 0 
    ? Math.round((lifetimeNetProfit / netInvestment) * 100) 
    : 0;

  // Environmental Metrics (0.82 kg CO2 saved per kWh solar generated)
  const totalLifetimeGeneration = yearProjections.reduce((sum, y) => sum + y.generationKwh, 0);
  const co2OffsetLifetimeTons = Math.round((totalLifetimeGeneration * 0.82) / 1000);
  const equivalentTreesPlanted = Math.round((co2OffsetLifetimeTons * 1000) / 20); // 1 tree absorbs ~20kg CO2/yr

  // Recommended Roof Area: ~65 sq.ft per kW
  const recommendedRooftopSqFt = Math.round(capacityKw * 65);

  return {
    capacityKw,
    totalSystemCost,
    subsidyAmount,
    netInvestment,
    dailyGenerationUnits,
    monthlyGenerationUnits,
    annualGenerationUnits,
    monthlySavings,
    annualSavingsYear1,
    paybackPeriodYears,
    paybackPeriodMonths,
    lifetime25YearSavings,
    lifetimeNetProfit,
    returnOnInvestmentPercent,
    co2OffsetLifetimeTons,
    equivalentTreesPlanted,
    recommendedRooftopSqFt,
    yearProjections
  };
}
