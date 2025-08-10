import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { ProviderManager } from '../core/provider-manager.js';
import { Config } from '../config/index.js';

export interface IDEContextFile {
  uri: string;
  content: string;
  language: string;
  cursor?: { line: number; character: number };
  selection?: { start: { line: number; character: number }, end: { line: number; character: number } };
}

export interface IDEContext {
  files: IDEContextFile[];
  activeFile?: string;
  workspaceRoot: string;
  gitBranch?: string;
  recentChanges?: { file: string; timestamp: number }[];
}

export interface CompletionRequest {
  id: string;
  type: 'completion' | 'chat' | 'refactor' | 'explain' | 'optimize';
  context: IDEContext;
  prompt?: string;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    includeContext?: boolean;
  };
}

export interface CompletionResponse {
  id: string;
  type: 'completion' | 'error' | 'partial';
  content: string;
  suggestions?: Array<{
    text: string;
    confidence: number;
    type: 'inline' | 'multiline' | 'function' | 'class';
  }>;
  error?: string;
  metadata?: {
    model: string;
    tokensUsed: number;
    processingTime: number;
  };
}

export class IDEServer extends EventEmitter {
  private wss: WebSocketServer;
  private server: any;
  private connections = new Map<string, WebSocket>();
  private providerManager: ProviderManager;
  private config: Config;
  private port: number;

  constructor(config: Config, port = 8765) {
    super();
    this.config = config;
    this.port = port;
    this.providerManager = new ProviderManager(config);
    this.setupServer();
  }

