import { ModelBenchmark, BenchmarkResult, ModelTestResult } from '../types/models.js';
import { universalProvider } from './universal-provider.js';
import { modelsRegistry } from './registry.js';

export class ModelBenchmarks {
  private benchmarks: Map<string, ModelBenchmark> = new Map();

  constructor() {
    this.initializeDefaultBenchmarks();
  }

  private initializeDefaultBenchmarks(): void {
    const defaultBenchmarks: ModelBenchmark[] = [
      {
        name: 'reasoning',
        description: 'Test logical reasoning capabilities',
        prompts: [
          'If all cats are animals and all animals need food, what can we conclude about cats?',
          'A train travels 60 miles in 1 hour. At this rate, how long will it take to travel 180 miles?',
          'If today is Tuesday, what day will it be in 10 days?',
        ],
        evaluationCriteria: ['logical_correctness', 'clarity', 'completeness'],
        expectedOutputs: [
          'Cats need food',
          '3 hours',
          'Friday',
        ],
      },
      {
        name: 'coding',
        description: 'Test programming and code generation abilities',
        prompts: [
          'Write a Python function to find the factorial of a number.',
          'Explain the difference between == and === in JavaScript.',
          'Create a SQL query to find the top 5 customers by total order value.',
        ],
        evaluationCriteria: ['code_correctness', 'explanation_quality', 'best_practices'],
      },
      {
        name: 'creativity',
        description: 'Test creative writing and ideation',
        prompts: [
          'Write a short story about a robot learning to paint.',
          'Come up with 5 unique business ideas for a space colony.',
          'Create a haiku about artificial intelligence.',
        ],
        evaluationCriteria: ['creativity', 'coherence', 'engagement'],
      },
      {
        name: 'knowledge',
        description: 'Test factual knowledge across domains',
        prompts: [
          'Explain the process of photosynthesis.',
          'Who was the first person to walk on the moon?',
          'What is the capital of Australia?',
        ],
        evaluationCriteria: ['factual_accuracy', 'completeness', 'clarity'],
        expectedOutputs: [
          'Neil Armstrong',
          'Canberra',
        ],
      },
      {
        name: 'math',
        description: 'Test mathematical problem-solving',
        prompts: [
          'Calculate: 15% of 240',
          'Solve for x: 2x + 5 = 17',
          'What is the area of a circle with radius 7?',
        ],
        evaluationCriteria: ['mathematical_accuracy', 'step_by_step_reasoning', 'final_answer'],
        expectedOutputs: [
          '36',
          'x = 6',
          '153.94 or 49π',
        ],
      },
    ];

    defaultBenchmarks.forEach(benchmark => {
      this.benchmarks.set(benchmark.name, benchmark);
    });
  }

  getBenchmarks(): ModelBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  getBenchmark(name: string): ModelBenchmark | null {
    return this.benchmarks.get(name) || null;
  }

  async runBenchmark(
    benchmarkName: string, 
    modelIds: string[], 
    onProgress?: (current: number, total: number, model: string, prompt: string) => void
  ): Promise<BenchmarkResult | null> {
    const benchmark = this.getBenchmark(benchmarkName);
    if (!benchmark) {
      throw new Error(`Benchmark '${benchmarkName}' not found`);
    }

    const modelResults: BenchmarkResult['modelResults'] = {};
    const totalTests = modelIds.length * benchmark.prompts.length;
    let currentTest = 0;

    for (const modelId of modelIds) {
      const model = modelsRegistry.getAllModels().find(m => m.id === modelId);
      if (!model) {
        console.warn(`Model ${modelId} not found, skipping...`);
        continue;
      }

      modelResults[modelId] = {
        responses: [],
        scores: {},
        averageScore: 0,
        totalCost: 0,
        totalTime: 0,
      };

      for (const prompt of benchmark.prompts) {
        currentTest++;
        if (onProgress) {
          onProgress(currentTest, totalTests, modelId, prompt);
        }

        try {
          const result = await universalProvider.testModel(modelId, prompt);
          
          if (result.success) {
            modelResults[modelId].responses.push(result.response || '');
            modelResults[modelId].totalCost += result.cost;
            modelResults[modelId].totalTime += result.responseTime;
          } else {
            modelResults[modelId].responses.push(`Error: ${result.error}`);
          }
        } catch (error) {
          modelResults[modelId].responses.push(`Error: ${error}`);
        }
      }

      // Calculate scores (simplified scoring for now)
      modelResults[modelId].scores = this.calculateScores(
        benchmark, 
        modelResults[modelId].responses
      );
      
      modelResults[modelId].averageScore = this.calculateAverageScore(
        modelResults[modelId].scores
      );
    }

    return {
      benchmark,
      modelResults,
      timestamp: new Date(),
    };
  }

