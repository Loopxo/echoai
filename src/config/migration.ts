import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, cpSync, mkdirSync } from 'fs';

export function migrateUnifiedState() {
  const home = homedir();
  const newDir = process.env.ECHOAI_STATE_DIR?.trim()
    ? resolve(process.env.ECHOAI_STATE_DIR.trim())
    : join(home, '.echoai');
  const legacyDirs = [
    join(home, '.echo'),
    join(home, '.aiconfig'),
    join(home, '.echo-ai')
  ];

  try {
    if (!existsSync(newDir)) {
      mkdirSync(newDir, { recursive: true });
    }
  } catch (error) {
    warnMigration(`Could not create EchoAI state directory at ${newDir}`, error);
    return;
  }

  for (const oldDir of legacyDirs) {
    if (existsSync(oldDir)) {
      try {
        // Non-destructively copy contents
        cpSync(oldDir, newDir, { recursive: true, force: false });
      } catch (error) {
        warnMigration(`Failed to migrate state from ${oldDir} to ${newDir}`, error);
      }
    }
  }
}

function warnMigration(message: string, error: unknown): void {
  if (process.env.ECHOAI_DEBUG_MIGRATION === '1') {
    console.warn(`${message}:`, error);
  }
}
