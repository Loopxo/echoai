import { PluginAPI, PluginContext, PluginAgent, PluginProvider, PluginCommand } from '../core/plugin-manager.js';

// Base classes for different plugin types
export abstract class EchoPlugin {
    constructor(
        protected context: PluginContext,
        protected api: PluginAPI
    ) {}

    abstract activate(): Promise<void>;
    
    async deactivate(): Promise<void> {
        // Default implementation - plugins can override
    }
    
    async dispose(): Promise<void> {
        // Default implementation - plugins can override
    }
}

export abstract class AgentPlugin extends EchoPlugin {
    abstract getAgentDefinition(): PluginAgent;
    
    abstract handleRequest(intent: string, parameters: any, context: any): Promise<any>;
    
    async activate(): Promise<void> {
        const agentDef = this.getAgentDefinition();
        this.api.agents.register(agentDef);
        
        // Register command handlers for this agent
        this.api.commands.register(`agent.${agentDef.id}.execute`, this.handleRequest.bind(this));
    }
    
    async deactivate(): Promise<void> {
        const agentDef = this.getAgentDefinition();
        this.api.agents.unregister(agentDef.id);
        this.api.commands.unregister(`agent.${agentDef.id}.execute`);
    }
}

export abstract class ProviderPlugin extends EchoPlugin {
    abstract getProviderDefinition(): PluginProvider;
    
    abstract generateCompletion(
        prompt: string,
        systemMessage: string,
        context: string,
        maxTokens: number,
        options?: any
    ): Promise<string>;
    
    abstract generateChat(messages: any[], options?: any): Promise<string>;
    
    async activate(): Promise<void> {
        const providerDef = this.getProviderDefinition();
        this.api.providers.register(providerDef);
        
        // Register provider methods
        this.api.commands.register(`provider.${providerDef.id}.completion`, this.generateCompletion.bind(this));
        this.api.commands.register(`provider.${providerDef.id}.chat`, this.generateChat.bind(this));
    }
    
    async deactivate(): Promise<void> {
        const providerDef = this.getProviderDefinition();
        this.api.providers.unregister(providerDef.id);
        this.api.commands.unregister(`provider.${providerDef.id}.completion`);
        this.api.commands.unregister(`provider.${providerDef.id}.chat`);
    }
}

export abstract class ToolPlugin extends EchoPlugin {
    abstract getCommands(): PluginCommand[];
    
    async activate(): Promise<void> {
        const commands = this.getCommands();
        
        for (const command of commands) {
            const handler = (this as any)[`handle_${command.command.replace('.', '_')}`];
            if (typeof handler === 'function') {
                this.api.commands.register(command.command, handler.bind(this));
            }
        }
    }
    
    async deactivate(): Promise<void> {
        const commands = this.getCommands();
        
        for (const command of commands) {
            this.api.commands.unregister(command.command);
        }
    }
}

// Utility functions for plugin development
export class PluginUtils {
    static async readConfig(context: PluginContext, key: string, defaultValue?: any): Promise<any> {
        return context.globalState.get(key, defaultValue);
    }
    
    static async writeConfig(context: PluginContext, key: string, value: any): Promise<void> {
        await context.globalState.update(key, value);
    }
    
    static async readSecret(context: PluginContext, key: string): Promise<string | undefined> {
        return await context.secrets.get(key);
    }
    
    static async writeSecret(context: PluginContext, key: string, value: string): Promise<void> {
        await context.secrets.store(key, value);
    }
    
    static validatePermissions(requiredPermissions: string[], availablePermissions: string[]): boolean {
        return requiredPermissions.every(perm => availablePermissions.includes(perm));
    }
    
    static async httpRequest(url: string, options: RequestInit = {}): Promise<Response> {
        // Basic HTTP client - plugins would use this for API calls
        return fetch(url, {
            headers: {
                'User-Agent': 'Echo-AI-Plugin/1.0',
                ...options.headers
            },
            ...options
        });
    }
    
