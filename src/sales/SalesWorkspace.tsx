import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, PhoneCall, UserCheck, 
  GitFork, Clock, MessageSquare, FileText, 
  CreditCard, Building, Folder, BarChart3, 
  Award, ShieldCheck, Phone
} from 'lucide-react';
import { useCRM, type MockLead } from '../context/CRMContext';
import { isSalesManager } from '../utils/permissionCalculations';
import type { SalesSubView } from '../types/sales';

import SalesDashboardView from './views/SalesDashboardView';
import SalesLeadsView from './views/SalesLeadsView';
import TelecallingCentreView from './views/TelecallingCentreView';
import CustomerQualificationView from './views/CustomerQualificationView';
import SalesPipelineView from './views/SalesPipelineView';
import SalesFollowupsView from './views/SalesFollowupsView';
import WhatsAppCentreView from './views/WhatsAppCentreView';
import SalesQuotationsView from './views/SalesQuotationsView';
import SalesBookingsView from './views/SalesBookingsView';
import SalesDealerCoordinationView from './views/SalesDealerCoordinationView';
import CustomerDocumentsView from './views/CustomerDocumentsView';
import SalesReportsView from './views/SalesReportsView';
import SalesTeamPerformanceView from './views/SalesTeamPerformanceView';

import './salesStyles.css';

interface SalesWorkspaceProps {
  initialSubView?: SalesSubView;
  onNavigateGlobal?: (path: string) => void;
}

