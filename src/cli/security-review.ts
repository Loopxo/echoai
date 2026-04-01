import { Command } from 'commander';
import { collectReviewFiles } from '../review/files.js';
import { scanSecurityFindings, type ReviewFinding } from '../review/heuristics.js';

export const securityReviewCommand = new Command('security-review')
  .description('Review changed files for likely security issues')
  .argument('[files...]', 'Optional files to review')
  .option('--staged', 'Review only staged files')
  .action(async (files: string[], options) => {
    const reviewFiles = await collectReviewFiles(process.cwd(), files, options.staged === true);

    if (reviewFiles.length === 0) {
      console.log('No files available for security review.');
      return;
    }

    const findings = reviewFiles
      .flatMap((file) => scanSecurityFindings(file.filePath, file.content))
      .sort(compareFindings);

    if (findings.length === 0) {
      console.log('No security review findings.');
      console.log(`Scanned ${reviewFiles.length} file(s). Residual risk: auth, data-flow, and dependency issues still need manual verification.`);
      return;
    }

    console.log(`Found ${findings.length} security finding(s):\n`);
    findings.forEach((finding, index) => {
      console.log(`${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
      console.log(`   ${finding.filePath}:${finding.line}`);
      console.log(`   ${finding.body}\n`);
    });
  });

function compareFindings(left: ReviewFinding, right: ReviewFinding): number {
  return severityRank(left.severity) - severityRank(right.severity)
    || left.filePath.localeCompare(right.filePath)
    || left.line - right.line;
}

function severityRank(severity: ReviewFinding['severity']): number {
  switch (severity) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    case 'low':
      return 2;
  }
}
