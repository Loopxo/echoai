/**
 * Gateway CLI Command
 *
 * Manages the EchoAI Gateway server for multi-channel communication.
 */

import { Command } from 'commander';

export const gatewayCommand = new Command('gateway')
    .description('🌐 Manage the EchoAI Gateway server')
    .addCommand(
        new Command('start')
            .description('Start the Gateway server')
            .option('-p, --port <port>', 'Port to listen on', '18789')
            .option('--host <host>', 'Host to bind to', '127.0.0.1')
            .option('-d, --daemon', 'Run in background as daemon')
            .action(async (options) => {
                try {
                    const { startGatewayServer } = await import('@echoai/gateway');

                    console.log('🔌 Starting EchoAI Gateway...\n');

                    const server = await startGatewayServer({
                        port: parseInt(options.port, 10),
                        host: options.host,
                    });

                    console.log(`✅ Gateway running at ws://${server.host}:${server.port}`);
                    console.log('   Press Ctrl+C to stop\n');

                    // Handle shutdown
                    process.on('SIGINT', async () => {
                        console.log('\n🛑 Shutting down Gateway...');
                        await server.close();
                        process.exit(0);
                    });

                    // Keep process alive
                    await new Promise(() => { });
                } catch (error) {
                    console.error('❌ Failed to start Gateway:', error);
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('status')
            .description('Check Gateway status')
            .option('-p, --port <port>', 'Gateway port', '18789')
            .action(async (options) => {
                try {
                    const port = parseInt(options.port, 10);
                    const response = await fetch(`http://127.0.0.1:${port}/health`);

                    if (response.ok) {
                        const data = await response.json();
                        console.log('✅ Gateway is running\n');
                        console.log(`   Version: ${data.version || 'unknown'}`);
                        console.log(`   Clients: ${data.clients || 0}`);
                        console.log(`   Uptime:  ${Math.round(data.uptime || 0)}s`);
                    } else {
                        console.log('❌ Gateway is not responding');
                    }
                } catch {
                    console.log('❌ Gateway is not running');
                }
            })
    );

export default gatewayCommand;
