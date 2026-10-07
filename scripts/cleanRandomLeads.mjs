import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

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

async function inspectAndClean() {
  await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
  console.log('Logged in as admin.');

  const leadsSnap = await getDocs(collection(db, 'leads'));
  console.log(`\n=== CURRENT LEADS IN FIRESTORE (${leadsSnap.size} total) ===`);
  
  for (const docSnap of leadsSnap.docs) {
    const d = docSnap.data();
    console.log(`[${docSnap.id}] Customer: "${d.customer}", Phone: "${d.phone}", Emp: "${d.assignedEmployee}" (${d.assignedEmployeeId}), Dealer: "${d.dealer}", Stage: "${d.stage}", CreatedBy: "${d.createdBy}" (${d.createdByName})`);
    
    // Check if it's one of the demo/random leads added by previous test scripts
    if (
      d.customer === 'K. Venkateswara Rao' ||
      d.customer === 'Sri Lakshmi Enterprises (Eluru Commercial)' ||
      d.customer === 'Test Customer' ||
      d.customer === 'Live Verification Customer (Eluru)' ||
      d.customer === 'Live Verification Customer' ||
      d.customer === 'Siva Sunkara' && d.location === 'City or Region'
    ) {
      console.log(`  --> Removing test/random lead: [${docSnap.id}] ${d.customer}`);
      await deleteDoc(doc(db, 'leads', docSnap.id));
    }
  }

  const remainingSnap = await getDocs(collection(db, 'leads'));
  console.log(`\n=== REMAINING LEADS AFTER CLEANUP (${remainingSnap.size} total) ===`);
  remainingSnap.forEach(docSnap => {
    const d = docSnap.data();
    console.log(`[${docSnap.id}] Customer: "${d.customer}", Emp: "${d.assignedEmployee}", Dealer: "${d.dealer}", Stage: "${d.stage}"`);
  });

  process.exit(0);
}

inspectAndClean().catch(err => {
  console.error(err);
  process.exit(1);
});
