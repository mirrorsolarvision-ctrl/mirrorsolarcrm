import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);
const db = getFirestore(app);

async function findDuplicates() {
  await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "Password123!");
  console.log("Logged in as Admin.");

  const snap = await getDocs(collection(db, 'users'));
  console.log(`Total user records in Firestore: ${snap.size}\n`);

  const users = [];
  snap.forEach(d => {
    users.push({ docId: d.id, ...d.data() });
  });

  // Table of all users
  console.log('--- ALL USERS LIST ---');
  users.forEach((u, i) => {
    console.log(`${i + 1}. DocID: "${u.docId}" | ID: "${u.id}" | Name: "${u.name}" | Email: "${u.email}" | Role: "${u.role}" | Status: "${u.status}" | EmployeeId: "${u.employeeId || 'N/A'}"`);
  });

  // Check duplicates by Name
  console.log('\n--- DUPLICATE ANALYSIS BY NAME ---');
  const byName = {};
  users.forEach(u => {
    const key = (u.name || '').trim().toLowerCase();
    if (!byName[key]) byName[key] = [];
    byName[key].push(u);
  });

  let duplicateFound = false;
  Object.keys(byName).forEach(name => {
    if (byName[name].length > 1) {
      duplicateFound = true;
      console.log(`⚠️ Duplicate Name found: "${name}" (${byName[name].length} records)`);
      byName[name].forEach(record => {
        console.log(`   - DocID: ${record.docId}, ID: ${record.id}, Email: ${record.email}, Status: ${record.status}, Role: ${record.role}, Category: ${record.employeeCategory}`);
      });
    }
  });

  // Check duplicates by Email
  console.log('\n--- DUPLICATE ANALYSIS BY EMAIL ---');
  const byEmail = {};
  users.forEach(u => {
    const key = (u.email || '').trim().toLowerCase();
    if (!byEmail[key]) byEmail[key] = [];
    byEmail[key].push(u);
  });

  Object.keys(byEmail).forEach(email => {
    if (byEmail[email].length > 1) {
      duplicateFound = true;
      console.log(`⚠️ Duplicate Email found: "${email}" (${byEmail[email].length} records)`);
      byEmail[email].forEach(record => {
        console.log(`   - DocID: ${record.docId}, ID: ${record.id}, Name: ${record.name}, Status: ${record.status}, Role: ${record.role}`);
      });
    }
  });

  if (!duplicateFound) {
    console.log("No duplicate names or emails found!");
  }
}

findDuplicates().catch(console.error);
