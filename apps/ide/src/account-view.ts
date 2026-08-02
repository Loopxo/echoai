import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import type {
	EchoAccountService,
	EchoAccountState,
	EchoIdentity,
	EchoUsageDetail,
} from './echo-account.js';

/**
 * Echo AI profile page.
 *
 * A full editor-area panel rather than a hover popup, so plan, credit burn and
 * recent spend are readable and copyable. Rendered in the Echo monochrome system:
 * the only accent is white, and the credit meter conveys its level by fill length
 * rather than by turning orange or red.
 *
 * Every number shown comes from the `/usage` endpoint the CLI already uses, and the
 * identity line is read from the access-token claims, so nothing here is invented.
 */
export class EchoAccountPanel {
	private static current: EchoAccountPanel | undefined;

	private readonly disposables: vscode.Disposable[] = [];

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		private readonly account: EchoAccountService,
	) {
		this.panel.webview.options = { enableScripts: true };
		this.disposables.push(
			this.panel.onDidDispose(() => this.dispose()),
			this.panel.webview.onDidReceiveMessage((message: unknown) => {
				void this.handleMessage(message);
			}),
			this.account.onDidChange(() => void this.refresh()),
		);
		void this.refresh();
	}

	static show(context: vscode.ExtensionContext, account: EchoAccountService): void {
		if (EchoAccountPanel.current) {
			EchoAccountPanel.current.panel.reveal(vscode.ViewColumn.Active);
			void EchoAccountPanel.current.refresh();
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			'echoai.account',
			'Echo AI Account',
			vscode.ViewColumn.Active,
			{ enableScripts: true, retainContextWhenHidden: true },
		);
		panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'echoai.svg');
		EchoAccountPanel.current = new EchoAccountPanel(panel, account);
	}

	private dispose(): void {
		EchoAccountPanel.current = undefined;
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.panel.dispose();
	}

	private async handleMessage(message: unknown): Promise<void> {
		if (typeof message !== 'object' || message === null) return;
		const type = (message as { type?: unknown }).type;

		try {
			switch (type) {
				case 'signIn':
					await this.account.signIn();
					await this.refresh();
					break;
				case 'signOut': {
					const confirmed = await vscode.window.showWarningMessage(
						'Sign out of Echo AI?',
						{ modal: true, detail: 'The bundled agent and the echoai CLI will also be signed out.' },
						'Sign out',
					);
					if (confirmed === 'Sign out') {
						await this.account.signOut();
						await this.refresh();
					}
					break;
				}
				case 'refresh':
					await this.refresh();
					break;
				case 'managePlan': {
					const state = await this.account.getState();
					await vscode.env.openExternal(vscode.Uri.parse(state.apiUrl));
					break;
				}
				case 'billingSupport': {
					const state = await this.account.getState();
					await vscode.env.openExternal(vscode.Uri.parse(`${state.apiUrl}/support`));
					break;
				}
				case 'copyUserId': {
					const value = (message as { value?: unknown }).value;
					if (typeof value === 'string' && value) {
						await vscode.env.clipboard.writeText(value);
						void vscode.window.showInformationMessage('User ID copied.');
					}
					break;
				}
				case 'showUsageCli':
					await vscode.commands.executeCommand('echoai.showUsage');
					break;
			}
		} catch (error) {
			void vscode.window.showErrorMessage(
				`Echo AI: ${error instanceof Error ? error.message : String(error)}`,
			);
			await this.refresh();
		}
	}

	private async refresh(): Promise<void> {
		const state = await this.account.getState();
		const [identity, usage] = state.signedIn
			? await Promise.all([this.account.readIdentity(), this.account.readUsageDetail()])
			: [{}, undefined];
		this.panel.webview.html = renderAccountPage(state, identity, usage);
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function money(value: number | undefined): string {
	return typeof value === 'number' ? `$${value.toFixed(2)}` : '—';
}

function formatDate(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const time = Date.parse(value);
	return Number.isFinite(time)
		? new Date(time).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })
		: undefined;
}

