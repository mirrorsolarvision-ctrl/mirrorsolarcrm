import fs from 'fs';
import path from 'path';

function sanitizeDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      sanitizeDir(full);
    } else if (item.endsWith('.json')) {
      try {
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes('password')) {
          const json = JSON.parse(text);
          let modified = false;
          if (Array.isArray(json)) {
            json.forEach(d => {
              if (d.fields && d.fields.password) {
                delete d.fields.password;
                modified = true;
              }
              if (d.password) {
                delete d.password;
                modified = true;
              }
            });
          }
          if (modified) {
            fs.writeFileSync(full, JSON.stringify(json, null, 2), 'utf8');
            console.log(`Sanitized sensitive fields from: ${item}`);
          }
        }
      } catch (e) {
        // Ignore non-json files
      }
    }
  }
}

sanitizeDir(path.resolve(process.cwd(), 'backups'));

const orphanBackup = path.resolve(process.cwd(), 'scripts', 'users_backup.json');
if (fs.existsSync(orphanBackup)) {
  fs.unlinkSync(orphanBackup);
  console.log('Removed scripts/users_backup.json');
}

// Sanitize seed scripts
const s1 = path.resolve(process.cwd(), 'scripts', 'setupAllCredentialsAndAdmins.mjs');
if (fs.existsSync(s1)) {
  let t1 = fs.readFileSync(s1, 'utf8');
  t1 = t1.replace(/password:\s*'Mirror@[0-9]+'/g, "password: process.env.ADMIN_BACKUP_PASS || ''");
  fs.writeFileSync(s1, t1, 'utf8');
  console.log('Sanitized setupAllCredentialsAndAdmins.mjs');
}

const s2 = path.resolve(process.cwd(), 'scripts', 'verifyAndPopulateUserCredentials.mjs');
if (fs.existsSync(s2)) {
  let t2 = fs.readFileSync(s2, 'utf8');
  t2 = t2.replace(/password:\s*'Mirror@[0-9]+'/g, "password: process.env.ADMIN_BACKUP_PASS || ''")
         .replace(/"Mirror@[0-9]+"/g, "process.env.ADMIN_BACKUP_PASS || ''");
  fs.writeFileSync(s2, t2, 'utf8');
  console.log('Sanitized verifyAndPopulateUserCredentials.mjs');
}

console.log('Sanitization complete.');
