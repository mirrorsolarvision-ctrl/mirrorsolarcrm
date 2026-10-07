import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "Password123!");
  console.log("Logged in as Admin.");

  const userDocs = await getDocs(collection(db, 'users'));
  console.log(`Total user docs in collection: ${userDocs.size}\n`);

  userDocs.forEach(d => {
    const u = d.data();
    console.log(`DOC ID: ${d.id}`);
    console.log(`  Name: "${u.name}" | Role: "${u.role}" | Email: "${u.email}" | Phone: "${u.phone}" | Category: "${u.employeeCategory}"`);
  });
}

main().catch(console.error);
