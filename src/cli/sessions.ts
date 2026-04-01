import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import type { KernelMessage, KernelSession } from '@echoai/runtime';
import { SessionStore } from '../storage/session-store.js';
import { runInteractiveChatSession } from '../runtime/chat-loop.js';
import { getCliSessionRegistry, runtimeSessionToMetadata, runtimeSessionToSessionData } from '../runtime/session-bridge.js';
import { SessionData, SessionExport, SessionFilter, SessionMetadata } from '../types/session.js';

const sessionStore = new SessionStore();
const sessionRegistry = getCliSessionRegistry();

export const sessionsCommand = new Command()
  .name('sessions')
  .description('Manage and browse conversation sessions');

sessionsCommand
  .command('list')
  .description('List all saved sessions')
  .option('-p, --provider <provider>', 'Filter by provider')
  .option('-m, --model <model>', 'Filter by model')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-s, --search <query>', 'Search in session titles and content')
  .option('--limit <number>', 'Limit number of results', parseInt)
  .action(async (options) => {
    const filter = buildSessionFilter(options);
    const sessions = await listAllSessions(filter);
    const limitedSessions = options.limit ? sessions.slice(0, options.limit) : sessions;

    if (limitedSessions.length === 0) {
      console.log('No sessions found matching the criteria.');
      return;
    }

    console.log(`\nFound ${limitedSessions.length} session(s):\n`);

    limitedSessions.forEach((session, index) => {
      const costDisplay = session.cost ? ` ($${session.cost.toFixed(4)})` : '';
      const tagsDisplay = session.tags ? ` [${session.tags.join(', ')}]` : '';

      console.log(`${index + 1}. ${session.title}`);
      console.log(`   ID: ${session.id}`);
      console.log(`   Model: ${session.provider}/${session.model}`);
      console.log(`   Messages: ${session.messageCount}, Tokens: ${session.totalTokens}${costDisplay}`);
      console.log(`   Updated: ${session.updatedAt.toLocaleString()}${tagsDisplay}\n`);
    });
  });

sessionsCommand
  .command('show')
  .description('Show detailed session information')
  .argument('<session-id>', 'Session ID to display')
  .option('--messages', 'Include message history')
  .action(async (sessionId, options) => {
    const record = await loadSessionRecord(sessionId);

    if (!record) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    if (record.kind === 'runtime') {
      printRuntimeSession(record.session, options.messages === true);
      return;
    }

    printLegacySession(record.session, options.messages === true);
  });

sessionsCommand
  .command('resume')
  .description('Resume a session in interactive chat mode')
  .argument('<session-id>', 'Session ID to resume')
  .option('-p, --provider <provider>', 'Override provider for resumed session')
  .option('-m, --model <model>', 'Override model for resumed session')
  .option('-t, --temperature <number>', 'Temperature (0-1)', parseFloat)
  .option('--max-tokens <number>', 'Max tokens', parseInt)
  .action(async (sessionId, options) => {
    await runInteractiveChatSession({
      sessionId,
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  });

sessionsCommand
  .command('delete')
  .description('Delete a session')
  .argument('<session-id>', 'Session ID to delete')
  .option('--force', 'Skip confirmation')
  .action(async (sessionId, options) => {
    if (!options.force) {
      const { default: inquirer } = await import('inquirer');
      const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: `Are you sure you want to delete session ${sessionId}?`,
        default: false,
      }]);

      if (!confirmed) {
        console.log('Deletion cancelled.');
        return;
      }
    }

    const runtimeDeleted = await sessionRegistry.delete(sessionId);
    const legacyDeleted = runtimeDeleted ? false : await sessionStore.deleteSession(sessionId);

    if (runtimeDeleted || legacyDeleted) {
      console.log(`✅ Session ${sessionId} deleted successfully.`);
      return;
    }

    console.error(`❌ Session ${sessionId} not found.`);
    process.exit(1);
  });

