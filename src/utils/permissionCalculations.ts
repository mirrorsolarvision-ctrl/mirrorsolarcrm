import type { User, UserPermissions, Dealer, DealerFeatures } from '../context/CRMContext';
import { defaultDealerFeatures, defaultEmployeeFeatures } from '../context/CRMContext';

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

// Route Mapping Helper - STRICT ADMIN APPROVAL GATING
export const canAccessRoute = (user: User | null, routeTabName: string, dealers?: Dealer[]): boolean => {
  // If no user context yet, allow access to standard base routes
  if (!user) return true;
  if (user.status === 'Inactive') return false; // Disabled users can't access anything
  if (user.role === 'Admin') return true; // Admin has full uninhibited access to all modules

  // Merge active features for this user with defaults
  const defaults = user.role === 'Dealer' ? defaultDealerFeatures : defaultEmployeeFeatures;
  let features: DealerFeatures = {
    ...defaults,
    ...(user.features || {})
  };

  // If dealers array is provided and user is a dealer, check latest dealer state
  if (user.role === 'Dealer' && dealers) {
    const liveDealer = dealers.find(d => d.id === user.id || d.name === user.name);
    if (liveDealer && liveDealer.features) {
      features = {
        ...defaults,
        ...liveDealer.features
      };
    }
  }

  switch (routeTabName) {
    case 'Dashboard':
      return true;
    case 'Attendance':
      return features.attendance !== false;
    case 'Quotations':
      return features.quotations !== false;
    case 'Leads':
    case 'My Leads':
      return features.leads !== false;
    case 'Stock':
      return features.stock !== false;
    case 'Reports':
      return features.reports !== false;
    case 'Payments':
    case 'Finance':
    case 'Finance & Payments':
      return features.payments !== false;
    case 'Milestones':
    case 'Project Milestones':
    case 'Sales Milestones':
      return true;
    case 'Tasks':
      return features.tasks !== false;
    case 'Calendar':
      return features.calendar !== false;
    case 'My Employees':
    case 'Employees':
      return features.myEmployees !== false;
    case 'EOD Report':
    case 'Day End Report':
    case 'EOD':
      return true;
    case 'Call Leads':
    case 'Office Call Leads':
    case 'Office Phone Leads':
      return true; // Available to Employees and Admins
    case 'Profile':
      return true;
    default:
      return true;
  }
};

/**
 * Check if the user is authorized to forward office phone call leads to dealers.
 * Normally allowed only for Admin, unless an Employee has been granted this specific permission.
 */
export const canForwardCallLeadToDealer = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (isSalesTelecallerEmployee(user)) return true;
  return !!(
    user.features?.forwardCallLeadToDealer || 
    user.permissions?.forwardCallLeadToDealer || 
    user.canForwardToDealer
  );
};

// --- Sales Department Workflow Helpers (Sales Manager vs Telecaller) ---

export const isSalesManager = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  const category = ((user as any).employeeCategory || (user as any).category || '').toLowerCase();
  const resp = (user as any).responsibilities?.primaryResponsibilityId || '';
  if (category.includes('manager') || resp.includes('sales_manager')) return true;
  if (category === 'sales manager (telecaller)') return true;
  return false;
};

export const isTelecaller = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return false;
  const category = ((user as any).employeeCategory || (user as any).category || '').toLowerCase();
  const resp = (user as any).responsibilities?.primaryResponsibilityId || '';
  if (category.includes('manager') || resp.includes('sales_manager')) return false;
  return category.includes('telecaller') || category.includes('sales executive') || resp.includes('telecaller');
};

export const isSalesDepartmentUser = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  const category = ((user as any).employeeCategory || (user as any).category || '').toLowerCase();
  const resp = (user as any).responsibilities?.primaryResponsibilityId || '';
  return category.includes('sales') || category.includes('telecaller') || resp.includes('sales') || resp.includes('telecaller');
};

export const isSalesTelecallerEmployee = (user: User | null): boolean => {
  return isSalesDepartmentUser(user);
};

export const canViewAllTeamLeads = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  return isSalesManager(user);
};

export const canReassignLeads = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  return isSalesManager(user);
};

export const canApproveDiscount = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'Admin'; // Admin only authorization
};

export const canVerifyPayment = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'Admin'; // Admin / Accounts verification only
};

export const canApproveDealerHandoff = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'Admin'; // Admin approval required before dealer execution
};
