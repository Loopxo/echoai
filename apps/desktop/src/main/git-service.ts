import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import type {
  DesktopGitCommitOptions,
  DesktopGitCommitResult,
  DesktopGitCommitSummary,
  DesktopGitDiffOptions,
  DesktopGitFileChange,
  DesktopGitFileStatus,
  DesktopGitStatus,
} from '@shared/ipc';

/** A single diff answer is rendered in the UI, so cap it well below heap pressure. */
const maxOutputBytes = 2 * 1024 * 1024;
const truncationNotice = '\n... truncated: git output exceeded 2 MB ...\n';
const readTimeoutMs = 20_000;
/** Commits run user-owned hooks, so they get a longer leash than read commands. */
const commitTimeoutMs = 60_000;

/**
 * `--untracked-files=all` instead of the default: git normally collapses a fully
 * untracked directory into a single entry, which would report "1 untracked" for
 * a folder holding 40 new files and leave those files out of the review diff.
 */
const statusArgs = [
  'status',
  '--porcelain=v2',
  '--branch',
  '--untracked-files=all',
  '-z',
] as const;

/**
 * `--no-ext-diff` / `--no-textconv` keep repository config from turning a diff
 * request into arbitrary process execution: both `diff.external` and a
 * `diff.*.textconv` driver are commands a cloned repo can set for us.
 */
const diffArgs = ['diff', '--no-color', '--no-ext-diff', '--no-textconv'] as const;

interface GitResult {
  stdout: string;
  stderr: string;
  code: number | null;
  truncated: boolean;
}

interface PorcelainEntry {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  kind: 'tracked' | 'unmerged' | 'untracked';
}

interface PorcelainStatus {
  branch: string | null;
  detached: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: PorcelainEntry[];
}

interface NumstatCounts {
  insertions: number;
  deletions: number;
}

/**
 * Read-only git plus staging and committing.
 *
 * Deliberately no push, fetch, reset, checkout, revert, rebase, branch delete or
 * anything else that rewrites history or touches a remote: the renderer can only
 * ever inspect the working tree, move changes into the index, and record them.
 */
export class DesktopGitService {
  async getStatus(rootPath: string): Promise<DesktopGitStatus> {
    const root = normalizeRoot(rootPath);
    const porcelain = await this.readStatus(root);
    if (!porcelain) {
      return createEmptyStatus();
    }

    const counts = countEntries(porcelain.entries);
    return {
      isRepository: true,
      branch: porcelain.branch,
      detached: porcelain.detached,
      upstream: porcelain.upstream,
      ahead: porcelain.ahead,
      behind: porcelain.behind,
      staged: counts.staged,
      unstaged: counts.unstaged,
      untracked: counts.untracked,
      clean: counts.staged === 0 && counts.unstaged === 0 && counts.untracked === 0,
      lastCommit: await this.readLastCommit(root),
    };
  }

  async listChangedFiles(rootPath: string): Promise<DesktopGitFileChange[]> {
    const root = normalizeRoot(rootPath);
    const porcelain = await this.readStatus(root);
    if (!porcelain) {
      return [];
    }

    const [staged, unstaged] = await Promise.all([
      this.readNumstat(root, true),
      this.readNumstat(root, false),
    ]);

    const changes: DesktopGitFileChange[] = [];
    for (const entry of porcelain.entries) {
      if (entry.kind === 'untracked') {
        changes.push({
          path: entry.path,
          status: 'untracked',
          staged: false,
          // git has no numstat for untracked content, so count the lines the
          // synthetic diff in `getDiff` will show.
          insertions: await countFileLines(resolve(root, entry.path)),
          deletions: 0,
        });
        continue;
      }

      // A file can sit in both lists (porcelain 'MM'), and a staged/unstaged UI
      // shows it in both sections, so emit one entry per side.
      if (entry.indexStatus !== '.') {
        changes.push({
          path: entry.path,
          status: toFileStatus(entry.indexStatus),
          staged: true,
          ...(staged.get(entry.path) ?? { insertions: 0, deletions: 0 }),
        });
      }
      if (entry.worktreeStatus !== '.') {
        changes.push({
          path: entry.path,
          status: toFileStatus(entry.worktreeStatus),
          staged: false,
          ...(unstaged.get(entry.path) ?? { insertions: 0, deletions: 0 }),
        });
      }
    }

    return changes;
  }

