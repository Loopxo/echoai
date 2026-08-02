import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '@echoai/design';
import { cn } from '../lib/cn';
import { IconButton } from './primitives';

const VIEWPORT_MARGIN = 8;

/* ------------------------------- Tooltip ------------------------------- */

/**
 * Hover/focus tooltip positioned against the trigger's bounding box.
 *
 * Rendered in a portal with `position: fixed` so it escapes the overflow
 * clipping of the sidebar, panel and timeline scroll containers.
 */
export function Tooltip({
  content,
  shortcut,
  side = 'bottom',
  children,
  delay = 350,
}: {
  content: ReactNode;
  shortcut?: string;
  side?: 'top' | 'bottom';
  children: ReactElement;
  delay?: number;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const show = useCallback(() => {
    clear();
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  }, [clear, delay]);

  const hide = useCallback(() => {
    clear();
    setOpen(false);
    setPosition(null);
  }, [clear]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const anchor = anchorRef.current?.firstElementChild ?? anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const top =
      side === 'top'
        ? anchorRect.top - tipRect.height - 6
        : anchorRect.bottom + 6;
    const left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;

    setPosition({
      top: Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - tipRect.height - VIEWPORT_MARGIN)),
      left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - tipRect.width - VIEWPORT_MARGIN)),
    });
  }, [open, side]);

  return (
    <>
      <span
        ref={anchorRef}
        style={{ display: 'inline-flex', minWidth: 0 }}
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={hide}
      >
        {children}
      </span>
      {open
        ? createPortal(
            <div
              ref={tipRef}
              role="tooltip"
              className="tooltip"
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              {content}
              {shortcut ? <span className="tooltip-kbd">{shortcut}</span> : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/* -------------------------------- Menu -------------------------------- */

export type MenuEntry =
  | {
      kind: 'item';
      id: string;
      label: string;
      icon?: IconName;
      detail?: string;
      checked?: boolean;
      tone?: 'default' | 'danger';
      disabled?: boolean;
      onSelect: () => void;
    }
  | { kind: 'separator'; id: string }
  | { kind: 'label'; id: string; label: string };

export function Menu({
  trigger,
  entries,
  align = 'start',
  side = 'bottom',
  minWidth,
}: {
  trigger: ReactElement;
  entries: MenuEntry[];
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
  minWidth?: number;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const selectable = entries.filter(
    (entry): entry is Extract<MenuEntry, { kind: 'item' }> => entry.kind === 'item' && !entry.disabled
  );

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    setHighlight(0);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const preferredTop = side === 'top' ? anchorRect.top - menuRect.height - 4 : anchorRect.bottom + 4;
    const flippedTop = side === 'top' ? anchorRect.bottom + 4 : anchorRect.top - menuRect.height - 4;
    const fitsPreferred =
      preferredTop >= VIEWPORT_MARGIN &&
      preferredTop + menuRect.height <= window.innerHeight - VIEWPORT_MARGIN;
    const top = fitsPreferred ? preferredTop : flippedTop;
    const left = align === 'end' ? anchorRect.right - menuRect.width : anchorRect.left;

    setPosition({
      top: Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - menuRect.height - VIEWPORT_MARGIN)),
      left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - menuRect.width - VIEWPORT_MARGIN)),
    });
  }, [open, align, side]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((current) => (current + 1) % Math.max(1, selectable.length));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((current) => (current - 1 + selectable.length) % Math.max(1, selectable.length));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const entry = selectable[highlight];
        if (entry) {
          entry.onSelect();
          close();
        }
      }
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close, highlight, selectable]);

  const triggerNode = isValidElement<{ 'aria-expanded'?: boolean }>(trigger)
    ? cloneElement(trigger, { 'aria-expanded': open })
    : trigger;

  return (
    <>
      <span
        ref={anchorRef}
        className="menu-anchor"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        {triggerNode}
      </span>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="menu"
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                minWidth,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              {entries.map((entry) => {
                if (entry.kind === 'separator') {
                  return <div key={entry.id} className="menu-sep" role="separator" />;
                }
                if (entry.kind === 'label') {
                  return (
                    <div key={entry.id} className="menu-label">
                      {entry.label}
                    </div>
                  );
                }

                const index = selectable.indexOf(entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    data-tone={entry.tone === 'danger' ? 'danger' : undefined}
                    data-checked={entry.checked ? 'true' : undefined}
                    data-highlighted={index === highlight && index >= 0 ? 'true' : undefined}
                    disabled={entry.disabled}
                    onPointerEnter={() => index >= 0 && setHighlight(index)}
                    onClick={() => {
                      entry.onSelect();
                      close();
                    }}
                  >
                    {entry.checked ? (
                      <Icon name="check" size={13} />
                    ) : entry.icon ? (
                      <Icon name={entry.icon} size={13} />
                    ) : null}
                    <span className="menu-item-label">{entry.label}</span>
                    {entry.detail ? <span className="menu-item-detail">{entry.detail}</span> : null}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/* ------------------------------- Overlay ------------------------------- */

/** Backdrop + Escape handling + initial focus, shared by dialog and palette. */
export function Overlay({
  onDismiss,
  align = 'center',
  labelledBy,
  children,
}: {
  onDismiss: () => void;
  align?: 'center' | 'top';
  labelledBy?: string;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.stopPropagation();
      onDismiss();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onDismiss]);

  useEffect(() => {
    // Keep Tab cycling inside the overlay while it is open.
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = surface.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    surface.addEventListener('keydown', onKeyDown);
    return () => surface.removeEventListener('keydown', onKeyDown);
  }, []);

  return createPortal(
    <div
      className="backdrop"
      data-align={align}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ display: 'contents' }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------- Dialog -------------------------------- */

export function Dialog({
  title,
  description,
  onClose,
  size = 'md',
  footer,
  children,
  className,
  headerActions,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}) {
  const titleId = `dialog-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <Overlay onDismiss={onClose} labelledBy={titleId}>
      <div className={cn('dialog', className)} data-size={size}>
        <div className="dialog-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="dialog-title" id={titleId}>
              {title}
            </h2>
            {description ? <p className="dialog-desc">{description}</p> : null}
          </div>
          <div className="field-row-control">
            {headerActions}
            <IconButton icon="x" label="Close" onClick={onClose} />
          </div>
        </div>
        {size === 'lg' ? children : <div className="dialog-body">{children}</div>}
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </Overlay>
  );
}

/* ----------------------------- Confirmation ----------------------------- */

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Overlay onDismiss={onCancel}>
      <div className="dialog" data-size="sm">
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">{title}</h2>
            <p className="dialog-desc">{description}</p>
          </div>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn" data-variant="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            data-variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
