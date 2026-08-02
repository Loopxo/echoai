import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

/* --------------------------- Persisted state --------------------------- */

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    // Corrupt or unavailable storage should never block the shell from booting.
    return fallback;
  }
}

/**
 * useState backed by localStorage. Reads once on mount, writes on every change.
 * Accepts a functional updater like useState so callers can derive from current.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T
): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Non-fatal: the preference simply will not survive a restart.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}

/* ------------------------------- Ticker ------------------------------- */

/** Re-render on an interval. Used by live elapsed-time labels. */
export function useTicker(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);

  return now;
}

/* ------------------------------ Viewport ------------------------------ */

export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      if (frame !== 0) {
        return;
      }
      // Coalesce resize bursts into one paint.
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setWidth(window.innerWidth);
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return width;
}

/* ---------------------------- Resizable pane ---------------------------- */

export interface ResizableOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Which edge carries the drag handle. */
  edge: 'left' | 'right';
}

export interface Resizable {
  width: number;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Pointer-capture width drag, batched to animation frames and persisted.
 *
 * The width is clamped on every render (not just on drag) so shrinking the OS
 * window re-clamps a previously stored width instead of squeezing the chat
 * column below its minimum.
 */
export function useResizable({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  edge,
}: ResizableOptions): Resizable {
  const [stored, setStored] = usePersistentState(storageKey, defaultWidth);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef(0);
  const latestRef = useRef(stored);

  const clamp = useCallback(
    (value: number) => Math.round(Math.max(minWidth, Math.min(value, Math.max(minWidth, maxWidth)))),
    [minWidth, maxWidth]
  );

  const width = clamp(stored);

  useEffect(() => {
    return () => {
      if (frameRef.current !== 0) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startWidth = width;
      latestRef.current = startWidth;
      setDragging(true);
      document.body.dataset.resizing = 'true';

      const onMove = (moveEvent: PointerEvent) => {
        const delta = edge === 'left' ? startX - moveEvent.clientX : moveEvent.clientX - startX;
        const next = clamp(startWidth + delta);
        latestRef.current = next;

        if (frameRef.current !== 0) {
          return;
        }
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = 0;
          setStored(latestRef.current);
        });
      };

      const onUp = () => {
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        setDragging(false);
        delete document.body.dataset.resizing;
        setStored(clamp(latestRef.current));
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    },
    [clamp, edge, setStored, width]
  );

  return { width, dragging, onPointerDown };
}

/* --------------------------- Stick to bottom --------------------------- */

/**
 * Keeps a scroll container pinned to the bottom while new content streams in,
 * but releases the pin as soon as the user scrolls up.
 */
export function useStickToBottom(
  ref: RefObject<HTMLElement | null>,
  dependency: unknown
): { pinned: boolean; scrollToBottom: () => void } {
  const [pinned, setPinned] = useState(true);

  const scrollToBottom = useCallback(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
    setPinned(true);
  }, [ref]);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      setPinned(distance < 48);
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [ref]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pinned) {
      return;
    }
    node.scrollTop = node.scrollHeight;
    // `pinned` is intentionally read but not depended on: re-pinning must be
    // driven by new content, not by the flag flipping.
  }, [dependency, ref]); // eslint-disable-line react-hooks/exhaustive-deps

  return { pinned, scrollToBottom };
}

/* ---------------------------- Auto-grow area ---------------------------- */

/** Resize a textarea to fit its content, up to a max pixel height. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight: number): void {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, maxHeight)}px`;
  }, [ref, value, maxHeight]);
}

/* ------------------------------- Clipboard ------------------------------- */

export function useCopy(resetMs = 1400): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard?.writeText(text).then(
        () => {
          setCopied(true);
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
          }
          timerRef.current = window.setTimeout(() => setCopied(false), resetMs);
        },
        () => {
          // Clipboard can be unavailable; failing silently is preferable to
          // throwing inside a click handler.
        }
      );
    },
    [resetMs]
  );

  return { copied, copy };
}
