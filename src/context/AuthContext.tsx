import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User as CRMUser, UserPermissions } from './CRMContext';

const defaultAdminPermissions: UserPermissions = {
  dashboard: 'full', 
  leads: 'full', 
  employees: 'full', 
  dealers: 'full', 
  stock: 'full', 
  reports: 'full', 
  access: 'full', 
  profile: 'full'
};

const defaultEmployeePermissions: UserPermissions = {
  dashboard: 'view', 
  leads: 'edit', 
  employees: 'none', 
  dealers: 'none', 
  stock: 'view', 
  reports: 'none', 
  access: 'none', 
  profile: 'edit'
};

const defaultDealerPermissions: UserPermissions = {
  dashboard: 'view', 
  leads: 'edit', 
  employees: 'none', 
  dealers: 'none', 
  stock: 'view', 
  reports: 'none', 
  access: 'none', 
  profile: 'edit'
};

// Recognized Admin Accounts (Sole Main Administrator: Durga Rao)
export const ADMIN_ACCOUNTS = [
  {
    email: 'mirrorsolarvision@gmail.com',
    phone: '9182612420',
    username: 'DURGARAO@MSV',
    name: 'Durga Rao (Admin)',
    initials: 'DR'
  }
];

interface AuthContextType {
  currentUser: CRMUser | null;
  loading: boolean;
  loginUser: (user: CRMUser) => void;
  logoutUser: () => Promise<void>;
  verifyActiveSession?: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  loginUser: () => {},
  logoutUser: async () => {},
  verifyActiveSession: async () => true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CRMUser | null>(() => {
    try {
      const saved = localStorage.getItem('crm_session_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const loginUser = (user: CRMUser) => {
    // Inject permissions if missing
    if (!user.permissions) {
      if (user.role === 'Admin') user.permissions = defaultAdminPermissions;
      else if (user.role === 'Dealer') user.permissions = defaultDealerPermissions;
      else user.permissions = defaultEmployeePermissions;
    }
    // Strict UID Precedence: id and uid must always equal the authenticated Firebase user UID
    if (auth.currentUser) {
      user.id = auth.currentUser.uid;
      (user as any).uid = auth.currentUser.uid;
    }
    const { password: _p, ...safeUser } = user as any;
    setCurrentUser(safeUser);
    try {
      localStorage.setItem('crm_session_user', JSON.stringify(safeUser));
    } catch (e) {
      console.warn("Storage save error:", e);
    }
  };

  const logoutUser = async () => {
    try {
      localStorage.removeItem('crm_session_user');
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out warning:", e);
    }
    setCurrentUser(null);
  };

  const verifyActiveSession = async (): Promise<boolean> => {
    try {
      if (!auth.currentUser) {
        localStorage.removeItem('crm_session_user');
        setCurrentUser(null);
        return false;
      }
      await auth.currentUser.getIdToken(true);
      return true;
    } catch (err) {
      console.warn("Session invalidated by backend authority:", err);
      localStorage.removeItem('crm_session_user');
      setCurrentUser(null);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch custom user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            let userData = { ...userDoc.data(), id: firebaseUser.uid, uid: firebaseUser.uid } as unknown as CRMUser;
            if (!userData.permissions) {
              if (userData.role === 'Admin') userData.permissions = defaultAdminPermissions;
              else if (userData.role === 'Employee') userData.permissions = defaultEmployeePermissions;
              else if (userData.role === 'Dealer') userData.permissions = defaultDealerPermissions;
              else userData.permissions = defaultEmployeePermissions;
            }
            loginUser(userData);
          } else {
            // Check Admin matches
            const adminMatch = ADMIN_ACCOUNTS.find(a => a.email.toLowerCase() === (firebaseUser.email || '').toLowerCase());
            if (adminMatch || firebaseUser.email === 'admin@mirrorsolar.in' || firebaseUser.email === 'mirrorsolarvision@gmail.com') {
              const adminFallback: CRMUser = {
                id: firebaseUser.uid,
                name: adminMatch?.name || 'Durga Rao (Admin)',
                email: firebaseUser.email || 'mirrorsolarvision@gmail.com',
                initials: adminMatch?.initials || 'DR',
                phone: adminMatch?.phone || '9182612420',
                status: 'Active',
                lastActive: 'Just now',
                role: 'Admin',
                permissions: defaultAdminPermissions
              };
              loginUser(adminFallback);
            }
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      } else {
        // Session Revocation Gate: Invalidate local state when Firebase Auth session is null
        localStorage.removeItem('crm_session_user');
        setCurrentUser(null);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, loginUser, logoutUser, verifyActiveSession }}>
      {children}
    </AuthContext.Provider>
  );
};
