import {
  UsageMetrics,
  ProviderMetrics,
  ToolUsageStats,
  SessionStats,
  DailyStats,
  AnalyticsConfig,
  CostAnalysis,
} from '../types/analytics.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';

export class AnalyticsTracker {
  private config: AnalyticsConfig;
  private currentSession?: SessionStats;
  private dataPath: string;
  private configPath: string;

  constructor() {
    const echoDir = join(homedir(), '.echo');
    this.dataPath = join(echoDir, 'analytics');
    this.configPath = join(echoDir, 'analytics-config.json');
    this.config = this.getDefaultConfig();
    this.ensureDirectories();
  }

  async initialize(): Promise<void> {
    await this.loadConfig();
  }

  private getDefaultConfig(): AnalyticsConfig {
    return {
      enableTracking: true,
      trackingLevel: 'detailed',
      retentionDays: 90,
      anonymizeData: false,
      trackPerformance: true,
      trackCosts: true,
    };
  }

  async startSession(provider: string, model: string): Promise<string> {
    if (!this.config.enableTracking) return '';

    const sessionId = uuidv4();
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      messageCount: 0,
      provider,
      model,
      usage: {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        requestCount: 0,
        averageResponseTime: 0,
        sessionDuration: 0,
      },
      toolUsage: {},
      contextFiles: [],
      successful: true,
    };

