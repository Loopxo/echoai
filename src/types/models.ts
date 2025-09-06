export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  tool_call?: boolean;
  knowledge?: string;
  release_date?: string;
  last_updated?: string;
  modalities?: {
    input: string[];
    output: string[];
  };
  open_weights?: boolean;
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

export interface Provider {
  id: string;
  name: string;
  env?: string[];
  npm?: string;
  api?: string;
  doc?: string;
  models: Record<string, ModelInfo>;
}

export interface ModelsRegistry {
  [providerId: string]: Provider;
}

export interface ModelCapabilities {
  supportsImages: boolean;
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsAttachments: boolean;
  supportsTemperature: boolean;
  maxContext: number;
  maxOutput: number;
}

export interface ModelTestResult {
  modelId: string;
  provider: string;
  testName: string;
  success: boolean;
  responseTime: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
  error?: string;
  response?: string;
}

export interface ModelComparison {
  testPrompt: string;
  models: string[];
  results: Record<string, {
    response: string;
    responseTime: number;
    cost: number;
    tokensUsed: {
      input: number;
      output: number;
    };
    success: boolean;
    error?: string;
  }>;
  timestamp: Date;
}

export interface ModelBenchmark {
  name: string;
  description: string;
  prompts: string[];
  evaluationCriteria: string[];
  expectedOutputs?: string[];
}

export interface BenchmarkResult {
  benchmark: ModelBenchmark;
  modelResults: Record<string, {
    responses: string[];
    scores: Record<string, number>;
    averageScore: number;
    totalCost: number;
    totalTime: number;
  }>;
  timestamp: Date;
}