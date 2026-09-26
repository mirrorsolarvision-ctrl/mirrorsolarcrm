import React from 'react';
import { Sparkles } from 'lucide-react';
import './PageHero.css';

export interface PageHeroProps {
  badge?: string;
  badgeIcon?: React.ReactNode;
  icon?: React.ReactNode;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function PageHero({
  badge,
  badgeIcon,
  icon,
  title,
  subtitle,
  actions,
  children,
  className = ''
}: PageHeroProps) {
  return (
    <div className={`page-hero-header ${className}`}>
      <div className="page-hero-content">
        <div className="hero-title-row">
          {icon && (
            <div className="hero-icon-badge">
              {icon}
            </div>
          )}
          <div className="hero-title-area">
            {badge && (
              <div className="hero-badge-pill">
                {badgeIcon || <Sparkles size={13} />}
                <span>{badge}</span>
              </div>
            )}
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>

        {actions && (
          <div className="hero-action-container">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="hero-bottom-slot">
          {children}
        </div>
      )}
    </div>
  );
}
