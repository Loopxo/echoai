import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';

/**
 * Echo AI account for the IDE.
 *
 * Echo AI IDE is an Echo AI product, so the account is a first-class part of the
 * workbench rather than a setting. This registers a real VS Code authentication
 * provider, which is what makes the Accounts button in the activity bar offer
 * "Sign in with Echo AI" instead of doing nothing.
 *
 * Credentials live in the same `~/.echoai/auth.json` the CLI writes, so signing in
 * from the IDE also signs in the bundled agent runtime and the `echoai` CLI, and
 * signing out from either side is seen by both.
 */

const AUTH_DIRECTORY = join(homedir(), '.echoai');
const AUTH_FILE = join(AUTH_DIRECTORY, 'auth.json');
const DEFAULT_API_URL = 'https://echoai.loopxo.org';

export const ECHO_AUTH_PROVIDER_ID = 'echoai';
export const ECHO_AUTH_PROVIDER_LABEL = 'Echo AI';

interface EchoAuthFile {
	accessToken: string;
	refreshToken: string;
	apiUrl: string;
	expiresAt: string;
}

interface DeviceStartResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete?: string;
	expires_in: number;
	interval: number;
}

interface TokenResponse {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	api_url?: string;
	error?: string;
}

export interface EchoAccountState {
	signedIn: boolean;
	apiUrl: string;
	expiresAt?: string;
	/** Remaining credit in dollars, when the usage endpoint has been read. */
	balance?: number;
	plan?: string;
}

export interface EchoIdentity {
	email?: string;
	name?: string;
	userId?: string;
	signedInWith?: string;
}

export interface EchoUsageDetail {
	balance?: number;
	totalGranted?: number;
	totalSpent?: number;
	hourlyLimit?: number;
	hourlySpent?: number;
	resetDate?: string;
	plan?: { name: string; priceCents?: number };
	recent: {
		model: string;
		inputTokens: number;
		outputTokens: number;
		cost: number;
		createdAt?: string;
	}[];
}