  async getDiff(rootPath: string, options: DesktopGitDiffOptions = {}): Promise<string> {
    const root = normalizeRoot(rootPath);
    if (!(await isDirectory(root))) {
      return '';
    }

    const staged = options.staged === true;
    const resolvedPath = options.path === undefined ? null : toRepoPath(root, options.path);
    // The root itself resolves to '.', which is just the whole tree.
    const requestedPath = resolvedPath === '.' ? null : resolvedPath;
    const args: string[] = [...diffArgs];
    if (staged) {
      args.push('--cached');
    }
    args.push('--');
    if (requestedPath) {
      args.push(toLiteralPathspec(requestedPath));
    }

    const result = await this.runGit(root, args);
    if (result.code !== 0) {
      if (isMissingRepository(result)) {
        return '';
      }
      throw new Error(describeFailure('read git diff', result));
    }

    // `git diff` only reports tracked content, so a brand new file would be
    // invisible in review. Rebuild it as a diff against /dev/null.
    const untracked = staged ? '' : await this.buildUntrackedDiff(root, requestedPath);
    return truncate(`${result.stdout}${untracked}`, result.truncated);
  }

  async stageFiles(rootPath: string, paths: readonly string[]): Promise<void> {
    const root = normalizeRoot(rootPath);
    const pathspecs = toPathspecs(root, paths);
    await this.runMutation(root, ['add', '--', ...pathspecs], 'stage files');
  }

  async unstageFiles(rootPath: string, paths: readonly string[]): Promise<void> {
    const root = normalizeRoot(rootPath);
    const pathspecs = toPathspecs(root, paths);

    // `git restore --staged` needs a resolvable HEAD, which an unborn branch has
    // not got. There, dropping the index entry *is* unstaging; `--cached` keeps
    // the file on disk. Neither command rewrites history.
    const args = (await this.hasCommits(root))
      ? ['restore', '--staged', '--', ...pathspecs]
      : ['rm', '--cached', '-r', '--quiet', '--', ...pathspecs];
    await this.runMutation(root, args, 'unstage files');
  }

  async commit(
    rootPath: string,
    message: string,
    options: DesktopGitCommitOptions = {}
  ): Promise<DesktopGitCommitResult> {
    const root = normalizeRoot(rootPath);
    if (message.trim().length === 0) {
      throw new Error('Commit message is required');
    }

    const all = options.all === true;
    const status = await this.getStatus(root);
    if (!status.isRepository) {
      throw new Error('Not a git repository');
    }
    if (!all && status.staged === 0) {
      throw new Error('Nothing staged to commit');
    }
    if (all && status.staged === 0 && status.unstaged === 0) {
      throw new Error('Nothing to commit');
    }

    // `--message=<value>` as one argv slot: a message that starts with `-` can
    // never be re-read as a flag, and there is no shell to reinterpret it.
    const args = ['commit', `--message=${message}`];
    if (all) {
      args.push('--all');
    }

    const result = await this.runGit(root, args, commitTimeoutMs);
    if (result.code !== 0) {
      throw new Error(describeFailure('commit', result));
    }

    const committed = await this.readLastCommit(root);
    if (!committed) {
      throw new Error('Commit succeeded but the new commit could not be read');
    }

    return { hash: committed.hash, subject: committed.subject };
  }

  private async readStatus(root: string): Promise<PorcelainStatus | null> {
    if (!(await isDirectory(root))) {
      return null;
    }

    const result = await this.runGit(root, [...statusArgs]);
    if (result.code !== 0) {
      if (isMissingRepository(result)) {
        return null;
      }
      throw new Error(describeFailure('read git status', result));
    }

    return parsePorcelainStatus(result.stdout);
  }

