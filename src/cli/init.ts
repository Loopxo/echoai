import { Command } from 'commander';
import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

interface ProjectHints {
  packageManager: string;
  installCommand: string;
  buildCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  typecheckCommand?: string;
}

export const initCommand = new Command('init')
  .description('Initialize EchoAI project instructions in the current workspace')
  .option('-f, --force', 'Overwrite an existing ECHOAI.md')
  .action(async (options: { force?: boolean }) => {
    const result = await initializeEchoAiProject(process.cwd(), { force: options.force === true });
    console.log(result.message);
  });

export async function initializeEchoAiProject(
  workspaceRoot: string,
  options: { force?: boolean } = {}
): Promise<{ created: boolean; path: string; message: string }> {
  const targetPath = path.join(workspaceRoot, 'ECHOAI.md');

  if (!options.force && await exists(targetPath)) {
    return {
      created: false,
      path: targetPath,
      message: 'ECHOAI.md already exists. Use `echoai init --force` to regenerate it.',
    };
  }

  const hints = await detectProjectHints(workspaceRoot);
  const content = buildEchoAiInstructions(hints);
  await writeFile(targetPath, content, 'utf8');
  return {
    created: true,
    path: targetPath,
    message: `Created ECHOAI.md for ${hints.packageManager} workspace.`,
  };
}

async function detectProjectHints(workspaceRoot: string): Promise<ProjectHints> {
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);
  const packageManager = await detectPackageManager(workspaceRoot, packageJson?.packageManager);
  const run = commandRunner(packageManager);
  const scripts = packageJson?.scripts ?? {};

  return {
    packageManager,
    installCommand: installCommand(packageManager),
    buildCommand: scripts.build ? `${run} build` : undefined,
    testCommand: scripts.test ? `${run} test` : undefined,
    lintCommand: scripts.lint ? `${run} lint` : undefined,
    typecheckCommand: scripts['type-check'] ? `${run} type-check` : scripts.typecheck ? `${run} typecheck` : undefined,
  };
}

async function readPackageJson(packageJsonPath: string): Promise<{ packageManager?: string; scripts?: Record<string, string> } | null> {
  try {
    return JSON.parse(await readFile(packageJsonPath, 'utf8')) as { packageManager?: string; scripts?: Record<string, string> };
  } catch {
    return null;
  }
}

async function detectPackageManager(workspaceRoot: string, declared?: string): Promise<string> {
  if (declared?.startsWith('pnpm@')) return 'pnpm';
  if (declared?.startsWith('yarn@')) return 'yarn';
  if (declared?.startsWith('bun@')) return 'bun';
  if (await exists(path.join(workspaceRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(path.join(workspaceRoot, 'yarn.lock'))) return 'yarn';
  if (await exists(path.join(workspaceRoot, 'bun.lockb')) || await exists(path.join(workspaceRoot, 'bun.lock'))) return 'bun';
  return 'npm';
}

function commandRunner(packageManager: string): string {
  if (packageManager === 'npm') return 'npm run';
  return packageManager;
}

function installCommand(packageManager: string): string {
  if (packageManager === 'npm') return 'npm install';
  return `${packageManager} install`;
}

function buildEchoAiInstructions(hints: ProjectHints): string {
  const checks = [
    hints.typecheckCommand ? `- Type check: \`${hints.typecheckCommand}\`` : null,
    hints.lintCommand ? `- Lint: \`${hints.lintCommand}\`` : null,
    hints.testCommand ? `- Test: \`${hints.testCommand}\`` : null,
    hints.buildCommand ? `- Build: \`${hints.buildCommand}\`` : null,
  ].filter(Boolean).join('\n') || '- No standard verification scripts were detected. Inspect the project before choosing checks.';

  return [
    '# EchoAI Project Instructions',
    '',
    '## Workspace',
    `- Package manager: \`${hints.packageManager}\``,
    `- Install dependencies with: \`${hints.installCommand}\``,
    '',
    '## Verification',
    checks,
    '',
    '## Agent Rules',
    '- Inspect existing patterns before editing.',
    '- Keep changes scoped to the user request.',
    '- Ask before running commands that install dependencies, publish packages, push git history, or access the network.',
    '- Show a concise summary of changed files and verification results before finishing.',
    '',
  ].join('\n');
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
