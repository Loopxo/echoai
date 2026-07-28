import { serveAcpStdio } from '../../../src/cli/acp.ts';
import { acpCommand } from '../../../src/cli/acp.ts';
import { loginCommand, usageCommand } from '../../../src/cli/auth.ts';
import { configCommand } from '../../../src/cli/config.ts';
import { mcpCommand } from '../../../src/cli/mcp.ts';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  await serveAcpStdio({ workspaceRoot: process.cwd() });
} else if (command === 'acp') {
  await acpCommand.parseAsync(args, { from: 'user' });
} else if (command === 'login') {
  await loginCommand.parseAsync(args, { from: 'user' });
} else if (command === 'usage') {
  await usageCommand.parseAsync(args, { from: 'user' });
} else if (command === 'config') {
  await configCommand.parseAsync(args, { from: 'user' });
} else if (command === 'mcp') {
  await mcpCommand.parseAsync(args, { from: 'user' });
} else if (command === '--help' || command === '-h') {
  console.log([
    'Echo AI IDE runtime',
    '',
    'Commands:',
    '  acp --stdio   Start the Agent Client Protocol server',
    '  login         Connect EchoAI Cloud credits',
    '  usage         Show hosted usage and credit balance',
    '  config        Manage provider and model configuration',
    '  mcp           Manage Model Context Protocol servers',
  ].join('\n'));
} else {
  throw new Error(`Unsupported Echo AI IDE runtime command: ${command}`);
}
