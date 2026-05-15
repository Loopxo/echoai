import { describe, expect, it } from 'vitest';
import { buildDesktopAppPaths } from './app-paths';

describe('desktop app paths', () => {
  it('derives stable app subdirectories from the OS userData path', () => {
    const paths = buildDesktopAppPaths('/Users/test/Library/Application Support/EchoAI');

    expect(paths.dataDir).toBe('/Users/test/Library/Application Support/EchoAI/data');
    expect(paths.logsDir).toBe('/Users/test/Library/Application Support/EchoAI/logs');
    expect(paths.cacheDir).toBe('/Users/test/Library/Application Support/EchoAI/cache');
    expect(paths.skillsDir).toBe('/Users/test/Library/Application Support/EchoAI/skills');
    expect(paths.mcpDir).toBe('/Users/test/Library/Application Support/EchoAI/mcp');
    expect(paths.artifactsDir).toBe('/Users/test/Library/Application Support/EchoAI/artifacts');
    expect(paths.sessionsDir).toBe('/Users/test/Library/Application Support/EchoAI/sessions');
  });
});
