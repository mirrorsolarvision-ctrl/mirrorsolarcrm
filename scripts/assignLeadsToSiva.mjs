/**
 * MIRROR SOLAR VISION CRM — SAFE LEAD MIGRATION & RECONCILIATION SCRIPT
 * 
 * SAFETY POLICY:
 * - Defaults to DRY-RUN mode. Requires explicit `--apply` flag to write changes.
 * - Refuses execution if target project is production ('crm-webapp-d32bc').
 * - Requires explicit target project via `--project <projectId>`.
 * - Requires verified target Auth UID (`--target-uid <uid>`).
 * - Reconciles 3 ownership categories without touching other employees' leads:
 *     1. Legacy UID: DHIl07h9rJPBlfzc7Cg8hrfVaWj2 (16 leads)
 *     2. Employee Code: MSV-SIVA-001 (1 lead)
 *     3. Verified UID: bkTpWQKgmsXRBjCHEcwD8uO9nrJ3 (3 leads - already valid)
 * - Generates a complete JSON audit manifest.
 * - Can execute against a local snapshot file (--snapshot <path>) or live staging Firestore.
 */

import fs from 'fs';
import path from 'path';

// Helper to unwrap Firestore REST API JSON exports if present
function unwrapRecord(item) {
  if (item && item.fields) {
    const data = { id: item.docId };
    for (const [k, v] of Object.entries(item.fields)) {
      if (v.stringValue !== undefined) data[k] = v.stringValue;
      else if (v.booleanValue !== undefined) data[k] = v.booleanValue;
      else if (v.integerValue !== undefined) data[k] = Number(v.integerValue);
      else if (v.doubleValue !== undefined) data[k] = Number(v.doubleValue);
      else if (v.timestampValue !== undefined) data[k] = v.timestampValue;
      else if (v.nullValue !== undefined) data[k] = null;
      else if (v.mapValue !== undefined) data[k] = v.mapValue.fields;
      else if (v.arrayValue !== undefined) data[k] = v.arrayValue.values;
      else data[k] = v;
    }
    return data;
  }
  return item;
}

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const isApply = args.includes('--apply');
const isDryRun = !isApply;
const projectArg = getArg('--project') || process.env.FIREBASE_PROJECT_ID;
const targetUid = getArg('--target-uid') || process.env.TARGET_AUTH_UID || 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3';
const snapshotArg = getArg('--snapshot');
const manifestOutputArg = getArg('--manifest') || 'backups/migration_manifest_siva_dryrun.json';

const LEGACY_SIVA_UID = 'DHIl07h9rJPBlfzc7Cg8hrfVaWj2';
const SIVA_EMPLOYEE_CODE = 'MSV-SIVA-001';
const SIVA_EMPLOYEE_NAME = 'Sunkara Siva';
const VERIFIED_SIVA_UID = 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3';

console.log('='.repeat(70));
console.log('MIRROR SOLAR VISION CRM — LEAD RECONCILIATION AUDIT');
console.log(`Mode:            ${isDryRun ? 'DRY-RUN (Simulated - No writes)' : 'APPLY (Active writes)'}`);
console.log(`Target UID:      ${targetUid}`);
console.log(`Target Project:  ${projectArg || (snapshotArg ? 'Local Snapshot' : 'Not specified')}`);
console.log('='.repeat(70));

// Production Safety Guard
if (projectArg === 'crm-webapp-d32bc') {
  console.error('\n[SECURITY ERROR] Target project is "crm-webapp-d32bc" (PRODUCTION).');
  console.error('Lead migration scripts are strictly forbidden from executing against production.');
  console.error('Aborting execution.\n');
  process.exit(1);
}

if (!snapshotArg && !projectArg) {
  console.error('\n[ERROR] Either --snapshot <filePath> or --project <projectId> must be specified.');
  console.error('Example (local audit): node scripts/assignLeadsToSiva.mjs --snapshot backups/snapshot_2026-11-04T04-47-09-409Z/leads.json');
  console.error('Example (staging live): node scripts/assignLeadsToSiva.mjs --project crm-webapp-staging-msv --target-uid bkTpWQKgmsXRBjCHEcwD8uO9nrJ3\n');
  process.exit(1);
}

if (isApply && !process.env.ALLOW_DATA_MODIFICATION) {
  console.error('\n[ERROR] --apply requires ALLOW_DATA_MODIFICATION=true in environment variables.\n');
  process.exit(1);
}

