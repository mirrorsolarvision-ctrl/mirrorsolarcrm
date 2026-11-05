import React from 'react';

export default function EnvironmentIndicator() {
  const mode = import.meta.env.MODE || (import.meta.env.VITE_ENV as string) || 'development';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'unconfigured';
  const isStaging = mode === 'staging' || import.meta.env.VITE_ENV === 'staging';

  if (!isStaging) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '24px',
        backgroundColor: '#f59e0b',
        color: '#78350f',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
      }}
      role="banner"
    >
      ⚠️ STAGING ENVIRONMENT — ISOLATED FROM PRODUCTION (PROJECT: {projectId})
    </div>
  );
}

