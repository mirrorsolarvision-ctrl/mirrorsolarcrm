import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: "crm-webapp-d32bc.firebaseapp.com",
  projectId: "crm-webapp-d32bc",
  storageBucket: "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: "940267952934",
  appId: "1:940267952934:web:18ba7928b92968bcdcbfe7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DUPLICATE_IDS_TO_REMOVE = [
  'emp_kumari',
  'kumari_mirrorsolarvision_gmail_com',
  'emp_gopal',
  'gopal_mirrorsolarvision_gmail_com',
  'emp_siva',
  'dealer_hussain',
  'hussain_dealer_in',
  'admin_mirroraquaro',
  'admin_balajiperuri',
  'dealer_balaji'
];

async function removeDuplicates() {
  console.log("=== STEP 1: BACKING UP USERS COLLECTION ===");
  const snap = await getDocs(collection(db, 'users'));
  const allUsersBackup = [];
  snap.forEach(d => {
    allUsersBackup.push({ id: d.id, data: d.data() });
  });
  
  fs.writeFileSync('scripts/users_backup.json', JSON.stringify(allUsersBackup, null, 2), 'utf-8');
  console.log(`Saved backup of ${allUsersBackup.length} user documents to scripts/users_backup.json`);

  console.log("\n=== STEP 2: REMOVING 10 DUPLICATE USER DOCUMENTS ===");
  for (const dupId of DUPLICATE_IDS_TO_REMOVE) {
    console.log(`Deleting duplicate doc: ${dupId}...`);
    await deleteDoc(doc(db, 'users', dupId));
    console.log(`  ✓ Successfully deleted: ${dupId}`);
  }

  console.log("\n=== STEP 3: VERIFYING REMAINING USERS IN DATABASE ===");
  const afterSnap = await getDocs(collection(db, 'users'));
  console.log(`Total remaining users: ${afterSnap.size} (Expected: 9)\n`);
  
  let i = 1;
  afterSnap.forEach(d => {
    const u = d.data();
    console.log(`${i++}. [${u.role.toUpperCase()}] ID: "${d.id}" | Name: "${u.name}" | Email: "${u.email}" | Phone: "${u.phone}" | EmpCode: "${u.employeeId || u.username || 'N/A'}"`);
  });
  console.log("\n=== DEDUPLICATION COMPLETED SUCCESSFULLY ===");
}

removeDuplicates().catch(console.error);