/** Decode a JWT payload without verifying it. Display only; never a trust decision. */
function decodeJwtClaims(token: string): Record<string, unknown> {
	const segments = token.split('.');
	if (segments.length < 2) return {};
	const payload = segments[1];
	if (!payload) return {};
	try {
		const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
		const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as unknown;
		return typeof decoded === 'object' && decoded !== null ? (decoded as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function pickString(claims: Record<string, unknown>, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = claims[key];
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return undefined;
}

function friendlyProvider(value: string): string {
	const lower = value.toLowerCase();
	if (lower.includes('google')) return 'Google';
	if (lower.includes('github')) return 'GitHub';
	if (lower.includes('microsoft') || lower.includes('azure')) return 'Microsoft';
	if (lower.includes('apple')) return 'Apple';
	return 'Echo AI';
}

function trimSlash(value: string): string {
	return value.replace(/\/$/, '');
}

function apiUrlFromEnvironment(): string {
	const configured = vscode.workspace
		.getConfiguration('echoAI')
		.get<string>('apiUrl', '')
		.trim();
	return trimSlash(configured || process.env.ECHOAI_API_URL?.trim() || DEFAULT_API_URL);
}

export class EchoAccountService implements vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<EchoAccountState>();
	private cached: EchoAuthFile | null | undefined;
	private inFlightLogin: Promise<EchoAccountState> | undefined;

	readonly onDidChange = this.changeEmitter.event;

	dispose(): void {
		this.changeEmitter.dispose();
	}

	async readAuth(): Promise<EchoAuthFile | null> {
		if (this.cached !== undefined) {
			return this.cached;
		}
		if (!existsSync(AUTH_FILE)) {
			this.cached = null;
			return null;
		}
		try {
			const parsed = JSON.parse(await readFile(AUTH_FILE, 'utf8')) as EchoAuthFile;
			this.cached = parsed.accessToken ? parsed : null;
		} catch {
			// A corrupt file is treated as signed out rather than blocking the IDE.
			this.cached = null;
		}
		return this.cached;
	}

	async getState(): Promise<EchoAccountState> {
		const auth = await this.readAuth();
		return auth
			? { signedIn: true, apiUrl: auth.apiUrl, expiresAt: auth.expiresAt }
			: { signedIn: false, apiUrl: apiUrlFromEnvironment() };
	}

	/**
	 * Device-code sign in. The user code is copied to the clipboard and the
	 * verification page opened, then the poll runs against a cancellable progress
	 * notification so it can never wedge the window.
	 */
	async signIn(): Promise<EchoAccountState> {
		if (this.inFlightLogin) {
			return this.inFlightLogin;
		}
		this.inFlightLogin = this.runDeviceLogin().finally(() => {
			this.inFlightLogin = undefined;
		});
		return this.inFlightLogin;
	}

	private async runDeviceLogin(): Promise<EchoAccountState> {
		const apiUrl = apiUrlFromEnvironment();
		const start = await this.postJson<DeviceStartResponse>(`${apiUrl}/auth/device/start`, {});
		if (!start.device_code || !start.user_code) {
			throw new Error('Echo AI did not return a device code.');
		}

		const verificationUrl = start.verification_uri_complete || start.verification_uri;
		await vscode.env.clipboard.writeText(start.user_code);

		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Signing in to Echo AI — code ${start.user_code} (copied)`,
				cancellable: true,
			},
			async (progress, token) => {
				progress.report({ message: 'Waiting for authorization in your browser...' });
				if (verificationUrl) {
					await vscode.env.openExternal(vscode.Uri.parse(verificationUrl));
				}

				const intervalMs = Math.max(1, start.interval || 5) * 1000;
				const deadline = Date.now() + (start.expires_in || 600) * 1000;

				while (Date.now() < deadline) {
					if (token.isCancellationRequested) {
						throw new Error('Echo AI sign in was cancelled.');
					}
					await new Promise((resolve) => setTimeout(resolve, intervalMs));
					if (token.isCancellationRequested) {
						throw new Error('Echo AI sign in was cancelled.');
					}

					const body = await this.postJson<TokenResponse>(
						`${apiUrl}/auth/device/poll`,
						{ device_code: start.device_code },
						// A pending authorization is a normal poll result, not a failure.
						true,
					);

					if (body.access_token && body.refresh_token) {
						await this.saveAuth({
							accessToken: body.access_token,
							refreshToken: body.refresh_token,
							apiUrl: trimSlash(body.api_url || apiUrl),
							expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString(),
						});
						const state = await this.getState();
						this.changeEmitter.fire(state);
						return state;
					}

					if (body.error && body.error !== 'authorization_pending' && body.error !== 'slow_down') {
						throw new Error(`Echo AI sign in failed: ${body.error}`);
					}
				}

				throw new Error('Echo AI sign in timed out. Try again.');
			},
		);
	}

	async signOut(): Promise<EchoAccountState> {
		await rm(AUTH_FILE, { force: true });
		this.cached = null;
		const state = await this.getState();
		this.changeEmitter.fire(state);
		return state;
	}

	/** Fetch plan and remaining credit for display. Never throws. */
	async readUsage(): Promise<{ balance?: number; plan?: string }> {
		const detail = await this.readUsageDetail();
		return { balance: detail?.balance, plan: detail?.plan?.name };
	}

	/**
	 * Full usage payload for the profile page. Amounts are converted from the
	 * micro-cents the API reports into dollars. Returns undefined rather than
	 * throwing so the profile can render a signed-in state without billing data.
	 */
	async readUsageDetail(): Promise<EchoUsageDetail | undefined> {
		const auth = await this.readAuth();
		if (!auth) return undefined;
		try {
			const response = await fetch(`${trimSlash(auth.apiUrl)}/usage`, {
				headers: { Authorization: `Bearer ${auth.accessToken}` },
			});
			if (!response.ok) return undefined;
			const usage = (await response.json()) as {
				balance?: number;
				totalGranted?: number;
				totalSpent?: number;
				hourlyLimit?: number;
				hourlySpent?: number;
				resetDate?: string;
				plan?: { id?: string; name?: string; priceCents?: number };
				lastRequests?: {
					model?: string;
					inputTokens?: number;
					outputTokens?: number;
					cost?: number;
					createdAt?: string;
				}[];
			};
			const dollars = (value: unknown): number | undefined =>
				typeof value === 'number' ? value / 1_000_000 : undefined;
			return {
				balance: dollars(usage.balance),
				totalGranted: dollars(usage.totalGranted),
				totalSpent: dollars(usage.totalSpent),
				hourlyLimit: dollars(usage.hourlyLimit),
				hourlySpent: dollars(usage.hourlySpent),
				resetDate: usage.resetDate,
				plan: usage.plan?.name
					? {
							name: usage.plan.name,
							priceCents: typeof usage.plan.priceCents === 'number' ? usage.plan.priceCents : undefined,
						}
					: undefined,
				recent: (usage.lastRequests ?? []).slice(0, 8).map((entry) => ({
					model: entry.model ?? 'unknown',
					inputTokens: entry.inputTokens ?? 0,
					outputTokens: entry.outputTokens ?? 0,
					cost: dollars(entry.cost) ?? 0,
					createdAt: entry.createdAt,
				})),
			};
		} catch {
			return undefined;
		}
	}

	/**
	 * Identity for the profile header.
	 *
	 * There is no identity endpoint, so the claims are read out of the access token
	 * rather than inventing an API call. Anything missing simply is not displayed.
	 */
	async readIdentity(): Promise<EchoIdentity> {
		const auth = await this.readAuth();
		if (!auth) return {};
		const claims = decodeJwtClaims(auth.accessToken);
		const email = pickString(claims, ['email', 'preferred_username', 'upn']);
		const name = pickString(claims, ['name', 'given_name', 'nickname']);
		const subject = pickString(claims, ['sub', 'user_id', 'uid']);
		const via = pickString(claims, ['provider', 'idp', 'iss']);
		return {
			email,
			name,
			userId: subject,
			signedInWith: via ? friendlyProvider(via) : undefined,
		};
	}

	private async saveAuth(auth: EchoAuthFile): Promise<void> {
		await mkdir(AUTH_DIRECTORY, { recursive: true, mode: 0o700 });
		await writeFile(AUTH_FILE, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
		this.cached = auth;
	}

	private async postJson<T>(
		url: string,
		body: unknown,
		tolerateErrorBody = false,
	): Promise<T> {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body ?? {}),
		});
		const text = await response.text();
		const data = (text ? JSON.parse(text) : {}) as T & { error?: string };
		if (!response.ok && !tolerateErrorBody) {
			throw new Error(
				`Echo AI request failed (${response.status}): ${data.error ?? response.statusText}`,
			);
		}
		return data;
	}
}

/**
 * Bridges the Echo account into the workbench Accounts menu, so the profile button
 * in the activity bar is a working Echo AI sign in.
 */
export class EchoAuthenticationProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly sessionsEmitter =
		new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private readonly disposables: vscode.Disposable[] = [];

	readonly onDidChangeSessions = this.sessionsEmitter.event;

	constructor(private readonly account: EchoAccountService) {
		this.disposables.push(
			this.account.onDidChange(() => {
				// The concrete added/removed lists are not needed by the Accounts menu;
				// it re-reads sessions whenever this fires.
				this.sessionsEmitter.fire({ added: [], removed: [], changed: [] });
			}),
			this.sessionsEmitter,
		);
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	async getSessions(): Promise<vscode.AuthenticationSession[]> {
		const auth = await this.account.readAuth();
		if (!auth) return [];
		const usage = await this.account.readUsage();
		const label = usage.plan
			? `Echo AI — ${usage.plan}`
			: 'Echo AI';
		return [
			{
				id: ECHO_AUTH_PROVIDER_ID,
				accessToken: auth.accessToken,
				account: { id: ECHO_AUTH_PROVIDER_ID, label },
				scopes: [],
			},
		];
	}

	async createSession(): Promise<vscode.AuthenticationSession> {
		await this.account.signIn();
		const sessions = await this.getSessions();
		const session = sessions[0];
		if (!session) {
			throw new Error('Echo AI sign in did not produce a session.');
		}
		return session;
	}

	async removeSession(): Promise<void> {
		await this.account.signOut();
	}
}
