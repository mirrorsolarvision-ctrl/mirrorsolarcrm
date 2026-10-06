import { useMemo, useState } from 'react';
import { 
  Users, Target, TrendingUp, AlertCircle, PhoneCall, 
  CheckCircle2, Plus, Box, Package, Activity as ActivityIcon,
  CheckSquare, Calendar, Truck, Layers, FileSpreadsheet,
  Sun, UserCheck, ShieldCheck, ArrowRight, Clock, AlertTriangle,
  FileText, Sparkles, Send, Eye
} from 'lucide-react';
import { useCRM, STAGES } from '../context/CRMContext';
import { useStock } from '../context/StockContext';
import { useAttendance } from '../context/AttendanceContext';
import { useUI } from '../context/UIContext';
import { canAccessRoute, canManageModule } from '../utils/permissionCalculations';
import { 
  getMyPerformance, getMyPipeline, getMyFollowUpsRaw, 
  getMyOverdueFollowUps, getMyDealers, getMyActivity, getMyLeads,
  isSuryaGharEmployee
} from '../utils/employeeCalculations';
import './EmployeeDashboard.css';

interface EmployeeDashboardProps {
  onNavigate: (path: string, filters?: any) => void;
}

export default function EmployeeDashboard({ onNavigate }: EmployeeDashboardProps) {
  const { currentUser, leads, dealers, activities, tasks, addActivity, updateLead } = useCRM();
  const { 
    stockItems, stockDispatches, materialConsumptions, stockRequests,
    totalItems, availableUnits, lowStockCount, outOfStockCount 
  } = useStock();
  const { todayRecord } = useAttendance();
  const { showToast, showConfirmModal } = useUI();

  const [isUpdatingFollowUp, setIsUpdatingFollowUp] = useState(false);

  // User details & category detection
  const userName = currentUser?.name || 'Employee';
  const empCategory = currentUser?.employeeCategory || 'Marketing Employee';
  const isStockIncharge = empCategory === 'Stock Incharge';
  const isSuryaGhar = empCategory === 'Surya Ghar Incharge' || empCategory === 'PM Surya Ghar Incharge';
  const isMarketing = !isStockIncharge && !isSuryaGhar;

  // --------------------------------------------------------------------------
  // MARKETING EMPLOYEE DERIVED DATA
  // --------------------------------------------------------------------------
  const performance = useMemo(() => getMyPerformance(userName, leads), [userName, leads]);
  const pipeline = useMemo(() => getMyPipeline(userName, leads), [userName, leads]);
  const rawFollowUps = useMemo(() => getMyFollowUpsRaw(userName, leads), [userName, leads]);
  const overdueFollowUps = useMemo(() => getMyOverdueFollowUps(userName, leads), [userName, leads]);
  const todayFollowUps = useMemo(() => rawFollowUps.filter(f => f.status === 'Due Today'), [rawFollowUps]);
  const myDealers = useMemo(() => getMyDealers(userName, leads, dealers), [userName, leads, dealers]);
  const myActivity = useMemo(() => getMyActivity(userName, activities).slice(0, 5), [userName, activities]);
  const myLeads = useMemo(() => getMyLeads(userName, leads), [userName, leads]);
  const assignedProjects = useMemo(() => myLeads.filter(l => l.leadType === 'project').length, [myLeads]);

  // Read-only stock snapshot for Marketing
  const stockSnapshot = useMemo(() => {
    return stockItems.filter(i => !i.archived).slice(0, 4);
  }, [stockItems]);

  // --------------------------------------------------------------------------
  // STOCK INCHARGE DERIVED DATA
  // --------------------------------------------------------------------------
  // What needs to be added (Low & Out of stock items)
  const lowStockAlerts = useMemo(() => {
    return stockItems.filter(i => !i.archived && (i.status === 'Low' || i.status === 'Critical' || i.status === 'Out of Stock'));
  }, [stockItems]);

  // What is going out (Recent dispatches to dealers)
  const recentDispatches = useMemo(() => {
    return stockDispatches.slice(0, 5);
  }, [stockDispatches]);

  // Material deductions going to customer projects
  const recentConsumptions = useMemo(() => {
    return materialConsumptions.slice(0, 5);
  }, [materialConsumptions]);

  const pendingRequestsCount = useMemo(() => {
    return stockRequests.filter(r => r.status === 'Pending').length;
  }, [stockRequests]);

  // --------------------------------------------------------------------------
  // PM SURYA GHAR EMPLOYEE DERIVED DATA (All company leads & KYC)
  // --------------------------------------------------------------------------
  const allCompanyLeads = leads;
  const activeCompanyLeads = useMemo(() => {
    return allCompanyLeads.filter(l => l.stage !== 'Converted' && l.stage !== 'Completed' && !l.archived);
  }, [allCompanyLeads]);

  const convertedCompanyLeads = useMemo(() => {
    return allCompanyLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed');
  }, [allCompanyLeads]);

  const pendingKycLeads = useMemo(() => {
    return allCompanyLeads.filter(l => !l.archived && (!l.documents || l.documents.length < 3)).slice(0, 6);
  }, [allCompanyLeads]);

  const discomStageLeads = useMemo(() => {
    return allCompanyLeads.filter(l => l.stage === 'Material' || l.stage === 'Installation');
  }, [allCompanyLeads]);

  const masterPipeline = useMemo(() => {
    return STAGES.reduce((acc, stage) => {
      acc[stage] = allCompanyLeads.filter(l => l.stage === stage && !l.archived).length;
      return acc;
    }, {} as Record<string, number>);
  }, [allCompanyLeads]);

  // Sunday Check
  const isSunday = new Date().getDay() === 0;

  // Handlers
  const handleCompleteFollowUp = (leadId: string, customer: string) => {
    showConfirmModal(
      'Complete Follow-up?',
      `Mark follow-up complete for ${customer}?`,
      () => {
        setIsUpdatingFollowUp(true);
        setTimeout(() => {
          const currentLead = leads.find(l => l.id === leadId);
          if (currentLead && currentLead.followUp) {
            updateLead(leadId, { followUp: { ...currentLead.followUp, status: 'Completed' } });
          }
          addActivity({
            type: 'Follow-up Completed',
            message: `Completed follow-up for ${customer}`,
            user: userName,
            employee: userName,
            leadId
          });
          showToast('Follow-up completed successfully', 'success');
          setIsUpdatingFollowUp(false);
        }, 300);
      }
    );
  };

  const getPriorityClass = (priority: string) => {
    switch(priority) {
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return '';
    }
  };

  // ==========================================================================
  // VIEW 1: STOCK INCHARGE DASHBOARD
  // ==========================================================================
  if (isStockIncharge) {
    return (
      <div className="employee-dashboard fade-in">
        {/* Welcome Header */}
        <div className="emp-welcome">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>Stock & Warehouse Hub</h1>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff', fontWeight: 700, padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
              📦 Stock Incharge
            </span>
          </div>
          <p style={{ margin: 0, opacity: 0.9 }}>Central inventory balance, incoming replenishment needs, and outbound dealer dispatches.</p>
          
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => onNavigate('/employee/stock')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: '#0284c7', borderColor: '#0284c7', color: '#fff', borderRadius: '8px' }}>
              <Package size={15} style={{ marginRight: '5px' }} /> Central Stock
            </button>
            <button className="btn-outline" onClick={() => onNavigate('/employee/eod-report')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '8px' }}>
              <FileText size={15} style={{ marginRight: '5px' }} /> Day End Report
            </button>
            <button className="btn-outline" onClick={() => onNavigate('/employee/attendance')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '8px' }}>
              <UserCheck size={15} style={{ marginRight: '5px' }} /> Attendance
            </button>
          </div>
        </div>

        {/* Sunday Notification if today is Sunday */}
        {isSunday && (
          <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '0.85rem 1.25rem', color: '#5b21b6', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={20} color="#7c3aed" />
            <div>
              <strong>🏖️ Sunday Weekly Holiday:</strong> Today is a weekly off. Any work or warehouse updates logged today are recorded as active Sunday work.
            </div>
          </div>
        )}

        {/* Stock KPI Summary Cards */}
        <div className="emp-grid-4">
          <div className="emp-summary-card" onClick={() => onNavigate('/employee/stock')}>
            <div className="emp-summary-title">Total Catalog Items</div>
            <div className="emp-summary-value">{totalItems}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Across all warehouse bins</span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/stock')}>
            <div className="emp-summary-title">Available Units Ready</div>
            <div className="emp-summary-value" style={{ color: '#16a34a' }}>{availableUnits.toLocaleString()}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Ready for dispatch & projects</span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/stock')} style={lowStockAlerts.length > 0 ? { borderColor: '#fca5a5', background: '#fffaf0' } : {}}>
            <div className="emp-summary-title">Low Stock / Need to Add</div>
            <div className="emp-summary-value" style={{ color: lowStockAlerts.length > 0 ? '#dc2626' : '#64748b' }}>
              {lowStockCount + outOfStockCount}
            </div>
            <span style={{ fontSize: '0.8rem', color: lowStockAlerts.length > 0 ? '#dc2626' : '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>
              {lowStockAlerts.length > 0 ? '⚠️ Immediate restock required' : 'All stock levels healthy'}
            </span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/stock')}>
            <div className="emp-summary-title">Dealer Dispatches</div>
            <div className="emp-summary-value" style={{ color: '#0284c7' }}>{stockDispatches.length}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Bulk shipments logged</span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/stock')}>
            <div className="emp-summary-title">Pending Requests</div>
            <div className="emp-summary-value" style={{ color: '#ea580c' }}>{pendingRequestsCount}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Awaiting handover</span>
          </div>
        </div>

        {/* 2-Column Grid: What Needs To Add vs Outbound Dealer Dispatches */}
        <div className="emp-grid-2">
          {/* Panel 1: What needs to be added (Low Stock Alert) */}
          <div className="emp-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, color: '#991b1b' }}>
                <AlertTriangle size={18} color="#dc2626" /> What Needs to be Added (Restock List)
              </h2>
              <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onNavigate('/employee/stock')}>
                Manage Stock →
              </button>
            </div>

            {lowStockAlerts.length > 0 ? (
              <div className="emp-list">
                {lowStockAlerts.map(item => (
                  <div key={item.id} className="emp-list-item warning" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div className="emp-list-info">
                      <span className="emp-list-name">{item.name}</span>
                      <span className="emp-list-meta">
                        <strong style={{ color: '#dc2626' }}>Available: {item.totalQuantity - item.reservedQuantity} {item.unit}</strong> • Min: {item.minimumStock} {item.unit} • Loc: {item.warehouseLocation || 'Central'}
                      </span>
                    </div>
                    <span className={`emp-badge ${item.status === 'Critical' || item.status === 'Out of Stock' ? 'danger' : 'warning'}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emp-empty-state" style={{ padding: '2rem' }}>
                <CheckCircle2 size={36} color="#16a34a" />
                <h3 style={{ marginTop: '0.5rem', fontSize: '1rem', color: '#166534' }}>All warehouse inventory levels are healthy!</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No items below minimum safety threshold.</p>
              </div>
            )}
          </div>

          {/* Panel 2: Today's Attendance & Quick Actions */}
          <div className="emp-panel">
            <h2><UserCheck size={18} /> Attendance & Duty Status</h2>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.35rem' }}>Today's Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: todayRecord?.status === 'PRESENT' ? '#16a34a' : (todayRecord?.status === 'HALF_DAY' ? '#d97706' : '#64748b') }}>
                {todayRecord?.status === 'PRESENT' ? '✓ Present (Full Day)' : 
                 todayRecord?.status === 'HALF_DAY' ? '✓ Half Day Logged' : 
                 (isSunday ? '🏖️ Sunday (Holiday / Optional Work)' : '⚠️ Attendance Not Marked Yet')}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                {todayRecord?.checkInTime ? `Marked at ${new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Click below to punch your daily presence'}
              </div>
            </div>

            <div className="emp-quick-actions" style={{ gridTemplateColumns: '1fr' }}>
              <button className="emp-action-btn primary" onClick={() => onNavigate('/employee/attendance')} style={{ padding: '0.85rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserCheck size={20} />
                <div>
                  <div style={{ fontWeight: 700 }}>Mark Daily Attendance</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Record Full Day or Half Day punch</div>
                </div>
              </button>

              <button className="emp-action-btn" onClick={() => onNavigate('/employee/eod-report')} style={{ padding: '0.85rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={20} color="#0284c7" />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Submit Day End Report</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Log dispatches & material movements</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Outward Dispatches to Dealers & Material Consumptions for Customer Projects */}
        <div className="emp-grid-half">
          {/* Outbound Dispatches to Dealers */}
          <div className="emp-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, color: '#0369a1' }}>
                <Truck size={18} color="#0284c7" /> What Are Going Out (Dispatches to Dealers)
              </h2>
              <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onNavigate('/employee/stock')}>
                View All →
              </button>
            </div>

            {recentDispatches.length > 0 ? (
              <div className="emp-list">
                {recentDispatches.map(d => (
                  <div key={d.id} className="emp-list-item" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div className="emp-list-info">
                      <span className="emp-list-name" style={{ color: '#0f172a' }}>To Dealer: <strong>{d.dealer}</strong></span>
                      <span className="emp-list-meta">
                        {d.items.map(it => `${it.quantity} ${it.unit} ${it.name}`).join(' • ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        ID: {d.id} • {new Date(d.dispatchedAt).toLocaleDateString()} {d.waybillOrNote ? `• Waybill: ${d.waybillOrNote}` : ''}
                      </span>
                    </div>
                    <span className="badge" style={{ 
                      background: d.status === 'Confirmed / Delivered' ? '#dcfce7' : '#fef3c7',
                      color: d.status === 'Confirmed / Delivered' ? '#166534' : '#92400e',
                      fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700
                    }}>
                      {d.status === 'Confirmed / Delivered' ? 'Received' : 'In Transit'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emp-empty-state" style={{ padding: '2rem' }}>
                <Truck size={36} color="#94a3b8" />
                <h3 style={{ marginTop: '0.5rem', fontSize: '1rem' }}>No outbound dispatches yet.</h3>
              </div>
            )}
          </div>

          {/* Customer Project Material Deductions */}
          <div className="emp-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, color: '#7c3aed' }}>
                <FileSpreadsheet size={18} color="#8b5cf6" /> Material Dispatched to Customers
              </h2>
              <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onNavigate('/employee/stock')}>
                View Ledgers →
              </button>
            </div>

            {recentConsumptions.length > 0 ? (
              <div className="emp-list">
                {recentConsumptions.map(c => (
                  <div key={c.id} className="emp-list-item" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div className="emp-list-info">
                      <span className="emp-list-name" style={{ color: '#0f172a' }}>Customer: <strong>{c.customerName}</strong></span>
                      <span className="emp-list-meta" style={{ color: '#7c3aed', fontWeight: 600 }}>
                        Dealer: {c.dealer} • Lead: {c.leadId}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                        Deducted: {c.itemsDeducted.map(i => `${i.quantity} ${i.unit} ${i.itemName}`).join(', ')}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {c.date}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emp-empty-state" style={{ padding: '2rem' }}>
                <FileSpreadsheet size={36} color="#94a3b8" />
                <h3 style={{ marginTop: '0.5rem', fontSize: '1rem' }}>No customer material deductions yet.</h3>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: PM SURYA GHAR WORK EMPLOYEE DASHBOARD
  // ==========================================================================
  if (isSuryaGhar) {
    return (
      <div className="employee-dashboard fade-in">
        {/* Welcome Header */}
        <div className="emp-welcome">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>PM Surya Ghar Operations Hub</h1>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff', fontWeight: 700, padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
              ☀️ Central Surya Ghar Incharge
            </span>
          </div>
          <p style={{ margin: 0, opacity: 0.9 }}>Master central visibility across all marketing executives and dealer networks for PM Surya Ghar & DISCOM processing.</p>
          
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => onNavigate('/employee/leads')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: '#f59e0b', borderColor: '#f59e0b', color: '#fff', borderRadius: '8px' }}>
              <Users size={15} style={{ marginRight: '5px' }} /> All Leads & KYC
            </button>
            <button className="btn-outline" onClick={() => onNavigate('/employee/eod-report')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '8px' }}>
              <FileText size={15} style={{ marginRight: '5px' }} /> Day End Report
            </button>
            <button className="btn-outline" onClick={() => onNavigate('/employee/attendance')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '8px' }}>
              <UserCheck size={15} style={{ marginRight: '5px' }} /> Attendance
            </button>
          </div>
        </div>

        {/* Sunday Notification if today is Sunday */}
        {isSunday && (
          <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '0.85rem 1.25rem', color: '#5b21b6', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={20} color="#7c3aed" />
            <div>
              <strong>🏖️ Sunday Weekly Holiday:</strong> Today is a weekly off. Any customer KYC reviews or portal updates logged today are recorded as active Sunday work.
            </div>
          </div>
        )}

        {/* PM Surya Ghar Summary Cards */}
        <div className="emp-grid-4">
          <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads')}>
            <div className="emp-summary-title">Total Company Applications</div>
            <div className="emp-summary-value" style={{ color: 'var(--color-navy)' }}>{allCompanyLeads.length}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>All Marketing & Dealer Leads</span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { status: 'Active' })}>
            <div className="emp-summary-title">Active In Pipeline</div>
            <div className="emp-summary-value" style={{ color: '#d97706' }}>{activeCompanyLeads.length}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Under verification / site work</span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { stage: 'Converted' })}>
            <div className="emp-summary-title">Sanctioned / Converted</div>
            <div className="emp-summary-value" style={{ color: '#16a34a' }}>{convertedCompanyLeads.length}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Ready / installed projects</span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { stage: 'Material' })}>
            <div className="emp-summary-title">DISCOM / Material Stage</div>
            <div className="emp-summary-value" style={{ color: '#0284c7' }}>{discomStageLeads.length}</div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Net metering & dispatch</span>
          </div>

          <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads')}>
            <div className="emp-summary-title">KYC Incomplete</div>
            <div className="emp-summary-value" style={{ color: '#ea580c' }}>{pendingKycLeads.length}</div>
            <span style={{ fontSize: '0.8rem', color: '#ea580c', marginTop: '0.25rem', fontWeight: 600 }}>Needs doc upload</span>
          </div>
        </div>

        {/* Master Pipeline Funnel */}
        <div className="emp-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}><Target size={18} /> Company-Wide PM Surya Ghar Master Pipeline</h2>
            <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onNavigate('/employee/leads')}>
              Open Master Lead Board →
            </button>
          </div>
          <div className="emp-pipeline-container">
            {STAGES.map(stage => (
              <div 
                key={stage} 
                className="emp-pipeline-stage"
                onClick={() => onNavigate('/employee/leads', { stage })}
              >
                <div className="emp-stage-count">{masterPipeline[stage] || 0}</div>
                <div className="emp-stage-name">{stage}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Grid: Customer KYC Stream vs Operations Hub */}
        <div className="emp-grid-2">
          {/* Panel 1: Master Lead Stream & KYC Documents */}
          <div className="emp-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0 }}><Users size={18} /> Recent Customer Leads (All Marketing & Dealers)</h2>
              <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onNavigate('/employee/leads')}>
                View All {allCompanyLeads.length} →
              </button>
            </div>

            <div className="emp-list">
              {allCompanyLeads.slice(0, 5).map(lead => {
                const docCount = lead.documents?.length || 0;
                return (
                  <div key={lead.id} className="emp-list-item" style={{ cursor: 'pointer' }} onClick={() => onNavigate('/employee/leads')}>
                    <div className="emp-list-info">
                      <span className="emp-list-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {lead.customer}
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>({lead.phone})</span>
                      </span>
                      <span className="emp-list-meta">
                        Rep: <strong>{lead.assignedEmployee || lead.dealer || 'Direct'}</strong> • Stage: {lead.stage} • Loc: {lead.location || 'N/A'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: docCount >= 3 ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                        📑 {docCount} KYC Documents Uploaded {docCount < 3 ? '(Incomplete)' : '(Ready for DISCOM)'}
                      </span>
                    </div>
                    <button className="btn-action">View File →</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel 2: PM Surya Ghar Quick Actions & Attendance */}
          <div className="emp-panel">
            <h2><Sparkles size={18} /> PM Surya Ghar Operations Hub</h2>

            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.35rem' }}>Today's Attendance Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: todayRecord?.status === 'PRESENT' ? '#16a34a' : (todayRecord?.status === 'HALF_DAY' ? '#d97706' : '#64748b') }}>
                {todayRecord?.status === 'PRESENT' ? '✓ Present (Full Day)' : 
                 todayRecord?.status === 'HALF_DAY' ? '✓ Half Day Logged' : 
                 (isSunday ? '🏖️ Sunday (Holiday / Optional Work)' : '⚠️ Not Marked Yet')}
              </div>
            </div>

            <div className="emp-quick-actions" style={{ gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <button className="emp-action-btn primary" onClick={() => onNavigate('/employee/leads')} style={{ padding: '0.85rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f59e0b', borderColor: '#f59e0b' }}>
                <Users size={20} />
                <div>
                  <div style={{ fontWeight: 700 }}>Open All Company Leads</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Review KYC docs, Aadhaar, PAN, EB Bills</div>
                </div>
              </button>

              <button className="emp-action-btn" onClick={() => onNavigate('/employee/eod-report')} style={{ padding: '0.85rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={20} color="#0284c7" />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Submit Daily EOD Report</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Log applications processed & DISCOM sanctions</div>
                </div>
              </button>

              <button className="emp-action-btn" onClick={() => onNavigate('/employee/attendance')} style={{ padding: '0.85rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserCheck size={20} color="#16a34a" />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Mark Daily Attendance</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Fast 1-click staff check-in</div>
                </div>
              </button>

              <button className="emp-action-btn" onClick={() => onNavigate('/employee/tasks')} style={{ padding: '0.85rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckSquare size={20} color="#6366f1" />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Tasks & Document Approvals</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Verify site inspections & installation proofs</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 3: MARKETING EMPLOYEE DASHBOARD (Default Sales Workflow)
  // ==========================================================================
  return (
    <div className="employee-dashboard fade-in">
      {/* Welcome Header */}
      <div className="emp-welcome">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>Good Morning, {currentUser?.name?.split(' ')[0] || 'Employee'}</h1>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff', fontWeight: 700, padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
            💼 Marketing Executive
          </span>
        </div>
        <p style={{ margin: 0, opacity: 0.9 }}>Here is your active sales pipeline, customer follow-ups, and read-only warehouse inventory.</p>
        
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => onNavigate('/employee/leads', { action: 'add' })} style={{ padding: '7px 14px', fontSize: '0.85rem', background: '#16a34a', borderColor: '#16a34a', color: '#fff', borderRadius: '8px' }}>
            <Plus size={15} style={{ marginRight: '5px' }} /> New Lead
          </button>
          <button className="btn-outline" onClick={() => onNavigate('/employee/eod-report')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '8px' }}>
            <FileText size={15} style={{ marginRight: '5px' }} /> Day End Report
          </button>
          <button className="btn-outline" onClick={() => onNavigate('/employee/attendance')} style={{ padding: '7px 14px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff', borderRadius: '8px' }}>
            <UserCheck size={15} style={{ marginRight: '5px' }} /> Attendance
          </button>
        </div>
      </div>

      {/* Sunday Notification if today is Sunday */}
      {isSunday && (
        <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '0.85rem 1.25rem', color: '#5b21b6', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Calendar size={20} color="#7c3aed" />
          <div>
            <strong>🏖️ Sunday Weekly Holiday:</strong> Today is a weekly off. Any field visits, calls, or leads logged today are recorded as active Sunday work.
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="emp-grid-4">
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads')}>
          <div className="emp-summary-title">My Leads</div>
          <div className="emp-summary-value">{performance.totalLeads}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { status: 'Active' })}>
          <div className="emp-summary-title">Active Deals</div>
          <div className="emp-summary-value" style={{color: '#d97706'}}>{performance.activeLeads}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads')}>
          <div className="emp-summary-title">Follow-ups Today</div>
          <div className="emp-summary-value" style={{color: '#ea580c'}}>{todayFollowUps.length}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { stage: 'Converted' })}>
          <div className="emp-summary-title">Converted</div>
          <div className="emp-summary-value" style={{color: '#16a34a'}}>{performance.convertedLeads}</div>
        </div>
        <div className="emp-summary-card" onClick={() => onNavigate('/employee/leads', { filter: 'Project' })}>
          <div className="emp-summary-title">Assigned Projects</div>
          <div className="emp-summary-value" style={{color: '#4f46e5'}}>{assignedProjects}</div>
        </div>
      </div>

      {/* Pipeline & Follow-ups */}
      <div className="emp-grid-2">
        <div className="emp-panel">
          <h2><Target size={18} /> My Lead Pipeline</h2>
          <div className="emp-pipeline-container">
            {STAGES.map(stage => (
              <div 
                key={stage} 
                className="emp-pipeline-stage"
                onClick={() => onNavigate('/employee/leads', { stage })}
              >
                <div className="emp-stage-count">{pipeline[stage]}</div>
                <div className="emp-stage-name">{stage}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="emp-panel">
          <h2><PhoneCall size={18} /> Today's Follow-ups</h2>
          <div className="emp-list">
            {todayFollowUps.length > 0 ? todayFollowUps.slice(0, 3).map(f => (
              <div key={f.lead.id} className="emp-list-item">
                <div className="emp-list-info">
                  <span className="emp-list-name">{f.lead.customer}</span>
                  <span className="emp-list-meta">
                    <span className={getPriorityClass(f.lead.priority)}>{f.lead.priority} Priority</span>
                    • {f.time} • {f.type}
                  </span>
                </div>
                <button 
                  className="btn-outline" 
                  style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}}
                  onClick={() => handleCompleteFollowUp(f.lead.id, f.lead.customer)}
                  disabled={isUpdatingFollowUp}
                >
                  <CheckCircle2 size={14} style={{marginRight: '0.25rem'}} /> Complete
                </button>
              </div>
            )) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <CheckCircle2 size={32} color="#16a34a" />
                <h3>You're all caught up.</h3>
              </div>
            )}
            {todayFollowUps.length > 3 && (
              <button className="btn-outline" onClick={() => onNavigate('/employee/leads')}>View all {todayFollowUps.length}</button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div style={{marginBottom: '0.5rem'}}>
        <div className="emp-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h2 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><CheckSquare size={18} color="#0284c7" /> Today's Tasks</h2>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button className="btn-outline" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => onNavigate('/employee/calendar')}>
                <Calendar size={14} style={{marginRight: '0.25rem'}} /> Calendar
              </button>
              <button className="btn-primary" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => onNavigate('/employee/tasks')}>
                View All
              </button>
            </div>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const activeTasks = tasks.filter(t => 
                (t.assignedToUserId === currentUser?.id || t.createdByUserId === currentUser?.id) && 
                t.dueDate <= today && 
                t.status !== 'Completed'
              );
              
              const activeFollowups = leads
                .filter(l => l.assignedEmployee === currentUser?.name && l.followUp && !l.archived && (l.followUp.status === 'Due Today' || l.followUp.status === 'Overdue'))
                .map(l => ({
                  id: `FU-${l.id}`,
                  title: `Follow-up: ${l.customer}`,
                  priority: l.priority,
                  leadId: l.id,
                  status: l.followUp.status,
                  dueTime: l.followUp.time,
                  type: 'Followups'
                }));

              const mappedTasks = activeTasks.map(t => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                leadId: t.leadId,
                status: t.status,
                dueTime: t.dueTime,
                type: 'Tasks'
              }));

              const combined = [...mappedTasks, ...activeFollowups].slice(0, 5);

              if (combined.length === 0) {
                return (
                  <div style={{padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1'}}>
                    No pending tasks or follow-ups for today.
                  </div>
                );
              }

              return combined.map(item => (
                <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer'}} onClick={() => onNavigate(`/employee/${item.type.toLowerCase()}`)}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                    <div style={{width: '8px', height: '8px', borderRadius: '50%', background: item.priority === 'High' ? '#ef4444' : item.priority === 'Medium' ? '#f59e0b' : '#3b82f6'}}></div>
                    <div>
                      <div style={{fontWeight: 600, color: '#1e293b', fontSize: '0.9rem'}}>{item.title}</div>
                      {item.leadId && <div style={{fontSize: '0.75rem', color: '#64748b'}}>Related: {leads.find(l => l.id === item.leadId)?.customer || 'Unknown'}</div>}
                    </div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                    <span className={`stage-badge ${item.status === 'Overdue' ? 'rejected' : 'lead'}`} style={item.status === 'Overdue' ? {background: '#fee2e2', color: '#dc2626'} : {}}>{item.status}</span>
                    <span style={{fontSize: '0.8rem', color: '#64748b'}}>{item.dueTime || 'Any time'}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Needs Attention & Quick Actions */}
      <div className="emp-grid-2">
        <div className="emp-panel" style={{borderColor: overdueFollowUps.length > 0 ? '#fed7aa' : undefined}}>
          <h2><AlertCircle size={18} /> Needs Attention</h2>
          <div className="emp-list">
            {overdueFollowUps.length > 0 ? overdueFollowUps.map(f => (
              <div key={f.lead.id} className="emp-list-item warning">
                <div className="emp-list-info">
                  <span className="emp-list-name">{f.lead.customer}</span>
                  <span className="emp-list-meta" style={{color: '#9a3412', fontWeight: 600}}>
                    Overdue • {f.date} {f.time}
                  </span>
                </div>
                <button className="btn-action" onClick={() => onNavigate('/employee/leads')}>View →</button>
              </div>
            )) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <CheckCircle2 size={32} color="#16a34a" />
                <h3>No overdue follow-ups.</h3>
              </div>
            )}
          </div>
        </div>

        <div className="emp-panel">
          <h2><ActivityIcon size={18} /> Quick Actions</h2>
          <div className="emp-quick-actions">
            <button className="emp-action-btn primary" onClick={() => onNavigate('/employee/leads', { action: 'add' })}>
              <Plus size={24} />
              Add Lead
            </button>
            <button className="emp-action-btn" onClick={() => onNavigate('/employee/eod-report')}>
              <FileText size={24} />
              EOD Report
            </button>
            <button className="emp-action-btn" onClick={() => onNavigate('/employee/leads')}>
              <PhoneCall size={24} />
              Today's Calls
            </button>
            <button className="emp-action-btn" onClick={() => onNavigate('/employee/attendance')}>
              <UserCheck size={24} />
              Attendance
            </button>
          </div>
        </div>
      </div>

      {/* Performance & Dealers */}
      <div className="emp-grid-half">
        <div className="emp-panel">
          <h2><TrendingUp size={18} /> My Performance</h2>
          <div style={{display: 'flex', gap: '2rem', alignItems: 'center'}}>
            <div style={{flex: 1, padding: '2rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center'}}>
              <div style={{fontSize: '3rem', fontWeight: 800, color: 'var(--color-navy)'}}>{performance.conversionRate}%</div>
              <div style={{fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Conversion Rate</div>
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9'}}>
                <span style={{color: '#64748b', fontWeight: 600}}>Converted</span>
                <span style={{fontWeight: 800}}>{performance.convertedLeads}</span>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9'}}>
                <span style={{color: '#64748b', fontWeight: 600}}>Follow-ups Completed</span>
                <span style={{fontWeight: 800}}>{performance.completedFollowUps}</span>
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9'}}>
                <span style={{color: '#64748b', fontWeight: 600}}>Total Leads</span>
                <span style={{fontWeight: 800}}>{performance.totalLeads}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="emp-panel">
          <h2><Box size={18} /> My Dealers</h2>
          <div className="emp-list">
            {myDealers.length > 0 ? myDealers.slice(0, 3).map(d => {
              const dLeads = myLeads.filter(l => l.dealer === d.name);
              const dConv = dLeads.filter(l => l.stage === 'Converted').length;
              return (
                <div key={d.id} className="emp-list-item">
                  <div className="emp-list-info">
                    <span className="emp-list-name">{d.name}</span>
                    <span className="emp-list-meta">{dLeads.length} Leads • {dConv} Converted</span>
                  </div>
                </div>
              )
            }) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <Box size={32} />
                <h3>No assigned dealers.</h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Read-Only Live Stock Availability Snapshot & Activity */}
      <div className="emp-grid-half">
        <div className="emp-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0 }}><Package size={18} /> Available Stock (Read-Only)</h2>
            <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => onNavigate('/employee/stock')}>
              View Full Catalog →
            </button>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#166534', background: '#f0fdf4', padding: '6px 10px', borderRadius: '6px', marginBottom: '0.75rem', fontWeight: 600 }}>
            👁️ Live warehouse quantities available for quoting customer solar proposals.
          </div>
          <div className="emp-list">
            {stockSnapshot.map((item: any) => (
              <div key={item.id} className="emp-list-item">
                <div className="emp-list-info">
                  <span className="emp-list-name">{item.name}</span>
                  <span className="emp-list-meta">
                    Available: <strong style={{ color: '#16a34a' }}>{item.totalQuantity - item.reservedQuantity} {item.unit}</strong> • SKU: {item.sku}
                  </span>
                </div>
                <span className={`emp-badge ${item.status === 'Healthy' || item.status === 'Moderate' ? 'success' : 'warning'}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="emp-panel">
          <h2><ActivityIcon size={18} /> Recent Activity</h2>
          <div className="emp-timeline">
            {myActivity.length > 0 ? myActivity.map(a => (
              <div key={a.id} className="emp-timeline-item">
                <div className="emp-timeline-dot"></div>
                <div className="emp-timeline-content">
                  <span className="emp-timeline-title">{a.message}</span>
                  <span className="emp-timeline-time">{new Date(a.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            )) : (
              <div className="emp-empty-state" style={{padding: '1.5rem'}}>
                <ActivityIcon size={32} />
                <h3>No recent activity.</h3>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
