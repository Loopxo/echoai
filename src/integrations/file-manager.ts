import { readFile, writeFile, copyFile, stat } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { FileOperations, FileDiff, DiffChange } from '../types/index.js';

export class FileManager implements FileOperations {
  private backupDir: string;

  constructor() {
    this.backupDir = join(homedir(), '.aiconfig', 'backups');
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async readFile(path: string): Promise<string> {
    try {
      const content = await readFile(path, 'utf-8');
      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read file ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    try {
      const dir = dirname(path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      await writeFile(path, content, 'utf-8');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to write file ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  async backupFile(path: string): Promise<string> {
    try {
      if (!existsSync(path)) {
        throw new Error(`File ${path} does not exist`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.replace(/[/\\]/g, '_');
      const backupPath = join(this.backupDir, `${filename}_${timestamp}.bak`);

      await copyFile(path, backupPath);
      return backupPath;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to backup file ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  createDiff(original: string, modified: string): FileDiff {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const changes: DiffChange[] = [];

    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || '';
      const modifiedLine = modifiedLines[i] || '';

      if (i >= originalLines.length) {
        // Line added
        changes.push({
          type: 'add',
          lineNumber: i + 1,
          content: modifiedLine,
        });
      } else if (i >= modifiedLines.length) {
        // Line removed
        changes.push({
          type: 'remove',
          lineNumber: i + 1,
          content: originalLine,
        });
      } else if (originalLine !== modifiedLine) {
        // Line modified
        changes.push({
          type: 'modify',
          lineNumber: i + 1,
          content: modifiedLine,
        });
      }
    }

    return {
      original,
      modified,
      changes,
    };
  }

  async applyDiff(path: string, diff: FileDiff): Promise<void> {
    try {
      // Create backup before applying changes
      if (existsSync(path)) {
        await this.backupFile(path);
      }

      await this.writeFile(path, diff.modified);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to apply diff to ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  formatDiffPreview(diff: FileDiff): string {
    if (diff.changes.length === 0) {
      return 'No changes detected.';
    }

    let preview = 'File changes preview:\n';
    preview += '=' .repeat(50) + '\n';

    for (const change of diff.changes.slice(0, 20)) { // Show first 20 changes
      const icon = change.type === 'add' ? '+' : change.type === 'remove' ? '-' : '~';
      const color = change.type === 'add' ? '\x1b[32m' : change.type === 'remove' ? '\x1b[31m' : '\x1b[33m';
      const reset = '\x1b[0m';
      
      preview += `${color}${icon} Line ${change.lineNumber}: ${change.content}${reset}\n`;
    }

    if (diff.changes.length > 20) {
      preview += `\n... and ${diff.changes.length - 20} more changes\n`;
    }

    preview += '=' .repeat(50) + '\n';
    return preview;
  }
}