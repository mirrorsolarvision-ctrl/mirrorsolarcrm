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

async function dump() {
  const userSnap = await getDocs(collection(db, 'users'));
  const list = [];
  userSnap.forEach(d => {
    list.push({ docId: d.id, data: d.data() });
  });
  console.log(JSON.stringify(list, null, 2));
}

dump().catch(console.error);