export default function SalesWorkspace({
  initialSubView = 'dashboard',
  onNavigateGlobal: _onNavigateGlobal
}: SalesWorkspaceProps) {
  const { currentUser, leads } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  const [activeSubView, setActiveSubView] = useState<SalesSubView>(initialSubView);
  const [subViewParams, setSubViewParams] = useState<any>(null);

  // Sync initialSubView when passed from route changes
  useEffect(() => {
    if (initialSubView) {
      setActiveSubView(initialSubView);
    }
  }, [initialSubView]);

  // Modal helpers for quick call logging or whatsapp
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<MockLead | null>(null);

  const handleOpenCallLogModal = (lead?: MockLead) => {
    if (lead) setSelectedLeadForCall(lead);
    setActiveSubView('telecalling');
  };

  const handleOpenWhatsApp = (lead: MockLead) => {
    setActiveSubView('whatsapp');
    setSubViewParams({ leadId: lead.id });
  };

  const handleNavigateSubView = (view: SalesSubView, params?: any) => {
    setActiveSubView(view);
    setSubViewParams(params || null);
  };

  // Badges calculation
  const todayStr = new Date().toISOString().split('T')[0];
  const scopedLeads = isManager 
    ? leads.filter(l => !l.archived)
    : leads.filter(l => !l.archived && (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId));

  const overdueFollowupsCount = scopedLeads.filter(l => {
    if (!l.followUp?.date || l.followUp.status === 'Completed') return false;
    return l.followUp.date < todayStr || l.followUp.status === 'Overdue';
  }).length;

  const newLeadsCount = scopedLeads.filter(l => l.salesStage === 'New Lead' || !l.salesStage).length;

  // Sub-Navigation Tabs definition
  const subNavItems: { id: SalesSubView; label: string; icon: any; managerOnly?: boolean; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', label: isManager ? 'Team Leads' : 'My Leads', icon: Users, badge: newLeadsCount },
    { id: 'telecalling', label: 'Telecalling Centre', icon: PhoneCall },
    { id: 'qualification', label: 'Customer Qualification', icon: UserCheck },
    { id: 'pipeline', label: 'Sales Pipeline (12 Stages)', icon: GitFork },
    { id: 'followups', label: 'Follow-ups & Tasks', icon: Clock, badge: overdueFollowupsCount },
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'bookings', label: 'Bookings & Payments', icon: CreditCard },
    { id: 'dealers', label: 'Site Survey & Dealers', icon: Building },
    { id: 'documents', label: 'Customer Documents', icon: Folder },
    { id: 'reports', label: 'Sales Reports', icon: BarChart3 },
    ...(isManager ? [{ id: 'performance' as SalesSubView, label: 'Team Performance', icon: Award, managerOnly: true }] : [])
  ];

  return (
    <div className="sales-workspace-container">
      {/* Top Header */}
      <div className="sales-top-header">
        <div className="sales-header-title">
          <div>
            <h1>MIRROR SOLAR VISION — Sales Department</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
              <span className={`sales-role-badge ${isManager ? 'manager' : 'telecaller'}`}>
                {isManager ? 'Role: Sales Manager (Full Team Authority)' : 'Role: Telecaller (Assigned Enquiries Authority)'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Logged in as <strong>{currentUserName}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="sales-header-actions">
          <button 
            className="sales-btn-secondary"
            onClick={() => handleNavigateSubView('telecalling')}
          >
            <PhoneCall size={15} /> Dial Desk
          </button>
        </div>
      </div>

      {/* Sub-Navigation Strip (12 Modules + Team Performance) */}
      <div className="sales-subnav-bar">
        {subNavItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSubView === item.id;

          return (
            <button
              key={item.id}
              className={`sales-subnav-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveSubView(item.id);
                setSubViewParams(null);
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="sales-subnav-badge">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Active Sub-View Body */}
      <div className="sales-workspace-body">
        {activeSubView === 'dashboard' && (
          <SalesDashboardView 
            onNavigateSubView={handleNavigateSubView}
            onOpenCallLogModal={handleOpenCallLogModal}
            onOpenWhatsApp={handleOpenWhatsApp}
          />
        )}

        {activeSubView === 'leads' && (
          <SalesLeadsView 
            onNavigateSubView={handleNavigateSubView}
            onOpenCallLogModal={handleOpenCallLogModal}
            onOpenWhatsApp={handleOpenWhatsApp}
            initialFilter={subViewParams?.filter || 'all'}
          />
        )}

        {activeSubView === 'telecalling' && (
          <TelecallingCentreView 
            onNavigateSubView={handleNavigateSubView}
            selectedLeadForCall={selectedLeadForCall}
            onCloseCallModal={() => setSelectedLeadForCall(null)}
          />
        )}

        {activeSubView === 'qualification' && (
          <CustomerQualificationView 
            onNavigateSubView={handleNavigateSubView}
            initialLeadId={subViewParams?.leadId}
          />
        )}

        {activeSubView === 'pipeline' && (
          <SalesPipelineView 
            onNavigateSubView={handleNavigateSubView}
            onOpenCallLogModal={handleOpenCallLogModal}
            onOpenWhatsApp={handleOpenWhatsApp}
          />
        )}

        {activeSubView === 'followups' && (
          <SalesFollowupsView 
            onNavigateSubView={handleNavigateSubView}
            onOpenCallLogModal={handleOpenCallLogModal}
            onOpenWhatsApp={handleOpenWhatsApp}
            initialFilter={subViewParams?.filter || 'today'}
          />
        )}

        {activeSubView === 'whatsapp' && (
          <WhatsAppCentreView 
            onNavigateSubView={handleNavigateSubView}
            initialLeadId={subViewParams?.leadId}
          />
        )}

        {activeSubView === 'quotations' && (
          <SalesQuotationsView 
            onNavigateSubView={handleNavigateSubView}
            initialLeadId={subViewParams?.leadId}
          />
        )}

        {activeSubView === 'bookings' && (
          <SalesBookingsView 
            onNavigateSubView={handleNavigateSubView}
            initialLeadId={subViewParams?.leadId}
          />
        )}

        {activeSubView === 'dealers' && (
          <SalesDealerCoordinationView 
            onNavigateSubView={handleNavigateSubView}
            initialLeadId={subViewParams?.leadId}
          />
        )}

        {activeSubView === 'documents' && (
          <CustomerDocumentsView 
            onNavigateSubView={handleNavigateSubView}
            initialLeadId={subViewParams?.leadId}
          />
        )}

        {activeSubView === 'reports' && (
          <SalesReportsView 
            onNavigateSubView={handleNavigateSubView}
          />
        )}

        {activeSubView === 'performance' && isManager && (
          <SalesTeamPerformanceView 
            onNavigateSubView={handleNavigateSubView}
          />
        )}
      </div>
    </div>
  );
}
