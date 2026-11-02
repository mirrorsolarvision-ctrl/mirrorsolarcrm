import React, { useMemo } from 'react';
import { 
  Users, Award, TrendingUp, PhoneCall, CheckCircle2, 
  AlertTriangle, Clock, RefreshCw, ArrowRight, ShieldAlert
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';

interface SalesTeamPerformanceViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
}

export default function SalesTeamPerformanceView({ onNavigateSubView: _onNavigateSubView }: SalesTeamPerformanceViewProps) {
  const { currentUser, leads, employees, callLogs, updateLead, addActivity } = useCRM();
  const isManager = isSalesManager(currentUser);

  // Active Telecallers & Sales Team
  const salesTeamEmployees = useMemo(() => {
    return employees.filter(e => 
      e.status === 'Active' && 
      (e.employeeCategory?.toLowerCase().includes('telecaller') || 
       e.employeeCategory?.toLowerCase().includes('sales') || 
       e.responsibilities?.primaryResponsibilityId?.includes('sales') ||
       e.responsibilities?.primaryResponsibilityId?.includes('telecaller'))
    );
  }, [employees]);

  // Compute performance per telecaller
  const performanceRows = useMemo(() => {
    return salesTeamEmployees.map(emp => {
      const empLeads = leads.filter(l => 
        !l.archived && 
        (l.assignedEmployee === emp.name || l.assignedEmployeeId === emp.id || l.leadOwnerId === emp.id)
      );

      const empCalls = callLogs.filter(c => 
        c.telecallerId === emp.id || c.telecallerName === emp.name
      );

      const connectedCalls = empCalls.filter(c => c.outcome.startsWith('Connected')).length;
      const connectRate = empCalls.length > 0 ? Math.round((connectedCalls / empCalls.length) * 100) : 0;

      const qualified = empLeads.filter(l => l.salesStage === 'Qualified' || (l.leadScore && l.leadScore.total >= 50)).length;
      const bookings = empLeads.filter(l => l.salesStage === 'Booking Confirmed' || l.salesStage === 'Project Handoff' || l.stage === 'Converted').length;
      const conversionPct = empLeads.length > 0 ? Math.round((bookings / empLeads.length) * 100) : 0;

      const slaBreached = empLeads.filter(l => l.slaStatus === 'SLA Breached').length;
      const slaAdherencePct = empLeads.length > 0 
        ? Math.max(0, Math.round(((empLeads.length - slaBreached) / empLeads.length) * 100)) 
        : 100;

      return {
        id: emp.id,
        name: emp.name,
        category: emp.employeeCategory || 'Telecaller',
        phone: emp.phone,
        totalLeads: empLeads.length,
        totalCalls: empCalls.length,
        connectRate,
        qualified,
        bookings,
        conversionPct,
        slaAdherencePct
      };
    });
  }, [salesTeamEmployees, leads, callLogs]);

  // Pending Reassignment Requests
  const pendingReassignments = useMemo(() => {
    return leads.filter(l => !l.archived && l.reassignmentRequest?.status === 'Pending');
  }, [leads]);

  // Approve Reassignment
  const handleApproveReassign = async (lead: MockLead, targetEmpName: string) => {
    const targetObj = employees.find(e => e.name === targetEmpName);
    await updateLead(lead.id, {
      assignedEmployee: targetEmpName,
      assignedEmployeeId: targetObj?.id || '',
      leadOwnerName: targetEmpName,
      leadOwnerId: targetObj?.id || '',
      reassignmentRequest: undefined
    });

    addActivity({
      type: 'Reassignment Approved',
      message: `Lead ${lead.customer} reassigned to ${targetEmpName} by Sales Manager`,
      user: currentUser?.name || 'Sales Manager',
      leadId: lead.id
    });
  };

  if (!isManager) {
    return (
      <div className="sales-panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <ShieldAlert size={40} color="#dc2626" style={{ margin: '0 auto 0.75rem auto' }} />
        <h3 style={{ margin: 0, color: '#0b1f3a' }}>Access Restricted</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Team performance comparative metrics and reassignment desk are exclusively accessible to Sales Managers.
        </p>
      </div>
    );
  }

  return (
    <div className="sales-performance-content">
      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Sales Team Performance & Productivity Leaderboard
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Sales Manager control view: compare telecalling volume, 15-minute SLA adherence, and conversion closing ratios.
            </p>
          </div>

          <span className="sales-role-badge manager">
            Sales Manager Exclusive View
          </span>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="sales-panel">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={18} color="#0284c7" /> Employee Calling & Booking Productivity
        </h3>

        <div className="sales-table-wrapper">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Telecaller Name</th>
                <th>Role / Category</th>
                <th>Assigned Leads</th>
                <th>Calls Logged</th>
                <th>Connect %</th>
                <th>15m SLA Adherence</th>
                <th>Qualified</th>
                <th>Confirmed Bookings</th>
                <th>Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {performanceRows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{row.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.phone}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#334155' }}>
                      {row.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{row.totalLeads}</td>
                  <td>{row.totalCalls}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: row.connectRate >= 60 ? '#16a34a' : '#d97706' }}>
                      {row.connectRate}%
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: row.slaAdherencePct >= 90 ? '#16a34a' : '#dc2626' }}>
                      {row.slaAdherencePct}%
                    </span>
                  </td>
                  <td>{row.qualified}</td>
                  <td>
                    <span className="sales-badge green" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {row.bookings} bookings
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#0284c7' }}>
                      {row.conversionPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Reassignment Desk */}
      <div className="sales-panel">
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={18} color="#d97706" /> Lead Reassignment Desk ({pendingReassignments.length} Pending)
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
          Review and approve lead reassignment requests submitted by telecallers.
        </p>

        {pendingReassignments.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
            ✓ No pending reassignment requests. Team workload is balanced!
          </p>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Customer Name & Phone</th>
                  <th>Current Telecaller</th>
                  <th>Reason for Request</th>
                  <th>Requested Date</th>
                  <th>Reassign To</th>
                </tr>
              </thead>
              <tbody>
                {pendingReassignments.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0b1f3a' }}>{lead.customer}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.phone} • {lead.location}</div>
                    </td>
                    <td>{lead.assignedEmployee || 'Unassigned'}</td>
                    <td style={{ maxWidth: '280px', fontSize: '0.825rem', color: '#b45309' }}>
                      {lead.reassignmentRequest?.reason || 'Reassignment requested'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {lead.reassignmentRequest?.requestedAt ? new Date(lead.reassignmentRequest.requestedAt).toLocaleDateString() : 'Today'}
                    </td>
                    <td>
                      <select 
                        className="sales-form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) handleApproveReassign(lead, e.target.value);
                        }}
                      >
                        <option value="">-- Choose Telecaller --</option>
                        {salesTeamEmployees.filter(e => e.name !== lead.assignedEmployee).map(e => (
                          <option key={e.id} value={e.name}>{e.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
