/**
 * Mirror Solar Vision Standardized ID Formats:
 * - Dealer:   MSV/DLR/NAME or MSV/DLR/01
 * - Employee: MSV/EMP/NAME or MSV/EMP/01
 * - Customer: MSV/CUS/001, MSV/CUS/002...
 */

export function formatCustomerCode(
  lead: { id?: string; customerCode?: string; code?: string; customer?: string } | null | undefined,
  fallbackIndex?: number
): string {
  if (!lead) return 'MSV/CUS/000';
  if (lead.customerCode && lead.customerCode.startsWith('MSV/CUS/')) return lead.customerCode;
  if (lead.code && lead.code.startsWith('MSV/CUS/')) return lead.code;
  if (lead.id && lead.id.startsWith('MSV/CUS/')) return lead.id;
  
  if (fallbackIndex !== undefined) {
    return `MSV/CUS/${String(fallbackIndex + 1).padStart(3, '0')}`;
  }
  
  const cleanId = (lead.id || '').replace(/[^a-zA-Z0-9]/g, '');
  const digits = cleanId.replace(/\D/g, '');
  if (digits.length >= 2) {
    return `MSV/CUS/${digits.slice(-3).padStart(3, '0')}`;
  }
  return `MSV/CUS/${cleanId.slice(-3).toUpperCase() || '001'}`;
}

export function formatDealerCode(
  dealer: { id?: string; name?: string; dealerCode?: string; code?: string; displayId?: string } | null | undefined,
  index?: number
): string {
  if (!dealer) return 'MSV/DLR/01';
  if (dealer.dealerCode && dealer.dealerCode.startsWith('MSV/DLR/')) return dealer.dealerCode;
  if (dealer.displayId && dealer.displayId.startsWith('MSV/DLR/')) return dealer.displayId;
  if (dealer.code && dealer.code.startsWith('MSV/DLR/')) return dealer.code;
  if (dealer.id && dealer.id.startsWith('MSV/DLR/')) return dealer.id;
  
  const cleanName = (dealer.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleanName) {
    return `MSV/DLR/${cleanName}`;
  }
  return `MSV/DLR/${String((index || 0) + 1).padStart(2, '0')}`;
}

export function formatEmployeeCode(
  emp: { id?: string; name?: string; employeeCode?: string; code?: string; displayId?: string } | null | undefined,
  index?: number
): string {
  if (!emp) return 'MSV/EMP/01';
  if (emp.employeeCode && emp.employeeCode.startsWith('MSV/EMP/')) return emp.employeeCode;
  if (emp.displayId && emp.displayId.startsWith('MSV/EMP/')) return emp.displayId;
  if (emp.code && emp.code.startsWith('MSV/EMP/')) return emp.code;
  if (emp.id && emp.id.startsWith('MSV/EMP/')) return emp.id;
  
  const cleanName = (emp.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleanName) {
    return `MSV/EMP/${cleanName}`;
  }
  return `MSV/EMP/${String((index || 0) + 1).padStart(2, '0')}`;
}