  private setupServer() {
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const connectionId = this.generateConnectionId();
      this.connections.set(connectionId, ws);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(connectionId, message);
        } catch (error) {
          this.sendError(connectionId, 'Invalid message format', error);
        }
      });

      ws.on('close', () => {
        this.connections.delete(connectionId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for connection ${connectionId}:`, error);
        this.connections.delete(connectionId);
      });

      this.sendMessage(connectionId, {
        type: 'connected',
        connectionId,
        capabilities: this.getCapabilities()
      });
    });
  }

  private async handleMessage(connectionId: string, message: any) {
    switch (message.type) {
      case 'completion':
        await this.handleCompletion(connectionId, message as CompletionRequest);
        break;
      case 'chat':
        await this.handleChat(connectionId, message);
        break;
      case 'refactor':
        await this.handleRefactor(connectionId, message);
        break;
      case 'explain':
        await this.handleExplain(connectionId, message);
        break;
      case 'optimize':
        await this.handleOptimize(connectionId, message);
        break;
      default:
        this.sendError(connectionId, `Unknown message type: ${message.type}`);
    }
  }

  private async handleCompletion(connectionId: string, request: CompletionRequest) {
    try {
      const startTime = Date.now();
      const model = request.options?.model || this.config.provider || 'claude';
      const provider = this.providerManager.getProvider(model);

      if (!provider) {
        this.sendError(connectionId, `Provider not found: ${model}`);
        return;
      }

      const context = this.buildContextPrompt(request.context);
      const prompt = this.buildCompletionPrompt(context, request.prompt);

      let response;
      if (provider.name === 'claude') {
        response = await provider.generateCompletion(prompt, {
          temperature: request.options?.temperature || 0.3,
          max_tokens: request.options?.maxTokens || 500,
          stream: true
        });
      } else if (provider.name === 'openai') {
        response = await provider.generateCompletion(prompt, {
          temperature: request.options?.temperature || 0.3,
          max_tokens: request.options?.maxTokens || 500,
          stream: true
        });
      } else if (provider.name === 'gemini') {
        response = await provider.generateCompletion(prompt, {
          temperature: request.options?.temperature || 0.3,
          maxOutputTokens: request.options?.maxTokens || 500
        });
      }

      const suggestions = this.parseSuggestions(response, request.context);
      
      const completionResponse: CompletionResponse = {
        id: request.id,
        type: 'completion',
        content: response,
        suggestions,
        metadata: {
          model,
          tokensUsed: this.estimateTokens(prompt + response),
          processingTime: Date.now() - startTime
        }
      };

      this.sendMessage(connectionId, completionResponse);
    } catch (error) {
      this.sendError(connectionId, 'Completion failed', error);
    }
  }

  private async handleChat(connectionId: string, request: any) {
    try {
      const startTime = Date.now();
      const model = request.options?.model || this.config.provider || 'claude';
      const provider = this.providerManager.getProvider(model);

      const context = this.buildContextPrompt(request.context);
      const chatPrompt = `${context}\n\nUser: ${request.message}\n\nAssistant:`;

      const response = await provider.generateCompletion(chatPrompt, {
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      });

      this.sendMessage(connectionId, {
        id: request.id,
        type: 'chat_response',
        content: response,
        metadata: {
          model,
          tokensUsed: this.estimateTokens(chatPrompt + response),
          processingTime: Date.now() - startTime
        }
      });
    } catch (error) {
      this.sendError(connectionId, 'Chat failed', error);
    }
  }

  private async handleRefactor(connectionId: string, request: any) {
    try {
      const provider = this.providerManager.getProvider('claude');
      const context = this.buildContextPrompt(request.context);
      
      const refactorPrompt = `${context}

Please refactor the following code to improve:
- Code quality and readability
- Performance
- Maintainability
- Following best practices for ${request.context.files[0]?.language || 'the language'}

Code to refactor:
${request.code}

Refactoring task: ${request.task || 'General refactoring'}

Provide the refactored code with explanations for the changes made.`;

      const response = await provider.generateCompletion(refactorPrompt, {
        temperature: 0.2,
        max_tokens: 2000
      });

      this.sendMessage(connectionId, {
        id: request.id,
        type: 'refactor_response',
        content: response,
        originalCode: request.code,
        suggestions: this.parseRefactoringSuggestions(response)
      });
    } catch (error) {
      this.sendError(connectionId, 'Refactoring failed', error);
    }
  }

  private async handleExplain(connectionId: string, request: any) {
    try {
      const provider = this.providerManager.getProvider('claude');
      const context = this.buildContextPrompt(request.context);
      
      const explainPrompt = `${context}

Please explain the following code in detail:
- What it does
- How it works
- Key concepts and patterns used
- Potential improvements or considerations

Code to explain:
${request.code}

Language: ${request.language || 'auto-detect'}

Provide a clear, educational explanation suitable for developers.`;

      const response = await provider.generateCompletion(explainPrompt, {
        temperature: 0.3,
        max_tokens: 1500
      });

      this.sendMessage(connectionId, {
        id: request.id,
        type: 'explanation',
        content: response,
        code: request.code
      });
    } catch (error) {
      this.sendError(connectionId, 'Explanation failed', error);
    }
  }

  private async handleOptimize(connectionId: string, request: any) {
    try {
      const provider = this.providerManager.getProvider('claude');
      const context = this.buildContextPrompt(request.context);
      
      const optimizePrompt = `${context}

Analyze and optimize the following code for:
- Performance improvements
- Memory efficiency
- Algorithmic optimizations
- Code structure improvements

Code to optimize:
${request.code}

Focus: ${request.focus || 'general performance'}

Provide optimized version with detailed explanations of improvements.`;

      const response = await provider.generateCompletion(optimizePrompt, {
        temperature: 0.2,
        max_tokens: 2000
      });

      this.sendMessage(connectionId, {
        id: request.id,
        type: 'optimization',
        content: response,
        originalCode: request.code,
        optimizations: this.parseOptimizations(response)
      });
    } catch (error) {
      this.sendError(connectionId, 'Optimization failed', error);
    }
  }

  private buildContextPrompt(context: IDEContext): string {
    let prompt = `# Development Context\n\n`;
    
    if (context.workspaceRoot) {
      prompt += `Workspace: ${context.workspaceRoot}\n`;
    }
    
    if (context.gitBranch) {
      prompt += `Git Branch: ${context.gitBranch}\n`;
    }

    if (context.files && context.files.length > 0) {
      prompt += `\n## Open Files:\n`;
      context.files.forEach(file => {
        prompt += `### ${file.uri} (${file.language})\n`;
        if (file.cursor) {
          prompt += `Cursor at line ${file.cursor.line + 1}, column ${file.cursor.character + 1}\n`;
        }
        if (file.selection) {
          prompt += `Selected: lines ${file.selection.start.line + 1}-${file.selection.end.line + 1}\n`;
        }
        prompt += `\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
      });
    }

    return prompt;
  }

  private buildCompletionPrompt(context: string, userPrompt?: string): string {
    let prompt = `${context}\n\n# Code Completion Task\n\n`;
    
    if (userPrompt) {
      prompt += `User request: ${userPrompt}\n\n`;
    }

    prompt += `Provide intelligent code completions based on the current context. Consider:
- Current cursor position and surrounding code
- Language-specific best practices
- Code patterns in the project
- Variable names and function signatures in scope

Generate appropriate suggestions that would help the developer continue writing code efficiently.`;

    return prompt;
  }

  private parseSuggestions(response: string, context: IDEContext): Array<{
    text: string;
    confidence: number;
    type: 'inline' | 'multiline' | 'function' | 'class';
  }> {
    const suggestions: Array<{
      text: string;
      confidence: number;
      type: 'inline' | 'multiline' | 'function' | 'class';
    }> = [];

    // Parse AI response for different types of suggestions
    const lines = response.split('\n');
    let currentSuggestion = '';
    let suggestionType: 'inline' | 'multiline' | 'function' | 'class' = 'inline';

    for (const line of lines) {
      if (line.includes('function ') || line.includes('def ') || line.includes('func ')) {
        suggestionType = 'function';
      } else if (line.includes('class ') || line.includes('interface ') || line.includes('type ')) {
        suggestionType = 'class';
      } else if (line.trim() === '' && currentSuggestion.length > 0) {
        suggestionType = 'multiline';
      }

      currentSuggestion += line + '\n';
    }

    if (currentSuggestion.trim()) {
      suggestions.push({
        text: currentSuggestion.trim(),
        confidence: 0.8,
        type: suggestionType
      });
    }

    return suggestions;
  }

  private parseRefactoringSuggestions(response: string): Array<{
    type: string;
    description: string;
    before: string;
    after: string;
  }> {
    // Parse refactoring suggestions from AI response
    return []; // Implementation would parse structured refactoring suggestions
  }

  private parseOptimizations(response: string): Array<{
    type: string;
    description: string;
    impact: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }> {
    // Parse optimization suggestions from AI response
    return []; // Implementation would parse structured optimization suggestions
  }

  private sendMessage(connectionId: string, message: any) {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(connectionId: string, message: string, error?: any) {
    this.sendMessage(connectionId, {
      type: 'error',
      message,
      error: error?.message || error
    });
  }

  private generateConnectionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private getCapabilities() {
    return {
      models: Array.from(this.providerManager.getAvailableProviders()),
      features: [
        'completion',
        'chat',
        'refactor',
        'explain',
        'optimize',
        'multi-model',
        'real-time'
      ],
      maxTokens: 4096,
      streaming: true
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        console.log(`Echo IDE Server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }
}