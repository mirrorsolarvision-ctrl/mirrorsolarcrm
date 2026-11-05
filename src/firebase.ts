import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Strict Environment Isolation Gate
const mode = (import.meta.env.MODE || (import.meta.env.VITE_ENV as string) || 'development').toLowerCase();
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

// HARD FAILURE 1: Staging and Local Development MUST NEVER resolve to production project
if ((mode === 'staging' || mode === 'development') && projectId === 'crm-webapp-d32bc') {
  throw new Error(
    `[CRITICAL SECURITY ALERT] ${mode.toUpperCase()} environment resolved to production Firebase project "${projectId}". Release/boot sequence halted to protect production data.`
  );
}

// HARD FAILURE 2: Production project can ONLY be targeted when MODE='production'
if (projectId === 'crm-webapp-d32bc' && mode !== 'production') {
  throw new Error(
    `[CRITICAL SECURITY ALERT] Production Firebase project can ONLY be targeted when MODE='production'. Current mode: "${mode}".`
  );
}

// HARD FAILURE 3: Missing project ID (prohibits silent fallback)
if (!projectId) {
  throw new Error(
    `[CONFIGURATION ERROR] VITE_FIREBASE_PROJECT_ID is not defined. Silent fallback to production is prohibited.`
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'dummy-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || `1:000000000000:web:${projectId}`
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Local Development & Emulator Integration
// In development mode or when VITE_USE_EMULATORS=true, route traffic to local Firebase Emulators
const useEmulators = mode === 'development' || import.meta.env.VITE_USE_EMULATORS === 'true';
if (useEmulators && typeof window !== 'undefined' && !(window as any).__FIREBASE_EMULATORS_CONNECTED__) {
  try {
    const emulatorHost = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
    connectStorageEmulator(storage, emulatorHost, 9199);
    connectFunctionsEmulator(functions, emulatorHost, 5001);
    (window as any).__FIREBASE_EMULATORS_CONNECTED__ = true;
    console.info(`[MSV CRM] Connected to Firebase Local Emulator Suite at ${emulatorHost}`);
  } catch (err) {
    console.warn('[MSV CRM] Emulator connection warning:', err);
  }
}

// Visible environment logging at startup
if (typeof window !== 'undefined') {
  console.info(`[MSV CRM] Environment: ${mode.toUpperCase()} | Project: ${projectId} | Emulators: ${useEmulators}`);
}
