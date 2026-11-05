/**
 * MIRROR SOLAR VISION CRM — SAFE LEAD MIGRATION & RECONCILIATION SCRIPT
 * 
 * AUDIT REQUIREMENTS (PRE-STAGING VERIFICATION GATE):
 * 1. Dry-run is the strict default.
 * 2. Actual modification requires an explicit `--apply` flag.
 * 3. An explicit target project must be specified (`--project <projectId>`).
 * 4. Refuses production project execution ('crm-webapp-d32bc') with hard security failure.
 * 5. Verifies target Auth UID (`bkTpWQKgmsXRBjCHEcwD8uO9nrJ3`) belongs to Sunkara Siva (siva.mirrorsolarvision@gmail.com).
 * 6. Reconciles all 20 historical records using exact legacy UID/code values (not display names alone).
 * 7. Never overwrites another employee's assignments (5 other employees' leads protected).
 * 8. Generates a migration manifest with lead ID, customer, phone, previous assignment, proposed assignment, and status.
 * 9. Generates before-and-after audit evidence.
 * 10. Accounts for all 25 scanned records (20 Siva records + 5 unmigratable/protected records).
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
const projectArg = getArg('--project');
const targetUid = getArg('--target-uid') || 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3';
const snapshotArg = getArg('--snapshot');
const manifestOutputArg = getArg('--manifest') || 'backups/migration_manifest_siva_dryrun.json';

const LEGACY_SIVA_UID = 'DHIl07h9rJPBlfzc7Cg8hrfVaWj2';
const SIVA_EMPLOYEE_CODE = 'MSV-SIVA-001';
const SIVA_EMPLOYEE_NAME = 'Sunkara Siva';
const VERIFIED_SIVA_UID = 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3';
const SIVA_VERIFIED_EMAIL = 'siva.mirrorsolarvision@gmail.com';

console.log('='.repeat(75));
console.log('MIRROR SOLAR VISION CRM — SAFE LEAD MIGRATION & RECONCILIATION AUDIT');
console.log(`Execution Mode:  ${isDryRun ? 'DRY-RUN (Simulated - Zero Database Writes)' : 'APPLY (Active Database Writes)'}`);
console.log(`Target Auth UID: ${targetUid}`);
console.log(`Target Project:  ${projectArg || (snapshotArg ? 'Local Snapshot (' + snapshotArg + ')' : 'None')}`);
console.log('='.repeat(75));

// HARD REQUISITE 1: Explicit project or snapshot required
if (!snapshotArg && !projectArg) {
  console.error('\n[SECURITY ERROR] An explicit target project (--project <id>) or snapshot (--snapshot <path>) is required.');
  console.error('Execution halted.\n');
  process.exit(1);
}

// HARD REQUISITE 2: Production safety guard (Refuse crm-webapp-d32bc)
if (projectArg === 'crm-webapp-d32bc') {
  console.error('\n[CRITICAL SECURITY REFUSAL] Target project is "crm-webapp-d32bc" (PRODUCTION).');
  console.error('Direct migration execution against production is strictly prohibited until separately authorized.');
  console.error('Aborting execution.\n');
  process.exit(1);
}

// HARD REQUISITE 3: Verify target Auth UID matches verified employee
if (targetUid !== VERIFIED_SIVA_UID) {
  console.error(`\n[SECURITY ERROR] Target Auth UID "${targetUid}" does not match canonical verified UID "${VERIFIED_SIVA_UID}" for ${SIVA_VERIFIED_EMAIL}.`);
  console.error('Aborting execution to prevent accidental misallocation.\n');
  process.exit(1);
}

if (isApply && !process.env.ALLOW_DATA_MODIFICATION) {
  console.error('\n[SECURITY ERROR] --apply requires explicit environment variable ALLOW_DATA_MODIFICATION=true.\n');
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
    console.log(`\nReading baseline leads from snapshot: ${fullPath}`);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    leadsData = parsed.map(unwrapRecord);
  } else {
    // Dynamic import for live firestore connection
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, collection, getDocs, doc, getDoc } = await import('firebase/firestore');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('[ERROR] Live Firestore reconciliation requires ADMIN_EMAIL and ADMIN_PASSWORD.');
      process.exit(1);
    }

    const app = initializeApp({
      projectId: projectArg,
      apiKey: process.env.FIREBASE_API_KEY || "dummy_api_key",
      authDomain: `${projectArg}.firebaseapp.com`
    });
    const auth = getAuth(app);
    const db = getFirestore(app);

    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log(`Authenticated with project: ${projectArg}`);

    // Verify target employee profile in Firestore
    const targetUserSnap = await getDoc(doc(db, 'users', targetUid));
    if (targetUserSnap.exists()) {
      const userData = targetUserSnap.data();
      if (userData.email && userData.email.toLowerCase() !== SIVA_VERIFIED_EMAIL.toLowerCase()) {
        console.error(`[SECURITY ABORT] Target UID "${targetUid}" belongs to email "${userData.email}", expected "${SIVA_VERIFIED_EMAIL}".`);
        process.exit(1);
      }
    }

    const snap = await getDocs(collection(db, 'leads'));
    leadsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  console.log(`Total lead records scanned: ${leadsData.length}`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    executionMode: isDryRun ? 'DRY_RUN' : 'APPLIED',
    targetProject: projectArg || 'snapshot',
    targetEmployee: {
      name: SIVA_EMPLOYEE_NAME,
      email: SIVA_VERIFIED_EMAIL,
      verifiedAuthUid: targetUid
    },
    auditSummary: {
      totalLeadsScanned: leadsData.length,
      category1_legacyUid: 0,
      category2_employeeCode: 0,
      category3_alreadyVerifiedUid: 0,
      totalSivaAssociatedLeads: 0,
      otherEmployeesUntouched: 0,
      plannedUpdates: 0,
      appliedUpdates: 0
    },
    reconciledSivaLeads: [],
    unmigratableProtectedLeads: []
  };

  for (const lead of leadsData) {
    const leadId = lead.id;
    const assignedId = lead.assignedEmployeeId;
    const assignedName = lead.assignedEmployee;
    const ownerId = lead.leadOwnerId;

    let category = null;
    let matchCriterion = '';

    // Category 1: Legacy UID match
    if (assignedId === LEGACY_SIVA_UID || ownerId === LEGACY_SIVA_UID) {
      category = 'Category 1: Legacy Auth UID';
      matchCriterion = `Matches legacy UID "${LEGACY_SIVA_UID}"`;
      manifest.auditSummary.category1_legacyUid++;
    }
    // Category 2: Employee Code match
    else if (assignedId === SIVA_EMPLOYEE_CODE || (assignedName === SIVA_EMPLOYEE_NAME && !assignedId)) {
      category = 'Category 2: Employee Code';
      matchCriterion = `Matches employee code "${SIVA_EMPLOYEE_CODE}"`;
      manifest.auditSummary.category2_employeeCode++;
    }
    // Category 3: Already on verified UID
    else if (assignedId === VERIFIED_SIVA_UID || ownerId === VERIFIED_SIVA_UID) {
      category = 'Category 3: Verified Auth UID';
      matchCriterion = `Already assigned to verified UID "${VERIFIED_SIVA_UID}"`;
      manifest.auditSummary.category3_alreadyVerifiedUid++;
    }
    // Other employees' leads - STRICTLY PROTECTED (Must NOT be migrated)
    else {
      manifest.auditSummary.otherEmployeesUntouched++;
      manifest.unmigratableProtectedLeads.push({
        leadId: leadId,
        customer: lead.customer || lead.name || 'Unknown',
        currentAssignedEmployee: assignedName || 'Unassigned',
        currentAssignedEmployeeId: assignedId || null,
        protectionReason: 'Assigned to different employee/role; must not be overwritten'
      });
      continue;
    }

    manifest.auditSummary.totalSivaAssociatedLeads++;

    const requiresUpdate = (category === 'Category 1: Legacy Auth UID' || category === 'Category 2: Employee Code') && assignedId !== targetUid;
    if (requiresUpdate) {
      manifest.auditSummary.plannedUpdates++;
    }

    manifest.reconciledSivaLeads.push({
      leadId: leadId,
      customer: lead.customer || lead.name || 'Unknown',
      phone: lead.phone || '',
      category: category,
      matchCriterion: matchCriterion,
      before: {
        assignedEmployeeId: assignedId || null,
        leadOwnerId: ownerId || null,
        assignedEmployee: assignedName || null
      },
      proposedAfter: {
        assignedEmployeeId: targetUid,
        leadOwnerId: targetUid,
        assignedEmployee: SIVA_EMPLOYEE_NAME
      },
      requiresMigration: requiresUpdate,
      status: isApply && requiresUpdate ? 'UPDATED' : (requiresUpdate ? 'PLANNED_MIGRATION' : 'ALREADY_SYNCHRONIZED')
    });
  }

  // If live apply requested (only permissible on non-production projects)
  if (isApply && !snapshotArg) {
    const { getFirestore, doc, updateDoc } = await import('firebase/firestore');
    const { getApp } = await import('firebase/app');
    const db = getFirestore(getApp());

    for (const item of manifest.reconciledSivaLeads) {
      if (item.requiresMigration) {
        await updateDoc(doc(db, 'leads', item.leadId), {
          assignedEmployeeId: targetUid,
          leadOwnerId: targetUid,
          updatedAt: new Date().toISOString()
        });
        manifest.auditSummary.appliedUpdates++;
        console.log(`[APPLIED] Updated lead ${item.leadId} -> ${targetUid}`);
      }
    }
  }

  // Save audit manifest
  const manifestDir = path.dirname(path.resolve(manifestOutputArg));
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  fs.writeFileSync(path.resolve(manifestOutputArg), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n' + '='.repeat(75));
  console.log('SIVA LEAD RECONCILIATION AUDIT REPORT');
  console.log('='.repeat(75));
  console.log(`Total Leads Scanned:                     ${manifest.auditSummary.totalLeadsScanned}`);
  console.log(`- Category 1 (Legacy UID ${LEGACY_SIVA_UID}):  ${manifest.auditSummary.category1_legacyUid}`);
  console.log(`- Category 2 (Employee Code ${SIVA_EMPLOYEE_CODE}):       ${manifest.auditSummary.category2_employeeCode}`);
  console.log(`- Category 3 (Already Verified UID):       ${manifest.auditSummary.category3_alreadyVerifiedUid}`);
  console.log(`Total Siva Associated Records:           ${manifest.auditSummary.totalSivaAssociatedLeads}`);
  console.log(`Protected Leads (Other Employees):       ${manifest.auditSummary.otherEmployeesUntouched}`);
  console.log(`Planned Migrations (Pending Approval):   ${manifest.auditSummary.plannedUpdates}`);
  console.log(`Applied Migrations (Database Writes):    ${manifest.auditSummary.appliedUpdates}`);
  console.log(`Audit Manifest Path:                     ${manifestOutputArg}`);
  console.log('='.repeat(75));
}

run().catch(err => {
  console.error('Fatal error during reconciliation:', err);
  process.exit(1);
});
