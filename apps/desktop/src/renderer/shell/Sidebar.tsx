import { useMemo, useState } from 'react';
import { Icon } from '@echoai/design';
import type {
  DesktopAccountStatus,
  DesktopRecentWorkspace,
  DesktopRuntimeSessionSummary,
} from '@shared/ipc';
import { Avatar, IconButton, Menu, Tooltip, type MenuEntry } from '../ui';
import { EchoLogo } from '../ui/EchoLogo';
import { basename, formatRelative, groupByDate } from '../lib/format';
import { threadTitle } from '../state/useRuntime';
import type { Resizable } from '../lib/hooks';

/** Threads shown per project before the "Show more" affordance appears. */
const THREAD_PREVIEW_COUNT = 6;

export interface SidebarProject {
  path: string;
  name: string;
  lastActiveAt: string;
  threads: DesktopRuntimeSessionSummary[];
}

/**
 * Thread sidebar.
 *
 * Structured the way the current generation of agent clients converged on: the
 * agent identity on top, a short nav block, pinned work, then projects with
 * their threads nested underneath, and the account at the foot. It replaced a
 * flat 19-item page switcher.
 */
export function Sidebar({
  sessions,
  projects,
  activeSessionId,
  activeProjectPath,
  pinnedIds,
  account,
  usageLabel,
  resizable,
  onNewThread,
  onOpenThread,
  onOpenPalette,
  onTogglePin,
  onSelectWorkspace,
  onOpenWorkspace,
  onOpenSettings,
  onOpenPanel,
  onCollapse,
  onSignIn,
  onSignOut,
}: {
  sessions: DesktopRuntimeSessionSummary[];
  projects: SidebarProject[];
  activeSessionId: string | null;
  activeProjectPath: string | null;
  pinnedIds: string[];
  account: DesktopAccountStatus | null;
  usageLabel: string | null;
  resizable: Resizable;
  onNewThread: () => void;
  onOpenThread: (sessionId: string) => void;
  onOpenPalette: () => void;
  onTogglePin: (sessionId: string) => void;
  onSelectWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onOpenSettings: (section?: 'general' | 'tools' | 'automations') => void;
  onOpenPanel: (tab: 'changes' | 'terminal') => void;
  onCollapse: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const [collapsedProjects, setCollapsedProjects] = useState<string[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);

  const pinned = useMemo(
    () => sessions.filter((session) => pinnedIds.includes(session.id)),
    [pinnedIds, sessions]
  );

  // Threads not attached to any known project still need a home, otherwise a
  // session started before a folder was opened would silently disappear.
  const unassigned = useMemo(() => {
    const claimed = new Set(projects.flatMap((project) => project.threads.map((t) => t.id)));
    return sessions.filter((session) => !claimed.has(session.id));
  }, [projects, sessions]);

  const accountEntries = useMemo<MenuEntry[]>(() => {
    const entries: MenuEntry[] = [];

    if (usageLabel) {
      entries.push({ kind: 'label', id: 'usage', label: usageLabel });
      entries.push({ kind: 'separator', id: 'sep-usage' });
    }

    entries.push({
      kind: 'item',
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      detail: '⌘,',
      onSelect: () => onOpenSettings(),
    });

    if (account?.signedIn) {
      entries.push({ kind: 'separator', id: 'sep-account' });
      entries.push({
        kind: 'item',
        id: 'signout',
        label: 'Sign out',
        icon: 'log-out',
        tone: 'danger',
        onSelect: onSignOut,
      });
    } else {
      entries.push({
        kind: 'item',
        id: 'signin',
        label: 'Sign in',
        icon: 'key',
        onSelect: onSignIn,
      });
    }

    return entries;
  }, [account?.signedIn, onOpenSettings, onSignIn, onSignOut, usageLabel]);

  const renderThread = (session: DesktopRuntimeSessionSummary) => {
    const isPinned = pinnedIds.includes(session.id);
    return (
      <div className="thread-item-wrap" key={session.id}>
        <button
          type="button"
          className="thread-item"
          data-active={session.id === activeSessionId ? 'true' : undefined}
          onClick={() => onOpenThread(session.id)}
        >
          <span className="thread-item-title">{threadTitle(session)}</span>
          <span className="thread-item-meta tabular">{formatRelative(session.updatedAt)}</span>
        </button>
        <span className="thread-item-actions">
          <IconButton
            icon="pin"
            label={isPinned ? 'Unpin thread' : 'Pin thread'}
            size="sm"
            iconSize={12}
            active={isPinned}
            onClick={() => onTogglePin(session.id)}
          />
        </span>
      </div>
    );
  };

  return (
    <aside className="sidebar" aria-label="Threads and projects">
      <div className="sidebar-head drag-region">
        <Menu
          minWidth={230}
          trigger={
            <button type="button" className="agent-switcher" title="EchoAI Agent">
              <EchoLogo size={18} />
              <span className="agent-switcher-name">EchoAI</span>
              <Icon name="chevron-down" size={13} />
            </button>
          }
          entries={[
            { kind: 'label', id: 'harness', label: 'Agent harness' },
            {
              kind: 'item',
              id: 'internal',
              label: 'EchoAI harness',
              detail: 'built in',
              checked: true,
              onSelect: () => undefined,
            },
            { kind: 'separator', id: 'sep' },
            {
              kind: 'item',
              id: 'models',
              label: 'Models and providers',
              icon: 'sparkles',
              onSelect: () => onOpenSettings('general'),
            },
            {
              kind: 'item',
              id: 'tools',
              label: 'Tools and MCP servers',
              icon: 'plug',
              onSelect: () => onOpenSettings('tools'),
            },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Tooltip content="Search" shortcut="⌘K">
          <IconButton icon="search" label="Search" size="sm" onClick={onOpenPalette} />
        </Tooltip>
        <Tooltip content="Hide sidebar" shortcut="⌘B">
          <IconButton icon="panel-left" label="Hide sidebar" size="sm" onClick={onCollapse} />
        </Tooltip>
      </div>

      <div className="sidebar-nav">
        <button type="button" className="sidebar-nav-item" onClick={onNewThread}>
          <Icon name="square-pen" size={14} />
          <span className="sidebar-nav-label">New thread</span>
          <kbd className="kbd">⌘N</kbd>
        </button>
        <button type="button" className="sidebar-nav-item" onClick={() => onOpenPanel('changes')}>
          <Icon name="diff" size={14} />
          <span className="sidebar-nav-label">Changes</span>
        </button>
        <button type="button" className="sidebar-nav-item" onClick={() => onOpenPanel('terminal')}>
          <Icon name="terminal" size={14} />
          <span className="sidebar-nav-label">Terminal</span>
        </button>
        <button
          type="button"
          className="sidebar-nav-item"
          onClick={() => onOpenSettings('automations')}
        >
          <Icon name="calendar" size={14} />
          <span className="sidebar-nav-label">Automations</span>
        </button>
      </div>

      <div className="sidebar-scroll">
        {pinned.length > 0 ? (
          <div className="sidebar-section">
            <div className="sidebar-section-head">
              <span className="sidebar-section-label">Pinned</span>
            </div>
            <div className="thread-list">{pinned.map(renderThread)}</div>
          </div>
        ) : null}

        <div className="sidebar-section">
          <div className="sidebar-section-head">
            <span className="sidebar-section-label">Projects</span>
            <span className="sidebar-section-actions">
              <Tooltip content="Open a folder">
                <IconButton
                  icon="plus"
                  label="Add project"
                  size="sm"
                  iconSize={13}
                  onClick={onSelectWorkspace}
                />
              </Tooltip>
            </span>
          </div>

          {projects.length === 0 ? (
            <button
              type="button"
              className="sidebar-more"
              style={{ width: '100%' }}
              onClick={onSelectWorkspace}
            >
              <Icon name="folder-open" size={13} />
              Open a folder to start
            </button>
          ) : (
            projects.map((project) => {
              const isOpen = !collapsedProjects.includes(project.path);
              const isExpanded = expandedProjects.includes(project.path);
              const visible = isExpanded
                ? project.threads
                : project.threads.slice(0, THREAD_PREVIEW_COUNT);
              const hidden = project.threads.length - visible.length;

              return (
                <div key={project.path}>
                  <button
                    type="button"
                    className="project-row"
                    data-open={isOpen ? 'true' : undefined}
                    data-active={project.path === activeProjectPath ? 'true' : undefined}
                    onClick={() => {
                      setCollapsedProjects((current) =>
                        current.includes(project.path)
                          ? current.filter((path) => path !== project.path)
                          : [...current, project.path]
                      );
                      if (project.path !== activeProjectPath) {
                        onOpenWorkspace(project.path);
                      }
                    }}
                    title={project.path}
                  >
                    <Icon name="chevron-right" size={12} className="project-chevron" />
                    <Icon name="folder" size={13} />
                    <span className="project-name">{project.name}</span>
                    {project.threads.length > 0 ? (
                      <span className="sidebar-nav-count">{project.threads.length}</span>
                    ) : null}
                  </button>

                  {isOpen ? (
                    <div className="project-threads">
                      {project.threads.length === 0 ? (
                        <span
                          style={{
                            display: 'block',
                            padding: '4px 8px 6px',
                            color: 'var(--fg-faint)',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          No threads yet
                        </span>
                      ) : (
                        <>
                          {visible.map(renderThread)}
                          {hidden > 0 ? (
                            <button
                              type="button"
                              className="sidebar-more"
                              onClick={() =>
                                setExpandedProjects((current) => [...current, project.path])
                              }
                            >
                              Show {hidden} more
                            </button>
                          ) : null}
                          {isExpanded && project.threads.length > THREAD_PREVIEW_COUNT ? (
                            <button
                              type="button"
                              className="sidebar-more"
                              onClick={() =>
                                setExpandedProjects((current) =>
                                  current.filter((path) => path !== project.path)
                                )
                              }
                            >
                              Show less
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {unassigned.length > 0 ? (
          <div className="sidebar-section">
            <div className="sidebar-section-head">
              <span className="sidebar-section-label">Other threads</span>
            </div>
            {groupByDate(unassigned, (session) => session.updatedAt).map((group) => (
              <div className="thread-group" key={group.label}>
                <div className="thread-group-label">{group.label}</div>
                <div className="thread-list">{group.items.map(renderThread)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="sidebar-foot">
        <Menu
          minWidth={230}
          side="top"
          trigger={
            <button type="button" className="sidebar-user">
              {account?.signedIn ? (
                <Avatar label={account.email ?? 'EchoAI'} />
              ) : (
                <span className="avatar" aria-hidden>
                  <Icon name="user" size={13} />
                </span>
              )}
              <span className="sidebar-user-name">
                {account?.signedIn ? (account.email ?? 'Signed in') : 'Local mode'}
              </span>
              <Icon name="chevron-up" size={13} color="var(--fg-subtle)" />
            </button>
          }
          entries={accountEntries}
        />
      </div>

      <div
        className="resize-handle"
        data-edge="right"
        data-dragging={resizable.dragging ? 'true' : undefined}
        onPointerDown={resizable.onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />
    </aside>
  );
}

/**
 * Group threads under the workspace they ran in.
 *
 * The runtime does not persist a workspace on a session, so association is by
 * recency: each project claims the threads updated since it was last active.
 * Imperfect but stable, and it keeps every thread reachable.
 */
export function buildSidebarProjects(
  sessions: DesktopRuntimeSessionSummary[],
  recentWorkspaces: DesktopRecentWorkspace[],
  activePath: string | null
): SidebarProject[] {
  if (recentWorkspaces.length === 0) {
    return [];
  }

  const ordered = [...recentWorkspaces].sort(
    (left, right) => Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt)
  );

  return ordered.map((workspace, index) => {
    const activeFrom = Date.parse(workspace.lastActiveAt);
    const activeUntil =
      index === 0 ? Number.POSITIVE_INFINITY : Date.parse(ordered[index - 1]!.lastActiveAt);

    const threads = sessions.filter((session) => {
      // The active workspace also claims anything newer than its own timestamp,
      // so a thread started right now lands under the folder that is open.
      if (workspace.path === activePath) {
        return session.updatedAt >= activeFrom;
      }
      return session.updatedAt >= activeFrom && session.updatedAt < activeUntil;
    });

    return {
      path: workspace.path,
      name: basename(workspace.path),
      lastActiveAt: workspace.lastActiveAt,
      threads: threads.sort((left, right) => right.updatedAt - left.updatedAt),
    };
  });
}
