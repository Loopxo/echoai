import { Command } from 'commander';
import { collectReviewFiles } from '../review/files.js';
import { scanSecurityFindings, type ReviewFinding } from '../review/heuristics.js';
import { ensureWorkflowSession, getWorkflowKernel } from '../runtime/workflow-session.js';

export const securityReviewCommand = new Command('security-review')
  .description('Review changed files for likely security issues')
  .argument('[files...]', 'Optional files to review')
  .option('--staged', 'Review only staged files')
  .option('-s, --session <session-id>', 'Attach the review to an existing runtime session')
  .action(async (files: string[], options) => {
    const kernel = getWorkflowKernel();
    const session = await ensureWorkflowSession('Security Review', options.session);
    const task = await kernel.addTask(session.id, {
      kind: 'review',
      title: 'Security review',
      status: 'running',
      detail: 'Scanning changed files for likely security issues',
      metadata: {
        staged: options.staged === true,
        files,
      },
    });

    const reviewFiles = await collectReviewFiles(process.cwd(), files, options.staged === true);

    if (reviewFiles.length === 0) {
      await kernel.updateTask(session.id, task.id, {
        status: 'completed',
        detail: 'No files available for security review',
      });
      console.log('No files available for security review.');
      return;
    }

    const findings = reviewFiles
      .flatMap((file) => scanSecurityFindings(file.filePath, file.content))
      .sort(compareFindings);

    if (findings.length === 0) {
      const report = `No security review findings.\nScanned ${reviewFiles.length} file(s). Residual risk: auth, data-flow, and dependency issues still need manual verification.`;
      await persistWorkflowReport(session.id, task.id, 'security-review-report', 'Security Review Report', report);
      console.log('No security review findings.');
      console.log(`Scanned ${reviewFiles.length} file(s). Residual risk: auth, data-flow, and dependency issues still need manual verification.`);
      return;
    }

    const report = formatFindingsReport(findings);
    await persistWorkflowReport(session.id, task.id, 'security-review-report', 'Security Review Report', report);
    process.stdout.write(`${report}\n`);
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

function formatFindingsReport(findings: ReviewFinding[]): string {
  return [
    `Found ${findings.length} security finding(s):`,
    '',
    ...findings.flatMap((finding, index) => [
      `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`,
      `   ${finding.filePath}:${finding.line}`,
      `   ${finding.body}`,
      '',
    ]),
  ].join('\n').trimEnd();
}

async function persistWorkflowReport(
  sessionId: string,
  taskId: string,
  artifactId: string,
  artifactLabel: string,
  report: string
) {
  const kernel = getWorkflowKernel();
  await kernel.appendMessage(sessionId, 'assistant', report, {
    metadata: { workflow: artifactId },
  });
  await kernel.addArtifact(sessionId, {
    label: artifactLabel,
    type: 'report',
    content: report,
    metadata: { workflow: artifactId },
  });
  await kernel.updateTask(sessionId, taskId, {
    status: 'completed',
    detail: artifactLabel,
  });
}
