import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const stateDir = process.env.ECHOAI_STATE_DIR?.trim()
  ? path.resolve(process.env.ECHOAI_STATE_DIR.trim())
  : path.join(os.homedir(), '.echoai');
const pidFile = path.join(stateDir, 'node-service.pid');
const logFile = path.join(stateDir, 'node-service.log');
const statusFile = path.join(stateDir, 'node-service.json');

interface ServiceOptions {
  json?: boolean;
  port?: string;
  host?: string;
}

export const serviceCommand = new Command('service')
  .description('Manage EchoAI local background services');

const nodeServiceCommand = new Command('node')
  .description('Manage the local EchoAI node service used by desktop and mobile clients');

nodeServiceCommand
  .command('start')
  .description('Start the local EchoAI node service')
  .option('--json', 'Print machine-readable JSON')
  .option('-p, --port <port>', 'Gateway port', '18789')
  .option('--host <host>', 'Gateway host', '127.0.0.1')
  .action(async (options: ServiceOptions) => {
    const result = await startNodeService(options);
    printResult(result, options.json === true);
  });

nodeServiceCommand
  .command('stop')
  .description('Stop the local EchoAI node service')
  .option('--json', 'Print machine-readable JSON')
  .action(async (options: ServiceOptions) => {
    const result = await stopNodeService();
    printResult(result, options.json === true);
  });

nodeServiceCommand
  .command('status')
  .description('Show local EchoAI node service status')
  .option('--json', 'Print machine-readable JSON')
  .action(async (options: ServiceOptions) => {
    const result = await nodeServiceStatus();
    printResult(result, options.json === true);
  });

nodeServiceCommand
  .command('restart')
  .description('Restart the local EchoAI node service')
  .option('--json', 'Print machine-readable JSON')
  .option('-p, --port <port>', 'Gateway port', '18789')
  .option('--host <host>', 'Gateway host', '127.0.0.1')
  .action(async (options: ServiceOptions) => {
    await stopNodeService();
    const result = await startNodeService(options);
    printResult(result, options.json === true);
  });

serviceCommand.addCommand(nodeServiceCommand);

async function startNodeService(options: ServiceOptions) {
  const current = await nodeServiceStatus();
  if (current.service.running) {
    return {
      ok: true,
      result: 'already-running',
      message: 'EchoAI node service is already running.',
      service: current.service,
      hints: [],
    };
  }

  await mkdir(stateDir, { recursive: true });
  const entrypoint = resolveCliEntrypoint();
  if (!entrypoint) {
    return {
      ok: false,
      result: 'missing-entrypoint',
      error: 'Could not resolve EchoAI CLI entrypoint.',
      service: { loaded: false, running: false },
      hints: ['Run `pnpm run build` or install the published EchoAI package.'],
    };
  }

  const out = await import('node:fs').then((fs) => fs.openSync(logFile, 'a'));
  const child = spawn(process.execPath, [
    entrypoint,
    'gateway',
    'start',
    '--port',
    options.port || '18789',
    '--host',
    options.host || '127.0.0.1',
  ], {
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      ECHOAI_SERVICE: 'node',
    },
  });

  child.unref();
  await writeFile(pidFile, String(child.pid), 'utf8');
  await writeFile(statusFile, JSON.stringify({
    pid: child.pid,
    startedAt: new Date().toISOString(),
    port: Number(options.port || 18789),
    host: options.host || '127.0.0.1',
    logFile,
  }, null, 2), 'utf8');

  return {
    ok: true,
    result: 'started',
    message: 'EchoAI node service started.',
    service: {
      loaded: true,
      running: true,
      pid: child.pid,
      logFile,
    },
    hints: [],
  };
}

async function stopNodeService() {
  const status = await nodeServiceStatus();
  if (!status.service.pid || !status.service.running) {
    await rm(pidFile, { force: true });
    return {
      ok: true,
      result: 'not-running',
      message: 'EchoAI node service is not running.',
      service: { loaded: false, running: false },
      hints: [],
    };
  }

  try {
    process.kill(status.service.pid, 'SIGTERM');
  } catch {
    // Treat stale PID files as stopped.
  }
  await rm(pidFile, { force: true });
  await rm(statusFile, { force: true });

  return {
    ok: true,
    result: 'stopped',
    message: 'EchoAI node service stopped.',
    service: { loaded: false, running: false },
    hints: [],
  };
}

async function nodeServiceStatus() {
  const pid = await readPid();
  const running = pid ? isPidRunning(pid) : false;
  const metadata = await readStatusMetadata();

  return {
    ok: true,
    result: running ? 'running' : 'not-loaded',
    message: running ? 'EchoAI node service is running.' : 'EchoAI node service is not loaded.',
    service: {
      loaded: running,
      running,
      pid: running ? pid : undefined,
      logFile: existsSync(logFile) ? logFile : undefined,
      ...metadata,
    },
    hints: running ? [] : ['Run `echoai service node start` to start the local gateway service.'],
  };
}

async function readPid(): Promise<number | undefined> {
  try {
    const raw = await readFile(pidFile, 'utf8');
    const pid = Number(raw.trim());
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

async function readStatusMetadata(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(statusFile, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function resolveCliEntrypoint(): string | undefined {
  const current = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
  if (current && existsSync(current) && current.endsWith('.js')) {
    return current;
  }

  const distCli = path.resolve(process.cwd(), 'dist/cli.js');
  if (existsSync(distCli)) {
    return distCli;
  }

  return undefined;
}

function printResult(result: Record<string, unknown>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const ok = result.ok === true;
  const message = typeof result.message === 'string'
    ? result.message
    : ok ? 'Command completed.' : 'Command failed.';
  console.log(message);
  if (!ok && typeof result.error === 'string') {
    console.error(result.error);
  }
}
