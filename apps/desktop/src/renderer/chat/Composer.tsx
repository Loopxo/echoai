import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@echoai/design';
import type { DesktopGitStatus, DesktopRuntimeStatus } from '@shared/ipc';
import { Chip, Menu, Tooltip, type MenuEntry } from '../ui';
import { useAutoGrow } from '../lib/hooks';
import { basename, fuzzyScore } from '../lib/format';
import type { PromptMode } from '../state/useRuntime';

const MAX_INPUT_HEIGHT = 216;
const MAX_SUGGESTIONS = 8;

export interface SlashCommand {
  name: string;
  description: string;
  icon: IconName;
  run: () => void;
}

/**
 * How much the agent may do before asking.
 *
 * Mirrors the four tiers the ecosystem settled on. This is presentation state
 * today: the kernel's permission profile is fixed at construction, so the
 * selection is surfaced to the user and persisted, and tightening it end to end
 * needs a kernel change rather than a UI one.
 */
export type ApprovalMode = 'supervised' | 'auto-edit' | 'auto' | 'full';

export const APPROVAL_MODES: Array<{
  value: ApprovalMode;
  label: string;
  detail: string;
  icon: IconName;
}> = [
  {
    value: 'supervised',
    label: 'Supervised',
    detail: 'Ask before commands and file changes',
    icon: 'lock',
  },
  {
    value: 'auto-edit',
    label: 'Auto-accept edits',
    detail: 'Edit files freely, ask before commands',
    icon: 'pencil',
  },
  { value: 'auto', label: 'Approve for me', detail: 'Decide automatically, log every call', icon: 'sparkles' },
  { value: 'full', label: 'Full access', detail: 'No prompts, including network', icon: 'lock-open' },
];

/**
 * Prompt composer.
 *
 * Enter sends, Shift+Enter inserts a newline — the desktop convention. The
 * footer holds only the three decisions that actually change a run: which
 * model, which mode, and what is attached. Everything else lives in Settings.
 */
