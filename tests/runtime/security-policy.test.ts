import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadRuntimeSecurityPolicy,
  mergeRuntimeProfiles,
  toLegacyPermissionType,
} from '../../src/security/runtime-policy.js';

function writePolicy(overrides: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'echoai-policy-'));
  const policyPath = join(dir, 'permissions.json');
  writeFileSync(
    policyPath,
    JSON.stringify({
      name: 'strict',
      description: 'test',
      isDefault: false,
      permissions: {
        bash: 'ask',
        fileRead: 'allow',
        fileWrite: 'ask',
        fileEdit: 'deny',
        webFetch: 'allow',
        networkAccess: 'deny',
        systemInfo: 'allow',
        processManagement: 'deny',
        environmentAccess: 'ask',
      },
      rules: [],
      ...overrides,
    })
  );
  return policyPath;
}

describe('runtime security policy bridge', () => {
  it('maps the persisted security profile into kernel scopes conservatively', () => {
    const loaded = loadRuntimeSecurityPolicy(writePolicy());

    expect(loaded.configured).toBe(true);
    expect(loaded.options.profile).toEqual({
      read: 'allow',
      write: 'deny',
      network: 'deny',
      process: 'deny',
    });
  });

  it('loads valid custom rules and ignores invalid regular expressions', () => {
    const policyPath = writePolicy({
      rules: [
        {
          id: 'deny-env',
          type: 'fileRead',
          pattern: '\\.env$',
          action: 'deny',
          description: 'Protect environment files',
          createdAt: new Date().toISOString(),
          usageCount: 0,
        },
        {
          id: 'broken',
          type: 'bash',
          pattern: '[',
          action: 'allow',
          description: 'Invalid regex',
          createdAt: new Date().toISOString(),
          usageCount: 0,
        },
      ],
    });

    const loaded = loadRuntimeSecurityPolicy(policyPath);
    expect(loaded.options.layeredRules?.user).toEqual([
      expect.objectContaining({
        id: 'deny-env',
        scope: 'read',
        decision: 'deny',
      }),
    ]);
  });

  it('keeps plan mode and stored policy restrictions instead of widening either', () => {
    expect(
      mergeRuntimeProfiles(
        { read: 'ask', write: 'allow', network: 'deny', process: 'allow' },
        { read: 'allow', write: 'deny', network: 'ask', process: 'ask' }
      )
    ).toEqual({
      read: 'ask',
      write: 'deny',
      network: 'deny',
      process: 'ask',
    });
  });

  it('maps kernel requests back to the stored policy vocabulary', () => {
    expect(toLegacyPermissionType('write', 'apply_patch')).toBe('fileEdit');
    expect(toLegacyPermissionType('network', 'web_fetch')).toBe('webFetch');
    expect(toLegacyPermissionType('process', 'kill_task')).toBe('processManagement');
    expect(toLegacyPermissionType('read', 'read_file')).toBe('fileRead');
  });

  it('fails closed to the runtime defaults when the file is malformed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'echoai-policy-invalid-'));
    const policyPath = join(dir, 'permissions.json');
    writeFileSync(policyPath, '{"permissions":');

    expect(loadRuntimeSecurityPolicy(policyPath)).toMatchObject({
      configured: false,
      options: {},
    });
  });
});
