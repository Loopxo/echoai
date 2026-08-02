import { useCallback, useEffect, useState } from 'react';
import type { DesktopNotification } from '@shared/ipc';

const MAX_VISIBLE = 4;
const AUTO_DISMISS_MS = 6000;

export interface ToastsApi {
  toasts: DesktopNotification[];
  push: (kind: DesktopNotification['kind'], title: string, body: string) => void;
  dismiss: (id: string) => void;
}

/**
 * Transient notification stack.
 *
 * Subscribes to main-process pushes and also accepts local notices, so an
 * action's feedback does not have to round-trip through IPC just to be seen.
 */
export function useToasts(): ToastsApi {
  const [toasts, setToasts] = useState<DesktopNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const add = useCallback((notification: DesktopNotification) => {
    setToasts((current) => [notification, ...current].slice(0, MAX_VISIBLE));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== notification.id));
    }, AUTO_DISMISS_MS);
  }, []);

  const push = useCallback(
    (kind: DesktopNotification['kind'], title: string, body: string) => {
      add({
        id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        kind,
        title,
        body,
        createdAt: new Date().toISOString(),
      });
    },
    [add]
  );

  useEffect(() => {
    return window.echoaiDesktop.onNotification(add);
  }, [add]);

  return { toasts, push, dismiss };
}
