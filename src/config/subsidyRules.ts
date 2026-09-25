export interface SubsidyTier {
  minCapacityKw: number;
  maxCapacityKw: number;
  subsidyAmount: number;
  description: string;
}

export interface SubsidySchemeConfig {
  schemeId: string;
  schemeName: string;
  ruleVersion: string;
  authority: string;
  effectiveFrom: string;
  effectiveTo?: string;
  eligibleCustomerTypes: string[];
  maxCeilingAmount: number;
  tiers: SubsidyTier[];
  notes: string;
}

export const ACTIVE_SUBSIDY_SCHEMES: Record<string, SubsidySchemeConfig> = {
  PMSGY_2024: {
    schemeId: 'PMSGY_2024',
    schemeName: 'PM Surya Ghar: Muft Bijli Yojana',
    ruleVersion: 'PMSGY-2024-V1',
    authority: 'Ministry of New and Renewable Energy (MNRE), Govt. of India',
    effectiveFrom: '2024-02-13',
    eligibleCustomerTypes: ['Residential'],
    maxCeilingAmount: 78000,
    tiers: [
      {
        minCapacityKw: 1,
        maxCapacityKw: 1.99,
        subsidyAmount: 30000,
        description: '₹30,000 for systems up to 1 kW'
      },
      {
        minCapacityKw: 2,
        maxCapacityKw: 2.99,
        subsidyAmount: 60000,
        description: '₹60,000 for systems from 2 kW to 2.99 kW (₹30k/kW)'
      },
      {
        minCapacityKw: 3,
        maxCapacityKw: 100,
        subsidyAmount: 78000,
        description: '₹78,000 maximum ceiling for systems 3 kW and above'
      }
    ],
    notes: 'Direct Benefit Transfer (DBT) directly into beneficiary bank account post-inspection and DISCOM net meter commissioning.'
  }
};

export const DEFAULT_SUBSIDY_SCHEME = ACTIVE_SUBSIDY_SCHEMES.PMSGY_2024;

export interface SubsidyEvaluationResult {
  schemeName: string;
  ruleVersion: string;
  eligible: boolean;
  amount: number;
  calculationBreakdown: string;
  isOverridden: boolean;
  overrideReason?: string;
}

/**
 * Versioned evaluator for solar subsidies
 */
export function evaluateSubsidy(
  capacityKw: number,
  customerType: string = 'Residential',
  isEligible: boolean = true,
  schemeId: string = 'PMSGY_2024',
  manualOverride?: { amount: number; reason: string; approvedBy?: string }
): SubsidyEvaluationResult {
  const scheme = ACTIVE_SUBSIDY_SCHEMES[schemeId] || DEFAULT_SUBSIDY_SCHEME;

  // Handle manual override with audit metadata
  if (manualOverride && typeof manualOverride.amount === 'number' && manualOverride.amount >= 0) {
    return {
      schemeName: scheme.schemeName,
      ruleVersion: scheme.ruleVersion,
      eligible: isEligible && manualOverride.amount > 0,
      amount: manualOverride.amount,
      calculationBreakdown: `Manual Override Applied: ₹${manualOverride.amount.toLocaleString('en-IN')} (Reason: ${manualOverride.reason || 'Not specified'})`,
      isOverridden: true,
      overrideReason: manualOverride.reason
    };
  }

  if (!isEligible || capacityKw <= 0) {
    return {
      schemeName: scheme.schemeName,
      ruleVersion: scheme.ruleVersion,
      eligible: false,
      amount: 0,
      calculationBreakdown: !isEligible ? 'Customer marked not eligible for Central Financial Assistance (CFA).' : 'Capacity must be greater than 0 kW.',
      isOverridden: false
    };
  }

  // Check customer type eligibility (PMSGY is strictly for Residential)
  if (!scheme.eligibleCustomerTypes.includes(customerType)) {
    return {
      schemeName: scheme.schemeName,
      ruleVersion: scheme.ruleVersion,
      eligible: false,
      amount: 0,
      calculationBreakdown: `${customerType} consumers are not eligible for ${scheme.schemeName} (Residential only).`,
      isOverridden: false
    };
  }

  // Calculate based on scheme tiers
  let subsidy = 0;
  let breakdown = '';

  if (capacityKw >= 3) {
    subsidy = 78000;
    breakdown = `₹78,000 (Ceiling CFA for ${capacityKw} kW plant under ${scheme.ruleVersion})`;
  } else if (capacityKw >= 2) {
    subsidy = 60000;
    breakdown = `₹60,000 (₹30,000/kW for 2 kW under ${scheme.ruleVersion})`;
  } else if (capacityKw >= 1) {
    subsidy = 30000;
    breakdown = `₹30,000 (1 kW CFA under ${scheme.ruleVersion})`;
  } else {
    subsidy = 0;
    breakdown = `Capacity below minimum 1 kW threshold for CFA under ${scheme.ruleVersion}.`;
  }

  return {
    schemeName: scheme.schemeName,
    ruleVersion: scheme.ruleVersion,
    eligible: subsidy > 0,
    amount: subsidy,
    calculationBreakdown: breakdown,
    isOverridden: false
  };
}
