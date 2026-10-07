import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, deleteDoc } from 'firebase/firestore';

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

const sanitizeForFirestore = (obj) => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore).filter(v => v !== undefined);
  
  const clean = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean;
};

async function testTabletLeadCreation() {
  console.log('1. Signing in as Siva (MSV-SIVA-001)...');
  const cred = await signInWithEmailAndPassword(auth, 'msv-siva-001@mirrorsolar.in', 'Mirror@1432');
  console.log('   ✓ Signed in successfully.');

  console.log('2. Simulating the exact lead form submission from tablet screenshot...');
  // In the tablet screenshot:
  // Customer: "Siva Sunkara", Phone: "9849820668", Email: "sunkarasiva8790@gmail.com", Location: "City or Region"
  // dealerId was undefined!
  const rawFormLead = {
    customer: 'Siva Sunkara',
    phone: '9849820668',
    email: 'sunkarasiva8790@gmail.com',
    location: 'City or Region',
    dealer: '',
    dealerId: undefined, // this previously caused the failure!
    assignedEmployee: 'Sunkara Siva',
    assignedEmployeeId: 'MSV-SIVA-001',
    notes: '',
    stage: 'Lead',
    priority: 'Medium',
    leadType: 'tracking',
    followUp: { date: '', time: '', type: 'Other', status: 'No Follow-up' },
    createdAt: new Date().toISOString(),
    updatedAt: 'Just now',
    archived: false,
    createdBy: cred.user.uid,
    createdByName: 'Sunkara Siva'
  };

  const cleanPayload = sanitizeForFirestore(rawFormLead);
  console.log('   Sanitized Payload Keys:', Object.keys(cleanPayload));
  console.log('   Has dealerId undefined?', cleanPayload.dealerId === undefined);

  const docRef = await addDoc(collection(db, 'leads'), cleanPayload);
  console.log(`   ✓ SUCCESS! Lead created without any error! Document ID: ${docRef.id}`);

  // Clean up
  await deleteDoc(doc(db, 'leads', docRef.id));
  console.log(`   ✓ Cleaned up test lead.`);
  process.exit(0);
}

testTabletLeadCreation().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
