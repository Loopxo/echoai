import { Icon } from '@echoai/design';
import type { DesktopRecentWorkspace } from '@shared/ipc';
import { Button, Overlay } from '../ui';
import { basename, formatRelative, shortenPath } from '../lib/format';

/**
 * First-run prompt.
 *
 * Asks for exactly one thing — a workspace folder — instead of the previous
 * four-step checklist. Models, permissions and pairing all have sensible
 * defaults and belong in Settings, not in the way of a first prompt.
 */
export function Onboarding({
  recentWorkspaces,
  selecting,
  onSelectWorkspace,
  onOpenWorkspace,
  onSkip,
}: {
  recentWorkspaces: DesktopRecentWorkspace[];
  selecting: boolean;
  onSelectWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onSkip: () => void;
}) {
  return (
    <Overlay onDismiss={onSkip}>
      <div className="onboarding">
        <div className="onboarding-mark" aria-hidden>
          EA
        </div>
        <h1 className="onboarding-title">Welcome to EchoAI</h1>
        <p className="onboarding-desc">
          Open a project folder so the agent can read your code, run commands and propose changes.
          You can switch or add folders at any time.
        </p>

        <div className="onboarding-actions">
          <Button variant="primary" size="lg" icon="folder-open" full loading={selecting} onClick={onSelectWorkspace}>
            Open a folder
          </Button>
          <Button variant="ghost" full onClick={onSkip}>
            Continue without a folder
          </Button>
        </div>

        {recentWorkspaces.length > 0 ? (
          <div className="onboarding-recents">
            <div className="group-label" style={{ marginBottom: 6 }}>
              Recent
            </div>
            {recentWorkspaces.slice(0, 4).map((recent) => (
              <button
                key={recent.path}
                type="button"
                className="row"
                onClick={() => onOpenWorkspace(recent.path)}
              >
                <Icon name="folder" size={14} />
                <span className="row-main">
                  <span className="row-title">{basename(recent.path)}</span>
                  <span className="row-sub">{shortenPath(recent.path, 3)}</span>
                </span>
                <span className="row-sub">{formatRelative(recent.lastActiveAt)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}
