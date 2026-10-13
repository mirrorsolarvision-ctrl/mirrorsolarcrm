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

async function analyze() {
  console.log("=== USERS COLLECTION ANALYSIS ===");
  const userSnap = await getDocs(collection(db, 'users'));
  const users = [];
  userSnap.forEach(d => {
    users.push({ id: d.id, ...d.data() });
  });
  console.log(`Total users found: ${users.length}\n`);

  console.log("=== DEALERS COLLECTION ANALYSIS ===");
  const dealerSnap = await getDocs(collection(db, 'dealers'));
  const dealers = [];
  dealerSnap.forEach(d => {
    dealers.push({ id: d.id, ...d.data() });
  });
  console.log(`Total dealers found: ${dealers.length}\n`);

  console.log("=== LEADS REFERENCES CHECK ===");
  const leadSnap = await getDocs(collection(db, 'leads'));
  const leads = [];
  leadSnap.forEach(d => {
    leads.push({ id: d.id, ...d.data() });
  });
  console.log(`Total leads found: ${leads.length}\n`);

  // Print all users
  console.log("--- ALL USERS ---");
  users.forEach((u, i) => {
    console.log(`${i + 1}. ID: "${u.id}" | Name: "${u.name}" | Role: "${u.role}" | Email: "${u.email}" | Phone: "${u.phone}" | EmpId: "${u.employeeId || u.username || ''}"`);
  });

  // Group users by normalized name
  const nameGroups = {};
  users.forEach(u => {
    const key = (u.name || '').trim().toLowerCase();
    if (!nameGroups[key]) nameGroups[key] = [];
    nameGroups[key].push(u);
  });

  console.log("\n=== DUPLICATE OR SAME-NAME GROUPS ===");
  for (const [name, list] of Object.entries(nameGroups)) {
    if (list.length > 1) {
      console.log(`\nGroup Name: "${name}" (${list.length} records):`);
      for (const u of list) {
        // Count how many leads reference this user ID
        const leadRefCount = leads.filter(l => l.assignedEmployeeId === u.id || l.createdBy === u.id || l.dealerId === u.id).length;
        console.log(`  - Doc ID: ${u.id}`);
        console.log(`    Email: ${u.email}`);
        console.log(`    Phone: ${u.phone}`);
        console.log(`    Role: ${u.role}`);
        console.log(`    EmpId/Code: ${u.employeeId || u.employeeCode || u.username}`);
        console.log(`    Created: ${u.createdAt || 'N/A'}`);
        console.log(`    Referenced in leads: ${leadRefCount} leads`);
      }
    }
  }

  // Also group by email
  const emailGroups = {};
  users.forEach(u => {
    const key = (u.email || '').trim().toLowerCase();
    if (!key) return;
    if (!emailGroups[key]) emailGroups[key] = [];
    emailGroups[key].push(u);
  });

  console.log("\n=== SAME EMAIL GROUPS ===");
  for (const [email, list] of Object.entries(emailGroups)) {
    if (list.length > 1) {
      console.log(`\nEmail: "${email}" (${list.length} records):`);
      for (const u of list) {
        console.log(`  - Doc ID: ${u.id} | Name: "${u.name}" | Role: "${u.role}"`);
      }
    }
  }
}

analyze().catch(console.error);
