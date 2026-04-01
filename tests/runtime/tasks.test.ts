import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentKernel } from '../../packages/runtime/src/index.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe('background tasks', () => {
  it('runs a shell task, persists completion, and captures logs', async () => {
    const stateDir = await createTempStateDir();
    const kernel = new AgentKernel({
      registryOptions: { stateDir, namespace: 'tasks-test' },
      registerBuiltInTools: false,
    });

    const session = await kernel.createSession('Tasks');
    const task = await kernel.startShellTask(
      session.id,
      `${JSON.stringify(process.execPath)} -e "console.log('task-output')"`
    );

    const completed = await waitForTask(kernel, session.id, task.id, (current) => current.status === 'completed');

    expect(completed.status).toBe('completed');
    const log = await kernel.getTaskLog(session.id, task.id);
    expect(log).toContain('task-output');
  });

  it('can stop a running shell task', async () => {
    const stateDir = await createTempStateDir();
    const kernel = new AgentKernel({
      registryOptions: { stateDir, namespace: 'tasks-test-stop' },
      registerBuiltInTools: false,
    });

    const session = await kernel.createSession('Tasks');
    const task = await kernel.startShellTask(
      session.id,
      `${JSON.stringify(process.execPath)} -e "setTimeout(() => {}, 10000)"`
    );

    const stopped = await kernel.stopTask(session.id, task.id);
    expect(stopped).toBe(true);

    const tasks = await kernel.listTasks(session.id);
    expect(tasks.find((entry) => entry.id === task.id)?.status).toBe('cancelled');
  });
});

async function createTempStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'echoai-runtime-'));
  tempDirs.push(dir);
  return dir;
}

async function waitForTask(
  kernel: AgentKernel,
  sessionId: string,
  taskId: string,
  predicate: (task: Awaited<ReturnType<AgentKernel['listTasks']>>[number]) => boolean,
  timeoutMs = 5000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const task = (await kernel.listTasks(sessionId)).find((entry) => entry.id === taskId);
    if (task && predicate(task)) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for task ${taskId}`);
}
