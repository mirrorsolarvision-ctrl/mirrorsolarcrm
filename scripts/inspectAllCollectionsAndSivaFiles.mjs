import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

async function inspectAll() {
  try {
    await signInWithEmailAndPassword(auth, "mirroraquaro@gmail.com", "MirrorAdmin@2025");
  } catch {
    try {
      await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "MirrorAdmin@2025");
    } catch (e) {
      console.log("Admin sign-in note:", e.message);
    }
  }

  console.log("=== FIRESTORE COLLECTIONS INSPECTION ===");

  const collectionsToCheck = [
    'users', 'employees', 'dealers', 'leads', 'quotations', 
    'quotes', 'documents', 'files', 'eodReports', 'tasks', 
    'attendance', 'stock', 'payments', 'activities', 'crm_data'
  ];

  for (const colName of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`\nCollection '${colName}': ${snap.size} documents`);
      if (snap.size > 0) {
        snap.forEach(d => {
          const data = d.data();
          console.log(` - ID: ${d.id}`, JSON.stringify(data).slice(0, 150));
          // If Siva mentioned
          const str = JSON.stringify(data).toLowerCase();
          if (str.includes('siva') || str.includes('file') || str.includes('doc') || str.includes('pdf') || str.includes('quotation')) {
            console.log(`   [RELEVANT] Full Data:`, JSON.stringify(data, null, 2));
          }
        });
      }
    } catch (err) {
      console.log(`Error checking collection '${colName}':`, err.message);
    }
  }
}

inspectAll().catch(console.error);
