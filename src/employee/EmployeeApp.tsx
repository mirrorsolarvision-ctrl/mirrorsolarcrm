import { useState, useEffect, Suspense, lazy } from 'react';
import { Menu, Bell } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { canAccessRoute, isSalesDepartmentUser } from '../utils/permissionCalculations';
import AccessRestricted from '../components/AccessRestricted';
import EmployeeSidebar from './EmployeeSidebar';
import EmployeeDashboard from './EmployeeDashboard';
import MobileBottomNav from '../components/MobileBottomNav';
import RouteLoadingFallback from '../components/RouteLoadingFallback';
import ErrorBoundary from '../components/ErrorBoundary';

// Lazy-loaded portal modules
const EmployeeAttendancePage = lazy(() => import('../pages/EmployeeAttendancePage'));
const QuotationsPortalPage = lazy(() => import('../pages/QuotationsPortalPage'));
const ProfilePage = lazy(() => import('../ProfilePage'));
const LeadsPage = lazy(() => import('../LeadsPage'));
const StockPage = lazy(() => import('../StockPage'));
const PaymentsPage = lazy(() => import('../PaymentsPage'));
const AdminReportsPage = lazy(() => import('../AdminReportsPage'));
const TasksPage = lazy(() => import('../TasksPage'));
const CalendarPage = lazy(() => import('../CalendarPage'));
const EmployeeEodReportPage = lazy(() => import('../pages/EmployeeEodReportPage'));
const MilestonesPage = lazy(() => import('../MilestonesPage'));
const CallLeadsPage = lazy(() => import('../pages/CallLeadsPage'));
const SalesWorkspace = lazy(() => import('../sales/SalesWorkspace'));

interface EmployeeAppProps {
  onSignOut: () => void;
}

