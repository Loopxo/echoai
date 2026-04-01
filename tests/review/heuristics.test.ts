import { describe, expect, it } from 'vitest';
import { scanCodeReviewFindings, scanSecurityFindings } from '../../src/review/heuristics.js';

describe('review heuristics', () => {
  it('finds common code review issues', () => {
    const findings = scanCodeReviewFindings(
      '/tmp/example.test.ts',
      [
        'console.log("debug");',
        'test.only("focused", () => {});',
        '// TODO: remove this',
      ].join('\n')
    );

    expect(findings.map((finding) => finding.title).sort()).toEqual([
      'Console logging left in code',
      'Focused test committed',
      'Leftover work marker',
    ].sort());
  });

  it('finds common security issues', () => {
    const findings = scanSecurityFindings(
      '/tmp/server.ts',
      [
        'const token = "stripe_test_fixture_token_redacted";',
        'const html = { dangerouslySetInnerHTML: { __html: content } };',
        'eval(userInput);',
      ].join('\n')
    );

    expect(findings.map((finding) => finding.title).sort()).toEqual([
      'Hard-coded secret-like value',
      'Raw HTML injection surface',
      'Dynamic code execution',
    ].sort());
  });
});
