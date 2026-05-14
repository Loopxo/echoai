import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Command } from 'commander';

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
  access_token: string;
  refresh_token: string;
  expires_in: number;
  api_url?: string;
  error?: string;
}

const authDir = join(homedir(), '.echoai');
const authFile = join(authDir, 'auth.json');

export const loginCommand = new Command('login')
  .description('Login to the hosted EchoAI ecosystem via device-code flow')
  .option('--api-url <url>', 'EchoAI API URL', process.env.ECHOAI_API_URL || 'https://echoai.loopxo.org')
  .action(async (options: { apiUrl: string }) => {
    await startDeviceLogin(options.apiUrl);
  });

export const usageCommand = new Command('usage')
  .description('View current token usage and credit balance')
  .option('--api-url <url>', 'Override EchoAI API URL')
  .action(async (options: { apiUrl?: string }) => {
    await printUsage(options.apiUrl);
  });

export async function startDeviceLogin(apiUrl = process.env.ECHOAI_API_URL || 'https://echoai.loopxo.org'): Promise<void> {
  const normalizedApiUrl = trimTrailingSlash(apiUrl);
  console.log('Starting EchoAI device login...');

  const start = await fetchJson<DeviceStartResponse>(`${normalizedApiUrl}/auth/device/start`, {
    method: 'POST',
  });

  console.log(`Open: ${start.verification_uri_complete || start.verification_uri}`);
  console.log(`Code: ${start.user_code}`);
  console.log('Waiting for authorization...');

  const startedAt = Date.now();
  const expiresAtMs = startedAt + start.expires_in * 1000;
  while (Date.now() < expiresAtMs) {
    await delay(Math.max(1, start.interval) * 1000);
    const poll = await fetch(`${normalizedApiUrl}/auth/device/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_code: start.device_code }),
    });
    const body = await poll.json() as TokenResponse;

    if (body.access_token && body.refresh_token) {
      await saveAuth({
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        apiUrl: body.api_url || normalizedApiUrl,
        expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
      });
      console.log(`Logged in. Token saved to ${authFile}`);
      return;
    }

    if (body.error !== 'authorization_pending') {
      throw new Error(`Login failed: ${body.error || poll.statusText}`);
    }
  }

  throw new Error('Login timed out. Run `echoai login` again.');
}

export async function printUsage(apiUrlOverride?: string): Promise<void> {
  const auth = await getValidAuth(apiUrlOverride);
  const response = await fetch(`${trimTrailingSlash(auth.apiUrl)}/usage`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Usage request failed: ${response.status} ${await response.text()}`);
  }

  const usage = await response.json() as {
    balance: number;
    totalGranted: number;
    totalSpent: number;
    hourlyLimit?: number;
    hourlySpent?: number;
    resetDate?: string;
    plan?: { id: string; name: string; priceCents: number };
    lastRequests?: Array<{ model: string; inputTokens: number; outputTokens: number; cost: number; createdAt?: string }>;
  };

  console.log('\n--- EchoAI Usage ---');
  if (usage.plan) console.log(`Plan:              ${usage.plan.name} ($${(usage.plan.priceCents / 100).toFixed(2)}/month)`);
  console.log(`Remaining credit:  ${formatCredit(usage.balance)}`);
  console.log(`Granted this term: ${formatCredit(usage.totalGranted)}`);
  console.log(`Spent this term:   ${formatCredit(usage.totalSpent)}`);
  if (typeof usage.hourlyLimit === 'number') {
    console.log(`Hourly limit:      ${formatCredit(usage.hourlySpent || 0)} / ${formatCredit(usage.hourlyLimit)}`);
  }
  if (usage.resetDate) console.log(`Reset date:        ${new Date(usage.resetDate).toLocaleString()}`);
  if (usage.lastRequests?.length) {
    console.log('\nRecent requests:');
    for (const request of usage.lastRequests.slice(0, 10)) {
      const when = request.createdAt ? new Date(request.createdAt).toLocaleString() : 'unknown time';
      console.log(`  ${when}  ${request.model}  ${request.inputTokens} in / ${request.outputTokens} out  ${formatCredit(request.cost)}`);
    }
  }
  console.log('--------------------\n');
}

export async function getValidAuth(apiUrlOverride?: string): Promise<EchoAuthFile> {
  const auth = await readAuth();
  if (!auth) throw new Error('Not logged in. Run `echoai login` first.');
  if (apiUrlOverride) auth.apiUrl = trimTrailingSlash(apiUrlOverride);

  const expiresSoon = new Date(auth.expiresAt).getTime() < Date.now() + 60_000;
  if (!expiresSoon) return auth;

  const refreshed = await refreshAuth(auth);
  await saveAuth(refreshed);
  return refreshed;
}

async function refreshAuth(auth: EchoAuthFile): Promise<EchoAuthFile> {
  const refreshed = await fetchJson<TokenResponse>(`${trimTrailingSlash(auth.apiUrl)}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refreshToken }),
  });
  if (!refreshed.access_token || !refreshed.refresh_token) {
    throw new Error(`Token refresh failed: ${refreshed.error || 'invalid response'}`);
  }
  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    apiUrl: refreshed.api_url || auth.apiUrl,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };
}

async function saveAuth(auth: EchoAuthFile): Promise<void> {
  await mkdir(authDir, { recursive: true, mode: 0o700 });
  await writeFile(authFile, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
}

async function readAuth(): Promise<EchoAuthFile | null> {
  if (!existsSync(authFile)) return null;
  try {
    return JSON.parse(await readFile(authFile, 'utf8')) as EchoAuthFile;
  } catch {
    throw new Error(`Could not read ${authFile}. Delete it and run \`echoai login\` again.`);
  }
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = typeof data === 'object' && data && 'error' in data ? String((data as { error?: unknown }).error) : response.statusText;
    throw new Error(`Request failed: ${response.status} ${error}`);
  }
  return data as T;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function formatCredit(amountMicroCents: number): string {
  return `$${(amountMicroCents / 1_000_000).toFixed(4)}`;
}
