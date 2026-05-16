import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const releaseDir = join(appDir, 'release');
const artifactPattern = /\.(dmg|zip|exe)$/i;

if (!existsSync(releaseDir)) {
  console.error('No release directory found. Run pnpm --filter @echoai/desktop dist first.');
  process.exit(1);
}

const artifacts = readdirSync(releaseDir).filter((entry) => artifactPattern.test(entry));
if (artifacts.length === 0) {
  console.error('No desktop installer artifacts found in apps/desktop/release.');
  process.exit(1);
}

console.log('Desktop installer artifacts found:');
for (const artifact of artifacts) {
  console.log(`- ${artifact}`);
}
