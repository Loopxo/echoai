import * as vscode from 'vscode';

export class ConfigurationManager {
    private readonly SECTION = 'echoAI';

    get<T>(key: string, defaultValue: T): T {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        return config.get<T>(key, defaultValue);
    }

    async set<T>(key: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        await config.update(key, value, target);
    }

    async resetToDefaults(): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        const inspect = config.inspect('');
        
        if (inspect) {
            // Reset all configurations to undefined (use defaults)
            const keys = Object.keys(inspect);
            for (const key of keys) {
                await config.update(key, undefined, vscode.ConfigurationTarget.Global);
            }
        }
    }

    onDidChange(listener: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(this.SECTION)) {
                listener(e);
            }
        });
    }

    getProviderConfig(): {
        provider: string;
        model: string;
        maxTokens: number;
        temperature: number;
    } {
        return {
            provider: this.get('provider', 'claude'),
            model: this.get('model', 'claude-3-5-sonnet-20241022'),
            maxTokens: this.get('maxTokens', 4096),
            temperature: this.get('temperature', 0.7)
        };
    }

    getPerformanceConfig(): {
        completionDelay: number;
        maxContextSize: number;
        enableCaching: boolean;
        cacheDuration: number;
    } {
        return {
            completionDelay: this.get('completionDelay', 500),
            maxContextSize: this.get('maxContextSize', 4000),
            enableCaching: this.get('enableCaching', true),
            cacheDuration: this.get('cacheDuration', 60000)
        };
    }

    getFeatureFlags(): {
        enableInlineCompletion: boolean;
        enableErrorDetection: boolean;
        enableCodeActions: boolean;
        enableStatusBar: boolean;
    } {
        return {
            enableInlineCompletion: this.get('enableInlineCompletion', true),
            enableErrorDetection: this.get('enableErrorDetection', true),
            enableCodeActions: this.get('enableCodeActions', true),
            enableStatusBar: this.get('enableStatusBar', true)
        };
    }

    validateConfiguration(): string[] {
        const errors: string[] = [];
        
        const provider = this.get('provider', '');
        const validProviders = ['claude', 'openai', 'groq', 'openrouter', 'gemini', 'meta'];
        
        if (!validProviders.includes(provider)) {
            errors.push(`Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
        }
        
        const maxTokens = this.get('maxTokens', 4096);
        if (maxTokens < 1 || maxTokens > 100000) {
            errors.push('maxTokens must be between 1 and 100000');
        }
        
        const completionDelay = this.get('completionDelay', 500);
        if (completionDelay < 0 || completionDelay > 10000) {
            errors.push('completionDelay must be between 0 and 10000ms');
        }
        
        return errors;
    }

    async migrateConfiguration(): Promise<void> {
        // Handle migration from older configuration versions
        const config = vscode.workspace.getConfiguration(this.SECTION);
        
        // Example: migrate old 'apiKey' setting to secrets
        const oldApiKey = config.get('apiKey');
        if (oldApiKey) {
            // Move to secrets and remove from settings
            await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('API key has been moved to secure storage');
        }
    }
}