function renderAccountPage(
	state: EchoAccountState,
	identity: EchoIdentity,
	usage: EchoUsageDetail | undefined,
): string {
	const nonce = randomBytes(16).toString('base64');
	const csp = [
		"default-src 'none'",
		`style-src 'nonce-${nonce}'`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	const body = state.signedIn
		? renderSignedIn(identity, usage, state)
		: renderSignedOut(state);

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style nonce="${nonce}">
:root {
  --bg-base: #000000; --bg-inset: #050505; --bg-raised: #0a0a0a;
  --hair: #1f1f1f; --mid: #2a2a2a; --strong: #5a5a5a; --full: #ffffff;
  --fg: #ffffff; --fg2: #8a8a8a; --fg3: #5a5a5a;
  --mono: 'Echo Mono', 'JetBrains Mono', ui-monospace, monospace;
}
* { box-sizing: border-box; border-radius: 0 !important; box-shadow: none !important; }
body {
  margin: 0; padding: 34px 20px; background: var(--bg-base); color: var(--fg2);
  font-family: var(--mono); font-size: 12px; line-height: 1.6;
}
button { font: inherit; color: inherit; background: transparent; border: 0; cursor: pointer; }
.card { max-width: 640px; margin: 0 auto; border: 1px solid var(--mid); background: var(--bg-raised); }
.section { padding: 18px 20px; border-bottom: 1px solid var(--hair); }
.section:last-child { border-bottom: 0; }

.who { display: flex; align-items: flex-start; gap: 14px; }
.mark {
  display: grid; place-items: center; width: 46px; height: 46px; flex: none;
  border: 1px solid var(--full); color: var(--fg); font-size: 17px; font-weight: 800;
}
.who-main { flex: 1; min-width: 0; }
.email { overflow: hidden; color: var(--fg); font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.sub { margin-top: 3px; color: var(--fg3); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
.sub .divider { padding: 0 7px; color: var(--hair); }
.linkish { color: var(--fg2); text-decoration: underline; }
.linkish:hover { color: var(--fg); }
.ghost {
  flex: none; padding: 7px 14px; border: 1px solid var(--strong); color: var(--fg);
  font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
}
.ghost:hover { border-color: var(--full); }

.row { display: flex; align-items: center; gap: 12px; }
.row .grow { flex: 1; min-width: 0; }
.eyebrow { color: var(--fg); font-size: 13px; }
.eyebrow .muted { color: var(--fg3); font-size: 11px; }
.badge {
  flex: none; padding: 6px 12px; background: var(--full); color: var(--bg-base);
  font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
}
.meter-label { display: flex; justify-content: space-between; gap: 12px; margin: 14px 0 7px; }
.meter-label .k { color: var(--fg); font-size: 13px; }
.meter-label .v { color: var(--fg2); font-size: 11px; text-align: right; }
.track { height: 8px; background: var(--hair); }
.fill { height: 8px; background: var(--full); }
.fill.over { background: repeating-linear-gradient(90deg, var(--full) 0 4px, var(--strong) 4px 8px); }
.hint { margin-top: 9px; color: var(--fg3); font-size: 10px; }

table { width: 100%; border-collapse: collapse; }
th, td { padding: 6px 0; text-align: left; font-size: 11px; border-bottom: 1px solid var(--hair); }
th { color: var(--fg3); font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
td { color: var(--fg2); }
td.num, th.num { text-align: right; }
tr:last-child td { border-bottom: 0; }

.primary {
  display: block; width: 100%; padding: 13px 18px; background: var(--full); color: var(--bg-base);
  font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; text-align: center;
}
.primary:hover { background: var(--fg2); }
.center { margin-top: 12px; text-align: center; }
.center button { color: var(--fg3); font-size: 10px; letter-spacing: .1em; text-decoration: underline; text-transform: uppercase; }
.center button:hover { color: var(--fg); }

.out { padding: 46px 24px; text-align: center; }
.out .wordmark { color: var(--fg); font-size: 46px; font-weight: 800; letter-spacing: -0.04em; }
.out .rule { width: 68px; height: 2px; margin: 16px auto 18px; background: var(--full); }
.out p { max-width: 380px; margin: 0 auto 22px; color: var(--fg2); font-size: 12px; }
.out .primary { max-width: 260px; margin: 0 auto; }
.pill { display: inline-block; margin-top: 20px; padding: 4px 9px; border: 1px solid var(--hair); color: var(--fg3); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
</style>
</head>
<body>
${body}
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  vscode.postMessage({ type: target.dataset.action, value: target.dataset.value });
});
</script>
</body>
</html>`;
}

function renderSignedOut(state: EchoAccountState): string {
	return `<div class="card">
  <div class="out">
    <div class="wordmark">ECHO</div>
    <div class="rule"></div>
    <p>Echo AI IDE runs on your Echo AI account. Sign in to use hosted models, credits and synced sessions.</p>
    <button class="primary" data-action="signIn">Sign in to Echo AI</button>
    <div class="pill">${escapeHtml(state.apiUrl)}</div>
  </div>
</div>`;
}

function renderSignedIn(
	identity: EchoIdentity,
	usage: EchoUsageDetail | undefined,
	state: EchoAccountState,
): string {
	const displayName = identity.email ?? identity.name ?? 'Echo AI account';
	const initial = (identity.name ?? identity.email ?? 'E').trim().charAt(0).toUpperCase() || 'E';
	const provider = identity.signedInWith ?? 'Echo AI';

	const userIdLine = identity.userId
		? `<span class="divider">|</span><button class="linkish" data-action="copyUserId" data-value="${escapeHtml(identity.userId)}" title="Copy user ID">User ID</button>`
		: '';

	const used = usage?.totalSpent;
	const granted = usage?.totalGranted;
	const percent = typeof used === 'number' && typeof granted === 'number' && granted > 0
		? Math.min(100, (used / granted) * 100)
		: undefined;
	const over = typeof percent === 'number' && percent >= 100;
	const resets = formatDate(usage?.resetDate);

	const creditsSection = usage
		? `<div class="section">
  <div class="row">
    <span class="grow eyebrow">Estimated usage${resets ? ` <span class="muted">resets on ${escapeHtml(resets)}</span>` : ''}</span>
    ${usage.plan ? `<span class="badge">${escapeHtml(usage.plan.name)}</span>` : ''}
  </div>
  <div class="meter-label">
    <span class="k">Credits</span>
    <span class="v">${money(used)} used${typeof granted === 'number' ? ` / ${money(granted)} covered in plan` : ''}</span>
  </div>
  <div class="track">${typeof percent === 'number' ? `<div class="fill${over ? ' over' : ''}" style="width:${percent.toFixed(1)}%"></div>` : ''}</div>
  <div class="hint">Remaining balance ${money(usage.balance)}${
			typeof usage.hourlyLimit === 'number'
				? ` &nbsp;·&nbsp; hourly ${money(usage.hourlySpent)} / ${money(usage.hourlyLimit)}`
				: ''
		}</div>
</div>`
		: `<div class="section">
  <div class="row"><span class="grow eyebrow">Estimated usage</span></div>
  <div class="hint">Billing data is unavailable right now. Your session is still signed in.</div>
</div>`;

	const recent = usage?.recent.length
		? `<div class="section">
  <div class="row"><span class="grow eyebrow">Recent activity</span></div>
  <table>
    <thead><tr><th>When</th><th>Model</th><th class="num">Tokens</th><th class="num">Cost</th></tr></thead>
    <tbody>
      ${usage.recent
				.map((entry) => {
					const when = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—';
					const tokens = (entry.inputTokens + entry.outputTokens).toLocaleString();
					return `<tr><td>${escapeHtml(when)}</td><td>${escapeHtml(entry.model)}</td><td class="num">${tokens}</td><td class="num">${money(entry.cost)}</td></tr>`;
				})
				.join('')}
    </tbody>
  </table>
</div>`
		: '';

	return `<div class="card">
  <div class="section">
    <div class="who">
      <div class="mark">${escapeHtml(initial)}</div>
      <div class="who-main">
        <div class="email" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
        <div class="sub">Signed in with ${escapeHtml(provider)}${userIdLine}</div>
      </div>
      <button class="ghost" data-action="signOut">Sign out</button>
    </div>
  </div>

  ${creditsSection}
  ${recent}

  <div class="section">
    <button class="primary" data-action="managePlan">Manage plan</button>
    <div class="center"><button data-action="billingSupport">Contact billing support</button></div>
    <div class="center"><button data-action="showUsageCli">Open full usage in terminal</button></div>
  </div>
</div>`;
}
