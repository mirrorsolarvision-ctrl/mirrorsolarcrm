import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, updateDoc, getDocs, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: "crm-webapp-d32bc.firebaseapp.com",
  projectId: "crm-webapp-d32bc",
  storageBucket: "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: "940267952934",
  appId: "1:940267952934:web:18ba7928b92968bcdcbfe7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function cleanDuplicates() {
  console.log('Logging in as Admin...');
  await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "Password123!");
  console.log('✓ Admin authenticated.\n');

  // 1. Delete redundant Siva doc "DHIl07h9rJPBlfzc7Cg8hrfVaWj2"
  console.log('1. Deleting duplicate Siva doc: DHIl07h9rJPBlfzc7Cg8hrfVaWj2');
  try {
    await deleteDoc(doc(db, 'users', 'DHIl07h9rJPBlfzc7Cg8hrfVaWj2'));
    console.log('   ✓ Deleted DHIl07h9rJPBlfzc7Cg8hrfVaWj2.');
  } catch (e) {
    console.warn('   Note on deleting DHIl07h9rJPBlfzc7Cg8hrfVaWj2:', e.message);
  }

  // Ensure active Siva doc has clean ID
  try {
    await updateDoc(doc(db, 'users', 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3'), {
      id: 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3',
      employeeId: 'MSV-SIVA-001',
      employeeCategory: 'Marketing Employee',
      name: 'Sunkara Siva',
      email: 'msv-siva-001@mirrorsolar.in',
      phone: '89851 41432',
      status: 'Active'
    });
    console.log('   ✓ Updated active Siva doc bkTpWQKgmsXRBjCHEcwD8uO9nrJ3.');
  } catch (e) {
    console.warn('   Note on updating Siva:', e.message);
  }

  // 2. Delete redundant Sai Gopal doc "MSV-EMP-003"
  console.log('\n2. Deleting duplicate Sai Gopal doc: MSV-EMP-003');
  try {
    await deleteDoc(doc(db, 'users', 'MSV-EMP-003'));
    console.log('   ✓ Deleted MSV-EMP-003.');
  } catch (e) {
    console.warn('   Note on deleting MSV-EMP-003:', e.message);
  }

  // 3. Delete redundant Kumari doc "bywen9RvVcNAPF3HaSRDPnExcoL2"
  console.log('\n3. Deleting duplicate Kumari doc: bywen9RvVcNAPF3HaSRDPnExcoL2');
  try {
    await deleteDoc(doc(db, 'users', 'bywen9RvVcNAPF3HaSRDPnExcoL2'));
    console.log('   ✓ Deleted bywen9RvVcNAPF3HaSRDPnExcoL2.');
  } catch (e) {
    console.warn('   Note on deleting bywen9RvVcNAPF3HaSRDPnExcoL2:', e.message);
  }

  // 4. Verify Final Users in Live Database
  console.log('\n--- FINAL CLEAN USER ROSTER ---');
  const snap = await getDocs(collection(db, 'users'));
  console.log(`Total active user documents: ${snap.size}`);
  snap.forEach((d, idx) => {
    const data = d.data();
    console.log(`${idx + 1}. [${d.id}] "${data.name}" | Email: "${data.email}" | Role: "${data.role}" | Category: "${data.employeeCategory || data.role}" | Status: "${data.status}"`);
  });
}

cleanDuplicates().catch(console.error);
