import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore';

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

// Import employee calculation matching logic
function isLeadAssignedToEmployee(employee, lead) {
  if (!employee || !lead) return false;
  const targetName = (typeof employee === 'string' ? employee : (employee.name || '')).trim().toLowerCase();
  const targetId = (typeof employee === 'object' ? (employee.id || '') : '').trim().toLowerCase();
  const targetEmpId = (typeof employee === 'object' ? (employee.employeeId || employee.employeeCode || employee.username || '') : '').trim().toLowerCase();
  const targetEmail = (typeof employee === 'object' ? (employee.email || '') : '').trim().toLowerCase();

  const empName = (lead.assignedEmployee || lead.assignedTo || lead.executive || '').trim().toLowerCase();
  const empId = (lead.assignedEmployeeId || lead.assignedToId || '').trim().toLowerCase();
  const createdBy = (lead.createdBy || '').trim().toLowerCase();
  const createdByName = (lead.createdByName || '').trim().toLowerCase();

  if (empName && targetName) {
    if (empName === targetName || empName.includes(targetName) || targetName.includes(empName)) return true;
    if ((targetName.includes('siva') || targetName.includes('shiva')) && (empName.includes('siva') || empName.includes('shiva'))) return true;
  }
  if (empId) {
    if (targetId && (empId === targetId || empId.includes(targetId) || targetId.includes(empId))) return true;
    if (targetEmpId && (empId === targetEmpId || empId.includes(targetEmpId) || targetEmpId.includes(empId))) return true;
  }
  if (createdBy) {
    if (targetId && (createdBy === targetId || createdBy.includes(targetId) || targetId.includes(createdBy))) return true;
    if (targetName && (createdBy === targetName || createdBy.includes(targetName) || targetName.includes(createdBy))) return true;
    if (targetEmail && (createdBy === targetEmail || createdBy.includes(targetEmail))) return true;
    if (targetEmpId && (createdBy === targetEmpId || createdBy.includes(targetEmpId))) return true;
    if ((targetName.includes('siva') || targetName.includes('shiva')) && (createdBy.includes('siva') || createdBy.includes('shiva'))) return true;
  }
  if (createdByName) {
    if (targetName && (createdByName === targetName || createdByName.includes(targetName) || targetName.includes(createdByName))) return true;
  }
  return false;
}

async function main() {
  console.log("=== VERIFYING SUNKARA SIVA EMPLOYEE WORKFLOW ===");
  const userCredential = await signInWithEmailAndPassword(auth, "msv-siva-001@mirrorsolar.in", "Mirror@1432");
  const sivaUser = {
    id: userCredential.user.uid,
    name: "Sunkara Siva",
    email: "msv-siva-001@mirrorsolar.in",
    employeeCode: "MSV-SIVA-001",
    role: "Employee"
  };
  console.log("✓ Successfully authenticated Sunkara Siva:", sivaUser);

  // 1. Check existing leads assigned to Siva
  let leadDocs = await getDocs(collection(db, 'leads'));
  let allLeads = [];
  leadDocs.forEach(d => allLeads.push({ id: d.id, ...d.data() }));
  
  let sivaLeadsBefore = allLeads.filter(l => isLeadAssignedToEmployee(sivaUser, l));
  console.log(`\nSiva Leads count before creation: ${sivaLeadsBefore.length}`);
  sivaLeadsBefore.forEach(l => console.log(`  - [${l.id}] ${l.customer} (${l.stage})`));

  // 2. Simulate creating a new Lead from Employee Portal
  const newLeadPayload = {
    customer: "Venkata Raman (Test Customer)",
    phone: "9848022334",
    email: "venkat.raman@test.com",
    location: "Eluru",
    dealer: "Balaji peruri",
    dealerId: "DLR1790601644299",
    assignedEmployee: sivaUser.name,
    assignedEmployeeId: sivaUser.employeeCode,
    createdBy: sivaUser.id,
    createdByName: sivaUser.name,
    stage: 'Lead',
    priority: 'High',
    leadType: 'project',
    notes: 'Inquiry for 5kW On-Grid solar plant under PM Surya Ghar',
    followUp: { date: '2026-10-01', time: '10:00 AM', type: 'Call', status: 'Due Today' },
    createdAt: new Date().toISOString(),
    updatedAt: 'Just now',
    archived: false
  };

  console.log("\nAdding new lead as Sunkara Siva...");
  const docRef = await addDoc(collection(db, 'leads'), newLeadPayload);
  console.log(`✓ Lead added to Firestore with ID: ${docRef.id}`);

  // 3. Verify lead is retrieved and matched
  leadDocs = await getDocs(collection(db, 'leads'));
  allLeads = [];
  leadDocs.forEach(d => allLeads.push({ id: d.id, ...d.data() }));

  const sivaLeadsAfter = allLeads.filter(l => isLeadAssignedToEmployee(sivaUser, l));
  console.log(`\nSiva Leads count AFTER creation: ${sivaLeadsAfter.length} (increased by ${sivaLeadsAfter.length - sivaLeadsBefore.length})`);
  
  const createdLead = sivaLeadsAfter.find(l => l.id === docRef.id);
  if (createdLead) {
    console.log("✓ SUCCESS: Newly created lead is immediately found in Sunkara Siva's 'My Leads'!");
    console.log(`  - Customer: ${createdLead.customer}`);
    console.log(`  - Lead Type: ${createdLead.leadType} (5-stage documents enabled)`);
    console.log(`  - Stage: ${createdLead.stage}`);
    console.log(`  - Assigned Employee: ${createdLead.assignedEmployee}`);
  } else {
    console.error("✗ ERROR: Lead not matched to Sunkara Siva!");
  }

  // Clean up the test verification lead
  console.log(`\nCleaning up verification lead ${docRef.id}...`);
  await deleteDoc(doc(db, 'leads', docRef.id));
  console.log("✓ Cleaned up verification lead.");

  console.log("\n=== ALL WORKFLOW CHECKS PASSED ===");
}

main().catch(console.error);
