import { useCallback, useEffect, useState } from 'react';
import type { DesktopGitFileChange, DesktopGitStatus } from '@shared/ipc';

/** Keeps the composer's branch chip current without hammering git. */
const POLL_INTERVAL_MS = 8000;

export interface GitApi {
  status: DesktopGitStatus | null;
  changes: DesktopGitFileChange[];
  diff: string;
  loadingDiff: boolean;
  refresh: () => Promise<void>;
  loadDiff: (options?: { path?: string; staged?: boolean }) => Promise<void>;
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  commit: (message: string, all?: boolean) => Promise<boolean>;
}

/**
 * Git state for the composer chip and the Changes panel.
 *
 * Polls on an interval because changes land from three directions the renderer
 * cannot observe: the agent's own edits, the user's editor, and the terminal.
 */
export function useGit(
  workspacePath: string | null,
  onError: (title: string, body: string) => void,
  onNotify: (title: string, body: string) => void
): GitApi {
  const [status, setStatus] = useState<DesktopGitStatus | null>(null);
  const [changes, setChanges] = useState<DesktopGitFileChange[]>([]);
  const [diff, setDiff] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setStatus(null);
      setChanges([]);
      setDiff('');
      return;
    }

    try {
      const [nextStatus, nextChanges] = await Promise.all([
        window.echoaiDesktop.getGitStatus(workspacePath),
        window.echoaiDesktop.listGitChangedFiles(workspacePath),
      ]);
      setStatus(nextStatus);
      setChanges(nextChanges);
    } catch (error) {
      // A non-repo is reported as data, so anything thrown here is unexpected.
      onError('Could not read git status', error instanceof Error ? error.message : String(error));
    }
  }, [workspacePath, onError]);

  useEffect(() => {
    void refresh();
    if (!workspacePath) {
      return;
    }
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, workspacePath]);

  const loadDiff = useCallback(
    async (options?: { path?: string; staged?: boolean }) => {
      if (!workspacePath) {
        return;
      }
      setLoadingDiff(true);
      try {
        setDiff(await window.echoaiDesktop.getGitDiff(workspacePath, options));
      } catch (error) {
        onError('Could not read diff', error instanceof Error ? error.message : String(error));
      } finally {
        setLoadingDiff(false);
      }
    },
    [workspacePath, onError]
  );

  const stage = useCallback(
    async (paths: string[]) => {
      if (!workspacePath || paths.length === 0) {
        return;
      }
      try {
        await window.echoaiDesktop.stageGitFiles(workspacePath, paths);
        await refresh();
      } catch (error) {
        onError('Could not stage', error instanceof Error ? error.message : String(error));
      }
    },
    [workspacePath, onError, refresh]
  );

  const unstage = useCallback(
    async (paths: string[]) => {
      if (!workspacePath || paths.length === 0) {
        return;
      }
      try {
        await window.echoaiDesktop.unstageGitFiles(workspacePath, paths);
        await refresh();
      } catch (error) {
        onError('Could not unstage', error instanceof Error ? error.message : String(error));
      }
    },
    [workspacePath, onError, refresh]
  );

  const commit = useCallback(
    async (message: string, all = false) => {
      if (!workspacePath) {
        return false;
      }
      try {
        const result = await window.echoaiDesktop.commitGitChanges(workspacePath, message, { all });
        onNotify('Committed', `${result.hash.slice(0, 7)} ${result.subject}`);
        await refresh();
        return true;
      } catch (error) {
        onError('Could not commit', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [workspacePath, onError, onNotify, refresh]
  );

  return { status, changes, diff, loadingDiff, refresh, loadDiff, stage, unstage, commit };
}
