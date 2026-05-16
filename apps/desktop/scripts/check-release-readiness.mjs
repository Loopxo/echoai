import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const requiredFiles = [
  'electron-builder.yml',
  'resources/entitlements.mac.plist',
  'resources/icon.png',
  'resources/runtime-manifest.json',
  '../../assets/echo-logo.png',
];

const requiredSecrets = [
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'WIN_CSC_LINK',
  'WIN_CSC_KEY_PASSWORD',
  'ECHOAI_UPDATE_FEED_URL',
];

const missingFiles = requiredFiles.filter((file) => !existsSync(join(appDir, file)));
const missingSecrets = requiredSecrets.filter((name) => !process.env[name]);

if (missingFiles.length > 0) {
  console.error('Missing release inputs:');
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
}

if (missingSecrets.length > 0) {
  console.warn('Missing signing/update secrets for a production release:');
  for (const name of missingSecrets) {
    console.warn(`- ${name}`);
  }
}

if (missingFiles.length > 0) {
  process.exitCode = 1;
} else {
  console.log('Desktop release files are present.');
}
