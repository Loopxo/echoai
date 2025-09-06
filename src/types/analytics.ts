export interface UsageMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
  averageResponseTime: number;
  sessionDuration: number;
}

export interface ProviderMetrics {
  [provider: string]: {
    usage: UsageMetrics;
    models: {
      [model: string]: UsageMetrics;
    };
    errorCount: number;
    successRate: number;
  };
}

export interface ToolUsageStats {
  [toolName: string]: {
    callCount: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
    lastUsed: Date;
  };
}

export interface SessionStats {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  messageCount: number;
  provider: string;
  model: string;
  usage: UsageMetrics;
  toolUsage: ToolUsageStats;
  contextFiles: string[];
  successful: boolean;
}

export interface DailyStats {
  date: string;
  sessions: number;
  messages: number;
  tokens: number;
  cost: number;
  providers: Record<string, number>;
  tools: Record<string, number>;
}

export interface WeeklyStats {
  week: string;
  dailyBreakdown: DailyStats[];
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  averageSessionLength: number;
  mostUsedProvider: string;
  mostUsedTool: string;
}

export interface MonthlyStats {
  month: string;
  weeklyBreakdown: WeeklyStats[];
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  averageSessionLength: number;
  costTrends: Array<{ date: string; cost: number }>;
  usageTrends: Array<{ date: string; tokens: number }>;
}

export interface AnalyticsConfig {
  enableTracking: boolean;
  trackingLevel: 'basic' | 'detailed' | 'comprehensive';
  retentionDays: number;
  anonymizeData: boolean;
  trackPerformance: boolean;
  trackCosts: boolean;
}

export interface CostAnalysis {
  currentMonth: {
    total: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
    dailyTrends: Array<{ date: string; cost: number }>;
  };
  projectedMonth: {
    total: number;
    basedOnDays: number;
  };
  alerts: {
    nearLimit: boolean;
    overBudget: boolean;
    unusualSpike: boolean;
  };
}