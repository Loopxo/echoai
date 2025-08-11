import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { ProviderManager } from '../core/provider-manager.js';
import type { Config } from '../config/index.js';
import { ConfigManager } from '../config/manager.js';
import { AdvancedAgentOrchestrator } from '../agents/nlp/agent-orchestrator.js';

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
  private wss!: WebSocketServer;
  private server: any;
  private connections = new Map<string, WebSocket>();
  private providerManager: ProviderManager;
  private configManager: ConfigManager;
  private orchestrator: AdvancedAgentOrchestrator;
  private port: number;

  constructor(configManager: ConfigManager, port = 8765) {
    super();
    this.configManager = configManager;
    this.port = port;
    this.providerManager = new ProviderManager(configManager);
    this.orchestrator = new AdvancedAgentOrchestrator(configManager);
    this.setupServer();
  }

  private setupServer() {
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws: WebSocket) => {
      const connectionId = this.generateConnectionId();
      this.connections.set(connectionId, ws);

      ws.on('message', async (message: Buffer) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          await this.handleMessage(connectionId, parsedMessage);
        } catch (error) {
          this.sendError(connectionId, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.connections.delete(connectionId);
      });

      // Send initial capabilities
      this.sendMessage(connectionId, {
        type: 'capabilities',
        data: this.getCapabilities()
      });
    });
  }

  private async handleMessage(connectionId: string, message: any) {
    switch (message.type) {
      case 'completion':
        await this.handleCompletion(connectionId, message);
        break;
      default:
        this.sendError(connectionId, `Unknown message type: ${message.type}`);
    }
  }

  private async handleCompletion(connectionId: string, request: CompletionRequest) {
    try {
      const config = await this.configManager.getConfig();
      const model = request.options?.model || Object.keys(config.providers || {})[0] || 'claude';
      const provider = await this.providerManager.getProvider(model);

      if (!provider) {
        this.sendError(connectionId, `Provider not found: ${model}`);
        return;
      }

      const context = this.buildContextPrompt(request.context);
      const prompt = this.buildCompletionPrompt(context, request.prompt);

      const response = await provider.complete(prompt, {
        temperature: request.options?.temperature || 0.3,
        maxTokens: request.options?.maxTokens || 500,
        model
      });

      const suggestions = this.parseSuggestions(response, request.context);
      
      const completionResponse: CompletionResponse = {
        id: request.id,
        type: 'completion',
        content: response,
        suggestions,
        metadata: {
          model,
          tokensUsed: this.estimateTokens(prompt + response),
          processingTime: 100 // Placeholder
        }
      };

      this.sendMessage(connectionId, completionResponse);
    } catch (error) {
      this.sendError(connectionId, 'Completion failed', error);
    }
  }

  private buildContextPrompt(context: IDEContext): string {
    let prompt = `Context:\n`;
    prompt += `Workspace: ${context.workspaceRoot}\n`;
    
    if (context.gitBranch) {
      prompt += `Git Branch: ${context.gitBranch}\n`;
    }
    
    prompt += `\nFiles:\n`;
    context.files.forEach(file => {
      prompt += `- ${file.uri} (${file.language})\n`;
    });
    
    return prompt;
  }

  private buildCompletionPrompt(context: string, userPrompt?: string): string {
    const prompt = `${context}\n\n`;
    
    if (userPrompt) {
      return prompt + `User request: ${userPrompt}`;
    }
    
    return prompt + `Please provide code completion for the current context.`;
  }

  private parseSuggestions(response: string, context: IDEContext): Array<{ text: string; confidence: number; type: 'inline' | 'multiline' | 'function' | 'class' }> {
    // Simple parsing - in production this would be more sophisticated
    return [
      {
        text: response,
        confidence: 0.8,
        type: 'multiline' as const
      }
    ];
  }

  private sendMessage(connectionId: string, message: any) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify(message));
    }
  }

  private sendError(connectionId: string, message: string, error?: any) {
    this.sendMessage(connectionId, {
      type: 'error',
      message,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  private generateConnectionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private getCapabilities() {
    return {
      completion: true,
      chat: false,
      refactor: false,
      explain: false,
      optimize: false
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`IDE Server running on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('IDE Server stopped');
        resolve();
      });
    });
  }
}