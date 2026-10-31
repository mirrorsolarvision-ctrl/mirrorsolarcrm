import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Download, X, CheckCircle2, AlertTriangle, 
  AlertCircle, FileText, Loader2, Sparkles
} from 'lucide-react';
import type { MockLead } from '../context/CRMContext';
import { 
  exportLeadsToSpreadsheet, 
  downloadLeadTemplate, 
  parseSpreadsheetFile, 
  buildLeadFromParsedExcel,
  type ParsedExcelLead 
} from '../utils/excelUtils';
import './LeadExcelModal.css';

interface LeadExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'import' | 'export';
  existingLeads: MockLead[];
  filteredLeads: MockLead[];
  selectedLeadIds: string[];
  currentUser?: any;
  onImportLeads: (leadsToCreate: Partial<MockLead>[]) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const LeadExcelModal: React.FC<LeadExcelModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'import',
  existingLeads,
  filteredLeads,
  selectedLeadIds,
  currentUser,
  onImportLeads,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import State
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedExcelLead[] | null>(null);
  const [importFilter, setImportFilter] = useState<'all' | 'ready' | 'duplicates' | 'invalid'>('all');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Export State
  const [exportScope, setExportScope] = useState<'filtered' | 'all' | 'selected'>(
    selectedLeadIds.length > 0 ? 'selected' : 'filtered'
  );
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exportPrefix, setExportPrefix] = useState('MirrorSolar_Leads');

  if (!isOpen) return null;

  // Handle Drag & Drop / File Select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      onShowToast('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.', 'error');
      return;
    }

    try {
      setIsParsing(true);
      setUploadedFileName(file.name);
      const rows = await parseSpreadsheetFile(file, existingLeads);
      setParsedRows(rows);
      onShowToast(`Successfully read ${rows.length} rows from ${file.name}`, 'success');
    } catch (err: any) {
      console.error('Spreadsheet parse error:', err);
      onShowToast(err.message || 'Failed to read spreadsheet file.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Toggle selection
  const handleToggleRow = (tempId: string) => {
    if (!parsedRows) return;
    setParsedRows(prev =>
      prev ? prev.map(r => r.tempId === tempId ? { ...r, selected: !r.selected } : r) : null
    );
  };

  const handleSelectAll = (select: boolean) => {
    if (!parsedRows) return;
    setParsedRows(prev =>
      prev ? prev.map(r => ({
        ...r,
        selected: select ? (r.isValid && !r.isDuplicate) : false
      })) : null
    );
  };

  const handleIncludeDuplicates = () => {
    if (!parsedRows) return;
    setParsedRows(prev =>
      prev ? prev.map(r => ({
        ...r,
        selected: r.isValid
      })) : null
    );
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!parsedRows) return;
    const toImport = parsedRows.filter(r => r.selected);
    if (toImport.length === 0) {
      onShowToast('Please select at least one valid lead to import.', 'warning');
      return;
    }

    try {
      setIsImporting(true);
      const payloads = toImport.map(r => buildLeadFromParsedExcel(r, currentUser));
      await onImportLeads(payloads);
      onShowToast(`✓ Successfully imported ${toImport.length} leads into CRM!`, 'success');
      handleResetImport();
      onClose();
    } catch (err: any) {
      console.error('Import execution error:', err);
      onShowToast(err.message || 'Failed to complete leads import.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetImport = () => {
    setParsedRows(null);
    setUploadedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute Export
  const handleExecuteExport = () => {
    let leadsToExport: MockLead[] = [];
    if (exportScope === 'selected') {
      leadsToExport = existingLeads.filter(l => selectedLeadIds.includes(l.id));
    } else if (exportScope === 'filtered') {
      leadsToExport = filteredLeads;
    } else {
      leadsToExport = existingLeads;
    }

    if (leadsToExport.length === 0) {
      onShowToast('No leads found for the selected export criteria.', 'warning');
      return;
    }

    try {
      exportLeadsToSpreadsheet(leadsToExport, exportPrefix, exportFormat);
      onShowToast(`✓ Exported ${leadsToExport.length} leads to ${exportFormat.toUpperCase()}!`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Export error:', err);
      onShowToast('Failed to export leads spreadsheet.', 'error');
    }
  };

  // Filtered rows for preview table
  const displayedRows = (parsedRows || []).filter(r => {
    if (importFilter === 'ready') return r.isValid && !r.isDuplicate;
    if (importFilter === 'duplicates') return r.isDuplicate;
    if (importFilter === 'invalid') return !r.isValid;
    return true;
  });

  const readyCount = (parsedRows || []).filter(r => r.isValid && !r.isDuplicate).length;
  const duplicateCount = (parsedRows || []).filter(r => r.isDuplicate).length;
  const invalidCount = (parsedRows || []).filter(r => !r.isValid).length;
  const selectedCount = (parsedRows || []).filter(r => r.selected).length;

  return (
    <div className="lead-excel-modal-overlay" onClick={onClose}>
      <div 
        className={`lead-excel-modal-container ${parsedRows ? 'expanded' : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="lead-excel-modal-header">
          <div className="lead-excel-header-title">
            <div className="lead-excel-header-icon">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3>Excel & CSV Leads Manager</h3>
              <p>Import new inquiries or export your pipeline to Excel & CSV</p>
            </div>
          </div>
          <button className="lead-excel-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div className="lead-excel-tabs">
          <button 
            className={`lead-excel-tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <Upload size={16} /> Import from Spreadsheet
          </button>
          <button 
            className={`lead-excel-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={16} /> Export Leads Spreadsheet
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="lead-excel-modal-body">
          {activeTab === 'import' ? (
            /* ================= IMPORT TAB ================= */
            <div className="import-tab-content">
              {!parsedRows ? (
                /* UPLOAD DROPZONE */
                <div className="import-upload-section">
                  <div 
                    className="excel-dropzone"
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".xlsx, .xls, .csv" 
                      style={{ display: 'none' }} 
                    />
                    {isParsing ? (
                      <div className="dropzone-loading">
                        <Loader2 className="spinner" size={38} color="#2563eb" />
                        <h4>Analyzing spreadsheet...</h4>
                        <p>Validating phone numbers, checking duplicates & scoring leads</p>
                      </div>
                    ) : (
                      <div className="dropzone-prompt">
                        <div className="dropzone-icon">
                          <Upload size={32} />
                        </div>
                        <h4>Click or drag & drop your Excel or CSV sheet here</h4>
                        <p className="dropzone-hint">Supports .xlsx, .xls, and .csv files from Meta Ads, Google Ads, IndiaMART, or custom lists</p>
                        <span className="dropzone-badge">
                          <Sparkles size={14} /> Auto-detects column names & normalizes phone numbers
                        </span>
                      </div>
                    )}
                  </div>

                  {/* DOWNLOAD TEMPLATE CALLOUT */}
                  <div className="template-download-card">
                    <div className="template-card-info">
                      <FileText size={20} className="template-icon" />
                      <div>
                        <strong>Need the standard spreadsheet format?</strong>
                        <p>Download our pre-structured template with sample columns (Name, Phone, Bill, kW, City).</p>
                      </div>
                    </div>
                    <div className="template-btn-group">
                      <button 
                        type="button" 
                        className="btn-template-download"
                        onClick={() => downloadLeadTemplate('xlsx')}
                      >
                        <Download size={14} /> Download .xlsx Template
                      </button>
                      <button 
                        type="button" 
                        className="btn-template-download outline"
                        onClick={() => downloadLeadTemplate('csv')}
                      >
                        <Download size={14} /> .csv Template
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* PREVIEW & VALIDATION SECTION */
                <div className="import-preview-section">
                  {/* SUMMARY BAR */}
                  <div className="import-summary-bar">
                    <div className="file-info-badge">
                      <FileSpreadsheet size={16} />
                      <span className="file-name" title={uploadedFileName}>{uploadedFileName}</span>
                      <span className="row-count">({parsedRows.length} rows detected)</span>
                    </div>

                    <div className="import-stats-pills">
                      <button 
                        type="button" 
                        className={`stat-pill ${importFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setImportFilter('all')}
                      >
                        All: <strong>{parsedRows.length}</strong>
                      </button>
                      <button 
                        type="button" 
                        className={`stat-pill success ${importFilter === 'ready' ? 'active' : ''}`}
                        onClick={() => setImportFilter('ready')}
                      >
                        <CheckCircle2 size={13} /> Ready to Import: <strong>{readyCount}</strong>
                      </button>
                      {duplicateCount > 0 && (
                        <button 
                          type="button" 
                          className={`stat-pill warning ${importFilter === 'duplicates' ? 'active' : ''}`}
                          onClick={() => setImportFilter('duplicates')}
                        >
                          <AlertTriangle size={13} /> Duplicates: <strong>{duplicateCount}</strong>
                        </button>
                      )}
                      {invalidCount > 0 && (
                        <button 
                          type="button" 
                          className={`stat-pill error ${importFilter === 'invalid' ? 'active' : ''}`}
                          onClick={() => setImportFilter('invalid')}
                        >
                          <AlertCircle size={13} /> Invalid: <strong>{invalidCount}</strong>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* QUICK SELECTION CONTROLS */}
                  <div className="import-controls-bar">
                    <div className="controls-left">
                      <button 
                        type="button" 
                        className="btn-link-action"
                        onClick={() => handleSelectAll(true)}
                      >
                        Select All Ready ({readyCount})
                      </button>
                      <span className="sep">•</span>
                      <button 
                        type="button" 
                        className="btn-link-action"
                        onClick={() => handleSelectAll(false)}
                      >
                        Deselect All
                      </button>
                      {duplicateCount > 0 && (
                        <>
                          <span className="sep">•</span>
                          <button 
                            type="button" 
                            className="btn-link-action warning"
                            onClick={handleIncludeDuplicates}
                          >
                            Include Duplicates ({duplicateCount})
                          </button>
                        </>
                      )}
                    </div>
                    <div className="controls-right">
                      <span className="selection-badge">
                        Selected: <strong>{selectedCount}</strong> / {parsedRows.length}
                      </span>
                    </div>
                  </div>

                  {/* PREVIEW TABLE */}
                  <div className="import-table-container">
                    <table className="excel-preview-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <input 
                              type="checkbox" 
                              checked={readyCount > 0 && selectedCount === readyCount}
                              onChange={e => handleSelectAll(e.target.checked)}
                            />
                          </th>
                          <th>Customer</th>
                          <th>Phone (E.164)</th>
                          <th>Location</th>
                          <th>Capacity / Bill</th>
                          <th>Lead Score</th>
                          <th>Source</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="empty-preview-cell">
                              No rows match the selected filter.
                            </td>
                          </tr>
                        ) : (
                          displayedRows.map(row => (
                            <tr 
                              key={row.tempId} 
                              className={`preview-row ${row.selected ? 'row-selected' : ''} ${!row.isValid ? 'row-invalid' : ''} ${row.isDuplicate ? 'row-duplicate' : ''}`}
                            >
                              <td>
                                <input 
                                  type="checkbox" 
                                  checked={row.selected} 
                                  disabled={!row.isValid}
                                  onChange={() => handleToggleRow(row.tempId)} 
                                />
                              </td>
                              <td className="cell-customer">
                                <strong>{row.customer || <span className="text-muted">Missing Name</span>}</strong>
                                {row.email && <small className="cell-email">{row.email}</small>}
                              </td>
                              <td className="cell-phone">
                                <span className="phone-code">{row.phone}</span>
                                {row.rawPhone !== row.phone && (
                                  <small className="raw-phone-hint">from {row.rawPhone}</small>
                                )}
                              </td>
                              <td>{row.location || '—'}</td>
                              <td>
                                <div className="kw-bill-stack">
                                  <span>{row.requiredKw} kW</span>
                                  {row.monthlyBill > 0 && (
                                    <small className="text-muted">₹{row.monthlyBill.toLocaleString('en-IN')}/mo</small>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`lead-score-pill score-${row.leadPriority.toLowerCase()}`}>
                                  {row.leadPriority === 'High' ? '🔥' : row.leadPriority === 'Medium' ? '☀️' : '❄️'} {row.leadScore.total}
                                </span>
                              </td>
                              <td>
                                <span className="source-tag">{row.source}</span>
                              </td>
                              <td>
                                {!row.isValid ? (
                                  <span className="status-pill-error" title={row.validationError}>
                                    <AlertCircle size={12} /> {row.validationError}
                                  </span>
                                ) : row.isDuplicate ? (
                                  <span className="status-pill-warning" title={`Duplicate of existing lead: ${row.duplicateWith?.customer} (${row.duplicateWith?.stage})`}>
                                    <AlertTriangle size={12} /> Duplicate: {row.duplicateWith?.stage}
                                  </span>
                                ) : (
                                  <span className="status-pill-success">
                                    <CheckCircle2 size={12} /> Ready
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* PREVIEW BOTTOM ACTION BAR */}
                  <div className="preview-action-footer">
                    <button 
                      type="button" 
                      className="btn-modal-secondary" 
                      onClick={handleResetImport}
                      disabled={isImporting}
                    >
                      ← Upload Different File
                    </button>
                    <button 
                      type="button" 
                      className="btn-modal-primary"
                      onClick={handleExecuteImport}
                      disabled={isImporting || selectedCount === 0}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="spinner" size={16} /> Importing {selectedCount} Leads...
                        </>
                      ) : (
                        <>
                          <Upload size={16} /> Confirm & Import {selectedCount} Leads
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ================= EXPORT TAB ================= */
            <div className="export-tab-content">
              <div className="export-options-grid">
                {/* SCOPE SELECTION */}
                <div className="export-option-group">
                  <label className="option-group-label">1. Select Leads Scope</label>
                  <div className="scope-cards-grid">
                    <div 
                      className={`scope-card ${exportScope === 'filtered' ? 'active' : ''}`}
                      onClick={() => setExportScope('filtered')}
                    >
                      <div className="scope-radio">
                        <div className="radio-dot"></div>
                      </div>
                      <div className="scope-info">
                        <strong>Current Filtered Leads</strong>
                        <p>Export {filteredLeads.length} leads matching your active filters and search query.</p>
                        <span className="scope-count">{filteredLeads.length} leads</span>
                      </div>
                    </div>

                    <div 
                      className={`scope-card ${exportScope === 'all' ? 'active' : ''}`}
                      onClick={() => setExportScope('all')}
                    >
                      <div className="scope-radio">
                        <div className="radio-dot"></div>
                      </div>
                      <div className="scope-info">
                        <strong>All Leads in CRM</strong>
                        <p>Export the entire customer database across all pipeline stages.</p>
                        <span className="scope-count">{existingLeads.length} leads</span>
                      </div>
                    </div>

                    <div 
                      className={`scope-card ${exportScope === 'selected' ? 'active' : ''} ${selectedLeadIds.length === 0 ? 'disabled' : ''}`}
                      onClick={() => selectedLeadIds.length > 0 && setExportScope('selected')}
                    >
                      <div className="scope-radio">
                        <div className="radio-dot"></div>
                      </div>
                      <div className="scope-info">
                        <strong>Selected Table Rows</strong>
                        <p>Export only the leads you checked in the table view.</p>
                        <span className="scope-count">{selectedLeadIds.length} leads selected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FORMAT SELECTION */}
                <div className="export-option-group">
                  <label className="option-group-label">2. File Format</label>
                  <div className="format-toggle-container">
                    <button 
                      type="button" 
                      className={`format-toggle-btn ${exportFormat === 'xlsx' ? 'active' : ''}`}
                      onClick={() => setExportFormat('xlsx')}
                    >
                      <FileSpreadsheet size={18} />
                      <div>
                        <strong>Microsoft Excel (.xlsx)</strong>
                        <small>Formatted workbook with auto-fitted columns</small>
                      </div>
                    </button>
                    <button 
                      type="button" 
                      className={`format-toggle-btn ${exportFormat === 'csv' ? 'active' : ''}`}
                      onClick={() => setExportFormat('csv')}
                    >
                      <FileText size={18} />
                      <div>
                        <strong>Comma Separated (.csv)</strong>
                        <small>Universal plain-text spreadsheet format</small>
                      </div>
                    </button>
                  </div>
                </div>

                {/* FILE PREFIX */}
                <div className="export-option-group">
                  <label className="option-group-label" htmlFor="export-prefix-input">
                    3. File Name Prefix
                  </label>
                  <div className="file-prefix-input-wrap">
                    <input 
                      id="export-prefix-input"
                      type="text" 
                      className="form-input"
                      value={exportPrefix}
                      onChange={e => setExportPrefix(e.target.value)}
                      placeholder="MirrorSolar_Leads"
                    />
                    <span className="file-suffix-hint">
                      _{new Date().toISOString().split('T')[0]}.{exportFormat}
                    </span>
                  </div>
                </div>
              </div>

              {/* EXPORT ACTION FOOTER */}
              <div className="export-action-footer">
                <button type="button" className="btn-modal-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-modal-primary"
                  onClick={handleExecuteExport}
                >
                  <Download size={16} /> Download {exportFormat.toUpperCase()} Spreadsheet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
