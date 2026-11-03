// Mirror Solar Vision CRM - Trusted Backend Authority
// Cloud Functions for DEF-010: Trusted Payment Verification & Segregation of Duties

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * DEF-010: Trusted Payment Verification Operation
 * 
 * Enforces authoritative 10-point financial verification gate:
 * 1. Caller Authentication
 * 2. Authoritative Role Check (Admin or Accounts)
 * 3. Firestore Record Retrieval
 * 4. Pendency Check (Replay/duplicate prevention)
 * 5. UID Identity Comparison (recordedByUid vs verifierUid)
 * 6. Anti-Self-Approval for Accounts Officers
 * 7. Verification Amount and Reference Validation
 * 8. Atomic Multi-Document Transaction
 * 9. Authoritative Audit Event Generation
 * 10. Concurrency and Race-Condition Protection
 */
export const verifyCustomerPayment = onCall({ cors: true }, async (request) => {
  // 1. Authenticate the caller
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required to verify customer payments.');
  }

  const verifierUid = request.auth.uid;
  const verifierEmail = request.auth.token?.email || '';

  // Parse and validate payload
  const { leadId, paymentId, verifiedAmount, referenceNumber, notes } = request.data || {};
  if (!leadId || !paymentId) {
    throw new HttpsError('invalid-argument', 'Both leadId and paymentId are required.');
  }

  // 2. Read caller authoritative role from Firestore /users/{uid}
  const userDocSnap = await db.collection('users').doc(verifierUid).get();
  let verifierRole = 'Employee';
  let verifierCategory = '';
  let verifierName = verifierEmail.split('@')[0];

  if (userDocSnap.exists) {
    const userData = userDocSnap.data() || {};
    verifierRole = userData.role || 'Employee';
    verifierCategory = (userData.employeeCategory || userData.category || '').trim();
    verifierName = userData.name || verifierName;
  } else if (
    ['mirrorsolarvision@gmail.com', 'mirroraquaro@gmail.com', 'balajiperuri09@gmail.com'].includes(verifierEmail.toLowerCase()) ||
    request.auth.token?.role === 'Admin'
  ) {
    verifierRole = 'Admin';
    verifierName = 'Super Admin';
  }

  const isAdmin = verifierRole === 'Admin';
  const isAccounts = verifierRole === 'Accounts' || verifierCategory.toLowerCase().includes('accounts');

  if (!isAdmin && !isAccounts) {
    throw new HttpsError(
      'permission-denied',
      'Permission Denied: Payment verification is strictly reserved for Admin and Accounts authority.'
    );
  }

  const leadRef = db.collection('leads').doc(leadId);

  // Execute atomic verification transaction
  return await db.runTransaction(async (transaction) => {
    // 3. Read existing payment record from Firestore
    const leadSnap = await transaction.get(leadRef);
    if (!leadSnap.exists) {
      throw new HttpsError('not-found', `Lead document ${leadId} not found.`);
    }

    const leadData = leadSnap.data() || {};
    const paymentsObj = leadData.payments || {};
    const customerPayments = (paymentsObj.customerPayments || []);

    const targetPaymentIndex = customerPayments.findIndex(p => p.id === paymentId);
    if (targetPaymentIndex === -1) {
      throw new HttpsError('not-found', `Payment record ${paymentId} not found on lead ${leadId}.`);
    }

    const targetPayment = customerPayments[targetPaymentIndex];

    // 4. Verify payment is pending (prevent replay / duplicate verification)
    if (targetPayment.status === 'Verified') {
      throw new HttpsError(
        'already-exists',
        `Replay Prevention: Payment ${paymentId} has already been verified on ${targetPayment.verifiedAt} by ${targetPayment.verifiedBy || targetPayment.verifiedByUid}.`
      );
    }
    if (targetPayment.status !== 'Pending Verification') {
      throw new HttpsError(
        'failed-precondition',
        `Cannot verify payment ${paymentId}: status is currently "${targetPayment.status}".`
      );
    }

    // 5. Compare recordedByUid with the authenticated verifier UID
    const recordedByUid = targetPayment.recordedByUid || '';
    const recordedByName = targetPayment.recordedBy || '';
    const isSelfRecorded = (recordedByUid && recordedByUid === verifierUid) ||
      (!recordedByUid && recordedByName && recordedByName.toLowerCase().trim() === verifierName.toLowerCase().trim());

    // 6. Anti-Self-Approval Enforcement (Strict Segregation of Duties across ALL roles)
    // Anti-self-approval is enforced unconditionally across all users including Super Admin.
    if (isSelfRecorded) {
      throw new HttpsError(
        'failed-precondition',
        'Segregation of Duties Violation: You cannot verify a payment you personally recorded. Verification must be performed by an independent secondary verifier.'
      );
    }

    // 7. Validate requested verification amount and payment reference if supplied
    if (verifiedAmount !== undefined && verifiedAmount !== null) {
      const parsedAmount = Number(verifiedAmount);
      if (parsedAmount !== Number(targetPayment.amount)) {
        throw new HttpsError(
          'invalid-argument',
          `Amount Mismatch: Requested verification amount (₹${parsedAmount}) does not match recorded advance (₹${targetPayment.amount}).`
        );
      }
    }
    if (referenceNumber && targetPayment.referenceNumber && referenceNumber !== targetPayment.referenceNumber) {
      throw new HttpsError(
        'invalid-argument',
        `Reference Mismatch: Verification reference "${referenceNumber}" does not match recorded reference "${targetPayment.referenceNumber}".`
      );
    }

    // 8. Atomically update payment status and verification metadata
    const verifiedIso = new Date().toISOString();
    const updatedPayment = {
      ...targetPayment,
      status: 'Verified',
      verifiedByUid: verifierUid,
      verifiedBy: verifierName,
      verifiedByEmail: verifierEmail,
      verifiedByRole: isAdmin ? 'Admin' : 'Accounts',
      verifiedAt: verifiedIso,
      settledBy: verifierName,
      settledByRole: isAdmin ? 'Admin' : 'Accounts',
      verificationMethod: 'TRUSTED_BACKEND_CLOUD_FUNCTION',
      verificationNotes: notes || ''
    };

    const updatedCustomerPayments = [...customerPayments];
    updatedCustomerPayments[targetPaymentIndex] = updatedPayment;

    // Update lead document
    transaction.update(leadRef, {
      'payments.customerPayments': updatedCustomerPayments,
      'payments.paymentVerificationStatus': 'Verified',
      paymentVerificationStatus: 'Verified',
      salesStage: 'Booking Confirmed',
      stage: 'Converted',
      updatedAt: verifiedIso
    });

    // 9. Create authoritative audit event in /auditLogs
    const auditId = `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const auditRef = db.collection('auditLogs').doc(auditId);

    transaction.set(auditRef, {
      id: auditId,
      action: 'PAYMENT_VERIFIED',
      leadId: leadId,
      customerName: leadData.customer || '',
      paymentId: paymentId,
      amount: targetPayment.amount,
      paymentMode: targetPayment.paymentMode || targetPayment.mode || 'N/A',
      referenceNumber: targetPayment.referenceNumber || '',
      recordedByUid: recordedByUid || 'legacy_unrecorded',
      recordedByName: recordedByName,
      verifiedByUid: verifierUid,
      verifiedByName: verifierName,
      verifiedByRole: isAdmin ? 'Admin' : 'Accounts',
      timestamp: verifiedIso,
      createdAt: verifiedIso,
      authoritativeSource: 'CloudFunction:verifyCustomerPayment',
      ipAddress: request.rawRequest?.ip || 'internal'
    });

    return {
      success: true,
      message: `Payment ${paymentId} successfully verified for customer ${leadData.customer}. Stage updated to Booking Confirmed.`,
      paymentId: paymentId,
      verifiedAt: verifiedIso,
      verifiedBy: verifierName,
      verifiedByRole: isAdmin ? 'Admin' : 'Accounts'
    };
  });
});

