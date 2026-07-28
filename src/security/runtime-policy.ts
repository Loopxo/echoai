import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  PermissionDecision,
  PermissionProfile,
  PermissionRule as RuntimePermissionRule,
  PermissionScope,
  RuntimePermissionOptions,
} from '@echoai/runtime';
import type {
  PermissionConfig,
  PermissionLevel,
  PermissionRule,
  SecurityProfile,
} from '../types/permissions.js';

export interface LoadedRuntimeSecurityPolicy {
  configured: boolean;
  path: string;
  options: Pick<RuntimePermissionOptions, 'profile' | 'layeredRules'>;
}

const TYPES_BY_SCOPE: Record<PermissionScope, Array<keyof PermissionConfig>> = {
  read: ['fileRead'],
  write: ['fileWrite', 'fileEdit'],
  network: ['webFetch', 'networkAccess'],
  process: ['bash', 'processManagement', 'environmentAccess', 'systemInfo'],
};

const SCOPE_BY_TYPE: Record<keyof PermissionConfig, PermissionScope> = {
  bash: 'process',
  fileRead: 'read',
  fileWrite: 'write',
  fileEdit: 'write',
  webFetch: 'network',
  networkAccess: 'network',
  systemInfo: 'process',
  processManagement: 'process',
  environmentAccess: 'process',
};

export function defaultSecurityPolicyPath(): string {
  return join(homedir(), '.echoai', 'permissions.json');
}

/**
 * Translate the legacy `echoai security` profile into the kernel's permission
 * vocabulary. Missing or invalid files intentionally mean "not configured" so
 * a broken optional policy file cannot crash the agent at startup.
 */
export function loadRuntimeSecurityPolicy(
  policyPath = defaultSecurityPolicyPath()
): LoadedRuntimeSecurityPolicy {
  if (!existsSync(policyPath)) {
    return { configured: false, path: policyPath, options: {} };
  }

  try {
    const parsed = JSON.parse(readFileSync(policyPath, 'utf8')) as unknown;
    if (!isSecurityProfile(parsed)) {
      return { configured: false, path: policyPath, options: {} };
    }

    const profile = toRuntimeProfile(parsed.permissions);
    const userRules = parsed.rules
      .map(toRuntimeRule)
      .filter((rule): rule is RuntimePermissionRule => rule !== null);

    return {
      configured: true,
      path: policyPath,
      options: {
        profile,
        layeredRules: userRules.length > 0 ? { user: userRules } : undefined,
      },
    };
  } catch {
    return { configured: false, path: policyPath, options: {} };
  }
}

export function mergeRuntimeProfiles(
  ...profiles: Array<Partial<PermissionProfile> | undefined>
): Partial<PermissionProfile> | undefined {
  const merged: Partial<PermissionProfile> = {};

  for (const scope of Object.keys(TYPES_BY_SCOPE) as PermissionScope[]) {
    const decisions = profiles
      .map((profile) => profile?.[scope])
      .filter((decision): decision is PermissionDecision => decision !== undefined);
    if (decisions.length > 0) {
      merged[scope] = mostRestrictive(decisions);
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function toLegacyPermissionType(
  scope: PermissionScope,
  toolName: string
): keyof PermissionConfig {
  if (scope === 'read') return 'fileRead';
  if (scope === 'write') {
    return /edit|patch/i.test(toolName) ? 'fileEdit' : 'fileWrite';
  }
  if (scope === 'network') {
    return /fetch|search|web/i.test(toolName) ? 'webFetch' : 'networkAccess';
  }
  return /process|task|kill/i.test(toolName) ? 'processManagement' : 'bash';
}

function toRuntimeProfile(permissions: PermissionConfig): PermissionProfile {
  return {
    read: permissionForScope(permissions, 'read'),
    write: permissionForScope(permissions, 'write'),
    network: permissionForScope(permissions, 'network'),
    process: permissionForScope(permissions, 'process'),
  };
}

function permissionForScope(
  permissions: PermissionConfig,
  scope: PermissionScope
): PermissionDecision {
  return mostRestrictive(TYPES_BY_SCOPE[scope].map((type) => permissions[type]));
}

function mostRestrictive(decisions: PermissionLevel[]): PermissionDecision {
  if (decisions.includes('deny')) return 'deny';
  if (decisions.includes('ask')) return 'ask';
  return 'allow';
}

function toRuntimeRule(rule: PermissionRule): RuntimePermissionRule | null {
  try {
    new RegExp(rule.pattern, 'i');
  } catch {
    return null;
  }

  return {
    id: rule.id,
    scope: SCOPE_BY_TYPE[rule.type],
    pattern: rule.pattern,
    decision: rule.action,
    description: rule.description,
  };
}

function isSecurityProfile(value: unknown): value is SecurityProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!record.permissions || typeof record.permissions !== 'object' || Array.isArray(record.permissions)) {
    return false;
  }

  const permissions = record.permissions as Record<string, unknown>;
  for (const type of Object.keys(SCOPE_BY_TYPE) as Array<keyof PermissionConfig>) {
    if (!isPermissionLevel(permissions[type])) return false;
  }

  if (!Array.isArray(record.rules)) return false;
  return record.rules.every(isPermissionRule);
}

function isPermissionRule(value: unknown): value is PermissionRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rule = value as Record<string, unknown>;
  return (
    typeof rule.id === 'string' &&
    typeof rule.type === 'string' &&
    rule.type in SCOPE_BY_TYPE &&
    typeof rule.pattern === 'string' &&
    (rule.action === 'allow' || rule.action === 'deny') &&
    typeof rule.description === 'string'
  );
}

function isPermissionLevel(value: unknown): value is PermissionLevel {
  return value === 'allow' || value === 'ask' || value === 'deny';
}
