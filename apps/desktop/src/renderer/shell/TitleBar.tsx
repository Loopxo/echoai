import { Icon } from '@echoai/design';
import type { DesktopWindowState } from '@shared/ipc';
import { IconButton, Tooltip } from '../ui';
import { shortenPath } from '../lib/format';

const chrome = window.echoaiDesktop.windowChrome;

/**
 * Window title bar.
 *
 * On macOS the native traffic lights are the only window controls; the shell
 * just reserves space for them and never draws its own. Windows and Linux run
 * frameless, so the minimize/maximize/close cluster is rendered here instead.
 */
export function TitleBar({
  title,
  subtitle,
  windowState,
  panelOpen,
  onTogglePanel,
  onOpenSettings,
  actions,
  leading,
}: {
  title: string;
  subtitle?: string | null;
  windowState: DesktopWindowState;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onOpenSettings: () => void;
  actions?: React.ReactNode;
  /** Controls shown only while the sidebar is collapsed. */
  leading?: React.ReactNode;
}) {
  return (
    <header className="titlebar drag-region">
      {leading}

      <div className="titlebar-title">
        <span className="titlebar-name">{title}</span>
        {subtitle ? (
          <span className="chip" data-plain="true" title={subtitle}>
            <Icon name="folder" size={11} />
            <span>{shortenPath(subtitle, 2)}</span>
          </span>
        ) : null}
      </div>

      <div className="titlebar-actions">
        {actions}
        <Tooltip content="Settings" shortcut="⌘,">
          <IconButton icon="settings" label="Settings" onClick={onOpenSettings} />
        </Tooltip>
        <Tooltip content={panelOpen ? 'Hide side panel' : 'Show side panel'} shortcut="⌘J">
          <IconButton
            icon="panel-right"
            label={panelOpen ? 'Hide side panel' : 'Show side panel'}
            active={panelOpen}
            onClick={onTogglePanel}
          />
        </Tooltip>
      </div>

      {chrome.usesCustomWindowControls ? (
        <WindowControls isMaximized={windowState.isMaximized} />
      ) : null}
    </header>
  );
}

function WindowControls({ isMaximized }: { isMaximized: boolean }) {
  return (
    <div className="window-controls">
      <button
        type="button"
        aria-label="Minimize"
        data-control="minimize"
        onClick={() => void window.echoaiDesktop.minimizeWindow()}
      >
        <Icon name="minus" size={15} />
      </button>
      <button
        type="button"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        data-control="maximize"
        onClick={() => void window.echoaiDesktop.maximizeWindow()}
      >
        <Icon name={isMaximized ? 'minimize' : 'maximize'} size={13} />
      </button>
      <button
        type="button"
        aria-label="Close"
        data-control="close"
        onClick={() => void window.echoaiDesktop.closeWindow()}
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
