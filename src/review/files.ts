import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ReviewTargetFile {
  filePath: string;
  content: string;
}

export async function collectReviewFiles(
  cwd: string,
  requestedPaths: string[] = [],
  staged = false
): Promise<ReviewTargetFile[]> {
  const candidatePaths = requestedPaths.length > 0
    ? requestedPaths.map((entry) => path.resolve(cwd, entry))
    : await listChangedFiles(cwd, staged);
  const files: ReviewTargetFile[] = [];

  for (const filePath of candidatePaths) {
    try {
      const content = await readFile(filePath, 'utf8');
      files.push({ filePath, content });
    } catch {
      continue;
    }
  }

  return files;
}

async function listChangedFiles(cwd: string, staged: boolean): Promise<string[]> {
  const stagedArgs = staged ? ['--cached'] : [];
  const primary = await runGitDiffNameOnly(cwd, stagedArgs);
  if (primary.length > 0) {
    return primary;
  }

  if (!staged) {
    return runGitDiffNameOnly(cwd, ['--cached']);
  }

  return [];
}

async function runGitDiffNameOnly(cwd: string, extraArgs: string[]): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMRTUXB', ...extraArgs],
      { cwd }
    );

    return stdout
      .split('\n')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => path.resolve(cwd, entry));
  } catch {
    return [];
  }
}
