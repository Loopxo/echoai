import { Command } from 'commander';
import { SessionStore } from '../storage/session-store.js';
import { SessionData, SessionFilter, SessionExport } from '../types/session.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const sessionStore = new SessionStore();

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
    const filter: SessionFilter = {};
    
    if (options.provider) filter.provider = options.provider;
    if (options.model) filter.model = options.model;
    if (options.tags) filter.tags = options.tags.split(',').map((t: string) => t.trim());
    if (options.search) filter.searchQuery = options.search;

    const sessions = await sessionStore.listSessions(filter);
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
    const session = await sessionStore.getSession(sessionId);
    
    if (!session) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

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

    if (options.messages) {
      console.log('\nMessages:');
      session.messages.forEach((message, index) => {
        const timestamp = message.timestamp ? ` (${message.timestamp.toLocaleString()})` : '';
        console.log(`\n${index + 1}. ${message.role.toUpperCase()}${timestamp}:`);
        console.log(message.content);
      });
    }
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

    const deleted = await sessionStore.deleteSession(sessionId);
    
    if (deleted) {
      console.log(`✅ Session ${sessionId} deleted successfully.`);
    } else {
      console.error(`❌ Session ${sessionId} not found.`);
      process.exit(1);
    }
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
    const session = await sessionStore.getSession(sessionId);
    
    if (!session) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    const exportOptions: SessionExport = {
      format: options.format,
      includeMetadata: options.metadata !== false,
      includeContext: options.context !== false,
    };

    if (options.range) {
      const [from, to] = options.range.split('-').map((n: string) => parseInt(n.trim()));
      if (isNaN(from) || isNaN(to)) {
        console.error('Invalid range format. Use "from-to" (e.g., "1-10").');
        process.exit(1);
      }
      exportOptions.messageRange = { from: from - 1, to: to - 1 };
    }

    const exportData = await exportSession(session, exportOptions);
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
    const session = await sessionStore.getSession(sessionId);
    
    if (!session) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    const shareOptions: any = {
      isPublic: options.public || false,
      password: options.password,
    };

    if (options.expires) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + options.expires);
      shareOptions.expiresAt = expirationDate;
    }

    const share = await sessionStore.createShare(sessionId, shareOptions);
    
    console.log(`✅ Share created successfully!`);
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
    const stats = await sessionStore.getSessionStats();

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
        .sort(([,a], [,b]) => b - a)
        .forEach(([provider, count]) => {
          console.log(`  ${provider}: ${count} sessions`);
        });
    }

    if (Object.keys(stats.modelBreakdown).length > 0) {
      console.log('\nModel Breakdown:');
      Object.entries(stats.modelBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10) // Show top 10 models
        .forEach(([model, count]) => {
          console.log(`  ${model}: ${count} sessions`);
        });
    }
  });

async function exportSession(session: SessionData, options: SessionExport): Promise<string> {
  const { messages } = session;
  const exportMessages = options.messageRange 
    ? messages.slice(options.messageRange.from, options.messageRange.to + 1)
    : messages;

  switch (options.format) {
    case 'json':
      const jsonData: any = { messages: exportMessages };
      if (options.includeMetadata) jsonData.metadata = session.metadata;
      if (options.includeContext) jsonData.context = session.context;
      return JSON.stringify(jsonData, null, 2);

    case 'markdown':
      let markdown = '';
      
      if (options.includeMetadata) {
        markdown += `# ${session.metadata.title}\n\n`;
        markdown += `**Provider:** ${session.metadata.provider}\n`;
        markdown += `**Model:** ${session.metadata.model}\n`;
        markdown += `**Created:** ${session.metadata.createdAt.toLocaleString()}\n`;
        markdown += `**Messages:** ${session.metadata.messageCount}\n`;
        markdown += `**Tokens:** ${session.metadata.totalTokens}\n\n`;
      }

      exportMessages.forEach((message, index) => {
        const timestamp = message.timestamp ? ` (${message.timestamp.toLocaleString()})` : '';
        markdown += `## ${message.role.toUpperCase()}${timestamp}\n\n`;
        markdown += `${message.content}\n\n`;
      });

      return markdown;

    case 'text':
      let text = '';
      
      if (options.includeMetadata) {
        text += `Session: ${session.metadata.title}\n`;
        text += `Provider: ${session.metadata.provider}, Model: ${session.metadata.model}\n`;
        text += `Created: ${session.metadata.createdAt.toLocaleString()}\n`;
        text += `Messages: ${session.metadata.messageCount}, Tokens: ${session.metadata.totalTokens}\n\n`;
        text += '=' .repeat(50) + '\n\n';
      }

      exportMessages.forEach((message, index) => {
        const timestamp = message.timestamp ? ` (${message.timestamp.toLocaleString()})` : '';
        text += `${message.role.toUpperCase()}${timestamp}:\n`;
        text += `${message.content}\n\n`;
        text += '-'.repeat(30) + '\n\n';
      });

      return text;

    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

process.on('SIGINT', () => {
  sessionStore.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sessionStore.close();
  process.exit(0);
});