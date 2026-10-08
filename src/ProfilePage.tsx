import React, { useState } from 'react';
import { User, Settings, Bell, Lock, Shield, Mail, Phone, Moon, CheckCircle2 } from 'lucide-react';
import { useCRM } from './context/CRMContext';
import { useUI } from './context/UIContext';
import PageHero from './components/PageHero';
import './SharedProfile.css';

export default function ProfilePage() {
  const { currentUser, leads, updateUserCredentials } = useCRM();
  const { showToast } = useUI();
  
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  // Admin Profile Edit State
  const [adminName, setAdminName] = useState(currentUser?.name || 'Administrator');
  const [adminEmail, setAdminEmail] = useState(currentUser?.email || 'admin@mirrorsolar.in');
  const [adminPhone, setAdminPhone] = useState(currentUser?.phone || '+91 98765 43210');
  
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  const isAdmin = currentUser?.role === 'Admin';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Profile credentials are exclusively managed by Administrator.', 'warning');
      return;
    }
    
    if (currentUser) {
      await updateUserCredentials(currentUser.id, 'Admin', {
        name: adminName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim()
      });
      showToast('Admin profile settings updated successfully', 'success');
    }
  };

  const handlePasswordChange = async () => {
    if (!isAdmin) {
      showToast('Only Administrators can change credentials.', 'warning');
      return;
    }
    if (!newPass.trim()) {
      showToast('Please enter a new password.', 'error');
      return;
    }
    if (currentUser) {
      await updateUserCredentials(currentUser.id, 'Admin', {
        password: newPass.trim()
      });
      showToast('Admin login password updated securely', 'success');
      setNewPass('');
      setCurrentPass('');
    }
  };

  const activeLeads = leads.filter(l => !l.archived && l.stage !== 'Completed').length;

  return (
    <div className="dealer-profile-container" style={{ padding: 0 }}>
      <PageHero
        badge="Account & Security Preferences"
        icon={<User size={26} />}
        title="Profile & Settings"
        subtitle="Manage personal account preferences, notifications, and review credential permissions."
      />

      <div style={{ padding: '1rem 1.25rem 5rem 1.25rem' }}>

      <div className="profile-layout-grid">
        
        {/* Left Column: Avatar Card */}
        <div className="profile-card-left">
          <div className="profile-avatar-wrapper">
            <span className="profile-avatar-text">{currentUser?.initials || currentUser?.name.charAt(0) || 'U'}</span>
          </div>
          <h2 className="profile-name-title">{currentUser?.name || 'User Profile'}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="profile-role-pill">{currentUser?.role || 'Staff'}</span>
            {(currentUser as any)?.employeeCategory && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                {(currentUser as any).employeeCategory}
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>{activeLeads}</span>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>Active Leads</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>Active</span>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>Status</span>
            </div>
          </div>
        </div>

        {/* Right Column: Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Personal Info */}
          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <User className="profile-section-icon" size={20} /> Personal Information
            </h3>
            
            {!isAdmin && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={15} color="#0284c7" />
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                  🔒 Official identity credentials are centrally locked and managed by Administrator.
                </span>
              </div>
            )}

            <form className="premium-form" onSubmit={handleSaveProfile}>
              <div className="premium-input-group">
                <label htmlFor="profileFullName">Full Name / Username</label>
                <input 
                  id="profileFullName"
                  name="profileFullName"
                  type="text" 
                  autoComplete="name"
                  value={isAdmin ? adminName : (currentUser?.name || '')} 
                  disabled={!isAdmin}
                  onChange={e => setAdminName(e.target.value)}
                  style={{ background: !isAdmin ? '#f1f5f9' : '#ffffff', cursor: !isAdmin ? 'not-allowed' : 'text' }}
                />
              </div>
              <div className="premium-input-group">
                <label htmlFor="profileEmail">Official Email ID</label>
                <input 
                  id="profileEmail"
                  name="profileEmail"
                  type="email" 
                  autoComplete="email"
                  value={isAdmin ? adminEmail : (currentUser?.email || '')} 
                  disabled={!isAdmin}
                  onChange={e => setAdminEmail(e.target.value)}
                  style={{ background: !isAdmin ? '#f1f5f9' : '#ffffff', cursor: !isAdmin ? 'not-allowed' : 'text' }}
                />
              </div>
              <div className="premium-input-group">
                <label htmlFor="profilePhone">Contact Phone Number</label>
                <input 
                  id="profilePhone"
                  name="profilePhone"
                  type="tel" 
                  autoComplete="tel"
                  value={isAdmin ? adminPhone : (currentUser?.phone || '')} 
                  disabled={!isAdmin}
                  onChange={e => setAdminPhone(e.target.value)}
                  style={{ background: !isAdmin ? '#f1f5f9' : '#ffffff', cursor: !isAdmin ? 'not-allowed' : 'text' }}
                />
              </div>
              {isAdmin && (
                <button type="submit" className="premium-btn-primary">Save Profile Changes</button>
              )}
            </form>
          </div>

          {/* Preferences */}
          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <Settings className="profile-section-icon" size={20} /> System Preferences
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.9rem' }}>Email Notifications</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Receive instant task and follow-up notifications.</span>
                </div>
                <div 
                  style={{ width: '44px', height: '24px', background: notifications ? '#0284c7' : '#cbd5e1', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                  onClick={() => { setNotifications(!notifications); showToast(notifications ? 'Notifications muted' : 'Notifications enabled', 'info'); }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: notifications ? 'calc(100% - 22px)' : '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.9rem' }}>Dark Interface Mode</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Comfortable dark theme for low light usage.</span>
                </div>
                <div 
                  style={{ width: '44px', height: '24px', background: darkMode ? '#0284c7' : '#cbd5e1', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                  onClick={() => { setDarkMode(!darkMode); showToast('Theme preference updated', 'info'); }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: darkMode ? 'calc(100% - 22px)' : '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <Shield className="profile-section-icon" size={20} /> Security & Password Management
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.9rem' }}>Two-Factor Authentication (2FA)</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Enhanced security protection for sensitive transactions.</span>
              </div>
              <div 
                style={{ width: '44px', height: '24px', background: twoFactor ? '#16a34a' : '#cbd5e1', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                onClick={() => { setTwoFactor(!twoFactor); showToast(twoFactor ? '2FA Disabled' : '2FA Enabled', 'success'); }}
              >
                <div style={{ position: 'absolute', top: '2px', left: twoFactor ? 'calc(100% - 22px)' : '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
              </div>
            </div>

            {isAdmin ? (
              <div className="premium-form" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                <div className="premium-input-group">
                  <label htmlFor="currentPasswordInput">Current Password</label>
                  <input 
                    id="currentPasswordInput"
                    name="currentPasswordInput"
                    type="password" 
                    autoComplete="current-password"
                    placeholder="••••••••" 
                    value={currentPass}
                    onChange={e => setCurrentPass(e.target.value)}
                  />
                </div>
                <div className="premium-input-group">
                  <label htmlFor="newPasswordInput">New Administrator Password</label>
                  <input 
                    id="newPasswordInput"
                    name="newPasswordInput"
                    type="password" 
                    autoComplete="new-password"
                    placeholder="Enter new secure password" 
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                  />
                </div>
                <button type="button" className="premium-btn-primary" onClick={handlePasswordChange}>
                  Update Admin Password
                </button>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', marginTop: '0.5rem', background: '#f8fafc', padding: '1.1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <Lock size={16} color="#0284c7" /> Credentials Managed by Administrator
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                  To maintain strict system compliance and security, staff and dealer passwords can only be configured, viewed, or changed directly by the System Administrator in the Central Directory.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
