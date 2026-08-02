import * as vscode from 'vscode';
import { EchoAcpClient } from './acp-client.js';
import { EchoAccountPanel } from './account-view.js';
import { EchoChatViewProvider } from './chat-view.js';
import {
  ECHO_AUTH_PROVIDER_ID,
  ECHO_AUTH_PROVIDER_LABEL,
  EchoAccountService,
  EchoAuthenticationProvider,
} from './echo-account.js';

const agentRevealedKey = 'echoai.agentPanelRevealed';

export function activate(context: vscode.ExtensionContext): void {
  const client = new EchoAcpClient(context);
  const account = new EchoAccountService();
  // Registering a real authentication provider is what makes the Accounts button in
  // the activity bar offer "Sign in with Echo AI" rather than doing nothing.
  const authProvider = new EchoAuthenticationProvider(account);
  const chat = new EchoChatViewProvider(context, client, account);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
  status.name = 'Echo AI';
  status.command = 'echoai.openChat';
  status.text = '$(sparkle) Echo AI';
  status.tooltip = 'Open Echo AI agent';
  status.show();

  const registrations: vscode.Disposable[] = [
    vscode.authentication.registerAuthenticationProvider(
      ECHO_AUTH_PROVIDER_ID,
      ECHO_AUTH_PROVIDER_LABEL,
      authProvider,
      { supportsMultipleAccounts: false },
    ),
    authProvider,
    account,
    vscode.commands.registerCommand('echoai.signIn', async () => {
      // Routing through the platform means the Accounts menu and this command share
      // one code path and one notion of the signed-in session.
      await vscode.authentication.getSession(ECHO_AUTH_PROVIDER_ID, [], { createIfNone: true });
    }),
    vscode.commands.registerCommand('echoai.showAccount', () =>
      EchoAccountPanel.show(context, account),
    ),
    vscode.commands.registerCommand('echoai.signOut', async () => {
      await account.signOut();
      void vscode.window.showInformationMessage('Signed out of Echo AI.');
    }),
    vscode.commands.registerCommand('echoai.showUsage', () =>
      client.openRuntimeTerminal(['usage'], 'Echo AI Usage'),
    ),
    vscode.window.registerWebviewViewProvider(EchoChatViewProvider.viewType, chat, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('echoai.openChat', () => chat.reveal()),
    vscode.commands.registerCommand('echoai.newSession', () => chat.newSession()),
    vscode.commands.registerCommand('echoai.showSessions', () => chat.showSessionPicker()),
    vscode.commands.registerCommand('echoai.cancel', () => client.cancel()),
    vscode.commands.registerCommand('echoai.explainSelection', () =>
      chat.sendEditorInstruction('Explain this code, including its behavior, important assumptions, and any correctness risks.'),
    ),
    vscode.commands.registerCommand('echoai.fixSelection', () =>
      chat.sendEditorInstruction('Fix the selected code. Inspect the surrounding project as needed, make the change with the available tools, and validate it.'),
    ),
    vscode.commands.registerCommand('echoai.openTerminal', () =>
      client.openRuntimeTerminal(['--help'], 'Echo AI CLI'),
    ),
    vscode.commands.registerCommand('echoai.login', () =>
      client.openRuntimeTerminal(['login'], 'Echo AI Login'),
    ),
    vscode.commands.registerCommand('echoai.manageMcp', () => manageMcp(client)),
    vscode.commands.registerCommand('echoai.configure', () => configureRuntime(client)),
    client.onDidEvent((event) => {
      if (event.type === 'session') {
        const routing = [event.provider, event.model].filter(Boolean).join(' / ');
        status.tooltip = [event.title || 'Echo AI agent', routing].filter(Boolean).join(' · ');
        return;
      }
      if (event.type !== 'status') {
        return;
      }
      const icon = event.status === 'running'
        ? '$(loading~spin)'
        : event.status === 'error'
          ? '$(warning)'
          : '$(sparkle)';
      status.text = `${icon} Echo AI`;
      if (event.message) {
        status.tooltip = event.message;
      }
    }),
    client,
    chat,
    status,
  ];

  context.subscriptions.push(...registrations);

  // The agent lives in the secondary side bar on the right and should be open the
  // first time a user reaches the workbench, the way a chat panel is always there in
  // Cursor. After that the panel state is theirs: if they close or collapse it, it
  // stays closed, and the title bar toggle or the status bar item brings it back.
  if (!context.globalState.get<boolean>(agentRevealedKey)) {
    void context.globalState.update(agentRevealedKey, true).then(
      () => chat.reveal(),
      () => chat.reveal(),
    );
  }
}

export function deactivate(): void {
  // Resources are disposed through the extension context.
}

async function configureRuntime(client: EchoAcpClient): Promise<void> {
  type ConfigureAction = 'setup' | 'show' | 'login' | 'mcp' | 'settings';
  interface ConfigureItem extends vscode.QuickPickItem {
    action: ConfigureAction;
  }

  const picked = await vscode.window.showQuickPick<ConfigureItem>([
    {
      label: '$(key) Configure AI provider',
      description: 'Run the existing EchoAI provider setup wizard',
      action: 'setup',
    },
    {
      label: '$(list-tree) Show runtime configuration',
      description: 'Display active provider, model, and feature settings',
      action: 'show',
    },
    {
      label: '$(account) EchoAI Cloud login',
      description: 'Connect hosted credits through the device login flow',
      action: 'login',
    },
    {
      label: '$(server-environment) Manage MCP servers',
      description: 'List, add, remove, or inspect configured MCP servers',
      action: 'mcp',
    },
    {
      label: '$(settings-gear) IDE extension settings',
      description: 'Configure startup, mode, CLI path, and context limits',
      action: 'settings',
    },
  ], {
    title: 'Configure Echo AI',
    placeHolder: 'Choose a production runtime configuration workflow',
  });

  switch (picked?.action) {
    case 'setup':
      client.openRuntimeTerminal(['config', 'setup'], 'Echo AI Provider Setup');
      break;
    case 'show':
      client.openRuntimeTerminal(['config', 'list'], 'Echo AI Configuration');
      break;
    case 'login':
      client.openRuntimeTerminal(['login'], 'Echo AI Login');
      break;
    case 'mcp':
      await manageMcp(client);
      break;
    case 'settings':
      await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:LoopXo.echoai-ide');
      break;
  }
}

async function manageMcp(client: EchoAcpClient): Promise<void> {
  type McpAction = 'list' | 'tools' | 'add' | 'remove';
  interface McpItem extends vscode.QuickPickItem {
    action: McpAction;
  }

  const picked = await vscode.window.showQuickPick<McpItem>([
    { label: '$(list-tree) List MCP servers', action: 'list' },
    { label: '$(tools) List available MCP tools', action: 'tools' },
    { label: '$(add) Add MCP server', action: 'add' },
    { label: '$(trash) Remove MCP server', action: 'remove' },
  ], {
    title: 'Echo AI MCP Servers',
    placeHolder: 'Choose an MCP configuration action',
  });

  if (!picked) return;
  if (picked.action === 'list' || picked.action === 'tools') {
    client.openRuntimeTerminal(['mcp', picked.action], `Echo AI MCP ${picked.action}`);
    return;
  }
  if (picked.action === 'remove') {
    const id = await vscode.window.showInputBox({
      title: 'Remove Echo AI MCP Server',
      prompt: 'Server ID',
      validateInput: requiredValue,
    });
    if (id) {
      client.openRuntimeTerminal(['mcp', 'remove', id.trim()], 'Remove Echo AI MCP Server');
    }
    return;
  }

  const id = await vscode.window.showInputBox({
    title: 'Add Echo AI MCP Server',
    prompt: 'Stable server ID',
    validateInput: requiredValue,
  });
  if (!id) return;
  const name = await vscode.window.showInputBox({
    title: 'Add Echo AI MCP Server',
    prompt: 'Display name',
    value: id,
    validateInput: requiredValue,
  });
  if (!name) return;
  const transport = await vscode.window.showQuickPick(['stdio', 'http', 'sse'] as const, {
    title: 'Add Echo AI MCP Server',
    placeHolder: 'Transport',
  });
  if (!transport) return;

  const args = ['mcp', 'add', '--id', id.trim(), '--name', name.trim(), '--transport', transport];
  if (transport === 'stdio') {
    const command = await vscode.window.showInputBox({
      title: 'Add Echo AI MCP Server',
      prompt: 'Executable command',
      validateInput: requiredValue,
    });
    if (!command) return;
    const commandArgs = await vscode.window.showInputBox({
      title: 'Add Echo AI MCP Server',
      prompt: 'Comma-separated arguments (optional)',
    });
    args.push('--command', command.trim());
    if (commandArgs?.trim()) args.push('--args', commandArgs.trim());
  } else {
    const url = await vscode.window.showInputBox({
      title: 'Add Echo AI MCP Server',
      prompt: `${transport.toUpperCase()} server URL`,
      validateInput: (value) => {
        if (!value.trim()) return 'A URL is required.';
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? undefined : 'Use an HTTP or HTTPS URL.';
        } catch {
          return 'Enter a valid URL.';
        }
      },
    });
    if (!url) return;
    args.push('--url', url.trim());
  }
  client.openRuntimeTerminal(args, 'Add Echo AI MCP Server');
}

function requiredValue(value: string): string | undefined {
  return value.trim() ? undefined : 'A value is required.';
}
