import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@echoai/design';
import { Overlay } from '../ui';
import { fuzzyScore } from '../lib/format';

export interface PaletteAction {
  id: string;
  label: string;
  detail?: string;
  icon: IconName;
  group: string;
  /** Extra text matched by the fuzzy search but not displayed. */
  keywords?: string;
  run: () => void;
}

const MAX_RESULTS = 40;

/**
 * Command palette (Cmd+K).
 *
 * With navigation collapsed into one surface, this is how everything else stays
 * reachable in one keystroke: threads, workspaces, settings sections, actions.
 */
export function CommandPalette({
  actions,
  onDismiss,
}: {
  actions: PaletteAction[];
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return actions.slice(0, MAX_RESULTS);
    }

    return actions
      .map((action) => ({
        action,
        score: fuzzyScore(`${action.label} ${action.detail ?? ''} ${action.keywords ?? ''}`, trimmed),
      }))
      .filter((item): item is { action: PaletteAction; score: number } => item.score !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RESULTS)
      .map((item) => item.action);
  }, [actions, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Keep the highlighted row inside the scrollport during keyboard navigation.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[data-highlighted="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const commit = (index: number) => {
    const action = results[index];
    if (!action) {
      return;
    }
    onDismiss();
    action.run();
  };

  let lastGroup: string | null = null;

  return (
    <Overlay onDismiss={onDismiss} align="top">
      <div className="palette">
        <div className="palette-input-row">
          <Icon name="search" size={16} color="var(--fg-subtle)" />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the palette exists to take focus */}
          <input
            autoFocus
            className="palette-input"
            placeholder="Search threads, actions and settings"
            value={query}
            aria-label="Search commands"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlight((current) => (results.length === 0 ? 0 : (current + 1) % results.length));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlight((current) =>
                  results.length === 0 ? 0 : (current - 1 + results.length) % results.length
                );
              } else if (event.key === 'Enter') {
                event.preventDefault();
                commit(highlight);
              }
            }}
          />
          <kbd className="kbd">esc</kbd>
        </div>

        <div className="palette-list" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <p
              style={{
                padding: '26px 12px',
                textAlign: 'center',
                color: 'var(--fg-subtle)',
                fontSize: 'var(--text-sm)',
              }}
            >
              No matches for “{query}”
            </p>
          ) : (
            results.map((action, index) => {
              const showGroup = action.group !== lastGroup;
              lastGroup = action.group;
              return (
                <div key={action.id}>
                  {showGroup ? <div className="menu-label">{action.group}</div> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    className="palette-item"
                    data-highlighted={index === highlight ? 'true' : undefined}
                    onPointerEnter={() => setHighlight(index)}
                    onClick={() => commit(index)}
                  >
                    <Icon name={action.icon} size={15} />
                    <span className="palette-item-text">
                      <span className="palette-item-label">{action.label}</span>
                      {action.detail ? (
                        <span className="palette-item-detail">{action.detail}</span>
                      ) : null}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="palette-foot">
          <span className="palette-foot-hint">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> navigate
          </span>
          <span className="palette-foot-hint">
            <kbd className="kbd">↵</kbd> open
          </span>
          <span className="palette-foot-hint">
            <kbd className="kbd">esc</kbd> dismiss
          </span>
        </div>
      </div>
    </Overlay>
  );
}
