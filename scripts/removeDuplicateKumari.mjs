import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore';

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

async function removeDuplicateKumari() {
  await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "Password123!");
  console.log("Authenticated as admin.");

  // 1. Delete the duplicate dummy kumari@mirrorsolar.in document
  const dummyKumariUid = "bywen9RvVcNAPF3HaSRDPnExcoL2";
  try {
    await deleteDoc(doc(db, 'users', dummyKumariUid));
    console.log(`✓ Successfully removed duplicate Kumari document (${dummyKumariUid}) with fake email.`);
  } catch (err) {
    console.error("Error deleting dummy Kumari:", err);
  }

  // 2. Ensure real Kumari with gmail (tLB8hvGPTQXynRLk4fYI1yPeBkF3) is fully active and configured
  const realKumariUid = "tLB8hvGPTQXynRLk4fYI1yPeBkF3";
  const realKumariData = {
    id: realKumariUid,
    employeeId: "MSV-EMP-001",
    name: "Kumari",
    email: "kumari.mirrorsolarvision@gmail.com",
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
  };

  await setDoc(doc(db, 'users', realKumariUid), realKumariData, { merge: true });
  console.log(`✓ Real Kumari profile (${realKumariUid} - kumari.mirrorsolarvision@gmail.com) verified and active.`);
}

removeDuplicateKumari().catch(console.error);
