import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import './UploadProgressBar.css';

interface UploadProgressBarProps {
  progress: number;
  fileName?: string;
  statusText?: string;
}

export default function UploadProgressBar({
  progress,
  fileName = 'Uploading document...',
  statusText
}: UploadProgressBarProps) {
  const isComplete = progress >= 100;

  return (
    <div className="upload-progress-card" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
      <div className="upload-progress-header">
        <span className="upload-progress-filename" title={fileName}>{fileName}</span>
        <span className="upload-progress-percent">{progress}%</span>
      </div>
      <div className="upload-progress-track">
        <div 
          className={`upload-progress-fill ${isComplete ? 'complete' : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className="upload-progress-status">
        {isComplete ? (
          <>
            <CheckCircle2 size={13} color="#16a34a" />
            <span>Upload finalized</span>
          </>
        ) : (
          <>
            <Loader2 size={13} className="spin" color="#0284c7" />
            <span>{statusText || 'Compressing & uploading to Cloud Storage...'}</span>
          </>
        )}
      </div>
    </div>
  );
}