sessionsCommand
  .command('export')
  .description('Export session data')
  .argument('<session-id>', 'Session ID to export')
  .option('-f, --format <format>', 'Export format (json, markdown, text)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('--no-metadata', 'Exclude metadata')
  .option('--no-context', 'Exclude context')
  .option('--range <range>', 'Message range (e.g., "1-10")')
  .action(async (sessionId, options) => {
    const record = await loadSessionRecord(sessionId);

    if (!record) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    const exportOptions: SessionExport = {
      format: options.format,
      includeMetadata: options.metadata !== false,
      includeContext: options.context !== false,
    };

    if (options.range) {
      const [from, to] = options.range.split('-').map((value: string) => parseInt(value.trim(), 10));
      if (Number.isNaN(from) || Number.isNaN(to)) {
        console.error('Invalid range format. Use "from-to" (e.g., "1-10").');
        process.exit(1);
      }
      exportOptions.messageRange = { from: from - 1, to: to - 1 };
    }

    const exportData = record.kind === 'runtime'
      ? exportRuntimeSession(record.session, exportOptions)
      : await exportLegacySession(record.session, exportOptions);
    const filename = options.output || `session-${sessionId}.${options.format}`;

    await writeFile(filename, exportData);
    console.log(`✅ Session exported to ${filename}`);
  });

sessionsCommand
  .command('share')
  .description('Create a shareable link for a session')
  .argument('<session-id>', 'Session ID to share')
  .option('--public', 'Make the share public')
  .option('--password <password>', 'Protect with password')
  .option('--expires <days>', 'Expiration in days', parseInt)
  .action(async (sessionId, options) => {
    const record = await loadSessionRecord(sessionId);

    if (!record) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    if (record.kind === 'runtime') {
      await sessionStore.saveSession(runtimeSessionToSessionData(record.session));
    }

    const shareOptions: {
      expiresAt?: Date;
      isPublic?: boolean;
      password?: string;
    } = {
      isPublic: options.public || false,
      password: options.password,
    };

    if (options.expires) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + options.expires);
      shareOptions.expiresAt = expirationDate;
    }

    const share = await sessionStore.createShare(sessionId, shareOptions);

    console.log('✅ Share created successfully!');
    console.log(`Share URL: ${share.shareUrl}`);

    if (share.password) {
      console.log(`Password: ${share.password}`);
    }

    if (share.expiresAt) {
      console.log(`Expires: ${share.expiresAt.toLocaleString()}`);
    }
  });

sessionsCommand
  .command('stats')
  .description('Show session statistics')
  .action(async () => {
    const sessions = await listAllSessions({});
    const stats = buildStats(sessions);

    console.log('\n📊 Session Statistics:');
    console.log(`Total Sessions: ${stats.totalSessions}`);
    console.log(`Total Messages: ${stats.totalMessages}`);
    console.log(`Total Tokens: ${stats.totalTokens.toLocaleString()}`);

    if (stats.totalCost > 0) {
      console.log(`Total Cost: $${stats.totalCost.toFixed(4)}`);
    }

    if (Object.keys(stats.providerBreakdown).length > 0) {
      console.log('\nProvider Breakdown:');
      Object.entries(stats.providerBreakdown)
        .sort(([, a], [, b]) => b - a)
        .forEach(([provider, count]) => {
          console.log(`  ${provider}: ${count} sessions`);
        });
    }

    if (Object.keys(stats.modelBreakdown).length > 0) {
      console.log('\nModel Breakdown:');
      Object.entries(stats.modelBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([model, count]) => {
          console.log(`  ${model}: ${count} sessions`);
        });
    }
  });

function buildSessionFilter(options: {
  provider?: string;
  model?: string;
  tags?: string;
  search?: string;
}): SessionFilter {
  const filter: SessionFilter = {};

  if (options.provider) {
    filter.provider = options.provider;
  }
  if (options.model) {
    filter.model = options.model;
  }
  if (options.tags) {
    filter.tags = options.tags.split(',').map((tag: string) => tag.trim());
  }
  if (options.search) {
    filter.searchQuery = options.search;
  }

  return filter;
}

