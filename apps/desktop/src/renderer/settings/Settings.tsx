import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@echoai/design';
import type { DesktopRuntimeStatus } from '@shared/ipc';
import {
  Badge,
  Button,
  Dot,
  EmptyState,
  Field,
  IconButton,
  Input,
  SearchField,
  SectionHead,
  Segmented,
  SettingRow,
  Switch,
} from '../ui';
import { basename, formatRelative, shortenPath } from '../lib/format';
import { describeUpdateStatus, type AppDataApi } from '../state/useAppData';
import type { SettingsDataApi } from '../state/useSettingsData';
import type { ThemePreference } from '../state/useTheme';

export type SettingsSection =
  | 'general'
  | 'models'
  | 'account'
  | 'tools'
  | 'automations'
  | 'devices'
  | 'privacy'
  | 'updates'
  | 'about';

interface SectionDescriptor {
  id: SettingsSection;
  label: string;
  icon: IconName;
  /** Extra terms matched by the settings search but not displayed. */
  keywords: string;
}

const SECTION_GROUPS: Array<{ label: string; sections: SectionDescriptor[] }> = [
  {
    label: 'Personal',
    sections: [
      { id: 'general', label: 'General', icon: 'sliders', keywords: 'theme appearance workspace folder' },
      { id: 'models', label: 'Models', icon: 'sparkles', keywords: 'provider api key deepseek qwen glm kimi claude openai ollama' },
      { id: 'account', label: 'Account', icon: 'user', keywords: 'sign in billing credits sync' },
    ],
  },
  {
    label: 'Coding',
    sections: [
      { id: 'tools', label: 'Tools & MCP', icon: 'wrench', keywords: 'mcp server skills browser permissions' },
      { id: 'automations', label: 'Automations', icon: 'calendar', keywords: 'schedule cron channels webhook' },
    ],
  },
  {
    label: 'Connected',
    sections: [
      { id: 'devices', label: 'Devices', icon: 'monitor', keywords: 'pairing gateway mobile remote handoff' },
    ],
  },
  {
    label: 'Data',
    sections: [
      { id: 'privacy', label: 'Privacy', icon: 'shield', keywords: 'telemetry export delete data' },
      { id: 'updates', label: 'Updates', icon: 'download', keywords: 'version upgrade release' },
      { id: 'about', label: 'About', icon: 'info', keywords: 'version paths diagnostics health' },
    ],
  },
];

const ALL_SECTIONS: SectionDescriptor[] = SECTION_GROUPS.flatMap((group) => group.sections);

export interface SettingsProps {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onClose: () => void;
  app: AppDataApi;
  data: SettingsDataApi;
  runtimeStatus: DesktopRuntimeStatus | null;
  themePreference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
  onNotify: (title: string, body: string) => void;
}

/**
 * Settings.
 *
 * Everything that used to be a sidebar page — Web, Memory, Skills, MCP,
 * Automations, Devices, Channels, Sessions — now lives here behind a section
 * nav. Fifteen navigation entries collapsed into one predictable place.
 */
