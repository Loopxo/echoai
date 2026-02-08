/**
 * Channels CLI Command
 *
 * Manages messaging channel integrations (WhatsApp, Telegram, Discord, etc.)
 */

import { Command } from 'commander';

export const channelsCommand = new Command('channels')
    .description('📱 Manage messaging channel integrations')
    .addCommand(
        new Command('list')
            .description('List available channels')
            .action(async () => {
                const { CHANNEL_META, CHANNEL_ORDER } = await import('@echoai/core');

                console.log('\n📱 Available Channels:\n');

                for (const id of CHANNEL_ORDER) {
                    const meta = CHANNEL_META[id];
                    console.log(`  ${meta.label.padEnd(12)} - ${meta.description}`);
                }

                console.log('\nUse `echoai channels connect <channel>` to set up a channel.');
            })
    )
    .addCommand(
        new Command('connect')
            .description('Connect a messaging channel')
            .argument('<channel>', 'Channel to connect (whatsapp, telegram, discord)')
            .action(async (channel) => {
                switch (channel.toLowerCase()) {
                    case 'whatsapp':
                        await connectWhatsApp();
                        break;
                    case 'telegram':
                        await connectTelegram();
                        break;
                    case 'discord':
                        await connectDiscord();
                        break;
                    default:
                        console.log(`❌ Unknown channel: ${channel}`);
                        console.log('Available: whatsapp, telegram, discord');
                }
            })
    )
    .addCommand(
        new Command('status')
            .description('Show channel connection status')
            .action(async () => {
                console.log('\n📱 Channel Status:\n');
                console.log('  (Connect to Gateway to see live status)');
                console.log('  Run: echoai gateway start');
            })
    );

async function connectWhatsApp() {
    console.log('\n🟢 WhatsApp Setup\n');
    console.log('1. Make sure the Gateway is running: echoai gateway start');
    console.log('2. Configure WhatsApp in your echoai.json:');
    console.log(`
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "selfChatMode": true,
      "dmPolicy": "pairing"
    }
  }
}
`);
    console.log('3. Scan the QR code that appears when the channel starts.');
    console.log('\nFor more details, see the documentation.');
}

async function connectTelegram() {
    console.log('\n🔵 Telegram Setup\n');
    console.log('1. Create a bot with @BotFather on Telegram');
    console.log('2. Copy the bot token');
    console.log('3. Configure Telegram in your echoai.json:');
    console.log(`
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "dmPolicy": "open"
    }
  }
}
`);
    console.log('4. Start the Gateway: echoai gateway start');
    console.log('\nFor more details, see the documentation.');
}

async function connectDiscord() {
    console.log('\n🟣 Discord Setup\n');
    console.log('1. Create an application at https://discord.com/developers');
    console.log('2. Add a Bot to your application and copy the token');
    console.log('3. Invite the bot to your server with the OAuth2 URL generator');
    console.log('4. Configure Discord in your echoai.json:');
    console.log(`
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "requireMention": true,
      "dmPolicy": "open"
    }
  }
}
`);
    console.log('5. Start the Gateway: echoai gateway start');
    console.log('\nFor more details, see the documentation.');
}

export default channelsCommand;
