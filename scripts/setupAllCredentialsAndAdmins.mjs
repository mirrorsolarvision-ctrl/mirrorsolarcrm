import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updatePassword 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc 
} from 'firebase/firestore';

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

const TARGET_USERS = [
  // ADMIN 1
  {
    name: 'Mirror Aqua Admin',
    email: 'mirroraquaro@gmail.com',
    password: 'Mirror@10668',
    phone: '9849810668',
    role: 'Admin',
    status: 'Active',
    initials: 'MA',
    permissions: {
      dashboard: 'full',
      leads: 'full',
      employees: 'full',
      dealers: 'full',
      stock: 'full',
      reports: 'full',
      access: 'full',
      profile: 'full'
    }
  },
  // ADMIN 2
  {
    name: 'Balaji Peruri',
    email: 'balajiperuri09@gmail.com',
    password: 'Mirror@12420',
    phone: '9182612420',
    role: 'Admin',
    status: 'Active',
    initials: 'BP',
    permissions: {
      dashboard: 'full',
      leads: 'full',
      employees: 'full',
      dealers: 'full',
      stock: 'full',
      reports: 'full',
      access: 'full',
      profile: 'full'
    }
  },
  // EMPLOYEE 1: SIVA (Marketing)
  {
    name: 'Sunkara Siva',
    username: 'siva',
    employeeId: 'MSV-SIVA-001',
    email: 'msv-siva-001@mirrorsolar.in',
    password: 'Mirror@1432',
    phone: '8985141432',
    role: 'Employee',
    employeeCategory: 'Marketing Employee',
    status: 'Active',
    initials: 'SS',
    permissions: {
      dashboard: 'view',
      leads: 'edit',
      employees: 'none',
      dealers: 'none',
      stock: 'view',
      reports: 'none',
      access: 'none',
      profile: 'edit'
    }
  },
  // EMPLOYEE 2: KUMARI (PM Surya Ghar)
  {
    name: 'Kumari',
    username: 'kumari',
    employeeId: 'MSV-KUMARI-001',
    email: 'kumari.mirrorsolarvision@gmail.com',
    password: 'Mirror@0748',
    phone: '7670920748',
    role: 'Employee',
    employeeCategory: 'PM Surya Ghar Work Incharge',
    status: 'Active',
    initials: 'KU',
    permissions: {
      dashboard: 'view',
      leads: 'edit',
      employees: 'none',
      dealers: 'none',
      stock: 'view',
      reports: 'none',
      access: 'none',
      profile: 'edit'
    }
  },
  // EMPLOYEE 3: SAI GOPAL (Stock Incharge)
  {
    name: 'Sai Gopal',
    username: 'gopal',
    employeeId: 'MSV-EMP-003',
    email: 'gopal.mirrorsolarvision@gmail.com',
    password: 'Mirror@2026',
    phone: '9876543210',
    role: 'Employee',
    employeeCategory: 'Stock Incharge',
    status: 'Active',
    initials: 'SG',
    permissions: {
      dashboard: 'view',
      leads: 'view',
      employees: 'none',
      dealers: 'none',
      stock: 'edit',
      reports: 'none',
      access: 'none',
      profile: 'edit'
    }
  },
  // DEALER 1: HUSSAIN
  {
    name: 'Hussain',
    username: 'hussain',
    email: 'hussain@dealer.in',
    password: 'Mirror@9431',
    phone: '9100309431',
    role: 'Dealer',
    status: 'Active',
    initials: 'HU',
    address: 'Kurnool',
    permissions: {
      dashboard: 'view',
      leads: 'edit',
      employees: 'none',
      dealers: 'none',
      stock: 'view',
      reports: 'none',
      access: 'none',
      profile: 'edit'
    }
  }
];

async function setupAndVerifyUsers() {
  console.log('================================================================');
  console.log('  CONFIGURING 2 ADMINS & TESTING ALL EMPLOYEES / DEALER LOGINS ');
  console.log('================================================================\n');

  // Login as superadmin to manage Firestore
  let adminUid;
  try {
    const cred = await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
    adminUid = cred.user.uid;
    console.log('✓ Initialized admin connection.');
  } catch (e) {
    console.log('Admin login info:', e.message);
  }

  // Iterate and create/update Firebase Auth & Firestore documents
  for (const userConfig of TARGET_USERS) {
    console.log(`\nProcessing: ${userConfig.name} (${userConfig.role} - ${userConfig.email})...`);

    let uid;
    // 1. Try to login or create in Firebase Auth
    try {
      const loginCred = await signInWithEmailAndPassword(auth, userConfig.email, userConfig.password);
      uid = loginCred.user.uid;
      console.log(`   ✓ Firebase Auth Login Successful! (UID: ${uid})`);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
        try {
          // Attempt create
          const newCred = await createUserWithEmailAndPassword(auth, userConfig.email, userConfig.password);
          uid = newCred.user.uid;
          console.log(`   ✓ Firebase Auth User Created! (UID: ${uid})`);
        } catch (createErr) {
          if (createErr.code === 'auth/email-already-in-use') {
            console.log(`   ⚠️ Email already in Auth. Trying alternate password or reset...`);
          } else {
            console.warn(`   Auth error for ${userConfig.email}:`, createErr.message);
          }
        }
      } else if (authErr.code === 'auth/wrong-password') {
        console.log(`   ⚠️ Password mismatch in Auth for ${userConfig.email}`);
      } else {
        console.warn(`   Auth note: ${authErr.message}`);
      }
    }

    // 2. Query / Update Firestore doc
    const firestoreDocId = uid || userConfig.email.replace(/[@.]/g, '_');
    const docRef = doc(db, 'users', firestoreDocId);
    
    await setDoc(docRef, {
      ...userConfig,
      id: firestoreDocId,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`   ✓ Firestore user doc saved under ID: ${firestoreDocId}`);
  }

  // Clean up any extra admin docs if they exist
  console.log('\n--- CLEANING UNNECESSARY OLD USERS ---');
  const snap = await getDocs(collection(db, 'users'));
  const validEmails = TARGET_USERS.map(u => u.email.toLowerCase());
  
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const email = (data.email || '').toLowerCase().trim();
    if (!validEmails.includes(email)) {
      console.log(`🗑️ Removing legacy document [${docSnap.id}] with email: "${email}" (Name: "${data.name}")`);
      await deleteDoc(doc(db, 'users', docSnap.id));
    }
  }

  // Final verification test
  console.log('\n================================================================');
  console.log('  TESTING LOGINS FOR ALL EMPLOYEES & DEALERS ');
  console.log('================================================================');
  
  for (const u of TARGET_USERS) {
    try {
      const res = await signInWithEmailAndPassword(auth, u.email, u.password);
      console.log(`✅ [${u.role}] ${u.name} (${u.email}) => LOGIN SUCCESSFUL!`);
    } catch (err) {
      console.error(`❌ [${u.role}] ${u.name} (${u.email}) => LOGIN FAILED: ${err.message}`);
    }
  }
}

setupAndVerifyUsers().catch(console.error);
