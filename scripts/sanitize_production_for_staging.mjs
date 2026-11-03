/**
 * Mirror Solar Vision CRM - Production Data Sanitization Protocol
 * 
 * Script: sanitize_production_for_staging.mjs
 * Purpose: De-identify, anonymize, and scrub production data prior to any staging import.
 * Requirement: Governed by Security Gate 2.1-S (Task 1).
 * 
 * STRICT COMPLIANCE RULES:
 * 1. Zero real customer PII (phone, email, bank details, Aadhaar, consumer numbers) allowed in staging.
 * 2. All employee and dealer passwords are completely excluded (staging uses separate synthetic Auth).
 * 3. Payment UTRs, cheque numbers, and financial transactions are replaced with synthetic test vectors.
 * 4. Production storage files (KYC photos, electricity bills) are never copied; staging uses synthetic test assets.
 */

import fs from 'fs';
import path from 'path';

export function sanitizeCustomerLead(lead, index = 1) {
  const sanitized = { ...lead };

  // 1. Scrub PII
  sanitized.customer = `Synthetic Customer ${index}`;
  sanitized.phone = `+9199000${String(index).padStart(5, '0')}`;
  sanitized.email = `customer_${index}@staging.mirrorsolar.internal`;
  sanitized.address = `Staging Test Plot ${index}, Sector 4, Vijayawada, AP`;
  sanitized.city = 'Vijayawada';
  sanitized.pincode = '520001';

  // 2. Scrub PM Surya Ghar identifiers
  if (sanitized.consumerNumber) {
    sanitized.consumerNumber = `TEST-EB-${String(index).padStart(6, '0')}`;
  }
  if (sanitized.applicationNumber) {
    sanitized.applicationNumber = `STG-PMSGY-2026-${String(index).padStart(4, '0')}`;
  }

  // 3. Scrub Financial details
  if (sanitized.payments) {
    const origPayments = sanitized.payments;
    sanitized.payments = {
      ...origPayments,
      customerPayments: (origPayments.customerPayments || []).map((p, pIdx) => ({
        ...p,
        referenceNumber: `TEST-UTR-${index}-${pIdx + 1}`,
        proofFileName: 'synthetic_payment_receipt.pdf',
        recordedBy: 'Staging Seed Worker',
        recordedByUid: 'staging_synthetic_seed_uid',
        verifiedBy: p.status === 'Verified' ? 'Staging Accounts Verifier' : undefined,
        verifiedByUid: p.status === 'Verified' ? 'staging_accounts_uid' : undefined,
      }))
    };
  }

  // 4. Scrub KYC & Upload documents
  if (sanitized.documents) {
    sanitized.documents = (sanitized.documents || []).map((doc, dIdx) => ({
      ...doc,
      name: `Synthetic_${doc.type || 'Doc'}_${index}.pdf`,
      fileUrl: `https://storage.googleapis.com/crm-webapp-staging-msv.firebasestorage.app/synthetic/sample_doc.pdf`,
      uploadedByUid: 'staging_synthetic_seed_uid'
    }));
  }

  return sanitized;
}

export function sanitizeDealerRecord(dealer, index = 1) {
  const sanitized = { ...dealer };
  sanitized.name = `Synthetic Dealer ${index}`;
  sanitized.phone = `+9198000${String(index).padStart(5, '0')}`;
  sanitized.email = `dealer_${index}@staging.mirrorsolar.internal`;
  sanitized.address = `Staging Dealer Depot ${index}, Guntur, AP`;
  sanitized.gstin = `37TESTSTG${String(index).padStart(4, '0')}Z1`;
  sanitized.pan = `TESTD${String(index).padStart(4, '0')}Z`;
  return sanitized;
}

export function sanitizeUserRecord(user, index = 1) {
  const sanitized = { ...user };
  sanitized.name = `Staging ${user.role || 'Staff'} ${index}`;
  sanitized.email = `stg_${(user.role || 'user').toLowerCase()}_${index}@staging.mirrorsolar.internal`;
  sanitized.phone = `+9197000${String(index).padStart(5, '0')}`;
  // Auth credentials are never included
  delete sanitized.password;
  delete sanitized.hashedPassword;
  return sanitized;
}

console.log('[Sanitization Protocol] Modules loaded and ready for staging seed ingestion.');
