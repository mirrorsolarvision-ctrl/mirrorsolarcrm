import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

const targetPassword = 'Mirror@1432';

async function updateAuthUserPassword(email) {
  let uid = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, targetPassword);
    uid = cred.user.uid;
    console.log(`[Auth: Created] ${email} -> Password: "${targetPassword}" (UID: ${uid})`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      try {
        let cred;
        try {
          cred = await signInWithEmailAndPassword(auth, email, targetPassword);
        } catch (e) {
          cred = await signInWithEmailAndPassword(auth, email, 'Password123!');
        }
        uid = cred.user.uid;
        await updatePassword(cred.user, targetPassword);
        console.log(`[Auth: Updated] ${email} -> Password: "${targetPassword}" (UID: ${uid})`);
      } catch (innerErr) {
        console.error(`[Auth: Error for ${email}]:`, innerErr.message);
      }
    } else {
      console.error(`[Auth: Error for ${email}]:`, err.message);
    }
  }
  return uid;
}

async function main() {
  console.log('--- Step 1: Updating Firebase Auth Passwords to Mirror@1432 ---');
  const uid1 = await updateAuthUserPassword('msv-siva-001@mirrorsolar.in');
  const uid2 = await updateAuthUserPassword('sunkarasiva@mirrorsolar.in');
  const uid3 = await updateAuthUserPassword('sunkarashiva@mirrorsolar.in');
  const uid4 = await updateAuthUserPassword('siva@mirrorsolar.in');
  const uid5 = await updateAuthUserPassword('shiva@mirrorsolar.in');

  console.log('\n--- Step 2: Signing in as Admin to update Firestore profiles ---');
  await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
  console.log('Signed in as Admin!');

  const userProfile = {
    employeeId: 'MSV-SIVA-001',
    name: 'Sunkara Siva',
    initials: 'SS',
    email: 'msv-siva-001@mirrorsolar.in',
    phone: '+91 98450 99999',
    role: 'Employee',
    status: 'Active',
    permissions: {
      dashboard: 'view',
      leads: 'edit',
      employees: 'none',
      dealers: 'none',
      stock: 'view',
      reports: 'none',
      access: 'none',
      profile: 'edit'
    },
    features: {
      myEmployees: false,
      attendance: true,
      quotations: true,
      leads: true,
      stock: true,
      payments: true,
      reports: false,
      tasks: true,
      calendar: true
    },
    password: targetPassword,
    lastActive: 'Just now'
  };

  const uids = [uid1, uid2, uid3, uid4, uid5].filter(Boolean);
  for (const uid of uids) {
    await setDoc(doc(db, 'users', uid), { ...userProfile, id: uid }, { merge: true });
    console.log(`[Firestore: Saved] users/${uid}`);
  }

  // Also write doc users/MSV-SIVA-001 for direct ID lookup
  await setDoc(doc(db, 'users', 'MSV-SIVA-001'), { ...userProfile, id: 'MSV-SIVA-001' }, { merge: true });
  console.log(`[Firestore: Saved] users/MSV-SIVA-001`);

  console.log('\n--- Successfully configured username MSV-SIVA-001 and password Mirror@1432! ---');
  process.exit(0);
}

main().catch(console.error);
