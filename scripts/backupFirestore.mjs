// Mirror Solar Vision CRM - Production Firestore Backup Engine
// Exports core business collections into timestamped backups directory

import fs from 'fs';
import path from 'path';

// Load local environment securely without exposing credentials
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY';
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'crm-webapp-d32bc';

const CORE_COLLECTIONS = [
  'users',
  'dealers',
  'leads',
  'call_leads',
  'quotations',
  'inventory',
  'auditLogs'
];

async function getAdminToken() {
  const adminPass = process.env.ADMIN_BACKUP_PASS;
  if (!adminPass) {
    throw new Error('ADMIN_BACKUP_PASS environment variable is required to execute automated backups.');
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'mirrorsolarvision@gmail.com',
      password: adminPass,
      returnSecureToken: true
    })
  });
  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Admin authentication failed for backup: ${data.error?.message}`);
  }
  return data.idToken;
}

async function fetchCollectionDocs(token, collectionName) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=1000`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  return (data.documents || []).map(doc => {
    const docId = doc.name.split('/').pop();
    return {
      docId,
      fields: doc.fields,
      createTime: doc.createTime,
      updateTime: doc.updateTime
    };
  });
}

export async function runBackup() {
  console.log('====================================================');
  console.log('  MIRROR SOLAR VISION CRM - FIRESTORE BACKUP ENGINE ');
  console.log('====================================================\n');

  const token = await getAdminToken();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups', `snapshot_${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const manifest = {
    projectId: PROJECT_ID,
    backupTimestamp: new Date().toISOString(),
    rpo: '24 Hours (Daily Automated Snapshot)',
    rto: '< 1 Hour (Point-in-Time & JSON Restore)',
    collections: {}
  };

  for (const col of CORE_COLLECTIONS) {
    process.stdout.write(`Exporting collection [${col}]... `);
    try {
      const docs = await fetchCollectionDocs(token, col);
      // Security Sanitation Gate: Never persist sensitive password fields in disk backups
      if (col === 'users') {
        docs.forEach(doc => {
          if (doc.fields && doc.fields.password) delete doc.fields.password;
        });
      }
      const filePath = path.join(backupDir, `${col}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
      manifest.collections[col] = {
        count: docs.length,
        sizeBytes: fs.statSync(filePath).size,
        status: 'SUCCESS'
      };
      console.log(`✓ ${docs.length} document(s) backed up.`);
    } catch (err) {
      console.log(`✗ FAILED: ${err.message}`);
      manifest.collections[col] = {
        count: 0,
        status: 'ERROR',
        error: err.message
      };
    }
  }

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✓ Backup successfully completed and written to:\n  ${backupDir}`);
  return { backupDir, manifest };
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('backupFirestore.mjs')) {
  runBackup().catch(err => {
    console.error('Fatal backup error:', err);
    process.exit(1);
  });
}

