import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { getCliSessionRegistry } from './session-bridge.js';

export interface SlashCommandContext {
  input: string;
  args: string[];
  currentSessionId?: string;
  providerName: string;
  modelName: string;
  runtimeMode: 'default' | 'plan';
  configManager: ConfigManager;
  providerManager: ProviderManager;
  setSessionId: (id: string | undefined) => void;
  setModel: (model: string) => void;
  setProvider: (provider: string) => void;
  setRuntimeMode: (mode: 'default' | 'plan') => void;
  exit: () => void;
}

type CommandHandler = (ctx: SlashCommandContext) => Promise<boolean> | boolean;

const commands: Record<string, { description: string, handler: CommandHandler }> = {
  '/help': {
    description: 'Show available slash commands',
    handler: () => {
      console.log('\nAvailable commands:');
      for (const [cmd, { description }] of Object.entries(commands)) {
        console.log(`  ${cmd.padEnd(15)} - ${description}`);
      }
      console.log();
      return true;
    }
  },
  '/clear': {
    description: 'Start a new chat session',
    handler: (ctx) => {
      ctx.setSessionId(undefined);
      console.log('Started a new session.\n');
      return true;
    }
  },
  '/exit': {
    description: 'Exit the interactive chat',
    handler: (ctx) => {
      console.log('Goodbye.');
      ctx.exit();
      return true;
    }
  },
  '/status': {
    description: 'Show current session status',
    handler: (ctx) => {
      console.log('\n--- Status ---');
      console.log(`Session ID: ${ctx.currentSessionId || 'None'}`);
      console.log(`Provider:   ${ctx.providerName}`);
      console.log(`Model:      ${ctx.modelName}`);
      console.log(`Mode:       ${ctx.runtimeMode === 'plan' ? 'plan' : 'build'}`);
      console.log('--------------\n');
      return true;
    }
  },
  '/login': {
    description: 'Login to the hosted EchoAI account',
    handler: async () => {
      const { startDeviceLogin } = await import('../cli/auth.js');
      await startDeviceLogin();
      return true;
    }
  },
  '/usage': {
    description: 'Show EchoAI hosted usage and credit balance',
    handler: async () => {
      const { printUsage } = await import('../cli/auth.js');
      await printUsage();
      return true;
    }
  },
  '/mode': {
    description: 'Switch modes: plan, build, fast, code, reason',
    handler: (ctx) => {
      if (ctx.args.length === 0 || !ctx.args[0]) {
        console.log(`Current mode: ${ctx.runtimeMode === 'plan' ? 'plan' : 'build'}. Use /mode <plan|build|fast|code|reason>\n`);
        return true;
      }
      const mode = ctx.args[0].toLowerCase();
      if (mode === 'plan') {
        ctx.setRuntimeMode('plan');
        console.log('Switched to PLAN mode (read-only; edits are denied).\n');
      } else if (mode === 'build') {
        ctx.setRuntimeMode('default');
        console.log('Switched to BUILD mode.\n');
      } else if (mode === 'fast') {
        ctx.setProvider('echoai');
        ctx.setModel('fast');
        console.log('Switched to FAST mode (EchoAI hosted fast preset).\n');
      } else if (mode === 'code') {
        ctx.setProvider('echoai');
        ctx.setModel('code');
        console.log('Switched to CODE mode (EchoAI hosted code preset).\n');
      } else if (mode === 'reason') {
        ctx.setProvider('echoai');
        ctx.setModel('reason');
        console.log('Switched to REASON mode (EchoAI hosted reason preset).\n');
      } else {
        console.log(`Unknown mode: ${mode}. Available modes: plan, build, fast, code, reason\n`);
      }
      return true;
    }
  },
  '/model': {
    description: 'Switch model or preset: fast, code, reason, or an explicit model id',
    handler: (ctx) => {
      if (ctx.args.length === 0 || !ctx.args[0]) {
        console.log(`Current model: ${ctx.providerName}/${ctx.modelName}. Use /model <fast|code|reason|model-id>\n`);
        return true;
      }
      const requested = ctx.args[0].toLowerCase();
      if (requested === 'fast') {
        ctx.setProvider('echoai');
        ctx.setModel('fast');
        console.log('Switched to EchoAI fast preset.\n');
        return true;
      }
      if (requested === 'code') {
        ctx.setProvider('echoai');
        ctx.setModel('code');
        console.log('Switched to EchoAI code preset.\n');
        return true;
      }
      if (requested === 'reason') {
        ctx.setProvider('echoai');
        ctx.setModel('reason');
        console.log('Switched to EchoAI reason preset.\n');
        return true;
      }
      ctx.setModel(ctx.args[0]);
      console.log(`Switched model to: ${ctx.args[0]}\n`);
      return true;
    }
  },
  '/provider': {
    description: 'Switch the active provider (e.g. /provider deepseek)',
    handler: (ctx) => {
      if (ctx.args.length === 0 || !ctx.args[0]) {
        console.log(`Current provider: ${ctx.providerName}`);
        return true;
      }
      const newProvider = ctx.args[0];
      ctx.setProvider(newProvider);
      console.log(`Switched provider to: ${newProvider}\n`);
      return true;
    }
  },
  '/resume': {
    description: 'Resume a session (e.g. /resume <id>)',
    handler: async (ctx) => {
      if (ctx.args.length === 0 || !ctx.args[0]) {
        console.log('Please provide a session ID.\n');
        return true;
      }
      const sessionId = ctx.args[0];
      const registry = getCliSessionRegistry();
      const session = await registry.load(sessionId);
      
      if (!session) {
        console.log(`Session ${sessionId} not found.\n`);
        return true;
      }

      ctx.setSessionId(session.id);
      if (session.provider) ctx.setProvider(session.provider);
      if (session.model) ctx.setModel(session.model);
      
      console.log(`Resumed session: ${session.title} (${session.id})\n`);
      return true;
    }
  },
  '/rename': {
    description: 'Rename the current session',
    handler: async (ctx) => {
      if (!ctx.currentSessionId) {
        console.log('No active session to rename.\n');
        return true;
      }
      if (ctx.args.length === 0) {
        console.log('Please provide a new title (e.g. /rename "Fix auth bug").\n');
        return true;
      }
      
      const newTitle = ctx.args.join(' ');
      const registry = getCliSessionRegistry();
      const session = await registry.load(ctx.currentSessionId);
      
      if (!session) {
        console.log(`Could not load current session ${ctx.currentSessionId}.\n`);
        return true;
      }

      session.title = newTitle;
      await registry.save(session);
      
      console.log(`Session renamed to: "${newTitle}"\n`);
      return true;
    }
  },
  '/sessions': {
    description: 'List recent sessions',
    handler: async () => {
      const registry = getCliSessionRegistry();
      const sessions = await registry.list();
      console.log('\n--- Recent Sessions ---');
      if (sessions.length === 0) {
        console.log('No recent sessions found.');
      } else {
        sessions.slice(0, 10).forEach(s => {
          console.log(`- ${s.id} (${s.title || 'Untitled'})`);
        });
      }
      console.log('-----------------------\n');
      return true;
    }
  },
  '/diff': {
    description: 'Show current git diff',
    handler: async () => {
      const { spawnSync } = await import('child_process');
      const result = spawnSync('git', ['diff'], { cwd: process.cwd(), encoding: 'utf8' });
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      console.log(output || 'No diff.\n');
      return true;
    }
  },
  '/revert': {
    description: 'Restore a file from the current session snapshot (e.g. /revert src/index.ts)',
    handler: async (ctx) => {
      if (!ctx.currentSessionId) {
        console.log('No active session.\n');
        return true;
      }
      const targetPath = ctx.args[0];
      if (!targetPath) {
        console.log('Please provide a file path to restore.\n');
        return true;
      }
      const registry = getCliSessionRegistry();
      const session = await registry.load(ctx.currentSessionId);
      const snapshots = session?.metadata.snapshots;
      if (!session || !snapshots || typeof snapshots !== 'object' || Array.isArray(snapshots)) {
        console.log('No snapshots available in this session.\n');
        return true;
      }
      const snapshot = (snapshots as Record<string, { content?: string }>)[targetPath];
      if (!snapshot?.content) {
        console.log(`No snapshot found for ${targetPath}.\n`);
        return true;
      }
      const fs = await import('fs/promises');
      const path = await import('path');
      await fs.writeFile(path.resolve(process.cwd(), targetPath), snapshot.content, 'utf8');
      console.log(`Restored ${targetPath} from session snapshot.\n`);
      return true;
    }
  },
  '/undo': {
    description: 'Undo the latest EchoAI file mutation in this session',
    handler: async (ctx) => {
      if (!ctx.currentSessionId) {
        console.log('No active session.\n');
        return true;
      }
      const registry = getCliSessionRegistry();
      const session = await registry.load(ctx.currentSessionId);
      const stack = session?.metadata.undoStack;
      if (!session || !Array.isArray(stack) || stack.length === 0) {
        console.log('No undo snapshots are available for this session.\n');
        return true;
      }

      const snapshot = stack.pop() as {
        summary?: string;
        files?: Array<{ path?: string; content?: string | null }>;
      };
      if (!snapshot.files?.length) {
        await registry.save(session);
        console.log('Undo snapshot was empty.\n');
        return true;
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const restored: string[] = [];
      const removed: string[] = [];
      for (const file of snapshot.files) {
        if (!file.path) continue;
        const resolved = path.resolve(process.cwd(), file.path);
        if (file.content === null) {
          await fs.rm(resolved, { force: true });
          removed.push(file.path);
        } else if (typeof file.content === 'string') {
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, file.content, 'utf8');
          restored.push(file.path);
        }
      }

      session.metadata.undoStack = stack;
      await registry.save(session);
      console.log(`Undid latest change${snapshot.summary ? `: ${snapshot.summary}` : ''}.`);
      if (restored.length > 0) console.log(`Restored: ${restored.join(', ')}`);
      if (removed.length > 0) console.log(`Removed: ${removed.join(', ')}`);
      console.log();
      return true;
    }
  },
  '/permissions': {
    description: 'Show active workspace permissions',
    handler: async () => {
      const { DEFAULT_PERMISSION_PROFILE } = await import('@echoai/runtime');
      console.log('\n--- Active Permissions ---');
      console.log(`Read: ${DEFAULT_PERMISSION_PROFILE.read}`);
      console.log(`Write: ${DEFAULT_PERMISSION_PROFILE.write}`);
      console.log(`Shell: ${DEFAULT_PERMISSION_PROFILE.process}`);
      console.log(`Network: ${DEFAULT_PERMISSION_PROFILE.network}`);
      console.log('--------------------------\n');
      return true;
    }
  },
  '/tools': {
    description: 'List available tools in the current environment',
    handler: async () => {
      const { createBuiltInTools } = await import('@echoai/runtime');
      const tools = createBuiltInTools();
      console.log('\n--- Available Tools ---');
      tools.forEach(t => console.log(`- ${t.name}: ${t.description}`));
      console.log('-----------------------\n');
      return true;
    }
  },
  '/compact': {
    description: 'Manually trigger context compaction',
    handler: async (ctx) => {
      if (!ctx.currentSessionId) {
        console.log('No active session to compact.\n');
        return true;
      }
      console.log('Triggering manual compaction...\n');
      const registry = getCliSessionRegistry();
      const session = await registry.load(ctx.currentSessionId);
      if (session) {
        const { compactSession } = await import('@echoai/runtime');
        // Manual compact: squeeze as much as possible
        const report = await compactSession(session, { maxMessages: 10 }, undefined);
        await registry.save(session);
        await registry.appendEvent(session.id, 'session.compacted', {
          report: report as unknown as Record<string, unknown>,
          messages: session.messages as unknown as Record<string, unknown>[],
        });
        console.log(`Context optimized. Summarized ${report.summarizedMessages} messages.\n`);
      }
      return true;
    }
  },
  '/init': {
    description: 'Initialize ECHOAI.md in current directory',
    handler: async () => {
      const { initializeEchoAiProject } = await import('../cli/init.js');
      const result = await initializeEchoAiProject(process.cwd());
      console.log(`${result.message}\n`);
      return true;
    }
  },
  '/doctor': {
    description: 'Check environment health and dependencies',
    handler: async () => {
      const fs = await import('fs/promises');
      const os = await import('os');
      const path = await import('path');
      console.log('\n--- EchoAI Doctor ---');
      console.log(`Node.js: ${process.version}`);
      try {
        await fs.access(process.cwd(), fs.constants.W_OK);
        console.log('Workspace: Writable (OK)');
      } catch {
        console.log('Workspace: Read-only (WARNING)');
      }
      try {
        const stateDir = path.join(os.homedir(), '.echoai');
        await fs.access(stateDir, fs.constants.W_OK);
        console.log(`State Directory: ${stateDir} (OK)`);
      } catch {
        console.log('State Directory: Not writable (ERROR)');
      }
      console.log('---------------------\n');
      return true;
    }
  }
};

