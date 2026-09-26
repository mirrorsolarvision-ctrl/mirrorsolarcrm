import React, { createContext, useContext, useState, useEffect, type ReactNode, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { Quotation, QuotationItem, QuotationStatus, QuotationCustomerDetails, QuotationProjectDetails } from '../types/quotation';
import { LOCKED_COMPANY_DETAILS } from '../config/companyDetails';
import { calculateQuotationFinancials, recalculateLineItem, compareQuotationVersions } from '../utils/quotationCalculations';
import { useAuth } from './AuthContext';
import { useAudit } from './AuditLogContext';
import { useCRM } from './CRMContext';

interface QuotationContextType {
  quotations: Quotation[];
  myQuotations: Quotation[];
  loading: boolean;
  createQuotation: (params: {
    customer: QuotationCustomerDetails;
    project: QuotationProjectDetails;
    items: QuotationItem[];
    extraDiscount?: number;
    isSubsidyEligible?: boolean;
    leadId?: string;
    dealerId?: string;
    dealerName?: string;
    notes?: string;
    validityDays?: number;
  }) => Promise<Quotation>;
  updateQuotationDraft: (
    id: string,
    params: {
      customer?: QuotationCustomerDetails;
      project?: QuotationProjectDetails;
      items?: QuotationItem[];
      extraDiscount?: number;
      isSubsidyEligible?: boolean;
      notes?: string;
      validityDays?: number;
    }
  ) => Promise<void>;
  finalizeQuotation: (id: string) => Promise<void>;
  amendQuotation: (id: string, amendmentNotes?: string) => Promise<Quotation>;
  cancelQuotation: (id: string, reason?: string) => Promise<void>;
  duplicateQuotation: (id: string) => Promise<Quotation>;
  updateQuotationStatus: (id: string, status: QuotationStatus, reason?: string) => Promise<void>;
  getQuotationById: (id: string) => Quotation | undefined;
  getQuotationsByLeadId: (leadId: string) => Quotation[];
}

const QuotationContext = createContext<QuotationContextType | undefined>(undefined);

export const useQuotations = () => {
  const ctx = useContext(QuotationContext);
  if (!ctx) throw new Error('useQuotations must be used within a QuotationProvider');
  return ctx;
};

export const QuotationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser: authUser } = useAuth();
  const { currentUser: crmUser } = useCRM();
  const currentUser = authUser || crmUser;
  const { logAction } = useAudit();

  // Real-time Firestore sync
  useEffect(() => {
    try {
      const q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: Quotation[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as Quotation);
        });
        setQuotations(fetched);
        setLoading(false);
      }, (err) => {
        console.warn('Quotations snapshot fallback:', err.message);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Quotations init fallback:', err);
      setLoading(false);
    }
  }, []);

  // Filtered quotations based on user role (Strict Dealer Isolation)
  const myQuotations = useMemo(() => {
    if (!currentUser) return quotations;
    if (currentUser.role === 'Admin') return quotations;
    if (currentUser.role === 'Dealer') {
      const dealerId = (currentUser as any).dealerId || currentUser.id;
      return quotations.filter((q) => q.dealerId === dealerId || q.createdById === currentUser.id);
    }
    // Employee: see all quotations
    return quotations;
  }, [quotations, currentUser]);

  const generateQuotationNumber = (version: number = 1) => {
    const year = new Date().getFullYear();
    const count = quotations.length + 1;
    const padded = String(count).padStart(4, '0');
    return `MSV-QT-${year}-${padded}${version > 1 ? `-V${version}` : ''}`;
  };

  const createQuotation = async (params: {
    customer: QuotationCustomerDetails;
    project: QuotationProjectDetails;
    items: QuotationItem[];
    extraDiscount?: number;
    isSubsidyEligible?: boolean;
    leadId?: string;
    dealerId?: string;
    dealerName?: string;
    notes?: string;
    validityDays?: number;
  }): Promise<Quotation> => {
    const processedItems = params.items.map(recalculateLineItem);
    const financials = calculateQuotationFinancials(
      processedItems,
      params.extraDiscount || 0,
      params.isSubsidyEligible !== false,
      params.project.systemCapacityKw || 3
    );

    const now = new Date().toISOString();
    const qNumber = generateQuotationNumber(1);
    const quotationId = `QT_${Date.now()}`;

    const newQuotation: Quotation = {
      id: quotationId,
      quotationNumber: qNumber,
      version: 1,
      leadId: params.leadId,
      dealerId: params.dealerId || (currentUser as any)?.dealerId,
      dealerName: params.dealerName || (currentUser as any)?.dealerName,
      createdBy: currentUser?.name || 'Authorized User',
      createdByRole: (currentUser?.role as any) || 'Admin',
      createdById: currentUser?.id || 'admin',
      status: 'Draft',
      customer: params.customer,
      project: params.project,
      items: processedItems,
      financials,
      notes: params.notes || 'Includes delivery, mechanical & electrical installation, and testing.',
      validityDays: params.validityDays || 15,
      companySnapshot: { ...LOCKED_COMPANY_DETAILS },
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'quotations', quotationId), newQuotation);
    } catch (err) {
      console.error('Failed to save quotation to Firestore:', err);
      setQuotations((prev) => [newQuotation, ...prev]);
    }

    await logAction({
      action: 'QUOTATION_CREATED',
      entityType: 'Quotation',
      entityId: quotationId,
      entityLabel: `${qNumber} - ${params.customer.customerName}`,
      newValue: newQuotation,
      reason: 'Initial quotation drafted'
    });

    return newQuotation;
  };

  const updateQuotationDraft = async (
    id: string,
    params: {
      customer?: QuotationCustomerDetails;
      project?: QuotationProjectDetails;
      items?: QuotationItem[];
      extraDiscount?: number;
      isSubsidyEligible?: boolean;
      notes?: string;
      validityDays?: number;
    }
  ) => {
    const existing = quotations.find((q) => q.id === id);
    if (!existing) throw new Error('Quotation not found');
    if (existing.status !== 'Draft') {
      throw new Error('Only Draft quotations can be directly edited. Use Amend to modify finalized quotations.');
    }

    const updatedCustomer = params.customer || existing.customer;
    const updatedProject = params.project || existing.project;
    const rawItems = params.items || existing.items;
    const processedItems = rawItems.map(recalculateLineItem);

    const financials = calculateQuotationFinancials(
      processedItems,
      params.extraDiscount !== undefined ? params.extraDiscount : existing.financials.extraDiscount,
      params.isSubsidyEligible !== undefined ? params.isSubsidyEligible : existing.financials.subsidyEligible,
      updatedProject.systemCapacityKw || 3
    );

    const now = new Date().toISOString();
    const updates: Partial<Quotation> = {
      customer: updatedCustomer,
      project: updatedProject,
      items: processedItems,
      financials,
      notes: params.notes !== undefined ? params.notes : existing.notes,
      validityDays: params.validityDays !== undefined ? params.validityDays : existing.validityDays,
      updatedAt: now
    };

    try {
      await updateDoc(doc(db, 'quotations', id), updates);
    } catch (err) {
      console.error('Firestore update error:', err);
      setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    }

    await logAction({
      action: 'QUOTATION_EDITED',
      entityType: 'Quotation',
      entityId: id,
      entityLabel: `${existing.quotationNumber} - ${updatedCustomer.customerName}`,
      previousValue: existing,
      newValue: { ...existing, ...updates },
      reason: 'Quotation draft updated'
    });
  };

  const finalizeQuotation = async (id: string) => {
    const existing = quotations.find((q) => q.id === id);
    if (!existing) throw new Error('Quotation not found');

    const now = new Date().toISOString();
    const updates: Partial<Quotation> = {
      status: 'Sent',
      finalizedAt: now,
      sentAt: now,
      updatedAt: now
    };

    try {
      await updateDoc(doc(db, 'quotations', id), updates);
    } catch (err) {
      console.error('Firestore finalize error:', err);
      setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    }

    await logAction({
      action: 'QUOTATION_FINALIZED',
      entityType: 'Quotation',
      entityId: id,
      entityLabel: `${existing.quotationNumber} - ${existing.customer.customerName}`,
      reason: 'Quotation finalized and marked as Sent'
    });
  };

  /**
   * Amends a finalized quotation by creating a new version (V2, V3...) as Draft
   * without overwriting or deleting historical versions!
   */
  const amendQuotation = async (id: string, amendmentNotes?: string): Promise<Quotation> => {
    const parent = quotations.find((q) => q.id === id);
    if (!parent) throw new Error('Original quotation not found');

    const nextVersion = parent.version + 1;
    const now = new Date().toISOString();
    const newQuotationId = `QT_${Date.now()}`;
    const newQuotationNumber = `${parent.quotationNumber.split('-V')[0]}-V${nextVersion}`;

    // Mark parent quotation as 'Amended'
    try {
      await updateDoc(doc(db, 'quotations', parent.id), {
        status: 'Amended',
        updatedAt: now
      });
    } catch (err) {
      console.error('Parent update error:', err);
      setQuotations((prev) => prev.map((q) => (q.id === parent.id ? { ...q, status: 'Amended', updatedAt: now } : q)));
    }

    const versionRecord = {
      version: parent.version,
      quotationId: parent.id,
      createdAt: parent.createdAt,
      createdBy: parent.createdBy,
      grandTotal: parent.financials.grandTotal,
      status: 'Amended' as QuotationStatus,
      notes: amendmentNotes || 'Superseeded by new version',
      amendmentReason: amendmentNotes || 'Amended to next version'
    };

    const newQuotation: Quotation = {
      ...parent,
      id: newQuotationId,
      quotationNumber: newQuotationNumber,
      version: nextVersion,
      parentQuotationId: parent.id,
      status: 'Draft',
      amendmentReason: amendmentNotes || `Amended from ${parent.quotationNumber}`,
      amendedBy: currentUser?.name || 'Authorized User',
      amendedAt: now,
      notes: amendmentNotes ? `[Amendment V${nextVersion}]: ${amendmentNotes}\n${parent.notes}` : parent.notes,
      createdAt: now,
      updatedAt: now,
      finalizedAt: undefined,
      sentAt: undefined,
      versionHistory: [...(parent.versionHistory || []), versionRecord]
    };

    try {
      await setDoc(doc(db, 'quotations', newQuotationId), newQuotation);
    } catch (err) {
      console.error('Firestore save new version error:', err);
      setQuotations((prev) => [newQuotation, ...prev]);
    }

    await logAction({
      action: 'QUOTATION_AMENDED',
      entityType: 'Quotation',
      entityId: newQuotationId,
      entityLabel: `${newQuotationNumber} amended from ${parent.quotationNumber}`,
      previousValue: {
        quotationId: parent.id,
        version: parent.version,
        grandTotal: parent.financials.grandTotal
      },
      newValue: {
        quotationId: newQuotationId,
        version: nextVersion,
        grandTotal: newQuotation.financials.grandTotal
      },
      reason: amendmentNotes || `Amended to version ${nextVersion}`
    });

    return newQuotation;
  };

  const cancelQuotation = async (id: string, reason?: string) => {
    const existing = quotations.find((q) => q.id === id);
    if (!existing) return;

    const updates: Partial<Quotation> = {
      status: 'Cancelled',
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'quotations', id), updates);
    } catch (err) {
      setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    }

    await logAction({
      action: 'QUOTATION_CANCELLED',
      entityType: 'Quotation',
      entityId: id,
      entityLabel: existing.quotationNumber,
      reason: reason || 'Quotation cancelled by user'
    });
  };

  const duplicateQuotation = async (id: string): Promise<Quotation> => {
    const existing = quotations.find((q) => q.id === id);
    if (!existing) throw new Error('Quotation not found');

    const duplicateData = {
      customer: { ...existing.customer, customerName: `${existing.customer.customerName} (Copy)` },
      project: { ...existing.project },
      items: existing.items.map((it) => ({ ...it, id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` })),
      extraDiscount: existing.financials.extraDiscount,
      isSubsidyEligible: existing.financials.subsidyEligible,
      leadId: undefined,
      dealerId: existing.dealerId,
      dealerName: existing.dealerName,
      notes: existing.notes,
      validityDays: existing.validityDays
    };

    return await createQuotation(duplicateData);
  };

  const updateQuotationStatus = async (id: string, status: QuotationStatus, reason?: string) => {
    const existing = quotations.find((q) => q.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const updates: Partial<Quotation> = {
      status,
      updatedAt: now,
      ...(status === 'Accepted' ? { acceptedAt: now } : {}),
      ...(status === 'Converted' ? { convertedAt: now } : {})
    };

    try {
      await updateDoc(doc(db, 'quotations', id), updates);
    } catch (err) {
      setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    }

    await logAction({
      action: 'QUOTATION_STATUS_CHANGED',
      entityType: 'Quotation',
      entityId: id,
      entityLabel: `${existing.quotationNumber} -> ${status}`,
      reason: reason || `Status changed to ${status}`
    });
  };

  const getQuotationById = (id: string) => quotations.find((q) => q.id === id);
  const getQuotationsByLeadId = (leadId: string) => quotations.filter((q) => q.leadId === leadId);

  return (
    <QuotationContext.Provider
      value={{
        quotations,
        myQuotations,
        loading,
        createQuotation,
        updateQuotationDraft,
        finalizeQuotation,
        amendQuotation,
        cancelQuotation,
        duplicateQuotation,
        updateQuotationStatus,
        getQuotationById,
        getQuotationsByLeadId
      }}
    >
      {children}
    </QuotationContext.Provider>
  );
};