async function listAllSessions(filter: SessionFilter): Promise<SessionMetadata[]> {
  const [runtimeSessions, legacySessions] = await Promise.all([
    sessionRegistry.list({
      provider: filter.provider,
      query: filter.searchQuery,
    }),
    sessionStore.listSessions(filter),
  ]);

  const runtimeMetadata = runtimeSessions
    .map(runtimeSessionToMetadata)
    .filter((session) => matchesSessionFilter(session, filter));
  const combined = [...runtimeMetadata, ...legacySessions];
  const deduped = new Map<string, SessionMetadata>();

  for (const session of combined) {
    if (!deduped.has(session.id)) {
      deduped.set(session.id, session);
    }
  }

  return [...deduped.values()].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
  );
}

function matchesSessionFilter(session: SessionMetadata, filter: SessionFilter): boolean {
  if (filter.model && session.model !== filter.model) {
    return false;
  }

  if (filter.provider && session.provider !== filter.provider) {
    return false;
  }

  if (filter.tags && filter.tags.length > 0) {
    const sessionTags = session.tags || [];
    if (!filter.tags.every((tag) => sessionTags.includes(tag))) {
      return false;
    }
  }

  if (filter.dateRange) {
    const updatedAt = session.updatedAt.getTime();
    if (updatedAt < filter.dateRange.from.getTime() || updatedAt > filter.dateRange.to.getTime()) {
      return false;
    }
  }

  return true;
}

async function loadSessionRecord(sessionId: string): Promise<
  | { kind: 'runtime'; session: KernelSession }
  | { kind: 'legacy'; session: SessionData }
  | null
> {
  const runtimeSession = await sessionRegistry.load(sessionId);
  if (runtimeSession) {
    return { kind: 'runtime', session: runtimeSession };
  }

  const legacySession = await sessionStore.getSession(sessionId);
  if (legacySession) {
    return { kind: 'legacy', session: legacySession };
  }

  return null;
}

function printRuntimeSession(session: KernelSession, includeMessages: boolean): void {
  const metadata = runtimeSessionToMetadata(session);
  const context = runtimeSessionToSessionData(session).context;

  console.log(`\nSession: ${session.title}`);
  console.log(`ID: ${session.id}`);
  console.log(`Provider: ${metadata.provider}`);
  console.log(`Model: ${metadata.model}`);
  console.log(`Mode: ${session.mode}`);
  console.log(`Messages: ${metadata.messageCount}`);
  console.log(`Tokens: ${metadata.totalTokens}`);
  console.log(`Tasks: ${session.tasks.length}`);
  console.log(`Approvals: ${session.approvals.length}`);
  console.log(`Artifacts: ${session.artifacts.length}`);

  if (metadata.cost) {
    console.log(`Cost: $${metadata.cost.toFixed(4)}`);
  }

  if (metadata.tags) {
    console.log(`Tags: ${metadata.tags.join(', ')}`);
  }

  console.log(`Created: ${metadata.createdAt.toLocaleString()}`);
  console.log(`Updated: ${metadata.updatedAt.toLocaleString()}`);

  if (context) {
    console.log('\nContext:');
    if (context.workingDirectory) {
      console.log(`  Working Directory: ${context.workingDirectory}`);
    }
    if (context.gitBranch) {
      console.log(`  Git Branch: ${context.gitBranch}`);
    }
    if (context.files) {
      console.log(`  Files: ${context.files.join(', ')}`);
    }
  }

  if (includeMessages) {
    console.log('\nMessages:');
    session.messages.forEach((message, index) => {
      printKernelMessage(message, index);
    });
  }
}

