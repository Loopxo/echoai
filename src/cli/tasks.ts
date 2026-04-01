import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { createCliRuntimeKernel } from '../runtime/cli-kernel.js';
import { getCliSessionRegistry } from '../runtime/session-bridge.js';

const kernel = createCliRuntimeKernel({ stateNamespace: 'cli' });
const sessionRegistry = getCliSessionRegistry();

export const tasksCommand = new Command('tasks')
  .description('Manage background tasks');

tasksCommand
  .command('start')
  .description('Start a background shell task')
  .argument('<command...>', 'Shell command to run in the background')
  .option('-s, --session <session-id>', 'Attach task to an existing session')
  .option('-t, --title <title>', 'Task title')
  .option('--session-title <title>', 'Title to use if a new session is created')
  .option('-c, --cwd <path>', 'Working directory for the task')
  .action(async (commandParts: string[], options) => {
    const command = commandParts.join(' ');
    let sessionId = options.session as string | undefined;

    if (!sessionId) {
      const session = await kernel.createSession(
        options.sessionTitle || 'Background Tasks',
        'system',
        'background'
      );
      sessionId = session.id;
    }

    const task = await kernel.startShellTask(sessionId, command, {
      title: options.title,
      cwd: options.cwd,
    });

    console.log(`✅ Started background task ${task.id}`);
    console.log(`Session: ${sessionId}`);
    console.log(`Title: ${task.title}`);
    if (task.outputPath) {
      console.log(`Log: ${task.outputPath}`);
    }
    if (typeof task.metadata?.pid === 'number') {
      console.log(`PID: ${task.metadata.pid}`);
    }
  });

tasksCommand
  .command('ps')
  .description('List background tasks')
  .option('-s, --session <session-id>', 'Filter to a single session')
  .action(async (options) => {
    const sessions = options.session
      ? [await sessionRegistry.load(options.session)].filter(Boolean)
      : await sessionRegistry.list();

    const rows: Array<{
      sessionId: string;
      taskId: string;
      title: string;
      status: string;
      pid?: number;
    }> = [];

    for (const session of sessions) {
      if (!session) {
        continue;
      }
      const tasks = await kernel.listTasks(session.id);
      for (const task of tasks) {
        rows.push({
          sessionId: session.id,
          taskId: task.id,
          title: task.title,
          status: task.status,
          pid: typeof task.metadata?.pid === 'number' ? task.metadata.pid : undefined,
        });
      }
    }

    if (rows.length === 0) {
      console.log('No background tasks found.');
      return;
    }

    for (const row of rows) {
      const pid = row.pid ? ` pid=${row.pid}` : '';
      console.log(`${row.status.padEnd(10)} ${row.sessionId} ${row.taskId} ${row.title}${pid}`);
    }
  });

tasksCommand
  .command('logs')
  .description('Show task logs')
  .argument('<session-id>', 'Session ID')
  .argument('<task-id>', 'Task ID')
  .option('--bytes <number>', 'Maximum bytes to read', parseInt, 64000)
  .option('-f, --follow', 'Follow logs until the task exits')
  .action(async (sessionId, taskId, options) => {
    if (options.follow) {
      await followTaskLogs(sessionId, taskId);
      return;
    }

    const log = await kernel.getTaskLog(sessionId, taskId, {
      maxBytes: options.bytes,
    });
    writeLogChunk(log);
  });

tasksCommand
  .command('kill')
  .description('Stop a background task')
  .argument('<session-id>', 'Session ID')
  .argument('<task-id>', 'Task ID')
  .option('--signal <signal>', 'Signal to send', 'SIGTERM')
  .action(async (sessionId, taskId, options) => {
    const stopped = await kernel.stopTask(sessionId, taskId, options.signal);
    if (!stopped) {
      console.error(`❌ Failed to stop task ${taskId}`);
      process.exit(1);
    }

    console.log(`✅ Stopped task ${taskId}`);
  });

async function followTaskLogs(sessionId: string, taskId: string): Promise<void> {
  let offset = 0;

  while (true) {
    const session = await sessionRegistry.load(sessionId);
    const task = session?.tasks.find((entry) => entry.id === taskId);
    const logPath = typeof task?.metadata?.logPath === 'string'
      ? task.metadata.logPath
      : task?.outputPath;

    if (logPath) {
      try {
        const content = await readFile(logPath, 'utf8');
        const nextChunk = content.slice(offset);
        if (nextChunk.length > 0) {
          process.stdout.write(nextChunk);
          offset = content.length;
        }
      } catch {
        // Wait for the task to create the log file.
      }
    }

    const tasks = await kernel.listTasks(sessionId);
    const current = tasks.find((entry) => entry.id === taskId);
    if (!current) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (current.status !== 'running') {
      if (logPath) {
        try {
          const content = await readFile(logPath, 'utf8');
          const nextChunk = content.slice(offset);
          if (nextChunk.length > 0) {
            process.stdout.write(nextChunk);
          }
        } catch {
          // Ignore final read failures.
        }
      }

      process.stdout.write(`\n[task ${current.status}]\n`);
      return;
    }

    await delay(300);
  }
}

function writeLogChunk(log: string): void {
  process.stdout.write(log);
  if (!log.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
