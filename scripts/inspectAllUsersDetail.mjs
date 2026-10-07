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

async function inspect() {
  await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "Password123!");
  console.log("Logged in as Admin.");

  const snap = await getDocs(collection(db, 'users'));
  console.log(`Found ${snap.size} user documents:`);
  snap.forEach(d => {
    console.log(d.id, JSON.stringify(d.data()));
  });
}

inspect().catch(console.error);
