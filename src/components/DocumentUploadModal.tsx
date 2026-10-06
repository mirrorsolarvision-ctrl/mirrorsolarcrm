import React, { useState, useEffect } from 'react';
import { Upload, X, Check, FileText, Zap } from 'lucide-react';
import { compressImageToTargetPreset, formatBytes, type CompressionPreset } from '../utils/cloudStorageUtils';
import UploadProgressBar from './UploadProgressBar';
import './DocumentUploadModal.css';

export interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  documentType: string;
  onConfirmUpload: (processedFile: File, notes: string, preset: CompressionPreset) => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: number;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  file,
  documentType,
  onConfirmUpload,
  isUploading = false,
  uploadProgress = 0,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<CompressionPreset>('ultra_50kb');
  const [notes, setNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Generate preview thumbnail and run initial compression calculation whenever file or preset changes
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setCompressedFile(null);
      return;
    }

    let url: string | null = null;
    if (file.type.startsWith('image/')) {
      url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    const calculateCompression = async () => {
      if (!file.type.startsWith('image/') || selectedPreset === 'original') {
        setCompressedFile(file);
        return;
      }
      setIsCalculating(true);
      try {
        const compressed = await compressImageToTargetPreset(file, selectedPreset);
        setCompressedFile(compressed);
      } catch (err) {
        console.warn('Compression preview calculation failed:', err);
        setCompressedFile(file);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateCompression();

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, selectedPreset]);

  if (!isOpen || !file) return null;

  const isImage = file.type.startsWith('image/');
  const originalSize = file.size;
  const currentCompressedSize = compressedFile ? compressedFile.size : originalSize;
  const savingsPercent =
    originalSize > currentCompressedSize
      ? Math.round(((originalSize - currentCompressedSize) / originalSize) * 100)
      : 0;

  const handleConfirm = async () => {
    const finalFile = compressedFile || file;
    await onConfirmUpload(finalFile, notes, selectedPreset);
  };

  return (
    <div className="doc-upload-modal-overlay" onClick={() => !isUploading && onClose()}>
      <div className="doc-upload-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="doc-upload-modal-header">
          <div className="doc-upload-brand">
            <div className="doc-upload-header-icon">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="doc-upload-title">Smart Document Upload</h3>
              <p className="doc-upload-subtitle">
                Category: <strong>{documentType || 'Customer Document'}</strong>
              </p>
            </div>
          </div>
          {!isUploading && (
            <button className="doc-upload-close-btn" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="doc-upload-body">
          {/* File summary preview card */}
          <div className="doc-file-card">
            {previewUrl ? (
              <img src={previewUrl} alt="Document Preview" className="doc-file-thumb" />
            ) : (
              <div className="doc-file-icon-placeholder">
                <FileText size={26} />
              </div>
            )}
            <div className="doc-file-meta">
              <div className="doc-file-name" title={file.name}>
                {file.name}
              </div>
              <div className="doc-file-size-tag">
                <span>Original Size: <strong>{formatBytes(originalSize)}</strong></span>
                {isImage && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#0284c7' }}>Image File</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Compression Presets (Only applicable for images) */}
          {isImage && (
            <div className="doc-compress-section">
              <div className="doc-compress-label">
                <span>⚡ Choose Compression Preset</span>
                <span className="doc-compress-badge">Smart Auto-Optimizer</span>
              </div>

              <div className="doc-presets-grid">
                {/* Option 1: Ultra < 50 KB (Recommended) */}
                <div
                  className={`doc-preset-card ${selectedPreset === 'ultra_50kb' ? 'active' : ''}`}
                  onClick={() => !isUploading && setSelectedPreset('ultra_50kb')}
                >
                  <div className="doc-preset-header">
                    <span>⚡ Ultra Compact (&lt; 50 KB)</span>
                    {selectedPreset === 'ultra_50kb' && <Check color="#0284c7" size={16} />}
                  </div>
                  <div className="doc-preset-desc">
                    Guaranteed &lt; 50 KB. Instant sync, low data usage, ideal for bills & Aadhaar.
                  </div>
                </div>

                {/* Option 2: Standard 150 KB */}
                <div
                  className={`doc-preset-card ${selectedPreset === 'standard_150kb' ? 'active' : ''}`}
                  onClick={() => !isUploading && setSelectedPreset('standard_150kb')}
                >
                  <div className="doc-preset-header">
                    <span>📊 Standard (~150 KB)</span>
                    {selectedPreset === 'standard_150kb' && <Check color="#0284c7" size={16} />}
                  </div>
                  <div className="doc-preset-desc">
                    Balanced quality (1400px, 72% Q). Excellent for site inspection photos.
                  </div>
                </div>

                {/* Option 3: High Res */}
                <div
                  className={`doc-preset-card ${selectedPreset === 'high_res' ? 'active' : ''}`}
                  onClick={() => !isUploading && setSelectedPreset('high_res')}
                >
                  <div className="doc-preset-header">
                    <span>🎨 High Res (~400 KB)</span>
                    {selectedPreset === 'high_res' && <Check color="#0284c7" size={16} />}
                  </div>
                  <div className="doc-preset-desc">
                    Full HD (1920px, 85% Q). Perfect for single line diagrams & roof blueprints.
                  </div>
                </div>

                {/* Option 4: Original */}
                <div
                  className={`doc-preset-card ${selectedPreset === 'original' ? 'active' : ''}`}
                  onClick={() => !isUploading && setSelectedPreset('original')}
                >
                  <div className="doc-preset-header">
                    <span>📁 Original (No Compression)</span>
                    {selectedPreset === 'original' && <Check color="#0284c7" size={16} />}
                  </div>
                  <div className="doc-preset-desc">
                    Upload unmodified original file ({formatBytes(originalSize)}).
                  </div>
                </div>
              </div>

              {/* Live Savings Calculation Banner */}
              <div className="doc-reduction-banner">
                <div>
                  {isCalculating ? (
                    <span>Calculating optimized dimensions...</span>
                  ) : (
                    <span>
                      Upload Size: <strong>{formatBytes(currentCompressedSize)}</strong>
                      {savingsPercent > 0 && (
                        <span style={{ marginLeft: '6px', color: '#15803d' }}>
                          (Reduced by {savingsPercent}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {currentCompressedSize <= 50 * 1024 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>
                    ✓ Target &lt; 50 KB Achieved
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.35rem',
              }}
            >
              Document Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              className="doc-notes-input"
              placeholder="e.g. Verified Aadhaar front or Latest Feb 2026 DISCOM bill"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Progress Bar if Uploading */}
          {isUploading && (
            <UploadProgressBar
              progress={uploadProgress}
              statusText={`Compressing & Uploading ${formatBytes(currentCompressedSize)} to Cloud Storage...`}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="doc-upload-modal-actions">
          <button
            type="button"
            className="doc-btn doc-btn-outline"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="doc-btn doc-btn-primary"
            onClick={handleConfirm}
            disabled={isUploading || isCalculating}
          >
            {isUploading ? (
              <>
                <span>Uploading ({uploadProgress}%)</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Upload {isImage && selectedPreset === 'ultra_50kb' ? 'Optimized (<50KB)' : 'Document'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
