import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function findSivaFiles() {
  console.log("=== INSPECTING LEADS FOR SIVA & UPLOADED FILES ===");

  const leadsSnap = await getDocs(collection(db, 'leads'));
  console.log(`Total Leads: ${leadsSnap.size}`);
  leadsSnap.forEach(d => {
    const data = d.data();
    console.log(`\n--------------------------------------------`);
    console.log(`Lead ID: ${d.id}`);
    console.log(`Customer: ${data.customer || data.name} | Phone: ${data.phone} | Assigned: ${data.assignedEmployee} | Dealer: ${data.dealer}`);
    
    // Check all fields for any url or file or document
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (typeof val === 'string' && (val.includes('http') || val.includes('firebasestorage') || val.includes('data:') || val.includes('.pdf') || val.includes('.png') || val.includes('.jpg'))) {
        console.log(`Field [${key}]: ${val.slice(0, 150)}...`);
      } else if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        const str = JSON.stringify(val);
        if (str.includes('http') || str.includes('firebasestorage') || str.includes('data:') || str.includes('.pdf') || str.includes('.png') || str.includes('.jpg') || str.includes('doc') || str.includes('Bill') || str.includes('Aadhaar')) {
          console.log(`Field [${key}] Object/Array:`, JSON.stringify(val, null, 2));
        }
      }
    });
  });

  console.log("\n=== INSPECTING QUOTATIONS ===");
  const quotesSnap = await getDocs(collection(db, 'quotations'));
  console.log(`Total Quotations: ${quotesSnap.size}`);
  quotesSnap.forEach(d => {
    console.log(`Quote ID: ${d.id}`, JSON.stringify(d.data(), null, 2));
  });

  console.log("\n=== INSPECTING USERS ===");
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Total Users: ${usersSnap.size}`);
  usersSnap.forEach(d => {
    const u = d.data();
    console.log(`User Doc [${d.id}]: Name: ${u.name} | Role: ${u.role} | Email: ${u.email} | Phone: ${u.phone} | Username: ${u.username} | Address: ${u.address}`);
  });
}

findSivaFiles().catch(console.error);
