import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import './VersionUpdateBanner.css';

interface VersionPayload {
  version: string;
  buildTime: string;
}

export default function VersionUpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch initial version
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data: VersionPayload = await res.json();
        
        if (isMounted) {
          if (!currentVersion) {
            setCurrentVersion(data.buildTime);
          } else if (currentVersion !== data.buildTime) {
            setHasUpdate(true);
          }
        }
      } catch (e) {
        // Silent fail on network error
      }
    };

    checkVersion();

    // 2. Poll every 45 seconds and on window focus
    const interval = setInterval(checkVersion, 45000);
    const handleFocus = () => checkVersion();
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentVersion]);

  const handleUpdate = () => {
    const doReload = () => {
      window.location.reload();
    };

    if (typeof caches !== 'undefined' && caches?.keys) {
      caches.keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .catch(() => {})
        .finally(() => doReload());
    } else {
      doReload();
    }
  };

  if (!hasUpdate || dismissed) return null;

  return (
    <aside 
      className="version-update-banner"
      role="region"
      aria-label="App version update notice"
    >
      <div className="version-update-icon">
        <Sparkles size={16} />
      </div>
      <div className="version-update-text">
        <span>New Solar CRM update is live!</span>
      </div>
      <button 
        type="button" 
        className="version-update-btn" 
        onClick={handleUpdate}
        title="Refresh and load latest update"
      >
        <RefreshCw size={13} /> Update Now
      </button>
      <button 
        type="button" 
        className="version-update-dismiss" 
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