async function run() {
  let leadsData = [];

  if (snapshotArg) {
    const fullPath = path.resolve(snapshotArg);
    if (!fs.existsSync(fullPath)) {
      console.error(`Snapshot file not found: ${fullPath}`);
      process.exit(1);
    }
    console.log(`Reading leads from local snapshot: ${fullPath}`);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    leadsData = parsed.map(unwrapRecord);
  } else {
    // Dynamic import for live firestore connection
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, collection, getDocs } = await import('firebase/firestore');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('[ERROR] Live Firestore reconciliation requires ADMIN_EMAIL and ADMIN_PASSWORD.');
      process.exit(1);
    }

    const app = initializeApp({
      projectId: projectArg,
      apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
      authDomain: `${projectArg}.firebaseapp.com`
    });
    const auth = getAuth(app);
    const db = getFirestore(app);

    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log(`Authenticated with ${projectArg}`);

    const snap = await getDocs(collection(db, 'leads'));
    leadsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  console.log(`Total lead records retrieved: ${leadsData.length}`);

  const manifest = {
    executedAt: new Date().toISOString(),
    mode: isDryRun ? 'DRY_RUN' : 'APPLIED',
    targetProject: projectArg || 'snapshot',
    targetUid: targetUid,
    counts: {
      totalScanned: leadsData.length,
      category1_legacyUid: 0,
      category2_employeeCode: 0,
      category3_verifiedUid: 0,
      totalSivaAssociated: 0,
      otherEmployeesUntouched: 0,
      plannedUpdates: 0,
      appliedUpdates: 0
    },
    reconciledLeads: []
  };

  for (const lead of leadsData) {
    const leadId = lead.id;
    const assignedId = lead.assignedEmployeeId;
    const assignedName = lead.assignedEmployee;
    const ownerId = lead.leadOwnerId;

    let category = null;
    let reason = '';

    // Category 1: Legacy UID
    if (assignedId === LEGACY_SIVA_UID || ownerId === LEGACY_SIVA_UID) {
      category = 'Category 1: Legacy UID';
      reason = `Matches legacy UID ${LEGACY_SIVA_UID}`;
      manifest.counts.category1_legacyUid++;
    }
    // Category 2: Employee Code
    else if (assignedId === SIVA_EMPLOYEE_CODE || (assignedName === SIVA_EMPLOYEE_NAME && !assignedId)) {
      category = 'Category 2: Employee Code';
      reason = `Matches employee code ${SIVA_EMPLOYEE_CODE} or unmapped name ${SIVA_EMPLOYEE_NAME}`;
      manifest.counts.category2_employeeCode++;
    }
    // Category 3: Already verified UID
    else if (assignedId === VERIFIED_SIVA_UID || ownerId === VERIFIED_SIVA_UID) {
      category = 'Category 3: Verified UID';
      reason = `Already assigned to verified UID ${VERIFIED_SIVA_UID}`;
      manifest.counts.category3_verifiedUid++;
    }
    // Other employees' leads - Must NOT be touched
    else {
      manifest.counts.otherEmployeesUntouched++;
      continue;
    }

    manifest.counts.totalSivaAssociated++;

    const requiresUpdate = (category === 'Category 1: Legacy UID' || category === 'Category 2: Employee Code') && assignedId !== targetUid;

    if (requiresUpdate) {
      manifest.counts.plannedUpdates++;
    }

    manifest.reconciledLeads.push({
      leadId: leadId,
      customer: lead.customer || lead.name || 'Unknown',
      phone: lead.phone || '',
      category: category,
      reason: reason,
      previousAssignedEmployeeId: assignedId || null,
      previousLeadOwnerId: ownerId || null,
      newAssignedEmployeeId: targetUid,
      newLeadOwnerId: targetUid,
      requiresUpdate: requiresUpdate,
      status: isApply && requiresUpdate ? 'UPDATED' : (requiresUpdate ? 'PLANNED' : 'ALREADY_MATCHED')
    });
  }

  // If live and applying, perform updates
  if (isApply && !snapshotArg) {
    const { getFirestore, doc, updateDoc } = await import('firebase/firestore');
    const { getApp } = await import('firebase/app');
    const db = getFirestore(getApp());

    for (const item of manifest.reconciledLeads) {
      if (item.requiresUpdate) {
        await updateDoc(doc(db, 'leads', item.leadId), {
          assignedEmployeeId: targetUid,
          leadOwnerId: targetUid,
          updatedAt: new Date().toISOString()
        });
        manifest.counts.appliedUpdates++;
        console.log(`[APPLIED] Updated lead ${item.leadId} -> ${targetUid}`);
      }
    }
  }

  // Ensure output directory exists
  const manifestDir = path.dirname(path.resolve(manifestOutputArg));
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  fs.writeFileSync(path.resolve(manifestOutputArg), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n' + '='.repeat(70));
  console.log('RECONCILIATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Leads Scanned:               ${manifest.counts.totalScanned}`);
  console.log(`Category 1 (Legacy UID):           ${manifest.counts.category1_legacyUid}`);
  console.log(`Category 2 (Employee Code):        ${manifest.counts.category2_employeeCode}`);
  console.log(`Category 3 (Already Verified UID): ${manifest.counts.category3_verifiedUid}`);
  console.log(`Total Siva Associated Leads:       ${manifest.counts.totalSivaAssociated}`);
  console.log(`Other Employees (Untouched):       ${manifest.counts.otherEmployeesUntouched}`);
  console.log(`Planned Updates:                   ${manifest.counts.plannedUpdates}`);
  console.log(`Applied Updates:                   ${manifest.counts.appliedUpdates}`);
  console.log(`Audit Manifest Written To:         ${manifestOutputArg}`);
  console.log('='.repeat(70));
}

run().catch(err => {
  console.error('Fatal error during reconciliation:', err);
  process.exit(1);
});
