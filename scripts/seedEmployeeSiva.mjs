import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

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

const defaultPassword = 'Password123!';

async function seedUser(email, name, role) {
  let uid = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, defaultPassword);
    uid = cred.user.uid;
    console.log(`Created new Auth user for ${email} with UID: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, defaultPassword);
      uid = cred.user.uid;
      console.log(`User already exists, signed in ${email} with UID: ${uid}`);
    } else {
      console.error(`Failed Auth for ${email}:`, err.message);
      return;
    }
  }

  const userProfile = {
    id: uid,
    name: name,
    initials: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
    email: email,
    phone: '+91 98450 99999',
    role: role,
    status: 'Active',
    permissions: {
      dashboard: 'view',
      leads: 'edit',
      employees: 'none',
      dealers: 'none',
      stock: 'view',
      reports: 'none',
      access: 'none',
      profile: 'edit'
    },
    features: {
      myEmployees: false,
      attendance: true,
      quotations: true,
      leads: true,
      stock: true,
      payments: true,
      reports: false,
      tasks: true,
      calendar: true
    },
    password: defaultPassword,
    lastActive: 'Just now'
  };

  await setDoc(doc(db, 'users', uid), userProfile, { merge: true });
  console.log(`Successfully stored Firestore user doc for ${name} (${email}) at users/${uid}`);
}

async function main() {
  console.log('Seeding Sunkara Shiva / Siva employee accounts...');
  // Seed both variations of spelling: Siva and Shiva so both work seamlessly
  await seedUser('sunkarashiva@mirrorsolar.in', 'Sunkara Shiva', 'Employee');
  await seedUser('sunkarasiva@mirrorsolar.in', 'Sunkara Siva', 'Employee');
  await seedUser('shiva@mirrorsolar.in', 'Sunkara Shiva', 'Employee');
  await seedUser('siva@mirrorsolar.in', 'Sunkara Siva', 'Employee');
  console.log('Done!');
  process.exit(0);
}

main().catch(console.error);
