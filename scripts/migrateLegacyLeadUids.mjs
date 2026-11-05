/**
 * MIRROR SOLAR VISION CRM — LEGACY LEAD UID AUDIT & MIGRATION TOOL
 * 
 * Task 1: Identify legacy lead records that need UID migration.
 * Target: feature/telecaller-mvp-nov04
 * 
 * Usage:
 *   node scripts/migrateLegacyLeadUids.mjs            # Dry run audit only (default, zero writes)
 *   node scripts/migrateLegacyLeadUids.mjs --dry-run  # Dry run audit only (zero writes)
 *   node scripts/migrateLegacyLeadUids.mjs --execute  # Applies updates to Firestore
 */

import fs from 'fs';
import path from 'path';

const isDryRun = !process.argv.includes('--execute');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
if (!fs.existsSync(configPath)) {
  console.error('Firebase CLI credentials not found at:', configPath);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const PROJECT_ID = 'crm-webapp-d32bc';

console.log('================================================================================');
console.log('  MIRROR SOLAR VISION CRM — LEGACY LEAD UID AUDIT & MIGRATION TOOL              ');
console.log(`  Execution Mode: ${isDryRun ? 'DRY-RUN (AUDIT ONLY — ZERO WRITES)' : 'LIVE EXECUTION'}`);
console.log('================================================================================\n');

// Known Authoritative Mapping
const KNOWN_UID_MAP = {
  // Legacy pre-remediation UID -> Active Auth UID for Sunkara Siva
  'DHIl07h9rJPBlfzc7Cg8hrfVaWj2': 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3',
  // Legacy employee code -> Active Auth UID
  'MSV-SIVA-001': 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3',
  // Sunkara Siva Name match
  'sunkara siva': 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3',
  // Mirror Solar Vision Admin
  'mirror solar admin': 'J5Iht5bVwPQEOme5RpHPdruYlqB3',
  'mirror solar vision admin': 'J5Iht5bVwPQEOme5RpHPdruYlqB3'
};

async function fetchAll(collectionName) {
  let docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.documents) {
      docs.push(...data.documents);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

function parseFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) res[k] = Number(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.mapValue !== undefined) res[k] = parseFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(val => val.stringValue || val);
    else res[k] = v;
  }
  return res;
}

async function runAuditAndMigration() {
  const userDocs = await fetchAll('users');
  const leadDocs = await fetchAll('leads');

  const users = userDocs.map(d => ({ docId: d.name.split('/').pop(), ...parseFields(d.fields) }));
  const leads = leadDocs.map(d => ({ docId: d.name.split('/').pop(), ...parseFields(d.fields) }));

  console.log(`Audited ${leads.length} Leads against ${users.length} Active System Users.\n`);

  const activeUserUids = new Set(users.map(u => u.docId));
  const legacyLeads = [];

  for (const lead of leads) {
    const assignedId = lead.assignedEmployeeId || '';
    const ownerId = lead.leadOwnerId || '';
    const assignedName = lead.assignedEmployee || '';

    const isAssignedValid = assignedId && activeUserUids.has(assignedId);
    const isOwnerValid = ownerId && activeUserUids.has(ownerId);

    if (!isAssignedValid && !isOwnerValid) {
      let proposedUid = null;
      let reason = 'Unmapped legacy identity';

      if (assignedId && KNOWN_UID_MAP[assignedId]) {
        proposedUid = KNOWN_UID_MAP[assignedId];
        reason = `Mapped legacy UID/Code ${assignedId} -> ${proposedUid}`;
      } else if (assignedName && KNOWN_UID_MAP[assignedName.toLowerCase().trim()]) {
        proposedUid = KNOWN_UID_MAP[assignedName.toLowerCase().trim()];
        reason = `Mapped employee name "${assignedName}" -> ${proposedUid}`;
      }

      legacyLeads.push({
        leadId: lead.docId,
        customer: lead.customer || 'Unnamed Customer',
        assignedEmployee: assignedName || 'None',
        assignedEmployeeId: assignedId || 'Missing',
        leadOwnerId: ownerId || 'Missing',
        proposedUid,
        reason
      });
    }
  }

  console.log('--------------------------------------------------------------------------------');
  console.log(`LEGACY LEADS REQUIRING UID MIGRATION: ${legacyLeads.length} of ${leads.length}`);
  console.log('--------------------------------------------------------------------------------\n');

  legacyLeads.forEach((item, idx) => {
    console.log(`[${String(idx + 1).padStart(2, '0')}] Lead ID: ${item.leadId}`);
    console.log(`     Customer: ${item.customer}`);
    console.log(`     Current assignedEmployee: "${item.assignedEmployee}" | assignedEmployeeId: "${item.assignedEmployeeId}"`);
    console.log(`     Proposed Migration UID:   ${item.proposedUid || 'REQUIRES MANUAL STAFF ASSIGNMENT'}`);
    console.log(`     Resolution Reason:        ${item.reason}\n`);
  });

  if (isDryRun) {
    console.log('================================================================================');
    console.log('DRY RUN COMPLETE — ZERO WRITES PERFORMED.');
    console.log('To apply authoritative UIDs after stakeholder sign-off:');
    console.log('  node scripts/migrateLegacyLeadUids.mjs --execute');
    console.log('================================================================================\n');
    return;
  }

  // Live execution mode
  console.log('Applying UID migrations to Firestore...');
  let updateCount = 0;
  for (const item of legacyLeads) {
    if (!item.proposedUid) continue;
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/leads/${item.leadId}?updateMask.fieldPaths=assignedEmployeeId&updateMask.fieldPaths=leadOwnerId`;
    const body = {
      fields: {
        assignedEmployeeId: { stringValue: item.proposedUid },
        leadOwnerId: { stringValue: item.proposedUid }
      }
    };
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      updateCount++;
    } else {
      console.error(`Failed to update ${item.leadId}:`, await res.text());
    }
  }
  console.log(`Successfully migrated ${updateCount} leads to authoritative UIDs.`);
}

runAuditAndMigration().catch(err => {
  console.error('Fatal migration audit error:', err);
  process.exit(1);
});

