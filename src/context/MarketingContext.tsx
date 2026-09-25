import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { MarketingLead, MarketingCampaign, LeadSource, MarketingStage } from '../types/marketing';
import { useAuth } from './AuthContext';
import { useAudit } from './AuditLogContext';

interface MarketingContextType {
  leads: MarketingLead[];
  campaigns: MarketingCampaign[];
  loading: boolean;
  createLead: (leadData: Omit<MarketingLead, 'id' | 'createdAt' | 'updatedAt' | 'callCount' | 'notes'>) => Promise<MarketingLead>;
  updateLead: (id: string, updates: Partial<MarketingLead>) => Promise<void>;
  addLeadNote: (id: string, text: string) => Promise<void>;
  updateLeadStage: (id: string, stage: MarketingStage) => Promise<void>;
  createCampaign: (campaign: Omit<MarketingCampaign, 'id'>) => Promise<void>;
  getMetrics: () => {
    totalLeads: number;
    newEnquiries: number;
    contacted: number;
    surveysBooked: number;
    quotationsSent: number;
    won: number;
    lost: number;
    conversionRate: number;
    sourceBreakdown: Record<LeadSource, number>;
  };
}

const MarketingContext = createContext<MarketingContextType | undefined>(undefined);

export const useMarketing = () => {
  const ctx = useContext(MarketingContext);
  if (!ctx) throw new Error('useMarketing must be used within a MarketingProvider');
  return ctx;
};

export const MarketingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const { logAction } = useAudit();

  useEffect(() => {
    try {
      const q = query(collection(db, 'marketingLeads'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: MarketingLead[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as MarketingLead);
        });
        setLeads(fetched);
        setLoading(false);
      }, (err) => {
        console.warn('Marketing leads fallback:', err.message);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Marketing init fallback:', err);
      setLoading(false);
    }
  }, []);

  const createLead = async (leadData: Omit<MarketingLead, 'id' | 'createdAt' | 'updatedAt' | 'callCount' | 'notes'>): Promise<MarketingLead> => {
    const id = `MKT_${Date.now()}`;
    const now = new Date().toISOString();
    const newLead: MarketingLead = {
      ...leadData,
      id,
      callCount: 0,
      notes: [],
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'marketingLeads', id), newLead);
    } catch (err) {
      console.error('Marketing lead save error:', err);
      setLeads((prev) => [newLead, ...prev]);
    }

    await logAction({
      action: 'LEAD_CREATED',
      entityType: 'Lead',
      entityId: id,
      entityLabel: `${newLead.customerName} via ${newLead.source}`,
      newValue: newLead
    });

    return newLead;
  };

  const updateLead = async (id: string, updates: Partial<MarketingLead>) => {
    const existing = leads.find((l) => l.id === id);
    if (!existing) return;

    const payload = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'marketingLeads', id), payload);
    } catch (err) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...payload } : l)));
    }
  };

  const addLeadNote = async (id: string, text: string) => {
    const existing = leads.find((l) => l.id === id);
    if (!existing) return;

    const newNote = {
      id: `note-${Date.now()}`,
      text,
      author: currentUser?.name || 'Marketing Rep',
      createdAt: new Date().toISOString()
    };

    const updatedNotes = [newNote, ...(existing.notes || [])];
    await updateLead(id, { notes: updatedNotes, callCount: existing.callCount + 1 });
  };

  const updateLeadStage = async (id: string, stage: MarketingStage) => {
    const existing = leads.find((l) => l.id === id);
    if (!existing) return;

    await updateLead(id, { stage });

    await logAction({
      action: 'LEAD_STAGE_CHANGED',
      entityType: 'Lead',
      entityId: id,
      entityLabel: `${existing.customerName} stage -> ${stage}`,
      previousValue: existing.stage,
      newValue: stage
    });
  };

  const createCampaign = async (campaign: Omit<MarketingCampaign, 'id'>) => {
    const id = `CMP_${Date.now()}`;
    const newCamp: MarketingCampaign = { id, ...campaign };
    setCampaigns((prev) => [newCamp, ...prev]);
  };

  const getMetrics = () => {
    const totalLeads = leads.length;
    const newEnquiries = leads.filter((l) => l.stage === 'NEW_LEAD').length;
    const contacted = leads.filter((l) => l.stage === 'CONTACTED').length;
    const surveysBooked = leads.filter((l) => l.stage === 'SITE_SURVEY_BOOKED').length;
    const quotationsSent = leads.filter((l) => l.stage === 'QUOTATION_SENT').length;
    const won = leads.filter((l) => l.stage === 'WON').length;
    const lost = leads.filter((l) => l.stage === 'LOST').length;
    const conversionRate = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;

    const sourceBreakdown: Record<LeadSource, number> = {
      Facebook: 0, Instagram: 0, Google: 0, WhatsApp: 0, Website: 0,
      YouTube: 0, Referral: 0, Dealer: 0, 'Walk-in': 0, Exhibition: 0, Other: 0
    };

    leads.forEach((l) => {
      if (sourceBreakdown[l.source] !== undefined) {
        sourceBreakdown[l.source]++;
      }
    });

    return {
      totalLeads,
      newEnquiries,
      contacted,
      surveysBooked,
      quotationsSent,
      won,
      lost,
      conversionRate,
      sourceBreakdown
    };
  };

  return (
    <MarketingContext.Provider
      value={{
        leads,
        campaigns,
        loading,
        createLead,
        updateLead,
        addLeadNote,
        updateLeadStage,
        createCampaign,
        getMetrics
      }}
    >
      {children}
    </MarketingContext.Provider>
  );
};
