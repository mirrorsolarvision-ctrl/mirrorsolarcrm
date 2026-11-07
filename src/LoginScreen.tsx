import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Loader2, Zap, Eye, EyeOff, ShieldCheck, Sparkles, User, Briefcase, Mail, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import logoUrl from './assets/mirrorsolarlogo.png';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useAuth } from './context/AuthContext';
import { useAudit } from './context/AuditLogContext';
import { defaultCompanyEmployees, defaultCompanyDealers } from './context/CRMContext';
import type { User as CRMUser, UserPermissions, Employee, Dealer } from './context/CRMContext';
import './LoginScreen.css';

interface LoginScreenProps {
  role: string;
  onBack: () => void;
  onLoginSuccess?: (userId: string) => void;
}

const adminPermissions: UserPermissions = {
  dashboard: 'full',
  leads: 'full',
  employees: 'full',
  dealers: 'full',
  stock: 'full',
  reports: 'full',
  access: 'full',
  profile: 'full'
};

const defaultUserPermissions: UserPermissions = {
  dashboard: 'view',
  leads: 'full',
  employees: 'view',
  dealers: 'view',
  stock: 'view',
  reports: 'view',
  access: 'none',
  profile: 'full'
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout (300 seconds)

export default function LoginScreen({ role, onBack, onLoginSuccess }: LoginScreenProps) {
  const { loginUser } = useAuth();
  const { logAction } = useAudit();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [stage, setStage] = useState(0);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Password reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Brute force lockout state
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);

  useEffect(() => {
    // Entrance animations
    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 250);
    const t3 = setTimeout(() => setStage(3), 400);
    const t4 = setTimeout(() => setStage(4), 550);
    const t5 = setTimeout(() => setStage(5), 700);

    // Check lockout timer
    checkLockout();

    const interval = setInterval(() => {
      checkLockout();
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearInterval(interval);
    };
  }, []);

  const checkLockout = () => {
    try {
      const lockoutUntil = parseInt(localStorage.getItem('crm_login_lockout_until') || '0', 10);
      const now = Date.now();
      if (lockoutUntil > now) {
        const remaining = Math.ceil((lockoutUntil - now) / 1000);
        // Enforce 300 seconds ceiling: if user manipulated local clock or stored invalid value, clamp to 300s
        if (remaining > 300) {
          const clampedUntil = now + LOCKOUT_DURATION_MS;
          localStorage.setItem('crm_login_lockout_until', clampedUntil.toString());
          setLockoutRemainingSec(300);
        } else {
          setLockoutRemainingSec(remaining);
        }
      } else {
        setLockoutRemainingSec(0);
        if (lockoutUntil > 0) {
          localStorage.removeItem('crm_login_lockout_until');
        }
      }
    } catch {
      setLockoutRemainingSec(0);
    }
  };

  const recordFailedAttempt = async (identifier: string) => {
    try {
      const sanitizedId = identifier.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const attempts = parseInt(localStorage.getItem('crm_login_failed_attempts') || '0', 10) + 1;
      localStorage.setItem('crm_login_failed_attempts', attempts.toString());
      
      let isLocked = attempts >= MAX_FAILED_ATTEMPTS;
      let lockoutUntil = isLocked ? Date.now() + LOCKOUT_DURATION_MS : 0;

      // Cross-Device Server-Side Lockout in Firestore
      try {
        const attemptRef = doc(db, 'auth_attempts', sanitizedId);
        const snap = await getDoc(attemptRef);
        const serverData = snap.exists() ? snap.data() : { failedCount: 0 };
        const serverCount = (serverData.failedCount || 0) + 1;
        if (serverCount >= MAX_FAILED_ATTEMPTS) {
          isLocked = true;
          lockoutUntil = Math.max(lockoutUntil, Date.now() + LOCKOUT_DURATION_MS);
        }
        await setDoc(attemptRef, {
          identifier,
          sanitizedId,
          failedCount: serverCount,
          lastAttempt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
          lockoutUntil
        }, { merge: true });
      } catch (err) {
        console.warn('Server-side rate limit record fallback:', err);
      }

      if (isLocked) {
        localStorage.setItem('crm_login_lockout_until', lockoutUntil.toString());
        setLockoutRemainingSec(Math.ceil((lockoutUntil - Date.now()) / 1000));
        logAction({
          action: 'LOGIN_LOCKED_OUT',
          entityType: 'Security',
          entityId: identifier,
          entityLabel: `Account locked after consecutive failed attempts (5-minute security lockout)`,
          reason: 'Excessive consecutive authentication failures across devices'
        }).catch(() => {});
      } else {
        logAction({
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: identifier,
          entityLabel: `Failed login attempt ${attempts}/${MAX_FAILED_ATTEMPTS}`,
          reason: 'Invalid credentials entered'
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Error recording failed login attempt:', e);
    }
  };

  const clearFailedAttempts = async (identifier?: string) => {
    try {
      localStorage.removeItem('crm_login_failed_attempts');
      localStorage.removeItem('crm_login_lockout_until');
      setLockoutRemainingSec(0);

      if (identifier) {
        const sanitizedId = identifier.toLowerCase().replace(/[^a-z0-9]/g, '_');
        try {
          await setDoc(doc(db, 'auth_attempts', sanitizedId), {
            identifier,
            sanitizedId,
            failedCount: 0,
            lockoutUntil: 0,
            lastAttempt: new Date().toISOString(),
            lastAttemptAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString()
          }, { merge: true });
        } catch {}
      }
    } catch {}
  };

  const resolveCanonicalEmail = (rawInput: string): string => {
    const clean = rawInput.trim();
    const lower = clean.toLowerCase();
    const digits = clean.replace(/\D/g, '').slice(-10);

    if (clean.includes('@')) {
      return clean;
    }

    // Admin aliases
    if (['admin', 'msvadmin', 'mirrorsolarvision'].includes(lower) || digits === '9849810668') {
      return 'mirrorsolarvision@gmail.com';
    }
    if (lower.includes('balaji') || digits === '9182612420') {
      return 'balajiperuri09@gmail.com';
    }
    if (lower.includes('aqua') || lower === 'mirroraquaro@gmail.com') {
      return 'mirroraquaro@gmail.com';
    }

    // Telecaller & Sales Aliases
    if (lower.includes('bhavani') || digits === '9848123456' || lower === 'msv-tc-001') {
      return 'bhavani.telecaller@mirrorsolar.in';
    }
    if (lower.includes('suresh') || digits === '9440188990' || lower === 'msv-sales-001') {
      return 'sales.telecaller@mirrorsolar.in';
    }

    // Employees lookup
    for (const emp of defaultCompanyEmployees) {
      const empCode = (emp.code || emp.employeeId || '').toLowerCase();
      const empPhone = (emp.phone || '').replace(/\D/g, '').slice(-10);
      const empName = (emp.name || '').toLowerCase();
      if (empCode === lower || (digits.length === 10 && empPhone === digits) || (lower.length > 3 && empName.includes(lower))) {
        return emp.email;
      }
    }

    // Dealers lookup
    for (const dlr of defaultCompanyDealers) {
      const dlrCode = (dlr.code || dlr.dealerCode || '').toLowerCase();
      const dlrPhone = (dlr.phone || '').replace(/\D/g, '').slice(-10);
      const dlrName = (dlr.name || '').toLowerCase();
      if (dlrCode === lower || (digits.length === 10 && dlrPhone === digits) || (lower.length > 3 && dlrName.includes(lower))) {
        return dlr.email;
      }
    }

    if (role === 'Dealer') return `${lower}@dealer.in`;
    if (role === 'Admin') return `${lower}@mirrorsolarvision.com`;
    return `${lower}@mirrorsolar.in`;
  };

  const processLogin = async (rawInput: string, rawPass: string) => {
    if (lockoutRemainingSec > 0) {
      const mins = Math.floor(lockoutRemainingSec / 60);
      const secs = lockoutRemainingSec % 60;
      const timeRemainingStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      setErrorMsg(`Too many failed login attempts. Account temporarily locked for 5 minutes. Try again in ${timeRemainingStr} or reset password.`);
      return;
    }

    setIsSigningIn(true);
    setErrorMsg('');

    const targetEmail = resolveCanonicalEmail(rawInput);
    const inputPass = rawPass.trim();
    const sanitizedId = targetEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Server-side lockout verification (Cross-Device Defense)
    try {
      const attemptSnap = await getDoc(doc(db, 'auth_attempts', sanitizedId));
      if (attemptSnap.exists()) {
        const attemptData = attemptSnap.data();
        const serverLockoutUntil = attemptData.lockoutUntil || 0;
        if (serverLockoutUntil > Date.now()) {
          const remainingSec = Math.ceil((serverLockoutUntil - Date.now()) / 1000);
          const clampedRemaining = Math.min(remainingSec, 300);
          setLockoutRemainingSec(clampedRemaining);
          const mins = Math.floor(clampedRemaining / 60);
          const secs = clampedRemaining % 60;
          const timeRemainingStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          setErrorMsg(`Account temporarily locked across all devices due to repeated authentication failures. Please wait ${timeRemainingStr} or reset password.`);
          setIsSigningIn(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Server rate limit lookup fallback:', e);
    }

    try {
      // Authenticate directly with Firebase Authentication backend
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, inputPass);
      const firebaseUser = userCredential.user;
      const uid = firebaseUser.uid;

      // Fetch user profile from Firestore /users/{uid}
      let crmUser: CRMUser | null = null;
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          crmUser = { id: uid, ...userSnap.data() } as CRMUser;
        }
      } catch (docErr) {
        console.warn('Could not read user profile from Firestore, falling back to local registry:', docErr);
      }

      // If document wasn't found in /users, match against known registries
      if (!crmUser) {
        const lowerEmail = targetEmail.toLowerCase();
        const matchedEmp = defaultCompanyEmployees.find(e => e.email.toLowerCase() === lowerEmail);
        const matchedDlr = defaultCompanyDealers.find(d => d.email.toLowerCase() === lowerEmail);
        const isAdmin = ['mirrorsolarvision@gmail.com', 'mirroraquaro@gmail.com', 'balajiperuri09@gmail.com'].includes(lowerEmail);

        if (isAdmin) {
          crmUser = {
            id: uid,
            name: lowerEmail.includes('balaji') ? 'Balaji Peruri (Admin)' : (lowerEmail.includes('aqua') ? 'Mirror Aqua RO (Admin)' : 'Mirror Solar Vision Admin'),
            email: targetEmail,
            phone: lowerEmail.includes('balaji') ? '9182612420' : '9849810668',
            role: 'Admin',
            status: 'Active',
            lastActive: 'Just now',
            initials: lowerEmail.includes('balaji') ? 'BP' : (lowerEmail.includes('aqua') ? 'MA' : 'MS'),
            permissions: adminPermissions
          };
        } else if (matchedEmp) {
          crmUser = {
            id: uid,
            name: matchedEmp.name,
            email: targetEmail,
            phone: matchedEmp.phone || '',
            role: 'Employee',
            employeeCategory: matchedEmp.employeeCategory,
            employeeId: matchedEmp.employeeId || matchedEmp.code,
            status: 'Active',
            lastActive: 'Just now',
            initials: matchedEmp.initials || 'EM',
            permissions: matchedEmp.permissions || defaultUserPermissions
          };
        } else if (matchedDlr) {
          crmUser = {
            id: uid,
            name: matchedDlr.name,
            email: targetEmail,
            phone: matchedDlr.phone || '',
            role: 'Dealer',
            dealerCode: matchedDlr.dealerCode || matchedDlr.code,
            status: 'Active',
            lastActive: 'Just now',
            initials: matchedDlr.initials || 'DL',
            permissions: matchedDlr.permissions || defaultUserPermissions
          };
        } else {
          crmUser = {
            id: uid,
            name: targetEmail.split('@')[0],
            email: targetEmail,
            phone: '',
            role: role === 'Admin' ? 'Admin' : (role === 'Dealer' ? 'Dealer' : 'Employee'),
            status: 'Active',
            lastActive: 'Just now',
            initials: 'MS',
            permissions: role === 'Admin' ? adminPermissions : defaultUserPermissions
          };
        }
      }

      if (crmUser) {
        // Enforce Admin role & permissions for registered admin accounts
        const userEmailLower = (crmUser.email || targetEmail).toLowerCase();
        if (['mirrorsolarvision@gmail.com', 'mirroraquaro@gmail.com', 'balajiperuri09@gmail.com'].includes(userEmailLower)) {
          crmUser.role = 'Admin';
          crmUser.permissions = adminPermissions;
        }

        // Account Deactivation & Suspension Enforcement Gate
        if (crmUser.status === 'Inactive' || (crmUser.status as any) === 'Disabled' || (crmUser.status as any) === 'Archived' || (crmUser as any).isDeleted) {
          await auth.signOut();
          setErrorMsg("Access Denied: This account has been deactivated or removed by administration. Please contact HR / Admin.");
          setIsSigningIn(false);
          return;
        }

        // Clear server & local failed attempts on authenticated access
        await clearFailedAttempts(targetEmail);

        // Record successful login audit trail
        logAction({
          action: 'LOGIN_SUCCESS',
          entityType: 'User',
          entityId: uid,
          entityLabel: targetEmail,
          diffSummary: `Signed in as ${crmUser.role}${crmUser.employeeCategory ? ` (${crmUser.employeeCategory})` : ''}`
        }).catch(() => {});

        // Set user session in context & storage
        loginUser(crmUser);

        if (onLoginSuccess) {
          onLoginSuccess(uid);
        }
      }
    } catch (authErr: any) {
      console.warn('Firebase authentication failed:', authErr.code || authErr.message);
      
      // ONLY penalize and record failed attempt for genuine credential mismatches!
      // Do NOT lock out users when there is a network error, offline connection, or Firebase server hiccup.
      const isCredentialError = authErr.code === 'auth/invalid-credential' || 
                                authErr.code === 'auth/wrong-password' || 
                                authErr.code === 'auth/user-not-found';

      if (isCredentialError) {
        await recordFailedAttempt(targetEmail);
        setErrorMsg('Invalid username or password. Please verify credentials and try again.');
      } else if (authErr.code === 'auth/too-many-requests') {
        setErrorMsg('Access temporarily blocked due to unusual traffic. Please reset your password or try again later.');
      } else if (authErr.code === 'auth/network-request-failed') {
        setErrorMsg('Network error: Unable to reach Firebase Authentication. Please check your internet connection and try again.');
      } else {
        setErrorMsg(`Authentication failed (${authErr.code || 'Check network connection'}). Please verify credentials.`);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processLogin(usernameOrEmail, password);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsSendingReset(true);
    setResetStatus(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetStatus({
        type: 'success',
        message: `Password reset instructions have been dispatched to ${resetEmail}. Please check your inbox or spam folder.`
      });
      logAction({
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: resetEmail,
        entityLabel: resetEmail,
        reason: 'User self-service password reset requested'
      }).catch(() => {});
    } catch (err: any) {
      console.error('Password reset dispatch error:', err);
      setResetStatus({
        type: 'error',
        message: err.code === 'auth/user-not-found'
          ? 'No registered account found with this email address.'
          : 'Unable to send password reset email. Please contact Admin.'
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  // Only show development convenience quick-fill in non-production builds
  const isDevMode = !import.meta.env.PROD;

  return (
    <div className="login-screen-container">
      {/* LEFT PANEL - Branding */}
      <div className="login-left-panel">
        
        {/* Subtle Solar Energy Visual System */}
        <div className="solar-visual-system">
          <svg className={`visual-yellow-arc ${stage >= 1 ? 'draw' : ''}`} viewBox="0 0 200 200">
             <circle cx="100" cy="100" r="90" className="yellow-arc-path" />
          </svg>
          
          <svg className={`visual-navy-orbit ${stage >= 2 ? 'draw' : ''}`} viewBox="0 0 200 200">
             <circle cx="100" cy="100" r="140" className="navy-orbit-path" />
          </svg>

          <svg className={`visual-network ${stage >= 2 ? 'reveal' : ''}`} viewBox="0 0 400 400">
             <path d="M 50 150 Q 150 200 300 100" className="network-line" />
             <path d="M 100 300 Q 250 250 350 350" className="network-line" />
          </svg>

          <div className={`energy-node node-1 ${stage >= 3 ? 'reveal' : ''}`}></div>
          <div className={`energy-node node-2 ${stage >= 3 ? 'reveal' : ''}`}></div>
          <div className={`energy-node node-3 ${stage >= 3 ? 'reveal' : ''}`}></div>
          
          <div className={`solar-icon-container ${stage >= 3 ? 'reveal' : ''}`}>
             <Zap className="solar-icon" size={24} strokeWidth={1.75} />
          </div>
        </div>
        
        <div className="left-content">
          <img src={logoUrl} alt="Solar CRM" className={`login-logo ${stage >= 4 ? 'reveal' : ''}`} />
          
          <div className={`left-text-group ${stage >= 4 ? 'reveal' : ''}`}>
            <h2>Powering <span className="text-highlight">smarter</span> solar operations.</h2>
            <p>Manage leads, quotations, PM Surya Ghar subsidies and material dispatches in one unified system.</p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Login Form */}
      <div className="login-right-panel">
        <div className="login-form-container">
          
          <div className={`login-header ${stage >= 4 ? 'reveal' : ''}`}>
            <div className="role-badge">
              <div className="badge-indicator"></div>
              {role.toUpperCase()}
            </div>
            <h3>Welcome back</h3>
            <h1>{role} Login</h1>
            <div className={`heading-yellow-accent ${stage >= 5 ? 'draw' : ''}`}></div>
          </div>

          {/* Development Quick-Fill Helper: strictly disabled in production builds */}
          {isDevMode && (
            <div className={`quick-login-section ${stage >= 4 ? 'reveal' : ''}`}>
              <div className="quick-login-label">
                <Sparkles size={14} className="sparkle-icon" />
                <span>⚡ Dev Quick-Fill Identifier (Credentials Required)</span>
              </div>
              <div className="quick-login-chips">
                <button 
                  type="button" 
                  className="quick-chip chip-telecaller"
                  onClick={() => setUsernameOrEmail('bhavani.telecaller@mirrorsolar.in')}
                  title="Fill K. Bhavani's email"
                >
                  <User size={13} /> K. Bhavani (Telecaller)
                </button>
                <button 
                  type="button" 
                  className="quick-chip chip-sales"
                  onClick={() => setUsernameOrEmail('sales.telecaller@mirrorsolar.in')}
                  title="Fill P. Suresh's email"
                >
                  <Briefcase size={13} /> P. Suresh (Sales Mgr)
                </button>
                <button 
                  type="button" 
                  className="quick-chip chip-admin"
                  onClick={() => setUsernameOrEmail('mirrorsolarvision@gmail.com')}
                  title="Fill Admin's email"
                >
                  <ShieldCheck size={13} /> Admin
                </button>
                <button 
                  type="button" 
                  className="quick-chip chip-dealer"
                  onClick={() => setUsernameOrEmail('hussain@dealer.in')}
                  title="Fill Hussain's email"
                >
                  <Zap size={13} /> Hussain (Dealer)
                </button>
              </div>
            </div>
          )}

          {/* Lockout Warning Banner */}
          {lockoutRemainingSec > 0 && (
            <div className="login-error-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong>Security Lockout Active</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
                  Device locked due to multiple failed attempts. Please wait {Math.floor(lockoutRemainingSec / 60)}m {String(lockoutRemainingSec % 60).padStart(2, '0')}s before retrying.
                </p>
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('crm_login_lockout_until');
                      localStorage.removeItem('crm_login_failed_attempts');
                      setLockoutRemainingSec(0);
                      setErrorMsg('');
                    }}
                    style={{
                      background: '#b91c1c',
                      color: '#ffffff',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Clear Local Device Lockout
                  </button>
                </div>
              </div>
            </div>
          )}

          <form className="login-form" onSubmit={handleAuthSubmit}>
            {errorMsg && lockoutRemainingSec === 0 && (
              <div className="login-error-banner">
                {errorMsg}
              </div>
            )}
            
            <div className={`input-group ${stage >= 4 ? 'reveal' : ''}`}>
              <label htmlFor="loginIdentifier">
                {role === 'Admin' ? 'Admin Email, Phone or Username' : 'Username, Employee/Dealer ID or Email'}
              </label>
              <div className="input-wrapper">
                <input 
                  id="loginIdentifier"
                  name="loginIdentifier"
                  type="text"
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder={
                    role === 'Dealer' 
                      ? "e.g. hussain@dealer.in or 9100309431" 
                      : role === 'Admin' 
                        ? "e.g. mirrorsolarvision@gmail.com or 9849810668" 
                        : "e.g. bhavani.telecaller@mirrorsolar.in or 9848123456"
                  }
                  required
                  autoFocus
                  disabled={lockoutRemainingSec > 0}
                />
                <div className="input-focus-border"></div>
              </div>
            </div>

            <div className={`input-group ${stage >= 4 ? 'reveal' : ''}`} style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="loginPassword">Password</label>
              </div>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <input 
                  id="loginPassword"
                  name="loginPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                  disabled={lockoutRemainingSec > 0}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <div className="input-focus-border"></div>
              </div>
            </div>

            <div className={`form-actions-row ${stage >= 4 ? 'reveal' : ''}`}>
              <label className="custom-checkbox-container" htmlFor="rememberMeCheckbox">
                <input 
                  id="rememberMeCheckbox"
                  name="rememberMeCheckbox"
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)} 
                />
                <span className="custom-checkmark"></span>
                <span className="checkbox-text">Remember me</span>
              </label>

              <button 
                type="button" 
                className="btn-forgot-password"
                onClick={() => {
                  setShowResetModal(true);
                  setResetEmail(usernameOrEmail.includes('@') ? usernameOrEmail : '');
                  setResetStatus(null);
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button 
              type="submit" 
              className={`btn-signin ${stage >= 4 ? 'reveal' : ''}`} 
              disabled={isSigningIn || lockoutRemainingSec > 0}
            >
              <div className="btn-yellow-accent"></div>
              {isSigningIn ? (
                <span className="btn-content loading">
                  <Loader2 className="spinner" size={20} />
                  Verifying Identity...
                </span>
              ) : (
                <span className="btn-content">
                  Sign In <ArrowRight className="btn-arrow" size={18} />
                </span>
              )}
            </button>
          </form>

          <button 
            type="button" 
            className={`btn-back ${stage >= 4 ? 'reveal' : ''}`} 
            onClick={onBack}
          >
            <ArrowLeft className="back-arrow" size={16} /> Switch role / account type
          </button>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="reset-modal-overlay">
          <div className="reset-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3>Reset Your Password</h3>
              <button 
                type="button" 
                onClick={() => setShowResetModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            <p>
              Enter your verified email address below. A secure password reset link will be sent to your inbox.
            </p>

            {resetStatus && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  background: resetStatus.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${resetStatus.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                  color: resetStatus.type === 'success' ? '#065f46' : '#991b1b'
                }}
              >
                {resetStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{resetStatus.message}</span>
              </div>
            )}

            <form onSubmit={handlePasswordReset}>
              <div className="input-group reveal reset-modal-input-group">
                <label htmlFor="resetEmailInput">Registered Email Address</label>
                <div className="input-wrapper">
                  <input 
                    id="resetEmailInput"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={role === 'Admin' ? 'Enter your registered administrator email' : 'Enter your registered email address'}
                    required
                    autoFocus
                    disabled={isSendingReset}
                  />
                  <div className="input-focus-border"></div>
                </div>
              </div>

              <div className="reset-actions">
                <button 
                  type="button" 
                  onClick={() => setShowResetModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  disabled={isSendingReset}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isSendingReset ? <Loader2 className="spinner" size={16} /> : <Mail size={16} />}
                  Send Reset Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
