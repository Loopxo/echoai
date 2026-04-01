import { describe, expect, it } from 'vitest';
import { applyUnifiedDiff, extractUnifiedDiff } from '../patch-utils.js';

describe('patch utils', () => {
  it('extracts unified diff from fenced responses', () => {
    const patch = extractUnifiedDiff([
      '```diff',
      '--- a/example.ts',
      '+++ b/example.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '```',
    ].join('\n'));

    expect(patch).toBe([
      '--- a/example.ts',
      '+++ b/example.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n'));
  });

  it('applies a unified diff to content', () => {
    const result = applyUnifiedDiff(
      'const value = 1;\n',
      [
        '--- a/example.ts',
        '+++ b/example.ts',
        '@@ -1 +1 @@',
        '-const value = 1;',
        '+const value = 2;',
      ].join('\n')
    );

    expect(result).toBe('const value = 2;\n');
  });
});
