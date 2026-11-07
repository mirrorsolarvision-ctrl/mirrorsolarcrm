import { useState, useMemo } from 'react';
import { 
  Users, Search, Plus, X, Activity, UserPlus, 
  MapPin, Phone, Mail, FileText, CheckCircle2, TrendingUp, AlertTriangle, List,
  Sliders, Shield, CheckSquare, Briefcase, Zap, Award, Gauge, Trash2,
  Wallet, DollarSign, CreditCard, Building2, Check, Banknote
} from 'lucide-react';
import PageHero from './components/PageHero';
import { useCRM, defaultDealerFeatures } from './context/CRMContext';
import { useStock } from './context/StockContext';
import { useUI } from './context/UIContext';
import type { Dealer, DealerFeatures } from './context/CRMContext';
import { 
  getDealerPerformance, 
  getDealerStockRequests, 
  getDealerActivity, 
  getDealerEmployees,
  getDealerPipeline,
  getDealerFollowUps,
  getDealerCommissionSummary,
  DEALER_TARGET_KW,
  DEALER_TARGET_MONTHS
} from './utils/dealerCalculations';
import { formatDealerCode } from './utils/idUtils';
import './AdminDealersPage.css';

interface AdminDealersPageProps {
  onNavigateToLeads?: (dealerName: string, stage?: string) => void;
}

