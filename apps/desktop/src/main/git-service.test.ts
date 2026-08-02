import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopGitService } from './git-service';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout;
}

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'echoai-git-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * A real repository, not a fake: the parsers in the service read actual git
 * output, so a mocked child process would only prove the mock matches itself.
 */
async function createRepository(): Promise<string> {
  const dir = await createTempDir();
  await git(dir, ['-c', 'init.defaultBranch=main', 'init', '--quiet']);
  await git(dir, ['config', 'user.name', 'EchoAI Test']);
  await git(dir, ['config', 'user.email', 'test@echoai.local']);
  await git(dir, ['config', 'commit.gpgsign', 'false']);

  // Point hooks at an empty directory so a developer's global hooks (or a signing
  // prompt) cannot make these tests hang or fail. It lives under .git so it can
  // never show up as an untracked path.
  const hooksDir = join(dir, '.git', 'echoai-empty-hooks');
  await mkdir(hooksDir, { recursive: true });
  await git(dir, ['config', 'core.hooksPath', hooksDir]);
  return dir;
}

async function createRepositoryWithCommit(): Promise<string> {
  const dir = await createRepository();
  await writeFile(join(dir, 'readme.md'), 'first line\n');
  await git(dir, ['add', '--', 'readme.md']);
  await git(dir, ['commit', '--quiet', '--message', 'Initial commit']);
  return dir;
}

