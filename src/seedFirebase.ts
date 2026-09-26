import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import type { Employee, Dealer, User as CRMUser, MockLead } from './context/CRMContext';

export const defaultSeedDealers: Array<Omit<Dealer, 'id' | 'permissions'> & { id?: string; permissions?: any }> = [];

export const defaultSeedEmployees: Array<Omit<Employee, 'id' | 'permissions'> & { id?: string; permissions?: any }> = [];

export const defaultSeedLeads: MockLead[] = [];

export const seedSampleLeads = async () => {
  return 0;
};

export const seedFirebaseUsers = async (employees: Employee[] = [], dealers: Dealer[] = []) => {
  const defaultPassword = 'Password123!';
  let seededCount = 0;
  let lastError = '';

  // 1. Seed Admin
  try {
    const adminEmail = 'admin@mirrorsolar.in';
    let uid = '';
    try {
      const adminAuth = await createUserWithEmailAndPassword(auth, adminEmail, defaultPassword);
      uid = adminAuth.user.uid;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        const adminAuth = await signInWithEmailAndPassword(auth, adminEmail, defaultPassword);
        uid = adminAuth.user.uid;
      } else {
        throw err;
      }
    }
    
    const adminUser: CRMUser = {
      id: uid,
      name: 'Admin User',
      initials: 'AD',
      email: adminEmail,
      phone: '+91 99999 99999',
      role: 'Admin',
      status: 'Active',
      permissions: { dashboard: 'full', leads: 'full', employees: 'full', dealers: 'full', stock: 'full', reports: 'full', access: 'full', profile: 'full' },
      lastActive: 'Just now'
    };
    await setDoc(doc(db, 'users', uid), adminUser, { merge: true });
    seededCount++;
  } catch (err: any) {
    console.error("Error seeding Admin:", err);
    lastError = err.message || err.code || String(err);
  }

  // 2. Seed Employees if provided
  for (const emp of employees) {
    try {
      const email = emp.email.toLowerCase().replace(/\s+/g, '');
      let uid = '';
      try {
        const userAuth = await createUserWithEmailAndPassword(auth, email, defaultPassword);
        uid = userAuth.user.uid;
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          const userAuth = await signInWithEmailAndPassword(auth, email, defaultPassword);
          uid = userAuth.user.uid;
        } else {
          throw err;
        }
      }
      
      const firestoreUser: CRMUser = {
        ...emp,
        id: uid,
        email: email
      };
      
      await setDoc(doc(db, 'users', uid), firestoreUser, { merge: true });
      seededCount++;
    } catch (err: any) {
      console.error(`Error seeding Employee ${emp.name}:`, err);
      if (!lastError) lastError = err.message || err.code || String(err);
    }
  }

  // 3. Seed Dealers if provided
  for (const dlr of dealers) {
    try {
      const email = dlr.email.toLowerCase().replace(/\s+/g, '');
      let uid = '';
      try {
        const userAuth = await createUserWithEmailAndPassword(auth, email, defaultPassword);
        uid = userAuth.user.uid;
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          const userAuth = await signInWithEmailAndPassword(auth, email, defaultPassword);
          uid = userAuth.user.uid;
        } else {
          throw err;
        }
      }
      
      const firestoreUser: CRMUser = {
        ...dlr,
        id: uid,
        email: email
      };
      
      await setDoc(doc(db, 'users', uid), firestoreUser, { merge: true });
      seededCount++;
    } catch (err: any) {
      console.error(`Error seeding Dealer ${dlr.name}:`, err);
      if (!lastError) lastError = err.message || err.code || String(err);
    }
  }

  return { count: seededCount, error: lastError };
};