  private async readLastCommit(root: string): Promise<DesktopGitCommitSummary | null> {
    const result = await this.runGit(root, [
      'log',
      '-1',
      '--no-color',
      '--format=%H%x00%s%x00%an%x00%aI',
    ]);
    if (result.code !== 0) {
      // An unborn branch has no commit to describe; that is data, not a failure.
      return null;
    }

    const [hash, subject, author, at] = result.stdout.replace(/\n$/, '').split('\0');
    if (!hash) {
      return null;
    }

    return { hash, subject: subject ?? '', author: author ?? '', at: at ?? '' };
  }

  private async readNumstat(root: string, staged: boolean): Promise<Map<string, NumstatCounts>> {
    const args: string[] = [...diffArgs, '--numstat', '-z'];
    if (staged) {
      args.push('--cached');
    }

    const result = await this.runGit(root, args);
    return result.code === 0 ? parseNumstat(result.stdout) : new Map();
  }

  private async hasCommits(root: string): Promise<boolean> {
    const result = await this.runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    return result.code === 0;
  }

  private async runMutation(
    root: string,
    args: readonly string[],
    action: string
  ): Promise<void> {
    if (!(await isDirectory(root))) {
      throw new Error('Workspace root does not exist');
    }

    const result = await this.runGit(root, args);
    if (result.code !== 0) {
      throw new Error(
        isMissingRepository(result) ? 'Not a git repository' : describeFailure(action, result)
      );
    }
  }

  private async buildUntrackedDiff(root: string, requestedPath: string | null): Promise<string> {
    const porcelain = await this.readStatus(root);
    if (!porcelain) {
      return '';
    }

    const untracked = porcelain.entries
      .filter((entry) => entry.kind === 'untracked')
      .filter((entry) => requestedPath === null || entry.path === requestedPath)
      .map((entry) => entry.path);

    const sections: string[] = [];
    let size = 0;
    for (const path of untracked) {
      const section = await renderUntrackedFile(root, path);
      size += section.length;
      sections.push(section);
      if (size > maxOutputBytes) {
        break;
      }
    }

    return sections.join('');
  }

  private runGit(
    root: string,
    args: readonly string[],
    timeoutMs: number = readTimeoutMs
  ): Promise<GitResult> {
    return new Promise((resolveResult, rejectResult) => {
      // No `shell` option: every element of `args` reaches git as its own argv
      // slot, so no branch name, path or commit message can be reinterpreted as
      // shell syntax. `cwd` scopes the command to the workspace.
      const child = spawn('git', [...args], {
        cwd: root,
        env: buildGitEnvironment(),
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
        windowsHide: true,
      });

      const stdout = createCappedSink();
      const stderr = createCappedSink();
      child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
      child.on('error', (error) => {
        rejectResult(new Error(`Could not run git: ${error.message}`));
      });
      child.on('close', (code) => {
        resolveResult({
          stdout: stdout.text(),
          stderr: stderr.text(),
          code,
          truncated: stdout.truncated,
        });
      });
    });
  }
}

function createEmptyStatus(): DesktopGitStatus {
  return {
    isRepository: false,
    branch: null,
    detached: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    clean: true,
    lastCommit: null,
  };
}

function createCappedSink(): { push: (chunk: Buffer) => void; text: () => string; truncated: boolean } {
  const chunks: Buffer[] = [];
  let size = 0;
  const sink = {
    truncated: false,
    push(chunk: Buffer): void {
      if (size >= maxOutputBytes) {
        sink.truncated = true;
        return;
      }
      const room = maxOutputBytes - size;
      const slice = chunk.length > room ? chunk.subarray(0, room) : chunk;
      sink.truncated = sink.truncated || slice.length < chunk.length;
      chunks.push(slice);
      size += slice.length;
    },
    text(): string {
      return Buffer.concat(chunks).toString('utf8');
    },
  };
  return sink;
}

/**
 * A deliberately small environment. Credential helpers, askpass hooks and proxy
 * settings never reach git, and the two GIT_ flags guarantee it fails fast
 * instead of waiting on a prompt no desktop user can see.
 */
function buildGitEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'HOME',
    'HOMEDRIVE',
    'HOMEPATH',
    'USERPROFILE',
    'SystemRoot',
    'SYSTEMROOT',
    'COMSPEC',
    'TMPDIR',
    'TEMP',
    'TMP',
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_OPTIONAL_LOCKS = '0';
  // Stable, parseable messages regardless of the user's locale.
  env.LC_ALL = 'C';
  return env;
}

function parsePorcelainStatus(output: string): PorcelainStatus {
  const records = output.split('\0');
  const status: PorcelainStatus = {
    branch: null,
    detached: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    entries: [],
  };

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length === 0) {
      continue;
    }

    if (record.startsWith('# ')) {
      applyStatusHeader(status, record.slice(2));
      continue;
    }

    if (record.startsWith('1 ')) {
      const fields = record.split(' ');
      status.entries.push(createEntry(fields[1], fields.slice(8).join(' '), 'tracked'));
      continue;
    }

    if (record.startsWith('2 ')) {
      const fields = record.split(' ');
      // A rename entry puts the original path in the next NUL record; the new
      // path is the one every other command reports, so consume and drop it.
      index += 1;
      status.entries.push(createEntry(fields[1], fields.slice(9).join(' '), 'tracked'));
      continue;
    }

    if (record.startsWith('u ')) {
      const fields = record.split(' ');
      status.entries.push(createEntry(fields[1], fields.slice(10).join(' '), 'unmerged'));
      continue;
    }

    if (record.startsWith('? ')) {
      status.entries.push(createEntry('??', record.slice(2), 'untracked'));
    }
  }

  return status;
}

function applyStatusHeader(status: PorcelainStatus, header: string): void {
  const separator = header.indexOf(' ');
  const key = separator === -1 ? header : header.slice(0, separator);
  const value = separator === -1 ? '' : header.slice(separator + 1);

  if (key === 'branch.head') {
    status.detached = value === '(detached)';
    status.branch = status.detached ? null : value;
    return;
  }

  if (key === 'branch.upstream') {
    status.upstream = value.length > 0 ? value : null;
    return;
  }

  if (key === 'branch.ab') {
    const match = /^\+(\d+)\s+-(\d+)$/.exec(value.trim());
    if (match) {
      status.ahead = Number(match[1]);
      status.behind = Number(match[2]);
    }
  }
}

function createEntry(xy: string, path: string, kind: PorcelainEntry['kind']): PorcelainEntry {
  return {
    path,
    indexStatus: xy[0] ?? '.',
    worktreeStatus: xy[1] ?? '.',
    kind,
  };
}

function countEntries(entries: readonly PorcelainEntry[]): {
  staged: number;
  unstaged: number;
  untracked: number;
} {
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const entry of entries) {
    if (entry.kind === 'untracked') {
      untracked += 1;
      continue;
    }
    // A conflict is something the user still has to resolve in the worktree.
    if (entry.kind === 'unmerged') {
      unstaged += 1;
      continue;
    }
    if (entry.indexStatus !== '.') {
      staged += 1;
    }
    if (entry.worktreeStatus !== '.') {
      unstaged += 1;
    }
  }

  return { staged, unstaged, untracked };
}

function toFileStatus(code: string): DesktopGitFileStatus {
  switch (code) {
    case 'A':
      return 'added';
    // A copy lands as content at a path that did not exist before.
    case 'C':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    // 'M', 'T' (typechange), 'U' (unmerged) and anything git adds later.
    default:
      return 'modified';
  }
}

/**
 * `git diff --numstat -z` writes `<ins>\t<del>\t<path>NUL`, except for a rename
 * where the record ends with the preimage path and the postimage path follows in
 * its own record. Detect that by peeking at the next record.
 */
function parseNumstat(output: string): Map<string, NumstatCounts> {
  const counts = new Map<string, NumstatCounts>();
  const records = output.split('\0');
  const recordPattern = /^(\d+|-)\t(\d+|-)\t(.*)$/s;

  for (let index = 0; index < records.length; index += 1) {
    const match = recordPattern.exec(records[index]);
    if (!match) {
      continue;
    }

    let path = match[3];
    const next = records[index + 1];
    if (next !== undefined && next.length > 0 && !recordPattern.test(next)) {
      path = next;
      index += 1;
    }

    counts.set(path, { insertions: toCount(match[1]), deletions: toCount(match[2]) });
  }

  return counts;
}