export function Settings(props: SettingsProps) {
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();
  const groups = SECTION_GROUPS.map((group) => ({
    label: group.label,
    sections: group.sections.filter(
      (section) =>
        trimmed.length === 0 ||
        section.label.toLowerCase().includes(trimmed) ||
        section.keywords.includes(trimmed)
    ),
  })).filter((group) => group.sections.length > 0);

  const active = ALL_SECTIONS.find((section) => section.id === props.section) ?? ALL_SECTIONS[0]!;

  useEffect(() => {
    // Escape returns to the app, matching every other overlay in the shell.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [props]);

  return (
    <div className="settings-screen" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-side">
        <div className="drag-region" style={{ display: 'flex', alignItems: 'center' }}>
          <button type="button" className="settings-back" onClick={props.onClose}>
            <Icon name="arrow-left" size={14} />
            Back to app
          </button>
        </div>

        <div className="settings-search">
          <SearchField value={query} onValueChange={setQuery} placeholder="Search settings" />
        </div>

        <nav className="settings-groups" aria-label="Settings sections">
          {groups.length === 0 ? (
            <p className="settings-empty-hit">No matching settings</p>
          ) : (
            groups.map((group) => (
              <div className="settings-group" key={group.label}>
                <div className="settings-group-label">{group.label}</div>
                {group.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className="settings-nav-item"
                    data-active={section.id === props.section ? 'true' : undefined}
                    onClick={() => props.onSectionChange(section.id)}
                  >
                    <Icon name={section.icon} size={14} />
                    {section.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </nav>
      </div>

      <div className="settings-main">
        <header className="settings-main-head drag-region">
          <span className="settings-main-title">{active.label}</span>
        </header>
        <div className="settings-content">
          <div className="settings-inner">
            <SectionBody {...props} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionBody(props: SettingsProps) {
  switch (props.section) {
    case 'general':
      return <GeneralSection {...props} />;
    case 'models':
      return <ModelsSection {...props} />;
    case 'account':
      return <AccountSection {...props} />;
    case 'tools':
      return <ToolsSection {...props} />;
    case 'automations':
      return <AutomationsSection {...props} />;
    case 'devices':
      return <DevicesSection {...props} />;
    case 'privacy':
      return <PrivacySection {...props} />;
    case 'updates':
      return <UpdatesSection {...props} />;
    case 'about':
      return <AboutSection {...props} />;
    default:
      return null;
  }
}

/* -------------------------------- General -------------------------------- */

function GeneralSection({ app, themePreference, onThemeChange }: SettingsProps) {
  return (
    <>
      <section className="settings-section">
        <SectionHead title="Appearance" description="How EchoAI looks on this machine." />
        <SettingRow title="Theme" description="Follow the system setting or pick one.">
          <Segmented
            label="Theme"
            value={themePreference}
            onChange={onThemeChange}
            options={[
              { value: 'dark', label: 'Dark', icon: 'moon' },
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'system', label: 'Auto', icon: 'monitor' },
            ]}
          />
        </SettingRow>
      </section>

      <section className="settings-section">
        <SectionHead title="Workspace" description="The folder the agent can read and change." />
        <SettingRow
          title={app.workspace ? basename(app.workspace.path) : 'No folder open'}
          description={app.workspace ? app.workspace.path : 'Open a folder to enable file and command tools.'}
        >
          <Button icon="folder-open" loading={app.selecting} onClick={() => void app.selectWorkspace()}>
            {app.workspace ? 'Change' : 'Open folder'}
          </Button>
        </SettingRow>

        {app.recentWorkspaces.length > 0 ? (
          <div className="settings-grid" style={{ marginTop: 12 }}>
            <div className="group-label">Recent folders</div>
            {app.recentWorkspaces.slice(0, 6).map((recent) => (
              <button
                key={recent.path}
                type="button"
                className="row"
                data-active={recent.path === app.workspace?.path ? 'true' : undefined}
                onClick={() => void app.openWorkspace(recent.path)}
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
      </section>
    </>
  );
}

/* -------------------------------- Models -------------------------------- */

function ModelsSection({ runtimeStatus }: SettingsProps) {
  const providers = runtimeStatus?.providers ?? [];

  return (
    <section className="settings-section">
      <SectionHead
        title="Providers"
        description="Providers appear once their API key is present in your EchoAI config or environment. Ollama is always available for local models."
      />

      {providers.length === 0 ? (
        <EmptyState
          icon="key"
          title="No providers configured"
          description="Add an API key to ~/.echoai/config.json or your environment, then reopen EchoAI."
        />
      ) : (
        <div className="settings-grid">
          {providers.map((provider) => (
            <div className="row" key={provider.id}>
              <Dot tone={provider.source === 'local' ? 'info' : 'success'} />
              <span className="row-main">
                <span className="row-title">{provider.label}</span>
                <span className="row-sub mono">{provider.defaultModel}</span>
              </span>
              <Badge tone={provider.source === 'local' ? 'info' : 'success'}>
                {provider.source === 'local' ? 'Local' : 'Configured'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {runtimeStatus ? (
        <div className="settings-grid" style={{ marginTop: 16 }}>
          <SettingRow title="Active sessions" description="Threads stored on this machine.">
            <Badge plain>{runtimeStatus.sessionCount}</Badge>
          </SettingRow>
          <SettingRow title="Running now" description="Prompts currently in flight.">
            <Badge plain tone={runtimeStatus.activeRuns > 0 ? 'info' : 'neutral'}>
              {runtimeStatus.activeRuns}
            </Badge>
          </SettingRow>
        </div>
      ) : null}
    </section>
  );
}

/* -------------------------------- Account -------------------------------- */

function AccountSection({ app }: SettingsProps) {
  const account = app.account;
  const sync = app.syncSettings;

  return (
    <>
      <section className="settings-section">
        <SectionHead
          title="Account"
          description="Sign in to use hosted credits and sync. EchoAI works fully offline with your own keys."
        />
        <SettingRow
          title={account?.signedIn ? (account.email ?? 'Signed in') : 'Not signed in'}
          description={
            account?.signedIn
              ? `${account.plan ?? 'Plan'} · ${account.credits ?? 0} credits · sync ${account.syncState}`
              : 'Bring your own key, or sign in for hosted models.'
          }
        >
          {account?.signedIn ? (
            <>
              <Button icon="refresh" onClick={() => void app.refreshAccount()}>
                Refresh
              </Button>
              <Button variant="danger" onClick={() => void app.logout()}>
                Sign out
              </Button>
            </>
          ) : (
            <Button variant="primary" icon="key" onClick={() => void app.startDeviceLogin()}>
              Sign in
            </Button>
          )}
        </SettingRow>
      </section>

      <section className="settings-section">
        <SectionHead title="Sync" description="Choose what leaves this device when signed in." />
        <SettingRow title="Threads" description="Conversation history and titles.">
          <Switch
            label="Sync threads"
            checked={sync?.sessions ?? false}
            onCheckedChange={(checked) => void app.updateSync({ sessions: checked })}
          />
        </SettingRow>
        <SettingRow title="Artifacts" description="Files the agent generates.">
          <Switch
            label="Sync artifacts"
            checked={sync?.artifacts ?? false}
            onCheckedChange={(checked) => void app.updateSync({ artifacts: checked })}
          />
        </SettingRow>
        <SettingRow title="Memories" description="Saved context and preferences.">
          <Switch
            label="Sync memories"
            checked={sync?.memories ?? false}
            onCheckedChange={(checked) => void app.updateSync({ memories: checked })}
          />
        </SettingRow>
      </section>
    </>
  );
}

/* --------------------------------- Tools --------------------------------- */

function ToolsSection({ data, onNotify }: SettingsProps) {
  const [serverName, setServerName] = useState('');
  const [serverCommand, setServerCommand] = useState('');
  const [skillName, setSkillName] = useState('');

  return (
    <>
      <section className="settings-section">
        <SectionHead
          title="MCP servers"
          description="Model Context Protocol servers add tools the agent can call."
        />

        {data.mcpServers.length === 0 ? (
          <EmptyState icon="plug" title="No servers yet" description="Add one below to expose extra tools." />
        ) : (
          <div className="settings-grid">
            {data.mcpServers.map((server) => (
              <div className="row" key={server.id}>
                <Dot tone={server.enabled ? 'success' : 'neutral'} />
                <span className="row-main">
                  <span className="row-title">{server.name}</span>
                  <span className="row-sub mono">
                    {server.command} {server.args.join(' ')}
                  </span>
                </span>
                <span className="row-actions" style={{ opacity: 1 }}>
                  <Button
                    size="sm"
                    onClick={() => {
                      void data.testMcpServer(server.id).then((ok) => {
                        onNotify(
                          ok ? 'Server reachable' : 'Server unreachable',
                          `${server.name} ${ok ? 'responded successfully.' : 'did not respond.'}`
                        );
                      });
                    }}
                  >
                    Test
                  </Button>
                  <IconButton
                    icon="trash"
                    label={`Remove ${server.name}`}
                    tone="danger"
                    size="sm"
                    onClick={() => void data.removeMcpServer(server.id)}
                  />
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
          <Field label="Name">
            <Input
              value={serverName}
              placeholder="local-tools"
              onChange={(event) => setServerName(event.target.value)}
            />
          </Field>
          <Field label="Command">
            <Input
              value={serverCommand}
              placeholder="npx -y @scope/server"
              className="mono"
              onChange={(event) => setServerCommand(event.target.value)}
            />
          </Field>
          <Button
            variant="primary"
            icon="plus"
            disabled={!serverName.trim() || !serverCommand.trim()}
            onClick={() => {
              const [command = '', ...args] = serverCommand.trim().split(/\s+/);
              void data.addMcpServer({ name: serverName.trim(), command, args }).then(() => {
                setServerName('');
                setServerCommand('');
              });
            }}
          >
            Add
          </Button>
        </div>
      </section>

      <section className="settings-section">
        <SectionHead title="Skills" description="Reusable instruction packs the agent can load." />
        {data.skills.length === 0 ? (
          <EmptyState icon="book" title="No skills yet" />
        ) : (
          <div className="settings-grid">
            {data.skills.map((skill) => (
              <div className="row" key={skill.id}>
                <Icon name="book" size={14} />
                <span className="row-main">
                  <span className="row-title">{skill.name}</span>
                  <span className="row-sub">{skill.description || skill.path}</span>
                </span>
                <span className="row-actions" style={{ opacity: 1 }}>
                  <IconButton
                    icon="trash"
                    label={`Delete ${skill.name}`}
                    tone="danger"
                    size="sm"
                    onClick={() => void data.deleteSkill(skill.id)}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
          <Field label="New skill">
            <Input
              value={skillName}
              placeholder="code-review"
              onChange={(event) => setSkillName(event.target.value)}
            />
          </Field>
          <Button
            icon="plus"
            disabled={!skillName.trim()}
            onClick={() => {
              void data.createSkill(skillName.trim(), 'Created from desktop settings').then(() => setSkillName(''));
            }}
          >
            Create
          </Button>
        </div>
      </section>

      <section className="settings-section">
        <SectionHead title="Browser & system access" description="Used by browser and computer-use tools." />
        <SettingRow
          title="Browser automation"
          description={data.browserStatus?.message ?? 'Status unknown'}
        >
          <Badge tone={data.browserStatus?.installed ? 'success' : 'warning'}>
            {data.browserStatus?.installed ? 'Installed' : 'Not installed'}
          </Badge>
        </SettingRow>
        <SettingRow title="Screen recording" description="Required for screenshots of your desktop.">
          <Badge tone={data.guiStatus?.screenRecording === 'granted' ? 'success' : 'warning'}>
            {data.guiStatus?.screenRecording ?? 'unknown'}
          </Badge>
        </SettingRow>
        <SettingRow title="Accessibility" description="Required to control other applications.">
          <Badge tone={data.guiStatus?.accessibility === 'granted' ? 'success' : 'warning'}>
            {data.guiStatus?.accessibility ?? 'unknown'}
          </Badge>
        </SettingRow>
        <SettingRow
          title="Browser profiles"
          description={`${data.browserProfiles.length} configured`}
        >
          <Button icon="plus" onClick={() => void data.createBrowserProfile('Default profile')}>
            Add profile
          </Button>
        </SettingRow>
      </section>
    </>
  );
}

/* ------------------------------ Automations ------------------------------ */

function AutomationsSection({ data }: SettingsProps) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');

  return (
    <>
      <section className="settings-section">
        <SectionHead title="Scheduled runs" description="Prompts EchoAI runs on a schedule." />
        {data.scheduledTasks.length === 0 ? (
          <EmptyState icon="calendar" title="No automations yet" />
        ) : (
          <div className="settings-grid">
            {data.scheduledTasks.map((task) => (
              <div className="row" key={task.id}>
                <Icon name="clock" size={14} />
                <span className="row-main">
                  <span className="row-title">{task.title}</span>
                  <span className="row-sub">
                    {task.schedule} · next {task.nextRunAt ? formatRelative(task.nextRunAt) : 'manual'}
                  </span>
                </span>
                <span className="row-actions" style={{ opacity: 1 }}>
                  <IconButton
                    icon="trash"
                    label={`Delete ${task.title}`}
                    tone="danger"
                    size="sm"
                    onClick={() => void data.deleteSchedule(task.id)}
                  />
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="settings-grid" style={{ marginTop: 12 }}>
          <Field label="Title">
            <Input value={title} placeholder="Daily review" onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Prompt">
            <Input
              value={prompt}
              placeholder="Summarize what changed in this workspace today"
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>
          <div>
            <Button
              variant="primary"
              icon="plus"
              disabled={!title.trim() || !prompt.trim()}
              onClick={() => {
                void data
                  .createSchedule({ title: title.trim(), prompt: prompt.trim(), schedule: 'daily' })
                  .then(() => {
                    setTitle('');
                    setPrompt('');
                  });
              }}
            >
              Add daily automation
            </Button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <SectionHead title="Channels" description="Where automation results can be delivered." />
        {data.channels.length === 0 ? (
          <EmptyState icon="message-circle" title="No channels available" />
        ) : (
          data.channels.map((channel) => (
            <SettingRow key={channel.id} title={channel.name} description={channel.provider}>
              <Switch
                label={`Enable ${channel.name}`}
                checked={channel.enabled}
                onCheckedChange={() => void data.toggleChannel(channel)}
              />
            </SettingRow>
          ))
        )}
      </section>
    </>
  );
}

/* -------------------------------- Devices -------------------------------- */

function DevicesSection({ data, onNotify }: SettingsProps) {
  return (
    <>
      <section className="settings-section">
        <SectionHead
          title="Local gateway"
          description="Lets your paired phone or browser hand tasks to this machine. Off by default."
        />
        <SettingRow
          title={data.gateway?.running ? 'Gateway running' : 'Gateway stopped'}
          description={data.gateway?.url ?? 'Binds to localhost only when running.'}
        >
          <Switch
            label="Toggle gateway"
            checked={data.gateway?.running ?? false}
            onCheckedChange={() => void data.toggleGateway()}
          />
        </SettingRow>
      </section>

      <section className="settings-section">
        <SectionHead
          title="Paired devices"
          description="Devices allowed to send requests to this machine."
          actions={
            <Button
              icon="plus"
              onClick={() => {
                void data.createPairing('EchoAI mobile').then(() =>
                  onNotify('Pairing code created', 'Approve the request below to trust the device.')
                );
              }}
            >
              New code
            </Button>
          }
        />

        {data.pairingRequests.filter((request) => request.status === 'pending').length > 0 ? (
          <div className="settings-grid" style={{ marginBottom: 12 }}>
            <div className="group-label">Pending</div>
            {data.pairingRequests
              .filter((request) => request.status === 'pending')
              .map((request) => (
                <div className="row" key={request.id}>
                  <Dot tone="warning" pulse />
                  <span className="row-main">
                    <span className="row-title">{request.deviceName}</span>
                    <span className="row-sub mono">code {request.code}</span>
                  </span>
                  <span className="row-actions" style={{ opacity: 1 }}>
                    <Button size="sm" variant="primary" onClick={() => void data.respondPairing(request.id, true)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void data.respondPairing(request.id, false)}>
                      Reject
                    </Button>
                  </span>
                </div>
              ))}
          </div>
        ) : null}

        {data.pairedDevices.length === 0 ? (
          <EmptyState icon="smartphone" title="No paired devices" />
        ) : (
          <div className="settings-grid">
            {data.pairedDevices.map((device) => (
              <div className="row" key={device.id}>
                <Icon name={device.type === 'mobile' ? 'smartphone' : 'monitor'} size={14} />
                <span className="row-main">
                  <span className="row-title">{device.name}</span>
                  <span className="row-sub">
                    {device.scopes.length} scopes · last seen {formatRelative(device.lastSeenAt)}
                  </span>
                </span>
                <span className="row-actions" style={{ opacity: 1 }}>
                  <Button size="sm" variant="danger" onClick={() => void data.revokeDevice(device.id)}>
                    Revoke
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.remoteControls.filter((request) => request.status === 'queued').length > 0 ? (
        <section className="settings-section">
          <SectionHead title="Waiting for approval" description="Requests handed off from another device." />
          <div className="settings-grid">
            {data.remoteControls
              .filter((request) => request.status === 'queued')
              .map((request) => (
                <div className="row" key={request.id}>
                  <Dot tone="warning" pulse />
                  <span className="row-main">
                    <span className="row-title">{request.prompt}</span>
                    <span className="row-sub">from {request.source}</span>
                  </span>
                  <span className="row-actions" style={{ opacity: 1 }}>
                    <Button size="sm" variant="primary" onClick={() => void data.approveRemote(request.id, true)}>
                      Run
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void data.approveRemote(request.id, false)}>
                      Dismiss
                    </Button>
                  </span>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/* -------------------------------- Privacy -------------------------------- */

function PrivacySection({ data, onNotify }: SettingsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <section className="settings-section">
        <SectionHead
          title="Telemetry"
          description="Off by default. EchoAI never sends prompt content unless you explicitly allow it."
        />
        <SettingRow title="Share anonymous usage data" description="Crash counts and feature usage only.">
          <Switch
            label="Telemetry"
            checked={data.telemetry?.enabled ?? false}
            onCheckedChange={(checked) => void data.setTelemetry(checked)}
          />
        </SettingRow>
      </section>

      <section className="settings-section">
        <SectionHead title="Your data" description="What is stored locally versus synced." />
        {(data.privacy?.localData ?? []).map((item) => (
          <SettingRow key={item.path} title={item.label} description={item.path}>
            <Badge tone="success">On this device</Badge>
          </SettingRow>
        ))}
        {(data.privacy?.cloudData ?? []).map((item) => (
          <SettingRow key={item.label} title={item.label}>
            <Badge tone={item.enabled ? 'info' : 'neutral'}>{item.enabled ? 'Syncing' : 'Local only'}</Badge>
          </SettingRow>
        ))}
      </section>

      <section className="settings-section">
        <SectionHead title="Export and reset" />
        <SettingRow title="Export your data" description="Writes a JSON bundle you can inspect or keep.">
          <Button
            icon="download"
            onClick={() => {
              void data.exportPrivacyData().then((path) => {
                if (path) {
                  onNotify('Export ready', path);
                }
              });
            }}
          >
            Export
          </Button>
        </SettingRow>
        <SettingRow
          title="Delete local gateway data"
          description="Clears pairing codes, trusted devices, handoffs and telemetry. Cannot be undone."
        >
          {confirming ? (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  void data.deleteLocalData().then(() => {
                    setConfirming(false);
                    onNotify('Local data cleared', 'Pairing, devices and telemetry were reset.');
                  });
                }}
              >
                Delete permanently
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" icon="trash" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          )}
        </SettingRow>
      </section>
    </>
  );
}

/* -------------------------------- Updates -------------------------------- */

function UpdatesSection({ app }: SettingsProps) {
  const status = app.updateStatus;

  return (
    <section className="settings-section">
      <SectionHead title="Updates" description={describeUpdateStatus(status)} />

      {status?.state === 'downloading' && status.downloadProgress !== null ? (
        <div style={{ margin: '4px 0 14px' }}>
          <div className="progress">
            <div style={{ width: `${status.downloadProgress}%` }} />
          </div>
        </div>
      ) : null}

      <SettingRow
        title="Check for updates"
        description={status?.checkedAt ? `Last checked ${formatRelative(status.checkedAt)}` : 'Never checked'}
      >
        <Button icon="refresh" loading={status?.state === 'checking'} onClick={() => void app.checkForUpdates()}>
          Check now
        </Button>
        <Button
          variant="default"
          icon="download"
          disabled={status?.state !== 'available'}
          onClick={() => void app.downloadUpdate()}
        >
          Download
        </Button>
        <Button
          variant="primary"
          disabled={status?.state !== 'downloaded'}
          onClick={() => void app.installUpdate()}
        >
          Restart and install
        </Button>
      </SettingRow>
    </section>
  );
}

/* --------------------------------- About --------------------------------- */

function AboutSection({ app, data }: SettingsProps) {
  const snapshot = app.snapshot;

  return (
    <>
      <section className="settings-section">
        <SectionHead title="EchoAI Desktop" description={`Version ${snapshot?.version ?? '—'}`} />
        <SettingRow title="Platform" description={snapshot?.platform ?? 'unknown'}>
          <Badge plain>{snapshot?.isPackaged ? 'Packaged' : 'Development'}</Badge>
        </SettingRow>
        <SettingRow title="Sandboxed renderer" description="Context isolation on, Node integration off.">
          <Badge tone="success" icon="shield">
            Hardened
          </Badge>
        </SettingRow>
      </section>

      {data.serviceHealth.length > 0 ? (
        <section className="settings-section">
          <SectionHead title="Service health" />
          {data.serviceHealth.map((service) => (
            <SettingRow key={service.id} title={service.label} description={service.detail}>
              <Badge
                tone={service.status === 'ready' ? 'success' : service.status === 'degraded' ? 'warning' : 'danger'}
              >
                {service.status}
              </Badge>
            </SettingRow>
          ))}
        </section>
      ) : null}

      {snapshot ? (
        <section className="settings-section">
          <SectionHead title="Storage locations" />
          {(
            [
              ['Data', snapshot.paths.dataDir],
              ['Logs', snapshot.paths.logsDir],
              ['Sessions', snapshot.paths.sessionsDir],
              ['Artifacts', snapshot.paths.artifactsDir],
              ['Skills', snapshot.paths.skillsDir],
            ] as const
          ).map(([label, path]) => (
            <div className="row" key={label}>
              <Icon name="folder" size={14} />
              <span className="row-main">
                <span className="row-title">{label}</span>
                <span className="row-sub mono">{path}</span>
              </span>
              <span className="row-actions" style={{ opacity: 1 }}>
                <IconButton
                  icon="external-link"
                  label={`Open ${label} folder`}
                  size="sm"
                  onClick={() => void window.echoaiDesktop.revealArtifact(path)}
                />
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