  private calculateScores(benchmark: ModelBenchmark, responses: string[]): Record<string, number> {
    const scores: Record<string, number> = {};

    benchmark.evaluationCriteria.forEach(criteria => {
      scores[criteria] = this.evaluateResponse(criteria, responses, benchmark);
    });

    return scores;
  }

  private evaluateResponse(criteria: string, responses: string[], benchmark: ModelBenchmark): number {
    // Simplified scoring logic - in a real implementation, this would be more sophisticated
    let totalScore = 0;
    
    responses.forEach((response, index) => {
      let score = 50; // Base score

      if (!response || response.startsWith('Error:')) {
        score = 0;
      } else {
        switch (criteria) {
          case 'logical_correctness':
          case 'mathematical_accuracy':
          case 'factual_accuracy':
            // Check against expected outputs if available
            if (benchmark.expectedOutputs?.[index]) {
              const expected = benchmark.expectedOutputs[index].toLowerCase();
              const actual = response.toLowerCase();
              if (actual.includes(expected)) {
                score = 90;
              } else if (this.isCloseMatch(expected, actual)) {
                score = 70;
              } else {
                score = 30;
              }
            } else {
              // Generic quality check
              score = response.length > 10 && response.length < 1000 ? 70 : 50;
            }
            break;

          case 'code_correctness':
            // Check for code patterns
            if (response.includes('def ') || response.includes('function ') || response.includes('SELECT ')) {
              score = 80;
            }
            break;

          case 'creativity':
            // Check for creative elements
            score = response.length > 50 ? Math.min(85, 40 + response.length / 10) : 30;
            break;

          case 'clarity':
          case 'explanation_quality':
            // Check for structured explanation
            if (response.includes('.') && response.includes(' ')) {
              score = Math.min(80, 30 + response.split('.').length * 10);
            }
            break;

          default:
            score = response.length > 20 ? 60 : 40;
        }
      }

      totalScore += Math.max(0, Math.min(100, score));
    });

    return totalScore / responses.length;
  }

  private isCloseMatch(expected: string, actual: string): boolean {
    // Simple fuzzy matching
    const expectedWords = expected.split(' ');
    const actualWords = actual.split(' ');
    
    let matches = 0;
    expectedWords.forEach(word => {
      if (actualWords.some(actualWord => 
        actualWord.includes(word) || word.includes(actualWord)
      )) {
        matches++;
      }
    });

    return matches / expectedWords.length > 0.5;
  }

  private calculateAverageScore(scores: Record<string, number>): number {
    const values = Object.values(scores);
    return values.reduce((sum, score) => sum + score, 0) / values.length;
  }

  async quickComparison(modelIds: string[], prompt: string = "Explain artificial intelligence in simple terms."): Promise<{
    prompt: string;
    results: Array<{
      modelId: string;
      response: string;
      responseTime: number;
      cost: number;
      success: boolean;
      error?: string;
    }>;
    fastest: string;
    cheapest: string;
    longest: string;
  }> {
    const results = [];
    
    for (const modelId of modelIds) {
      try {
        const result = await universalProvider.testModel(modelId, prompt);
        results.push({
          modelId,
          response: result.response || '',
          responseTime: result.responseTime,
          cost: result.cost,
          success: result.success,
          error: result.error,
        });
      } catch (error) {
        results.push({
          modelId,
          response: '',
          responseTime: 0,
          cost: 0,
          success: false,
          error: String(error),
        });
      }
    }

    const successfulResults = results.filter(r => r.success);
    
    const fastest = successfulResults.reduce((prev, curr) => 
      prev.responseTime < curr.responseTime ? prev : curr
    )?.modelId || 'N/A';

    const cheapest = successfulResults.reduce((prev, curr) => 
      prev.cost < curr.cost ? prev : curr
    )?.modelId || 'N/A';

    const longest = successfulResults.reduce((prev, curr) => 
      prev.response.length > curr.response.length ? prev : curr
    )?.modelId || 'N/A';

    return {
      prompt,
      results,
      fastest,
      cheapest,
      longest,
    };
  }

  addCustomBenchmark(benchmark: ModelBenchmark): void {
    this.benchmarks.set(benchmark.name, benchmark);
  }

  removeBenchmark(name: string): boolean {
    return this.benchmarks.delete(name);
  }
}

// Global benchmarks instance
export const modelBenchmarks = new ModelBenchmarks();