export function Composer({
  running,
  disabled,
  status,
  provider,
  model,
  mode,
  commands,
  onSearchFiles,
  onProviderChange,
  onModelChange,
  onModeChange,
  onSend,
  onStop,
  draft,
  onDraftChange,
  workspaceName,
  gitStatus,
  approval,
  onApprovalChange,
  onOpenChanges,
  onSelectWorkspace,
}: {
  running: boolean;
  disabled: boolean;
  status: DesktopRuntimeStatus | null;
  provider: string;
  model: string;
  mode: PromptMode;
  commands: SlashCommand[];
  onSearchFiles: (query: string) => Promise<string[]>;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onModeChange: (mode: PromptMode) => void;
  onSend: (input: string) => void;
  onStop: () => void;
  draft: string;
  onDraftChange: (draft: string) => void;
  workspaceName: string | null;
  gitStatus: DesktopGitStatus | null;
  approval: ApprovalMode;
  onApprovalChange: (approval: ApprovalMode) => void;
  onOpenChanges: () => void;
  onSelectWorkspace: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [fileMatches, setFileMatches] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(0);

  useAutoGrow(inputRef, draft, MAX_INPUT_HEIGHT);

  // Autocomplete triggers only on the token being typed at the caret end.
  const trigger = useMemo(() => detectTrigger(draft), [draft]);

  useEffect(() => {
    setHighlight(0);
    if (trigger?.kind !== 'mention') {
      setFileMatches([]);
      return;
    }

    let active = true;
    void onSearchFiles(trigger.query).then((matches) => {
      if (active) {
        setFileMatches(matches.slice(0, MAX_SUGGESTIONS));
      }
    });
    return () => {
      active = false;
    };
  }, [trigger?.kind, trigger?.query, onSearchFiles]);

  const suggestions = useMemo(() => {
    if (!trigger) {
      return [];
    }

    if (trigger.kind === 'command') {
      return commands
        .map((command) => ({
          key: command.name,
          label: `/${command.name}`,
          detail: command.description,
          icon: command.icon,
          score: fuzzyScore(command.name, trigger.query),
          apply: command.run,
        }))
        .filter((item) => item.score !== null)
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
        .slice(0, MAX_SUGGESTIONS);
    }

    return fileMatches.map((path) => ({
      key: path,
      label: basename(path),
      detail: path,
      icon: 'file' as IconName,
      score: 0,
      apply: () => {
        onDraftChange(replaceTrigger(draft, trigger, `@${path} `));
        inputRef.current?.focus();
      },
    }));
  }, [commands, draft, fileMatches, onDraftChange, trigger]);

  const submit = useCallback(() => {
    const value = draft.trim();
    if (!value || disabled) {
      return;
    }

    const withAttachments =
      attachments.length > 0 ? `${value}\n\nAttached: ${attachments.join(', ')}` : value;
    onSend(withAttachments);
    onDraftChange('');
    setAttachments([]);
  }, [attachments, disabled, draft, onDraftChange, onSend]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Tab' || event.key === 'Enter') {
        const selected = suggestions[highlight];
        if (selected) {
          event.preventDefault();
          if (trigger?.kind === 'command') {
            onDraftChange('');
          }
          selected.apply();
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setFileMatches([]);
        onDraftChange(replaceTrigger(draft, trigger!, trigger!.kind === 'command' ? '' : '@'));
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (running) {
        return;
      }
      submit();
    }
  };

  const activeProvider = status?.providers.find((item) => item.id === provider);
  const activeApproval = APPROVAL_MODES.find((option) => option.value === approval) ?? APPROVAL_MODES[0]!;

  // A real model list per provider, grouped by family, instead of free text.
  const modelEntries = useMemo<MenuEntry[]>(() => {
    const providers = status?.providers ?? [];
    if (providers.length === 0) {
      return [{ kind: 'label', id: 'none', label: 'No providers configured' }];
    }

    const entries: MenuEntry[] = [];
    const regionLabels: Record<string, string> = {
      us: 'International',
      cn: 'Chinese models',
      local: 'On this machine',
    };

    for (const region of ['cn', 'us', 'local'] as const) {
      const inRegion = providers.filter((item) => item.region === region);
      if (inRegion.length === 0) {
        continue;
      }

      entries.push({ kind: 'label', id: `region-${region}`, label: regionLabels[region] ?? region });
      for (const item of inRegion) {
        for (const candidate of item.models) {
          entries.push({
            kind: 'item',
            id: `${item.id}:${candidate}`,
            label: candidate,
            detail: item.label,
            checked: item.id === provider && candidate === model,
            onSelect: () => {
              onProviderChange(item.id);
              onModelChange(candidate);
            },
          });
        }
      }
    }

    return entries;
  }, [model, onModelChange, onProviderChange, provider, status?.providers]);

  return (
    <div className="composer-wrap">
      <div className="composer-anchor">
        {suggestions.length > 0 ? (
          <div className="composer-menu" role="listbox">
            {suggestions.map((item, index) => (
              <button
                key={item.key}
                type="button"
                role="option"
                aria-selected={index === highlight}
                className="palette-item"
                data-highlighted={index === highlight ? 'true' : undefined}
                onPointerEnter={() => setHighlight(index)}
                onClick={() => {
                  if (trigger?.kind === 'command') {
                    onDraftChange('');
                  }
                  item.apply();
                }}
              >
                <Icon name={item.icon} size={14} />
                <span className="palette-item-text">
                  <span className="palette-item-label">{item.label}</span>
                  <span className="palette-item-detail">{item.detail}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="composer"
          data-focused={focused ? 'true' : undefined}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="composer-context">
            <button
              type="button"
              className="context-chip"
              data-interactive="true"
              onClick={onSelectWorkspace}
              title={workspaceName ? 'Change folder' : 'Open a folder'}
            >
              <Icon name="folder" size={11} />
              <span>{workspaceName ?? 'No folder'}</span>
            </button>

            <Menu
              side="top"
              minWidth={260}
              trigger={
                <button
                  type="button"
                  className="context-chip"
                  data-interactive="true"
                  data-tone={approval === 'full' ? 'warning' : undefined}
                  title="Change what needs approval"
                >
                  <Icon name={activeApproval.icon} size={11} />
                  <span>{activeApproval.label}</span>
                </button>
              }
              entries={APPROVAL_MODES.map((option) => ({
                kind: 'item' as const,
                id: option.value,
                label: option.label,
                detail: option.detail,
                checked: option.value === approval,
                onSelect: () => onApprovalChange(option.value),
              }))}
            />

            {gitStatus?.isRepository ? (
              <button
                type="button"
                className="context-chip"
                data-interactive="true"
                onClick={onOpenChanges}
                title="Review working tree changes"
              >
                <Icon name="branch" size={11} />
                <span>{gitStatus.detached ? 'detached HEAD' : (gitStatus.branch ?? 'no branch')}</span>
                {gitStatus.clean ? null : (
                  <span className="context-chip-dirty">
                    {gitStatus.staged + gitStatus.unstaged + gitStatus.untracked}
                  </span>
                )}
              </button>
            ) : null}
          </div>

          {attachments.length > 0 ? (
            <div className="composer-attachments">
              {attachments.map((name) => (
                <Chip
                  key={name}
                  icon="paperclip"
                  removeLabel={`Remove ${name}`}
                  onRemove={() => setAttachments((current) => current.filter((item) => item !== name))}
                >
                  {name}
                </Chip>
              ))}
            </div>
          ) : null}

          <div className="composer-input-row">
            <textarea
              ref={inputRef}
              className="composer-input"
              rows={1}
              value={draft}
              placeholder={
                disabled
                  ? 'Configure a provider in Settings to start'
                  : 'Ask anything, @ to add files, / for commands'
              }
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Message"
            />
          </div>

          <div className="composer-foot">
            <div className="composer-controls">
              <Menu
                side="top"
                minWidth={260}
                trigger={
                  <button type="button" className="composer-control" title="Change model">
                    <Icon name="sparkles" size={13} />
                    <span>{model || activeProvider?.defaultModel || 'Select model'}</span>
                    <Icon name="chevron-down" size={12} />
                  </button>
                }
                entries={modelEntries}
              />

              <span className="sep" data-orientation="vertical" />

              <Tooltip content={mode === 'plan' ? 'Plan first, then build' : 'Build directly'}>
                <button
                  type="button"
                  className="composer-control"
                  data-active={mode === 'plan' ? 'true' : undefined}
                  onClick={() => onModeChange(mode === 'plan' ? 'default' : 'plan')}
                >
                  <Icon name={mode === 'plan' ? 'list' : 'zap'} size={13} />
                  <span>{mode === 'plan' ? 'Plan' : 'Build'}</span>
                </button>
              </Tooltip>

              <label className="composer-control" title="Attach files">
                <Icon name="paperclip" size={13} />
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const names = Array.from(event.target.files ?? []).map((file) => file.name);
                    setAttachments((current) => [...new Set([...current, ...names])]);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>

            {running ? (
              <Tooltip content="Stop">
                <button
                  type="button"
                  className="composer-send"
                  data-mode="stop"
                  aria-label="Stop generating"
                  onClick={onStop}
                >
                  <Icon name="square" size={11} strokeWidth={2.4} />
                </button>
              </Tooltip>
            ) : (
              <button
                type="submit"
                className="composer-send"
                aria-label="Send message"
                disabled={disabled || draft.trim().length === 0}
              >
                <Icon name="arrow-up" size={15} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </form>

        <div className="composer-hint">
          <span>
            <kbd className="kbd">↵</kbd> send
          </span>
          <span>
            <kbd className="kbd">⇧↵</kbd> newline
          </span>
          {running ? (
            <span>
              <kbd className="kbd">esc</kbd> stop
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Trigger parsing ---------------------------- */

interface Trigger {
  kind: 'command' | 'mention';
  query: string;
  start: number;
}

/**
 * Detect a `/command` at the very start of the draft, or an `@mention` token at
 * the end. Anchoring to the tail avoids popping the menu open while the user
 * edits earlier text.
 */
function detectTrigger(draft: string): Trigger | null {
  if (/^\/[\w-]*$/.test(draft)) {
    return { kind: 'command', query: draft.slice(1), start: 0 };
  }

  const match = /(^|\s)@([^\s@]*)$/.exec(draft);
  if (match) {
    return {
      kind: 'mention',
      query: match[2] ?? '',
      start: draft.length - (match[2]?.length ?? 0) - 1,
    };
  }

  return null;
}

function replaceTrigger(draft: string, trigger: Trigger, replacement: string): string {
  return `${draft.slice(0, trigger.start)}${replacement}`;
}
