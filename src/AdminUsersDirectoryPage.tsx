import React, { useState, useMemo } from 'react';
import { 
  Users, Briefcase, Search, Plus, X, Shield, Lock, Eye, EyeOff, 
  CheckCircle2, Key, Sliders, CheckSquare, Calendar, CreditCard, 
  Package, FileText, UserCheck, TrendingUp, AlertTriangle, ArrowRight, UserPlus, Phone, Mail, MapPin, Zap, Edit3, Save
} from 'lucide-react';
import PageHero from './components/PageHero';
import { useCRM, defaultDealerFeatures, defaultEmployeeFeatures } from './context/CRMContext';
import { useUI } from './context/UIContext';
import type { Employee, Dealer, DealerFeatures, UserStatus } from './context/CRMContext';
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
    updateUserCredentials,
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

  // Full Edit Profile & Credentials Modal (Admin Master Control)
  const [editModalUser, setEditModalUser] = useState<(Employee | Dealer) | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    employeeCategory: 'Marketing Employee',
    address: '',
    status: 'Active' as UserStatus
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Quick Password Modal
  const [passwordModalUser, setPasswordModalUser] = useState<(Employee | Dealer) | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Password peek tracking on cards
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Add User Form State
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    id: '',
    email: '',
    phone: '',
    address: '',
    password: 'Password123!',
    employeeCategory: 'Marketing Employee',
    status: 'Active' as UserStatus,
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
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.includes(q)) ||
          ((u as any).employeeCategory && (u as any).employeeCategory.toLowerCase().includes(q));
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

  // Toggle Password Card Peek
  const togglePasswordPeek = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Open Full Profile & Credential Edit Modal
  const handleOpenEditModal = (user: Employee | Dealer) => {
    setEditModalUser(user);
    setEditUserForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: (user as any).password || 'Password123!',
      employeeCategory: (user as any).employeeCategory || 'Marketing Employee',
      address: (user as any).address || '',
      status: user.status || 'Active'
    });
    setShowEditPassword(false);
  };

  // Save Full Profile & Credential Changes
  const handleSaveEditCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;

    if (!editUserForm.name.trim() || !editUserForm.email.trim()) {
      showToast('Name and Email are required.', 'error');
      return;
    }

    await updateUserCredentials(editModalUser.id, editModalUser.role as 'Employee' | 'Dealer', {
      name: editUserForm.name.trim(),
      email: editUserForm.email.trim(),
      phone: editUserForm.phone.trim(),
      password: editUserForm.password.trim(),
      employeeCategory: editModalUser.role === 'Employee' ? editUserForm.employeeCategory : undefined,
      address: editModalUser.role === 'Dealer' ? editUserForm.address.trim() : undefined,
      status: editUserForm.status
    });

    addActivity({
      type: 'User Updated',
      message: `Admin updated account profile, credentials & role info for ${editUserForm.name} (${editModalUser.role})`,
      user: currentUser?.name || 'Admin'
    });

    showToast(`✓ Updated profile & credentials for ${editUserForm.name}!`, 'success');
    setEditModalUser(null);
  };

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
        employeeCategory: newUserForm.employeeCategory,
        features: { ...defaultEmployeeFeatures },
        password: newUserForm.password || 'Password123!'
      });
      showToast(`✓ Employee ${newUserForm.name} created successfully (${newUserForm.employeeCategory})!`, 'success');
    }

    setIsAddUserModalOpen(false);
    setNewUserForm({
      name: '', id: '', email: '', phone: '', address: '', password: 'Password123!', employeeCategory: 'Marketing Employee', status: 'Active', dealerId: ''
    });
  };

  return (
    <div className="users-hub-container" style={{ padding: 0 }}>
      <PageHero
        badge="Master Directory & Access Security"
        icon={<Users size={26} />}
        title="Employees & Dealers Directory"
        subtitle="Admin Master Rights: View/edit credentials, usernames, email IDs, passwords, roles, and module access permissions."
        actions={
          <button className="btn-hero-primary" onClick={() => setIsAddUserModalOpen(true)}>
            <UserPlus size={18} /> Add Employee / Dealer
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
              <span className="kpi-lbl">Total Directory</span>
            </div>
          </div>
          <div className="users-kpi-card" onClick={() => setActiveSegment('employees')}>
            <div className="kpi-icon-box purple"><UserCheck size={20} /></div>
            <div>
              <span className="kpi-val">{metrics.totalStaff}</span>
              <span className="kpi-lbl">Staff & Engineers</span>
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
              Employees ({metrics.totalStaff})
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
                id="adminUsersSearch"
                name="adminUsersSearch"
                type="text" 
                placeholder="Search name, ID, email, role..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}><X size={14}/></button>
              )}
            </div>

            <select 
              id="adminUsersStatusFilter"
              name="adminUsersStatusFilter"
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
            const isRevealed = !!revealedPasswords[user.id];
            const empCat = (user as any).employeeCategory || (isDealer ? 'Authorized Dealer' : 'Staff');

            return (
              <div key={`${user.role}-${user.id}`} className={`user-hub-card ${user.status === 'Inactive' ? 'inactive' : ''}`}>
                <div className="card-top-row">
                  <div className="user-avatar-stack">
                    <div className={`user-hub-avatar ${isDealer ? 'dealer-avatar' : 'employee-avatar'}`}>
                      {user.initials || user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="user-hub-name">{user.name}</h4>
                      <div className="user-id-role-row">
                        <span className="user-hub-id">{user.id}</span>
                        {!isDealer && empCat && (
                          <span className="emp-category-pill">{empCat}</span>
                        )}
                      </div>
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

                {/* Contact & Credential details */}
                <div className="user-contact-row">
                  <div className="contact-item"><Mail size={14}/> <span>{user.email || 'No email registered'}</span></div>
                  <div className="contact-item"><Phone size={14}/> <span>{user.phone || 'No phone registered'}</span></div>
                  {isDealer && user.address && (
                    <div className="contact-item"><MapPin size={14}/> <span>{user.address}</span></div>
                  )}
                </div>

                {/* Admin Password Peek Box */}
                <div className="card-credential-box">
                  <div className="cred-lbl-stack">
                    <Lock size={13} color="#0284c7" />
                    <span className="cred-lbl">Login Password:</span>
                  </div>
                  <div className="cred-val-stack">
                    <code className="cred-pass-code">
                      {isRevealed ? currentPass : '••••••••••••'}
                    </code>
                    <button 
                      type="button" 
                      className="cred-eye-btn" 
                      onClick={() => togglePasswordPeek(user.id)}
                      title={isRevealed ? 'Hide Password' : 'Show Password'}
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Approved Features Snapshot */}
                <div className="features-snapshot-section">
                  <div className="features-header-row">
                    <span className="features-title">Portal Modules ({activeFeatureCount})</span>
                    <button 
                      className="btn-feature-manage" 
                      onClick={() => handleOpenFeatures(user)}
                    >
                      <Sliders size={13} /> Permissions
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
                  <button 
                    className="action-btn edit-btn"
                    onClick={() => handleOpenEditModal(user)}
                    title="Edit Name, Email, Password & Role"
                  >
                    <Edit3 size={15} /> Edit Info & Pass
                  </button>

                  <button 
                    className="action-btn permissions-btn"
                    onClick={() => handleOpenFeatures(user)}
                    title="Configure module feature permissions"
                  >
                    <Sliders size={15} /> Modules
                  </button>

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

      {/* --- MASTER MODAL: EDIT USER PROFILE & CREDENTIALS --- */}
      {editModalUser && (
        <div className="modal-overlay" onClick={() => setEditModalUser(null)}>
          <div className="modal-card users-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-stack">
                <Shield size={22} className="text-blue" />
                <div>
                  <h3>Admin Master Control: Edit User Profile</h3>
                  <p className="modal-sub">
                    Directly update login email, username, password, role category, and phone for <strong>{editModalUser.name}</strong> ({editModalUser.id}).
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setEditModalUser(null)}><X size={20}/></button>
            </div>

            <form onSubmit={handleSaveEditCredentials} className="edit-user-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="editUserName">Full Name / Display Name *</label>
                  <input 
                    id="editUserName"
                    name="editUserName"
                    type="text" 
                    required 
                    value={editUserForm.name}
                    onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="editUserEmail">Login Email Address *</label>
                  <input 
                    id="editUserEmail"
                    name="editUserEmail"
                    type="email" 
                    required 
                    value={editUserForm.email}
                    onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="editUserPhone">Phone Number</label>
                  <input 
                    id="editUserPhone"
                    name="editUserPhone"
                    type="tel" 
                    value={editUserForm.phone}
                    onChange={e => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="editUserStatus">Account Status</label>
                  <select 
                    id="editUserStatus"
                    name="editUserStatus"
                    value={editUserForm.status}
                    onChange={e => setEditUserForm({ ...editUserForm, status: e.target.value as UserStatus })}
                  >
                    <option value="Active">Active (Full Access)</option>
                    <option value="Inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              {/* Password Direct Edit */}
              <div className="form-group credential-edit-group">
                <label htmlFor="editUserPassword">Login Password (Admin Editable)</label>
                <div className="pass-input-row">
                  <input 
                    id="editUserPassword"
                    name="editUserPassword"
                    type={showEditPassword ? 'text' : 'password'}
                    required 
                    value={editUserForm.password}
                    onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })}
                    placeholder="Enter login password"
                  />
                  <button 
                    type="button" 
                    className="pass-reveal-btn"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{showEditPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <span className="form-helper-text">
                  🔒 Only administrators have master permissions to view or change this user's login password.
                </span>
              </div>

              {/* Employee Category Selection */}
              {editModalUser.role === 'Employee' && (
                <div className="form-group">
                  <label htmlFor="editUserEmployeeCategory">Employee Operational Category / Role</label>
                  <select 
                    id="editUserEmployeeCategory"
                    name="editUserEmployeeCategory"
                    value={editUserForm.employeeCategory}
                    onChange={e => setEditUserForm({ ...editUserForm, employeeCategory: e.target.value })}
                  >
                    <option value="Marketing Employee">Marketing Employee (Leads, Quotations, Field Surveys)</option>
                    <option value="Stock Incharge">Stock Incharge (Warehouse, Stock Dispatch, Inventory)</option>
                    <option value="PM Surya Ghar Incharge">PM Surya Ghar Incharge (Subsidy Workflows, PM Portal, Lead Execution)</option>
                    <option value="Field Service Engineer">Field Service Engineer</option>
                  </select>
                </div>
              )}

              {/* Dealer Address */}
              {editModalUser.role === 'Dealer' && (
                <div className="form-group">
                  <label htmlFor="editUserAddress">Dealership Location / Address</label>
                  <input 
                    id="editUserAddress"
                    name="editUserAddress"
                    type="text" 
                    value={editUserForm.address}
                    onChange={e => setEditUserForm({ ...editUserForm, address: e.target.value })}
                    placeholder="City, State, Region"
                  />
                </div>
              )}

              <div className="modal-actions-row">
                <button type="button" className="btn-cancel" onClick={() => setEditModalUser(null)}>Cancel</button>
                <button type="submit" className="btn-save-primary">
                  <Save size={16} /> Save Changes & Update Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: FEATURE APPROVAL & ACCESS CONTROL --- */}
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
                  Company Staff / Field Engineer
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
                  <label htmlFor="newUserName">{addUserType === 'Dealer' ? 'Dealership Name *' : 'Full Name *'}</label>
                  <input 
                    id="newUserName"
                    name="newUserName"
                    type="text" 
                    required 
                    placeholder={addUserType === 'Dealer' ? 'e.g. Sri Balaji Solar' : 'e.g. Rajesh Kumar'} 
                    value={newUserForm.name}
                    onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newUserId">{addUserType === 'Dealer' ? 'Dealer ID *' : 'Employee ID *'}</label>
                  <input 
                    id="newUserId"
                    name="newUserId"
                    type="text" 
                    required 
                    placeholder={addUserType === 'Dealer' ? 'e.g. DLR-101' : 'e.g. EMP-101'} 
                    value={newUserForm.id}
                    onChange={e => setNewUserForm({ ...newUserForm, id: e.target.value })}
                  />
                </div>
              </div>

              {addUserType === 'Employee' && (
                <div className="form-group">
                  <label htmlFor="newUserEmployeeCategory">Employee Category / Functional Role *</label>
                  <select 
                    id="newUserEmployeeCategory"
                    name="newUserEmployeeCategory"
                    value={newUserForm.employeeCategory}
                    onChange={e => setNewUserForm({ ...newUserForm, employeeCategory: e.target.value })}
                  >
                    <option value="Marketing Employee">Marketing Employee (Leads, Quotations, Follow-ups)</option>
                    <option value="Stock Incharge">Stock Incharge (Warehouse, Stock Movements, Inventory)</option>
                    <option value="PM Surya Ghar Incharge">PM Surya Ghar Incharge (Full Subsidy Workflows & Pipeline)</option>
                    <option value="Field Service Engineer">Field Service Engineer</option>
                  </select>
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="newUserEmail">Login Email Address</label>
                  <input 
                    id="newUserEmail"
                    name="newUserEmail"
                    type="email" 
                    placeholder={addUserType === 'Dealer' ? 'dealer@mirrorsolar.in' : 'name@mirrorsolar.in'} 
                    value={newUserForm.email}
                    onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newUserPhone">Phone Number</label>
                  <input 
                    id="newUserPhone"
                    name="newUserPhone"
                    type="tel" 
                    placeholder="+91 98765 43210" 
                    value={newUserForm.phone}
                    onChange={e => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newUserPassword">Initial Login Password *</label>
                <input 
                  id="newUserPassword"
                  name="newUserPassword"
                  type="text" 
                  required 
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                />
              </div>

              {addUserType === 'Dealer' && (
                <div className="form-group">
                  <label htmlFor="newUserAddress">Business Address / Location</label>
                  <input 
                    id="newUserAddress"
                    name="newUserAddress"
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
