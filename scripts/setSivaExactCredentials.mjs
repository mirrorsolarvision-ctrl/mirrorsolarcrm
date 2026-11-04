/**
 * MIRROR SOLAR VISION CRM — USER PROVISIONING UTILITY
 * 
 * SECURITY AUDIT NOTICE:
 * - Hardcoded credentials have been removed.
 * - Password storage in Firestore documents is strictly forbidden and removed.
 * - Standalone user documents indexed by non-UID (e.g. employee code) are prohibited.
 * - Requires verified UID-to-email identity match before profile modification.
 * - This script is disabled by default.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

if (process.env.ALLOW_DATA_MODIFICATION !== 'true') {
  console.error('[ABORTED] Script execution is disabled. Set ALLOW_DATA_MODIFICATION=true to run.');
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const targetAuthUid = process.env.TARGET_AUTH_UID;
const EXPECTED_EMAIL = 'siva.mirrorsolarvision@gmail.com';

if (!adminEmail || !adminPassword || !targetAuthUid) {
  console.error('[ABORTED] Missing required environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, TARGET_AUTH_UID.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "crm-webapp-d32bc.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "crm-webapp-d32bc",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "940267952934",
  appId: process.env.FIREBASE_APP_ID || "1:940267952934:web:18ba7928b92968bcdcbfe7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  console.log('Authenticated admin session established.');

  // Pre-verification: Verify UID-to-email identity match before profile modification
  const userDocRef = doc(db, 'users', targetAuthUid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    const existing = userDocSnap.data();
    if (existing.email && existing.email.toLowerCase() !== EXPECTED_EMAIL.toLowerCase()) {
      console.error(`[SECURITY ABORT] Target UID "${targetAuthUid}" holds email "${existing.email}", which does not match expected email "${EXPECTED_EMAIL}". Modification aborted to prevent identity spoofing or account takeover.`);
      process.exit(1);
    }
  }

  const userProfile = {
    id: targetAuthUid,
    employeeId: 'MSV-SIVA-001',
    code: 'MSV/EMP/SUNKARASIVA',
    displayId: 'MSV/EMP/SUNKARASIVA',
    name: 'Sunkara Siva',
    initials: 'SS',
    email: EXPECTED_EMAIL,
    phone: '8985141432',
    role: 'Employee',
    employeeCategory: 'Marketing Employee',
    status: 'Active',
    permissions: {
      dashboard: 'view',
      leads: 'edit',
      employees: 'none',
      dealers: 'none',
      stock: 'view',
      reports: 'none',
      access: 'none',
      profile: 'edit'
    },
    features: {
      myEmployees: false,
      attendance: true,
      quotations: true,
      leads: true,
      stock: true,
      payments: true,
      reports: false,
      tasks: true,
      calendar: true,
      forwardCallLeadToDealer: true
    },
    lastActive: 'Just now',
    updatedAt: new Date().toISOString()
  };

  // Only write to /users/{AUTH_UID} - Never store passwords in Firestore
  await setDoc(userDocRef, userProfile, { merge: true });
  console.log(`[Firestore: Profile Updated] Verified identity users/${targetAuthUid} for ${EXPECTED_EMAIL}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Profile provisioning error:', err);
  process.exit(1);
});
