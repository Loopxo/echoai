import { Command } from 'commander';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createBuiltInTools } from '@echoai/runtime';
import { detectLanguageServerReadiness, type LanguageServerReadiness } from '@echoai/lsp';

interface DiagnoseReport {
  workspace: string;
  echoaiMd: boolean;
  memoryEntries: number;
  evalTasks: number;
  packageManager?: string;
  scripts: string[];
  tools: Array<{ name: string; available: boolean; version?: string }>;
  runtimeTools: string[];
  acp: {
    sdk: string;
    command: string;
    transport: string;
    registryReady: boolean;
  };
  lsp: LanguageServerReadiness[];
  providerEnv: Record<string, boolean>;
  issues: string[];
}

export const diagnoseCommand = new Command('diagnose')
  .description('Inspect EchoAI project readiness, tools, providers, and eval setup')
  .option('--json', 'Print machine-readable JSON')
  .action(async (options) => {
    const report = await createDiagnoseReport(process.cwd());

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log('EchoAI Diagnose');
    console.log(`Workspace: ${report.workspace}`);
    console.log(`ECHOAI.md: ${report.echoaiMd ? 'present' : 'missing'}`);
    console.log(`Project memory: ${report.memoryEntries} entries`);
    console.log(`Eval tasks: ${report.evalTasks}`);
    console.log(`Package manager: ${report.packageManager ?? 'not detected'}`);
    console.log(`Scripts: ${report.scripts.length > 0 ? report.scripts.join(', ') : 'none'}`);
    console.log('');
    console.log('CLI tools:');
    for (const tool of report.tools) {
      console.log(`  ${tool.available ? 'ok' : 'missing'}  ${tool.name}${tool.version ? ` (${tool.version})` : ''}`);
    }
    console.log('');
    console.log('Runtime tools:');
    console.log(`  ${report.runtimeTools.join(', ')}`);
    console.log('');
    console.log('ACP:');
    console.log(`  SDK: ${report.acp.sdk}`);
    console.log(`  command: ${report.acp.command}`);
    console.log(`  transport: ${report.acp.transport}`);
    console.log(`  registry-ready metadata: ${report.acp.registryReady ? 'present' : 'missing'}`);
    console.log('');
    console.log('Language servers:');
    for (const server of report.lsp) {
      console.log(`  ${server.available ? 'ok' : 'missing'}  ${server.name} (${server.command})`);
      if (!server.available) {
        console.log(`      install: ${server.install}`);
      }
    }
    console.log('');
    console.log('Provider environment:');
    for (const [key, present] of Object.entries(report.providerEnv)) {
      console.log(`  ${present ? 'set' : 'missing'}  ${key}`);
    }

    if (report.issues.length > 0) {
      console.log('');
      console.log('Issues:');
      for (const issue of report.issues) {
        console.log(`  - ${issue}`);
      }
    }
  });

async function createDiagnoseReport(workspace: string): Promise<DiagnoseReport> {
  const packageJson = await readJson<{ scripts?: Record<string, string> }>(path.join(workspace, 'package.json'));
  const scripts = Object.keys(packageJson?.scripts ?? {}).sort();
  const packageManager = await detectPackageManager(workspace);
  const tools = await Promise.all(['git', 'rg', 'node', 'pnpm', 'npm'].map(checkTool));
  const runtimeTools = createBuiltInTools({ workspaceRoot: workspace }).map((tool) => tool.name).sort();
  const lsp = await detectLanguageServerReadiness(workspace);
  const acp = {
    sdk: '@agentclientprotocol/sdk',
    command: 'echoai acp --stdio',
    transport: 'ndjson-stdio',
    registryReady: await exists(path.join(workspace, 'docs', 'acp-registry.md')),
  };
  const providerEnv = {
    ECHOAI_API_KEY: Boolean(process.env.ECHOAI_API_KEY),
    DEEPSEEK_API_KEY: Boolean(process.env.DEEPSEEK_API_KEY),
    MOONSHOT_API_KEY: Boolean(process.env.MOONSHOT_API_KEY),
    KIMI_API_KEY: Boolean(process.env.KIMI_API_KEY),
    ZHIPU_API_KEY: Boolean(process.env.ZHIPU_API_KEY),
    QWEN_API_KEY: Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY),
    MINIMAX_API_KEY: Boolean(process.env.MINIMAX_API_KEY),
  };

  const echoaiMd = await exists(path.join(workspace, 'ECHOAI.md'));
  const memoryEntries = await countJsonl(path.join(workspace, '.echoai', 'memory.jsonl'));
  const evalTasks = await countEvalTasks(path.join(workspace, 'evals', 'tasks'));
  const issues: string[] = [];

  if (!echoaiMd) issues.push('Run `echoai init` so the agent has project instructions.');
  if (!tools.find((tool) => tool.name === 'rg')?.available) issues.push('Install ripgrep for fast repo search.');
  if (!runtimeTools.includes('workspace_symbols')) issues.push('workspace_symbols tool is missing from the runtime catalog.');
  if (lsp.every((server) => !server.available)) {
    issues.push('No LSP servers detected. Install at least TypeScript language server first for market-ready code intelligence.');
  }
  if (!acp.registryReady) issues.push('ACP registry metadata docs are missing.');
  if (evalTasks < 20) issues.push('Eval task count is below the planned 20-task market gate.');
  if (!providerEnv.ECHOAI_API_KEY && !providerEnv.DEEPSEEK_API_KEY && !providerEnv.MOONSHOT_API_KEY && !providerEnv.KIMI_API_KEY && !providerEnv.ZHIPU_API_KEY && !providerEnv.QWEN_API_KEY && !providerEnv.MINIMAX_API_KEY) {
    issues.push('No EchoAI, DeepSeek, Kimi, Zhipu/GLM, Qwen, or MiniMax provider key is configured in the environment.');
  }
  if (!scripts.includes('test')) issues.push('No package.json test script detected.');

  return {
    workspace,
    echoaiMd,
    memoryEntries,
    evalTasks,
    packageManager,
    scripts,
    tools,
    runtimeTools,
    acp,
    lsp,
    providerEnv,
    issues,
  };
}

async function detectPackageManager(workspace: string): Promise<string | undefined> {
  if (await exists(path.join(workspace, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(path.join(workspace, 'yarn.lock'))) return 'yarn';
  if (await exists(path.join(workspace, 'bun.lockb')) || await exists(path.join(workspace, 'bun.lock'))) return 'bun';
  if (await exists(path.join(workspace, 'package-lock.json'))) return 'npm';
  if (await exists(path.join(workspace, 'package.json'))) return 'npm';
  return undefined;
}

async function checkTool(name: string): Promise<{ name: string; available: boolean; version?: string }> {
  const result = await run(name, ['--version']);
  const firstLine = result.stdout.split('\n').find(Boolean) ?? result.stderr.split('\n').find(Boolean);
  return {
    name,
    available: result.code === 0,
    version: firstLine?.trim(),
  };
}

async function countJsonl(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf8');
    return content.split('\n').filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

async function countEvalTasks(tasksDir: string): Promise<number> {
  const { loadEvalTasks } = await import('./eval.js');
  try {
    return (await loadEvalTasks(tasksDir)).length;
  } catch {
    return 0;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function run(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      resolve({ stdout, stderr: error.message, code: error.code === 'ENOENT' ? 127 : 1 });
    });
    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

export default diagnoseCommand;
