import { ConfigManager } from '../config/manager.js';
import { ProviderManager } from '../core/provider-manager.js';
import { FileManager } from '../integrations/file-manager.js';
import { CommandContext } from '../types/index.js';
import { createCliKernel, registerConfiguredMcpTools } from '../runtime/cli-kernel.js';
import { RuntimeEventRenderer } from '@echoai/tui';

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

    const providerPromise = providerManager.getProvider(context.provider!);
    const fileContentsPromise = context.files && context.files.length > 0
      ? Promise.all(
          context.files.map(async (filePath) => {
            try {
              const content = await fileManager.readFile(filePath);
              return `## File: ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`;
            } catch (error) {
              return `## File: ${filePath}\n*Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}*\n`;
            }
          })
        )
      : Promise.resolve<string[]>([]);

    const [provider, fileContents] = await Promise.all([providerPromise, fileContentsPromise]);

    if (fileContents.length > 0) {
      fullPrompt = `${prompt}\n\nContext files:\n${fileContents.join('\n')}`;
    }

    const kernel = createCliKernel({
      provider,
      model: context.model,
      temperature: context.temperature,
      maxTokens: context.maxTokens,
      stream: context.stream,
      stateNamespace: 'cli',
    });
    const mcpManager = await registerConfiguredMcpTools(kernel);

    const runOptions = {
      input: fullPrompt,
      title: prompt,
      provider: context.provider,
      model: context.model,
      workspaceRoot: process.cwd(),
      stream: context.stream,
    };

    try {
      if (context.stream) {
        const renderer = new RuntimeEventRenderer();
        let response = '';

        for await (const event of kernel.runEvents(runOptions)) {
          renderer.consume(event);
          if (event.type === 'run.completed') {
            response = event.result.response;
          }
        }

        renderer.finish();
        if (!response.trim()) {
          process.stdout.write('\n');
        }
        return;
      }

      const result = await kernel.run(runOptions);
      console.log(result.response);
    } finally {
      await mcpManager.shutdown();
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
