import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';

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

const USERS = [
  // 1. ADMIN 1
  {
    docId: 'admin_mirroraquaro',
    id: 'admin_mirroraquaro',
    name: 'Mirror Aqua Admin',
    email: 'mirroraquaro@gmail.com',
    phone: '9849810668',
    role: 'Admin',
    status: 'Active',
    initials: 'MA',
    permissions: {
      dashboard: 'full', leads: 'full', employees: 'full', dealers: 'full', stock: 'full', reports: 'full', access: 'full', profile: 'full'
    }
  },
  // 2. ADMIN 2
  {
    docId: 'admin_balajiperuri',
    id: 'admin_balajiperuri',
    name: 'Balaji Peruri',
    email: 'balajiperuri09@gmail.com',
    phone: '9182612420',
    role: 'Admin',
    status: 'Active',
    initials: 'BP',
    permissions: {
      dashboard: 'full', leads: 'full', employees: 'full', dealers: 'full', stock: 'full', reports: 'full', access: 'full', profile: 'full'
    }
  },
  // 3. EMPLOYEE 1: SIVA (Marketing)
  {
    docId: 'emp_siva',
    id: 'emp_siva',
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
      dashboard: 'view', leads: 'edit', employees: 'none', dealers: 'none', stock: 'view', reports: 'none', access: 'none', profile: 'edit'
    }
  },
  // 4. EMPLOYEE 2: KUMARI (PM Surya Ghar)
  {
    docId: 'emp_kumari',
    id: 'emp_kumari',
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
      dashboard: 'view', leads: 'edit', employees: 'none', dealers: 'none', stock: 'view', reports: 'none', access: 'none', profile: 'edit'
    }
  },
  // 5. EMPLOYEE 3: SAI GOPAL (Stock Incharge)
  {
    docId: 'emp_gopal',
    id: 'emp_gopal',
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
      dashboard: 'view', leads: 'view', employees: 'none', dealers: 'none', stock: 'edit', reports: 'none', access: 'none', profile: 'edit'
    }
  },
  // 6. DEALER 1: HUSSAIN
  {
    docId: 'dealer_hussain',
    id: 'dealer_hussain',
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
      dashboard: 'view', leads: 'edit', employees: 'none', dealers: 'none', stock: 'view', reports: 'none', access: 'none', profile: 'edit'
    }
  },
  // 7. DEALER 2: BALAJI (Dealer account if needed)
  {
    docId: 'dealer_balaji',
    id: 'dealer_balaji',
    name: 'Balaji Peruri (Dealer)',
    username: 'balaji',
    email: 'balaji.dealer@mirrorsolar.in',
    password: 'Mirror@12420',
    phone: '9182612420',
    role: 'Dealer',
    status: 'Active',
    initials: 'BP',
    address: 'Vijayawada',
    permissions: {
      dashboard: 'view', leads: 'edit', employees: 'none', dealers: 'none', stock: 'view', reports: 'none', access: 'none', profile: 'edit'
    }
  }
];

async function syncUsers() {
  await signInWithEmailAndPassword(auth, "mirroraquaro@gmail.com", "Mirror@10668");
  console.log("Logged in as Admin (mirroraquaro@gmail.com).\n");

  // Upsert all clean user records
  for (const u of USERS) {
    const { docId, ...data } = u;
    await setDoc(doc(db, 'users', docId), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`✓ Saved user: ${u.name} (${u.role}) - DocID: ${docId}`);
  }

  // Check all users
  const snap = await getDocs(collection(db, 'users'));
  console.log(`\nTotal users in collection: ${snap.size}`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`[${d.id}] "${data.name}" | Role: ${data.role} | Phone: ${data.phone || 'N/A'} | Email: ${data.email} | User: ${data.username || 'N/A'}`);
  });
}

syncUsers().catch(console.error);
