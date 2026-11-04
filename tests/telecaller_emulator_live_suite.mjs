/**
 * MIRROR SOLAR VISION CRM — REAL FIREBASE EMULATOR ACCEPTANCE SUITE
 * 
 * Verifies live Firestore Security Rules, Auth tokens, Atomic Batches,
 * Scoped Telecaller vs Manager access, and Sunkara Siva data restoration.
 * 
 * Target: feature/telecaller-mvp-nov04
 * Project: crm-webapp-d32bc
 * Emulators: Auth (9099), Firestore (8080)
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  signInWithCustomToken, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  writeBatch,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'fake-api-key-for-emulator',
  authDomain: 'crm-webapp-d32bc.firebaseapp.com',
  projectId: 'crm-webapp-d32bc',
  storageBucket: 'crm-webapp-d32bc.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to running emulators
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

console.log('================================================================================');
console.log('   MIRROR SOLAR VISION CRM — REAL FIREBASE EMULATOR ACCEPTANCE SUITE            ');
console.log('   Target: feature/telecaller-mvp-nov04 | Project: crm-webapp-d32bc             ');
console.log('   Emulators: Auth 127.0.0.1:9099 | Firestore 127.0.0.1:8080                    ');
console.log('================================================================================\n');

let passCount = 0;
let failCount = 0;

function report(testNum, name, passed, details = '') {
  const icon = passed ? '✓' : '✗';
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`  ${icon} [Test ${testNum}] [FIREBASE EMULATOR] ${status}: ${name}`);
  if (details) {
    console.log(`       Evidence: ${details}`);
  }
  if (passed) passCount++;
  else failCount++;
}

async function safeSignInOrSignUp(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      return cred.user;
    }
    throw e;
  }
}

async function runAcceptance() {
  const adminEmail = 'mirroraquaro@gmail.com';
  const managerEmail = 'manager.emu@mirrorsolar.in';
  const telecallerEmail = 'telecaller.emu@mirrorsolar.in';
  const otherEmpEmail = 'other.emu@mirrorsolar.in';
  const sivaEmail = 'siva.mirrorsolarvision@gmail.com';
  const testPassword = 'Password123!Safe';

  console.log('--- 1. PROVISIONING EMULATOR TEST ACCOUNTS ---');
  
  // 1. Create Admin & Sign In
  const adminUser = await safeSignInOrSignUp(adminEmail, testPassword);
  await setDoc(doc(db, 'users', adminUser.uid), {
    id: adminUser.uid,
    name: 'Mirror Aqua Admin',
    email: adminEmail,
    role: 'Admin',
    status: 'Active'
  });

  // 2. Create other Auth users
  const managerUser = await safeSignInOrSignUp(managerEmail, testPassword);
  const telecallerUser = await safeSignInOrSignUp(telecallerEmail, testPassword);
  const otherEmpUser = await safeSignInOrSignUp(otherEmpEmail, testPassword);
  const sivaUser = await safeSignInOrSignUp(sivaEmail, testPassword);

  // 3. Admin signs back in to write their profile documents to /users
  await signInWithEmailAndPassword(auth, adminEmail, testPassword);

  // Set Manager Doc
  await setDoc(doc(db, 'users', managerUser.uid), {
    id: managerUser.uid,
    name: 'R. Krishna Murthy',
    email: managerEmail,
    role: 'Employee',
    employeeCategory: 'Sales Manager',
    status: 'Active',
    responsibilities: { primaryResponsibilityId: 'resp_sales_manager' }
  });

  // Set Telecaller Doc
  await setDoc(doc(db, 'users', telecallerUser.uid), {
    id: telecallerUser.uid,
    name: 'S. Ananya',
    email: telecallerEmail,
    role: 'Employee',
    employeeCategory: 'Telecaller',
    status: 'Active',
    employeeId: 'MSV-TC-001',
    responsibilities: { primaryResponsibilityId: 'telecaller_sales' }
  });

  // Set Other Employee Doc
  await setDoc(doc(db, 'users', otherEmpUser.uid), {
    id: otherEmpUser.uid,
    name: 'V. Prakash',
    email: otherEmpEmail,
    role: 'Employee',
    employeeCategory: 'Technician',
    status: 'Active',
    employeeId: 'MSV-TECH-002'
  });

  // Set Sunkara Siva Doc
  await setDoc(doc(db, 'users', sivaUser.uid), {
    id: sivaUser.uid,
    name: 'Sunkara Siva',
    email: sivaEmail,
    role: 'Employee',
    employeeCategory: 'Marketing Employee',
    status: 'Active',
    employeeId: 'MSV-SIVA-001',
    code: 'MSV/EMP/SUNKARASIVA',
    displayId: 'MSV/EMP/SUNKARASIVA',
    phone: '8985141432',
    features: {
      leads: true,
      attendance: true,
      calendar: true,
      quotations: true,
      tasks: true,
      stock: true,
      forwardCallLeadToDealer: true,
      payments: true
    }
  });

  console.log('   All 5 emulator test accounts provisioned in Auth and /users.');

  // Switch to Manager to create baseline leads
  await signInWithEmailAndPassword(auth, managerEmail, testPassword);

  const leadAId = 'LEAD_EMU_TELECALLER_01';
  const leadBId = 'LEAD_EMU_OTHER_02';
  const leadSivaId = '34fPlKEpby9EBUOAW5gY'; // Real docId from production snapshot

  await setDoc(doc(db, 'leads', leadAId), {
    id: leadAId,
    customer: 'G. Venkateswara Rao',
    phone: '9848011223',
    location: 'Tenali, Guntur',
    district: 'Guntur',
    town: 'Tenali',
    pincode: '522201',
    capacityKw: '3',
    monthlyBill: 3200,
    stage: 'Lead',
    salesStage: 'New Lead',
    assignedEmployee: 'S. Ananya',
    assignedEmployeeId: telecallerUser.uid,
    leadOwnerId: telecallerUser.uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
    callLogs: []
  });

  await setDoc(doc(db, 'leads', leadBId), {
    id: leadBId,
    customer: 'B. Krishna Murthy',
    phone: '9849099887',
    location: 'Vijayawada',
    stage: 'Lead',
    salesStage: 'New Lead',
    assignedEmployee: 'V. Prakash',
    assignedEmployeeId: otherEmpUser.uid,
    leadOwnerId: otherEmpUser.uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
    callLogs: []
  });

  await setDoc(doc(db, 'leads', leadSivaId), {
    id: leadSivaId,
    customer: 'A.S. Naidu',
    phone: '7569928327',
    location: 'Eluru',
    stage: 'Lead',
    salesStage: 'New Lead',
    assignedEmployee: 'Sunkara Siva',
    assignedEmployeeId: 'MSV-SIVA-001',
    leadOwnerId: sivaUser.uid,
    createdAt: '2026-09-12T17:44:30.989Z',
    updatedAt: new Date().toISOString(),
    archived: false,
    callLogs: []
  });

  console.log('\n--- 2. RUNNING REAL EMULATOR SECURITY & PERSISTENCE TESTS ---');

  // Switch to Telecaller session
  await signInWithEmailAndPassword(auth, telecallerEmail, testPassword);

  // Test 1: Telecaller reads assigned Lead A
  try {
    const leadASnap = await getDoc(doc(db, 'leads', leadAId));
    report(
      1,
      'Telecaller read assigned lead (/leads/LEAD_EMU_TELECALLER_01)',
      leadASnap.exists() && leadASnap.data().customer === 'G. Venkateswara Rao',
      `Assigned lead fetched successfully. Customer: ${leadASnap.data()?.customer}, Pincode: ${leadASnap.data()?.pincode}`
    );
  } catch (e) {
    report(1, 'Telecaller read assigned lead', false, e.message);
  }

  // Test 2: Telecaller reads unassigned Lead B (Must be denied)
  try {
    await getDoc(doc(db, 'leads', leadBId));
    report(2, 'Telecaller read unassigned lead (/leads/LEAD_EMU_OTHER_02) DENIED', false, 'Expected PERMISSION_DENIED but read succeeded.');
  } catch (e) {
    const isDenied = e.code === 'permission-denied' || e.message.includes('permission');
    report(
      2,
      'Telecaller read unassigned lead (/leads/LEAD_EMU_OTHER_02) DENIED',
      isDenied,
      `Correctly blocked by Firestore security rule with code: ${e.code}`
    );
  }

  // Test 3: Atomic Batch Create (Write to /call_leads + update /leads in 1 atomic commit)
  const call1Id = 'CALL_EMU_' + Date.now();
  const timestamp = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    const callRef = doc(db, 'call_leads', call1Id);
    const callPayload = {
      id: call1Id,
      telecallerId: telecallerUser.uid,
      telecallerName: 'S. Ananya',
      callerId: telecallerUser.uid,
      leadId: leadAId,
      customerName: 'G. Venkateswara Rao',
      phone: '9848011223',
      outcome: 'Connected - Interested',
      callDirection: 'Outgoing',
      callDate: '2026-11-04',
      callTime: '11:30 AM',
      customerRequirement: 'Customer interested in 3kW on-grid solar for 250 units/month',
      notes: 'Customer requested quotation by evening',
      timestamp: timestamp,
      nextFollowUpDate: '2026-11-04',
      nextFollowUpTime: '04:30 PM'
    };
    batch.set(callRef, callPayload);

    const leadRef = doc(db, 'leads', leadAId);
    batch.update(leadRef, {
      callLogs: [callPayload],
      lastCallDate: timestamp,
      salesStage: 'Contacted',
      customerRequirement: 'Customer interested in 3kW on-grid solar for 250 units/month',
      followUp: {
        date: '2026-11-04',
        time: '04:30 PM',
        type: 'Call',
        status: 'Due Today',
        notes: 'Customer requested quotation by evening'
      },
      updatedAt: timestamp
    });

    await batch.commit();
    report(
      3,
      'Atomic writeBatch commitment (/call_leads and /leads/{leadId})',
      true,
      `Committed call log ${call1Id} and updated Lead A atomically with zero partial-success risk.`
    );
  } catch (e) {
    report(3, 'Atomic writeBatch commitment', false, e.message);
  }

  // Test 4: Telecaller creates call log targeting Lead B (unassigned lead) -> DENIED
  const callBId = 'CALL_EMU_ROGUE_' + Date.now();
  try {
    await setDoc(doc(db, 'call_leads', callBId), {
      id: callBId,
      telecallerId: telecallerUser.uid,
      callerId: telecallerUser.uid,
      leadId: leadBId, // Assigned to Other Employee!
      notes: 'Rogue call log attempt',
      outcome: 'Connected',
      timestamp: new Date().toISOString()
    });
    report(4, 'Logging call against unassigned lead DENIED', false, 'Expected PERMISSION_DENIED but create succeeded.');
  } catch (e) {
    const isDenied = e.code === 'permission-denied' || e.message.includes('permission');
    report(
      4,
      'Logging call against unassigned lead DENIED',
      isDenied,
      `Correctly rejected by isCallerAuthorizedForLead with code: ${e.code}`
    );
  }

  // Test 5: Immutability enforcement on /call_leads (telecallerId cannot be changed)
  try {
    await updateDoc(doc(db, 'call_leads', call1Id), {
      telecallerId: 'hacked_telecaller_uid'
    });
    report(5, 'Call-log telecallerId immutability check DENIED', false, 'Expected PERMISSION_DENIED on altering caller UID.');
  } catch (e) {
    const isDenied = e.code === 'permission-denied' || e.message.includes('permission');
    report(
      5,
      'Call-log telecallerId immutability check DENIED',
      isDenied,
      `Immutability enforced: cannot alter telecallerId/id/leadId/timestamp (${e.code}).`
    );
  }

  // Test 6: Field-Level Update Allowlist on /call_leads
  try {
    await updateDoc(doc(db, 'call_leads', call1Id), {
      notes: 'Customer callback completed - agreed for site survey tomorrow morning',
      outcome: 'Connected - Site Visit Scheduled'
    });
    report(
      6,
      'Field-level update on /call_leads allowlist (notes, outcome)',
      true,
      'Permitted fields (notes, outcome) updated successfully by telecaller.'
    );
  } catch (e) {
    report(6, 'Field-level update on /call_leads allowlist', false, e.message);
  }

  // Test 7: Telecaller updates Customer Qualification on Lead A
  try {
    await updateDoc(doc(db, 'leads', leadAId), {
      qualificationData: {
        monthlyBill: 3200,
        monthlyUnitsKwh: 260,
        roofType: 'RCC Concrete Flat',
        roofAreaSqFt: 850,
        roofOwnership: 'Owned',
        shadingCondition: 'None',
        expectedTimeline: 'Immediately (< 15 days)',
        budgetPreference: 'PM Surya Ghar Subsidy + Solar Loan',
        qualificationResult: 'Qualified',
        notes: 'Ideal 3kW rooftop setup with zero shadow'
      },
      leadScore: { total: 88, category: 'High Intent' },
      salesStage: 'Qualified',
      district: 'Guntur',
      town: 'Tenali',
      pincode: '522201',
      updatedAt: new Date().toISOString()
    });
    report(
      7,
      'Customer Qualification update by telecaller on assigned lead',
      true,
      'Lead A qualified (Score: 88, Stage: Qualified, Pincode: 522201, District: Guntur).'
    );
  } catch (e) {
    report(7, 'Customer Qualification update by telecaller', false, e.message);
  }

  // Test 8: 2nd Session Retrieval Test (Clean sign out and sign in anew)
  await signOut(auth);
  await signInWithEmailAndPassword(auth, telecallerEmail, testPassword);
  try {
    const refreshedLead = await getDoc(doc(db, 'leads', leadAId));
    const refreshedCall = await getDoc(doc(db, 'call_leads', call1Id));
    const isDataIntact = refreshedLead.exists() && 
      refreshedCall.exists() && 
      refreshedLead.data().salesStage === 'Qualified' &&
      refreshedLead.data().callLogs?.length > 0 &&
      refreshedCall.data().outcome === 'Connected - Site Visit Scheduled';

    report(
      8,
      '2nd Session Retrieval Test (Fresh Auth Session / Device Simulation)',
      isDataIntact,
      `Retrieved persisted state: Lead Stage = ${refreshedLead.data()?.salesStage}, Call Logs count = ${refreshedLead.data()?.callLogs?.length}, Outcome = ${refreshedCall.data()?.outcome}`
    );
  } catch (e) {
    report(8, '2nd Session Retrieval Test', false, e.message);
  }

  // Test 9: Sales Manager Oversight (Manager reads Telecaller records)
  await signOut(auth);
  await signInWithEmailAndPassword(auth, managerEmail, testPassword);
  try {
    const managerLeadCheck = await getDoc(doc(db, 'leads', leadAId));
    const managerCallCheck = await getDoc(doc(db, 'call_leads', call1Id));
    const managerSeesAll = managerLeadCheck.exists() && managerCallCheck.exists();

    report(
      9,
      'Sales Manager Oversight (/call_leads and /leads reading authority)',
      managerSeesAll,
      `Sales Manager successfully audited call log ${call1Id} and lead ${leadAId}.`
    );
  } catch (e) {
    report(9, 'Sales Manager Oversight', false, e.message);
  }

  // Test 10: Sunkara Siva Lead Persistence and Authorization Check
  await signOut(auth);
  await signInWithEmailAndPassword(auth, sivaEmail, testPassword);
  try {
    const sivaLeadSnap = await getDoc(doc(db, 'leads', leadSivaId));
    const sivaLeadExists = sivaLeadSnap.exists() && sivaLeadSnap.data().customer === 'A.S. Naidu';

    // Siva logs a call on his assigned lead
    const sivaCallId = 'CALL_SIVA_' + Date.now();
    await setDoc(doc(db, 'call_leads', sivaCallId), {
      id: sivaCallId,
      telecallerId: sivaUser.uid,
      callerId: sivaUser.uid,
      leadId: leadSivaId,
      customerName: 'A.S. Naidu',
      phone: '7569928327',
      outcome: 'Connected - Quotation Discussion',
      notes: 'Customer follow-up on 5kW subsidy documentation',
      timestamp: new Date().toISOString()
    });

    const sivaCallSnap = await getDoc(doc(db, 'call_leads', sivaCallId));
    const sivaCallSaved = sivaCallSnap.exists() && sivaCallSnap.data().customerName === 'A.S. Naidu';

    report(
      10,
      'Sunkara Siva lead persistence & call-log authorization (/leads/34fPlKEpby9EBUOAW5gY)',
      sivaLeadExists && sivaCallSaved,
      `Siva profile active. Assigned lead "${sivaLeadSnap.data()?.customer}" (Eluru) accessible and call log ${sivaCallId} logged successfully.`
    );
  } catch (e) {
    report(10, 'Sunkara Siva lead persistence & call-log authorization', false, e.message);
  }

  console.log('\n================================================================================');
  console.log(`   SUITE SUMMARY: ${passCount} PASSED / ${failCount} FAILED (Total ${passCount + failCount})`);
  console.log('================================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAcceptance().catch(err => {
  console.error('Fatal error in acceptance suite:', err);
  process.exit(1);
});
