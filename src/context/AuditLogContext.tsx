import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, limit } from 'firebase/firestore';
import type { AuditLogEntry, AuditAction, EntityType } from '../types/audit';
import { useAuth } from './AuthContext';

interface AuditLogContextType {
  logs: AuditLogEntry[];
  logAction: (params: {
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    entityLabel?: string;
    previousValue?: any;
    newValue?: any;
    diffSummary?: string;
    reason?: string;
  }) => Promise<void>;
  filterLogs: (filters: {
    entityType?: EntityType;
    entityId?: string;
    userId?: string;
    action?: AuditAction;
  }) => AuditLogEntry[];
}

const AuditLogContext = createContext<AuditLogContextType | undefined>(undefined);

export const useAudit = () => {
  const ctx = useContext(AuditLogContext);
  if (!ctx) throw new Error('useAudit must be used within an AuditLogProvider');
  return ctx;
};

export const AuditLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    try {
      const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(500));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedLogs: AuditLogEntry[] = [];
        snapshot.forEach((doc) => {
          fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLogEntry);
        });
        setLogs(fetchedLogs);
      }, (error) => {
        console.warn('Audit logs listener fallback:', error.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Audit logs init fallback:', err);
    }
  }, []);

  const logAction = async (params: {
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    entityLabel?: string;
    previousValue?: any;
    newValue?: any;
    diffSummary?: string;
    reason?: string;
  }) => {
    const entry: Omit<AuditLogEntry, 'id'> = {
      userId: currentUser?.id || 'system',
      userName: currentUser?.name || 'System User',
      userRole: (currentUser?.role as any) || 'System',
      dealerId: (currentUser as any)?.dealerId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      timestamp: new Date().toISOString(),
      previousValue: params.previousValue,
      newValue: params.newValue,
      diffSummary: params.diffSummary,
      reason: params.reason
    };

    try {
      await addDoc(collection(db, 'auditLogs'), entry);
    } catch (err) {
      console.error('Failed to write audit log to Firestore:', err);
      // Local optimistic update
      setLogs((prev) => [{ id: `local-audit-${Date.now()}`, ...entry }, ...prev]);
    }
  };

  const filterLogs = (filters: {
    entityType?: EntityType;
    entityId?: string;
    userId?: string;
    action?: AuditAction;
  }) => {
    return logs.filter((l) => {
      if (filters.entityType && l.entityType !== filters.entityType) return false;
      if (filters.entityId && l.entityId !== filters.entityId) return false;
      if (filters.userId && l.userId !== filters.userId) return false;
      if (filters.action && l.action !== filters.action) return false;
      return true;
    });
  };

  return (
    <AuditLogContext.Provider value={{ logs, logAction, filterLogs }}>
      {children}
    </AuditLogContext.Provider>
  );
};
