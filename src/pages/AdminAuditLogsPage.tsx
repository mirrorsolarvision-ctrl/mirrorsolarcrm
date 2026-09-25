import React, { useState, useMemo } from 'react';
import { 
  Shield, Search, Filter, Clock, Activity, FileText, 
  User, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Download
} from 'lucide-react';
import { useAudit } from '../context/AuditLogContext';
import type { AuditAction, EntityType } from '../types/audit';
import './AdminAuditLogsPage.css';

export default function AdminAuditLogsPage() {
  const { logs } = useAudit();
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [actionFilter, setActionFilter] = useState<string>('All');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && !(
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        (log.entityLabel && log.entityLabel.toLowerCase().includes(q)) ||
        (log.reason && log.reason.toLowerCase().includes(q))
      )) return false;

      if (entityFilter !== 'All' && log.entityType !== entityFilter) return false;
      if (actionFilter !== 'All' && log.action !== actionFilter) return false;
      return true;
    });
  }, [logs, searchQuery, entityFilter, actionFilter]);

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Label', 'Reason'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.userName,
      l.userRole,
      l.action,
      l.entityType,
      `"${l.entityLabel || ''}"`,
      `"${l.reason || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `solar_crm_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-audit-page">
      <div className="aap-header">
        <div>
          <div className="aap-breadcrumb">Security & Compliance / Audit Trail</div>
          <div className="aap-title-row">
            <h1>System-Wide Audit Logs</h1>
            <span className="aap-badge"><Shield size={13} /> Tamper-Evident History</span>
          </div>
          <p className="aap-sub">Complete audit record of quotation changes, inventory actions, price edits, and stage progressions.</p>
        </div>
        <button className="btn-outline" onClick={exportCSV}>
          <Download size={16} /> Export Audit CSV
        </button>
      </div>

      <div className="aap-main-card">
        <div className="aap-toolbar">
          <div className="aap-search">
            <Search size={16} color="#64748B" />
            <input 
              type="text" 
              placeholder="Search audit logs by user, action, entity, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="aap-select" 
            value={entityFilter} 
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="All">All Entities</option>
            <option value="Quotation">Quotations</option>
            <option value="Inventory">Inventory</option>
            <option value="Attendance">Attendance</option>
            <option value="Lead">Leads</option>
            <option value="User">Users</option>
          </select>
        </div>

        <div className="aap-table-wrapper">
          <table className="aap-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>ACTOR</th>
                <th>ACTION</th>
                <th>ENTITY</th>
                <th>DETAILS & REASON</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="aap-time-cell">
                    <span className="font-semibold text-navy">
                      {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-muted text-xs">
                      {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </td>
                  <td>
                    <div className="aap-user-cell">
                      <span className="font-bold text-navy">{log.userName}</span>
                      <span className="aap-role-pill">{log.userRole}</span>
                    </div>
                  </td>
                  <td>
                    <span className="aap-action-tag">{log.action.replace(/_/g, ' ')}</span>
                  </td>
                  <td>
                    <span className="aap-entity-badge">{log.entityType}</span>
                  </td>
                  <td>
                    <div className="aap-detail-cell">
                      <span className="font-semibold text-navy">{log.entityLabel || log.entityId}</span>
                      {log.reason && <span className="text-muted text-xs">Reason: {log.reason}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                    No audit records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
