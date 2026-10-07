import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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

async function main() {
  console.log('Signing in as Admin...');
  await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
  console.log('Signed in as Admin successfully.');

  const sivaFeatures = {
    myEmployees: false,
    attendance: true,
    quotations: true,
    leads: true,
    stock: false,
    payments: true,
    reports: false,
    tasks: true,
    calendar: true
  };

  const sivaPermissions = {
    dashboard: 'view',
    leads: 'edit',
    employees: 'none',
    dealers: 'none',
    stock: 'none',
    reports: 'none',
    access: 'none',
    profile: 'edit'
  };

  const sivaProfile = {
    employeeId: 'MSV-SIVA-001',
    name: 'Sunkara Siva',
    initials: 'SS',
    email: 'msv-siva-001@mirrorsolar.in',
    phone: '+91 98450 99999',
    role: 'Employee',
    status: 'Active',
    permissions: sivaPermissions,
    features: sivaFeatures,
    password: 'Mirror@1432',
    lastActive: 'Just now'
  };

  // Find all Siva accounts and update their features
  const usersSnapshot = await getDocs(collection(db, 'users'));
  let updatedCount = 0;

  usersSnapshot.forEach(async (userDoc) => {
    const data = userDoc.data();
    if (
      userDoc.id === 'MSV-SIVA-001' ||
      data.email === 'msv-siva-001@mirrorsolar.in' ||
      data.email === 'sunkarasiva@mirrorsolar.in' ||
      data.email === 'sunkarashiva@mirrorsolar.in' ||
      data.email === 'siva@mirrorsolar.in' ||
      data.email === 'shiva@mirrorsolar.in' ||
      data.name === 'Sunkara Siva' ||
      data.name === 'Sunkara Shiva'
    ) {
      await setDoc(doc(db, 'users', userDoc.id), {
        ...data,
        ...sivaProfile,
        id: userDoc.id,
        features: sivaFeatures
      }, { merge: true });
      console.log(`Updated features for user doc: ${userDoc.id} (${data.email || data.name})`);
      updatedCount++;
    }
  });

  // Ensure MSV-SIVA-001 is explicitly set
  await setDoc(doc(db, 'users', 'MSV-SIVA-001'), {
    ...sivaProfile,
    id: 'MSV-SIVA-001'
  }, { merge: true });

  console.log(`Done! Updated Siva permissions (attendance, leads, quotations, tasks, calendar, payments).`);
  process.exit(0);
}

main().catch(console.error);
