import path from 'node:path';

export interface ReviewFinding {
  filePath: string;
  line: number;
  severity: 'high' | 'medium' | 'low';
  title: string;
  body: string;
}

interface PatternRule {
  pattern: RegExp;
  severity: ReviewFinding['severity'];
  title: string;
  body: string;
  predicate?: (filePath: string) => boolean;
}

const generalRules: PatternRule[] = [
  {
    pattern: /\b(?:TODO|FIXME|HACK)\b/,
    severity: 'low',
    title: 'Leftover work marker',
    body: 'This change still contains a TODO/FIXME/HACK marker and should be resolved or tracked explicitly before merge.',
  },
  {
    pattern: /\bconsole\.log\s*\(/,
    severity: 'low',
    title: 'Console logging left in code',
    body: 'Console logging usually leaks debug noise into production paths unless it is intentionally part of the runtime contract.',
  },
  {
    pattern: /\bdebugger\b/,
    severity: 'medium',
    title: 'Debugger statement committed',
    body: 'A debugger statement will interrupt execution in attached environments and should not ship accidentally.',
  },
  {
    pattern: /\b(?:as any|:\s*any\b)/,
    severity: 'medium',
    title: 'Type safety bypass',
    body: 'Using any weakens the contract around this change and can hide integration bugs at compile time.',
  },
  {
    pattern: /@ts-ignore/,
    severity: 'medium',
    title: 'TypeScript error suppression',
    body: 'Suppressing the type checker here may hide a real incompatibility introduced by this change.',
  },
  {
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: 'medium',
    title: 'Empty catch block',
    body: 'Swallowing errors without handling or logging makes failures invisible and complicates debugging.',
  },
  {
    pattern: /\.(only)\s*\(/,
    severity: 'high',
    title: 'Focused test committed',
    body: 'A focused test leaves the rest of the suite unexecuted and can mask regressions in CI.',
    predicate: isTestFile,
  },
  {
    pattern: /\b(?:test|describe)\.skip\s*\(/,
    severity: 'medium',
    title: 'Skipped test added',
    body: 'A skipped test reduces coverage around the affected behavior and should usually be justified in the change.',
    predicate: isTestFile,
  },
];

const securityRules: PatternRule[] = [
  {
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    severity: 'high',
    title: 'Private key material in source',
    body: 'This file appears to contain private key material and should not be committed to the repository.',
  },
  {
    pattern: /\b(?:sk_live|sk_test|ghp_[A-Za-z0-9]|AIza[0-9A-Za-z\-_]{20,}|xox[baprs]-)\b/,
    severity: 'high',
    title: 'Possible credential in source',
    body: 'This line matches a common secret token format and should be treated as credential leakage until proven otherwise.',
  },
  {
    pattern: /\beval\s*\(/,
    severity: 'high',
    title: 'Dynamic code execution',
    body: 'Using eval allows arbitrary code execution and should be avoided unless the input is tightly controlled and isolated.',
  },
  {
    pattern: /\bnew Function\s*\(/,
    severity: 'high',
    title: 'Dynamic function construction',
    body: 'Constructing functions from strings creates the same execution risk profile as eval.',
  },
  {
    pattern: /\bdangerouslySetInnerHTML\b/,
    severity: 'high',
    title: 'Raw HTML injection surface',
    body: 'Rendering raw HTML creates an XSS boundary and requires strong sanitization guarantees.',
  },
  {
    pattern: /\.innerHTML\s*=/,
    severity: 'high',
    title: 'Direct innerHTML assignment',
    body: 'Assigning to innerHTML can introduce XSS if any part of the payload is user-controlled.',
  },
  {
    pattern: /\bexec(?:Sync)?\s*\(/,
    severity: 'high',
    title: 'Shell execution API used',
    body: 'Executing shell commands directly is a command-injection risk unless arguments are strictly controlled and escaped.',
  },
  {
    pattern: /\bspawn(?:Sync)?\s*\(/,
    severity: 'medium',
    title: 'Process spawn added',
    body: 'Process spawning creates an execution boundary that needs argument validation and careful permission handling.',
  },
  {
    pattern: /\bSELECT\b.+\$\{/i,
    severity: 'high',
    title: 'Interpolated SQL query',
    body: 'Interpolating values directly into SQL text is a likely SQL injection risk; parameterized queries are safer.',
  },
  {
    pattern: /\b(?:api[_-]?key|password|secret|token)\b\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i,
    severity: 'high',
    title: 'Hard-coded secret-like value',
    body: 'This assignment looks like a secret embedded directly in source instead of coming from secure configuration.',
  },
];

export function scanCodeReviewFindings(filePath: string, content: string): ReviewFinding[] {
  return scanWithRules(filePath, content, generalRules);
}

export function scanSecurityFindings(filePath: string, content: string): ReviewFinding[] {
  return scanWithRules(filePath, content, securityRules);
}

function scanWithRules(filePath: string, content: string, rules: PatternRule[]): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.predicate && !rule.predicate(filePath)) {
        continue;
      }

      if (!rule.pattern.test(line)) {
        continue;
      }

      findings.push({
        filePath,
        line: index + 1,
        severity: rule.severity,
        title: rule.title,
        body: rule.body,
      });
    }
  });

  return dedupeFindings(findings);
}

function dedupeFindings(findings: ReviewFinding[]): ReviewFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.filePath}:${finding.line}:${finding.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isTestFile(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/');
  return normalized.includes('/__tests__/')
    || normalized.endsWith('.test.ts')
    || normalized.endsWith('.test.tsx')
    || normalized.endsWith('.spec.ts')
    || normalized.endsWith('.spec.tsx');
}
