import { describe, expect, it } from 'vitest';
import { isEchoAIProtocolUrl, isIpcInvokeChannel, isSafeExternalUrl } from './ipc';

describe('desktop IPC contract guards', () => {
  it('allows only declared invoke channels', () => {
    expect(isIpcInvokeChannel('app:getSnapshot')).toBe(true);
    expect(isIpcInvokeChannel('desktop:getWorkbenchSnapshot')).toBe(true);
    expect(isIpcInvokeChannel('fs:readFile')).toBe(false);
  });

  it('detects EchoAI protocol links', () => {
    expect(isEchoAIProtocolUrl('echoai://auth/callback?code=test')).toBe(true);
    expect(isEchoAIProtocolUrl('https://echoai.local/auth')).toBe(false);
  });

  it('allows only safe external protocols', () => {
    expect(isSafeExternalUrl('https://echoai.local')).toBe(true);
    expect(isSafeExternalUrl('mailto:support@example.com')).toBe(true);
    expect(isSafeExternalUrl('file:///Users/main/.ssh/id_rsa')).toBe(false);
  });
});
