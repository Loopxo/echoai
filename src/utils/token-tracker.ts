import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  provider: string;
  model: string;
  timestamp: string;
}

export interface TokenSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  totalUsage: TokenUsage;
  interactions: TokenUsage[];
  provider: string;
}

export interface TokenAnalytics {
  totalTokensUsed: number;
  totalCost: number;
  sessionsCount: number;
  dailyUsage: { [date: string]: number };
  providerUsage: { [provider: string]: number };
  lastReset: string;
}

export class TokenTracker {
  private configPath: string;
  private analyticsPath: string;
  private currentSession: TokenSession | null = null;

  constructor() {
    const configDir = join(homedir(), '.echo-ai');
    this.configPath = join(configDir, 'token-usage.json');
    this.analyticsPath = join(configDir, 'token-analytics.json');
  }

  startSession(provider: string): string {
    const sessionId = Date.now().toString();
    this.currentSession = {
      sessionId,
      startTime: new Date().toISOString(),
      totalUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        provider,
        model: '',
        timestamp: new Date().toISOString()
      },
      interactions: [],
      provider
    };
    return sessionId;
  }

  trackUsage(usage: Omit<TokenUsage, 'timestamp'>): TokenUsage {
    const fullUsage: TokenUsage = {
      ...usage,
      timestamp: new Date().toISOString()
    };

    if (this.currentSession) {
      this.currentSession.interactions.push(fullUsage);
      this.currentSession.totalUsage.inputTokens += usage.inputTokens;
      this.currentSession.totalUsage.outputTokens += usage.outputTokens;
      this.currentSession.totalUsage.totalTokens += usage.totalTokens;
      this.currentSession.totalUsage.estimatedCost += usage.estimatedCost;
    }

    // Update analytics
    this.updateAnalytics(fullUsage);

    return fullUsage;
  }

  endSession(): TokenSession | null {
    if (this.currentSession) {
      this.currentSession.endTime = new Date().toISOString();
      this.saveSession(this.currentSession);
      const session = this.currentSession;
      this.currentSession = null;
      return session;
    }
    return null;
  }

  getCurrentSessionUsage(): TokenUsage | null {
    return this.currentSession?.totalUsage || null;
  }

  getAnalytics(): TokenAnalytics {
    try {
      if (existsSync(this.analyticsPath)) {
        const data = readFileSync(this.analyticsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      // File doesn't exist or is corrupted, return default
    }

    return {
      totalTokensUsed: 0,
      totalCost: 0,
      sessionsCount: 0,
      dailyUsage: {},
      providerUsage: {},
      lastReset: new Date().toISOString()
    };
  }

  resetAnalytics(): void {
    const analytics: TokenAnalytics = {
      totalTokensUsed: 0,
      totalCost: 0,
      sessionsCount: 0,
      dailyUsage: {},
      providerUsage: {},
      lastReset: new Date().toISOString()
    };
    
    writeFileSync(this.analyticsPath, JSON.stringify(analytics, null, 2));
  }

  private updateAnalytics(usage: TokenUsage): void {
    const analytics = this.getAnalytics();
    
    analytics.totalTokensUsed += usage.totalTokens;
    analytics.totalCost += usage.estimatedCost;
    
    // Daily usage
    const today = new Date().toISOString().split('T')[0];
    if (!analytics.dailyUsage) analytics.dailyUsage = {};
    if (today) {
      analytics.dailyUsage[today] = (analytics.dailyUsage[today] || 0) + usage.totalTokens;
    }
    
    // Provider usage
    if (!analytics.providerUsage) analytics.providerUsage = {};
    analytics.providerUsage[usage.provider] = (analytics.providerUsage[usage.provider] || 0) + usage.totalTokens;
    
    writeFileSync(this.analyticsPath, JSON.stringify(analytics, null, 2));
  }

  private saveSession(session: TokenSession): void {
    try {
      let sessions: TokenSession[] = [];
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        sessions = JSON.parse(data);
      }
      
      sessions.push(session);
      
      // Keep only last 100 sessions to prevent file from growing too large
      if (sessions.length > 100) {
        sessions = sessions.slice(-100);
      }
      
      writeFileSync(this.configPath, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token (GPT tokenization approximation)
    return Math.ceil(text.length / 4);
  }

  estimateCost(tokens: number, provider: string, model: string, isInput: boolean = false): number {
    // Token pricing per 1000 tokens (approximate, as of 2024)
    const pricing: { [key: string]: { [key: string]: { input: number; output: number } } } = {
      'claude': {
        'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
        'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
        'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
      },
      'openai': {
        'gpt-4o': { input: 0.005, output: 0.015 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-3.5-turbo': { input: 0.001, output: 0.002 }
      },
      'gemini': {
        'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
        'gemini-1.5-flash': { input: 0.00035, output: 0.00105 }
      },
      'groq': {
        'llama3-70b-8192': { input: 0.00059, output: 0.00079 },
        'llama3-8b-8192': { input: 0.00005, output: 0.00008 }
      }
    };

    const providerPricing = pricing[provider];
    if (!providerPricing) return 0;

    const modelPricing = providerPricing[model];
    if (!modelPricing) return 0;

    const rate = isInput ? modelPricing.input : modelPricing.output;
    return (tokens / 1000) * rate;
  }

  formatUsage(usage: TokenUsage): string {
    return `📊 Tokens: ${usage.totalTokens.toLocaleString()} (↗️ ${usage.inputTokens.toLocaleString()} in, ↙️ ${usage.outputTokens.toLocaleString()} out) | 💰 ~$${usage.estimatedCost.toFixed(4)}`;
  }

  formatAnalytics(analytics: TokenAnalytics): string {
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = (analytics.dailyUsage && today && analytics.dailyUsage[today]) || 0;
    
    return `📈 Total: ${analytics.totalTokensUsed.toLocaleString()} tokens | 💰 Total cost: ~$${analytics.totalCost.toFixed(2)} | 📅 Today: ${todayUsage.toLocaleString()} tokens`;
  }

  checkLimits(usage: TokenUsage, limits: { daily?: number; session?: number; cost?: number }): { 
    exceeded: boolean; 
    warnings: string[];
    type: 'daily' | 'session' | 'cost' | null;
  } {
    const warnings: string[] = [];
    let exceeded = false;
    let exceedType: 'daily' | 'session' | 'cost' | null = null;

    const analytics = this.getAnalytics();
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = (analytics.dailyUsage && today && analytics.dailyUsage[today]) || 0;

    // Check daily limit
    if (limits.daily && todayUsage >= limits.daily) {
      exceeded = true;
      exceedType = 'daily';
      warnings.push(`⚠️ Daily token limit exceeded: ${todayUsage.toLocaleString()}/${limits.daily.toLocaleString()}`);
    } else if (limits.daily && todayUsage > limits.daily * 0.8) {
      warnings.push(`⚠️ Approaching daily limit: ${todayUsage.toLocaleString()}/${limits.daily.toLocaleString()} (80%)`);
    }

    // Check session limit
    const sessionUsage = this.currentSession?.totalUsage.totalTokens || 0;
    if (limits.session && sessionUsage >= limits.session) {
      exceeded = true;
      exceedType = 'session';
      warnings.push(`⚠️ Session token limit exceeded: ${sessionUsage.toLocaleString()}/${limits.session.toLocaleString()}`);
    } else if (limits.session && sessionUsage > limits.session * 0.8) {
      warnings.push(`⚠️ Approaching session limit: ${sessionUsage.toLocaleString()}/${limits.session.toLocaleString()} (80%)`);
    }

    // Check cost limit
    if (limits.cost && analytics.totalCost >= limits.cost) {
      exceeded = true;
      exceedType = 'cost';
      warnings.push(`⚠️ Cost limit exceeded: $${analytics.totalCost.toFixed(2)}/$${limits.cost.toFixed(2)}`);
    } else if (limits.cost && analytics.totalCost > limits.cost * 0.8) {
      warnings.push(`⚠️ Approaching cost limit: $${analytics.totalCost.toFixed(2)}/$${limits.cost.toFixed(2)} (80%)`);
    }

    return { exceeded, warnings, type: exceedType };
  }
}

// Global token tracker instance
export const tokenTracker = new TokenTracker();