describe('desktop git service', () => {
  it('reports a plain directory as not a repository instead of failing', async () => {
    const dir = await createTempDir();
    const service = new DesktopGitService();

    await expect(service.getStatus(dir)).resolves.toMatchObject({
      isRepository: false,
      branch: null,
      detached: false,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      lastCommit: null,
    });
    await expect(service.listChangedFiles(dir)).resolves.toEqual([]);
    await expect(service.getDiff(dir)).resolves.toBe('');
  });

  it('describes a clean repository and its last commit', async () => {
    const dir = await createRepositoryWithCommit();
    const service = new DesktopGitService();

    const status = await service.getStatus(dir);
    expect(status).toMatchObject({
      isRepository: true,
      branch: 'main',
      detached: false,
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      clean: true,
    });
    expect(status.lastCommit).toMatchObject({
      subject: 'Initial commit',
      author: 'EchoAI Test',
    });
    expect(status.lastCommit?.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(status.lastCommit?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await expect(service.listChangedFiles(dir)).resolves.toEqual([]);
  });

  it('counts an unstaged edit and returns its diff', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'readme.md'), 'first line\nsecond line\n');
    const service = new DesktopGitService();

    await expect(service.getStatus(dir)).resolves.toMatchObject({
      staged: 0,
      unstaged: 1,
      untracked: 0,
      clean: false,
    });
    await expect(service.listChangedFiles(dir)).resolves.toEqual([
      { path: 'readme.md', status: 'modified', staged: false, insertions: 1, deletions: 0 },
    ]);

    const diff = await service.getDiff(dir);
    expect(diff).toContain('diff --git a/readme.md b/readme.md');
    expect(diff).toContain('+second line');
  });

  it('renders an untracked file as a synthetic diff so new files are reviewable', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'notes.md'), 'alpha\nbeta\n');
    const service = new DesktopGitService();

    await expect(service.getStatus(dir)).resolves.toMatchObject({
      staged: 0,
      unstaged: 0,
      untracked: 1,
      clean: false,
    });
    await expect(service.listChangedFiles(dir)).resolves.toEqual([
      { path: 'notes.md', status: 'untracked', staged: false, insertions: 2, deletions: 0 },
    ]);

    const diff = await service.getDiff(dir);
    expect(diff).toContain('diff --git a/notes.md b/notes.md');
    expect(diff).toContain('new file mode 100644');
    expect(diff).toContain('@@ -0,0 +1,2 @@');
    expect(diff).toContain('+alpha');
    expect(diff).toContain('+beta');
  });

  it('stages and unstages a file', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'feature.ts'), 'export const feature = true;\n');
    const service = new DesktopGitService();

    await service.stageFiles(dir, ['feature.ts']);
    await expect(service.getStatus(dir)).resolves.toMatchObject({
      staged: 1,
      unstaged: 0,
      untracked: 0,
      clean: false,
    });
    await expect(service.listChangedFiles(dir)).resolves.toEqual([
      { path: 'feature.ts', status: 'added', staged: true, insertions: 1, deletions: 0 },
    ]);

    const stagedDiff = await service.getDiff(dir, { staged: true });
    expect(stagedDiff).toContain('+export const feature = true;');
    // The unstaged view must not double count what is already in the index.
    await expect(service.getDiff(dir, { staged: false })).resolves.not.toContain('feature = true');

    await service.unstageFiles(dir, ['feature.ts']);
    await expect(service.getStatus(dir)).resolves.toMatchObject({ staged: 0, untracked: 1 });
  });

  it('commits staged work and reports the new commit', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'readme.md'), 'first line\nsecond line\n');
    const service = new DesktopGitService();

    await service.stageFiles(dir, ['readme.md']);
    const result = await service.commit(dir, 'Add a second line');
    expect(result.subject).toBe('Add a second line');
    expect(result.hash).toMatch(/^[0-9a-f]{40}$/);

    const status = await service.getStatus(dir);
    expect(status.clean).toBe(true);
    expect(status.lastCommit?.hash).toBe(result.hash);
    expect(await git(dir, ['log', '-1', '--format=%s'])).toContain('Add a second line');
  });

  it('commits every tracked change when `all` is set', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'readme.md'), 'rewritten\n');
    const service = new DesktopGitService();

    const result = await service.commit(dir, 'Rewrite readme', { all: true });
    expect(result.subject).toBe('Rewrite readme');
    await expect(service.getStatus(dir)).resolves.toMatchObject({ clean: true });
  });

  it('keeps a commit message with shell metacharacters literal', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'readme.md'), 'first line\nsecond line\n');
    const service = new DesktopGitService();
    const message = '--fix `rm -rf /` && echo "$(whoami)"; done';

    await service.stageFiles(dir, ['readme.md']);
    const result = await service.commit(dir, message);
    expect(result.subject).toBe(message);
    expect(await git(dir, ['log', '-1', '--format=%s'])).toContain(message);
  });

  it('lists a file changed on both sides once per side', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'readme.md'), 'first line\nstaged line\n');
    const service = new DesktopGitService();

    await service.stageFiles(dir, ['readme.md']);
    await writeFile(join(dir, 'readme.md'), 'first line\nstaged line\nworktree line\n');

    await expect(service.getStatus(dir)).resolves.toMatchObject({
      staged: 1,
      unstaged: 1,
      clean: false,
    });
    await expect(service.listChangedFiles(dir)).resolves.toEqual([
      { path: 'readme.md', status: 'modified', staged: true, insertions: 1, deletions: 0 },
      { path: 'readme.md', status: 'modified', staged: false, insertions: 1, deletions: 0 },
    ]);
  });

  it('reports a rename under its new path', async () => {
    const dir = await createRepositoryWithCommit();
    const service = new DesktopGitService();

    await git(dir, ['mv', 'readme.md', 'README.markdown']);

    await expect(service.getStatus(dir)).resolves.toMatchObject({ staged: 1, unstaged: 0 });
    await expect(service.listChangedFiles(dir)).resolves.toEqual([
      { path: 'README.markdown', status: 'renamed', staged: true, insertions: 0, deletions: 0 },
    ]);
  });

  it('reports a detached HEAD as detached with no branch', async () => {
    const dir = await createRepositoryWithCommit();
    const service = new DesktopGitService();
    const head = (await git(dir, ['rev-parse', 'HEAD'])).trim();

    await git(dir, ['checkout', '--quiet', '--detach', head]);

    await expect(service.getStatus(dir)).resolves.toMatchObject({
      isRepository: true,
      branch: null,
      detached: true,
      clean: true,
    });
  });

  it('rejects paths that escape the workspace root', async () => {
    const dir = await createRepositoryWithCommit();
    const service = new DesktopGitService();

    await expect(service.stageFiles(dir, ['../escape.txt'])).rejects.toThrow(
      'Path escapes workspace root'
    );
    await expect(service.stageFiles(dir, ['docs/../../escape.txt'])).rejects.toThrow(
      'Path escapes workspace root'
    );
    await expect(service.stageFiles(dir, ['/etc/hosts'])).rejects.toThrow(
      'Path escapes workspace root'
    );
    await expect(service.unstageFiles(dir, ['../escape.txt'])).rejects.toThrow(
      'Path escapes workspace root'
    );
    await expect(service.getDiff(dir, { path: '../escape.txt' })).rejects.toThrow(
      'Path escapes workspace root'
    );
  });

  it('refuses an empty commit message', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'readme.md'), 'first line\nsecond line\n');
    const service = new DesktopGitService();

    await service.stageFiles(dir, ['readme.md']);
    await expect(service.commit(dir, '')).rejects.toThrow('Commit message is required');
    await expect(service.commit(dir, '   \n  ')).rejects.toThrow('Commit message is required');
  });

  it('refuses to commit when nothing is staged', async () => {
    const dir = await createRepositoryWithCommit();
    await writeFile(join(dir, 'readme.md'), 'first line\nsecond line\n');
    const service = new DesktopGitService();

    await expect(service.commit(dir, 'No staged changes')).rejects.toThrow(
      'Nothing staged to commit'
    );
  });
});
