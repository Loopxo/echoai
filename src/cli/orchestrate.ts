import { Command } from 'commander';
import path from 'node:path';
import {
  MultiAgentOrchestrator,
  type OrchestratorEvent,
} from '../agents/orchestration/multi-agent-orchestrator.js';

export const orchestrateCommand = new Command('orchestrate')
  .description('🧑‍🚀 Decompose a task and run multiple coding agents in parallel (planner → workers → merge)')
  .argument('<task>', 'High-level task to decompose and execute')
  .option('-p, --provider <provider>', 'Provider to use for planning and workers')
  .option('-m, --model <model>', 'Model id override')
  .option('-c, --concurrency <n>', 'Max parallel workers per layer', (v) => parseInt(v, 10), 3)
  .option('--max-turns <n>', 'Max turns per worker', (v) => parseInt(v, 10), 12)
  .option('--no-isolate', 'Disable per-worker workspace isolation (run in shared workspace)')
  .option('--verify <command>', 'Verification command to run after merge (e.g. "pnpm test")')
  .option('-w, --workspace <path>', 'Workspace root', process.cwd())
  .action(async (task: string, options) => {
    const workspacePath = path.resolve(options.workspace);

    const onEvent = (event: OrchestratorEvent): void => {
      switch (event.type) {
        case 'plan.created':
          process.stdout.write(`\n📋 Plan: ${event.subtasks.length} subtask(s)\n`);
          for (const s of event.subtasks) {
            const deps = s.dependsOn.length ? ` (after: ${s.dependsOn.join(', ')})` : '';
            process.stdout.write(`   • [${s.role}] ${s.title}${deps}\n`);
          }
          break;
        case 'layer.started':
          process.stdout.write(`\n🚀 Layer ${event.layer + 1}: running ${event.subtaskIds.length} agent(s) in parallel\n`);
          break;
        case 'subtask.started':
          process.stdout.write(`   ▶ ${event.role}: ${event.title}\n`);
          break;
        case 'subtask.completed':
          process.stdout.write(
            `   ✅ ${event.result.subtask.title} — ${event.result.changedFiles.length} file(s), ${event.result.turns} turn(s)` +
              (event.result.conflicts.length ? `, ⚠ ${event.result.conflicts.length} conflict(s)` : '') +
              `\n`
          );
          break;
        case 'subtask.failed':
          process.stdout.write(`   ❌ ${event.subtaskId}: ${event.error}\n`);
          break;
        case 'verify.started':
          process.stdout.write(`\n🔎 Verifying: ${event.command}\n`);
          break;
        case 'verify.completed':
          process.stdout.write(event.success ? `   ✅ Verification passed\n` : `   ❌ Verification failed\n`);
          break;
        case 'run.completed':
          process.stdout.write(
            `\n🏁 Done. ${event.result.changedFiles.length} file(s) changed across ${event.result.subtasks.length} subtask(s).` +
              (event.result.conflicts.length ? ` ⚠ Conflicts: ${event.result.conflicts.join(', ')}` : '') +
              `\n${event.result.succeeded ? '✅ Succeeded' : '⚠ Completed with issues'}\n`
          );
          break;
      }
    };

    const orchestrator = new MultiAgentOrchestrator({
      provider: options.provider,
      model: options.model,
      concurrency: options.concurrency,
      maxTurnsPerWorker: options.maxTurns,
      isolateWorkers: options.isolate !== false,
      verifyCommand: options.verify,
      onEvent,
    });

    try {
      const result = await orchestrator.run(task, workspacePath);
      process.exitCode = result.succeeded ? 0 : 1;
    } catch (error) {
      process.stderr.write(`\nOrchestration failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });
