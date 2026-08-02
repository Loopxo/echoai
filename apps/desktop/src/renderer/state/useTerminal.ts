import { useCallback, useEffect, useState } from 'react';
import type { DesktopSandboxStatus, DesktopTaskRecord } from '@shared/ipc';

const MAX_TASKS = 40;

export interface TerminalApi {
  tasks: DesktopTaskRecord[];
  sandbox: DesktopSandboxStatus | null;
  activeTaskId: string | null;
  log: string;
  run: (command: string) => Promise<void>;
  stop: (taskId: string) => Promise<void>;
  select: (taskId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/** Managed terminal tasks plus the log of the selected task. */
export function useTerminal(
  workspacePath: string | null,
  onError: (title: string, body: string) => void
): TerminalApi {
  const [tasks, setTasks] = useState<DesktopTaskRecord[]>([]);
  const [sandbox, setSandbox] = useState<DesktopSandboxStatus | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [log, setLog] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [taskList, sandboxStatus] = await Promise.all([
        window.echoaiDesktop.listTerminalTasks(),
        window.echoaiDesktop.getSandboxStatus(),
      ]);
      setTasks(taskList.slice(0, MAX_TASKS));
      setSandbox(sandboxStatus);
    } catch (error) {
      onError('Could not read tasks', error instanceof Error ? error.message : String(error));
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadLog = useCallback(
    async (taskId: string) => {
      try {
        setLog(await window.echoaiDesktop.getTerminalLog(taskId));
      } catch {
        setLog('');
      }
    },
    []
  );

  useEffect(() => {
    return window.echoaiDesktop.onTaskUpdate((task) => {
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)].slice(0, MAX_TASKS));
      // Keep the open log live while its task is still producing output.
      setActiveTaskId((current) => {
        if (current === task.id) {
          void loadLog(task.id);
        }
        return current;
      });
    });
  }, [loadLog]);

  const run = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) {
        return;
      }
      if (!workspacePath) {
        onError('No workspace', 'Open a workspace folder before running commands.');
        return;
      }

      try {
        const task = await window.echoaiDesktop.runTerminalCommand({
          command: trimmed,
          cwd: workspacePath,
        });
        setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)].slice(0, MAX_TASKS));
        setActiveTaskId(task.id);
        if (task.status === 'denied') {
          onError('Command blocked', task.classification.reason);
        }
        await loadLog(task.id);
      } catch (error) {
        onError('Command failed', error instanceof Error ? error.message : String(error));
      }
    },
    [workspacePath, onError, loadLog]
  );

  const stop = useCallback(
    async (taskId: string) => {
      try {
        await window.echoaiDesktop.stopTerminalTask(taskId);
      } catch (error) {
        onError('Could not stop task', error instanceof Error ? error.message : String(error));
      }
    },
    [onError]
  );

  const select = useCallback(
    async (taskId: string) => {
      setActiveTaskId(taskId);
      await loadLog(taskId);
    },
    [loadLog]
  );

  return { tasks, sandbox, activeTaskId, log, run, stop, select, refresh };
}
