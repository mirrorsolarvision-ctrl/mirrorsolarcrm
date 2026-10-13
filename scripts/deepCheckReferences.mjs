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

async function deepCheckReferences() {
  const collectionsToCheck = [
    'leads',
    'quotations',
    'activities',
    'tasks',
    'attendance',
    'attendance_corrections',
    'eod_reports'
  ];

  const allRecords = {};
  for (const colName of collectionsToCheck) {
    const snap = await getDocs(collection(db, colName));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    allRecords[colName] = items;
    console.log(`Loaded ${colName}: ${items.length} records`);
  }

  const userSnap = await getDocs(collection(db, 'users'));
  const users = [];
  userSnap.forEach(d => users.push({ id: d.id, ...d.data() }));

  console.log("\n=== CHECKING ALL 19 USER IDS AGAINST DATABASE ===");
  for (const u of users) {
    const refs = [];
    // leads
    allRecords.leads.forEach(l => {
      if (l.assignedEmployeeId === u.id || l.assignedEmployee === u.name || l.createdBy === u.id || l.dealerId === u.id) {
        refs.push(`lead: ${l.id} (${l.customer})`);
      }
    });
    // quotations
    allRecords.quotations.forEach(q => {
      if (q.dealerId === u.id || q.createdById === u.id || q.assignedEmployeeId === u.id) {
        refs.push(`quotation: ${q.id}`);
      }
    });
    // attendance
    allRecords.attendance.forEach(a => {
      if (a.employeeId === u.id || a.employeeName === u.name) {
        refs.push(`attendance: ${a.id} (${a.date})`);
      }
    });
    // tasks
    allRecords.tasks.forEach(t => {
      if (t.assignedTo === u.id || t.assignedTo === u.name || t.createdBy === u.id) {
        refs.push(`task: ${t.id}`);
      }
    });
    // activities
    allRecords.activities.forEach(ac => {
      if (ac.userId === u.id || ac.user === u.name) {
        refs.push(`activity: ${ac.id}`);
      }
    });

    console.log(`\nUser Doc: "${u.id}" | Name: "${u.name}" | Role: "${u.role}" | Email: "${u.email}"`);
    console.log(`  Total linked database records: ${refs.length}`);
    if (refs.length > 0) {
      console.log(`  Samples: ${refs.slice(0, 5).join(', ')}${refs.length > 5 ? ' ...and more' : ''}`);
    }
  }
}

deepCheckReferences().catch(console.error);
