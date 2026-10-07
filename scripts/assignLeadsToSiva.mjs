import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';

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

async function assignLeadsToSiva() {
  await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
  console.log('Logged in as admin.');

  // Find unassigned leads or specific leads to assign to Sunkara Siva
  const leadsSnap = await getDocs(collection(db, 'leads'));
  let updatedCount = 0;

  for (const docSnap of leadsSnap.docs) {
    const data = docSnap.data();
    // If lead has no assigned employee or was unassigned, assign to Sunkara Siva
    if (!data.assignedEmployee || data.assignedEmployee === 'Unassigned' || data.assignedEmployee === '' || docSnap.id === '34fPlKEpby9EBUOAW5gY' || docSnap.id === 'LSW9jGj43Pxx41SFEJUc') {
      await updateDoc(doc(db, 'leads', docSnap.id), {
        assignedEmployee: 'Sunkara Siva',
        assignedEmployeeId: 'MSV-SIVA-001',
        updatedAt: 'Just now'
      });
      console.log(`Assigned lead ${docSnap.id} (${data.customer}) to Sunkara Siva`);
      updatedCount++;
    }
  }

  // Create 2 new active demo leads for Sunkara Siva to test lead creation
  const demoLead1 = {
    customer: 'K. Venkateswara Rao',
    phone: '+91 94401 23456',
    email: 'venkat.rao@example.com',
    location: 'Eluru, Andhra Pradesh',
    dealer: 'VIJAY KUMAR',
    assignedEmployee: 'Sunkara Siva',
    assignedEmployeeId: 'MSV-SIVA-001',
    createdBy: 'MSV-SIVA-001',
    createdByName: 'Sunkara Siva',
    createdByRole: 'Employee',
    notes: 'Inquired for 5kW Rooftop Solar On-Grid System under PM Surya Ghar.',
    stage: 'Lead',
    priority: 'High',
    leadType: 'tracking',
    followUp: {
      date: new Date().toISOString().split('T')[0],
      time: '11:30 AM',
      type: 'Call',
      status: 'Due Today'
    },
    createdAt: new Date().toISOString(),
    updatedAt: 'Just now',
    archived: false
  };

  const demoLead2 = {
    customer: 'Sri Lakshmi Enterprises (Eluru Commercial)',
    phone: '+91 98480 87654',
    email: 'srilakshmi.solar@example.com',
    location: 'Powerpet, Eluru',
    dealer: 'VIJAY KUMAR',
    assignedEmployee: 'Sunkara Siva',
    assignedEmployeeId: 'MSV-SIVA-001',
    createdBy: 'MSV-SIVA-001',
    createdByName: 'Sunkara Siva',
    createdByRole: 'Employee',
    notes: '10kW Commercial Plant proposal requested with battery backup feasibility.',
    stage: 'Converted',
    priority: 'High',
    leadType: 'project',
    followUp: {
      date: new Date().toISOString().split('T')[0],
      time: '03:00 PM',
      type: 'Site Visit',
      status: 'Due Today'
    },
    createdAt: new Date().toISOString(),
    updatedAt: 'Just now',
    archived: false
  };

  const ref1 = await addDoc(collection(db, 'leads'), demoLead1);
  console.log(`Created sample lead 1 for Siva with ID: ${ref1.id}`);

  const ref2 = await addDoc(collection(db, 'leads'), demoLead2);
  console.log(`Created sample lead 2 for Siva with ID: ${ref2.id}`);

  console.log('All leads successfully assigned and synced for Siva!');
  process.exit(0);
}

assignLeadsToSiva().catch(err => {
  console.error(err);
  process.exit(1);
});
