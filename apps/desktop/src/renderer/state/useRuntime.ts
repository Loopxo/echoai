import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DesktopRuntimeEvent,
  DesktopRuntimeSessionSummary,
  DesktopRuntimeStatus,
} from '@shared/ipc';
import { buildTimeline, timelineFromExport, type TimelineRow } from '../lib/activity';
import { usePersistentState } from '../lib/hooks';
import { truncate } from '../lib/format';

/** Events are derived state; cap the buffer so a very long run cannot grow it forever. */
const MAX_EVENTS = 4000;

export type PromptMode = 'default' | 'plan';

export interface RuntimeApi {
  status: DesktopRuntimeStatus | null;
  sessions: DesktopRuntimeSessionSummary[];
  activeSessionId: string | null;
  rows: TimelineRow[];
  running: boolean;
  runStartedAt: number | null;
  provider: string;
  model: string;
  mode: PromptMode;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setMode: (mode: PromptMode) => void;
  send: (input: string) => Promise<void>;
  stop: () => Promise<void>;
  newThread: () => void;
  openThread: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  historyLoading: boolean;
}

export function useRuntime(
  workspacePath: string | null,
  onError: (title: string, body: string) => void
): RuntimeApi {
  const [status, setStatus] = useState<DesktopRuntimeStatus | null>(null);
  const [sessions, setSessions] = useState<DesktopRuntimeSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<DesktopRuntimeEvent[]>([]);
  const [historyRows, setHistoryRows] = useState<TimelineRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const [provider, setProvider] = usePersistentState('echoai:provider', '');
  const [model, setModel] = usePersistentState('echoai:model', '');
  const [mode, setMode] = usePersistentState<PromptMode>('echoai:mode', 'default');

  // Read inside the event subscription without making it a dependency, so the
  // listener is attached exactly once for the life of the component.
  const activeSessionRef = useRef<string | null>(null);
  activeSessionRef.current = activeSessionId;

  const refreshStatus = useCallback(async () => {
    try {
      const next = await window.echoaiDesktop.getRuntimeStatus();
      setStatus(next);
      // Seed the pickers from whatever the main process reports as default the
      // first time, or whenever the stored provider is no longer configured.
      setProvider((current) =>
        current && next.providers.some((item) => item.id === current) ? current : next.provider
      );
      setModel((current) => (current ? current : next.model));
    } catch (error) {
      onError('Runtime unavailable', error instanceof Error ? error.message : String(error));
    }
    // setProvider/setModel are stable; including them would not change behaviour
    // but keeps the dependency list honest.
  }, [onError, setModel, setProvider]);

  const refreshSessions = useCallback(async () => {
    try {
      const next = await window.echoaiDesktop.listRuntimeSessions();
      setSessions([...next].sort((left, right) => right.updatedAt - left.updatedAt));
    } catch (error) {
      onError('Could not load threads', error instanceof Error ? error.message : String(error));
    }
  }, [onError]);

  useEffect(() => {
    void refreshStatus();
    void refreshSessions();
  }, [refreshStatus, refreshSessions]);

  useEffect(() => {
    return window.echoaiDesktop.onRuntimeEvent((event) => {
      setEvents((current) => {
        const next = current.length >= MAX_EVENTS ? current.slice(-MAX_EVENTS + 1) : current;
        return [...next, event];
      });

      // `run.started` is the first event that reveals the session id for a
      // brand new thread, so adopt it as the active session.
      if (event.sessionId && !activeSessionRef.current) {
        setActiveSessionId(event.sessionId);
        activeSessionRef.current = event.sessionId;
      }

      if (
        event.type === 'run.completed' ||
        event.type === 'run.failed' ||
        event.type === 'run.cancelled'
      ) {
        setActiveRunId(null);
        void refreshStatus();
        void refreshSessions();
      }
    });
  }, [refreshSessions, refreshStatus]);

  const timeline = useMemo(() => buildTimeline(events), [events]);
  const rows = useMemo(() => [...historyRows, ...timeline.rows], [historyRows, timeline.rows]);

  // The kernel can create the session lazily; adopt whatever id it reports.
  useEffect(() => {
    if (timeline.sessionId && timeline.sessionId !== activeSessionId) {
      setActiveSessionId(timeline.sessionId);
    }
  }, [timeline.sessionId, activeSessionId]);

  const send = useCallback(
    async (input: string) => {
      const prompt = input.trim();
      if (!prompt) {
        return;
      }

      try {
        const handle = await window.echoaiDesktop.runPrompt({
          input: prompt,
          sessionId: activeSessionId ?? undefined,
          workspaceRoot: workspacePath ?? undefined,
          mode,
          provider: provider || undefined,
          model: model || undefined,
        });
        setActiveRunId(handle.runId);
      } catch (error) {
        onError('Could not start the run', error instanceof Error ? error.message : String(error));
      }
    },
    [activeSessionId, mode, model, onError, provider, workspacePath]
  );

  const stop = useCallback(async () => {
    if (!activeRunId) {
      return;
    }
    try {
      await window.echoaiDesktop.cancelRun(activeRunId);
    } catch (error) {
      onError('Could not stop the run', error instanceof Error ? error.message : String(error));
    } finally {
      setActiveRunId(null);
      void refreshStatus();
    }
  }, [activeRunId, onError, refreshStatus]);

  const newThread = useCallback(() => {
    setActiveSessionId(null);
    setEvents([]);
    setHistoryRows([]);
    activeSessionRef.current = null;
  }, []);

  const openThread = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionId) {
        return;
      }

      setActiveSessionId(sessionId);
      activeSessionRef.current = sessionId;
      setEvents([]);
      setHistoryRows([]);
      setHistoryLoading(true);

      try {
        // Message history is only reachable through the export payload.
        const json = await window.echoaiDesktop.exportRuntimeSession(sessionId);
        setHistoryRows(timelineFromExport(json));
      } catch (error) {
        onError('Could not open thread', error instanceof Error ? error.message : String(error));
      } finally {
        setHistoryLoading(false);
      }
    },
    [activeSessionId, onError]
  );

  return {
    status,
    sessions,
    activeSessionId,
    rows,
    running: timeline.running || activeRunId !== null,
    runStartedAt: timeline.runStartedAt,
    provider,
    model,
    mode,
    setProvider,
    setModel,
    setMode,
    send,
    stop,
    newThread,
    openThread,
    refreshSessions,
    historyLoading,
  };
}

/** Fallback title for a thread that has not been named yet. */
export function threadTitle(session: DesktopRuntimeSessionSummary): string {
  const title = session.title.trim();
  if (!title || title === 'Desktop session') {
    return 'New thread';
  }
  return truncate(title, 60);
}
