import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { FileManager } from '../integrations/file-manager.js';
import { CommandContext } from '../types/index.js';
import { createCliKernel } from '../runtime/cli-kernel.js';

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

    const provider = await providerManager.getProvider(context.provider!);

    const kernel = createCliKernel(provider, {
      model: context.model,
      temperature: context.temperature,
      maxTokens: context.maxTokens,
      stream: context.stream,
      stateNamespace: 'cli',
      onTextChunk: context.stream ? (chunk) => process.stdout.write(chunk) : undefined,
    });

    const result = await kernel.run({
      input: fullPrompt,
      title: prompt,
      provider: context.provider,
      model: context.model,
      workspaceRoot: process.cwd(),
      stream: context.stream,
    });

    if (context.stream) {
      process.stdout.write('\n');
    } else {
      console.log(result.response);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
