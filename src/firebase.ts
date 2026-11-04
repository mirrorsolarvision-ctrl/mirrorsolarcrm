import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Strict Environment Isolation Gate
const mode = import.meta.env.MODE || (import.meta.env.VITE_ENV as string) || 'development';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

// Enforce strict staging isolation: block release if staging mode resolves to production
if (mode === 'staging' || import.meta.env.VITE_ENV === 'staging') {
  if (!projectId || projectId === 'crm-webapp-d32bc') {
    throw new Error(
      `[SECURITY ERROR] Staging mode requested but resolved to production Firebase project (${projectId}). Staging is blocked from accessing production resources.`
    );
  }
}

if (!projectId) {
  throw new Error(
    `[CONFIGURATION ERROR] VITE_FIREBASE_PROJECT_ID is not defined. Silent fallback to production is prohibited.`
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Visible environment logging at startup
if (typeof window !== 'undefined') {
  console.info(`[MSV CRM] Environment: ${mode.toUpperCase()} | Connected Project: ${projectId}`);
}
