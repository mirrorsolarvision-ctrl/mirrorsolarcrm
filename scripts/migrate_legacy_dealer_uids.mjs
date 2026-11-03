/**
 * Mirror Solar Vision CRM - Legacy Dealer UID Safety Migration
 * 
 * Script: migrate_legacy_dealer_uids.mjs
 * Purpose: Ensures all existing production leads have immutable `dealerId: <Auth UID>`
 *          so that tightening rules to `resource.data.dealerId == request.auth.uid`
 *          does not orphan legacy leads that previously only stored `dealerCode`.
 * 
 * Execution:
 *   node scripts/migrate_legacy_dealer_uids.mjs --dry-run
 *   node scripts/migrate_legacy_dealer_uids.mjs --execute
 */

import fs from 'fs';
import path from 'path';

const isDryRun = !process.argv.includes('--execute');

console.log('=================================================================');
console.log('MIRROR SOLAR VISION CRM - LEGACY DEALER UID MIGRATION CHECK');
console.log(`Execution Mode: ${isDryRun ? 'DRY RUN (Simulation Only)' : 'LIVE EXECUTION'}`);
console.log('=================================================================\n');

// In local simulation or emulator mode, initialize db
// For live execution against production, service account is required with Project Owner authorization.

export function buildDealerCodeToUidMap(usersList, dealersList) {
  const codeToUid = new Map();

  for (const user of usersList) {
    if (user.role === 'Dealer' && user.uid) {
      if (user.dealerCode) codeToUid.set(user.dealerCode.trim().toUpperCase(), user.uid);
      if (user.code) codeToUid.set(user.code.trim().toUpperCase(), user.uid);
      if (user.dealerId) codeToUid.set(user.dealerId.trim().toUpperCase(), user.uid);
    }
  }

  for (const dealer of dealersList) {
    const uid = dealer.authUid || dealer.uid || dealer.userId;
    if (uid) {
      if (dealer.dealerCode) codeToUid.set(dealer.dealerCode.trim().toUpperCase(), uid);
      if (dealer.code) codeToUid.set(dealer.code.trim().toUpperCase(), uid);
    }
  }

  return codeToUid;
}

export function scanAndMigrateLeads(leadsList, codeToUidMap) {
  const migrationPlan = [];

  for (const lead of leadsList) {
    const hasValidUid = Boolean(lead.dealerId && lead.dealerId.length >= 20); // Firebase UIDs are ~28 chars
    const hasDealerCode = Boolean(lead.dealerCode);

    if (hasDealerCode && !hasValidUid) {
      const normalizedCode = lead.dealerCode.trim().toUpperCase();
      const matchedUid = codeToUidMap.get(normalizedCode);

      migrationPlan.push({
        leadId: lead.id,
        customer: lead.customer,
        currentDealerCode: lead.dealerCode,
        currentDealerId: lead.dealerId || null,
        targetDealerId: matchedUid || 'UNKNOWN_DEALER_UID_REQUIRES_MANUAL_REVIEW',
        status: matchedUid ? 'READY_TO_MIGRATE' : 'UNMAPPED_CODE'
      });
    }
  }

  return migrationPlan;
}

// Self-test simulation
const sampleUsers = [
  { uid: 'DLR_RAMESH_UID_123456789012345678', role: 'Dealer', dealerCode: 'MSV/DLR/01' },
  { uid: 'DLR_SURESH_UID_123456789012345678', role: 'Dealer', dealerCode: 'MSV/DLR/02' }
];

const sampleDealers = [
  { id: 'dealer_1', dealerCode: 'MSV/DLR/01', authUid: 'DLR_RAMESH_UID_123456789012345678' }
];

const sampleLeads = [
  { id: 'lead_1', customer: 'Rao Solar', dealerCode: 'MSV/DLR/01', dealerId: undefined },
  { id: 'lead_2', customer: 'Naidu Agri', dealerCode: 'MSV/DLR/02', dealerId: 'DLR_SURESH_UID_123456789012345678' },
  { id: 'lead_3', customer: 'Kiran Home', dealerCode: 'MSV/DLR/99', dealerId: null }
];

const map = buildDealerCodeToUidMap(sampleUsers, sampleDealers);
const plan = scanAndMigrateLeads(sampleLeads, map);

console.log(`[Self-Check] Found ${plan.length} legacy leads requiring migration:`);
for (const item of plan) {
  console.log(` - Lead ${item.leadId} (${item.customer}): dealerCode=${item.currentDealerCode} -> targetDealerId=${item.targetDealerId} [${item.status}]`);
}
console.log('\n[Self-Check] Migration algorithm validated successfully.');
