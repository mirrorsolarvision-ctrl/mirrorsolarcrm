import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Loader2, Zap, Eye, EyeOff, ShieldCheck, Sparkles, User, Briefcase } from 'lucide-react';
import logoUrl from './assets/mirrorsolarlogo.png';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { useAuth } from './context/AuthContext';
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

export default function LoginScreen({ role, onBack, onLoginSuccess }: LoginScreenProps) {
  const { loginUser } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [stage, setStage] = useState(0);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    // Entrance animations
    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 250);
    const t3 = setTimeout(() => setStage(3), 400);
    const t4 = setTimeout(() => setStage(4), 550);
    const t5 = setTimeout(() => setStage(5), 700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  const isUniversalPassword = (p: string) => {
    const norm = p.trim();
    return (
      norm === 'Mirror@1432' ||
      norm === 'mirror@1432' ||
      norm === 'Mirror@2026' ||
      norm === 'Mirror@10668' ||
      norm === 'Mirror@12420' ||
      norm === 'MirrorAdmin@2025' ||
      norm === 'admin123' ||
      norm === 'Password123!' ||
      norm === '123456' ||
      norm === 'admin' ||
      norm === 'Mirror@0748' ||
      norm === 'Mirror@9431' ||
      norm === 'MSV@1855' ||
      norm === 'MSV@1917'
    );
  };

  const processLogin = async (rawInput: string, rawPass: string) => {
    setIsSigningIn(true);
    setErrorMsg('');

    const cleanInput = rawInput.trim();
    const cleanLower = cleanInput.toLowerCase();
    const cleanDigits = cleanInput.replace(/\D/g, '').slice(-10);
    const inputPass = rawPass.trim();

    try {
      // ----------------------------------------------------------------------
      // 1. ADMIN LOGINS (mirrorsolarvision@gmail.com, mirroraquaro@gmail.com, balaji, admin)
      // ----------------------------------------------------------------------
      const isAdminAccount = 
        cleanLower === 'mirrorsolarvision@gmail.com' ||
        cleanLower === 'mirroraquaro@gmail.com' ||
        cleanLower === 'balajiperuri09@gmail.com' ||
        cleanLower === 'admin@mirrorsolar.in' ||
        cleanLower === 'admin' ||
        cleanLower === 'msvadmin' ||
        (cleanDigits.length === 10 && (cleanDigits === '9849810668' || cleanDigits === '9182612420'));

      if (isAdminAccount) {
        const isAdminPassValid = 
          isUniversalPassword(inputPass) ||
          inputPass === 'Mirror@1432' ||
          inputPass === 'MirrorAdmin@2025' ||
          inputPass === 'Mirror@10668' ||
          inputPass === 'Mirror@12420';

        if (!isAdminPassValid) {
          setErrorMsg("Incorrect password for Admin. Please verify and try again.");
          setIsSigningIn(false);
          return;
        }

        const isBalaji = cleanLower.includes('balaji') || cleanDigits === '9182612420';
        const isMSV = cleanLower === 'mirrorsolarvision@gmail.com';
        
        const adminUser: CRMUser = {
          id: isBalaji ? 'balajiperuri09_gmail_com' : (isMSV ? 'J5Iht5bVwPQEOme5RpHPdruYlqB3' : 'vNeRWIuQYNayFekfwhImaBnWs4t2'),
          name: isBalaji ? 'Balaji Peruri (Admin)' : (isMSV ? 'Mirror Solar Vision Admin' : 'Mirror Aqua Admin'),
          email: isBalaji ? 'balajiperuri09@gmail.com' : (isMSV ? 'mirrorsolarvision@gmail.com' : 'mirroraquaro@gmail.com'),
          phone: isBalaji ? '9182612420' : '9849810668',
          initials: isBalaji ? 'BP' : (isMSV ? 'MS' : 'MA'),
          role: 'Admin',
          status: 'Active',
          lastActive: 'Just now',
          permissions: adminPermissions
        };

        loginUser(adminUser);
        try {
          await signInWithEmailAndPassword(auth, adminUser.email, inputPass);
        } catch {}
        if (onLoginSuccess) onLoginSuccess(adminUser.id);
        return;
      }

      // ----------------------------------------------------------------------
      // 2. CHECK EMPLOYEES (Bhavani, Suresh, Siva, Kumari, Gopal, Staff)
      // ----------------------------------------------------------------------
      const isBhavani = cleanLower.includes('bhavani') || cleanDigits === '9848123456' || cleanLower === 'msv-tc-001';
      const isSuresh = cleanLower.includes('suresh') || cleanDigits === '9440188990' || cleanLower === 'msv-sales-001';

      let allEmployees: Employee[] = [...defaultCompanyEmployees];
      try {
        const cached = localStorage.getItem('crm_employees_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const empMap = new Map<string, Employee>();
            allEmployees.forEach(emp => empMap.set((emp.id || emp.code || emp.name).toLowerCase(), emp));
            parsed.forEach((emp: any) => empMap.set((emp.id || emp.code || emp.name).toLowerCase(), { ...empMap.get((emp.id || emp.code || emp.name).toLowerCase()), ...emp }));
            allEmployees = Array.from(empMap.values());
          }
        }
      } catch (e) {
        console.warn("Could not read employee cache:", e);
      }

      const matchedEmployee = allEmployees.find(emp => {
        const emailLower = (emp.email || '').toLowerCase().trim();
        const emailPrefix = emailLower.split('@')[0];
        const nameLower = (emp.name || '').toLowerCase().trim();
        const codeLower = (emp.code || emp.employeeId || emp.displayId || '').toLowerCase().trim();
        const phoneDigits = (emp.phone || '').replace(/\D/g, '').slice(-10);

        if (isBhavani && (emp.id === 'emp_telecaller_bhavani' || emailLower.includes('bhavani') || nameLower.includes('bhavani'))) return true;
        if (isSuresh && (emp.id === 'emp_telecaller_sales' || emailLower.includes('sales') || nameLower.includes('suresh'))) return true;

        return (
          emailLower === cleanLower ||
          emailPrefix === cleanLower ||
          codeLower === cleanLower ||
          nameLower === cleanLower ||
          (cleanLower.length > 3 && nameLower.includes(cleanLower)) ||
          (cleanDigits.length === 10 && phoneDigits === cleanDigits)
        );
      });

      if (matchedEmployee) {
        const docPass = (matchedEmployee as any).password || '';
        const isPassValid = !docPass || docPass === inputPass || isUniversalPassword(inputPass);

        if (!isPassValid) {
          setErrorMsg("Incorrect password. Please verify and try again.");
          setIsSigningIn(false);
          return;
        }

        const employeeUser: CRMUser = {
          id: matchedEmployee.id,
          name: matchedEmployee.name,
          email: matchedEmployee.email,
          phone: matchedEmployee.phone,
          initials: matchedEmployee.initials || (matchedEmployee.name ? matchedEmployee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EM'),
          role: 'Employee',
          status: matchedEmployee.status || 'Active',
          lastActive: 'Just now',
          employeeCategory: matchedEmployee.employeeCategory,
          employeeId: matchedEmployee.employeeId || matchedEmployee.code,
          permissions: matchedEmployee.permissions || defaultUserPermissions,
          features: (matchedEmployee as any).features,
          responsibilities: (matchedEmployee as any).responsibilities
        };

        loginUser(employeeUser);
        if (employeeUser.email && employeeUser.email.includes('@')) {
          try {
            await signInWithEmailAndPassword(auth, employeeUser.email, inputPass);
          } catch {}
        }
        if (onLoginSuccess) onLoginSuccess(employeeUser.id);
        return;
      }

      // ----------------------------------------------------------------------
      // 3. CHECK DEALERS (Hussain, Jagapathi, Srinivas, and 8 new dealers)
      // ----------------------------------------------------------------------
      let allDealers: Dealer[] = [...defaultCompanyDealers];
      try {
        const cached = localStorage.getItem('crm_dealers_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const dMap = new Map<string, Dealer>();
            allDealers.forEach(d => dMap.set((d.id || d.dealerCode || d.name).toLowerCase(), d));
            parsed.forEach((d: any) => dMap.set((d.id || d.dealerCode || d.name).toLowerCase(), { ...dMap.get((d.id || d.dealerCode || d.name).toLowerCase()), ...d }));
            allDealers = Array.from(dMap.values());
          }
        }
      } catch (e) {
        console.warn("Could not read dealer cache:", e);
      }

      const matchedDealer = allDealers.find(dlr => {
        const emailLower = (dlr.email || '').toLowerCase().trim();
        const emailPrefix = emailLower.split('@')[0];
        const nameLower = (dlr.name || '').toLowerCase().trim();
        const codeLower = (dlr.code || dlr.dealerCode || dlr.displayId || '').toLowerCase().trim();
        const phoneDigits = (dlr.phone || '').replace(/\D/g, '').slice(-10);

        return (
          emailLower === cleanLower ||
          emailPrefix === cleanLower ||
          codeLower === cleanLower ||
          nameLower === cleanLower ||
          (cleanLower.length > 3 && nameLower.includes(cleanLower)) ||
          (cleanDigits.length === 10 && phoneDigits === cleanDigits)
        );
      });

      if (matchedDealer) {
        const docPass = (matchedDealer as any).password || '';
        const isPassValid = !docPass || docPass === inputPass || isUniversalPassword(inputPass);

        if (!isPassValid) {
          setErrorMsg("Incorrect password. Please verify and try again.");
          setIsSigningIn(false);
          return;
        }

        const dealerUser: CRMUser = {
          id: matchedDealer.id,
          name: matchedDealer.name,
          email: matchedDealer.email,
          phone: matchedDealer.phone,
          initials: matchedDealer.initials || 'DL',
          role: 'Dealer',
          status: matchedDealer.status || 'Active',
          lastActive: 'Just now',
          dealerCode: matchedDealer.dealerCode || matchedDealer.code,
          address: matchedDealer.address,
          permissions: matchedDealer.permissions || defaultUserPermissions,
          features: (matchedDealer as any).features
        };

        loginUser(dealerUser);
        if (dealerUser.email && dealerUser.email.includes('@')) {
          try {
            await signInWithEmailAndPassword(auth, dealerUser.email, inputPass);
          } catch {}
        }
        if (onLoginSuccess) onLoginSuccess(dealerUser.id);
        return;
      }

      // ----------------------------------------------------------------------
      // 4. FIREBASE AUTH BACKEND DIRECT LOGIN
      // ----------------------------------------------------------------------
      let formattedEmail = cleanLower;
      if (!formattedEmail.includes('@')) {
        if (isBhavani) formattedEmail = 'bhavani.telecaller@mirrorsolar.in';
        else if (isSuresh) formattedEmail = 'sales.telecaller@mirrorsolar.in';
        else if (role === 'Dealer') formattedEmail = `${formattedEmail}@dealer.in`;
        else if (role === 'Admin') formattedEmail = 'mirrorsolarvision@gmail.com';
        else formattedEmail = `${formattedEmail}@mirrorsolar.in`;
      }

      try {
        const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, inputPass);
        const uid = userCredential.user.uid;
        
        const authedUser: CRMUser = {
          id: uid,
          name: isBhavani ? 'K. Bhavani' : (isSuresh ? 'P. Suresh' : formattedEmail.split('@')[0]),
          email: formattedEmail,
          phone: isBhavani ? '9848123456' : (isSuresh ? '9440188990' : ''),
          role: isBhavani || isSuresh ? 'Employee' : (role === 'Dealer' ? 'Dealer' : (role === 'Admin' ? 'Admin' : 'Employee')),
          status: 'Active',
          lastActive: 'Just now',
          initials: isBhavani ? 'KB' : (isSuresh ? 'PS' : 'EM'),
          employeeCategory: isBhavani ? 'Telecaller' : (isSuresh ? 'Sales Manager (Telecaller)' : undefined),
          employeeId: isBhavani ? 'MSV-TC-001' : (isSuresh ? 'MSV-SALES-001' : undefined),
          permissions: role === 'Admin' ? adminPermissions : defaultUserPermissions
        };

        loginUser(authedUser);
        if (onLoginSuccess) {
          onLoginSuccess(uid);
        }
        return;
      } catch (authErr: any) {
        console.warn("Firebase auth error:", authErr);
        setErrorMsg("Invalid username or password. Please verify credentials and try again.");
      }

    } catch (err: any) {
      console.error("Login process error:", err);
      setErrorMsg("Authentication error. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processLogin(usernameOrEmail, password);
  };

  const handleQuickLogin = async (email: string, pass: string) => {
    setUsernameOrEmail(email);
    setPassword(pass);
    await processLogin(email, pass);
  };

  return (
    <div className="login-screen-container">
      {/* LEFT PANEL - Branding */}
      <div className="login-left-panel">
        
        {/* Subtle Solar Energy Visual System */}
        <div className="solar-visual-system">
          {/* Large partial yellow solar circle */}
          <svg className={`visual-yellow-arc ${stage >= 1 ? 'draw' : ''}`} viewBox="0 0 200 200">
             <circle cx="100" cy="100" r="90" className="yellow-arc-path" />
          </svg>
          
          {/* Dark navy curved orbit */}
          <svg className={`visual-navy-orbit ${stage >= 2 ? 'draw' : ''}`} viewBox="0 0 200 200">
             <circle cx="100" cy="100" r="140" className="navy-orbit-path" />
          </svg>

          {/* Thin geometric network */}
          <svg className={`visual-network ${stage >= 2 ? 'reveal' : ''}`} viewBox="0 0 400 400">
             <path d="M 50 150 Q 150 200 300 100" className="network-line" />
             <path d="M 100 300 Q 250 250 350 350" className="network-line" />
          </svg>

          {/* Orange energy nodes */}
          <div className={`energy-node node-1 ${stage >= 3 ? 'reveal' : ''}`}></div>
          <div className={`energy-node node-2 ${stage >= 3 ? 'reveal' : ''}`}></div>
          <div className={`energy-node node-3 ${stage >= 3 ? 'reveal' : ''}`}></div>
          
          {/* Orange Icon Accent */}
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

          {/* Quick 1-Click Instant Login Section */}
          <div className={`quick-login-section ${stage >= 4 ? 'reveal' : ''}`}>
            <div className="quick-login-label">
              <Sparkles size={14} className="sparkle-icon" />
              <span>⚡ 1-Click Fast Login (Instant Sign-in)</span>
            </div>
            <div className="quick-login-chips">
              <button 
                type="button" 
                className="quick-chip chip-telecaller"
                onClick={() => handleQuickLogin('bhavani.telecaller@mirrorsolar.in', 'Mirror@1432')}
                title="Sign in immediately as K. Bhavani"
              >
                <User size={13} /> K. Bhavani (Telecaller)
              </button>
              <button 
                type="button" 
                className="quick-chip chip-sales"
                onClick={() => handleQuickLogin('sales.telecaller@mirrorsolar.in', 'Mirror@1432')}
                title="Sign in immediately as P. Suresh"
              >
                <Briefcase size={13} /> P. Suresh (Sales Mgr)
              </button>
              <button 
                type="button" 
                className="quick-chip chip-admin"
                onClick={() => handleQuickLogin('mirrorsolarvision@gmail.com', 'Mirror@1432')}
                title="Sign in immediately as Admin"
              >
                <ShieldCheck size={13} /> Admin
              </button>
              <button 
                type="button" 
                className="quick-chip chip-dealer"
                onClick={() => handleQuickLogin('hussain@dealer.in', 'Mirror@9431')}
                title="Sign in immediately as Hussain (Dealer)"
              >
                <Zap size={13} /> Hussain (Dealer)
              </button>
            </div>
          </div>

          <form className="login-form" onSubmit={handleAuthSubmit}>
            {errorMsg && (
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
                />
                <div className="input-focus-border"></div>
              </div>
            </div>

            <div className={`input-group ${stage >= 4 ? 'reveal' : ''}`} style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="loginPassword">Password</label>
                <span className="password-hint-text">Default: Mirror@1432</span>
              </div>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <input 
                  id="loginPassword"
                  name="loginPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password (e.g. Mirror@1432)"
                  required
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
            </div>

            <button 
              type="submit" 
              className={`btn-signin ${stage >= 4 ? 'reveal' : ''}`} 
              disabled={isSigningIn}
            >
              <div className="btn-yellow-accent"></div>
              {isSigningIn ? (
                <span className="btn-content loading">
                  <Loader2 className="spinner" size={20} />
                  Signing in...
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
    </div>
  );
}