export default function EmployeeApp({ onSignOut }: EmployeeAppProps) {
  const { currentUser } = useCRM();
  const isSalesDept = isSalesDepartmentUser(currentUser);
  
  const [currentPath, setCurrentPath] = useState(() => {
    return isSalesDepartmentUser(currentUser) ? '/sales/dashboard' : '/employee/dashboard';
  });
  const [routeFilters, setRouteFilters] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stageAnimation, setStageAnimation] = useState(0);

  useEffect(() => {
    if (isSalesDepartmentUser(currentUser) && currentPath === '/employee/dashboard') {
      setCurrentPath('/sales/dashboard');
    }
  }, [currentUser]);

  useEffect(() => {
    // Initial load animation sequence
    const t1 = setTimeout(() => setStageAnimation(1), 100); 
    const t2 = setTimeout(() => setStageAnimation(2), 200); 
    const t3 = setTimeout(() => setStageAnimation(3), 300); 
    
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleNavigate = (path: string, filters?: any) => {
    setCurrentPath(path);
    setRouteFilters(filters || null);
  };

  // Render the current page based on path
  const renderPage = () => {
    // Sales Department Dedicated Module
    if (currentPath.startsWith('/sales/')) {
      const subView = (currentPath.replace('/sales/', '') || 'dashboard') as any;
      return <SalesWorkspace initialSubView={subView} onNavigateGlobal={handleNavigate} />;
    }

    if (isSalesDept && currentPath === '/employee/dashboard') {
      return <SalesWorkspace initialSubView="dashboard" onNavigateGlobal={handleNavigate} />;
    }

    // Determine route name for permission check
    const routeName = currentPath === '/employee/dashboard' ? 'Dashboard' :
                      currentPath === '/employee/attendance' ? 'Attendance' :
                      currentPath === '/employee/leads' ? 'Leads' :
                      currentPath === '/employee/call-leads' ? 'Call Leads' :
                      currentPath === '/employee/milestones' ? 'Milestones' :
                      currentPath === '/employee/quotations' ? 'Quotations' :
                      currentPath === '/employee/tasks' ? 'Tasks' :
                      currentPath === '/employee/calendar' ? 'Calendar' :
                      currentPath === '/employee/payments' ? 'Payments' :
                      currentPath === '/employee/stock' ? 'Stock' :
                      currentPath === '/employee/reports' ? 'Reports' :
                      currentPath === '/employee/eod-report' ? 'EOD Report' :
                      currentPath === '/employee/profile' ? 'Profile' : 'Dashboard';

    if (!canAccessRoute(currentUser, routeName)) {
      return isSalesDept ? <SalesWorkspace onNavigateGlobal={handleNavigate} /> : <EmployeeDashboard onNavigate={handleNavigate} />;
    }

    switch (currentPath) {
      case '/employee/dashboard':
        return isSalesDept ? <SalesWorkspace onNavigateGlobal={handleNavigate} /> : <EmployeeDashboard onNavigate={handleNavigate} />;
      case '/employee/attendance':
        return <EmployeeAttendancePage initialTab={routeFilters?.tab} />;
      case '/employee/leads':
        return isSalesDept ? <SalesWorkspace initialSubView="leads" onNavigateGlobal={handleNavigate} /> : <LeadsPage {...(routeFilters || {})} />;
      case '/employee/call-leads':
        return isSalesDept ? <SalesWorkspace initialSubView="telecalling" onNavigateGlobal={handleNavigate} /> : <CallLeadsPage />;
      case '/employee/milestones':
        return <MilestonesPage onNavigate={(tab) => handleNavigate(tab === 'Payments' ? '/employee/payments' : '/employee/dashboard')} />;
      case '/employee/quotations':
        return isSalesDept ? <SalesWorkspace initialSubView="quotations" onNavigateGlobal={handleNavigate} /> : <QuotationsPortalPage />;
      case '/employee/tasks':
        return <TasksPage onNavigate={handleNavigate} />;
      case '/employee/calendar':
        return <CalendarPage onNavigate={handleNavigate} />;
      case '/employee/payments':
        return isSalesDept ? <SalesWorkspace initialSubView="bookings" onNavigateGlobal={handleNavigate} /> : <PaymentsPage onNavigate={handleNavigate} />;
      case '/employee/stock':
        return <StockPage />;
      case '/employee/eod-report':
        return <EmployeeEodReportPage />;
      case '/employee/profile':
        return <ProfilePage />;
      case '/employee/reports':
        return isSalesDept ? <SalesWorkspace initialSubView="reports" onNavigateGlobal={handleNavigate} /> : <AdminReportsPage onNavigate={handleNavigate} />;
      default:
        return isSalesDept ? <SalesWorkspace onNavigateGlobal={handleNavigate} /> : <EmployeeDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="admin-layout">
      <EmployeeSidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        isMobileMenuOpen={isMobileMenuOpen}
        toggleMobileMenu={toggleMobileMenu}
        stageAnimation={stageAnimation}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onSignOut={onSignOut}
      />
      
      {/* Mobile overlay */}
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={toggleMobileMenu}></div>}

      <main className="admin-main">
        <header className={`admin-header ${stageAnimation >= 1 ? 'reveal' : ''}`}>
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
              <Menu size={24} />
            </button>
            <div className="breadcrumb desktop-only">
              <span className="text-muted">Solar CRM</span>
              <span className="mx-2 text-muted">/</span>
              <span className="font-semibold text-navy">
                {isSalesDept ? 'Sales Department' : 'Employee Workspace'}
              </span>
            </div>
          </div>
          
          <div className="header-right">
            <button className="notification-btn">
              <Bell size={20} />
              <span className="notification-indicator"></span>
            </button>
            
            <div className="profile-dropdown" onClick={() => setCurrentPath('/employee/profile')}>
              <div className="avatar">{currentUser?.initials || 'EM'}</div>
              <div className="profile-info desktop-only">
                <span className="profile-name">{currentUser?.name || 'Employee'}</span>
                <span className="profile-role">
                  {currentUser?.employeeCategory || (isSalesDept ? 'Sales Department' : 'Employee')}
                </span>
              </div>
            </div>
          </div>
        </header>

        <ErrorBoundary fallbackTitle="Sales Workspace Error" fallbackMessage="Could not load the requested section. You can switch to another tab or reload.">
          <Suspense fallback={<RouteLoadingFallback message="Loading Sales Department Workspace..." subMessage="Mirror Solar Vision Commercial Operations" />}>
            {renderPage()}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Floating Glassmorphic Mobile Bottom Navigation */}
      <MobileBottomNav 
        role="Employee"
        activeTab={currentPath}
        onSelectTab={handleNavigate}
        onOpenMenu={toggleMobileMenu}
        employeeCategory={currentUser?.employeeCategory}
      />
    </div>
  );
}