/** Binary files report `-` for both sides. */
function toCount(value: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

async function renderUntrackedFile(root: string, repoPath: string): Promise<string> {
  const absolute = resolve(root, repoPath);
  const info = await stat(absolute).catch(() => null);
  if (!info || !info.isFile()) {
    return '';
  }

  const mode = (info.mode & 0o111) === 0 ? '100644' : '100755';
  const header = `diff --git a/${repoPath} b/${repoPath}\nnew file mode ${mode}\n`;
  if (info.size > maxOutputBytes) {
    return `${header}${repoPath} is ${info.size} bytes and is too large to render.\n`;
  }

  const raw = await readFile(absolute).catch(() => null);
  if (!raw) {
    return '';
  }
  if (raw.includes(0)) {
    return `${header}Binary files /dev/null and b/${repoPath} differ\n`;
  }

  const content = raw.toString('utf8');
  const endsWithNewline = content.endsWith('\n');
  const lines = content.split('\n');
  if (endsWithNewline) {
    lines.pop();
  }

  const body = lines.map((line) => `+${line}`).join('\n');
  const trailer = endsWithNewline ? '\n' : '\n\\ No newline at end of file\n';
  return `${header}--- /dev/null\n+++ b/${repoPath}\n@@ -0,0 +1,${lines.length} @@\n${body}${trailer}`;
}

async function countFileLines(absolutePath: string): Promise<number> {
  const info = await stat(absolutePath).catch(() => null);
  if (!info || !info.isFile() || info.size > maxOutputBytes) {
    return 0;
  }

  const raw = await readFile(absolutePath).catch(() => null);
  if (!raw || raw.includes(0)) {
    return 0;
  }

  const content = raw.toString('utf8');
  if (content.length === 0) {
    return 0;
  }

  const lines = content.split('\n');
  return content.endsWith('\n') ? lines.length - 1 : lines.length;
}

function truncate(output: string, alreadyTruncated: boolean): string {
  if (output.length <= maxOutputBytes) {
    return alreadyTruncated ? `${output}${truncationNotice}` : output;
  }

  return `${output.slice(0, maxOutputBytes)}${truncationNotice}`;
}

function normalizeRoot(rootPath: string): string {
  if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    throw new Error('Workspace root is required');
  }

  return resolve(rootPath);
}

async function isDirectory(path: string): Promise<boolean> {
  const info = await stat(path).catch(() => null);
  return info !== null && info.isDirectory();
}

function toPathspecs(root: string, paths: readonly string[]): string[] {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('At least one path is required');
  }

  return paths.map((path) => toLiteralPathspec(toRepoPath(root, path)));
}

/**
 * Resolve a caller-supplied path to one relative to the workspace root, refusing
 * anything that lands outside it: `..` traversal and absolute paths elsewhere on
 * disk both collapse to the same check.
 */
function toRepoPath(root: string, path: string): string {
  if (typeof path !== 'string' || path.trim().length === 0) {
    throw new Error('Path is required');
  }

  const absolute = resolve(root, path);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (absolute !== root && !absolute.startsWith(rootPrefix)) {
    throw new Error('Path escapes workspace root');
  }

  const relativePath = relative(root, absolute);
  return relativePath.length === 0 ? '.' : relativePath;
}

/**
 * `--` stops git from reading a leading `-` as a flag, but pathspec magic like
 * `:(exclude)` is still honoured after it. `:(literal)` pins the value to an
 * exact path so a filename can never widen the set of files git touches.
 */
function toLiteralPathspec(repoPath: string): string {
  return `:(literal)${repoPath}`;
}

/**
 * Only a genuinely absent repository counts here. Something like git's dubious
 * ownership refusal is a real, fixable error and must keep its message.
 */
function isMissingRepository(result: GitResult): boolean {
  return /not a git repository/i.test(result.stderr);
}

function describeFailure(action: string, result: GitResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${String(result.code)}`;
  return `Could not ${action}: ${detail}`;
}
