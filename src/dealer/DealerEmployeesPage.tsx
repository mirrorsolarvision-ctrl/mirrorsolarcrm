import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  UserCheck, 
  UserX, 
  Mail, 
  Phone, 
  Shield, 
  Calendar,
  X,
  Edit2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import type { Employee } from '../context/CRMContext';
import PageHero from '../components/PageHero';
import './DealerEmployeesPage.css';

export default function DealerEmployeesPage() {
  const { employees, currentUser, addDealerEmployee, updateDealerEmployee, isEmployeePresent } = useCRM();
  const { showToast } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'Active' as 'Active' | 'Inactive'
  });

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Strict isolation: ONLY employees where dealerId === currentUser.id
  const dealerStaff = useMemo(() => {
    if (!currentUser) return [];
    return employees.filter(e => e.dealerId === currentUser.id);
  }, [employees, currentUser]);

  const filteredStaff = useMemo(() => {
    return dealerStaff.filter(emp => {
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.phone.includes(searchQuery);
      
      const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [dealerStaff, searchQuery, statusFilter]);

  // Statistics
  const totalStaff = dealerStaff.length;
  const activeStaff = dealerStaff.filter(e => e.status === 'Active').length;
  const presentToday = dealerStaff.filter(e => isEmployeePresent(e.id, todayIso)).length;

  const handleOpenAddModal = () => {
    setFormData({ name: '', email: '', phone: '', status: 'Active' });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      status: emp.status === 'Active' ? 'Active' : 'Inactive'
    });
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Please enter employee name', 'warning');
      return;
    }
    if (!currentUser) return;

    try {
      const initials = formData.name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'EM';

      await addDealerEmployee(currentUser.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        initials,
        status: formData.status,
        lastActive: 'Just now'
      });

      showToast(`Employee "${formData.name}" added successfully!`, 'success');
      setIsAddModalOpen(false);
    } catch (err) {
      showToast('Failed to add employee', 'error');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !currentUser) return;

    try {
      const initials = formData.name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || editingEmployee.initials;

      await updateDealerEmployee(editingEmployee.id, currentUser.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        initials,
        status: formData.status
      });

      showToast(`Employee "${formData.name}" updated successfully!`, 'success');
      setEditingEmployee(null);
    } catch (err) {
      showToast('Failed to update employee', 'error');
    }
  };

  return (
    <div className="dealer-employees-container">
      {/* Header */}
      <PageHero
        badge="Dealership Workforce"
        icon={<Users size={26} />}
        title="My Team & Employees"
        subtitle="Manage your dealership's staff, daily attendance, and account access."
        actions={
          <button className="btn-hero-primary" onClick={handleOpenAddModal}>
            <Plus size={18} />
            <span>Add New Employee</span>
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="dealer-staff-stats-grid">
        <div className="staff-stat-card">
          <div className="stat-icon-wrap icon-blue">
            <Users size={22} />
          </div>
          <div>
            <span className="stat-number">{totalStaff}</span>
            <span className="stat-label">Total Team Members</span>
          </div>
        </div>

        <div className="staff-stat-card">
          <div className="stat-icon-wrap icon-emerald">
            <UserCheck size={22} />
          </div>
          <div>
            <span className="stat-number">{activeStaff}</span>
            <span className="stat-label">Active Staff</span>
          </div>
        </div>

        <div className="staff-stat-card">
          <div className="stat-icon-wrap icon-amber">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="stat-number">{presentToday}</span>
            <span className="stat-label">Present Today</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="staff-filter-bar">
        <div className="staff-search-input">
          <Search size={18} className="search-icon" />
          <input 
            type="text"
            placeholder="Search by employee name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="staff-status-tabs">
          {(['All', 'Active', 'Inactive'] as const).map(tab => (
            <button
              key={tab}
              className={`status-tab-btn ${statusFilter === tab ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Employee List Table */}
      <div className="dealer-staff-table-card">
        {filteredStaff.length === 0 ? (
          <div className="empty-staff-state">
            <Users size={40} className="empty-icon" />
            <h3>No employees found</h3>
            <p>
              {dealerStaff.length === 0
                ? "You haven't added any employees yet. Click 'Add New Employee' to get started."
                : "No employees match your search criteria."}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="dealer-staff-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Contact Info</th>
                  <th>Status</th>
                  <th>Today's Attendance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(emp => {
                  const isPresent = isEmployeePresent(emp.id, todayIso);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="emp-cell-profile">
                          <div className="emp-avatar">{emp.initials || 'EM'}</div>
                          <div>
                            <span className="emp-name">{emp.name}</span>
                            <span className="emp-id-sub">{emp.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="emp-contact-stack">
                          {emp.email && (
                            <span className="contact-item">
                              <Mail size={13} /> {emp.email}
                            </span>
                          )}
                          {emp.phone && (
                            <span className="contact-item">
                              <Phone size={13} /> {emp.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${emp.status === 'Active' ? 'pill-active' : 'pill-inactive'}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td>
                        {isPresent ? (
                          <span className="attendance-pill-present">
                            <CheckCircle2 size={13} /> Present
                          </span>
                        ) : (
                          <span className="attendance-pill-unmarked">
                            Not Marked
                          </span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="edit-emp-btn"
                          onClick={() => handleOpenEditModal(emp)}
                          title="Edit Employee"
                        >
                          <Edit2 size={16} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Users size={20} className="text-blue" />
                <h3>Add New Team Member</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="modal-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. ramesh@gmail.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="e.g. +91 98765 43210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="modal-overlay" onClick={() => setEditingEmployee(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Edit2 size={20} className="text-blue" />
                <h3>Edit Team Member</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setEditingEmployee(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingEmployee(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
