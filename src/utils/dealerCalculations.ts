import type { MockLead, Activity, Employee } from '../context/CRMContext';
import type { StockRequest } from '../context/StockContext';

export const DEALER_TARGET_KW = 225; // 225 kW standard target
export const DEALER_TARGET_MONTHS = 18; // 18 months standard tenure window

export interface DealerCapacityMetrics {
  targetKw: number;
  targetMonths: number;
  totalConvertedKw: number;
  inPipelineKw: number;
  totalKw: number;
  targetProgressPercent: number;
  remainingKw: number;
  monthlyTargetKw: number;
  targetStatus: 'On Track' | 'Needs Attention' | 'Exceeded';
}

export interface DealerPerformance extends DealerCapacityMetrics {
  totalLeads: number;
  convertedLeads: number;
  activeLeads: number;
  conversionRate: number;
  performanceLevel: 'High' | 'Medium' | 'Low';
}

export const parseLeadCapacityKw = (lead: MockLead): number => {
  const specCap = lead.dealerSpecifications?.systemCapacityKw;
  if (specCap) {
    const match = String(specCap).match(/[\d.]+/);
    if (match) return parseFloat(match[0]) || 0;
  }
  return 3; // default average residential capacity 3 kW
};

export const getDealerCapacityMetrics = (dealer: string | { id?: string; name?: string }, leads: MockLead[]): DealerCapacityMetrics => {
  const dLeads = getDealerLeads(dealer, leads);
  let totalConvertedKw = 0;
  let inPipelineKw = 0;

  dLeads.forEach(lead => {
    const cap = parseLeadCapacityKw(lead);
    if (lead.stage === 'Converted' || lead.stage === 'Completed') {
      totalConvertedKw += cap;
    } else {
      inPipelineKw += cap;
    }
  });

  totalConvertedKw = Math.round(totalConvertedKw * 10) / 10;
  inPipelineKw = Math.round(inPipelineKw * 10) / 10;
  const totalKw = Math.round((totalConvertedKw + inPipelineKw) * 10) / 10;
  const targetKw = DEALER_TARGET_KW;
  const targetMonths = DEALER_TARGET_MONTHS;
  const targetProgressPercent = Math.min(100, Math.round((totalConvertedKw / targetKw) * 100));
  const remainingKw = Math.max(0, Math.round((targetKw - totalConvertedKw) * 10) / 10);
  const monthlyTargetKw = Math.round((targetKw / targetMonths) * 10) / 10; // 12.5 kW / month
  
  const targetStatus: 'On Track' | 'Needs Attention' | 'Exceeded' = 
    targetProgressPercent >= 100 ? 'Exceeded' :
    targetProgressPercent >= 20 ? 'On Track' : 'Needs Attention';

  return {
    targetKw,
    targetMonths,
    totalConvertedKw,
    inPipelineKw,
    totalKw,
    targetProgressPercent,
    remainingKw,
    monthlyTargetKw,
    targetStatus
  };
};

export const matchesDealer = (l: MockLead, dealer: string | { id?: string; name?: string }): boolean => {
  if (!dealer) return false;
  if (typeof dealer === 'string') {
    return (l.dealerId && l.dealerId === dealer) || l.dealer === dealer;
  }
  if (dealer.id && l.dealerId) {
    return l.dealerId === dealer.id;
  }
  if (dealer.id && l.dealerId === dealer.id) return true;
  if (dealer.name && l.dealer === dealer.name) return true;
  return false;
};

export const getDealerLeads = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  return leads.filter(l => matchesDealer(l, dealer) && !l.archived);
};

export const getDealerConvertedLeads = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  return leads.filter(l => matchesDealer(l, dealer) && l.stage === 'Converted' && !l.archived);
};

export const getDealerActiveLeads = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  return leads.filter(l => matchesDealer(l, dealer) && l.stage !== 'Converted' && l.stage !== 'Completed' && !l.archived);
};