/**
 * Executes a slash command if the input matches one.
 * Returns true if a command was handled, false if it's a regular message.
 */
export async function handleSlashCommand(input: string, ctx: Omit<SlashCommandContext, 'input' | 'args'>): Promise<boolean> {
  const trimmed = input.trim();
  
  if (trimmed.toLowerCase() === 'exit') {
    const exitCmd = commands['/exit'];
    if (exitCmd) return exitCmd.handler({ ...ctx, input, args: [] });
  }
  
  if (trimmed.toLowerCase() === 'clear') {
    const clearCmd = commands['/clear'];
    if (clearCmd) return clearCmd.handler({ ...ctx, input, args: [] });
  }

  if (!trimmed.startsWith('/')) {
    return false;
  }

  const parts = trimmed.split(/\s+/);
  const firstPart = parts[0];
  if (!firstPart) return false;
  
  const cmd = firstPart.toLowerCase();
  const args = parts.slice(1);

  const command = commands[cmd];
  if (command) {
    try {
      await command.handler({ ...ctx, input, args });
    } catch (e) {
      console.error(`❌ Error executing ${cmd}:`, e instanceof Error ? e.message : 'Unknown error');
    }
    return true;
  }

  console.log(`Unknown command: ${cmd}. Type /help for available commands.\n`);
  return true;
}
