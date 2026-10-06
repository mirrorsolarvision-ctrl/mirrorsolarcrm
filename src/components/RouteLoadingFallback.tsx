import React from 'react';
import './RouteLoadingFallback.css';

interface RouteLoadingFallbackProps {
  message?: string;
  subMessage?: string;
}

export default function RouteLoadingFallback({
  message = 'Loading Module...',
  subMessage = 'Mirror Solar Vision'
}: RouteLoadingFallbackProps) {
  return (
    <div className="route-loading-container" role="status" aria-live="polite">
      <div className="route-loading-card">
        <div className="route-loading-solar-orb">
          <div className="solar-orb-ring secondary"></div>
          <div className="solar-orb-ring"></div>
          <div className="solar-orb-core"></div>
        </div>
        <div className="route-loading-text">
          <span className="route-loading-title">{message}</span>
          <span className="route-loading-subtitle">{subMessage}</span>
        </div>
      </div>
    </div>
  );
}
