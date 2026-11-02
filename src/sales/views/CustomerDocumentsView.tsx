import React, { useState, useMemo } from 'react';
import { 
  Folder, FileText, CheckCircle2, AlertTriangle, 
  Upload, Eye, Check, X, ShieldCheck, Download
} from 'lucide-react';
import { useCRM, type MockLead } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import type { CustomerDocType } from '../../types/sales';

interface CustomerDocumentsViewProps {
  onNavigateSubView?: (view: any, params?: any) => void;
  initialLeadId?: string;
}

const REQUIRED_DOC_TYPES: { type: CustomerDocType; label: string; desc: string; required: boolean }[] = [
  { type: 'Electricity Bill', label: 'Latest Electricity Bill', desc: 'Clear copy showing consumer service number and sanctioned load', required: true },
  { type: 'Aadhaar Card', label: 'Aadhaar / Identity Proof', desc: 'Aadhaar card of the electricity connection owner for subsidy credit', required: true },
  { type: 'Roof Document', label: 'Property / Roof Ownership Document', desc: 'House tax receipt, sale deed, or municipal property document', required: false },
  { type: 'Site Photo', label: 'Rooftop Site Survey Photographs', desc: 'Clear panoramic photos of shadow-free roof area and meter box', required: true },
  { type: 'Consent Form', label: 'PM Surya Ghar Customer Consent', desc: 'Signed application for national portal registration and net-metering', required: true },
  { type: 'Payment Proof', label: 'Advance Payment Receipt / Bank UTR', desc: 'Transaction evidence screenshot or official company receipt', required: true }
];

export default function CustomerDocumentsView({
  onNavigateSubView: _onNavigateSubView,
  initialLeadId
}: CustomerDocumentsViewProps) {
  const { currentUser, leads, updateLead, addActivity } = useCRM();
  const isManager = isSalesManager(currentUser);
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  // Scoped leads
  const scopedLeads = useMemo(() => {
    if (isManager) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, currentUserName, currentUserId]);

  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || (scopedLeads[0]?.id || ''));
  const [uploadDocType, setUploadDocType] = useState<CustomerDocType | null>(null);
  const [fileNameInput, setFileNameInput] = useState('');

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  // Lead documents
  const activeDocs = useMemo(() => {
    return activeLead?.documents || [];
  }, [activeLead]);

  // Handle Upload Simulated File
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !uploadDocType) return;

    const newDoc = {
      id: `DOC-${Date.now()}`,
      leadId: activeLead.id,
      documentType: uploadDocType,
      fileName: fileNameInput || `${uploadDocType.toLowerCase().replace(/\s+/g, '_')}_scan.pdf`,
      name: fileNameInput || `${uploadDocType.toLowerCase().replace(/\s+/g, '_')}_scan.pdf`,
      category: uploadDocType,
      fileSize: 1024 * 350,
      fileType: 'application/pdf',
      fileUrl: '',
      uploadedByRole: isManager ? 'Sales Manager' : 'Telecaller',
      uploadedByUserId: currentUserId,
      uploadedAt: new Date().toISOString(),
      status: 'Uploaded' as const
    };

    const updated = [...(activeLead.documents || []), newDoc];
    await updateLead(activeLead.id, {
      documents: updated as any
    });

    addActivity({
      type: 'Document Uploaded',
      message: `Document (${uploadDocType}) uploaded for customer ${activeLead.customer}`,
      user: currentUserName,
      leadId: activeLead.id
    });

    setUploadDocType(null);
    setFileNameInput('');
  };

  return (
    <div className="customer-documents-content">
      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Customer KYC & PM Surya Ghar Documents
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Manage essential rooftop KYC papers, site survey photos, and customer subsidy consent forms.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>Customer:</label>
            <select 
              className="sales-form-control"
              style={{ width: 'auto', minWidth: '220px' }}
              value={selectedLeadId}
              onChange={e => setSelectedLeadId(e.target.value)}
            >
              {scopedLeads.map(l => (
                <option key={l.id} value={l.id}>{l.customer} ({l.phone})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeLead && (
        <div className="sales-panel">
          <div className="sales-panel-header">
            <h3 className="sales-panel-title">
              <Folder size={20} color="#0284c7" />
              Document Checklist: {activeLead.customer}
            </h3>
            <span className="sales-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
              {activeDocs.length} of {REQUIRED_DOC_TYPES.length} Uploaded
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {REQUIRED_DOC_TYPES.map(item => {
              const matchingDoc = activeDocs.find(d => 
                (d.category || d.documentType || '').toLowerCase().includes(item.type.toLowerCase()) || 
                (d.name || d.fileName || '').toLowerCase().includes(item.type.toLowerCase())
              );
              const isUploaded = !!matchingDoc;

              return (
                <div 
                  key={item.type}
                  style={{
                    background: isUploaded ? '#f0fdf4' : '#f8fafc',
                    border: isUploaded ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0b1f3a' }}>
                        {item.label}
                      </span>
                      <span className={`sales-badge ${isUploaded ? 'connected' : 'cold'}`}>
                        {isUploaded ? '✓ Uploaded' : 'Pending Upload'}
                      </span>
                    </div>

                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                      {item.desc}
                    </p>

                    {matchingDoc && (
                      <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.5rem', background: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                        📄 {matchingDoc.fileName || matchingDoc.name || 'Document'} • {matchingDoc.uploadedAt ? new Date(matchingDoc.uploadedAt).toLocaleDateString() : 'Active'}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="sales-btn-primary" 
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', background: isUploaded ? '#16a34a' : '#0284c7' }}
                      onClick={() => setUploadDocType(item.type)}
                    >
                      <Upload size={14} /> {isUploaded ? 'Re-upload / Update' : 'Upload Document'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadDocType && activeLead && (
        <div className="sales-modal-overlay" onClick={() => setUploadDocType(null)}>
          <div className="sales-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sales-modal-header">
              <h3>Upload Document: {uploadDocType}</h3>
              <button className="sales-modal-close-btn" onClick={() => setUploadDocType(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="sales-modal-body">
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Customer: <strong>{activeLead.customer}</strong> ({activeLead.phone})
                </p>

                <div className="sales-form-group">
                  <label>Document File Name / Reference *</label>
                  <input 
                    type="text" 
                    required 
                    className="sales-form-control"
                    placeholder={`e.g. ${activeLead.customer.toLowerCase().replace(/\s+/g, '_')}_${uploadDocType.toLowerCase().replace(/\s+/g, '_')}.pdf`}
                    value={fileNameInput}
                    onChange={e => setFileNameInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="sales-modal-footer">
                <button type="button" className="sales-btn-secondary" onClick={() => setUploadDocType(null)}>Cancel</button>
                <button type="submit" className="sales-btn-primary">Confirm & Attach Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
