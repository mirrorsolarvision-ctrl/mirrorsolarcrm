import { useState, useMemo } from 'react';
import { Mail, Phone, Briefcase, Activity, CheckCircle2, MapPin, Users, TrendingUp, User, Zap, Award, Gauge } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { getDealerPerformance } from '../utils/dealerCalculations';
import PageHero from '../components/PageHero';
import '../SharedProfile.css';

export default function DealerProfilePage() {
  const { currentUser, leads } = useCRM();
  
  // Local editable state
  const [formData, setFormData] = useState({
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    address: currentUser?.address || ''
  });

  if (!currentUser) return null;

  // Derived Performance Data
  const performance = useMemo(() => getDealerPerformance(currentUser.name, leads), [currentUser.name, leads]);
  const myLeads = leads.filter(l => l.dealer === currentUser.name && !l.archived);
  const totalLeads = myLeads.length;
  const convertedLeads = myLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  
  // Assigned Employees
  const assignedEmployees = Array.from(new Set(myLeads.map(l => l.assignedEmployee))).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role === 'Dealer') {
      console.log('Saved mock dealer data:', formData);
    }
  };

  return (
    <div className="dealer-profile-container" style={{ padding: 0 }}>
      <PageHero
        badge="Dealer Workspace Account"
        icon={<User size={26} />}
        title="Dealership Profile & Settings"
        subtitle="Manage your business contact details, address, and track your 18-month milestone quota."
      />

      <div style={{ padding: '1.5rem 2rem' }}>

      <div className="profile-layout-grid">
        
        {/* Left Column: Avatar Card */}
        <div className="profile-card-left">
          <div className="profile-avatar-wrapper">
            <span className="profile-avatar-text">{currentUser.initials}</span>
          </div>
          <h2 className="profile-name-title">{currentUser.name}</h2>
          <span className="profile-role-pill">{currentUser.role}</span>
          
          <div style={{marginTop: '1.5rem', width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#475569'}}>
              <span>18M Target: 225 kW</span>
              <span style={{color: '#0284c7'}}>{performance.targetProgressPercent}%</span>
            </div>
            <div style={{height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden'}}>
              <div style={{height: '100%', width: `${Math.min(100, Math.max(2, performance.targetProgressPercent))}%`, background: 'linear-gradient(90deg, #0284c7, #16a34a)', borderRadius: '999px'}} />
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: '#64748b'}}>
              <span>{performance.totalConvertedKw} kW Done</span>
              <span>{performance.remainingKw} kW Left</span>
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Performance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Target Banner */}
          <div className="profile-card-right" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', border: '1px solid #334155'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <h3 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#facc15', fontSize: '1.1rem', fontWeight: 800}}>
                <Award size={20} /> Official Dealership Target (225 kW / 18 Months)
              </h3>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: performance.targetStatus === 'Exceeded' ? 'rgba(59, 130, 246, 0.3)' : performance.targetStatus === 'On Track' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: performance.targetStatus === 'Exceeded' ? '#93c5fd' : performance.targetStatus === 'On Track' ? '#6ee7b7' : '#fcd34d'
              }}>
                {performance.targetStatus === 'Exceeded' ? '🎉 Quota Exceeded' : performance.targetStatus === 'On Track' ? '🔥 Pace On Track' : '⚡ Attention Needed'}
              </span>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginTop: '1rem'}}>
              <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.85rem', borderRadius: '8px'}}>
                <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600}}>TARGET GOAL</div>
                <div style={{fontSize: '1.25rem', fontWeight: 800, color: '#facc15', marginTop: '2px'}}>225.0 kW</div>
                <div style={{fontSize: '0.7rem', color: '#64748b'}}>18 Months Total</div>
              </div>
              <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.85rem', borderRadius: '8px'}}>
                <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600}}>CONVERTED</div>
                <div style={{fontSize: '1.25rem', fontWeight: 800, color: '#34d399', marginTop: '2px'}}>{performance.totalConvertedKw} kW</div>
                <div style={{fontSize: '0.7rem', color: '#64748b'}}>{performance.targetProgressPercent}% of goal</div>
              </div>
              <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.85rem', borderRadius: '8px'}}>
                <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600}}>IN PIPELINE</div>
                <div style={{fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px'}}>{performance.inPipelineKw} kW</div>
                <div style={{fontSize: '0.7rem', color: '#64748b'}}>Active Leads</div>
              </div>
              <div style={{background: 'rgba(255,255,255,0.06)', padding: '0.85rem', borderRadius: '8px'}}>
                <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600}}>MONTHLY PACE</div>
                <div style={{fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', marginTop: '2px'}}>12.5 kW</div>
                <div style={{fontSize: '0.7rem', color: '#64748b'}}>Required / month</div>
              </div>
            </div>
          </div>

          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <User className="profile-section-icon" size={20} /> Personal Information
            </h3>
            
            <form className="premium-form" onSubmit={handleSave}>
              <div className="premium-input-group">
                <label>Full Name</label>
                <input type="text" value={currentUser.name} disabled />
              </div>
              
              <div className="premium-input-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  required 
                />
              </div>
              
              <div className="premium-input-group">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  required 
                />
              </div>

              <div className="premium-input-group">
                <label>Business Address</label>
                <textarea 
                  rows={2} 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                  placeholder="Enter your business address"
                ></textarea>
              </div>

              <button type="submit" className="premium-btn-primary">Save Changes</button>
            </form>
          </div>

          <div className="profile-card-right">
            <h3 className="profile-section-title">
              <Activity className="profile-section-icon" size={20} /> Performance Snapshot
            </h3>
            
            <div className="performance-grid">
              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <Activity size={16} /> Total Leads
                </span>
                <span className="perf-metric-value">{totalLeads}</span>
              </div>
              
              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <CheckCircle2 size={16} style={{ color: '#16a34a' }} /> Converted
                </span>
                <span className="perf-metric-value">{convertedLeads}</span>
              </div>

              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <TrendingUp size={16} style={{ color: 'var(--color-orange)' }} /> Conversion Rate
                </span>
                <span className="perf-metric-value">{conversionRate}%</span>
              </div>

              <div className="perf-metric-card">
                <span className="perf-metric-header">
                  <Users size={16} /> Assigned Employees
                </span>
                <span className="perf-metric-value">{assignedEmployees}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
