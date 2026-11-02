const { execSync } = require('child_process');

try {
  const list = execSync('npx --yes firebase-tools login:list', { encoding: 'utf8' });
  if (list.includes('Logged in as mirrorsolarvision@gmail.com')) {
    console.log('✓ Verified active Firebase account: mirrorsolarvision@gmail.com');
  } else {
    console.log('Switching Firebase account to mirrorsolarvision@gmail.com...');
    try {
      execSync('npx --yes firebase-tools login:use mirrorsolarvision@gmail.com', { stdio: 'pipe' });
    } catch (err) {
      const errMsg = (err.stderr || err.stdout || '').toString();
      if (!errMsg.includes('Already using account')) {
        console.log('Account not found. Please log in with mirrorsolarvision@gmail.com...');
        execSync('npx --yes firebase-tools login:add mirrorsolarvision@gmail.com', { stdio: 'inherit' });
        execSync('npx --yes firebase-tools login:use mirrorsolarvision@gmail.com', { stdio: 'inherit' });
      }
    }
    console.log('✓ Active account set to: mirrorsolarvision@gmail.com');
  }
} catch (e) {
  console.log('Account check note:', e.message);
}
