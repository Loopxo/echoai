import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { FileManager } from '../integrations/file-manager.js';
import { Message, CommandContext } from '../types/index.js';

export default async function handleDirectPrompt(prompt: string, options: any) {
  try {
    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    const fileManager = new FileManager();
    
    const config = await configManager.getConfig();
    
    const context: CommandContext = {
      provider: options.provider || config.defaults.provider,
      model: options.model || config.defaults.model,
      temperature: options.temperature ?? config.defaults.temperature,
      maxTokens: options.maxTokens ?? config.defaults.maxTokens,
      stream: options.stream ?? config.features.streaming,
      files: options.file || [],
    };

    let fullPrompt = prompt;
    
    if (context.files && context.files.length > 0) {
      const fileContents = await Promise.all(
        context.files.map(async (filePath) => {
          try {
            const content = await fileManager.readFile(filePath);
            return `## File: ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`;
          } catch (error) {
            return `## File: ${filePath}\n*Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}*\n`;
          }
        })
      );
      
      fullPrompt = `${prompt}\n\nContext files:\n${fileContents.join('\n')}`;
    }

    const messages: Message[] = [
      {
        role: 'user',
        content: fullPrompt,
        timestamp: new Date(),
      },
    ];

    const provider = await providerManager.getProvider(context.provider!);
    
    if (context.stream) {
      const responseStream = provider.chat(messages, {
        model: context.model,
        temperature: context.temperature,
        maxTokens: context.maxTokens,
        stream: true,
      });

      for await (const chunk of responseStream) {
        process.stdout.write(chunk);
      }
      console.log(); // New line at the end
    } else {
      const response = await provider.complete(fullPrompt, {
        model: context.model,
        temperature: context.temperature,
        maxTokens: context.maxTokens,
      });
      
      console.log(response);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}