export default function AdminDealersPage({ onNavigateToLeads }: AdminDealersPageProps) {
  const { leads, dealers, employees, activities, addDealer, updateDealer, deleteDealer, updateDealerFeatures, addActivity, recordDealerCommissionPayout, currentUser } = useCRM();
  const { stockRequests } = useStock();
  const { showToast, showConfirmModal } = useUI();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [performanceFilter, setPerformanceFilter] = useState('All');
  const [requestsFilter, setRequestsFilter] = useState('All');

  // Modals & Panels
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
  const [featureTargetDealer, setFeatureTargetDealer] = useState<Dealer | null>(null);
  const [featureForm, setFeatureForm] = useState<DealerFeatures>({ ...defaultDealerFeatures });

  // Commission & Bank Details Modals
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
  const [commissionTargetDealer, setCommissionTargetDealer] = useState<Dealer | null>(null);
  const [commissionForm, setCommissionForm] = useState({
    commissionRatePerKw: '1500',
    commissionType: 'PER_KW' as 'PER_KW' | 'PERCENTAGE',
    commissionPercent: '5',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: ''
  });

  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutTargetDealer, setPayoutTargetDealer] = useState<Dealer | null>(null);
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    paymentMode: 'Bank Transfer (NEFT/IMPS)',
    referenceNumber: '',
    notes: ''
  });
  
  // Note state
  const [newNote, setNewNote] = useState('');

  const [formData, setFormData] = useState({
    name: '', id: '', email: '', phone: '', address: '', status: 'Active', notes: ''
  });

  const processedDealers = useMemo(() => {
    return dealers.map(dealer => {
      const perf = getDealerPerformance(dealer.name, leads);
      const dRequests = getDealerStockRequests(dealer.name, stockRequests);
      const pendingRequests = dRequests.filter(r => r.status === 'Pending').length;
      const commissionSummary = getDealerCommissionSummary(dealer, leads, dealers);
      return { ...dealer, ...perf, pendingRequests, commissionSummary };
    });
  }, [dealers, leads, stockRequests]);

  const topDealers = useMemo(() => {
    return [...processedDealers]
      .filter(d => d.status === 'Active')
      .sort((a, b) => {
        if (b.totalConvertedKw !== a.totalConvertedKw) return b.totalConvertedKw - a.totalConvertedKw;
        if (b.convertedLeads !== a.convertedLeads) return b.convertedLeads - a.convertedLeads;
        if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
        return b.totalLeads - a.totalLeads;
      })
      .slice(0, 3);
  }, [processedDealers]);

  const filteredDealers = useMemo(() => {
    return processedDealers.filter(dealer => {
      const q = searchQuery.toLowerCase();
      if (q && !(
        dealer.name.toLowerCase().includes(q) || 
        dealer.id.toLowerCase().includes(q) || 
        dealer.email.toLowerCase().includes(q) ||
        dealer.phone.toLowerCase().includes(q)
      )) return false;

      if (statusFilter !== 'All' && dealer.status !== statusFilter) return false;
      if (performanceFilter !== 'All' && dealer.performanceLevel !== performanceFilter) return false;
      if (requestsFilter === 'Pending' && dealer.pendingRequests === 0) return false;
      if (requestsFilter === 'No Pending Requests' && dealer.pendingRequests > 0) return false;
      
      return true;
    });
  }, [processedDealers, searchQuery, statusFilter, performanceFilter, requestsFilter]);

  const hasActiveFilters = searchQuery || statusFilter !== 'All' || performanceFilter !== 'All' || requestsFilter !== 'All';
  const clearFilters = () => {
    setSearchQuery(''); setStatusFilter('All'); setPerformanceFilter('All'); setRequestsFilter('All');
  };

  const totals = useMemo(() => {
    const totalKwConverted = Math.round(processedDealers.reduce((acc, d) => acc + (d.totalConvertedKw || 0), 0) * 10) / 10;
    const totalTargetKw = dealers.length * DEALER_TARGET_KW;
    const networkProgress = totalTargetKw > 0 ? Math.round((totalKwConverted / totalTargetKw) * 100) : 0;
    const totalCommissionEarned = processedDealers.reduce((acc, d) => acc + (d.commissionSummary?.totalCommissionEarned || 0), 0);
    const totalCommissionPending = processedDealers.reduce((acc, d) => acc + (d.commissionSummary?.pendingCommissionBalance || 0), 0);
    return {
      total: dealers.length,
      active: dealers.filter(d => d.status === 'Active').length,
      totalLeads: leads.length,
      converted: leads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length,
      totalKwConverted,
      totalTargetKw,
      networkProgress,
      totalCommissionEarned,
      totalCommissionPending
    };
  }, [dealers, leads, processedDealers]);

  const handleOpenAddModal = () => {
    setFormData({ name: '', id: '', email: '', phone: '', address: '', status: 'Active', notes: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (dealer: Dealer) => {
    setFormData({ 
      name: dealer.name, id: dealer.id, email: dealer.email, phone: dealer.phone, 
      address: dealer.address || '', status: dealer.status, notes: '' 
    });
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = () => {
    if (dealers.some(d => d.id === formData.id)) {
      showToast('Dealer ID already exists.', 'error');
      return;
    }
    const initials = formData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    addDealer({
      id: formData.id?.trim() || undefined,
      name: formData.name, email: formData.email, phone: formData.phone, 
      address: formData.address, status: formData.status as any,
      initials, lastActive: 'Just now'
    });
    showToast('Dealer added successfully.', 'success');
    addActivity({ type: 'Dealer Added', message: `New dealer added: ${formData.name}`, user: currentUser?.name || 'Admin' });
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = () => {
    if (!selectedDealer) return;
    updateDealer(selectedDealer.id, {
      name: formData.name, email: formData.email, phone: formData.phone, 
      address: formData.address, status: formData.status as any
    });
    showToast('Dealer details updated.', 'success');
    
    if (formData.notes) {
      addActivity({ type: 'Note Added', message: `Added note to ${formData.name}: ${formData.notes}`, user: currentUser?.name || 'Admin', dealer: formData.name });
    }
    
    setIsEditModalOpen(false);
    setSelectedDealer(dealers.find(d => d.id === selectedDealer.id) || null);
  };

  const toggleDealerStatus = (dealer: Dealer) => {
    const isDeactivating = dealer.status === 'Active';
    showConfirmModal(
      isDeactivating ? `Deactivate ${dealer.name}?` : `Reactivate ${dealer.name}?`, 
      isDeactivating ? 'The dealer will no longer be available for new assignments or dealer login.' : 'The dealer will become available for new assignments and login.',
      () => {
        const newStatus = isDeactivating ? 'Inactive' : 'Active';
        updateDealer(dealer.id, { status: newStatus });
        showToast(`Dealer ${newStatus.toLowerCase()} successfully.`, 'success');
        addActivity({ type: 'Dealer Status Updated', message: `${dealer.name} marked as ${newStatus}`, user: currentUser?.name || 'Admin', dealer: dealer.name });
        setSelectedDealer(null);
      }
    );
  };

  const handleDeleteDealer = (dealer: Dealer) => {
    showConfirmModal(
      `Delete Dealer ${dealer.name}?`,
      `Are you sure you want to permanently delete dealer "${dealer.name}"? This will remove their credentials, staff access, and permissions permanently. This action cannot be undone.`,
      async () => {
        try {
          await deleteDealer(dealer.id);
          setSelectedDealer(null);
          showToast(`Dealer "${dealer.name}" deleted successfully.`, 'success');
          addActivity({ 
            type: 'Dealer Deleted', 
            message: `Dealer ${dealer.name} (${dealer.id}) was permanently deleted by Admin`, 
            user: currentUser?.name || 'Admin' 
          });
        } catch (err: any) {
          showToast(err.message || 'Failed to delete dealer', 'error');
        }
      }
    );
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedDealer) return;
    addActivity({ type: 'Internal Note', message: newNote, user: currentUser?.name || 'Admin', dealer: selectedDealer.name });
    setNewNote('');
    showToast('Note added', 'success');
  };

  const handleOpenFeaturesModal = (dealer: Dealer) => {
    setFeatureTargetDealer(dealer);
    setFeatureForm({ ...(dealer.features || defaultDealerFeatures) });
    setIsFeaturesModalOpen(true);
  };

  const handleSaveFeatures = async () => {
    if (!featureTargetDealer) return;
    try {
      await updateDealerFeatures(featureTargetDealer.id, featureForm);
      showToast(`Features updated for ${featureTargetDealer.name}!`, 'success');
      setIsFeaturesModalOpen(false);
      if (selectedDealer && selectedDealer.id === featureTargetDealer.id) {
        setSelectedDealer({ ...selectedDealer, features: featureForm });
      }
    } catch (err) {
      showToast('Failed to update dealer features', 'error');
    }
  };

  const toggleFeatureKey = (key: keyof DealerFeatures) => {
    setFeatureForm(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenCommissionModal = (dealer: Dealer) => {
    setCommissionTargetDealer(dealer);
    setCommissionForm({
      commissionRatePerKw: String(dealer.commissionRatePerKw || 1500),
      commissionType: dealer.commissionType || 'PER_KW',
      commissionPercent: String(dealer.commissionPercent || 5),
      bankName: dealer.bankDetails?.bankName || '',
      accountNumber: dealer.bankDetails?.accountNumber || '',
      ifscCode: dealer.bankDetails?.ifscCode || '',
      upiId: dealer.bankDetails?.upiId || ''
    });
    setIsCommissionModalOpen(true);
  };

  const handleSaveCommissionConfig = async () => {
    if (!commissionTargetDealer) return;
    try {
      await updateDealer(commissionTargetDealer.id, {
        commissionRatePerKw: parseFloat(commissionForm.commissionRatePerKw) || 1500,
        commissionType: commissionForm.commissionType,
        commissionPercent: parseFloat(commissionForm.commissionPercent) || 5,
        bankDetails: {
          bankName: commissionForm.bankName.trim(),
          accountNumber: commissionForm.accountNumber.trim(),
          ifscCode: commissionForm.ifscCode.trim(),
          upiId: commissionForm.upiId.trim()
        }
      });
      showToast(`✓ Commission & bank settings updated for ${commissionTargetDealer.name}`, 'success');
      setIsCommissionModalOpen(false);
      if (selectedDealer?.id === commissionTargetDealer.id) {
        setSelectedDealer(prev => prev ? {
          ...prev,
          commissionRatePerKw: parseFloat(commissionForm.commissionRatePerKw) || 1500,
          bankDetails: {
            bankName: commissionForm.bankName.trim(),
            accountNumber: commissionForm.accountNumber.trim(),
            ifscCode: commissionForm.ifscCode.trim(),
            upiId: commissionForm.upiId.trim()
          }
        } : null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update commission settings', 'error');
    }
  };

  const handleOpenPayoutModal = (dealer: any) => {
    const commSummary = dealer.commissionSummary || getDealerCommissionSummary(dealer, leads, dealers);
    setPayoutTargetDealer(dealer);
    setPayoutForm({
      amount: commSummary.pendingCommissionBalance > 0 ? String(commSummary.pendingCommissionBalance) : '',
      paymentMode: 'Bank Transfer (NEFT/IMPS)',
      referenceNumber: '',
      notes: ''
    });
    setIsPayoutModalOpen(true);
  };

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTargetDealer) return;
    const amountNum = parseFloat(payoutForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid payout amount', 'warning');
      return;
    }

    try {
      await recordDealerCommissionPayout(
        payoutTargetDealer.id,
        amountNum,
        payoutForm.paymentMode,
        payoutForm.referenceNumber.trim(),
        payoutForm.notes.trim()
      );
      showToast(`✓ Commission payout of ₹${amountNum.toLocaleString('en-IN')} recorded for ${payoutTargetDealer.name}!`, 'success');
      setIsPayoutModalOpen(false);
      // update selected dealer if viewing
      if (selectedDealer?.id === payoutTargetDealer.id) {
        setSelectedDealer(prev => {
          if (!prev) return null;
          const currentPayouts = prev.commissionPayouts || [];
          return {
            ...prev,
            settledCommissionTotal: (prev.settledCommissionTotal || 0) + amountNum,
            commissionPayouts: [
              {
                id: `PAYOUT-${Date.now()}`,
                dealerId: prev.id,
                dealerName: prev.name,
                amount: amountNum,
                paymentMode: payoutForm.paymentMode,
                referenceNumber: payoutForm.referenceNumber.trim(),
                paidAt: new Date().toISOString(),
                recordedBy: currentUser?.name || 'Admin',
                notes: payoutForm.notes.trim()
              },
              ...currentPayouts
            ]
          };
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record payout', 'error');
    }
  };

  return (
    <div className="dealers-page fade-in">
      {/* Header */}
      <PageHero
        badge="Dealer Network Hub"
        icon={<Briefcase size={26} />}
        title="Dealer Network Directory"
        subtitle="Manage authorized dealers, track conversion performance, and configure feature access."
        actions={
          <button className="btn-hero-primary" onClick={handleOpenAddModal}>
            <Plus size={18} /> Add Dealer
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="dealers-summary-grid">
        <div className="dealers-summary-card">
          <div className="card-header-row">
            <div className="card-icon navy"><Users size={20} /></div>
            <span className="card-label">Total Dealers</span>
          </div>
          <span className="card-value">{totals.total}</span>
        </div>
        <div className="dealers-summary-card">
          <div className="card-header-row">
            <div className="card-icon success"><CheckCircle2 size={20} /></div>
            <span className="card-label">Active Dealers</span>
          </div>
          <span className="card-value">{totals.active}</span>
        </div>
        <div className="dealers-summary-card">
          <div className="card-header-row">
            <div className="card-icon yellow"><TrendingUp size={20} /></div>
            <span className="card-label">Total Leads</span>
          </div>
          <span className="card-value">{totals.totalLeads}</span>
        </div>
        <div className="dealers-summary-card">
          <div className="card-header-row">
            <div className="card-icon orange"><CheckCircle2 size={20} /></div>
            <span className="card-label">Converted</span>
          </div>
          <span className="card-value">{totals.converted}</span>
        </div>
        <div className="dealers-summary-card" style={{border: '1.5px solid #bae6fd', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'}}>
          <div className="card-header-row">
            <div className="card-icon" style={{background: '#0284c7', color: '#ffffff'}}><Zap size={20} /></div>
            <span className="card-label" style={{color: '#0369a1'}}>18M Network Capacity (225 kW Goal)</span>
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: '0.35rem'}}>
            <span className="card-value" style={{color: '#0369a1'}}>{totals.totalKwConverted}</span>
            <span style={{fontSize: '0.95rem', fontWeight: 700, color: '#0284c7'}}>/ {totals.totalTargetKw} kW</span>
          </div>
        </div>
        <div className="dealers-summary-card" style={{border: '1.5px solid #a7f3d0', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'}}>
          <div className="card-header-row">
            <div className="card-icon" style={{background: '#059669', color: '#ffffff'}}><Wallet size={20} /></div>
            <span className="card-label" style={{color: '#065f46'}}>Dealer Partner Earnings (Earned / Due)</span>
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: '0.35rem'}}>
            <span className="card-value" style={{color: '#065f46'}}>₹{totals.totalCommissionEarned.toLocaleString('en-IN')}</span>
            <span style={{fontSize: '0.85rem', fontWeight: 700, color: totals.totalCommissionPending > 0 ? '#b45309' : '#059669'}}>
              ({totals.totalCommissionPending > 0 ? `₹${totals.totalCommissionPending.toLocaleString('en-IN')} Due` : 'All Settled'})
            </span>
          </div>
        </div>
      </div>

      {/* Top Dealers */}
      {topDealers.length > 0 && (
        <div className="dealers-panel">
          <h2><TrendingUp size={20} className="icon" /> Dealer Performance & 225 kW Quota Leaders</h2>
          <div className="top-dealers-grid">
            {topDealers.map((d, idx) => (
              <div key={d.id} className="top-dealer-card" onClick={() => setSelectedDealer(d)} style={{cursor: 'pointer'}}>
                <div className={`top-dealer-rank rank-${idx+1}`}>#{idx+1}</div>
                <div className="top-dealer-header">
                  <div className="dealer-avatar">{d.initials}</div>
                  <div>
                    <div className="dealer-name">{d.name}</div>
                    <div style={{fontSize: '0.75rem', color: '#0284c7', fontWeight: 700}}>
                      {d.totalConvertedKw} kW / 225 kW ({d.targetProgressPercent}%)
                    </div>
                  </div>
                </div>
                <div className="top-dealer-stats">
                  <div className="top-stat">
                    <span className="top-stat-label">Leads</span>
                    <span className="top-stat-value">{d.totalLeads}</span>
                  </div>
                  <div className="top-stat">
                    <span className="top-stat-label">Converted</span>
                    <span className="top-stat-value highlight">{d.convertedLeads}</span>
                  </div>
                  <div className="top-stat">
                    <span className="top-stat-label">Target (225kW)</span>
                    <span className="top-stat-value" style={{color: '#16a34a'}}>{d.totalConvertedKw} kW</span>
                  </div>
                  <div className="top-stat">
                    <span className="top-stat-label">Conversion</span>
                    <span className="top-stat-value">{d.conversionRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Table Panel */}
      <div className="dealers-panel">
        <h2><Users size={20} className="icon" /> All Dealers</h2>
        
        <div className="dealers-filters-bar">
          <div className="dealers-search">
            <Search size={16} color="#64748b" />
            <input type="text" placeholder="Search dealers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <select className="dealers-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select className="dealers-filter-select" value={performanceFilter} onChange={e => setPerformanceFilter(e.target.value)}>
            <option value="All">All Performance</option>
            <option value="High">High (&ge;50%)</option>
            <option value="Medium">Medium (30-49%)</option>
            <option value="Low">Low (&lt;30%)</option>
          </select>
          <select className="dealers-filter-select" value={requestsFilter} onChange={e => setRequestsFilter(e.target.value)}>
            <option value="All">All Requests</option>
            <option value="Pending">Pending Requests</option>
            <option value="No Pending Requests">No Pending Requests</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div className="active-filters">
            {searchQuery && <div className="filter-chip">"{searchQuery}" <button onClick={() => setSearchQuery('')}><X size={12}/></button></div>}
            {statusFilter !== 'All' && <div className="filter-chip">{statusFilter} <button onClick={() => setStatusFilter('All')}><X size={12}/></button></div>}
            {performanceFilter !== 'All' && <div className="filter-chip">{performanceFilter} Performance <button onClick={() => setPerformanceFilter('All')}><X size={12}/></button></div>}
            {requestsFilter !== 'All' && <div className="filter-chip">{requestsFilter} <button onClick={() => setRequestsFilter('All')}><X size={12}/></button></div>}
            <button className="clear-filters-btn" onClick={clearFilters}>Clear All</button>
          </div>
        )}

        <div className="dealers-table-wrapper">
          <table className="dealers-table">
            <thead>
              <tr>
                <th>DEALER</th>
                <th>STATUS</th>
                <th>18M TARGET (225 kW)</th>
                <th>COMMISSION</th>
                <th>LEADS</th>
                <th>ACTIVE</th>
                <th>CONVERTED</th>
                <th>CONVERSION</th>
                <th>STOCK REQ</th>
                <th>LAST ACTIVITY</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredDealers.map(dealer => (
                <tr key={dealer.id} className={dealer.status === 'Inactive' ? 'inactive' : ''}>
                  <td>
                    <div className="dealer-name-col">
                      <div className="dealer-avatar">{dealer.initials}</div>
                      <div className="dealer-info-text">
                        <span>{dealer.name}</span>
                        <span className="dealer-id">{formatDealerCode(dealer)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${dealer.status.toLowerCase()}`}>{dealer.status}</span>
                  </td>
                  <td style={{minWidth: '160px'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '3px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700}}>
                        <span style={{color: '#0f172a'}}>{dealer.totalConvertedKw} / 225 kW</span>
                        <span style={{color: dealer.targetProgressPercent >= 50 ? '#16a34a' : '#0284c7'}}>{dealer.targetProgressPercent}%</span>
                      </div>
                      <div style={{height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden'}}>
                        <div style={{
                          height: '100%', 
                          width: `${Math.min(100, Math.max(2, dealer.targetProgressPercent))}%`,
                          background: dealer.targetProgressPercent >= 100 ? '#16a34a' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                          borderRadius: '999px'
                        }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                      <div style={{fontSize: '0.82rem', fontWeight: 800, color: '#047857'}}>
                        ₹{dealer.commissionSummary?.totalCommissionEarned.toLocaleString('en-IN') || '0'}
                      </div>
                      <div style={{fontSize: '0.72rem', color: (dealer.commissionSummary?.pendingCommissionBalance || 0) > 0 ? '#b45309' : '#64748b', fontWeight: (dealer.commissionSummary?.pendingCommissionBalance || 0) > 0 ? 700 : 500}}>
                        {(dealer.commissionSummary?.pendingCommissionBalance || 0) > 0 
                          ? `₹${dealer.commissionSummary.pendingCommissionBalance.toLocaleString('en-IN')} Due`
                          : 'Settled'}
                      </div>
                    </div>
                  </td>
                  <td>{dealer.totalLeads}</td>
                  <td style={{color: '#16a34a'}}>{dealer.activeLeads}</td>
                  <td style={{color: 'var(--color-orange)'}}>{dealer.convertedLeads}</td>
                  <td>
                    {dealer.totalLeads > 0 ? (
                      <span className={`perf-badge ${dealer.performanceLevel.toLowerCase()}`}>
                        {dealer.conversionRate}%
                      </span>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td>
                    {dealer.pendingRequests > 0 ? (
                      <span style={{color: '#ef4444', fontWeight: 800}}>{dealer.pendingRequests} Pending</span>
                    ) : <span className="text-muted">0 Pending</span>}
                  </td>
                  <td className="text-muted text-sm">{dealer.lastActive}</td>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <button className="btn-action" onClick={() => setSelectedDealer(dealer)}>View →</button>
                      <button 
                        className="btn-action" 
                        title="Record Commission Payout"
                        style={{padding: '5px 8px', fontSize: '0.78rem', background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px'}}
                        onClick={(e) => { e.stopPropagation(); handleOpenPayoutModal(dealer); }}
                      >
                        <Wallet size={13} /> Payout
                      </button>
                      <button 
                        className="btn-icon-danger" 
                        title={`Delete ${dealer.name}`}
                        style={{padding: '6px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff1f2', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                        onClick={(e) => { e.stopPropagation(); handleDeleteDealer(dealer); }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDealers.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <Users size={48} />
                      <h3>No dealers found.</h3>
                      <p>Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedDealer && (
        <div className="detail-panel-overlay" onClick={() => setSelectedDealer(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            
            <div className="detail-header">
              <div className="detail-title-area">
                <div className="dealer-avatar">{selectedDealer.initials}</div>
                <div>
                  <div className="detail-title"><h3>{selectedDealer.name}</h3></div>
                  <div className="detail-id">{selectedDealer.id} | <span className={`status-badge ${selectedDealer.status.toLowerCase()}`}>{selectedDealer.status}</span></div>
                </div>
              </div>
              <button className="detail-close" onClick={() => setSelectedDealer(null)}><X size={24}/></button>
            </div>
            
            <div className="detail-body">
              {/* Contact Info */}
              <div className="detail-contact-info">
                <div className="contact-row"><Phone size={16}/> {selectedDealer.phone}</div>
                <div className="contact-row"><Mail size={16}/> {selectedDealer.email}</div>
                <div className="contact-row"><MapPin size={16}/> {selectedDealer.address || 'No address provided'}</div>
              </div>

              {/* 🎯 18-MONTH TARGET CARD (225 kW) */}
              <div className="detail-section" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', borderRadius: '12px', padding: '1.25rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
                  <h4 style={{margin: 0, color: '#facc15', display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                    <Award size={18} /> 18-Month Target (225 kW)
                  </h4>
                  <span style={{fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8'}}>
                    {getDealerPerformance(selectedDealer.name, leads).targetProgressPercent}% Achieved
                  </span>
                </div>

                <div style={{height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden', margin: '0.75rem 0'}}>
                  <div style={{
                    height: '100%', 
                    width: `${Math.min(100, Math.max(2, getDealerPerformance(selectedDealer.name, leads).targetProgressPercent))}%`,
                    background: 'linear-gradient(90deg, #38bdf8, #facc15, #22c55e)',
                    borderRadius: '999px'
                  }} />
                </div>

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem'}}>
                  <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.6rem', borderRadius: '6px'}}>
                    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>CONVERTED</div>
                    <div style={{fontSize: '1rem', fontWeight: 800, color: '#34d399'}}>{getDealerPerformance(selectedDealer.name, leads).totalConvertedKw} kW</div>
                  </div>
                  <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.6rem', borderRadius: '6px'}}>
                    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>IN PIPELINE</div>
                    <div style={{fontSize: '1rem', fontWeight: 800, color: '#38bdf8'}}>{getDealerPerformance(selectedDealer.name, leads).inPipelineKw} kW</div>
                  </div>
                  <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.6rem', borderRadius: '6px'}}>
                    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>REMAINING</div>
                    <div style={{fontSize: '1rem', fontWeight: 800, color: '#cbd5e1'}}>{getDealerPerformance(selectedDealer.name, leads).remainingKw} kW</div>
                  </div>
                  <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.6rem', borderRadius: '6px'}}>
                    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>MONTHLY PACE</div>
                    <div style={{fontSize: '1rem', fontWeight: 800, color: '#fbbf24'}}>12.5 kW/mo</div>
                  </div>
                </div>
              </div>

              {/* Partner Commission & Banking Payout Section */}
              <div className="detail-section" style={{border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '1rem', background: '#f0fdf4'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px'}}>
                  <h4 style={{margin: 0, color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem'}}>
                    <Wallet size={18} /> Partner Commission & Payouts
                  </h4>
                  <div style={{display: 'flex', gap: '0.4rem'}}>
                    <button 
                      className="btn-outline" 
                      style={{padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#ffffff', color: '#047857', borderColor: '#a7f3d0', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px'}}
                      onClick={() => handleOpenCommissionModal(selectedDealer)}
                    >
                      <Building2 size={13} /> Bank & Rate
                    </button>
                    <button 
                      className="btn-primary" 
                      style={{padding: '0.25rem 0.75rem', fontSize: '0.78rem', background: '#059669', borderColor: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px'}}
                      onClick={() => handleOpenPayoutModal(selectedDealer)}
                    >
                      <Plus size={13} /> Payout
                    </button>
                  </div>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem'}}>
                  <div style={{background: '#ffffff', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1fae5'}}>
                    <div style={{fontSize: '0.68rem', color: '#64748b', fontWeight: 700}}>TOTAL EARNED</div>
                    <div style={{fontSize: '1rem', fontWeight: 800, color: '#047857'}}>
                      ₹{getDealerCommissionSummary(selectedDealer, leads, dealers).totalCommissionEarned.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{background: '#ffffff', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1fae5'}}>
                    <div style={{fontSize: '0.68rem', color: '#64748b', fontWeight: 700}}>DISBURSED</div>
                    <div style={{fontSize: '1rem', fontWeight: 800, color: '#0284c7'}}>
                      ₹{getDealerCommissionSummary(selectedDealer, leads, dealers).totalCommissionSettled.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{background: '#ffffff', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1fae5'}}>
                    <div style={{fontSize: '0.68rem', color: '#64748b', fontWeight: 700}}>PENDING DUE</div>
                    <div style={{fontSize: '1rem', fontWeight: 800, color: getDealerCommissionSummary(selectedDealer, leads, dealers).pendingCommissionBalance > 0 ? '#d97706' : '#16a34a'}}>
                      ₹{getDealerCommissionSummary(selectedDealer, leads, dealers).pendingCommissionBalance.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Partner Earnings Rate & Bank details pills */}
                <div style={{background: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #d1fae5', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: '#64748b'}}>Partner Earnings Rate:</span>
                    <strong style={{color: '#0f172a'}}>₹{selectedDealer.commissionRatePerKw || 1500} / kW</strong>
                  </div>
                  {selectedDealer.bankDetails?.bankName && (
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#64748b'}}>Bank / Account:</span>
                      <strong style={{color: '#0f172a'}}>{selectedDealer.bankDetails.bankName} • {selectedDealer.bankDetails.accountNumber ? `••••${selectedDealer.bankDetails.accountNumber.slice(-4)}` : ''}</strong>
                    </div>
                  )}
                  {selectedDealer.bankDetails?.upiId && (
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#64748b'}}>UPI ID:</span>
                      <strong style={{color: '#0284c7'}}>{selectedDealer.bankDetails.upiId}</strong>
                    </div>
                  )}
                </div>

                {/* Past Payouts History */}
                {selectedDealer.commissionPayouts && selectedDealer.commissionPayouts.length > 0 && (
                  <div style={{marginTop: '0.75rem'}}>
                    <div style={{fontSize: '0.72rem', fontWeight: 700, color: '#065f46', marginBottom: '4px'}}>RECENT EARNINGS PAYOUT HISTORY</div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto'}}>
                      {selectedDealer.commissionPayouts.map(p => (
                        <div key={p.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '5px 8px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #e2e8f0'}}>
                          <div>
                            <strong style={{color: '#0f172a'}}>₹{p.amount.toLocaleString('en-IN')}</strong>
                            <span style={{color: '#64748b', marginLeft: '6px'}}>{p.paymentMode}</span>
                            {p.referenceNumber && <span style={{color: '#94a3b8', marginLeft: '4px'}}>({p.referenceNumber})</span>}
                          </div>
                          <span style={{color: '#64748b'}}>{p.paidAt ? p.paidAt.split('T')[0] : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Business Overview */}
              <div className="detail-section">
                <h4>Lead Performance</h4>
                <div className="detail-grid">
                  <div className="detail-stat">
                    <label>Total Leads</label>
                    <span>{getDealerPerformance(selectedDealer.name, leads).totalLeads}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Converted</label>
                    <span style={{color: 'var(--color-orange)'}}>{getDealerPerformance(selectedDealer.name, leads).convertedLeads}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Active</label>
                    <span style={{color: '#16a34a'}}>{getDealerPerformance(selectedDealer.name, leads).activeLeads}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Conversion Rate</label>
                    <span>{getDealerPerformance(selectedDealer.name, leads).conversionRate}%</span>
                  </div>
                </div>
              </div>

              {/* Lead Pipeline */}
              <div className="detail-section">
                <h4>Lead Pipeline</h4>
                <div className="pipeline-grid">
                  {Object.entries(getDealerPipeline(selectedDealer.name, leads)).map(([stage, count]) => (
                    <div key={stage} className="pipeline-stage-box" onClick={() => {
                      if (onNavigateToLeads) onNavigateToLeads(selectedDealer.name, stage);
                      else showToast(`Navigating to ${stage} leads for ${selectedDealer.name}...`, 'info');
                    }}>
                      <span className="stage-count">{count}</span>
                      <span className="stage-name">{stage}</span>
                    </div>
                  ))}
                </div>
                <button className="btn-outline" style={{width: '100%', marginTop: '1rem', justifyContent: 'center'}} onClick={() => {
                  if (onNavigateToLeads) onNavigateToLeads(selectedDealer.name);
                }}>
                  <List size={16} style={{marginRight: '0.5rem'}}/> View All Leads
                </button>
              </div>

              {/* Assigned Employees */}
              <div className="detail-section">
                <h4>Assigned Employees</h4>
                {getDealerEmployees(selectedDealer.name, leads, employees).length > 0 ? (
                  <div className="assigned-emp-list">
                    {getDealerEmployees(selectedDealer.name, leads, employees).map(emp => (
                      <div key={emp.name} className="assigned-emp-row">
                        <div className="emp-name"><UserPlus size={16} color="#64748b"/> {emp.name}</div>
                        <div className="emp-stats">{emp.totalLeads} Leads ({emp.convertedLeads} Converted)</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted text-sm">No employees assigned to leads yet.</div>
                )}
              </div>

              {/* Follow Ups */}
              <div className="detail-section">
                <h4>Follow-ups Overview</h4>
                <div className="detail-grid">
                  <div className="detail-stat">
                    <label>Due Today</label>
                    <span style={{color: 'var(--color-orange)'}}>{getDealerFollowUps(selectedDealer.name, leads).dueToday}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Overdue</label>
                    <span style={{color: '#ef4444'}}>{getDealerFollowUps(selectedDealer.name, leads).overdue}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Upcoming</label>
                    <span>{getDealerFollowUps(selectedDealer.name, leads).upcoming}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Completed</label>
                    <span style={{color: '#16a34a'}}>{getDealerFollowUps(selectedDealer.name, leads).completed}</span>
                  </div>
                </div>
              </div>

              {/* Stock Requests */}
              <div className="detail-section">
                <h4>Stock Requests</h4>
                <div className="detail-grid">
                  <div className="detail-stat">
                    <label>Pending</label>
                    <span style={{color: '#ef4444'}}>{getDealerStockRequests(selectedDealer.name, stockRequests).filter(r => r.status === 'Pending').length}</span>
                  </div>
                  <div className="detail-stat">
                    <label>Completed</label>
                    <span style={{color: '#16a34a'}}>{getDealerStockRequests(selectedDealer.name, stockRequests).filter(r => r.status === 'Completed').length}</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="detail-section">
                <h4>Recent Activity</h4>
                <div className="dealer-timeline">
                  {getDealerActivity(selectedDealer.name, activities).slice(0, 5).map(act => (
                    <div key={act.id} className="timeline-item">
                      <div className="timeline-icon">
                        {act.type.includes('Note') ? <FileText size={16}/> : 
                         act.type.includes('Status') ? <AlertTriangle size={16}/> : 
                         <Activity size={16}/>}
                      </div>
                      <div className="timeline-content">
                        <span className="timeline-title">{act.message}</span>
                        <div className="timeline-meta">
                          <span>{act.createdAt}</span> • <span>{act.user}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getDealerActivity(selectedDealer.name, activities).length === 0 && (
                    <div className="text-muted text-sm">No recent activity.</div>
                  )}
                </div>
                
                {/* Notes Input */}
                <div style={{marginTop: '1.5rem', display: 'flex', gap: '0.5rem'}}>
                  <input type="text" placeholder="Add an internal note..." value={newNote} onChange={e => setNewNote(e.target.value)} style={{flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', outline: 'none'}} />
                  <button className="btn-primary" style={{padding: '0.5rem 1rem'}} onClick={handleAddNote}>Save</button>
                </div>
              </div>

              {/* Actions */}
              <div className="detail-section">
                <h4>Manage Dealer</h4>
                <div className="detail-actions" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <button className="btn-action" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#E0F2FE', color: '#0369A1', borderColor: '#BAE6FD'}} onClick={() => handleOpenFeaturesModal(selectedDealer)}>
                    <Sliders size={16} /> Module Permissions
                  </button>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button className="btn-action" style={{flex: 1}} onClick={() => handleOpenEditModal(selectedDealer)}>Edit Details</button>
                    <button className="btn-danger" style={{flex: 1}} onClick={() => toggleDealerStatus(selectedDealer)}>
                      {selectedDealer.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                  <button 
                    className="btn-danger" 
                    style={{marginTop: '4px', background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}
                    onClick={() => handleDeleteDealer(selectedDealer)}
                  >
                    <Trash2 size={16} /> Delete Dealer Permanently
                  </button>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="modal-overlay" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>
          <div className="dealer-modal" onClick={e => e.stopPropagation()}>
            <h2>{isAddModalOpen ? 'Add Dealer' : 'Edit Dealer'}</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Dealer Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Sri Solar Dealers" />
              </div>
              <div className="form-group">
                <label>Dealer ID</label>
                <input type="text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={isEditModalOpen} placeholder="e.g. DL001" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Address / Region</label>
              <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            {isEditModalOpen && (
              <div className="form-group">
                <label>Update Notes (Optional)</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} placeholder="Add a note about this edit..." />
              </div>
            )}
            
            <div className="modal-actions">
              <button className="btn-action" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}>Cancel</button>
              <button className="btn-primary" onClick={isAddModalOpen ? handleAddSubmit : handleEditSubmit}>
                {isAddModalOpen ? 'Add Dealer' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Permissions Modal */}
      {isFeaturesModalOpen && featureTargetDealer && (
        <div className="modal-overlay" onClick={() => setIsFeaturesModalOpen(false)}>
          <div className="dealer-modal" style={{maxWidth: '560px'}} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <Sliders size={20} style={{color: '#0284C7'}} />
                <h2 style={{margin: 0, fontSize: '1.25rem'}}>Module Permissions</h2>
              </div>
              <button onClick={() => setIsFeaturesModalOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#64748B'}}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{fontSize: '0.88rem', color: '#64748B', margin: '0 0 20px 0'}}>
              Configure which CRM modules are enabled for <strong>{featureTargetDealer.name}</strong>. Disabled modules will be hidden and blocked.
            </p>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px'}}>
              {[
                { key: 'myEmployees' as const, label: 'My Employees', desc: 'Add & manage dealer staff' },
                { key: 'attendance' as const, label: 'Team Attendance', desc: 'Track daily staff presence' },
                { key: 'leads' as const, label: 'My Leads', desc: 'Customer lead management' },
                { key: 'stock' as const, label: 'Stock & Inventory', desc: 'Warehouse & material balance' },
                { key: 'payments' as const, label: 'Payments', desc: 'Payouts & transaction records' },
                { key: 'reports' as const, label: 'Reports', desc: 'Analytics & performance' },
                { key: 'tasks' as const, label: 'Tasks', desc: 'Task checklist & assignment' },
                { key: 'calendar' as const, label: 'Calendar', desc: 'Events & installation schedule' }
              ].map(item => {
                const isChecked = !!featureForm[item.key];
                return (
                  <div 
                    key={item.key}
                    onClick={() => toggleFeatureKey(item.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `1.5px solid ${isChecked ? '#0284C7' : '#E2E8F0'}`,
                      background: isChecked ? '#F0F9FF' : '#FAFAFA',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => {}} // Handled by container onClick
                      style={{marginTop: '3px', cursor: 'pointer', accentColor: '#0284C7'}}
                    />
                    <div>
                      <span style={{display: 'block', fontWeight: 600, fontSize: '0.9rem', color: isChecked ? '#0369A1' : '#1E293B'}}>
                        {item.label}
                      </span>
                      <span style={{fontSize: '0.75rem', color: '#64748B'}}>
                        {item.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-actions">
              <button className="btn-action" onClick={() => setIsFeaturesModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveFeatures}>
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Earnings Rate & Bank Settings Modal */}
      {isCommissionModalOpen && commissionTargetDealer && (
        <div className="modal-overlay" onClick={() => setIsCommissionModalOpen(false)}>
          <div className="dealer-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '520px'}}>
            <h2>Partner Earnings & Bank Settings: {commissionTargetDealer.name}</h2>
            <p className="text-muted text-sm" style={{marginBottom: '1.25rem'}}>
              Configure dealer partner earnings rates per installed capacity and disbursement bank/UPI coordinates.
            </p>

            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label>Partner Earnings Rate (₹ per Converted kW)</label>
              <div style={{position: 'relative'}}>
                <input 
                  type="number" 
                  value={commissionForm.commissionRatePerKw} 
                  onChange={e => setCommissionForm({...commissionForm, commissionRatePerKw: e.target.value})} 
                  placeholder="e.g. 1500"
                  style={{paddingLeft: '2rem'}}
                />
                <span style={{position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 700}}>₹</span>
              </div>
              <small className="text-muted" style={{fontSize: '0.72rem'}}>
                Standard residential partner earnings rate is ₹1,500/kW (e.g. 3 kW system = ₹4,500).
              </small>
            </div>

            <h3 style={{fontSize: '0.95rem', fontWeight: 700, margin: '1rem 0 0.5rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Building2 size={16} color="#0284c7" /> Dealer Bank & UPI Account Details
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label>Bank Name</label>
                <input 
                  type="text" 
                  value={commissionForm.bankName} 
                  onChange={e => setCommissionForm({...commissionForm, bankName: e.target.value})} 
                  placeholder="e.g. HDFC Bank, SBI" 
                />
              </div>
              <div className="form-group">
                <label>Account Number</label>
                <input 
                  type="text" 
                  value={commissionForm.accountNumber} 
                  onChange={e => setCommissionForm({...commissionForm, accountNumber: e.target.value})} 
                  placeholder="e.g. 50100492817291" 
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>IFSC Code</label>
                <input 
                  type="text" 
                  value={commissionForm.ifscCode} 
                  onChange={e => setCommissionForm({...commissionForm, ifscCode: e.target.value.toUpperCase()})} 
                  placeholder="e.g. HDFC0001234" 
                />
              </div>
              <div className="form-group">
                <label>UPI ID (VPA)</label>
                <input 
                  type="text" 
                  value={commissionForm.upiId} 
                  onChange={e => setCommissionForm({...commissionForm, upiId: e.target.value})} 
                  placeholder="e.g. dealer@okaxis" 
                />
              </div>
            </div>

            <div className="modal-actions" style={{marginTop: '1.5rem'}}>
              <button className="btn-action" onClick={() => setIsCommissionModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveCommissionConfig}>
                Save Partner Earnings & Bank Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Partner Earnings Payout Modal */}
      {isPayoutModalOpen && payoutTargetDealer && (
        <div className="modal-overlay" onClick={() => setIsPayoutModalOpen(false)}>
          <div className="dealer-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '480px'}}>
            <h2>Record Partner Earnings Payout</h2>
            <p className="text-muted text-sm" style={{marginBottom: '1rem'}}>
              Record a disbursed partner earnings payment to <strong>{payoutTargetDealer.name}</strong>.
            </p>

            <form onSubmit={handleSubmitPayout}>
              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label>Payout Amount (₹) *</label>
                <div style={{position: 'relative'}}>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={payoutForm.amount} 
                    onChange={e => setPayoutForm({...payoutForm, amount: e.target.value})} 
                    placeholder="e.g. 15000"
                    style={{paddingLeft: '2rem', fontSize: '1.05rem', fontWeight: 700}}
                  />
                  <span style={{position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 700}}>₹</span>
                </div>
              </div>

              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label>Payment Mode *</label>
                <select 
                  value={payoutForm.paymentMode} 
                  onChange={e => setPayoutForm({...payoutForm, paymentMode: e.target.value})}
                >
                  <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT / IMPS)</option>
                  <option value="UPI">UPI / QR Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label>UTR / Transaction Ref #</label>
                <input 
                  type="text" 
                  value={payoutForm.referenceNumber} 
                  onChange={e => setPayoutForm({...payoutForm, referenceNumber: e.target.value})} 
                  placeholder="e.g. UTR29381029482 or Chq #00129" 
                />
              </div>

              <div className="form-group" style={{marginBottom: '1.25rem'}}>
                <label>Internal Notes / Remarks</label>
                <textarea 
                  rows={2} 
                  value={payoutForm.notes} 
                  onChange={e => setPayoutForm({...payoutForm, notes: e.target.value})} 
                  placeholder="e.g. Commission settlement for Q3 converted installations" 
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-action" onClick={() => setIsPayoutModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{background: '#059669', borderColor: '#059669'}}>
                  Confirm & Record Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}


