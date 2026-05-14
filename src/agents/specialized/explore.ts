import { ConfigManager } from '../../config/manager.js';
import { ProviderManager } from '../../core/provider-manager.js';
import { createCliKernel } from '../../runtime/cli-kernel.js';
import { createBuiltInTools } from '@echoai/runtime';

export class ExploreAgent {
  public id = 'explore';
  public name = 'explore';
  public description = 'Fast agent specialized for exploring codebases. Returns concise file paths.';
  
  public async run(instruction: string, workspacePath: string): Promise<string> {
    console.log('[Explore Agent] running query: "' + instruction + '" in ' + workspacePath);

    const configManager = new ConfigManager();
    const providerManager = new ProviderManager(configManager);
    
    // We try to use the configured fast model provider, or fallback to the current default
    const config = await configManager.getConfig();
    let providerName = 'deepseek';
    try {
      await providerManager.getProvider(providerName);
    } catch {
      providerName = config.defaults.provider || 'openai';
    }

    const provider = await providerManager.getProvider(providerName);

    const kernel = createCliKernel({
      provider,
      model: provider.models.includes('deepseek-chat') ? 'deepseek-chat' : provider.models[0],
      temperature: 0.1,
      stream: false,
      stateNamespace: 'explore-subagent',
      registerBuiltInTools: false,
      runtimeMode: 'plan',
    });

    // Only allow read-only search tools
    const safeToolNames = ['read_file', 'list_directory', 'grep_search', 'glob_search'];
    const allTools = createBuiltInTools({ workspaceRoot: workspacePath });
    for (const tool of allTools) {
      if (safeToolNames.includes(tool.name)) {
        kernel.tools.register(tool);
      }
    }

    const sessionId = `explore-${Date.now()}`;
    const session = await kernel.createSession('Explore', providerName, provider.models[0]);

    let finalOutput = '';
    
    try {
      for await (const event of kernel.runEvents({
        sessionId: session.id,
        input: `You are an exploration sub-agent. Your goal is to use search and read tools to find files relevant to this query, and output ONLY a bulleted list of file paths. Query: ${instruction}`,
        workspaceRoot: workspacePath,
        stream: false,
      })) {
        if (event.type === 'run.completed') {
          const lastMsg = event.result.session.messages.filter(m => m.role === 'assistant').pop();
          finalOutput = lastMsg?.content || 'No results found.';
        }
      }
    } catch (error) {
      console.error('[Explore Agent] failed:', error);
      return 'Failed to execute explore query due to error.';
    }

    return `Found results in:\n${finalOutput}\n(Context preserved from massive tool outputs)`;
  }
}
