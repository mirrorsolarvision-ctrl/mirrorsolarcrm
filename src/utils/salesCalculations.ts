/**
 * Sales Calculations & Utilities for Mirror Solar CRM
 * Version 2.3 Architecture
 */

import type { LeadScoreBreakdown, LeadScoreCategory, SlaStatus, DuplicateCheckResult } from '../types/sales';

/**
 * Normalizes any Indian/international phone string to standard E.164 (+91XXXXXXXXXX)
 */
export function toE164Phone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (phone.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

/**
 * 100-Point Lead Scoring Calculator
 * Based on Version 2.3 specification:
 * - Electricity Consumption Suitability (max 25 pts)
 * - Roof & Technical Feasibility (max 25 pts)
 * - Purchase Readiness & Timeline (max 25 pts)
 * - Decision Maker & Financing Readiness (max 25 pts)
 */
export function calculateLeadScore(params: {
  monthlyUnitsKwh?: number;
  monthlyBill?: number;
  roofOwnership?: 'Own' | 'Rented' | string;
  roofType?: 'RCC' | 'Sheet' | 'Other' | string;
  shadingStatus?: 'No' | 'Yes' | 'Unknown' | string;
  purchaseTimeline?: 'Immediate' | 'Within 7 Days' | 'Within 30 Days' | 'Later' | string;
  decisionMaker?: boolean;
  financingRequirement?: 'Self-Funded' | 'Bank Loan' | string;
}): LeadScoreBreakdown {
  let unitsScore = 0;
  let roofScore = 0;
  let readinessScore = 0;
  let financingScore = 0;

  // 1. Units / Bill Consumption (Max 25 pts)
  const units = params.monthlyUnitsKwh || (params.monthlyBill ? Math.round(params.monthlyBill / 7.5) : 0);
  if (units >= 350) {
    unitsScore = 25; // 3kW+ ideal candidate
  } else if (units >= 200) {
    unitsScore = 18; // 2kW candidate
  } else if (units >= 100) {
    unitsScore = 10; // 1kW candidate
  } else {
    unitsScore = 5;
  }

  // 2. Roof & Technical Feasibility (Max 25 pts)
  const isOwner = params.roofOwnership?.toLowerCase() === 'own';
  const isRcc = params.roofType?.toLowerCase() === 'rcc';
  const noShade = params.shadingStatus?.toLowerCase() === 'no';

  if (isOwner) roofScore += 12;
  if (isRcc) roofScore += 8;
  if (noShade) roofScore += 5;

  // 3. Purchase Readiness & Timeline (Max 25 pts)
  const timeline = params.purchaseTimeline?.toLowerCase() || '';
  if (timeline.includes('immediate') || timeline.includes('7 days')) {
    readinessScore = 25;
  } else if (timeline.includes('30 days') || timeline.includes('month')) {
    readinessScore = 16;
  } else {
    readinessScore = 8;
  }

  // 4. Decision Maker & Financing Readiness (Max 25 pts)
  if (params.decisionMaker !== false) financingScore += 12;
  if (params.financingRequirement?.toLowerCase().includes('self')) {
    financingScore += 13; // Self-funded moves faster
  } else {
    financingScore += 8; // Loan processing required
  }

  const total = Math.min(100, unitsScore + roofScore + readinessScore + financingScore);

  let category: LeadScoreCategory = 'Cold';
  if (total >= 75) {
    category = 'Hot';
  } else if (total >= 50) {
    category = 'Warm';
  }

  return {
    total,
    category,
    readinessScore,
    unitsScore,
    roofScore,
    financingScore,
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Universal 15-Minute Working Hours SLA Evaluator
 * Working Hours: 09:30 AM to 06:30 PM (IST), Monday to Saturday
 */
export function evaluateSlaStatus(
  createdAtStr: string,
  firstCallAttemptAtStr?: string
): { status: SlaStatus; minutesRemaining: number; isWithinSla: boolean } {
  if (firstCallAttemptAtStr) {
    const createdTime = new Date(createdAtStr).getTime();
    const firstCallTime = new Date(firstCallAttemptAtStr).getTime();
    const diffMinutes = Math.round((firstCallTime - createdTime) / 60000);

    return {
      status: diffMinutes <= 15 ? 'SLA Met' : 'SLA Breached',
      minutesRemaining: 0,
      isWithinSla: diffMinutes <= 15
    };
  }

  const created = new Date(createdAtStr);
  const now = new Date();
  const elapsedMinutes = Math.round((now.getTime() - created.getTime()) / 60000);
  const minutesRemaining = Math.max(0, 15 - elapsedMinutes);

  if (elapsedMinutes > 15) {
    return {
      status: 'SLA Breached',
      minutesRemaining: 0,
      isWithinSla: false
    };
  }

  return {
    status: 'Timer Running',
    minutesRemaining,
    isWithinSla: true
  };
}

/**
 * E.164 Duplicate Phone Detection
 */
export function findDuplicateLeadByPhone(
  leads: any[],
  inputPhone: string,
  currentLeadId?: string
): DuplicateCheckResult {
  const normTarget = toE164Phone(inputPhone);
  if (!normTarget || normTarget.length < 10) {
    return { hasDuplicate: false, normalizedPhone: normTarget };
  }

  const target10 = normTarget.slice(-10);

  const match = leads.find(l => {
    if (currentLeadId && l.id === currentLeadId) return false;
    const lPhone = toE164Phone(l.phone);
    if (!lPhone) return false;
    return lPhone === normTarget || lPhone.slice(-10) === target10;
  });

  if (match) {
    return {
      hasDuplicate: true,
      matchingLeadId: match.id,
      customerName: match.customer,
      leadOwnerName: match.leadOwnerName || match.assignedEmployee || 'Unassigned',
      salesStage: match.salesStage || match.stage,
      location: match.location,
      normalizedPhone: normTarget
    };
  }

  return {
    hasDuplicate: false,
    normalizedPhone: normTarget
  };
}
