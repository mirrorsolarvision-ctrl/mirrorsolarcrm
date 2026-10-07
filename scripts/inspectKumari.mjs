import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, getDocs, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';

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
  console.log("Authenticated as admin.");

  const snap = await getDocs(collection(db, 'users'));
  console.log("Total users found:", snap.size);

  const kumariDocs = [];
  snap.forEach(d => {
    const data = d.data();
    const name = (data.name || '').toLowerCase();
    const email = (data.email || '').toLowerCase();
    if (name.includes('kumari') || email.includes('kumari')) {
      kumariDocs.push({ docId: d.id, ...data });
    }
  });

  console.log("Kumari docs found:", JSON.stringify(kumariDocs, null, 2));
}

main().catch(console.error);
