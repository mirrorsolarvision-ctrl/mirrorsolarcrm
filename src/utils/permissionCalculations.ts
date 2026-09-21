import type { User, UserPermissions, Dealer, DealerFeatures } from '../context/CRMContext';
import { defaultDealerFeatures } from '../context/CRMContext';

/**
 * Basic check if user has ANY access (view, edit, or full) to a module
 */
export const hasPermission = (user: User | null, module: keyof UserPermissions): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (!user.permissions) {
    return false;
  }
  const level = user.permissions[module];
  return level !== 'none' && level !== undefined;
};

/**
 * Check if a specific Dealer has a feature enabled (Source of Truth)
 */
export const hasDealerFeature = (dealers: Dealer[], dealerId: string | undefined, feature: keyof DealerFeatures): boolean => {
  if (!dealerId) return false;
  const dealer = dealers.find(d => d.id === dealerId);
  if (!dealer) return false;
  const features = dealer.features || defaultDealerFeatures;
  return !!features[feature];
};

/**
 * Strict check if user has 'full' or 'edit' access
 */
export const canManageModule = (user: User | null, module: keyof UserPermissions): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (!user.permissions) return false;
  const level = user.permissions[module];
  return level === 'full' || level === 'edit';
};

// --- Specific Module Helpers ---

export const canAccessDashboard = (user: User | null) => hasPermission(user, 'dashboard');
export const canAccessLeads = (user: User | null) => hasPermission(user, 'leads');
export const canAccessStock = (user: User | null) => hasPermission(user, 'stock');
export const canAccessReports = (user: User | null) => hasPermission(user, 'reports');
export const canAccessAccessControl = (user: User | null) => hasPermission(user, 'access');
export const canAccessEmployees = (user: User | null) => hasPermission(user, 'employees');
export const canAccessDealers = (user: User | null) => hasPermission(user, 'dealers');

export const canManageEmployees = (user: User | null) => canManageModule(user, 'employees');
export const canManageDealers = (user: User | null) => canManageModule(user, 'dealers');
export const canManageAccess = (user: User | null) => canManageModule(user, 'access');

// Route Mapping Helper
export const canAccessRoute = (user: User | null, routeTabName: string, dealers?: Dealer[]): boolean => {
  if (!user) return false;
  if (user.status === 'Inactive') return false; // Disabled users can't access anything

  if (user.role === 'Dealer' && dealers) {
    if (routeTabName === 'Attendance') return hasDealerFeature(dealers, user.id, 'attendance');
    if (routeTabName === 'My Employees') return hasDealerFeature(dealers, user.id, 'myEmployees');
    if (routeTabName === 'Stock') return hasDealerFeature(dealers, user.id, 'stock');
    if (routeTabName === 'Reports') return hasDealerFeature(dealers, user.id, 'reports');
    if (routeTabName === 'Payments') return hasDealerFeature(dealers, user.id, 'payments');
    if (routeTabName === 'Tasks') return hasDealerFeature(dealers, user.id, 'tasks');
    if (routeTabName === 'Calendar') return hasDealerFeature(dealers, user.id, 'calendar');
    if (routeTabName === 'Leads') return hasDealerFeature(dealers, user.id, 'leads');
  }

  switch (routeTabName) {
    case 'Dashboard':
      return canAccessDashboard(user);
    case 'Attendance':
      return true;
    case 'Leads':
      return canAccessLeads(user);
    case 'Employees':
    case 'My Employees':
      return canAccessEmployees(user);
    case 'Dealers':
      return canAccessDealers(user);
    case 'Stock':
      return canAccessStock(user);
    case 'Reports':
      return canAccessReports(user);
    case 'Access':
      return canAccessAccessControl(user);
    case 'Payments':
      return user.role === 'Admin' || user.role === 'Dealer';
    case 'Profile':
      return hasPermission(user, 'profile');
    default:
      return true;
  }
};

