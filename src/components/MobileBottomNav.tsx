import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Activity, Package, CreditCard, Menu, 
  Users, Briefcase, PieChart, Shield, Calendar, CheckSquare, PhoneCall, UserCheck, Award,
  ChevronDown, ChevronUp
} from 'lucide-react';
import './MobileBottomNav.css';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MobileBottomNavProps {
  role: 'Admin' | 'Dealer' | 'Employee';
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenMenu: () => void;
  stockBadge?: number;
  leadsBadge?: number;
  employeeCategory?: string;
}

export default function MobileBottomNav({
  role,
  activeTab,
  onSelectTab,
  onOpenMenu,
  stockBadge = 0,
  leadsBadge = 0,
  employeeCategory
}: MobileBottomNavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-hide when user scrolls down, auto-show when user scrolls up
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          // Hide when scrolling down significantly
          if (currentScrollY > lastScrollY && currentScrollY > 70) {
            setIsCollapsed(true);
          } else if (currentScrollY < lastScrollY - 15) {
            // Show when scrolling up
            setIsCollapsed(false);
          }
          lastScrollY = Math.max(0, currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-hide bottom menu whenever any modal, popup, or lead details drawer is opened
  useEffect(() => {
    const checkOverlayState = () => {
      const activeOverlay = document.querySelector(
        '.modal-overlay, .lead-detail-drawer, .unified-record-modal-overlay, .doc-upload-modal-overlay, .solar-roi-modal-overlay, .wa-modal-overlay, .quotation-editor-modal'
      );
      if (activeOverlay) {
        setIsCollapsed(true);
      }
    };

    const observer = new MutationObserver(checkOverlayState);
    observer.observe(document.body, { childList: true, subtree: true });
    checkOverlayState();

    return () => observer.disconnect();
  }, []);
  
  // Custom items per role
  const getNavItems = (): NavItem[] => {
    if (role === 'Admin') {
      return [
        { id: 'Dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
        { id: 'Leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        { id: 'Milestones', label: 'Milestones', icon: <Award size={20} /> },
        { id: 'Payments', label: 'Finance', icon: <CreditCard size={20} /> },
      ];
    } else if (role === 'Dealer') {
      return [
        { id: '/dealer/dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
        { id: '/dealer/leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        { id: '/dealer/milestones', label: 'Milestones', icon: <Award size={20} /> },
        { id: '/dealer/payments', label: 'Finance', icon: <CreditCard size={20} /> },
      ];
    } else {
      const isStockIncharge = employeeCategory === 'Stock Incharge';
      return [
        { id: '/employee/dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
        { id: '/employee/milestones', label: 'Milestones', icon: <Award size={20} /> },
        isStockIncharge
          ? { id: '/employee/stock', label: 'Stock', icon: <Package size={20} />, badge: stockBadge }
          : { id: '/employee/leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        { id: '/employee/payments', label: 'Finance', icon: <CreditCard size={20} /> },
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Floating reveal arrow pill when collapsed */}
      {isCollapsed && (
        <button
          type="button"
          className="nav-reveal-tab-btn"
          onClick={() => setIsCollapsed(false)}
          title="Show Navigation Menu"
          aria-label="Show menu"
        >
          <ChevronUp size={14} />
          <span>Menu</span>
        </button>
      )}

      {/* Main Bottom Nav Bar */}
      <nav 
        className={`mobile-bottom-app-bar ${isCollapsed ? 'is-collapsed' : ''}`} 
        aria-label="Mobile Navigation"
      >
        {/* Discreet collapse handle button */}
        <button
          type="button"
          className="nav-collapse-handle"
          onClick={() => setIsCollapsed(true)}
          title="Hide Menu (Scroll up or tap arrow to show again)"
          aria-label="Hide menu"
        >
          <div className="handle-bar" />
          <ChevronDown size={13} />
        </button>

        <div className="bottom-bar-inner">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  setIsCollapsed(false);
                }}
                type="button"
              >
                <div className="icon-wrapper">
                  {item.icon}
                  {item.badge && item.badge > 0 ? (
                    <span className="bottom-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                  ) : null}
                </div>
                <span className="bottom-nav-label">{item.label}</span>
                {isActive && <div className="active-glow-pill" />}
              </button>
            );
          })}

          <button
            className="bottom-nav-item menu-trigger"
            onClick={onOpenMenu}
            type="button"
            aria-label="Open full menu"
          >
            <div className="icon-wrapper menu-icon">
              <Menu size={20} />
            </div>
            <span className="bottom-nav-label">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