function printLegacySession(session: SessionData, includeMessages: boolean): void {
  console.log(`\nSession: ${session.metadata.title}`);
  console.log(`ID: ${session.metadata.id}`);
  console.log(`Provider: ${session.metadata.provider}`);
  console.log(`Model: ${session.metadata.model}`);
  console.log(`Messages: ${session.metadata.messageCount}`);
  console.log(`Tokens: ${session.metadata.totalTokens}`);

  if (session.metadata.cost) {
    console.log(`Cost: $${session.metadata.cost.toFixed(4)}`);
  }

  if (session.metadata.tags) {
    console.log(`Tags: ${session.metadata.tags.join(', ')}`);
  }

  console.log(`Created: ${session.metadata.createdAt.toLocaleString()}`);
  console.log(`Updated: ${session.metadata.updatedAt.toLocaleString()}`);

  if (session.context) {
    console.log('\nContext:');
    if (session.context.workingDirectory) {
      console.log(`  Working Directory: ${session.context.workingDirectory}`);
    }
    if (session.context.gitBranch) {
      console.log(`  Git Branch: ${session.context.gitBranch}`);
    }
    if (session.context.files) {
      console.log(`  Files: ${session.context.files.join(', ')}`);
    }
  }

  if (includeMessages) {
    console.log('\nMessages:');
    session.messages.forEach((message, index) => {
      const timestamp = message.timestamp ? ` (${message.timestamp.toLocaleString()})` : '';
      console.log(`\n${index + 1}. ${message.role.toUpperCase()}${timestamp}:`);
      console.log(message.content);
    });
  }
}

