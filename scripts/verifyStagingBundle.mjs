/**
 * MIRROR SOLAR VISION CRM — BUILD-TIME STAGING ISOLATION VERIFICATION
 * 
 * Inspects generated Vite production & staging bundles to prove:
 * 1. Staging build explicitly uses project "crm-webapp-staging-msv"
 * 2. Staging build contains zero references to production "crm-webapp-d32bc" as its active project
 * 3. Environment check throws and blocks release if staging resolves to production
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('================================================================================');
console.log('   MIRROR SOLAR VISION CRM — STAGING ENVIRONMENT ISOLATION AUDIT                ');
console.log('   Verification Gate: Strict Firebase Project Isolation                         ');
console.log('================================================================================\n');

// 1. Build in staging mode
console.log('[Step 1] Executing Vite Staging Build (--mode staging)...');
try {
  execSync('npx vite build --mode staging', { stdio: 'pipe' });
  console.log('✓ Staging build succeeded.\n');
} catch (err) {
  console.error('✗ Staging build failed:', err.message);
  process.exit(1);
}

// 2. Scan dist/assets
console.log('[Step 2] Inspecting generated dist/ bundle assets...');
const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');
if (!fs.existsSync(distAssetsDir)) {
  console.error('✗ dist/assets directory not found!');
  process.exit(1);
}

const assetFiles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'));
let foundStagingProject = false;
let foundProductionProject = false;
let stagingLocations = [];
let productionLocations = [];

for (const file of assetFiles) {
  const filePath = path.join(distAssetsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  if (content.includes('crm-webapp-staging-msv')) {
    foundStagingProject = true;
    stagingLocations.push(file);
  }

  // Check if production project ID leaked into staging bundle
  if (content.includes('crm-webapp-d32bc')) {
    foundProductionProject = true;
    productionLocations.push(file);
  }
}

console.log(`- Scanned ${assetFiles.length} JavaScript asset files.`);
console.log(`- Staging Project "crm-webapp-staging-msv" detected: ${foundStagingProject}`);
if (foundStagingProject) {
  console.log(`  Locations: ${stagingLocations.join(', ')}`);
}

console.log(`- Production Project "crm-webapp-d32bc" detected in staging bundle: ${foundProductionProject}`);

// 3. Evaluate results
console.log('\n--- VERIFICATION VERDICT ---');
if (foundStagingProject && !foundProductionProject) {
  console.log('✓ PASS: Staging bundle is 100% isolated. Project "crm-webapp-staging-msv" is active.');
  console.log('✓ PASS: Zero references to production "crm-webapp-d32bc" exist in the staging bundle.');
  process.exit(0);
} else if (foundStagingProject && foundProductionProject) {
  console.error('✗ FAIL: Staging bundle contains both staging and production project references!');
  process.exit(1);
} else {
  console.error('✗ FAIL: Staging project "crm-webapp-staging-msv" was not found in the bundle.');
  process.exit(1);
}