export const getDealerConversionRate = (total: number, converted: number): number => {
  if (total === 0) return 0;
  return Math.round((converted / total) * 100);
};

export const getDealerPerformanceLevel = (conversionRate: number): 'High' | 'Medium' | 'Low' => {
  if (conversionRate >= 50) return 'High';
  if (conversionRate >= 30) return 'Medium';
  return 'Low';
};

export const getDealerPerformance = (dealer: string | { id?: string; name?: string }, leads: MockLead[]): DealerPerformance => {
  const dLeads = getDealerLeads(dealer, leads);
  const totalLeads = dLeads.length;
  const convertedLeads = getDealerConvertedLeads(dealer, leads).length;
  const activeLeads = getDealerActiveLeads(dealer, leads).length;
  const conversionRate = getDealerConversionRate(totalLeads, convertedLeads);
  const performanceLevel = getDealerPerformanceLevel(conversionRate);
  const capacityMetrics = getDealerCapacityMetrics(dealer, leads);

  return {
    totalLeads,
    convertedLeads,
    activeLeads,
    conversionRate,
    performanceLevel,
    ...capacityMetrics
  };
};

export const getDealerStockRequests = (dealerName: string, requests: StockRequest[]) => {
  return requests.filter(r => r.dealer === dealerName);
};

export const getDealerActivity = (dealerName: string, activities: Activity[]) => {
  return activities.filter(a => a.dealer === dealerName);
};

export const getDealerEmployees = (dealer: string | { id?: string; name?: string }, leads: MockLead[], employees: Employee[]) => {
  const dLeads = getDealerLeads(dealer, leads);
  const employeeNames = Array.from(new Set(dLeads.map(l => l.assignedEmployee)));
  
  return employeeNames.map(name => {
    const emp = employees.find(e => e.name === name);
    const empLeads = dLeads.filter(l => l.assignedEmployee === name);
    const empConverted = empLeads.filter(l => l.stage === 'Completed');
    return {
      name,
      employeeId: emp?.id,
      totalLeads: empLeads.length,
      convertedLeads: empConverted.length
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);
};

export const getDealerFollowUps = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  const dLeads = getDealerLeads(dealer, leads);
  const followUps = dLeads.map(l => l.followUp).filter(f => f !== undefined);
  
  return {
    total: followUps.length,
    dueToday: followUps.filter(f => f.status === 'Due Today').length,
    overdue: followUps.filter(f => f.status === 'Overdue').length,
    upcoming: followUps.filter(f => f.status === 'Upcoming').length,
    completed: followUps.filter(f => f.status === 'Completed').length,
  };
};

export const getDealerPipeline = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  const dLeads = getDealerLeads(dealer, leads);
  return {
    'Lead': dLeads.filter(l => l.stage === 'Lead').length,
    'Converted': dLeads.filter(l => l.stage === 'Converted').length,
    'Installation': dLeads.filter(l => l.stage === 'Installation').length,
    'Loan': dLeads.filter(l => l.stage === 'Loan').length,
    'Material': dLeads.filter(l => l.stage === 'Material').length,
    'Completed': dLeads.filter(l => l.stage === 'Completed').length,
  };
};

export const getDealerFollowUpsRaw = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  return getDealerLeads(dealer, leads)
    .filter(l => l.followUp)
    .map(l => ({ ...l.followUp, lead: l }));
};

export const getDealerOverdueFollowUps = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  return getDealerFollowUpsRaw(dealer, leads).filter(f => f.status === 'Overdue');
};

export const getDealerLeadOverview = (dealer: string | { id?: string; name?: string }, leads: MockLead[]) => {
  const dLeads = getDealerLeads(dealer, leads);
  return {
    'New': dLeads.filter(l => l.stage === 'Lead').length,
    'In Progress': dLeads.filter(l => l.stage === 'Installation' || l.stage === 'Loan' || l.stage === 'Material').length,
    'Converted': dLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length,
    'Lost': 0
  };
};
