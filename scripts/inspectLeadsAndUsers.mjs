import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

async function inspect() {
  await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
  console.log('Logged in as admin.');

  const leadsSnap = await getDocs(collection(db, 'leads'));
  console.log(`Total leads found in DB: ${leadsSnap.size}`);

  leadsSnap.forEach(doc => {
    const d = doc.data();
    console.log(`Lead [${doc.id}]: customer="${d.customer}", assignedEmployee="${d.assignedEmployee}", assignedEmployeeId="${d.assignedEmployeeId}", dealer="${d.dealer}", createdBy="${d.createdBy}", stage="${d.stage}"`);
  });

  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`\nTotal users found: ${usersSnap.size}`);
  usersSnap.forEach(doc => {
    const u = doc.data();
    if (u.role === 'Employee' || u.name?.toLowerCase().includes('siva') || u.name?.toLowerCase().includes('shiva')) {
      console.log(`User [${doc.id}]: name="${u.name}", email="${u.email}", role="${u.role}", id="${u.id}", employeeId="${u.employeeId}"`);
    }
  });

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
