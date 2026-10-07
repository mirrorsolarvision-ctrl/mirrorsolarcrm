import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

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
  console.log("Signing in as admin/staff...");
  try {
    await signInWithEmailAndPassword(auth, "admin@mirrorsolar.in", "MirrorAdmin@2025");
  } catch (e) {
    try {
      await signInWithEmailAndPassword(auth, "msv-siva-001@mirrorsolar.in", "Mirror@1432");
    } catch (e2) {
      console.log("Fallback sign in error:", e2.message);
    }
  }
  console.log("Signed in as:", auth.currentUser?.email);

  console.log("\nFetching users...");
  const userDocs = await getDocs(collection(db, 'users'));
  console.log("Total users:", userDocs.size);
  userDocs.forEach(d => {
    const data = d.data();
    console.log(`[USER] ID: ${d.id} | Name: ${data.name} | Role: ${data.role} | Email: ${data.email} | EmpCode: ${data.employeeId || data.username || data.employeeCode}`);
  });

  console.log("\nFetching leads...");
  const leadDocs = await getDocs(collection(db, 'leads'));
  console.log("Total leads:", leadDocs.size);
  leadDocs.forEach(d => {
    const data = d.data();
    console.log(`[LEAD] ID: ${d.id} | Customer: ${data.customer} | Phone: ${data.phone} | Stage: ${data.stage} | Type: ${data.leadType} | AssignedEmp: ${data.assignedEmployee} | AssignedEmpId: ${data.assignedEmployeeId} | CreatedBy: ${data.createdBy} | CreatedByName: ${data.createdByName}`);
  });
}

main().catch(console.error);
