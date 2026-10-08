import { initializeApp } from 'firebase/app';
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
const db = getFirestore(app);

async function printSivaDetails() {
  const targetLeadIds = ['NpG6y0FjfLnoPkNHpUX0', 'ok7aLkC0DNFwUUCVDbhv', 'UGgj9XaWHFQfWxyrDSb1', 'xOu55uBoYWsS1RbCPIgj'];

  for (const id of targetLeadIds) {
    const snap = await getDoc(doc(db, 'leads', id));
    if (snap.exists()) {
      console.log(`\n========================================`);
      console.log(`LEAD [${id}]:`, JSON.stringify(snap.data(), null, 2));
    }
  }

  // Also search all leads for any document files
  const allLeads = await getDocs(collection(db, 'leads'));
  console.log(`\n=== CHECKING ALL ${allLeads.size} LEADS FOR SIVA OR FILES ===`);
  allLeads.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('siva') || str.includes('subbarao') || str.includes('ramakrishna') || str.includes('sanvaz')) {
      console.log(`\nLEAD ID: ${d.id} -> Customer: ${data.customer} | Assigned: ${data.assignedEmployee}`);
      console.log(`Details:`, JSON.stringify(data, null, 2));
    }
  });
}

printSivaDetails().catch(console.error);