    return sessionId;
  }

  async endSession(sessionId?: string): Promise<void> {
    if (!this.config.enableTracking || !this.currentSession) return;

    if (sessionId && this.currentSession.id !== sessionId) return;

    this.currentSession.endTime = new Date();
    this.currentSession.duration = 
      this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();
    this.currentSession.usage.sessionDuration = this.currentSession.duration;

    await this.saveSessionData(this.currentSession);
    this.currentSession = undefined;
  }

  async trackMessage(
    inputTokens: number,
    outputTokens: number,
    cost: number,
    responseTime: number
  ): Promise<void> {
    if (!this.config.enableTracking || !this.currentSession) return;

    this.currentSession.messageCount++;
    this.currentSession.usage.inputTokens += inputTokens;
    this.currentSession.usage.outputTokens += outputTokens;
    this.currentSession.usage.totalTokens += inputTokens + outputTokens;
    this.currentSession.usage.totalCost += cost;
    this.currentSession.usage.requestCount++;

    // Update average response time
    const totalTime = this.currentSession.usage.averageResponseTime * 
                     (this.currentSession.usage.requestCount - 1) + responseTime;
    this.currentSession.usage.averageResponseTime = 
      totalTime / this.currentSession.usage.requestCount;
  }

  async trackToolUsage(
    toolName: string,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    if (!this.config.enableTracking || !this.currentSession) return;

    if (!this.currentSession.toolUsage[toolName]) {
      this.currentSession.toolUsage[toolName] = {
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
        lastUsed: new Date(),
      };
    }

    const toolStats = this.currentSession.toolUsage[toolName];
    toolStats.callCount++;
    toolStats.lastUsed = new Date();

    if (success) {
      toolStats.successCount++;
    } else {
      toolStats.failureCount++;
    }

    // Update average execution time
    const totalTime = toolStats.averageExecutionTime * (toolStats.callCount - 1) + executionTime;
    toolStats.averageExecutionTime = totalTime / toolStats.callCount;
  }

  async trackContextFiles(files: string[]): Promise<void> {
    if (!this.config.enableTracking || !this.currentSession) return;

    this.currentSession.contextFiles = [...new Set([
      ...this.currentSession.contextFiles,
      ...files
    ])];
  }

  async trackError(error: Error): Promise<void> {
    if (!this.config.enableTracking || !this.currentSession) return;

    this.currentSession.successful = false;
    // Could add more detailed error tracking here
  }

  async getDailyStats(date?: Date): Promise<DailyStats | null> {
    const targetDate = date || new Date();
    const dateString = targetDate.toISOString().split('T')[0];

    try {
      const filePath = join(this.dataPath, 'daily', `${dateString}.json`);
      const data = await readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async getProviderMetrics(days = 30): Promise<ProviderMetrics> {
    const metrics: ProviderMetrics = {};
    const endDate = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      
      const dailyStats = await this.getDailyStats(date);
      if (!dailyStats) continue;

      Object.entries(dailyStats.providers).forEach(([provider, count]) => {
        if (!metrics[provider]) {
          metrics[provider] = {
            usage: {
              totalTokens: 0,
              inputTokens: 0,
              outputTokens: 0,
              totalCost: 0,
              requestCount: 0,
              averageResponseTime: 0,
              sessionDuration: 0,
            },
            models: {},
            errorCount: 0,
            successRate: 100,
          };
        }
        // Would aggregate more detailed metrics here
      });
    }

    return metrics;
  }

  async getToolUsageStats(days = 30): Promise<ToolUsageStats> {
    const stats: ToolUsageStats = {};
    const endDate = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      
      const dailyStats = await this.getDailyStats(date);
      if (!dailyStats) continue;

      Object.entries(dailyStats.tools).forEach(([tool, count]) => {
        if (!stats[tool]) {
          stats[tool] = {
            callCount: 0,
            successCount: 0,
            failureCount: 0,
            averageExecutionTime: 0,
            lastUsed: new Date(),
          };
        }
        stats[tool].callCount += count;
      });
    }

    return stats;
  }

  async getCostAnalysis(): Promise<CostAnalysis> {
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const dailyTrends = [];
    let monthlyTotal = 0;
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    // Get daily stats for current month
    for (let d = new Date(firstOfMonth); d <= now; d.setDate(d.getDate() + 1)) {
      const dailyStats = await this.getDailyStats(d);
      if (dailyStats) {
        dailyTrends.push({
          date: dailyStats.date,
          cost: dailyStats.cost,
        });
        monthlyTotal += dailyStats.cost;

        // Aggregate by provider (would need more detailed data)
        Object.entries(dailyStats.providers).forEach(([provider, count]) => {
          const sessionShare = dailyStats.sessions > 0 ? dailyStats.cost * count / dailyStats.sessions : 0;
          byProvider[provider] = (byProvider[provider] || 0) + sessionShare;
        });
      }
    }

    // Calculate projections
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const dailyAverage = monthlyTotal / currentDay;
    const projectedTotal = dailyAverage * daysInMonth;

    return {
      currentMonth: {
        total: monthlyTotal,
        byProvider,
        byModel,
        dailyTrends,
      },
      projectedMonth: {
        total: projectedTotal,
        basedOnDays: currentDay,
      },
      alerts: {
        nearLimit: false, // Would implement based on user-set limits
        overBudget: false,
        unusualSpike: false,
      },
    };
  }

  async getConfig(): Promise<AnalyticsConfig> {
    return { ...this.config };
  }

  async updateConfig(newConfig: Partial<AnalyticsConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();
  }

  async exportData(format: 'json' | 'csv', days = 30): Promise<string> {
    const data = await this.aggregateData(days);
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Convert to CSV format
      return this.convertToCSV(data);
    }
  }

  private async aggregateData(days: number) {
    const data = [];
    const endDate = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      
      const dailyStats = await this.getDailyStats(date);
      if (dailyStats) {
        data.push(dailyStats);
      }
    }

    return data;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'object' ? JSON.stringify(value) : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private async saveSessionData(session: SessionStats): Promise<void> {
    const dateStr = session.startTime.toISOString().split('T')[0] || '';
    const dailyFile = join(this.dataPath, 'daily', `${dateStr}.json`);
    const sessionFile = join(this.dataPath, 'sessions', `${session.id}.json`);

    // Save individual session
    await writeFile(sessionFile, JSON.stringify(session, null, 2));

    // Update daily aggregation
    let dailyStats: DailyStats;
    
    try {
      const existingData = await readFile(dailyFile, 'utf8');
      dailyStats = JSON.parse(existingData);
    } catch {
      dailyStats = {
        date: dateStr,
        sessions: 0,
        messages: 0,
        tokens: 0,
        cost: 0,
        providers: {},
        tools: {},
      };
    }

    dailyStats.sessions++;
    dailyStats.messages += session.messageCount;
    dailyStats.tokens += session.usage.totalTokens;
    dailyStats.cost += session.usage.totalCost;
    dailyStats.providers[session.provider] = (dailyStats.providers[session.provider] || 0) + 1;

    Object.keys(session.toolUsage).forEach(tool => {
      const toolData = session.toolUsage[tool];
      if (toolData) {
        dailyStats.tools[tool] = (dailyStats.tools[tool] || 0) + toolData.callCount;
      }
    });

    await writeFile(dailyFile, JSON.stringify(dailyStats, null, 2));
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.dataPath,
      join(this.dataPath, 'daily'),
      join(this.dataPath, 'sessions'),
      join(this.dataPath, 'exports'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configData = await readFile(this.configPath, 'utf8');
      this.config = { ...this.config, ...JSON.parse(configData) };
    } catch {
      await this.saveConfig();
    }
  }

  private async saveConfig(): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }
}

// Global analytics tracker instance
export const analyticsTracker = new AnalyticsTracker();