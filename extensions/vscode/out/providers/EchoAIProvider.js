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
exports.EchoAIProvider = void 0;
const vscode = __importStar(require("vscode"));
class EchoAIProvider {
    constructor(configManager) {
        this.providers = new Map();
        this.configManager = configManager;
        this.initializeProviders();
    }
    async initializeProviders() {
        // Initialize AI providers
        try {
            // Claude/Anthropic
            const { Anthropic } = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
            this.providers.set('claude', Anthropic);
            // OpenAI
            const { OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
            this.providers.set('openai', OpenAI);
            // Groq
            const { Groq } = await Promise.resolve().then(() => __importStar(require('groq-sdk')));
            this.providers.set('groq', Groq);
        }
        catch (error) {
            console.error('Failed to initialize AI providers:', error);
        }
    }
    async getCompletion(prompt, context, language, maxTokens = 100) {
        const provider = this.configManager.get('provider', 'claude');
        const model = this.configManager.get('model', 'claude-3-5-sonnet-20241022');
        try {
            const apiKey = await this.getApiKey(provider);
            if (!apiKey) {
                throw new Error(`No API key configured for ${provider}`);
            }
            const fullPrompt = this.buildCompletionPrompt(prompt, context, language);
            switch (provider) {
                case 'claude':
                    return await this.getClaudeCompletion(apiKey, model, fullPrompt, maxTokens);
                case 'openai':
                    return await this.getOpenAICompletion(apiKey, model, fullPrompt, maxTokens);
                case 'groq':
                    return await this.getGroqCompletion(apiKey, model, fullPrompt, maxTokens);
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        }
        catch (error) {
            console.error(`Echo AI completion error with ${provider}:`, error);
            throw error;
        }
    }
    async explainCode(code, language) {
        const prompt = `Explain this ${language} code in detail, including what it does, how it works, and any important patterns or concepts used:

\`\`\`${language}
${code}
\`\`\`

Provide a clear, educational explanation that would help a developer understand this code.`;
        return await this.getCompletion(prompt, '', language, 500);
    }
    async refactorCode(code, language) {
        const prompt = `Refactor this ${language} code to improve readability, performance, and maintainability while preserving the exact same functionality:

\`\`\`${language}
${code}
\`\`\`

Return only the refactored code without explanations.`;
        return await this.getCompletion(prompt, '', language, 1000);
    }
    async generateTests(functions, language) {
        const functionsStr = functions.map(f => f.signature).join('\n');
        const prompt = `Generate comprehensive unit tests for these ${language} functions:

${functionsStr}

Include:
- Test setup and teardown if needed
- Happy path tests
- Edge cases and error conditions
- Mock dependencies where appropriate
- Clear test descriptions

Use appropriate testing framework for ${language}.`;
        return await this.getCompletion(prompt, '', language, 2000);
    }
    async fixErrors(code, diagnostics, language) {
        const errors = diagnostics.map(d => ({
            line: d.range.start.line + 1,
            message: d.message,
            severity: d.severity
        }));
        const prompt = `Fix the following errors in this ${language} code:

Errors:
${errors.map(e => `Line ${e.line}: ${e.message}`).join('\n')}

Code:
\`\`\`${language}
${code}
\`\`\`

Return the corrected code with all errors fixed.`;
        return await this.getCompletion(prompt, '', language, 2000);
    }
    async detectSyntaxErrors(code, language) {
        const prompt = `Analyze this ${language} code for syntax errors, type errors, and potential issues:

\`\`\`${language}
${code}
\`\`\`

Return a JSON array of issues in this format:
[{"line": 1, "message": "Error description", "severity": "error"}]

Only return the JSON array, no other text.`;
        try {
            const response = await this.getCompletion(prompt, '', language, 500);
            return JSON.parse(response);
        }
        catch (error) {
            console.error('Error parsing syntax errors:', error);
            return [];
        }
    }
    buildCompletionPrompt(prompt, context, language) {
        const maxContextSize = this.configManager.get('maxContextSize', 4000);
        const truncatedContext = context.length > maxContextSize
            ? context.substring(0, maxContextSize) + '...'
            : context;
        return `You are an expert ${language} developer. Complete the following code naturally and accurately.

Context:
${truncatedContext}

Current line/request:
${prompt}

Provide only the completion code without explanations or markdown formatting.`;
    }
    async getApiKey(provider) {
        const secrets = vscode.workspace.getConfiguration().inspect(`echo-ai-${provider}`);
        if (secrets?.globalValue) {
            return secrets.globalValue;
        }
        // Try to get from secrets storage
        try {
            const extensionContext = vscode.extensions.getExtension('vijeet-shah.echo-ai-vscode')?.exports?.context;
            if (extensionContext?.secrets) {
                return await extensionContext.secrets.get(`echo-ai-${provider}`);
            }
        }
        catch (error) {
            console.error('Failed to retrieve API key from secrets:', error);
        }
        return undefined;
    }
    async getClaudeCompletion(apiKey, model, prompt, maxTokens) {
        const Anthropic = this.providers.get('claude');
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
            model: model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
    }
    async getOpenAICompletion(apiKey, model, prompt, maxTokens) {
        const OpenAI = this.providers.get('openai');
        const client = new OpenAI({ apiKey });
        const response = await client.chat.completions.create({
            model: model.startsWith('gpt-') ? model : 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.1
        });
        return response.choices[0]?.message?.content || '';
    }
    async getGroqCompletion(apiKey, model, prompt, maxTokens) {
        const Groq = this.providers.get('groq');
        const client = new Groq({ apiKey });
        const response = await client.chat.completions.create({
            model: model.includes('llama') ? model : 'llama3-70b-8192',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.1
        });
        return response.choices[0]?.message?.content || '';
    }
}
exports.EchoAIProvider = EchoAIProvider;