    static parseLanguageFromFilename(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase();
        const languageMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascriptreact',
            'ts': 'typescript',
            'tsx': 'typescriptreact',
            'py': 'python',
            'java': 'java',
            'cs': 'csharp',
            'cpp': 'cpp',
            'c': 'c',
            'go': 'go',
            'rs': 'rust',
            'php': 'php',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin'
        };
        
        return languageMap[ext || ''] || 'text';
    }
    
    static extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
        const blocks: Array<{ language: string; code: string }> = [];
        let match;
        
        while ((match = codeBlockRegex.exec(text)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2]!
            });
        }
        
        return blocks;
    }
    
    static formatOutput(content: string, type: 'code' | 'markdown' | 'plain' = 'plain'): string {
        switch (type) {
            case 'code':
                return `\`\`\`\n${content}\n\`\`\``;
            case 'markdown':
                return content; // Assume already formatted
            case 'plain':
            default:
                return content;
        }
    }
}

// Decorators for easier plugin development
export function command(commandId: string, title: string, description?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        if (!target._commands) {
            target._commands = [];
        }
        
        target._commands.push({
            command: commandId,
            title,
            description,
            handler: propertyKey
        });
    };
}

export function intent(intentName: string, confidence: number = 0.8) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        if (!target._intents) {
            target._intents = [];
        }
        
        target._intents.push({
            intent: intentName,
            confidence,
            handler: propertyKey
        });
    };
}

export function permission(permissionType: string) {
    return function (target: any) {
        if (!target._permissions) {
            target._permissions = [];
        }
        
        target._permissions.push(permissionType);
    };
}

// Example plugin implementations for reference
export class ExampleAgentPlugin extends AgentPlugin {
    getAgentDefinition(): PluginAgent {
        return {
            id: 'example-agent',
            name: 'Example Agent',
            description: 'An example agent for demonstration',
            intents: ['example_intent'],
            capabilities: ['code_generation', 'explanation'],
            priority: 5
        };
    }
    
    async handleRequest(intent: string, parameters: any, context: any): Promise<any> {
        this.context.logger.info(`Handling request for intent: ${intent}`);
        
        switch (intent) {
            case 'example_intent':
                return {
                    response: 'This is an example response from the plugin agent',
                    confidence: 0.9,
                    data: parameters
                };
            
            default:
                throw new Error(`Unknown intent: ${intent}`);
        }
    }
}

export class ExampleProviderPlugin extends ProviderPlugin {
    getProviderDefinition(): PluginProvider {
        return {
            id: 'example-provider',
            name: 'Example Provider',
            description: 'An example AI provider',
            apiType: 'custom',
            models: ['example-model-1', 'example-model-2']
        };
    }
    
    async generateCompletion(
        prompt: string,
        systemMessage: string,
        context: string,
        maxTokens: number,
        options?: any
    ): Promise<string> {
        this.context.logger.info('Generating completion with example provider');
        
        // This is a mock implementation - real providers would call external APIs
        return `Example completion for prompt: "${prompt.substring(0, 50)}..."`;
    }
    
    async generateChat(messages: any[], options?: any): Promise<string> {
        this.context.logger.info('Generating chat response with example provider');
        
        const lastMessage = messages[messages.length - 1];
        return `Example chat response to: "${lastMessage?.content?.substring(0, 50)}..."`;
    }
}

export class ExampleToolPlugin extends ToolPlugin {
    getCommands(): PluginCommand[] {
        return [
            {
                command: 'example.hello',
                title: 'Say Hello',
                description: 'A simple hello command'
            },
            {
                command: 'example.analyze',
                title: 'Analyze Code',
                description: 'Analyze code with example tool'
            }
        ];
    }
    
    async handle_example_hello(): Promise<string> {
        const config = await PluginUtils.readConfig(this.context, 'greeting', 'Hello');
        return `${config} from Example Tool Plugin!`;
    }
    
    async handle_example_analyze(code: string, language?: string): Promise<any> {
        this.context.logger.info(`Analyzing ${language || 'unknown'} code`);
        
        return {
            linesOfCode: code.split('\n').length,
            characters: code.length,
            language: language || PluginUtils.parseLanguageFromFilename('file.txt'),
            codeBlocks: PluginUtils.extractCodeBlocks(code),
            analysis: 'This is an example analysis result'
        };
    }
}

