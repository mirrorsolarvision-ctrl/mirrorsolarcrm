import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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

async function runLiveHealthCheck() {
  console.log('==============================================');
  console.log('  LIVE BACKEND & FIREBASE HEALTH VERIFICATION ');
  console.log('==============================================\n');

  // 1. Test Siva Authentication
  console.log('1. Testing Siva Login (MSV-SIVA-001 / msv-siva-001@mirrorsolar.in)...');
  const sivaCred = await signInWithEmailAndPassword(auth, 'msv-siva-001@mirrorsolar.in', 'Mirror@1432');
  console.log(`   ✓ Logged in as Siva! UID: ${sivaCred.user.uid}, Email: ${sivaCred.user.email}`);

  // 2. Test Reading Leads Collection as Siva
  console.log('\n2. Testing Real-Time Leads Read Permission as Siva...');
  const leadsSnap = await getDocs(collection(db, 'leads'));
  console.log(`   ✓ Successfully fetched ${leadsSnap.size} leads from live Firestore.`);

  // 3. Test Lead Creation as Siva
  console.log('\n3. Testing Lead Creation from Employee Portal (as Siva)...');
  const testLeadPayload = {
    customer: 'Live Verification Customer (Eluru)',
    phone: '+91 99887 76655',
    email: 'live.test@mirrorsolarvision.com',
    location: 'Eluru Town',
    dealer: 'VIJAY KUMAR',
    assignedEmployee: 'Sunkara Siva',
    assignedEmployeeId: 'MSV-SIVA-001',
    createdBy: sivaCred.user.uid,
    createdByName: 'Sunkara Siva',
    createdByRole: 'Employee',
    notes: 'Live verification test lead created smoothly.',
    stage: 'Lead',
    priority: 'High',
    leadType: 'tracking',
    followUp: {
      date: new Date().toISOString().split('T')[0],
      time: '04:00 PM',
      type: 'Call',
      status: 'Due Today'
    },
    createdAt: new Date().toISOString(),
    updatedAt: 'Just now',
    archived: false
  };

  const newLeadRef = await addDoc(collection(db, 'leads'), testLeadPayload);
  console.log(`   ✓ Live lead successfully created with ID: ${newLeadRef.id}`);

  // 4. Test Lead Update as Siva
  console.log('\n4. Testing Lead Update Permission as Siva...');
  await updateDoc(doc(db, 'leads', newLeadRef.id), {
    notes: 'Live verification test lead updated with notes.',
    updatedAt: 'Just now'
  });
  console.log(`   ✓ Live lead updated smoothly.`);

  // 5. Test Reading Activities as Siva
  console.log('\n5. Testing Activities & Tasks Access as Siva...');
  const activitiesSnap = await getDocs(collection(db, 'activities'));
  console.log(`   ✓ Successfully read activities (${activitiesSnap.size} entries).`);

  const tasksSnap = await getDocs(collection(db, 'tasks'));
  console.log(`   ✓ Successfully read tasks (${tasksSnap.size} entries).`);

  // 6. Sign out Siva, log in as Admin to clean up test lead
  await signOut(auth);
  console.log('\n6. Logging in as Admin to clean up test document...');
  await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
  await deleteDoc(doc(db, 'leads', newLeadRef.id));
  console.log(`   ✓ Cleaned up test lead ${newLeadRef.id}.`);

  console.log('\n==============================================');
  console.log('  ALL LIVE CHECKS PASSED: 100% OPERATIONAL');
  console.log('==============================================');
  process.exit(0);
}

runLiveHealthCheck().catch(err => {
  console.error('\n❌ Health check failed:', err);
  process.exit(1);
});
