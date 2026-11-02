import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Activity, Package, CreditCard, Menu, 
  Users, Briefcase, PieChart, Shield, Calendar, CheckSquare, PhoneCall, UserCheck, Award,
  ChevronDown, ChevronUp, Plus, X, Zap, Clock, FileText, Wallet
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
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);

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
            setIsQuickActionOpen(false);
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
        setIsQuickActionOpen(false);
      }
    };

    const observer = new MutationObserver(checkOverlayState);
    observer.observe(document.body, { childList: true, subtree: true });
    checkOverlayState();

    return () => observer.disconnect();
  }, []);
  
  // Custom primary tabs per role
  const getNavItems = (): { leftItems: NavItem[]; rightItems: NavItem[] } => {
    if (role === 'Admin') {
      return {
        leftItems: [
          { id: 'Dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
          { id: 'Leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        ],
        rightItems: [
          { id: 'Payments', label: 'Finance', icon: <CreditCard size={20} /> },
        ]
      };
    } else if (role === 'Dealer') {
      return {
        leftItems: [
          { id: '/dealer/dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
          { id: '/dealer/leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        ],
        rightItems: [
          { id: '/dealer/payments', label: 'Finance', icon: <CreditCard size={20} /> },
        ]
      };
    } else {
      const isStockIncharge = employeeCategory === 'Stock Incharge';
      return {
        leftItems: [
          { id: '/employee/dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
          isStockIncharge
            ? { id: '/employee/stock', label: 'Stock', icon: <Package size={20} />, badge: stockBadge }
            : { id: '/employee/leads', label: 'Leads', icon: <Activity size={20} />, badge: leadsBadge },
        ],
        rightItems: [
          { id: '/employee/payments', label: 'Finance', icon: <CreditCard size={20} /> },
        ]
      };
    }
  };

  // Quick Action shortcuts by role
  const getQuickActions = () => {
    if (role === 'Admin') {
      return [
        { id: 'Leads', label: 'New Solar Lead', desc: 'Add client or track CRM pipeline', icon: <Activity size={18} />, color: '#0284C7' },
        { id: 'Employees', label: 'Company Employees', desc: 'Staff workload, performance & leads', icon: <Users size={18} />, color: '#6366F1' },
        { id: 'Payments', label: 'Payment & Receipt', desc: 'Issue official receipt & track dues', icon: <CreditCard size={18} />, color: '#10B981' },
        { id: 'Quotations', label: 'Solar Quotations', desc: 'Create solar quotation PDF', icon: <FileText size={18} />, color: '#8B5CF6' },
        { id: 'Dealers', label: 'Dealer Commissions', desc: 'Manage partner commissions & payouts', icon: <Award size={18} />, color: '#F59E0B' },
        { id: 'Payroll', label: 'Staff Payroll & Advances', desc: 'Salary cuts, advances & regularizations', icon: <Wallet size={18} />, color: '#EC4899' },
        { id: 'Attendance', label: 'Punch & Attendance', desc: 'Review daily staff check-ins', icon: <Clock size={18} />, color: '#06B6D4' },
      ];
    } else if (role === 'Dealer') {
      return [
        { id: '/dealer/leads', label: 'Register New Deal', desc: 'Submit rooftop solar inquiries', icon: <Activity size={18} />, color: '#0284C7' },
        { id: '/dealer/dashboard', label: 'Commission Statement', desc: 'View earned ₹/kW & settle dues', icon: <Award size={18} />, color: '#F59E0B' },
        { id: '/dealer/payments', label: 'Customer Payments', desc: 'Check milestone payment clearance', icon: <CreditCard size={18} />, color: '#10B981' },
        { id: '/dealer/stock', label: 'Solar Stock & Spares', desc: 'Request panels, inverters & BOS', icon: <Package size={18} />, color: '#8B5CF6' },
      ];
    } else if (employeeCategory && (employeeCategory.includes('Sales') || employeeCategory.includes('Telecaller'))) {
      return [
        { id: '/employee/call-leads', label: 'Office Call Leads', desc: 'Incoming call desk & 15m SLA response', icon: <PhoneCall size={18} />, color: '#0284C7' },
        { id: '/employee/leads', label: 'Sales Funnel & Leads', desc: 'Qualify, score & advance pipeline', icon: <Activity size={18} />, color: '#10B981' },
        { id: '/employee/eod-report', label: 'EOD Calling Report', desc: 'Submit daily calls & bookings log', icon: <FileText size={18} />, color: '#8B5CF6' },
        { id: '/employee/attendance', label: 'Punch Attendance', desc: 'Daily GPS check-in & check-out', icon: <Clock size={18} />, color: '#F59E0B' },
      ];
    } else {
      return [
        { id: '/employee/leads', label: 'New Lead / Survey', desc: 'Log site survey or client interest', icon: <Activity size={18} />, color: '#0284C7' },
        { id: '/employee/attendance', label: 'Punch Attendance', desc: 'Daily GPS check-in & check-out', icon: <Clock size={18} />, color: '#10B981' },
        { id: '/employee/payroll', label: 'My Salary & Advances', desc: 'View monthly payslip & incentives', icon: <Wallet size={18} />, color: '#F59E0B' },
        { id: '/employee/milestones', label: 'Project Milestones', desc: 'Track ongoing solar installations', icon: <Award size={18} />, color: '#8B5CF6' },
      ];
    }
  };

  const { leftItems, rightItems } = getNavItems();
  const quickActions = getQuickActions();

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

      {/* Quick Actions Backdrop */}
      {isQuickActionOpen && (
        <div 
          className="quick-actions-backdrop"
          onClick={() => setIsQuickActionOpen(false)}
        />
      )}

      {/* Quick Actions Sheet Modal */}
      {isQuickActionOpen && (
        <div className="quick-actions-sheet">
          <div className="quick-actions-header">
            <div className="quick-actions-title-wrap">
              <div className="quick-actions-pill" />
              <div className="quick-actions-title">
                <Zap size={18} color="#F59E0B" />
                <span>Quick Actions</span>
              </div>
              <div className="quick-actions-subtitle">Instant shortcuts for Mirror Solar {role}</div>
            </div>
            <button 
              className="quick-actions-close" 
              onClick={() => setIsQuickActionOpen(false)}
              aria-label="Close Quick Actions"
            >
              <X size={18} />
            </button>
          </div>

          <div className="quick-actions-grid">
            {quickActions.map(action => (
              <button 
                key={action.id}
                className="quick-action-tile"
                onClick={() => {
                  onSelectTab(action.id);
                  setIsQuickActionOpen(false);
                  setIsCollapsed(false);
                }}
              >
                <div className="quick-action-icon-box" style={{ background: `${action.color}22`, color: action.color }}>
                  {action.icon}
                </div>
                <div className="quick-action-info">
                  <span className="quick-action-label">{action.label}</span>
                  <span className="quick-action-desc">{action.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
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
          onClick={() => {
            setIsCollapsed(true);
            setIsQuickActionOpen(false);
          }}
          title="Hide Menu (Scroll up or tap arrow to show again)"
          aria-label="Hide menu"
        >
          <div className="handle-bar" />
          <ChevronDown size={13} />
        </button>

        <div className="bottom-bar-inner">
          {/* Left Navigation Items */}
          {leftItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  setIsCollapsed(false);
                  setIsQuickActionOpen(false);
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

          {/* Central Elevated Quick Action FAB (+) */}
          <button
            type="button"
            className={`quick-action-fab ${isQuickActionOpen ? 'is-open' : ''}`}
            onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
            title="Quick Actions"
            aria-label="Toggle Quick Actions"
          >
            <div className="fab-icon-wrapper">
              <Plus size={24} />
            </div>
          </button>

          {/* Right Navigation Items */}
          {rightItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  setIsCollapsed(false);
                  setIsQuickActionOpen(false);
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

          {/* More Menu Trigger */}
          <button
            className="bottom-nav-item menu-trigger"
            onClick={() => {
              setIsQuickActionOpen(false);
              onOpenMenu();
            }}
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
