/**
 * Echo AI model catalog.
 *
 * Every provider key and model id below is taken from the harness itself
 * (`src/providers/*.ts` and `src/providers/factory.ts`), not invented, because
 * several providers validate the model against their own hardcoded list and
 * reject anything else. The env var names come from `ProviderManager.ENV_KEYS`
 * in `src/core/provider-manager.ts`.
 */

export interface EchoModel {
	/** Value sent to the harness. Must match the provider's own list exactly. */
	id: string;
	/** Short label for the picker. */
	label: string;
	/** Marks the provider's declared default. */
	isDefault?: boolean;
	/** True when the provider reaches a reasoning/thinking-capable model. */
	reasoning?: boolean;
}

export interface EchoProvider {
	/** Provider key accepted by ProviderFactory.getProvider. */
	id: string;
	label: string;
	/** Grouping shown in the picker. */
	group: 'Echo' | 'Chinese models' | 'Frontier' | 'Fast' | 'Local' | 'Aggregator';
	/** Any one of these env vars satisfies the key requirement. */
	envKeys: string[];
	/** Provider needs no API key (local or gateway-authenticated). */
	keyless?: boolean;
	models: EchoModel[];
}

export const ECHO_PROVIDERS: EchoProvider[] = [
	{
		id: 'echoai',
		label: 'EchoAI',
		group: 'Echo',
		envKeys: ['ECHOAI_API_KEY'],
		// Authenticates through `echoai login` (~/.echoai/auth.json) when no key is set.
		keyless: true,
		models: [
			{ id: 'code', label: 'Echo Code', isDefault: true },
			{ id: 'fast', label: 'Echo Fast' },
			{ id: 'reason', label: 'Echo Reason', reasoning: true },
			{ id: 'deepseek-chat', label: 'Echo / DeepSeek Chat' },
			{ id: 'deepseek-reasoner', label: 'Echo / DeepSeek Reasoner', reasoning: true },
			{ id: 'moonshot-v1-32k', label: 'Echo / Moonshot 32k' },
		],
	},
	{
		id: 'kimi',
		label: 'Kimi (Moonshot)',
		group: 'Chinese models',
		envKeys: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
		models: [
			{ id: 'kimi-k2-0711-preview', label: 'Kimi K2', isDefault: true },
			{ id: 'moonshot-v1-auto', label: 'Moonshot v1 Auto' },
			{ id: 'moonshot-v1-128k', label: 'Moonshot v1 128k' },
			{ id: 'moonshot-v1-32k', label: 'Moonshot v1 32k' },
			{ id: 'moonshot-v1-8k', label: 'Moonshot v1 8k' },
		],
	},
	{
		id: 'qwen',
		label: 'Qwen (DashScope)',
		group: 'Chinese models',
		envKeys: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'],
		models: [
			{ id: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus', isDefault: true },
			{ id: 'qwen3-coder-480b-a35b-instruct', label: 'Qwen3 Coder 480B' },
			{ id: 'qwen-max', label: 'Qwen Max' },
			{ id: 'qwen-plus', label: 'Qwen Plus' },
			{ id: 'qwen-turbo', label: 'Qwen Turbo' },
		],
	},
	{
		id: 'zhipu',
		label: 'GLM (Zhipu)',
		group: 'Chinese models',
		envKeys: ['ZHIPU_API_KEY', 'GLM_API_KEY'],
		models: [
			{ id: 'glm-4.6', label: 'GLM-4.6', isDefault: true },
			{ id: 'glm-4.5', label: 'GLM-4.5' },
			{ id: 'glm-4.5-air', label: 'GLM-4.5 Air' },
			{ id: 'glm-4-plus', label: 'GLM-4 Plus' },
			{ id: 'glm-4-air', label: 'GLM-4 Air' },
			{ id: 'glm-4-flash', label: 'GLM-4 Flash' },
		],
	},
	{
		id: 'deepseek',
		label: 'DeepSeek',
		group: 'Chinese models',
		envKeys: ['DEEPSEEK_API_KEY'],
		models: [
			{ id: 'deepseek-chat', label: 'DeepSeek Chat', isDefault: true },
			{ id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', reasoning: true },
		],
	},
	{
		id: 'minimax',
		label: 'MiniMax',
		group: 'Chinese models',
		// Model ids are case sensitive on this provider.
		envKeys: ['MINIMAX_API_KEY'],
		models: [
			{ id: 'MiniMax-M2', label: 'MiniMax M2', isDefault: true },
			{ id: 'MiniMax-Text-01', label: 'MiniMax Text 01' },
			{ id: 'abab6.5s-chat', label: 'abab6.5s Chat' },
		],
	},
	{
		id: 'claude',
		label: 'Claude',
		group: 'Frontier',
		envKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
		models: [
			{ id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', isDefault: true },
			{ id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
			{ id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
		],
	},
	{
		id: 'openai',
		label: 'OpenAI',
		group: 'Frontier',
		envKeys: ['OPENAI_API_KEY'],
		models: [
			{ id: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
			{ id: 'gpt-4-1106-preview', label: 'GPT-4 1106' },
			{ id: 'gpt-4', label: 'GPT-4' },
			{ id: 'gpt-3.5-turbo-1106', label: 'GPT-3.5 Turbo 1106' },
			{ id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', isDefault: true },
		],
	},
	{
		id: 'groq',
		label: 'Groq',
		group: 'Fast',
		envKeys: ['GROQ_API_KEY'],
		models: [
			{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', isDefault: true },
			{ id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
			{ id: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2 (Groq)' },
			{ id: 'qwen/qwen3-32b', label: 'Qwen3 32B (Groq)' },
			{ id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
			{ id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
		],
	},
	{
		id: 'ollama',
		label: 'Ollama (local)',
		group: 'Local',
		envKeys: [],
		keyless: true,
		models: [
			{ id: 'qwen2.5-coder', label: 'Qwen2.5 Coder', isDefault: true },
			{ id: 'qwen2.5-coder:32b', label: 'Qwen2.5 Coder 32B' },
			{ id: 'qwen3', label: 'Qwen3' },
			{ id: 'deepseek-coder-v2', label: 'DeepSeek Coder v2' },
			{ id: 'llama3.1', label: 'Llama 3.1' },
		],
	},
	{
		id: 'openrouter',
		label: 'OpenRouter',
		group: 'Aggregator',
		// OpenRouter is absent from ProviderManager.ENV_KEYS: the key has to come
		// from stored config, so it is surfaced but never reported as env-ready.
		envKeys: [],
		models: [
			{ id: 'openai/gpt-4o', label: 'GPT-4o', isDefault: true },
			{ id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
			{ id: 'anthropic/claude-3-opus', label: 'Claude 3 Opus' },
			{ id: 'meta-llama/llama-3.1-405b-instruct', label: 'Llama 3.1 405B' },
			{ id: 'qwen/qwen-2-72b-instruct', label: 'Qwen2 72B' },
			{ id: 'mistralai/mixtral-8x7b-instruct', label: 'Mixtral 8x7B' },
		],
	},
	{
		id: 'meta',
		label: 'Meta (Together)',
		group: 'Aggregator',
		envKeys: ['META_API_KEY', 'TOGETHER_API_KEY'],
		// Send the friendly id: the provider rewrites it to the Together id and
		// rejects the rewritten form in validateConfig.
		models: [
			{ id: 'llama-3.1-8b-instruct', label: 'Llama 3.1 8B', isDefault: true },
			{ id: 'llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
			{ id: 'llama-3.1-405b-instruct', label: 'Llama 3.1 405B' },
			{ id: 'code-llama-70b-instruct', label: 'CodeLlama 70B' },
		],
	},
];

export interface EchoModelOption {
	providerId: string;
	providerLabel: string;
	group: string;
	modelId: string;
	modelLabel: string;
	isDefault: boolean;
	reasoning: boolean;
	/** A credential is present in the environment, or the provider needs none. */
	available: boolean;
}

/** Flatten the catalog for the picker, marking which entries can actually run. */
export function listModelOptions(env: NodeJS.ProcessEnv = process.env): EchoModelOption[] {
	const options: EchoModelOption[] = [];
	for (const provider of ECHO_PROVIDERS) {
		const hasKey = provider.envKeys.some((key) => (env[key] ?? '').trim().length > 0);
		const available = hasKey || provider.keyless === true;
		for (const model of provider.models) {
			options.push({
				providerId: provider.id,
				providerLabel: provider.label,
				group: provider.group,
				modelId: model.id,
				modelLabel: model.label,
				isDefault: model.isDefault === true,
				reasoning: model.reasoning === true,
				available,
			});
		}
	}
	return options;
}

/** Reject a routing pair that is not in the catalog, so a bad id never reaches a provider. */
export function isKnownRouting(providerId: string, modelId: string): boolean {
	const provider = ECHO_PROVIDERS.find((candidate) => candidate.id === providerId);
	return Boolean(provider?.models.some((model) => model.id === modelId));
}

export function findModelOption(
	providerId: string,
	modelId: string,
	env: NodeJS.ProcessEnv = process.env,
): EchoModelOption | undefined {
	return listModelOptions(env).find(
		(option) => option.providerId === providerId && option.modelId === modelId,
	);
}