async function exportLegacySession(session: SessionData, options: SessionExport): Promise<string> {
  const { messages } = session;
  const exportMessages = options.messageRange
    ? messages.slice(options.messageRange.from, options.messageRange.to + 1)
    : messages;

  switch (options.format) {
    case 'json': {
      const jsonData: Record<string, unknown> = { messages: exportMessages };
      if (options.includeMetadata) {
        jsonData.metadata = session.metadata;
      }
      if (options.includeContext) {
        jsonData.context = session.context;
      }
      return JSON.stringify(jsonData, null, 2);
    }
    case 'markdown': {
      let markdown = '';

      if (options.includeMetadata) {
        markdown += `# ${session.metadata.title}\n\n`;
        markdown += `**Provider:** ${session.metadata.provider}\n`;
        markdown += `**Model:** ${session.metadata.model}\n`;
        markdown += `**Created:** ${session.metadata.createdAt.toLocaleString()}\n`;
        markdown += `**Messages:** ${session.metadata.messageCount}\n`;
        markdown += `**Tokens:** ${session.metadata.totalTokens}\n\n`;
      }

      exportMessages.forEach((message) => {
        const timestamp = message.timestamp ? ` (${message.timestamp.toLocaleString()})` : '';
        markdown += `## ${message.role.toUpperCase()}${timestamp}\n\n`;
        markdown += `${message.content}\n\n`;
      });

      return markdown;
    }
    case 'text': {
      let text = '';

      if (options.includeMetadata) {
        text += `Session: ${session.metadata.title}\n`;
        text += `Provider: ${session.metadata.provider}, Model: ${session.metadata.model}\n`;
        text += `Created: ${session.metadata.createdAt.toLocaleString()}\n`;
        text += `Messages: ${session.metadata.messageCount}, Tokens: ${session.metadata.totalTokens}\n\n`;
        text += '='.repeat(50) + '\n\n';
      }

      exportMessages.forEach((message) => {
        const timestamp = message.timestamp ? ` (${message.timestamp.toLocaleString()})` : '';
        text += `${message.role.toUpperCase()}${timestamp}:\n`;
        text += `${message.content}\n\n`;
        text += `${'-'.repeat(30)}\n\n`;
      });

      return text;
    }
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

function exportRuntimeSession(session: KernelSession, options: SessionExport): string {
  const exportMessages = options.messageRange
    ? session.messages.slice(options.messageRange.from, options.messageRange.to + 1)
    : session.messages;
  const metadata = runtimeSessionToMetadata(session);
  const context = runtimeSessionToSessionData(session).context;

  switch (options.format) {
    case 'json': {
      const jsonData: Record<string, unknown> = {
        id: session.id,
        mode: session.mode,
        messages: exportMessages,
        tasks: session.tasks,
        approvals: session.approvals,
        artifacts: session.artifacts,
        background: session.background,
        worktree: session.worktree,
      };

      if (options.includeMetadata) {
        jsonData.metadata = metadata;
        jsonData.createdAt = metadata.createdAt;
        jsonData.updatedAt = metadata.updatedAt;
      }
      if (options.includeContext) {
        jsonData.context = context;
      }

      return JSON.stringify(jsonData, null, 2);
    }
    case 'markdown': {
      let markdown = '';

      if (options.includeMetadata) {
        markdown += `# ${session.title}\n\n`;
        markdown += `**Provider:** ${metadata.provider}\n`;
        markdown += `**Model:** ${metadata.model}\n`;
        markdown += `**Mode:** ${session.mode}\n`;
        markdown += `**Created:** ${metadata.createdAt.toLocaleString()}\n`;
        markdown += `**Messages:** ${metadata.messageCount}\n`;
        markdown += `**Tokens:** ${metadata.totalTokens}\n`;
        markdown += `**Tasks:** ${session.tasks.length}\n`;
        markdown += `**Approvals:** ${session.approvals.length}\n\n`;
      }

      exportMessages.forEach((message) => {
        markdown += `## ${kernelMessageHeading(message)}\n\n`;
        markdown += `${message.content}\n\n`;
      });

      return markdown;
    }
    case 'text': {
      let text = '';

      if (options.includeMetadata) {
        text += `Session: ${session.title}\n`;
        text += `Provider: ${metadata.provider}, Model: ${metadata.model}\n`;
        text += `Mode: ${session.mode}\n`;
        text += `Created: ${metadata.createdAt.toLocaleString()}\n`;
        text += `Messages: ${metadata.messageCount}, Tokens: ${metadata.totalTokens}\n`;
        text += `Tasks: ${session.tasks.length}, Approvals: ${session.approvals.length}\n\n`;
        text += '='.repeat(50) + '\n\n';
      }

      exportMessages.forEach((message) => {
        text += `${kernelMessageHeading(message)}:\n`;
        text += `${message.content}\n\n`;
        text += `${'-'.repeat(30)}\n\n`;
      });

      return text;
    }
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

function kernelMessageHeading(message: KernelMessage): string {
  const timestamp = new Date(message.createdAt).toLocaleString();
  const toolName = message.role === 'tool' && message.name ? `:${message.name}` : '';
  return `${message.role.toUpperCase()}${toolName} (${timestamp})`;
}

function printKernelMessage(message: KernelMessage, index: number): void {
  console.log(`\n${index + 1}. ${kernelMessageHeading(message)}:`);
  console.log(message.content);
}

function buildStats(sessions: SessionMetadata[]): {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  providerBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
} {
  const providerBreakdown: Record<string, number> = {};
  const modelBreakdown: Record<string, number> = {};

  let totalMessages = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const session of sessions) {
    totalMessages += session.messageCount;
    totalTokens += session.totalTokens;
    totalCost += session.cost || 0;
    providerBreakdown[session.provider] = (providerBreakdown[session.provider] || 0) + 1;
    modelBreakdown[session.model] = (modelBreakdown[session.model] || 0) + 1;
  }

  return {
    totalSessions: sessions.length,
    totalMessages,
    totalTokens,
    totalCost,
    providerBreakdown,
    modelBreakdown,
  };
}

process.on('SIGINT', () => {
  sessionStore.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sessionStore.close();
  process.exit(0);
});
