import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

const REMAP_MAP = {
  // Kumari
  'emp_kumari': 'tLB8hvGPTQXynRLk4fYI1yPeBkF3',
  'kumari_mirrorsolarvision_gmail_com': 'tLB8hvGPTQXynRLk4fYI1yPeBkF3',
  
  // Sai Gopal
  'emp_gopal': 'QRWLhJpqCUUMi4U9mVNpUGQPu713',
  'gopal_mirrorsolarvision_gmail_com': 'QRWLhJpqCUUMi4U9mVNpUGQPu713',
  
  // Sunkara Siva
  'emp_siva': 'bkTpWQKgmsXRBjCHEcwD8uO9nrJ3',
  
  // Hussain
  'dealer_hussain': 'ck9OPLG03RZeJhYh60npKeMEaFz2',
  'hussain_dealer_in': 'ck9OPLG03RZeJhYh60npKeMEaFz2',
  
  // Admin Mirror Aqua
  'admin_mirroraquaro': 'vNeRWIuQYNayFekfwhImaBnWs4t2',
  
  // Admin Balaji
  'admin_balajiperuri': 'balajiperuri09_gmail_com',
  
  // Dealer Balaji
  'dealer_balaji': 'DLR1790601644299'
};

async function verifyRemap() {
  const collections = ['leads', 'quotations', 'activities', 'tasks', 'attendance'];
  let totalFound = 0;

  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    snap.forEach(d => {
      const data = d.data();
      for (const [dupId, mainId] of Object.entries(REMAP_MAP)) {
        if (
          data.assignedEmployeeId === dupId ||
          data.createdBy === dupId ||
          data.dealerId === dupId ||
          data.employeeId === dupId ||
          data.userId === dupId
        ) {
          console.log(`Found reference to DUPLICATE ${dupId} in ${col}/${d.id}! Will remap to ${mainId}`);
          totalFound++;
        }
      }
    });
  }
  console.log(`\nTotal references to duplicate IDs found: ${totalFound}`);
}

verifyRemap().catch(console.error);
