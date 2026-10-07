import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: "crm-webapp-d32bc.firebaseapp.com",
  projectId: "crm-webapp-d32bc",
  storageBucket: "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: "364539126442",
  appId: "1:364539126442:web:96e838f71aa7fdf2bf2165"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  console.log("Signing in as admin...");
  try {
    await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "Password123!");
  } catch (e1) {
    try {
      await signInWithEmailAndPassword(auth, "mirrorsolarvision@gmail.com", "Password123!");
    } catch (e2) {
      await signInWithEmailAndPassword(auth, "mirrorsolarvision@gmail.com", "Mirror@1432");
    }
  }
  console.log("Signed in:", auth.currentUser?.email);

  const dummyIds = [
    'LEAD-101',
    'LEAD-102',
    'LEAD-103',
    'LEAD-104'
  ];

  for (const id of dummyIds) {
    try {
      console.log(`Deleting dummy lead: ${id}`);
      await deleteDoc(doc(db, 'leads', id));
      console.log(`Deleted ${id}`);
    } catch (e) {
      console.log(`Could not delete ${id}:`, e.message);
    }
  }

  // List remaining leads
  const leadDocs = await getDocs(collection(db, 'leads'));
  console.log("\nRemaining leads count:", leadDocs.size);
  leadDocs.forEach(d => {
    const data = d.data();
    console.log(`[LEAD] ID: ${d.id} | Customer: ${data.customer} | Phone: ${data.phone} | Stage: ${data.stage} | Assigned: ${data.assignedEmployee}`);
  });
}

main().catch(console.error);
