/**
 * MIRROR SOLAR VISION CRM — LEAD ASSIGNMENT SCRIPT (ADMIN UTILITY)
 * 
 * SAFETY NOTICE:
 * - This script is disabled by default to prevent accidental data modification.
 * - Requires explicit execution authorization via environment variables.
 * - Never execute against production without owner approval and prior database snapshot.
 * - Requires verified Firebase Auth UID, NOT employee codes.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

if (process.env.ALLOW_DATA_MODIFICATION !== 'true') {
  console.error('[ABORTED] Script execution is disabled. Set ALLOW_DATA_MODIFICATION=true to run.');
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const targetAuthUid = process.env.TARGET_AUTH_UID;

if (!adminEmail || !adminPassword || !targetAuthUid) {
  console.error('[ABORTED] Missing required environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, TARGET_AUTH_UID.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: "crm-webapp-d32bc.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "crm-webapp-d32bc",
  storageBucket: "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: "940267952934",
  appId: "1:940267952934:web:18ba7928b92968bcdcbfe7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function assignLeadsToSiva() {
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  console.log('Authenticated admin session established.');

  const leadsSnap = await getDocs(collection(db, 'leads'));
  let updatedCount = 0;

  for (const docSnap of leadsSnap.docs) {
    const data = docSnap.data();
    if (data.assignedEmployee === 'Sunkara Siva' && data.assignedEmployeeId !== targetAuthUid) {
      await updateDoc(doc(db, 'leads', docSnap.id), {
        assignedEmployeeId: targetAuthUid,
        updatedAt: new Date().toISOString()
      });
      console.log(`Updated lead ${docSnap.id} with verified Auth UID.`);
      updatedCount++;
    }
  }

  console.log(`Lead assignment normalization complete. Updated: ${updatedCount} records.`);
  process.exit(0);
}

assignLeadsToSiva().catch(err => {
  console.error('Lead assignment error:', err);
  process.exit(1);
});
