import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Folder, FileText, CheckCircle2, AlertTriangle, 
  Upload, Eye, Check, X, ShieldCheck, Download, 
  ExternalLink, RefreshCw, Trash2, Lock
} from 'lucide-react';
import { useCRM, type MockLead, type LeadDocument } from '../../context/CRMContext';
import { isSalesManager } from '../../utils/permissionCalculations';
import { DocumentUploadModal } from '../../components/DocumentUploadModal';
import { uploadFileToStorage, formatBytes, type CompressionPreset } from '../../utils/cloudStorageUtils';
import type { CustomerDocType } from '../../types/sales';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  const isAdmin = currentUser?.role === 'Admin';
  const currentUserName = currentUser?.name || '';
  const currentUserId = currentUser?.id || '';

  const empCat = (((currentUser as any)?.employeeCategory || (currentUser as any)?.category || '') as string).toLowerCase();
  const isSuryaGhar = empCat.includes('surya') || currentUserName.toLowerCase().includes('kumari');
  const isAccounts = (currentUser as any)?.role === 'Accounts' || empCat.includes('accounts');
  const canAccessKyc = isAdmin || isAccounts || isSuryaGhar;

  // Dedicated Firestore /leadKyc cache for authorized staff
  const [kycDocsMap, setKycDocsMap] = useState<Record<string, LeadDocument>>({});

  // Scoped leads
  const scopedLeads = useMemo(() => {
    if (isManager || isAdmin) return leads.filter(l => !l.archived);
    return leads.filter(l => 
      !l.archived && 
      (l.assignedEmployee === currentUserName || l.assignedEmployeeId === currentUserId || l.leadOwnerId === currentUserId)
    );
  }, [leads, isManager, isAdmin, currentUserName, currentUserId]);

  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || (scopedLeads[0]?.id || ''));

  const activeLead = useMemo(() => {
    return scopedLeads.find(l => l.id === selectedLeadId) || scopedLeads[0];
  }, [scopedLeads, selectedLeadId]);

  useEffect(() => {
    if (!canAccessKyc || !activeLead?.id) {
      setKycDocsMap({});
      return;
    }
    let isCancelled = false;
    getDoc(doc(db, 'leadKyc', activeLead.id)).then(snapshot => {
      if (!isCancelled && snapshot.exists()) {
        const data = snapshot.data();
        const map: Record<string, LeadDocument> = {};
        ((data.documents || []) as LeadDocument[]).forEach(d => {
          if (d.category) map[d.category] = d;
          if (d.documentType) map[d.documentType] = d;
        });
        setKycDocsMap(map);
      }
    }).catch(err => {
      console.warn("KYC document retrieval notice:", err.message);
    });
    return () => { isCancelled = true; };
  }, [canAccessKyc, activeLead?.id]);

  // Lead documents merged with secure KYC data for authorized roles
  const activeDocs = useMemo(() => {
    const raw = (activeLead?.documents || []) as LeadDocument[];
    if (!canAccessKyc) return raw;
    return raw.map(d => {
      const kycMatch = kycDocsMap[d.category || ''] || kycDocsMap[d.documentType || ''];
      if (kycMatch && kycMatch.fileUrl) {
        return { ...d, fileUrl: kycMatch.fileUrl };
      }
      return d;
    });
  }, [activeLead, canAccessKyc, kycDocsMap]);

  // Upload Modal & Progress States
  const [targetDocType, setTargetDocType] = useState<CustomerDocType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger file input for specific doc type
  const handleInitiateUpload = (docType: CustomerDocType, existingDocId?: string) => {
    setTargetDocType(docType);
    setReplacingDocId(existingDocId || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // When user selects a file from disk
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validation: Max 15MB size limit (storage.rules ceiling)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`File size exceeds 15MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please select a compressed file.`);
      return;
    }

    // 2. Validation: Allowed MIME types
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      alert('Invalid file format. Only PDF documents and JPG/PNG/WEBP images are allowed.');
      return;
    }

    setSelectedFile(file);
    setIsUploadModalOpen(true);
  };

  // Execute Firebase Storage Upload
  const handleConfirmUpload = async (
    processedFile: File,
    notes: string,
    preset: CompressionPreset
  ) => {
    if (!activeLead || !targetDocType) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const docId = replacingDocId || `DOC_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const isSensitiveKyc = targetDocType === 'Aadhaar Card' || targetDocType === 'Consent Form' || targetDocType === 'Electricity Bill';
      const folderPath = isSensitiveKyc 
        ? `leads/${activeLead.id}/kyc/${docId}` 
        : `leads/${activeLead.id}/documents/${docId}`;

      // Upload to Firebase Cloud Storage with progress updates
      const downloadUrl = await uploadFileToStorage(processedFile, folderPath, {
        compressPreset: preset,
        onProgress: (p) => setUploadProgress(p)
      });

      const safeFileName = processedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

      const fullDocRecord: LeadDocument = {
        id: docId,
        leadId: activeLead.id,
        name: safeFileName,
        documentType: targetDocType,
        category: targetDocType,
        fileName: safeFileName,
        fileSize: processedFile.size,
        fileType: processedFile.type || 'application/pdf',
        fileUrl: downloadUrl,
        uploadedByRole: isAdmin ? 'Admin' : isManager ? 'Sales Manager' : 'Telecaller',
        uploadedByUserId: currentUserId,
        uploadedAt: new Date().toISOString(),
        notes: notes || '',
        status: 'Uploaded'
      };

      // 1. If sensitive KYC, persist the tokenized download URL into sealed /leadKyc/{leadId}
      if (isSensitiveKyc) {
        try {
          const currentKycSnap = await getDoc(doc(db, 'leadKyc', activeLead.id));
          const existingKycDocs: LeadDocument[] = currentKycSnap.exists() ? (currentKycSnap.data()?.documents || []) : [];
          const updatedKycDocs = [
            ...existingKycDocs.filter(d => (d.category || d.documentType || '').toLowerCase() !== targetDocType.toLowerCase()),
            fullDocRecord
          ];
          await setDoc(doc(db, 'leadKyc', activeLead.id), {
            leadId: activeLead.id,
            documents: updatedKycDocs,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserName
          }, { merge: true });

          // Update local secure state immediately
          setKycDocsMap(prev => ({ ...prev, [targetDocType]: fullDocRecord }));
        } catch (kycErr) {
          console.warn("KYC collection persist warning:", kycErr);
        }
      }

      // 2. In general lead document, sanitize sensitive KYC to prevent token leaks
      const sanitizedDocForLead: LeadDocument = isSensitiveKyc ? {
        ...fullDocRecord,
        fileUrl: '', // Redacted: prevents token leakage to dealers and general users
        isKycSecured: true as any
      } : fullDocRecord;

      let updatedDocs: LeadDocument[] = [];
      if (replacingDocId) {
        updatedDocs = ((activeLead?.documents || []) as LeadDocument[]).map(d => d.id === replacingDocId ? sanitizedDocForLead : d);
      } else {
        // Prevent accidental duplicates of the same category
        const filtered = ((activeLead?.documents || []) as LeadDocument[]).filter(d => 
          (d.category || d.documentType || '').toLowerCase() !== targetDocType.toLowerCase()
        );
        updatedDocs = [...filtered, sanitizedDocForLead];
      }

      await updateLead(activeLead.id, {
        documents: updatedDocs as any
      });

      addActivity({
        type: replacingDocId ? 'Document Replaced' : 'Document Uploaded',
        message: `${targetDocType} (${safeFileName}) uploaded for customer ${activeLead.customer}`,
        user: currentUserName,
        leadId: activeLead.id
      });

      setStatusMessage({ text: `Successfully uploaded ${targetDocType}!`, type: 'success' });
      setTimeout(() => setStatusMessage(null), 4000);

      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setTargetDocType(null);
      setReplacingDocId(null);
    } catch (err: any) {
      console.error('Document upload error:', err);
      alert(`Upload failed: ${err.message || 'Network error'}. Please try again.`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Safe removal (Admin only)
  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!isAdmin) {
      alert('Permission Denied: Only Super Admin can delete customer compliance documents.');
      return;
    }
    if (!confirm(`Are you sure you want to remove "${docName}"? This action cannot be undone.`)) {
      return;
    }

    const updated = activeDocs.filter(d => d.id !== docId);
    await updateLead(activeLead.id, { documents: updated as any });

    addActivity({
      type: 'Document Removed',
      message: `Admin ${currentUserName} removed compliance document: ${docName}`,
      user: currentUserName,
      leadId: activeLead.id
    });
  };

  return (
    <div className="customer-documents-content">
      {/* Hidden Native File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileSelected}
      />

      {/* Header */}
      <div className="sales-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#0b1f3a' }}>
              Customer KYC & PM Surya Ghar Documents
            </h2>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Upload and verify essential rooftop KYC papers, site survey photos, and customer subsidy consent forms via Firebase Cloud Storage.
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

        {statusMessage && (
          <div style={{ 
            marginTop: '0.75rem', 
            padding: '0.5rem 0.75rem', 
            borderRadius: '6px', 
            background: statusMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: statusMessage.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.825rem',
            fontWeight: 600
          }}>
            {statusMessage.text}
          </div>
        )}
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
                      <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.5rem', background: '#dcfce7', padding: '6px 10px', borderRadius: '6px' }}>
                        <div style={{ fontWeight: 600 }}>📄 {matchingDoc.fileName || matchingDoc.name || 'Document'}</div>
                        <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: '2px' }}>
                          {matchingDoc.fileSize ? formatBytes(matchingDoc.fileSize) : 'Standard'} • {matchingDoc.uploadedAt ? new Date(matchingDoc.uploadedAt).toLocaleDateString() : 'Active'} • {matchingDoc.uploadedByRole || 'Staff'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isUploaded && matchingDoc.fileUrl && (
                      <a 
                        href={matchingDoc.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="sales-btn-secondary"
                        style={{ flex: 1, minWidth: '100px', justifyContent: 'center', fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        <Eye size={13} /> View / Download
                      </a>
                    )}

                    {isUploaded && !matchingDoc.fileUrl && (
                      <span 
                        className="sales-btn-secondary"
                        style={{ flex: 1, minWidth: '100px', justifyContent: 'center', fontSize: '0.8rem', background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                        title="Customer KYC data is sealed. Only Admin, Accounts, or PM Surya Ghar Incharge can access sensitive identity documents."
                      >
                        <Lock size={13} /> Confidential KYC
                      </span>
                    )}

                    <button 
                      className="sales-btn-primary" 
                      style={{ 
                        flex: 1, 
                        minWidth: '110px',
                        justifyContent: 'center', 
                        fontSize: '0.8rem', 
                        background: isUploaded ? '#16a34a' : '#0284c7' 
                      }}
                      onClick={() => handleInitiateUpload(item.type, matchingDoc?.id)}
                    >
                      <Upload size={13} /> {isUploaded ? 'Replace' : 'Upload'}
                    </button>

                    {isUploaded && isAdmin && (
                      <button 
                        className="sales-btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', color: '#dc2626' }}
                        title="Delete Document (Admin Only)"
                        onClick={() => handleDeleteDocument(matchingDoc.id, matchingDoc.fileName || matchingDoc.name || item.type)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Smart Compression & Progress Upload Modal */}
      {isUploadModalOpen && selectedFile && targetDocType && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          file={selectedFile}
          documentType={targetDocType}
          onClose={() => {
            setIsUploadModalOpen(false);
            setSelectedFile(null);
            setTargetDocType(null);
            setReplacingDocId(null);
          }}
          onConfirmUpload={handleConfirmUpload}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
      )}
    </div>
  );
}
