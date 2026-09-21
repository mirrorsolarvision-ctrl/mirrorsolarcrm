import { useState, useMemo } from 'react';
import { 
  Briefcase, 
  Users, 
  Plus, 
  Search, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  X, 
  Edit2, 
  AlertCircle,
  Layers,
  ChevronRight,
  UserCheck,
  Tag
} from 'lucide-react';
import { useCRM } from './context/CRMContext';
import { useUI } from './context/UIContext';
import type { Employee, Responsibility } from './context/CRMContext';
import './AdminResponsibilitiesPage.css';

export default function AdminResponsibilitiesPage() {
  const { employees, responsibilities, addResponsibility, assignEmployeeResponsibilities } = useCRM();
  const { showToast } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRespFilter, setSelectedRespFilter] = useState<string>('All');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCreateRespModalOpen, setIsCreateRespModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Assignment Form State
  const [primaryRespId, setPrimaryRespId] = useState<string>('');
  const [secondaryRespIds, setSecondaryRespIds] = useState<string[]>([]);
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');

  // Master Create Form State
  const [newRespName, setNewRespName] = useState('');
  const [newRespDesc, setNewRespDesc] = useState('');

  // Strict isolation: Company employees ONLY
  const companyEmployees = useMemo(() => {
    return employees.filter(e => (!e.dealerId || e.dealerId === null) && e.status === 'Active');
  }, [employees]);

  // Responsibility Lookup Map
  const respMap = useMemo(() => {
    const map = new Map<string, Responsibility>();
    responsibilities.forEach(r => map.set(r.id, r));
    return map;
  }, [responsibilities]);

  // Grouped by Primary Responsibility
  const groupedResponsibilities = useMemo(() => {
    const groups: { resp: Responsibility; emps: Employee[] }[] = [];

    responsibilities.forEach(resp => {
      const emps = companyEmployees.filter(e => e.responsibilities?.primaryResponsibilityId === resp.id);
      groups.push({ resp, emps });
    });

    return groups;
  }, [responsibilities, companyEmployees]);

  const unassignedEmployees = useMemo(() => {
    return companyEmployees.filter(e => !e.responsibilities?.primaryResponsibilityId);
  }, [companyEmployees]);

  const filteredEmployees = useMemo(() => {
    return companyEmployees.filter(emp => {
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedRespFilter === 'All') return true;
      if (selectedRespFilter === 'Unassigned') return !emp.responsibilities?.primaryResponsibilityId;
      return emp.responsibilities?.primaryResponsibilityId === selectedRespFilter;
    });
  }, [companyEmployees, searchQuery, selectedRespFilter]);

  const handleOpenAssign = (emp: Employee) => {
    setSelectedEmployee(emp);
    setPrimaryRespId(emp.responsibilities?.primaryResponsibilityId || '');
    setSecondaryRespIds(emp.responsibilities?.secondaryResponsibilityIds || []);
    setAssignmentNotes(emp.responsibilities?.notes || '');
    setIsAssignModalOpen(true);
  };

  const toggleSecondaryId = (id: string) => {
    setSecondaryRespIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    try {
      await assignEmployeeResponsibilities(
        selectedEmployee.id,
        primaryRespId || undefined,
        secondaryRespIds,
        assignmentNotes
      );
      showToast(`Responsibilities updated for ${selectedEmployee.name}`, 'success');
      setIsAssignModalOpen(false);
    } catch (err) {
      showToast('Failed to save responsibilities', 'error');
    }
  };

  const handleCreateResponsibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRespName.trim()) {
      showToast('Please enter a responsibility title', 'warning');
      return;
    }

    try {
      await addResponsibility(newRespName.trim(), newRespDesc.trim());
      showToast(`Added new responsibility: "${newRespName}"`, 'success');
      setNewRespName('');
      setNewRespDesc('');
      setIsCreateRespModalOpen(false);
    } catch (err) {
      showToast('Failed to create responsibility', 'error');
    }
  };

  return (
    <div className="admin-responsibilities-container">
      {/* Header */}
      <div className="responsibilities-header">
        <div>
          <h1 className="page-title">Employee Operational Responsibilities</h1>
          <p className="page-subtitle">Assign primary and secondary functional ownership across company staff</p>
        </div>

        <div className="header-actions-wrap">
          <button className="btn-secondary-action" onClick={() => setIsCreateRespModalOpen(true)}>
            <Plus size={16} />
            <span>Create Master Responsibility</span>
          </button>
        </div>
      </div>

      {/* Unassigned Warning Alert Banner if any */}
      {unassignedEmployees.length > 0 && (
        <div className="unassigned-banner">
          <div className="banner-icon-wrap">
            <AlertCircle size={20} />
          </div>
          <div className="banner-text">
            <h4>{unassignedEmployees.length} Company Staff Unassigned</h4>
            <p>Ensure every internal team member has a designated primary responsibility for operational accountability.</p>
          </div>
        </div>
      )}

      {/* Overview Cards Matrix: "Who Handles What?" */}
      <div className="responsibility-matrix-section">
        <div className="section-title-wrap">
          <Briefcase size={20} className="text-blue" />
          <h2>Responsibility Overview Matrix</h2>
        </div>

        <div className="matrix-grid">
          {groupedResponsibilities.map(({ resp, emps }) => (
            <div key={resp.id} className={`matrix-card ${emps.length === 0 ? 'card-vacant' : ''}`}>
              <div className="matrix-card-header">
                <div>
                  <h3 className="resp-card-title">{resp.name}</h3>
                  {resp.description && <p className="resp-card-desc">{resp.description}</p>}
                </div>
                <span className={`count-pill ${emps.length > 0 ? 'pill-filled' : 'pill-empty'}`}>
                  {emps.length} In-Charge
                </span>
              </div>

              <div className="matrix-card-body">
                {emps.length === 0 ? (
                  <div className="vacant-note">
                    <span>No primary staff assigned</span>
                  </div>
                ) : (
                  <div className="assigned-emps-stack">
                    {emps.map(emp => (
                      <div key={emp.id} className="assigned-emp-row">
                        <div className="emp-avatar-sm">{emp.initials || 'EM'}</div>
                        <div className="emp-meta-stack">
                          <span className="emp-name-text">{emp.name}</span>
                          {emp.responsibilities?.secondaryResponsibilityIds && emp.responsibilities.secondaryResponsibilityIds.length > 0 && (
                            <span className="secondary-count-sub">
                              +{emp.responsibilities.secondaryResponsibilityIds.length} secondary roles
                            </span>
                          )}
                        </div>
                        <button className="quick-edit-btn" onClick={() => handleOpenAssign(emp)} title="Edit Responsibilities">
                          <Edit2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Roster & Assignment Table */}
      <div className="staff-assignment-section">
        <div className="assignment-table-card">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search staff by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-select-wrap">
              <select 
                value={selectedRespFilter}
                onChange={(e) => setSelectedRespFilter(e.target.value)}
              >
                <option value="All">All Responsibilities</option>
                <option value="Unassigned">⚠️ Unassigned Only</option>
                {responsibilities.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="staff-assignment-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Primary Responsibility</th>
                  <th>Secondary Responsibilities</th>
                  <th>Assigned Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const primaryResp = emp.responsibilities?.primaryResponsibilityId
                    ? respMap.get(emp.responsibilities.primaryResponsibilityId)
                    : null;

                  const secondaryResps = (emp.responsibilities?.secondaryResponsibilityIds || [])
                    .map(id => respMap.get(id))
                    .filter(Boolean) as Responsibility[];

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="emp-table-profile">
                          <div className="emp-avatar">{emp.initials || 'EM'}</div>
                          <div>
                            <span className="emp-name">{emp.name}</span>
                            <span className="emp-id-sub">{emp.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {primaryResp ? (
                          <div className="primary-pill">
                            <ShieldCheck size={14} />
                            <span>{primaryResp.name}</span>
                          </div>
                        ) : (
                          <span className="unassigned-pill">
                            <AlertCircle size={13} /> Unassigned
                          </span>
                        )}
                      </td>
                      <td>
                        {secondaryResps.length > 0 ? (
                          <div className="secondary-tags-wrap">
                            {secondaryResps.map(r => (
                              <span key={r.id} className="secondary-tag">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted text-sm">— None —</span>
                        )}
                      </td>
                      <td>
                        <span className="date-sub">
                          {emp.responsibilities?.assignedAt 
                            ? new Date(emp.responsibilities.assignedAt).toLocaleDateString()
                            : '—'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn-assign-action"
                          onClick={() => handleOpenAssign(emp)}
                        >
                          <Sliders size={14} />
                          <span>Assign Roles</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assign Responsibilities Modal */}
      {isAssignModalOpen && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
          <div className="modal-card" style={{maxWidth: '560px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Sliders size={20} className="text-blue" />
                <h3>Assign Responsibilities — {selectedEmployee.name}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsAssignModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="modal-form">
              {/* Primary Responsibility */}
              <div className="form-group">
                <label className="form-label-highlight">
                  <ShieldCheck size={15} /> Primary Responsibility (Main Ownership)
                </label>
                <select 
                  value={primaryRespId}
                  onChange={(e) => setPrimaryRespId(e.target.value)}
                  className="primary-select"
                >
                  <option value="">— Select Primary Responsibility —</option>
                  {responsibilities.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <span className="form-help">
                  The primary responsibility identifies who owns this work area at the company level.
                </span>
              </div>

              {/* Secondary Responsibilities */}
              <div className="form-group">
                <label className="form-label-secondary">
                  <Layers size={15} /> Secondary Responsibilities (Additional Support)
                </label>
                <div className="secondary-checkbox-grid">
                  {responsibilities
                    .filter(r => r.id !== primaryRespId)
                    .map(r => {
                      const isSelected = secondaryRespIds.includes(r.id);
                      return (
                        <div 
                          key={r.id}
                          className={`checkbox-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSecondaryId(r.id)}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}}
                          />
                          <div>
                            <span className="card-resp-title">{r.name}</span>
                            {r.description && <span className="card-resp-desc">{r.description}</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Internal Notes */}
              <div className="form-group">
                <label>Assignment Notes (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Lead coordinator for North district"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsAssignModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Save Responsibilities
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Master Responsibility Modal */}
      {isCreateRespModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateRespModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Plus size={20} className="text-blue" />
                <h3>Create New Master Responsibility</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsCreateRespModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateResponsibility} className="modal-form">
              <div className="form-group">
                <label>Responsibility Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Solar Installation Coordinator"
                  value={newRespName}
                  onChange={(e) => setNewRespName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea 
                  rows={3}
                  placeholder="Describe the scope and functional ownership for this responsibility..."
                  value={newRespDesc}
                  onChange={(e) => setNewRespDesc(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsCreateRespModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Create Responsibility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