// Plugin creation helpers
export function createAgentPlugin(
    definition: Omit<PluginAgent, 'id'> & { id?: string },
    handler: (intent: string, parameters: any, context: any) => Promise<any>
): typeof AgentPlugin {
    return class extends AgentPlugin {
        getAgentDefinition(): PluginAgent {
            return {
                id: definition.id || `custom-agent-${Date.now()}`,
                ...definition
            };
        }
        
        async handleRequest(intent: string, parameters: any, context: any): Promise<any> {
            return await handler(intent, parameters, context);
        }
    };
}

export function createToolPlugin(
    commands: Array<PluginCommand & { handler: (...args: any[]) => any }>
): typeof ToolPlugin {
    return class extends ToolPlugin {
        getCommands(): PluginCommand[] {
            return commands.map(({ handler, ...cmd }) => cmd);
        }
        
        constructor(context: PluginContext, api: PluginAPI) {
            super(context, api);
            
            // Bind handlers dynamically
            for (const cmd of commands) {
                const methodName = `handle_${cmd.command.replace('.', '_')}`;
                (this as any)[methodName] = cmd.handler.bind(this);
            }
        }
    };
}

// Type helpers for plugin development
export type EchoPluginConstructor = new (context: PluginContext, api: PluginAPI) => EchoPlugin;

export interface PluginExport {
    activate: (context: PluginContext, api: PluginAPI) => Promise<void>;
    deactivate?: () => Promise<void>;
    dispose?: () => Promise<void>;
}

// Plugin testing utilities
export class PluginTester {
    static createMockContext(): PluginContext {
        return {
            pluginPath: '/mock/plugin/path',
            globalStoragePath: '/mock/storage/global.json',
            workspaceStoragePath: '/mock/storage/workspace.json',
            extensionMode: 'development',
            globalState: new MockStorage(),
            workspaceState: new MockStorage(),
            secrets: new MockSecrets(),
            logger: new MockLogger()
        };
    }
    
    static createMockAPI(): PluginAPI {
        return {
            echo: { version: '1.0.0', platform: 'test', config: {} },
            agents: {
                register: () => {},
                unregister: () => {},
                list: () => []
            },
            providers: {
                register: () => {},
                unregister: () => {},
                list: () => []
            },
            commands: {
                register: () => {},
                unregister: () => {},
                execute: async () => {}
            },
            fs: {
                read: async () => '',
                write: async () => {},
                exists: async () => true,
                list: async () => []
            },
            workspace: {
                root: '/mock/workspace',
                files: [],
                getConfiguration: () => ({})
            },
            events: {
                on: () => {},
                off: () => {},
                emit: () => {}
            }
        };
    }
}

class MockStorage {
    private data: Record<string, any> = {};
    
    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.data[key] !== undefined ? this.data[key] : defaultValue;
    }
    
    async update(key: string, value: any): Promise<void> {
        this.data[key] = value;
    }
    
    keys(): readonly string[] {
        return Object.keys(this.data);
    }
}

class MockSecrets {
    private secrets: Record<string, string> = {};
    
    async get(key: string): Promise<string | undefined> {
        return this.secrets[key];
    }
    
    async store(key: string, value: string): Promise<void> {
        this.secrets[key] = value;
    }
    
    async delete(key: string): Promise<void> {
        delete this.secrets[key];
    }
}

class MockLogger {
    trace(message: string, ...args: any[]): void {
        console.log('[TRACE]', message, ...args);
    }
    
    debug(message: string, ...args: any[]): void {
        console.log('[DEBUG]', message, ...args);
    }
    
    info(message: string, ...args: any[]): void {
        console.log('[INFO]', message, ...args);
    }
    
    warn(message: string, ...args: any[]): void {
        console.log('[WARN]', message, ...args);
    }
    
    error(message: string, ...args: any[]): void {
        console.log('[ERROR]', message, ...args);
    }
}