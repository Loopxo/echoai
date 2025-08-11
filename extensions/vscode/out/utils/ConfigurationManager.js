"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const vscode = __importStar(require("vscode"));
class ConfigurationManager {
    constructor() {
        this.SECTION = 'echoAI';
    }
    get(key, defaultValue) {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        return config.get(key, defaultValue);
    }
    async set(key, value, target = vscode.ConfigurationTarget.Global) {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        await config.update(key, value, target);
    }
    async resetToDefaults() {
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
    onDidChange(listener) {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(this.SECTION)) {
                listener(e);
            }
        });
    }
    getProviderConfig() {
        return {
            provider: this.get('provider', 'claude'),
            model: this.get('model', 'claude-3-5-sonnet-20241022'),
            maxTokens: this.get('maxTokens', 4096),
            temperature: this.get('temperature', 0.7)
        };
    }
    getPerformanceConfig() {
        return {
            completionDelay: this.get('completionDelay', 500),
            maxContextSize: this.get('maxContextSize', 4000),
            enableCaching: this.get('enableCaching', true),
            cacheDuration: this.get('cacheDuration', 60000)
        };
    }
    getFeatureFlags() {
        return {
            enableInlineCompletion: this.get('enableInlineCompletion', true),
            enableErrorDetection: this.get('enableErrorDetection', true),
            enableCodeActions: this.get('enableCodeActions', true),
            enableStatusBar: this.get('enableStatusBar', true)
        };
    }
    validateConfiguration() {
        const errors = [];
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
    async migrateConfiguration() {
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
exports.ConfigurationManager = ConfigurationManager;
