import { useCallback, useEffect, useState } from 'react';
import { DiffView, Icon } from '@echoai/design';
import type { DesktopArtifactEntry, DesktopGitFileChange, LogSearchEntry } from '@shared/ipc';
import { Button, EmptyState, IconButton, Input, SearchField, Tabs, Tooltip } from '../ui';
import { formatBytes, formatRelative } from '../lib/format';
import type { Resizable } from '../lib/hooks';
import type { WorkspaceFilesApi } from '../state/useWorkspaceFiles';
import type { TerminalApi } from '../state/useTerminal';
import type { GitApi } from '../state/useGit';

export const PANEL_TABS = ['files', 'changes', 'terminal', 'artifacts', 'logs'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

const TAB_OPTIONS: Array<{ value: PanelTab; label: string; icon: 'folder' | 'diff' | 'terminal' | 'layers' | 'activity' }> = [
  { value: 'files', label: 'Files', icon: 'folder' },
  { value: 'changes', label: 'Changes', icon: 'diff' },
  { value: 'terminal', label: 'Terminal', icon: 'terminal' },
  { value: 'artifacts', label: 'Artifacts', icon: 'layers' },
  { value: 'logs', label: 'Logs', icon: 'activity' },
];

/**
 * Contextual side panel.
 *
 * Absorbs the Files / Trace / Terminal / Artifacts / Canvas pages that used to
 * be top-level navigation. They belong beside the conversation, not instead of
 * it, and they are hidden by default so the app opens on one clear surface.
 */
export function RightPanel({
  tab,
  onTabChange,
  onClose,
  resizable,
  workspacePath,
  files,
  terminal,
  git,
  onOpenExternal,
}: {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
  resizable: Resizable;
  workspacePath: string | null;
  files: WorkspaceFilesApi;
  terminal: TerminalApi;
  git: GitApi;
  onOpenExternal: (path: string) => void;
}) {
  return (
    <aside className="panel" style={{ width: resizable.width }} aria-label="Workspace panel">
      <div
        className="resize-handle"
        data-edge="left"
        data-dragging={resizable.dragging ? 'true' : undefined}
        onPointerDown={resizable.onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
      />

      <div className="panel-head drag-region">
        <div className="panel-tabs no-drag">
          <Tabs value={tab} options={TAB_OPTIONS} onChange={onTabChange} />
        </div>
        <Tooltip content="Hide panel" shortcut="⌘J">
          <IconButton icon="x" label="Hide panel" size="sm" onClick={onClose} />
        </Tooltip>
      </div>

      <div className="panel-body">
        {!workspacePath && tab !== 'logs' ? (
          <EmptyState
            icon="folder-open"
            title="No workspace open"
            description="Open a folder to browse files, run commands and review changes."
          />
        ) : tab === 'files' ? (
          <FilesTab files={files} />
        ) : tab === 'changes' ? (
          <ChangesTab git={git} />
        ) : tab === 'terminal' ? (
          <TerminalTab terminal={terminal} />
        ) : tab === 'artifacts' ? (
          <ArtifactsTab artifacts={files.artifacts} onOpen={onOpenExternal} />
        ) : (
          <LogsTab />
        )}
      </div>
    </aside>
  );
}

/* -------------------------------- Files -------------------------------- */

function FilesTab({ files }: { files: WorkspaceFilesApi }) {
  const [query, setQuery] = useState('');

  return (
    <div className="panel-split">
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
        <div className="panel-toolbar">
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder="Search files"
            onSubmit={() => void files.search(query)}
          />
          <Tooltip content="Refresh">
            <IconButton icon="refresh" label="Refresh" size="sm" onClick={() => void files.refresh()} />
          </Tooltip>
        </div>

        <div className="panel-scroll">
          {files.searchResults.length > 0 ? (
            <>
              <div className="group-label" style={{ marginBottom: 6 }}>
                {files.searchResults.length} matches
              </div>
              <div className="tree">
                {files.searchResults.slice(0, 60).map((result) => (
                  <button
                    key={`${result.path}-${result.line ?? 0}`}
                    type="button"
                    className="tree-item"
                    data-active={result.path === files.previewPath ? 'true' : undefined}
                    onClick={() => void files.open(result.path)}
                    title={result.preview}
                  >
                    <Icon name="file-text" size={13} />
                    <span className="tree-item-name">{result.path}</span>
                    {result.line !== null ? (
                      <span className="tree-item-size">:{result.line}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : files.entries.length === 0 ? (
            <EmptyState icon="folder" title="Empty folder" />
          ) : (
            <div className="tree">
              {files.entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className="tree-item"
                  data-kind={entry.kind}
                  data-active={entry.path === files.previewPath ? 'true' : undefined}
                  disabled={entry.kind === 'directory'}
                  onClick={() => void files.open(entry.path)}
                >
                  <Icon name={entry.kind === 'directory' ? 'folder' : 'file'} size={13} />
                  <span className="tree-item-name">{entry.name}</span>
                  {entry.kind === 'file' ? (
                    <span className="tree-item-size">{formatBytes(entry.size)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
        {files.preview ? (
          <>
            <div className="preview-head">
              <Icon name="file-text" size={13} />
              <span className="preview-name" title={files.preview.path}>
                {files.preview.name}
              </span>
              <span className="tree-item-size">{formatBytes(files.preview.size)}</span>
              <IconButton icon="x" label="Close preview" size="sm" onClick={files.clearPreview} />
            </div>
            <div className="panel-scroll" style={{ padding: 0 }}>
              {files.preview.content !== null ? (
                <pre className="preview-code">{files.preview.content}</pre>
              ) : (
                <EmptyState
                  icon="file"
                  title={`${files.preview.kind} file`}
                  description="Preview is not available for this file type."
                />
              )}
            </div>
          </>
        ) : (
          <EmptyState icon="file-text" title="No file selected" description="Pick a file to preview it." />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Changes ------------------------------- */

/**
 * Working-tree review: changed files, their diff, and a commit box.
 *
 * Backed by the dedicated git service rather than by shelling out through the
 * terminal, so untracked files show up as real diffs and staging is atomic.
 */
function ChangesTab({ git }: { git: GitApi }) {
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  // Load the full diff on open, and again whenever the change set moves.
  useEffect(() => {
    void git.loadDiff(selected ? { path: selected } : undefined);
  }, [git.loadDiff, selected, git.changes.length]);

  if (!git.status?.isRepository) {
    return (
      <EmptyState
        icon="branch"
        title="Not a git repository"
        description="Open a folder tracked by git to review and commit changes here."
      />
    );
  }

  const staged = git.changes.filter((change) => change.staged);
  const unstaged = git.changes.filter((change) => !change.staged);

  return (
    <div className="panel-split">
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', minHeight: 0 }}>
        <div className="panel-toolbar">
          <span className="chip" data-plain="true">
            <Icon name="branch" size={11} />
            <span>{git.status.detached ? 'detached' : (git.status.branch ?? 'no branch')}</span>
          </span>
          {selected ? (
            <Button size="sm" variant="ghost" icon="x" onClick={() => setSelected(null)}>
              All files
            </Button>
          ) : null}
          <div style={{ flex: 1 }} />
          <Tooltip content="Refresh">
            <IconButton icon="refresh" label="Refresh git" size="sm" onClick={() => void git.refresh()} />
          </Tooltip>
        </div>

        <div className="panel-scroll">
          {git.changes.length === 0 ? (
            <EmptyState icon="circle-check" title="No changes" description="The working tree is clean." />
          ) : (
            <>
              {staged.length > 0 ? (
                <ChangeGroup
                  label={`Staged (${staged.length})`}
                  changes={staged}
                  selected={selected}
                  actionIcon="minus"
                  actionLabel="Unstage"
                  onSelect={setSelected}
                  onAction={(path) => void git.unstage([path])}
                />
              ) : null}
              {unstaged.length > 0 ? (
                <ChangeGroup
                  label={`Changes (${unstaged.length})`}
                  changes={unstaged}
                  selected={selected}
                  actionIcon="plus"
                  actionLabel="Stage"
                  onSelect={setSelected}
                  onAction={(path) => void git.stage([path])}
                />
              ) : null}
            </>
          )}
        </div>

        {git.changes.length > 0 ? (
          <div className="panel-toolbar" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            <Input
              value={message}
              placeholder="Commit message"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && message.trim()) {
                  void git.commit(message.trim(), staged.length === 0).then((ok) => {
                    if (ok) {
                      setMessage('');
                    }
                  });
                }
              }}
              aria-label="Commit message"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!message.trim()}
              onClick={() => {
                void git.commit(message.trim(), staged.length === 0).then((ok) => {
                  if (ok) {
                    setMessage('');
                  }
                });
              }}
            >
              {staged.length > 0 ? `Commit ${staged.length}` : 'Commit all'}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="panel-scroll" style={{ padding: 0 }}>
        {git.loadingDiff && !git.diff ? (
          <div style={{ display: 'grid', gap: 8, padding: 12 }}>
            <span className="skeleton" style={{ width: '70%' }} />
            <span className="skeleton" style={{ width: '90%' }} />
            <span className="skeleton" style={{ width: '55%' }} />
          </div>
        ) : git.diff ? (
          <DiffView unified={git.diff} fileName={selected ?? 'working tree'} />
        ) : (
          <EmptyState icon="diff" title="No diff to show" />
        )}
      </div>
    </div>
  );
}

function ChangeGroup({
  label,
  changes,
  selected,
  actionIcon,
  actionLabel,
  onSelect,
  onAction,
}: {
  label: string;
  changes: DesktopGitFileChange[];
  selected: string | null;
  actionIcon: 'plus' | 'minus';
  actionLabel: string;
  onSelect: (path: string) => void;
  onAction: (path: string) => void;
}) {
  return (
    <>
      <div className="group-label" style={{ margin: '4px 2px 6px' }}>
        {label}
      </div>
      <div className="tree" style={{ marginBottom: 8 }}>
        {changes.map((change) => (
          <div className="term-task" key={`${change.path}-${String(change.staged)}`}>
            <button
              type="button"
              style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}
              data-active={change.path === selected ? 'true' : undefined}
              onClick={() => onSelect(change.path)}
              title={change.path}
            >
              <span className="dot" data-tone={CHANGE_TONE[change.status]} />
              <span className="term-task-cmd">{change.path}</span>
              <span className="diff-stat">
                {change.insertions > 0 ? (
                  <span className="diff-stat-add">+{change.insertions}</span>
                ) : null}
                {change.deletions > 0 ? (
                  <span className="diff-stat-del">-{change.deletions}</span>
                ) : null}
              </span>
            </button>
            <IconButton
              icon={actionIcon}
              label={`${actionLabel} ${change.path}`}
              size="sm"
              onClick={() => onAction(change.path)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

const CHANGE_TONE: Record<DesktopGitFileChange['status'], 'success' | 'warning' | 'danger' | 'info'> = {
  added: 'success',
  untracked: 'success',
  modified: 'warning',
  renamed: 'info',
  deleted: 'danger',
};

/* ------------------------------- Terminal ------------------------------- */

function TerminalTab({ terminal }: { terminal: TerminalApi }) {
  const [command, setCommand] = useState('');

  const submit = () => {
    const value = command.trim();
    if (!value) {
      return;
    }
    void terminal.run(value);
    setCommand('');
  };

  return (
    <div className="panel-split">
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
        <div className="panel-toolbar">
          <Input
            value={command}
            placeholder="npm test, git status, pnpm build"
            className="mono"
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                submit();
              }
            }}
            aria-label="Command"
          />
          <Button variant="primary" size="sm" onClick={submit} disabled={!command.trim()}>
            Run
          </Button>
        </div>

        <div className="panel-scroll">
          {terminal.tasks.length === 0 ? (
            <EmptyState icon="terminal" title="No commands yet" />
          ) : (
            <div className="tree">
              {terminal.tasks.map((task) => (
                <div key={task.id} className="term-task" data-active={task.id === terminal.activeTaskId ? 'true' : undefined}>
                  <button
                    type="button"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}
                    onClick={() => void terminal.select(task.id)}
                  >
                    <StatusGlyph status={task.status} />
                    <span className="term-task-cmd">{task.command}</span>
                  </button>
                  {task.status === 'running' ? (
                    <IconButton
                      icon="stop"
                      label="Stop task"
                      size="sm"
                      tone="danger"
                      onClick={() => void terminal.stop(task.id)}
                    />
                  ) : (
                    <span className="tree-item-size">
                      {task.exitCode === null ? '' : `exit ${task.exitCode}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel-scroll" style={{ padding: 0 }}>
        {terminal.log ? (
          <pre className="term-log">{terminal.log}</pre>
        ) : (
          <EmptyState icon="terminal" title="No output" description="Select a command to see its log." />
        )}
      </div>
    </div>
  );
}

function StatusGlyph({ status }: { status: string }) {
  const tone =
    status === 'running'
      ? 'info'
      : status === 'completed'
        ? 'success'
        : status === 'denied'
          ? 'warning'
          : status === 'failed'
            ? 'danger'
            : 'neutral';
  return <span className="dot" data-tone={tone === 'neutral' ? undefined : tone} data-pulse={status === 'running' ? 'true' : undefined} />;
}

/* ------------------------------ Artifacts ------------------------------ */

function ArtifactsTab({
  artifacts,
  onOpen,
}: {
  artifacts: DesktopArtifactEntry[];
  onOpen: (path: string) => void;
}) {
  if (artifacts.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No artifacts yet"
        description="Files the agent generates will collect here."
      />
    );
  }

  return (
    <div className="panel-scroll">
      <div className="tree">
        {artifacts.map((artifact) => (
          <div key={artifact.path} className="term-task">
            <button
              type="button"
              style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}
              onClick={() => onOpen(artifact.path)}
            >
              <Icon name={artifact.type === 'diff' ? 'diff' : 'file'} size={13} />
              <span className="tree-item-name">{artifact.name}</span>
              <span className="tree-item-size">{formatBytes(artifact.size)}</span>
            </button>
            <span className="tree-item-size">{formatRelative(artifact.modifiedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Logs --------------------------------- */

function LogsTab() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<LogSearchEntry[]>([]);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (value: string) => {
    try {
      setEntries(await window.echoaiDesktop.searchLogs(value));
    } catch {
      setEntries([]);
    } finally {
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    void search('');
  }, [search]);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
      <div className="panel-toolbar">
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Search logs"
          onSubmit={() => void search(query)}
        />
        <Tooltip content="Refresh">
          <IconButton icon="refresh" label="Refresh logs" size="sm" onClick={() => void search(query)} />
        </Tooltip>
      </div>
      <div className="panel-scroll">
        {entries.length === 0 ? (
          <EmptyState
            icon="activity"
            title={searched ? 'No matching entries' : 'Loading logs'}
            description={searched ? 'Try a different search term.' : undefined}
          />
        ) : (
          entries.slice(0, 200).map((entry) => (
            <div className="log-row" key={`${entry.file}-${entry.line}`}>
              <span className="log-level" data-level={entry.level}>
                {entry.level}
              </span>
              <span className="log-msg">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
