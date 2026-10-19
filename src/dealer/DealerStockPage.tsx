import { useState, useMemo } from 'react';
import { 
  Package, AlertTriangle, Search, Truck, Layers, FileSpreadsheet,
  CheckCircle2, Clock, X, Plus, ShieldCheck, Box, AlertCircle,
  RotateCcw, ArrowDownLeft, Check
} from 'lucide-react';
import { useStock } from '../context/StockContext';
import { useCRM } from '../context/CRMContext';
import { useUI } from '../context/UIContext';
import PageHero from '../components/PageHero';
import '../StockPage.css';

export default function DealerStockPage() {
  const { 
    stockItems, dealerStockList, stockDispatches, materialConsumptions, materialReturns,
    confirmDealerDispatch, rejectDealerDispatch, addStockRequest, returnMaterialFromSite
  } = useStock();
  const { addActivity, currentUser, leads } = useCRM();
  const { showToast } = useUI();
  const dealerName = currentUser?.name || 'Dealer';
  
  const [activeTab, setActiveTab] = useState<'my_stock' | 'dispatches' | 'consumptions' | 'returns' | 'request'>('my_stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Reject modal state
  const [rejectDispatchId, setRejectDispatchId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Request form state
  const [requestForm, setRequestForm] = useState({ 
    itemSku: '', 
    quantity: 10, 
    requiredDate: '', 
    notes: '' 
  });

  // Return from site form state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnForm, setReturnForm] = useState({
    leadId: '',
    customerName: '',
    itemSku: '',
    quantity: 1,
    destination: 'dealer_stock' as 'dealer_stock' | 'central_warehouse',
    condition: 'Good / Reusable' as 'Good / Reusable' | 'Damaged / Faulty',
    reason: ''
  });
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Filtered Dealer Inventory
  const myStock = useMemo(() => {
    return dealerStockList.filter(d => d.dealer === dealerName);
  }, [dealerStockList, dealerName]);

  const filteredMyStock = useMemo(() => {
    return myStock.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.itemSku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [myStock, searchQuery, categoryFilter]);

  // Filtered Dispatches for this dealer
  const myDispatches = useMemo(() => {
    return stockDispatches.filter(d => d.dealer === dealerName);
  }, [stockDispatches, dealerName]);

  const pendingDispatches = useMemo(() => {
    return myDispatches.filter(d => d.status === 'Pending Dealer Confirmation');
  }, [myDispatches]);

  // Filtered Consumptions for this dealer
  const myConsumptions = useMemo(() => {
    return materialConsumptions.filter(c => c.dealer === dealerName);
  }, [materialConsumptions, dealerName]);

  // Filtered Site Recoveries & Returns for this dealer
  const myReturns = useMemo(() => {
    return (materialReturns || []).filter(r => r.dealer === dealerName);
  }, [materialReturns, dealerName]);

  // Accessible Leads for site material attribution
  const myLeads = useMemo(() => {
    const curName = (dealerName || '').toLowerCase().trim();
    const curId = (currentUser?.id || '').toLowerCase().trim();
    return (leads || []).filter(l => {
      const dlr = (l.dealer || '').toLowerCase().trim();
      const dlrId = (l.dealerId || '').toLowerCase().trim();
      return (dlr && (dlr === curName || dlr.includes(curName) || curName.includes(dlr))) ||
             (dlrId && dlrId === curId);
    });
  }, [leads, dealerName, currentUser]);

  // Handle Log Site Material Return Submit
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.itemSku || returnForm.quantity <= 0) {
      showToast('Please select equipment and enter a valid quantity.', 'error');
      return;
    }
    const selectedItem = stockItems.find(i => i.sku === returnForm.itemSku) || myStock.find(i => i.itemSku === returnForm.itemSku);
    const itemName = selectedItem ? (selectedItem as any).name || (selectedItem as any).itemName : returnForm.itemSku;
    const unit = selectedItem?.unit || 'Units';

    const customerObj = myLeads.find(l => l.id === returnForm.leadId);
    const customerLabel = customerObj ? `${customerObj.customer} (${customerObj.location || 'Site'})` : (returnForm.customerName || 'General Site Recovery');

    setIsSubmittingReturn(true);
    const res = await returnMaterialFromSite({
      dealer: dealerName,
      leadId: returnForm.leadId || undefined,
      customerName: customerLabel,
      itemSku: returnForm.itemSku,
      itemName,
      quantity: returnForm.quantity,
      unit,
      destination: returnForm.destination,
      condition: returnForm.condition,
      reason: returnForm.reason.trim() || 'Leftover material returned from installation site',
      loggedBy: currentUser?.name || dealerName
    });
    setIsSubmittingReturn(false);

    if (!res.success) {
      showToast(res.error || 'Failed to record site material return', 'error');
    } else {
      showToast(
        returnForm.destination === 'dealer_stock'
          ? `✓ ${returnForm.quantity} ${unit} credited back to your active Dealer Stock!`
          : `✓ ${returnForm.quantity} ${unit} logged as return shipment to Central Warehouse!`,
        'success'
      );
      addActivity({
        type: 'Material Returned',
        message: `${dealerName} logged site return of ${returnForm.quantity} ${unit} (${itemName}) -> ${returnForm.destination === 'dealer_stock' ? 'Dealer Stock' : 'Central Warehouse'}`,
        user: dealerName,
        dealer: dealerName
      });
      setShowReturnModal(false);
      setReturnForm({
        leadId: '',
        customerName: '',
        itemSku: '',
        quantity: 1,
        destination: 'dealer_stock',
        condition: 'Good / Reusable',
        reason: ''
      });
      setActiveTab('returns');
    }
  };

  // Derived Summary
  const totalStockUnits = myStock.reduce((acc, item) => acc + item.quantity, 0);
  const totalPanelsCount = myStock.filter(i => i.category.toLowerCase().includes('panel') || i.itemSku.startsWith('SP-')).reduce((acc, i) => acc + i.quantity, 0);
  const totalPipesCount = myStock.filter(i => i.itemSku.includes('PIPE') || i.category.toLowerCase().includes('structure')).reduce((acc, i) => acc + i.quantity, 0);
  const totalCablesMeters = myStock.filter(i => i.unit.toLowerCase() === 'meters' || i.itemSku.startsWith('CBL-')).reduce((acc, i) => acc + i.quantity, 0);

  // Handle Accept Dispatch
  const handleConfirmDispatch = async (dispatchId: string) => {
    const res = await confirmDealerDispatch(dispatchId, dealerName, currentUser?.name);
    if (!res.success) {
      showToast(res.error || 'Failed to accept dispatch', 'error');
    } else {
      showToast('Stock receipt confirmed! Materials added to your active inventory.', 'success');
      addActivity({
        type: 'Stock Received',
        message: `${dealerName} confirmed receipt of dispatch ${dispatchId}`,
        user: dealerName,
        dealer: dealerName
      });
      setActiveTab('my_stock');
    }
  };

  // Handle Reject Dispatch
  const handleRejectDispatchSubmit = async () => {
    if (!rejectDispatchId) return;
    const reason = rejectReason.trim() || 'Quantity mismatch / damaged items';
    const res = await rejectDealerDispatch(rejectDispatchId, dealerName, reason);
    if (!res.success) {
      showToast(res.error || 'Failed to reject dispatch', 'error');
    } else {
      showToast('Dispatch rejected and returned to Admin warehouse.', 'error');
      addActivity({
        type: 'Stock Rejected',
        message: `${dealerName} rejected dispatch ${rejectDispatchId}: ${reason}`,
        user: dealerName,
        dealer: dealerName
      });
      setRejectDispatchId(null);
      setRejectReason('');
    }
  };

  // Handle Request Stock Submit
  const handleStockRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.itemSku || requestForm.quantity <= 0 || !requestForm.requiredDate) {
      showToast('Please fill all required fields.', 'error');
      return;
    }
    await addStockRequest({
      requester: dealerName,
      requesterType: 'Dealer',
      dealer: dealerName,
      itemSku: requestForm.itemSku,
      requestedQty: requestForm.quantity,
      requiredDate: requestForm.requiredDate,
      priority: 'High',
      notes: requestForm.notes
    });
    showToast('Stock request sent to Admin successfully.', 'success');
    addActivity({
      type: 'Stock Request',
      message: `${dealerName} requested ${requestForm.quantity}x of ${requestForm.itemSku}`,
      user: dealerName,
      dealer: dealerName
    });
    setRequestForm({ itemSku: '', quantity: 10, requiredDate: '', notes: '' });
  };

  return (
    <div className="stock-page" style={{ minHeight: '100%' }}>
      {/* Header */}
      <PageHero
        badge="Dealer Stock & Materials Hub"
        icon={<Package size={26} />}
        title="Dealer Stock & Materials Hub"
        subtitle="Manage on-hand inventory, confirm incoming dispatches, and log site material consumption & recoveries."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className="btn-hero-primary" 
              onClick={() => setShowReturnModal(true)}
              style={{ background: '#0284c7', borderColor: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={16} /> Log Return from Site / Customer
            </button>
            <button className="btn-hero-primary" onClick={() => setActiveTab('request')}>
              <Plus size={16} /> Request Material from Admin
            </button>
          </div>
        }
      />

      {/* ⚠️ PENDING DISPATCHES NOTIFICATION BANNER */}
      {pendingDispatches.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1.5px solid #fde68a',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 14px rgba(217, 119, 6, 0.1)',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <div style={{width: '46px', height: '46px', borderRadius: '10px', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0}}>
              <Truck size={24} />
            </div>
            <div>
              <div style={{fontSize: '1.05rem', fontWeight: 800, color: '#92400e'}}>
                Action Required: {pendingDispatches.length} Incoming Stock Dispatch{pendingDispatches.length > 1 ? 'es' : ''} Pending Your Approval!
              </div>
              <div style={{fontSize: '0.85rem', color: '#b45309', marginTop: '2px'}}>
                Admin has dispatched solar equipment to you. Please confirm physical receipt to add them to your active inventory.
              </div>
            </div>
          </div>
          <button 
            className="btn-primary" 
            onClick={() => setActiveTab('dispatches')}
            style={{background: '#d97706', borderColor: '#d97706', fontWeight: 700, padding: '0.6rem 1.25rem', whiteSpace: 'nowrap'}}
          >
            Review & Accept Stock ({pendingDispatches.length}) →
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="stock-summary-grid">
        <div className="stock-summary-card">
          <div className="card-header-row">
            <div className="card-icon navy"><Package size={20} /></div>
            <span className="card-label">Total On-Hand Items</span>
          </div>
          <div className="card-value">{totalStockUnits.toLocaleString()}</div>
          <span className="card-desc">All materials in your possession</span>
        </div>

        <div className="stock-summary-card">
          <div className="card-header-row">
            <div className="card-icon yellow"><Box size={20} /></div>
            <span className="card-label">Solar Panels</span>
          </div>
          <div className="card-value" style={{color: '#2563eb'}}>{totalPanelsCount}</div>
          <span className="card-desc">Available for installations</span>
        </div>

        <div className="stock-summary-card">
          <div className="card-header-row">
            <div className="card-icon orange"><Layers size={20} /></div>
            <span className="card-label">Structure GI Pipes</span>
          </div>
          <div className="card-value" style={{color: '#d97706'}}>{totalPipesCount}</div>
          <span className="card-desc">10-Feet Structure Units</span>
        </div>

        <div className="stock-summary-card">
          <div className="card-header-row">
            <div className="card-icon success"><FileSpreadsheet size={20} /></div>
            <span className="card-label">Total Cable Length</span>
          </div>
          <div className="card-value" style={{color: '#16a34a'}}>{totalCablesMeters.toLocaleString()} m</div>
          <span className="card-desc">DC, AC & Earthing Cables</span>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div style={{display: 'flex', gap: '0.5rem', background: '#e2e8f0', padding: '0.35rem', borderRadius: '10px', overflowX: 'auto'}}>
        <button 
          onClick={() => setActiveTab('my_stock')}
          style={{
            flex: 1, padding: '0.65rem 1.25rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
            background: activeTab === 'my_stock' ? '#ffffff' : 'transparent',
            color: activeTab === 'my_stock' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'my_stock' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: '160px'
          }}
        >
          <Box size={16} /> My Active Stock ({myStock.length})
        </button>

        <button 
          onClick={() => setActiveTab('dispatches')}
          style={{
            flex: 1, padding: '0.65rem 1.25rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
            background: activeTab === 'dispatches' ? '#ffffff' : 'transparent',
            color: activeTab === 'dispatches' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'dispatches' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: '180px'
          }}
        >
          <Truck size={16} /> Incoming Dispatches ({myDispatches.length})
          {pendingDispatches.length > 0 && (
            <span style={{background: '#f59e0b', color: '#fff', fontSize: '0.72rem', padding: '2px 7px', borderRadius: '10px'}}>
              {pendingDispatches.length} PENDING
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('consumptions')}
          style={{
            flex: 1, padding: '0.65rem 1.25rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
            background: activeTab === 'consumptions' ? '#ffffff' : 'transparent',
            color: activeTab === 'consumptions' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'consumptions' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: '180px'
          }}
        >
          <FileSpreadsheet size={16} /> Consumed for Projects ({myConsumptions.length})
        </button>

        <button 
          onClick={() => setActiveTab('returns')}
          style={{
            flex: 1, padding: '0.65rem 1.25rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
            background: activeTab === 'returns' ? '#ffffff' : 'transparent',
            color: activeTab === 'returns' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'returns' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: '180px'
          }}
        >
          <RotateCcw size={16} /> Site Returns & Recoveries ({myReturns.length})
        </button>

        <button 
          onClick={() => setActiveTab('request')}
          style={{
            flex: 1, padding: '0.65rem 1.25rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
            background: activeTab === 'request' ? '#ffffff' : 'transparent',
            color: activeTab === 'request' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'request' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: '160px'
          }}
        >
          <Plus size={16} /> Request Material
        </button>
      </div>

      {/* TAB 1: MY ACTIVE STOCK */}
      {activeTab === 'my_stock' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
          <div className="inventory-header">
            <div className="search-bar">
              <Search size={18} />
              <input type="text" placeholder="Search my inventory..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="filter-selects">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="All">All Categories</option>
                {Array.from(new Set(myStock.map(i => i.category))).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="stock-table-card">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Item SKU & Description</th>
                  <th>Category</th>
                  <th>On-Hand Quantity</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredMyStock.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{textAlign: 'center', padding: '3.5rem', color: '#64748b'}}>
                      <Package size={36} style={{margin: '0 auto 0.5rem', color: '#cbd5e1', display: 'block'}} />
                      <div style={{fontWeight: 700, fontSize: '1.05rem', color: '#334155'}}>No stock currently in your possession.</div>
                      <p style={{fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px'}}>
                        When Admin dispatches stock to you and you confirm receipt, it will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredMyStock.map(dItem => (
                    <tr key={dItem.id}>
                      <td>
                        <div style={{fontWeight: 700, color: '#0f172a'}}>{dItem.itemName}</div>
                        <div style={{fontSize: '0.78rem', color: '#64748b'}}>{dItem.itemSku}</div>
                      </td>
                      <td><span className="category-tag">{dItem.category}</span></td>
                      <td>
                        <span style={{fontSize: '1.15rem', fontWeight: 800, color: dItem.quantity > 0 ? '#16a34a' : '#dc2626'}}>
                          {dItem.quantity} {dItem.unit}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${dItem.quantity > 5 ? 'healthy' : dItem.quantity > 0 ? 'low' : 'out-of-stock'}`}>
                          {dItem.quantity > 5 ? 'Available' : dItem.quantity > 0 ? 'Low' : 'Depleted'}
                        </span>
                      </td>
                      <td style={{fontSize: '0.85rem', color: '#64748b'}}>{dItem.lastUpdatedAt || 'Recent'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING DISPATCHES */}
      {activeTab === 'dispatches' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
          <div className="stock-table-card">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Dispatch ID</th>
                  <th>Dispatched Date & By</th>
                  <th>Materials in Shipment</th>
                  <th>Waybill / Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{textAlign: 'center', padding: '3.5rem', color: '#64748b'}}>
                      <Truck size={36} style={{margin: '0 auto 0.5rem', color: '#cbd5e1', display: 'block'}} />
                      <div style={{fontWeight: 700, fontSize: '1.05rem', color: '#334155'}}>No dispatches recorded yet.</div>
                      <p style={{fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px'}}>
                        Any equipment shipments sent by Admin will be listed here for your confirmation.
                      </p>
                    </td>
                  </tr>
                ) : (
                  myDispatches.map(dispatch => (
                    <tr key={dispatch.id} style={{background: dispatch.status === 'Pending Dealer Confirmation' ? '#fffbeb' : 'inherit'}}>
                      <td><strong style={{color: '#2563eb', fontSize: '0.95rem'}}>{dispatch.id}</strong></td>
                      <td>
                        <div style={{fontSize: '0.85rem', color: '#334155'}}>{dispatch.dispatchedAt}</div>
                        <div style={{fontSize: '0.75rem', color: '#64748b'}}>By: {dispatch.dispatchedBy}</div>
                      </td>
                      <td>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.4rem'}}>
                          {dispatch.items.map((itm, idx) => (
                            <span key={idx} style={{background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b'}}>
                              {itm.quantity} {itm.unit} × {itm.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{fontSize: '0.85rem', color: '#334155'}}>{dispatch.waybillOrNote || '—'}</div>
                        {dispatch.notes && <div style={{fontSize: '0.75rem', color: '#64748b'}}>{dispatch.notes}</div>}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                          background: dispatch.status === 'Confirmed / Delivered' ? '#dcfce7' : dispatch.status === 'Rejected' ? '#fee2e2' : '#fef3c7',
                          color: dispatch.status === 'Confirmed / Delivered' ? '#15803d' : dispatch.status === 'Rejected' ? '#b91c1c' : '#b45309'
                        }}>
                          {dispatch.status === 'Confirmed / Delivered' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                          {dispatch.status}
                        </span>
                        {dispatch.acceptedAt && (
                          <div style={{fontSize: '0.72rem', color: '#64748b', marginTop: '3px'}}>Confirmed: {dispatch.acceptedAt}</div>
                        )}
                        {dispatch.rejectionReason && (
                          <div style={{fontSize: '0.75rem', color: '#dc2626', marginTop: '3px'}}>Reason: {dispatch.rejectionReason}</div>
                        )}
                      </td>
                      <td>
                        {dispatch.status === 'Pending Dealer Confirmation' ? (
                          <div style={{display: 'flex', gap: '0.5rem'}}>
                            <button 
                              className="btn-primary" 
                              onClick={() => handleConfirmDispatch(dispatch.id)}
                              style={{padding: '0.4rem 0.85rem', fontSize: '0.82rem', background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.3rem'}}
                            >
                              <CheckCircle2 size={14} /> Accept & Confirm
                            </button>
                            <button 
                              className="btn-outline" 
                              onClick={() => { setRejectDispatchId(dispatch.id); setRejectReason(''); }}
                              style={{padding: '0.4rem 0.85rem', fontSize: '0.82rem', color: '#dc2626', borderColor: '#fca5a5'}}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{fontSize: '0.82rem', color: '#94a3b8'}}>Completed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROJECT MATERIAL CONSUMPTIONS */}
      {activeTab === 'consumptions' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
          <div style={{background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e40af'}}>
            <ShieldCheck size={22} />
            <div style={{fontSize: '0.9rem'}}>
              Whenever Admin approves your project's <strong>Material / Installation Stage</strong>, the exact panels, 10-ft GI pipes, cables, and bends entered in your technical specifications are automatically deducted from your stock ledger.
            </div>
          </div>

          <div className="stock-table-card">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Customer & Lead ID</th>
                  <th>Materials Consumed</th>
                  <th>Approved Date & By</th>
                </tr>
              </thead>
              <tbody>
                {myConsumptions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{textAlign: 'center', padding: '3.5rem', color: '#64748b'}}>
                      <FileSpreadsheet size={36} style={{margin: '0 auto 0.5rem', color: '#cbd5e1', display: 'block'}} />
                      <div style={{fontWeight: 700, fontSize: '1.05rem', color: '#334155'}}>No material consumption records yet.</div>
                      <p style={{fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px'}}>
                        When Admin approves Material / Installation stage for your leads, automatic deductions will be audited here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  myConsumptions.map(c => (
                    <tr key={c.id}>
                      <td><strong style={{color: '#6366f1'}}>{c.id}</strong></td>
                      <td>
                        <div style={{fontWeight: 700, color: '#0f172a'}}>{c.customerName}</div>
                        <div style={{fontSize: '0.75rem', color: '#64748b'}}>Lead #{c.leadId}</div>
                      </td>
                      <td>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.35rem'}}>
                          {c.itemsDeducted.map((itm, idx) => (
                            <span key={idx} style={{background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600}}>
                              -{itm.quantity} {itm.unit} {itm.itemName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{fontSize: '0.85rem', color: '#334155'}}>{c.date}</div>
                        <div style={{fontSize: '0.75rem', color: '#64748b'}}>By: {c.approvedBy}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: SITE RECOVERIES & RETURNS */}
      {activeTab === 'returns' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem'}}>
            <div>
              <h2 style={{fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0}}>Site Material Recoveries & Returns</h2>
              <p style={{fontSize: '0.85rem', color: '#64748b', margin: '3px 0 0'}}>
                Trace materials returned from customer installations, excess balance, and items sent back to Central Warehouse.
              </p>
            </div>
            <button 
              className="btn-primary" 
              onClick={() => setShowReturnModal(true)}
              style={{ background: '#0284c7', borderColor: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={15} /> Log Return from Site
            </button>
          </div>

          <div className="table-responsive" style={{background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'}}>
            <table className="admin-roster-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Customer / Site</th>
                  <th>Material & Quantity</th>
                  <th>Destination</th>
                  <th>Condition</th>
                  <th>Reason / Notes</th>
                  <th>Date & Logger</th>
                </tr>
              </thead>
              <tbody>
                {myReturns.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{textAlign: 'center', padding: '3rem', color: '#94a3b8'}}>
                      <RotateCcw size={36} style={{margin: '0 auto 0.5rem', opacity: 0.5}} />
                      <div style={{fontWeight: 700, fontSize: '1rem', color: '#475569'}}>No Site Recoveries Logged Yet</div>
                      <div style={{fontSize: '0.85rem'}}>When leftover pipes, cables, or panels return from site, click "Log Return from Site".</div>
                    </td>
                  </tr>
                ) : (
                  myReturns.map(r => (
                    <tr key={r.id}>
                      <td style={{fontWeight: 700, color: '#0284c7'}}>{r.id}</td>
                      <td>
                        <div style={{fontWeight: 700, color: '#0f172a'}}>{r.customerName || 'General Site Recovery'}</div>
                        {r.leadId && <div style={{fontSize: '0.75rem', color: '#64748b'}}>Lead #{r.leadId}</div>}
                      </td>
                      <td>
                        <div style={{fontWeight: 800, color: '#0f172a'}}>+{r.quantity} {r.unit}</div>
                        <div style={{fontSize: '0.78rem', color: '#64748b'}}>{r.itemName} ({r.itemSku})</div>
                      </td>
                      <td>
                        {r.destination === 'dealer_stock' ? (
                          <span style={{background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', padding: '3px 9px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
                            🏢 Kept in Dealer Stock
                          </span>
                        ) : (
                          <span style={{background: '#e0f2fe', border: '1px solid #bae6fd', color: '#0369a1', padding: '3px 9px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
                            🏭 Central Warehouse
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          background: r.condition === 'Good / Reusable' ? '#f0fdf4' : '#fef2f2',
                          color: r.condition === 'Good / Reusable' ? '#166534' : '#991b1b',
                          border: `1px solid ${r.condition === 'Good / Reusable' ? '#dcfce7' : '#fee2e2'}`,
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600
                        }}>
                          {r.condition}
                        </span>
                      </td>
                      <td style={{fontSize: '0.82rem', color: '#475569', maxWidth: '220px'}}>
                        {r.reason}
                      </td>
                      <td>
                        <div style={{fontSize: '0.85rem', color: '#334155'}}>{r.loggedAt}</div>
                        <div style={{fontSize: '0.75rem', color: '#64748b'}}>By: {r.loggedBy}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REQUEST MATERIAL FROM ADMIN */}
      {activeTab === 'request' && (
        <div style={{maxWidth: '650px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', margin: '0 auto', width: '100%'}}>
          <h2 style={{fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem'}}>Request Materials from Admin</h2>
          <p style={{fontSize: '0.88rem', color: '#64748b', marginBottom: '1.5rem'}}>
            Submit a replenishment request to Admin for urgent solar equipment or upcoming project installations.
          </p>

          <form onSubmit={handleStockRequestSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
            <div className="form-group">
              <label style={{fontWeight: 700}}>Select Required Equipment *</label>
              <select 
                value={requestForm.itemSku} 
                onChange={e => setRequestForm({...requestForm, itemSku: e.target.value})}
                style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600}}
                required
              >
                <option value="">-- Choose Stock Item --</option>
                {stockItems.filter(i => !i.archived).map(i => (
                  <option key={i.sku} value={i.sku}>{i.name} ({i.sku})</option>
                ))}
              </select>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
              <div className="form-group">
                <label style={{fontWeight: 700}}>Requested Quantity *</label>
                <input 
                  type="number" 
                  min="1" 
                  value={requestForm.quantity} 
                  onChange={e => setRequestForm({...requestForm, quantity: parseInt(e.target.value) || 1})}
                  style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{fontWeight: 700}}>Required By Date *</label>
                <input 
                  type="date" 
                  value={requestForm.requiredDate} 
                  onChange={e => setRequestForm({...requestForm, requiredDate: e.target.value})}
                  style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{fontWeight: 700}}>Notes / Project Reference</label>
              <textarea 
                placeholder="Mention project lead, site location, or urgent dispatch requirements..."
                value={requestForm.notes}
                onChange={e => setRequestForm({...requestForm, notes: e.target.value})}
                style={{width: '100%', minHeight: '90px', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}
              />
            </div>

            <button type="submit" className="btn-primary" style={{padding: '0.75rem', fontSize: '1rem', fontWeight: 700}}>
              Submit Material Request
            </button>
          </form>
        </div>
      )}

      {/* REJECT DISPATCH MODAL */}
      {rejectDispatchId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '480px'}}>
            <h2 style={{color: '#991b1b', fontSize: '1.25rem'}}>Reject Stock Dispatch: {rejectDispatchId}</h2>
            <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem'}}>
              Please provide the reason for rejecting this shipment. The stock will be returned to Admin central warehouse.
            </p>
            <textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)}
              placeholder="E.g. Damaged panels in transit, missing 10-ft GI pipes, wrong cable gauge..."
              style={{width: '100%', minHeight: '90px', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem'}}
            />
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setRejectDispatchId(null)}>Cancel</button>
              <button className="btn-primary" style={{background: '#dc2626', borderColor: '#dc2626'}} onClick={handleRejectDispatchSubmit}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ↩️ RETURN MATERIAL FROM SITE MODAL */}
      {showReturnModal && (
        <div className="modal-overlay" onClick={() => !isSubmittingReturn && setShowReturnModal(false)}>
          <div className="modal-content" style={{maxWidth: '560px'}} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <div style={{width: '38px', height: '38px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h2 style={{fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0}}>Log Material Return from Site</h2>
                  <p style={{fontSize: '0.8rem', color: '#64748b', margin: 0}}>Recover excess, unused, or returned equipment from customer site</p>
                </div>
              </div>
              <button className="detail-close" onClick={() => setShowReturnModal(false)} disabled={isSubmittingReturn}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div className="form-group">
                <label style={{fontWeight: 700, fontSize: '0.85rem'}}>Customer Installation / Site</label>
                <select 
                  value={returnForm.leadId} 
                  onChange={e => {
                    const lead = myLeads.find(l => l.id === e.target.value);
                    setReturnForm({
                      ...returnForm, 
                      leadId: e.target.value,
                      customerName: lead ? lead.customer : ''
                    });
                  }}
                  style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600}}
                >
                  <option value="">-- General Site / Warehouse Recovery --</option>
                  {myLeads.map(l => (
                    <option key={l.id} value={l.id}>{l.customer} - {l.location || 'Site'} ({l.stage})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{fontWeight: 700, fontSize: '0.85rem'}}>Equipment / Material Returned *</label>
                <select 
                  value={returnForm.itemSku} 
                  onChange={e => setReturnForm({...returnForm, itemSku: e.target.value})}
                  style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600}}
                  required
                >
                  <option value="">-- Choose Returned Equipment --</option>
                  {stockItems.filter(i => !i.archived).map(i => (
                    <option key={i.sku} value={i.sku}>{i.name} ({i.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="form-group">
                  <label style={{fontWeight: 700, fontSize: '0.85rem'}}>Returned Quantity *</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={returnForm.quantity} 
                    onChange={e => setReturnForm({...returnForm, quantity: parseInt(e.target.value) || 1})}
                    style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700}}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{fontWeight: 700, fontSize: '0.85rem'}}>Item Condition *</label>
                  <select 
                    value={returnForm.condition} 
                    onChange={e => setReturnForm({...returnForm, condition: e.target.value as any})}
                    style={{width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}
                  >
                    <option value="Good / Reusable">✓ Good / Reusable</option>
                    <option value="Damaged / Faulty">⚠️ Damaged / Faulty</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label style={{fontWeight: 700, fontSize: '0.85rem'}}>Where Should This Material Go? *</label>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '4px'}}>
                  <label style={{
                    display: 'flex', flexDirection: 'column', gap: '4px', padding: '0.85rem',
                    borderRadius: '10px', border: `2px solid ${returnForm.destination === 'dealer_stock' ? '#0284c7' : '#e2e8f0'}`,
                    background: returnForm.destination === 'dealer_stock' ? '#f0f9ff' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#0f172a', fontSize: '0.88rem'}}>
                      <input 
                        type="radio" 
                        name="dest" 
                        checked={returnForm.destination === 'dealer_stock'} 
                        onChange={() => setReturnForm({...returnForm, destination: 'dealer_stock'})} 
                      />
                      🏢 Store in My Stock
                    </div>
                    <span style={{fontSize: '0.75rem', color: '#64748b'}}>Credited back to your dealer inventory for the next site.</span>
                  </label>

                  <label style={{
                    display: 'flex', flexDirection: 'column', gap: '4px', padding: '0.85rem',
                    borderRadius: '10px', border: `2px solid ${returnForm.destination === 'central_warehouse' ? '#0284c7' : '#e2e8f0'}`,
                    background: returnForm.destination === 'central_warehouse' ? '#f0f9ff' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#0f172a', fontSize: '0.88rem'}}>
                      <input 
                        type="radio" 
                        name="dest" 
                        checked={returnForm.destination === 'central_warehouse'} 
                        onChange={() => setReturnForm({...returnForm, destination: 'central_warehouse'})} 
                      />
                      🏭 Send to Warehouse
                    </div>
                    <span style={{fontSize: '0.75rem', color: '#64748b'}}>Returned back to Admin Central Warehouse.</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label style={{fontWeight: 700, fontSize: '0.85rem'}}>Reason / Return Notes</label>
                <textarea 
                  placeholder="E.g. Unused 2 GI pipes, leftover 15m DC cable from 3kW installation, customer roof layout change..."
                  value={returnForm.reason}
                  onChange={e => setReturnForm({...returnForm, reason: e.target.value})}
                  style={{width: '100%', minHeight: '80px', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1'}}
                />
              </div>

              <div style={{display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem'}}>
                <button type="button" className="btn-outline" onClick={() => setShowReturnModal(false)} disabled={isSubmittingReturn}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{background: '#0284c7', borderColor: '#0284c7', fontWeight: 700}} disabled={isSubmittingReturn}>
                  {isSubmittingReturn ? 'Recording Return...' : 'Confirm & Save Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
