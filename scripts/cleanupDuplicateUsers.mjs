import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

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

async function cleanUsers() {
  await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "Password123!");
  console.log("Logged in as Admin.");

  // 1. Clean and configure Sunkara Siva (Marketer)
  const sivaUid = "DHIl07h9rJPBlfzc7Cg8hrfVaWj2";
  await setDoc(doc(db, 'users', sivaUid), {
    id: sivaUid,
    employeeId: "MSV-SIVA-001",
    name: "Sunkara Siva",
    email: "msv-siva-001@mirrorsolar.in",
    phone: "9059482084",
    role: "Employee",
    employeeCategory: "Marketer",
    status: "Active",
    initials: "SS",
    password: "Mirror@1432",
    lastActive: "Just now",
    permissions: {
      dashboard: "view",
      leads: "edit",
      employees: "none",
      dealers: "none",
      stock: "none",
      reports: "none",
      access: "none",
      profile: "edit"
    },
    features: {
      attendance: true,
      quotations: true,
      leads: true,
      stock: false,
      payments: true,
      reports: false,
      tasks: true,
      calendar: true,
      myEmployees: false
    }
  }, { merge: true });
  console.log("Updated Siva primary doc:", sivaUid);

  // 2. Clean and configure Kumari (PM Surya Ghar Work Incharge)
  const kumariUid = "bywen9RvVcNAPF3HaSRDPnExcoL2";
  await setDoc(doc(db, 'users', kumariUid), {
    id: kumariUid,
    employeeId: "MSV-KUMARI-001",
    name: "Kumari",
    email: "kumari@mirrorsolar.in",
    phone: "76709 20748",
    role: "Employee",
    employeeCategory: "PM Surya Ghar Work Incharge",
    status: "Active",
    initials: "KU",
    lastActive: "Just now",
    permissions: {
      dashboard: "view",
      leads: "edit",
      employees: "none",
      dealers: "none",
      stock: "view",
      reports: "view",
      access: "none",
      profile: "edit"
    },
    features: {
      attendance: true,
      quotations: true,
      leads: true,
      stock: true,
      payments: true,
      reports: true,
      tasks: true,
      calendar: true,
      myEmployees: false
    }
  }, { merge: true });
  console.log("Updated Kumari primary doc:", kumariUid);

  // Also configure secondary Kumari UID if it logs in via gmail
  const kumariGmailUid = "tLB8hvGPTQXynRLk4fYI1yPeBkF3";
  await setDoc(doc(db, 'users', kumariGmailUid), {
    id: kumariGmailUid,
    employeeId: "MSV-KUMARI-001",
    name: "Kumari",
    email: "kumari.mirrorsolarvision@gmail.com",
    phone: "76709 20748",
    role: "Employee",
    employeeCategory: "PM Surya Ghar Work Incharge",
    status: "Active",
    initials: "KU",
    lastActive: "Just now"
  }, { merge: true });

  // 3. Clean and configure Hussain (Dealer)
  const hussainUid = "ck9OPLG03RZeJhYh60npKeMEaFz2";
  await setDoc(doc(db, 'users', hussainUid), {
    id: hussainUid,
    name: "Hussain",
    email: "hussain@dealer.in",
    phone: "9100309431",
    address: "Kurnool",
    role: "Dealer",
    status: "Active",
    initials: "HU",
    lastActive: "Just now",
    permissions: {
      dashboard: "view",
      leads: "edit",
      employees: "edit",
      dealers: "none",
      stock: "view",
      reports: "none",
      access: "none",
      profile: "edit"
    },
    features: {
      attendance: true,
      quotations: true,
      leads: true,
      stock: true,
      payments: true,
      reports: false,
      tasks: true,
      calendar: true,
      myEmployees: true
    }
  }, { merge: true });
  console.log("Updated Hussain primary doc:", hussainUid);

  // 4. Clean and configure Balaji Peruri (Dealer)
  const balajiUid = "DLR1790601644299";
  await setDoc(doc(db, 'users', balajiUid), {
    id: balajiUid,
    name: "Balaji peruri",
    email: "balajiperuri09@gmail.com",
    phone: "+919182612420",
    address: "ELURU",
    role: "Dealer",
    status: "Active",
    initials: "BP",
    password: "mirror@1432",
    lastActive: "Just now",
    permissions: {
      dashboard: "view",
      leads: "edit",
      employees: "edit",
      dealers: "none",
      stock: "view",
      reports: "none",
      access: "none",
      profile: "edit"
    },
    features: {
      attendance: true,
      quotations: true,
      leads: true,
      stock: true,
      payments: true,
      reports: false,
      tasks: true,
      calendar: true,
      myEmployees: true
    }
  }, { merge: true });
  console.log("Updated Balaji primary doc:", balajiUid);

  // 5. Delete redundant duplicates
  const duplicatesToDelete = [
    "EMP1790598342118",
    "MSV-SIVA-001",
    "UVXqmtJUZMN7kG2E9FZaZxr9sZt1",
    "Ua1SUl0ws9Mm3gRYJ9FsBflh1il1",
    "VYQMyTOE0AhrytTF4y0TkpXOapn1",
    "bkTpWQKgmsXRBjCHEcwD8uO9nrJ3",
    "EMP1790302637025",
    "DLR1790302393152",
    "tsWGNMg3hkawqwnKLsrSAjWDgL12"
  ];

  for (const dupId of duplicatesToDelete) {
    try {
      await deleteDoc(doc(db, 'users', dupId));
      console.log(`Deleted duplicate doc: ${dupId}`);
    } catch (e) {
      console.warn(`Could not delete ${dupId}:`, e.message);
    }
  }

  // 6. Inspect remaining docs
  const finalSnap = await getDocs(collection(db, 'users'));
  console.log(`\nFinal user count in Firestore: ${finalSnap.size}`);
  finalSnap.forEach(d => {
    const u = d.data();
    console.log(`- ${d.id}: "${u.name}" (${u.role} - ${u.employeeCategory || 'N/A'}) - ${u.email}`);
  });
}

cleanUsers().catch(console.error);
