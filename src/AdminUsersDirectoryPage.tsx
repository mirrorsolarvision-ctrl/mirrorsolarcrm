import React, { useState, useMemo } from 'react';
import { 
  Users, Briefcase, Search, Plus, X, Shield, Lock, Eye, EyeOff, 
  CheckCircle2, Key, Sliders, CheckSquare, Calendar, CreditCard, 
  Package, FileText, UserCheck, TrendingUp, AlertTriangle, ArrowRight, UserPlus, Phone, Mail, MapPin, Zap
} from 'lucide-react';
import PageHero from './components/PageHero';
import { useCRM, defaultDealerFeatures, defaultEmployeeFeatures } from './context/CRMContext';
import { useUI } from './context/UIContext';
import type { Employee, Dealer, DealerFeatures } from './context/CRMContext';
import { DEALER_TARGET_KW } from './utils/dealerCalculations';
import './AdminUsersDirectoryPage.css';

interface AdminUsersDirectoryPageProps {
  onNavigateToLeads?: (dealerOrEmpName: string) => void;
}

export default function AdminUsersDirectoryPage({ onNavigateToLeads }: AdminUsersDirectoryPageProps) {
  const { 
    employees, 
    dealers, 
    addEmployee, 
    addDealer, 
    updateEmployee, 
    updateDealer, 
    updateUserFeatures, 
    updateUserPassword,
    addActivity, 
    currentUser 
  } = useCRM();
  const { showToast, showConfirmModal } = useUI();

  // Active Segment: 'all' | 'employees' | 'dealers'
  const [activeSegment, setActiveSegment] = useState<'all' | 'employees' | 'dealers'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addUserType, setAddUserType] = useState<'Employee' | 'Dealer'>('Employee');
  
  // Feature Access Modal
  const [featureModalUser, setFeatureModalUser] = useState<(Employee | Dealer) | null>(null);
  const [featureForm, setFeatureForm] = useState<DealerFeatures>({ ...defaultDealerFeatures });

  // Password Management Modal (Admin Only)
  const [passwordModalUser, setPasswordModalUser] = useState<(Employee | Dealer) | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Add User Form State
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    id: '',
    email: '',
    phone: '',
    address: '',
    password: 'Password123!',
    status: 'Active' as 'Active' | 'Inactive',
    dealerId: ''
  });

  // Combine All Users
  const allUsers = useMemo(() => {
    const empList = employees.map(e => ({ ...e, userType: 'Employee' as const }));
    const dlrList = dealers.map(d => ({ ...d, userType: 'Dealer' as const }));
    return [...empList, ...dlrList];
  }, [employees, dealers]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      if (activeSegment === 'employees' && u.role !== 'Employee') return false;
      if (activeSegment === 'dealers' && u.role !== 'Dealer') return false;
      if (statusFilter !== 'All' && u.status !== statusFilter) return false;

      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches = 
          u.name.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [allUsers, activeSegment, statusFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalStaff = employees.length;
    const totalDealers = dealers.length;
    const activeTotal = allUsers.filter(u => u.status === 'Active').length;
    const targetQuota = totalDealers * DEALER_TARGET_KW;
    return { totalStaff, totalDealers, activeTotal, targetQuota };
  }, [employees, dealers, allUsers]);

  // Open Feature Approval Modal
  const handleOpenFeatures = (user: Employee | Dealer) => {
    setFeatureModalUser(user);
    const defaults = user.role === 'Dealer' ? defaultDealerFeatures : defaultEmployeeFeatures;
    setFeatureForm(user.features || { ...defaults });
  };

  const handleSaveFeatures = async () => {
    if (!featureModalUser) return;
    await updateUserFeatures(featureModalUser.id, featureModalUser.role as 'Employee' | 'Dealer', featureForm);
    addActivity({
      type: 'Permissions Updated',
      message: `Admin updated portal module permissions for ${featureModalUser.name} (${featureModalUser.role})`,
      user: currentUser?.name || 'Admin',
      dealer: featureModalUser.role === 'Dealer' ? featureModalUser.name : undefined
    });
    showToast(`✓ Module access features updated for ${featureModalUser.name}!`, 'success');
    setFeatureModalUser(null);
  };

  // Open Password Modal
  const handleOpenPasswordModal = (user: Employee | Dealer) => {
    setPasswordModalUser(user);
    setShowCurrentPassword(false);
    setNewPasswordInput('');
  };

  const handleSavePassword = async () => {
    if (!passwordModalUser || !newPasswordInput.trim()) {
      showToast('Please enter a valid new password.', 'error');
      return;
    }
    await updateUserPassword(passwordModalUser.id, passwordModalUser.role as 'Employee' | 'Dealer', newPasswordInput.trim());
    addActivity({
      type: 'Password Reset',
      message: `Admin securely updated password for ${passwordModalUser.name}`,
      user: currentUser?.name || 'Admin'
    });
    showToast(`✓ Password securely updated for ${passwordModalUser.name}!`, 'success');
    setPasswordModalUser(null);
    setNewPasswordInput('');
  };

  // Toggle Status
  const handleToggleStatus = (user: Employee | Dealer) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    showConfirmModal(
      `${newStatus === 'Active' ? 'Reactivate' : 'Deactivate'} User Account`,
      `Are you sure you want to mark ${user.name} (${user.role}) as ${newStatus}?`,
      () => {
        if (user.role === 'Dealer') {
          updateDealer(user.id, { status: newStatus as any });
        } else {
          updateEmployee(user.id, { status: newStatus as any });
        }
        showToast(`${user.name} is now ${newStatus}.`, 'info');
      }
    );
  };

  // Handle Add User Submit
  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.id) {
      showToast('Name and ID are required.', 'error');
      return;
    }

    if (addUserType === 'Dealer') {
      addDealer({
        name: newUserForm.name,
        email: newUserForm.email || `${newUserForm.name.toLowerCase().replace(/\s+/g, '')}@dealer.in`,
        phone: newUserForm.phone || '+91 98765 00000',
        address: newUserForm.address || 'Solar Business Hub',
        status: newUserForm.status,
        lastActive: 'Just now',
        initials: newUserForm.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        features: { ...defaultDealerFeatures },
        password: newUserForm.password || 'Password123!'
      });
      showToast(`✓ Dealer ${newUserForm.name} created with 225 kW 18-month target quota!`, 'success');
    } else {
      addEmployee({
        name: newUserForm.name,
        email: newUserForm.email || `${newUserForm.name.toLowerCase().replace(/\s+/g, '')}@mirrorsolar.in`,
        phone: newUserForm.phone || '+91 98765 00000',
        status: newUserForm.status,
        lastActive: 'Just now',
        initials: newUserForm.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        dealerId: newUserForm.dealerId || null,
        features: { ...defaultEmployeeFeatures },
        password: newUserForm.password || 'Password123!'
      });
      showToast(`✓ Employee ${newUserForm.name} created successfully!`, 'success');
    }

    setIsAddUserModalOpen(false);
    setNewUserForm({
      name: '', id: '', email: '', phone: '', address: '', password: 'Password123!', status: 'Active', dealerId: ''
    });
  };

  return (
    <div className="users-hub-container" style={{ padding: 0 }}>
      <PageHero
        badge="Unified Administration Hub"
        icon={<Users size={26} />}
        title="Team & Dealer Access Management"
        subtitle="Control portal module features, manage accounts, track dealership targets, and secure credentials in one place."
        actions={
          <button className="btn-hero-primary" onClick={() => setIsAddUserModalOpen(true)}>
            <UserPlus size={18} /> Add Employee or Dealer
          </button>
        }
      />

      <div className="users-hub-body">
        
        {/* KPI Metrics Summary Grid */}
        <div className="users-kpi-grid">
          <div className="users-kpi-card" onClick={() => setActiveSegment('all')}>
            <div className="kpi-icon-box blue"><Users size={20} /></div>
            <div>
              <span className="kpi-val">{allUsers.length}</span>
              <span className="kpi-lbl">Total Users</span>
            </div>
          </div>
          <div className="users-kpi-card" onClick={() => setActiveSegment('employees')}>
            <div className="kpi-icon-box purple"><UserCheck size={20} /></div>
            <div>
              <span className="kpi-val">{metrics.totalStaff}</span>
              <span className="kpi-lbl">Employees / Staff</span>
            </div>
          </div>
          <div className="users-kpi-card" onClick={() => setActiveSegment('dealers')}>
            <div className="kpi-icon-box emerald"><Briefcase size={20} /></div>
            <div>
              <span className="kpi-val">{metrics.totalDealers}</span>
              <span className="kpi-lbl">Authorized Dealers</span>
            </div>
          </div>
          <div className="users-kpi-card quota-card" onClick={() => setActiveSegment('dealers')}>
            <div className="kpi-icon-box amber"><Zap size={20} /></div>
            <div>
              <span className="kpi-val">{metrics.targetQuota} kW</span>
              <span className="kpi-lbl">18M Network Quota</span>
            </div>
          </div>
        </div>

        {/* Filter & Segment Navigation Bar */}
        <div className="users-controls-bar">
          <div className="segment-pills">
            <button 
              className={`segment-btn ${activeSegment === 'all' ? 'active' : ''}`}
              onClick={() => setActiveSegment('all')}
            >
              All Directory ({allUsers.length})
            </button>
            <button 
              className={`segment-btn ${activeSegment === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveSegment('employees')}
            >
              Staff & Field Engineers ({metrics.totalStaff})
            </button>
            <button 
              className={`segment-btn ${activeSegment === 'dealers' ? 'active' : ''}`}
              onClick={() => setActiveSegment('dealers')}
            >
              Dealers ({metrics.totalDealers})
            </button>
          </div>

          <div className="controls-right">
            <div className="users-search-box">
              <Search size={16} color="#64748b" />
              <input 
                type="text" 
                placeholder="Search by name, ID, phone..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}><X size={14}/></button>
              )}
            </div>

            <select 
              className="users-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* User Directory Cards Grid */}
        <div className="users-cards-grid">
          {filteredUsers.map(user => {
            const isDealer = user.role === 'Dealer';
            const userFeatures: DealerFeatures = user.features || (isDealer ? defaultDealerFeatures : defaultEmployeeFeatures);
            const activeFeatureCount = Object.values(userFeatures).filter(Boolean).length;
            const currentPass = (user as any).password || 'Password123!';

            return (
              <div key={`${user.role}-${user.id}`} className={`user-hub-card ${user.status === 'Inactive' ? 'inactive' : ''}`}>
                <div className="card-top-row">
                  <div className="user-avatar-stack">
                    <div className={`user-hub-avatar ${isDealer ? 'dealer-avatar' : 'employee-avatar'}`}>
                      {user.initials || user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="user-hub-name">{user.name}</h4>
                      <span className="user-hub-id">{user.id}</span>
                    </div>
                  </div>

                  <div className="user-badges-stack">
                    <span className={`role-pill ${isDealer ? 'role-dealer' : 'role-employee'}`}>
                      {user.role}
                    </span>
                    <span className={`status-pill ${user.status.toLowerCase()}`}>
                      {user.status}
                    </span>
                  </div>
                </div>

                {/* Contact details */}
                <div className="user-contact-row">
                  <div className="contact-item"><Phone size={14}/> <span>{user.phone || 'No phone'}</span></div>
                  <div className="contact-item"><Mail size={14}/> <span>{user.email || 'No email'}</span></div>
                  {isDealer && user.address && (
                    <div className="contact-item"><MapPin size={14}/> <span>{user.address}</span></div>
                  )}
                </div>

                {/* Approved Features Snapshot */}
                <div className="features-snapshot-section">
                  <div className="features-header-row">
                    <span className="features-title">Approved Features ({activeFeatureCount})</span>
                    <button 
                      className="btn-feature-manage" 
                      onClick={() => handleOpenFeatures(user)}
                    >
                      <Sliders size={13} /> Edit Access
                    </button>
                  </div>
                  <div className="features-chips-wrap">
                    {userFeatures.leads && <span className="feat-chip">Leads</span>}
                    {userFeatures.quotations && <span className="feat-chip">Quotations</span>}
                    {userFeatures.attendance && <span className="feat-chip">Attendance</span>}
                    {userFeatures.stock && <span className="feat-chip">Stock</span>}
                    {userFeatures.payments && <span className="feat-chip">Payments</span>}
                    {userFeatures.reports && <span className="feat-chip">Reports</span>}
                    {userFeatures.tasks && <span className="feat-chip">Tasks</span>}
                    {userFeatures.calendar && <span className="feat-chip">Calendar</span>}
                    {isDealer && userFeatures.myEmployees && <span className="feat-chip">My Staff</span>}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="card-actions-footer">
                  {onNavigateToLeads && (
                    <button 
                      className="action-btn leads-btn"
                      onClick={() => onNavigateToLeads(user.name)}
                      title="View assigned leads"
                    >
                      <ArrowRight size={15} /> Leads
                    </button>
                  )}

                  <button 
                    className="action-btn password-btn"
                    onClick={() => handleOpenPasswordModal(user)}
                    title="Manage user login password"
                  >
                    <Key size={15} /> Password
                  </button>

                  <button 
                    className="action-btn permissions-btn"
                    onClick={() => handleOpenFeatures(user)}
                    title="Configure module feature permissions"
                  >
                    <Sliders size={15} /> Module Access
                  </button>

                  <button 
                    className={`action-btn toggle-btn ${user.status === 'Active' ? 'deactivate' : 'reactivate'}`}
                    onClick={() => handleToggleStatus(user)}
                  >
                    {user.status === 'Active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="empty-users-box">
              <Users size={48} color="#94a3b8" />
              <h3>No users found</h3>
              <p>Try adjusting your search criteria or switch active filter segment.</p>
            </div>
          )}
        </div>

      </div>

      {/* --- MODAL 1: FEATURE APPROVAL & ACCESS CONTROL --- */}
      {featureModalUser && (
        <div className="modal-overlay" onClick={() => setFeatureModalUser(null)}>
          <div className="modal-card users-feature-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-stack">
                <Sliders size={20} className="text-blue" />
                <div>
                  <h3>Module & Feature Access Approval</h3>
                  <p className="modal-sub">
                    Grant or restrict portal modules for <strong>{featureModalUser.name}</strong> ({featureModalUser.role}). Only approved features will appear in their portal.
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setFeatureModalUser(null)}><X size={20}/></button>
            </div>

            <div className="features-toggles-list">
              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Quotations</span>
                  <span className="toggle-desc">Generate, amend, and print customer quotations with PM Surya Ghar subsidy rules.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.quotations} 
                  onChange={e => setFeatureForm({ ...featureForm, quotations: e.target.checked })} 
                />
              </label>

              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Customer Leads & Stage Tracking</span>
                  <span className="toggle-desc">View, manage, and progress solar installation leads through project stages.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.leads} 
                  onChange={e => setFeatureForm({ ...featureForm, leads: e.target.checked })} 
                />
              </label>

              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Team Attendance & Punch-In</span>
                  <span className="toggle-desc">Mark daily attendance and view work attendance logs.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.attendance} 
                  onChange={e => setFeatureForm({ ...featureForm, attendance: e.target.checked })} 
                />
              </label>

              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Stock & Inventory Management</span>
                  <span className="toggle-desc">Access warehouse stock requests, bulk dispatches, and material consumption ledgers.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.stock} 
                  onChange={e => setFeatureForm({ ...featureForm, stock: e.target.checked })} 
                />
              </label>

              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Finance, Milestones & Payments</span>
                  <span className="toggle-desc">View customer collection records and milestone payout settlement summaries.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.payments} 
                  onChange={e => setFeatureForm({ ...featureForm, payments: e.target.checked })} 
                />
              </label>

              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Reports & Analytics</span>
                  <span className="toggle-desc">View conversion analytics, revenue charts, and performance summaries.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.reports} 
                  onChange={e => setFeatureForm({ ...featureForm, reports: e.target.checked })} 
                />
              </label>

              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Tasks & Action Queue</span>
                  <span className="toggle-desc">Create and complete daily task reminders.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.tasks} 
                  onChange={e => setFeatureForm({ ...featureForm, tasks: e.target.checked })} 
                />
              </label>

              <label className="feature-toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Interactive Calendar</span>
                  <span className="toggle-desc">View scheduled appointments, site surveys, and task dates.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!featureForm.calendar} 
                  onChange={e => setFeatureForm({ ...featureForm, calendar: e.target.checked })} 
                />
              </label>

              {featureModalUser.role === 'Dealer' && (
                <label className="feature-toggle-item">
                  <div className="toggle-info">
                    <span className="toggle-name">My Staff & Dealer Employee Management</span>
                    <span className="toggle-desc">Allow dealership to add, assign, and manage their local staff members.</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={!!featureForm.myEmployees} 
                    onChange={e => setFeatureForm({ ...featureForm, myEmployees: e.target.checked })} 
                  />
                </label>
              )}
            </div>

            <div className="modal-actions-row">
              <button className="btn-cancel" onClick={() => setFeatureModalUser(null)}>Cancel</button>
              <button className="btn-save-primary" onClick={handleSaveFeatures}>Save Approved Features</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADMIN PASSWORD & CREDENTIAL MANAGEMENT --- */}
      {passwordModalUser && (
        <div className="modal-overlay" onClick={() => setPasswordModalUser(null)}>
          <div className="modal-card users-password-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-stack">
                <Lock size={20} className="text-amber" />
                <div>
                  <h3>Admin Credential Security</h3>
                  <p className="modal-sub">
                    Only administrators have permission to view or change passwords for <strong>{passwordModalUser.name}</strong>.
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setPasswordModalUser(null)}><X size={20}/></button>
            </div>

            <div className="password-modal-content">
              {/* Current Password Peek Box */}
              <div className="current-password-box">
                <label className="pass-lbl">Registered Login Password:</label>
                <div className="pass-display-row">
                  <span className="pass-val">
                    {showCurrentPassword ? (passwordModalUser.password || 'Password123!') : '••••••••••••'}
                  </span>
                  <button 
                    type="button" 
                    className="btn-eye-toggle"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{showCurrentPassword ? 'Hide' : 'Reveal Password'}</span>
                  </button>
                </div>
              </div>

              {/* Set New Password Input */}
              <div className="new-password-section">
                <label className="pass-lbl">Set New Password for User:</label>
                <input 
                  type="text" 
                  placeholder="Enter new password (e.g. SolarPass2026!)"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  className="new-pass-input"
                />
                <span className="pass-hint">
                  The user will be able to log into their portal immediately with this new password.
                </span>
              </div>
            </div>

            <div className="modal-actions-row">
              <button className="btn-cancel" onClick={() => setPasswordModalUser(null)}>Close</button>
              <button className="btn-save-primary" disabled={!newPasswordInput.trim()} onClick={handleSavePassword}>
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ADD NEW USER MODAL --- */}
      {isAddUserModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddUserModalOpen(false)}>
          <div className="modal-card users-add-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-stack">
                <UserPlus size={20} className="text-blue" />
                <h3>Add New Network User</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsAddUserModalOpen(false)}><X size={20}/></button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="add-user-form">
              <div className="user-type-selector">
                <button 
                  type="button" 
                  className={`type-btn ${addUserType === 'Employee' ? 'active' : ''}`}
                  onClick={() => setAddUserType('Employee')}
                >
                  Company Employee / Staff
                </button>
                <button 
                  type="button" 
                  className={`type-btn ${addUserType === 'Dealer' ? 'active' : ''}`}
                  onClick={() => setAddUserType('Dealer')}
                >
                  Authorized Dealership (225 kW Quota)
                </button>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>{addUserType === 'Dealer' ? 'Dealership Name *' : 'Full Name *'}</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={addUserType === 'Dealer' ? 'e.g. Sri Balaji Solar' : 'e.g. Rajesh Kumar'} 
                    value={newUserForm.name}
                    onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>{addUserType === 'Dealer' ? 'Dealer ID *' : 'Employee ID *'}</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={addUserType === 'Dealer' ? 'e.g. DLR-101' : 'e.g. EMP-101'} 
                    value={newUserForm.id}
                    onChange={e => setNewUserForm({ ...newUserForm, id: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Login Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. name@mirrorsolar.in" 
                    value={newUserForm.email}
                    onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="+91 98765 43210" 
                    value={newUserForm.phone}
                    onChange={e => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Initial Login Password *</label>
                <input 
                  type="text" 
                  required 
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                />
              </div>

              {addUserType === 'Dealer' && (
                <div className="form-group">
                  <label>Business Address / Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Vijayawada, Andhra Pradesh" 
                    value={newUserForm.address}
                    onChange={e => setNewUserForm({ ...newUserForm, address: e.target.value })}
                  />
                </div>
              )}

              <div className="modal-actions-row">
                <button type="button" className="btn-cancel" onClick={() => setIsAddUserModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-save-primary">Create {addUserType}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
