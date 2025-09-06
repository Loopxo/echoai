import { Command } from 'commander';
import { modelsRegistry } from '../models/registry.js';
import { universalProvider } from '../models/universal-provider.js';
import { modelBenchmarks } from '../models/benchmarks.js';
import { ModelInfo, ModelTestResult, ModelComparison } from '../types/models.js';
import inquirer from 'inquirer';

export const modelsCommand = new Command()
  .name('models')
  .description('Discover, test, and manage AI models from 75+ providers')
  .hook('preAction', async () => {
    await modelsRegistry.initialize();
  });

modelsCommand
  .command('list')
  .description('List all available models')
  .option('-p, --provider <provider>', 'Filter by provider')
  .option('-f, --free', 'Show only free models')
  .option('-o, --open-source', 'Show only open source models')
  .option('--images', 'Show models that support images')
  .option('--tools', 'Show models that support tool calls')
  .option('--reasoning', 'Show models with reasoning capabilities')
  .option('-s, --search <query>', 'Search models by name or description')
  .option('-l, --limit <number>', 'Limit number of results', parseInt, 20)
  .action(async (options) => {
    let models = modelsRegistry.getAllModels();

    // Apply filters
    if (options.provider) {
      models = models.filter(m => m.provider === options.provider);
    }

    if (options.free) {
      models = modelsRegistry.getFreeModels();
    }

    if (options.openSource) {
      models = modelsRegistry.getOpenSourceModels();
    }

    if (options.images) {
      models = models.filter(m => m.modalities?.input.includes('image'));
    }

    if (options.tools) {
      models = models.filter(m => m.tool_call);
    }

    if (options.reasoning) {
      models = models.filter(m => m.reasoning);
    }

    if (options.search) {
      models = modelsRegistry.searchModels(options.search);
    }

    // Sort by provider, then by name
    models.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.name.localeCompare(b.name);
    });

    // Limit results
    models = models.slice(0, options.limit);

    if (models.length === 0) {
      console.log('No models found matching the criteria.');
      return;
    }

    console.log(`\n📋 Found ${models.length} models:\n`);

    let currentProvider = '';
    models.forEach((model, index) => {
      if (model.provider !== currentProvider) {
        currentProvider = model.provider;
        console.log(`\n🏢 ${currentProvider.toUpperCase()}:`);
      }

      const capabilities = [];
      if (model.modalities?.input.includes('image')) capabilities.push('📸');
      if (model.tool_call) capabilities.push('🔧');
      if (model.reasoning) capabilities.push('🧠');
      if (model.open_weights) capabilities.push('🌐');
      if (model.cost?.input === 0 && model.cost?.output === 0) capabilities.push('🆓');

      const context = model.limit?.context ? `${(model.limit.context / 1000).toFixed(0)}k` : '?';
      const costInfo = model.cost ? 
        `$${model.cost.input?.toFixed(2) || 0}/$${model.cost.output?.toFixed(2) || 0}` : 
        'No cost info';

      console.log(`  ${index + 1}. ${model.name} ${capabilities.join(' ')}`);
      console.log(`     ID: ${model.id}`);
      console.log(`     Context: ${context} | Cost: ${costInfo} (per 1M tokens)`);
      if (model.knowledge) {
        console.log(`     Knowledge cutoff: ${model.knowledge}`);
      }
      console.log();
    });
  });

modelsCommand
  .command('search')
  .description('Advanced model search and filtering')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Search query (model name, provider, etc.):',
      },
      {
        type: 'checkbox',
        name: 'capabilities',
        message: 'Required capabilities:',
        choices: [
          { name: 'Image support', value: 'images' },
          { name: 'Tool calls', value: 'tools' },
          { name: 'Reasoning', value: 'reasoning' },
          { name: 'Free models only', value: 'free' },
          { name: 'Open source only', value: 'open' },
        ],
      },
      {
        type: 'list',
        name: 'sortBy',
        message: 'Sort by:',
        choices: [
          { name: 'Cost (cheapest first)', value: 'cost' },
          { name: 'Release date (newest first)', value: 'date' },
          { name: 'Context window (largest first)', value: 'context' },
          { name: 'Provider', value: 'provider' },
        ],
      },
    ]);

    let models = modelsRegistry.getAllModels();

    if (answers.query) {
      models = modelsRegistry.searchModels(answers.query);
    }

    // Apply capability filters
    const filters: any = {};
    if (answers.capabilities.includes('images')) filters.supportsImages = true;
    if (answers.capabilities.includes('tools')) filters.supportsTools = true;
    if (answers.capabilities.includes('reasoning')) filters.supportsReasoning = true;
    if (answers.capabilities.includes('free')) filters.free = true;
    if (answers.capabilities.includes('open')) filters.openWeights = true;

    if (Object.keys(filters).length > 0) {
      models = modelsRegistry.filterModels(filters);
    }

    // Sort models
    switch (answers.sortBy) {
      case 'cost':
        models.sort((a, b) => (a.cost?.output || Infinity) - (b.cost?.output || Infinity));
        break;
      case 'date':
        models.sort((a, b) => new Date(b.release_date || '1900-01-01').getTime() - new Date(a.release_date || '1900-01-01').getTime());
        break;
      case 'context':
        models.sort((a, b) => (b.limit?.context || 0) - (a.limit?.context || 0));
        break;
      case 'provider':
        models.sort((a, b) => a.provider.localeCompare(b.provider));
        break;
    }

    console.log(`\n🔍 Search Results (${models.length} models):\n`);
    
    models.slice(0, 15).forEach((model, index) => {
      const caps = [];
      if (model.modalities?.input.includes('image')) caps.push('📸');
      if (model.tool_call) caps.push('🔧');
      if (model.reasoning) caps.push('🧠');
      if (model.open_weights) caps.push('🌐');

      console.log(`${index + 1}. ${model.provider}/${model.name} ${caps.join(' ')}`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Cost: $${model.cost?.output || 0}/1M tokens | Context: ${model.limit?.context || 'Unknown'}`);
      console.log();
    });
  });

modelsCommand
  .command('info')
  .description('Get detailed information about a specific model')
  .argument('<model-id>', 'Model ID to get info for')
  .action(async (modelId) => {
    const model = modelsRegistry.getAllModels().find(m => m.id === modelId);
    
    if (!model) {
      console.error(`❌ Model ${modelId} not found`);
      process.exit(1);
    }

    const capabilities = modelsRegistry.getModelCapabilities(model);
    const provider = modelsRegistry.getProvider(model.provider);

    console.log(`\n📋 Model Information: ${model.name}\n`);
    console.log(`ID: ${model.id}`);
    console.log(`Provider: ${model.provider} (${provider?.name})`);
    console.log(`Release Date: ${model.release_date || 'Unknown'}`);
    console.log(`Last Updated: ${model.last_updated || 'Unknown'}`);
    console.log(`Knowledge Cutoff: ${model.knowledge || 'Unknown'}`);
    console.log(`Open Source: ${model.open_weights ? '✅' : '❌'}`);

    console.log('\n🎯 Capabilities:');
    console.log(`  Images: ${capabilities.supportsImages ? '✅' : '❌'}`);
    console.log(`  Tools: ${capabilities.supportsTools ? '✅' : '❌'}`);
    console.log(`  Reasoning: ${capabilities.supportsReasoning ? '✅' : '❌'}`);
    console.log(`  Attachments: ${capabilities.supportsAttachments ? '✅' : '❌'}`);
    console.log(`  Temperature: ${capabilities.supportsTemperature ? '✅' : '❌'}`);

    console.log('\n📊 Limits:');
    console.log(`  Max Context: ${capabilities.maxContext.toLocaleString()} tokens`);
    console.log(`  Max Output: ${capabilities.maxOutput.toLocaleString()} tokens`);

    if (model.cost) {
      console.log('\n💰 Pricing (per 1M tokens):');
      console.log(`  Input: $${model.cost.input || 0}`);
      console.log(`  Output: $${model.cost.output || 0}`);
      if (model.cost.cache_read) console.log(`  Cache Read: $${model.cost.cache_read}`);
      if (model.cost.cache_write) console.log(`  Cache Write: $${model.cost.cache_write}`);
    }

    if (provider?.api) {
      console.log('\n🔗 API Information:');
      console.log(`  Endpoint: ${provider.api}`);
      if (provider.doc) console.log(`  Documentation: ${provider.doc}`);
      if (provider.env) console.log(`  Required Env: ${provider.env.join(', ')}`);
    }

    console.log('\n🧪 Want to test this model? Run:');
    console.log(`  echoai models test ${modelId}`);
  });

modelsCommand
  .command('test')
  .description('Test a model with a sample prompt')
  .argument('<model-id>', 'Model ID to test')
  .option('-p, --prompt <prompt>', 'Custom test prompt', 'Hello! Please introduce yourself and tell me what you can do.')
  .action(async (modelId, options) => {
    console.log(`🧪 Testing model: ${modelId}`);
    console.log(`📝 Prompt: "${options.prompt}"\n`);

    try {
      const result = await universalProvider.testModel(modelId, options.prompt);

      if (result.success) {
        console.log(`✅ Test successful!`);
        console.log(`⏱️  Response time: ${result.responseTime}ms`);
        console.log(`🎯 Tokens used: ${result.tokensUsed.input + result.tokensUsed.output} (${result.tokensUsed.input} input, ${result.tokensUsed.output} output)`);
        console.log(`💰 Cost: $${result.cost.toFixed(6)}`);
        console.log(`\n📋 Response:`);
        console.log(result.response);
      } else {
        console.log(`❌ Test failed: ${result.error}`);
      }

    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }
  });

modelsCommand
  .command('compare')
  .description('Compare multiple models with the same prompt')
  .option('-p, --prompt <prompt>', 'Test prompt for comparison', 'Explain quantum computing in simple terms.')
  .option('-m, --models <models>', 'Comma-separated list of model IDs')
  .action(async (options) => {
    let modelIds: string[] = [];

    if (options.models) {
      modelIds = options.models.split(',').map((id: string) => id.trim());
    } else {
      // Interactive model selection
      const allModels = modelsRegistry.getAllModels();
      const choices = allModels.slice(0, 20).map(m => ({
        name: `${m.provider}/${m.name} (${m.id})`,
        value: m.id,
        short: m.id,
      }));

      const { selectedModels } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedModels',
        message: 'Select models to compare (max 5):',
        choices,
        validate: (input) => input.length > 0 && input.length <= 5 || 'Please select 1-5 models',
      }]);

      modelIds = selectedModels;
    }

    console.log(`🔄 Comparing ${modelIds.length} models with prompt: "${options.prompt}"\n`);

    const results: Record<string, any> = {};
    const startTime = Date.now();

    for (const modelId of modelIds) {
      console.log(`Testing ${modelId}...`);
      
      try {
        const result = await universalProvider.testModel(modelId, options.prompt);
        results[modelId] = result;
        
        if (result.success) {
          console.log(`✅ ${modelId}: ${result.responseTime}ms, $${result.cost.toFixed(6)}`);
        } else {
          console.log(`❌ ${modelId}: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${modelId}: ${error}`);
        results[modelId] = {
          success: false,
          error: String(error),
          responseTime: 0,
          cost: 0,
        };
      }
    }

    const totalTime = Date.now() - startTime;

    console.log(`\n📊 Comparison Results (completed in ${totalTime}ms):\n`);

    // Sort by success, then by response time
    const sortedResults = Object.entries(results).sort(([,a], [,b]) => {
      if (a.success !== b.success) return b.success - a.success;
      return a.responseTime - b.responseTime;
    });

    sortedResults.forEach(([modelId, result], index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${modelId}`);
      console.log(`   Time: ${result.responseTime}ms | Cost: $${result.cost.toFixed(6)}`);
      
      if (result.success) {
        const preview = result.response.substring(0, 100);
        console.log(`   Response: ${preview}${result.response.length > 100 ? '...' : ''}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
      console.log();
    });
  });

modelsCommand
  .command('providers')
  .description('List all available providers')
  .action(async () => {
    const providers = modelsRegistry.getProviders();
    
    console.log(`\n🏢 Available Providers (${providers.length}):\n`);

    providers.forEach((provider, index) => {
      const modelCount = Object.keys(provider.models).length;
      const hasApiKey = universalProvider.getAvailableProviders().includes(provider.id);
      const apiStatus = hasApiKey ? '🔑' : '❌';

      console.log(`${index + 1}. ${provider.name} ${apiStatus}`);
      console.log(`   ID: ${provider.id}`);
      console.log(`   Models: ${modelCount}`);
      if (provider.api) console.log(`   API: ${provider.api}`);
      if (provider.doc) console.log(`   Docs: ${provider.doc}`);
      if (provider.env) console.log(`   Env Vars: ${provider.env.join(', ')}`);
      console.log();
    });

    console.log('Legend: 🔑 = API key configured, ❌ = No API key');
    console.log('\nTo configure API keys, set environment variables like:');
    console.log('export OPENAI_API_KEY="your-key-here"');
    console.log('export ANTHROPIC_API_KEY="your-key-here"');
  });

modelsCommand
  .command('stats')
  .description('Show models registry statistics')
  .action(async () => {
    const stats = modelsRegistry.getRegistryStats();

    console.log('\n📊 Models Registry Statistics:\n');
    console.log(`Total Providers: ${stats.totalProviders}`);
    console.log(`Total Models: ${stats.totalModels}`);
    console.log(`Free Models: ${stats.freeModels}`);
    console.log(`Open Source Models: ${stats.openSourceModels}`);
    console.log(`Models with Image Support: ${stats.modelsWithImages}`);
    console.log(`Models with Tool Calls: ${stats.modelsWithTools}`);
    console.log(`Models with Reasoning: ${stats.modelsWithReasoning}`);
    console.log(`Last Registry Update: ${stats.lastUpdate?.toLocaleString() || 'Never'}`);

    console.log('\n🏆 Top Categories:\n');
    
    // Show cheapest models
    const cheapest = modelsRegistry.getCheapestModels(5);
    console.log('💰 Cheapest Models:');
    cheapest.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name} - $${model.cost?.output || 0}/1M tokens`);
    });

    console.log();

    // Show newest models
    const newest = modelsRegistry.getNewestModels(5);
    console.log('🆕 Newest Models:');
    newest.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name} - ${model.release_date}`);
    });
  });

modelsCommand
  .command('benchmark')
  .description('Run comprehensive benchmarks on models')
  .option('-b, --benchmark <name>', 'Benchmark to run (reasoning, coding, creativity, knowledge, math)')
  .option('-m, --models <models>', 'Comma-separated list of model IDs')
  .action(async (options) => {
    const availableBenchmarks = modelBenchmarks.getBenchmarks();
    
    let benchmarkName = options.benchmark;
    let modelIds: string[] = [];

    if (!benchmarkName) {
      const { selectedBenchmark } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedBenchmark',
        message: 'Select benchmark to run:',
        choices: availableBenchmarks.map(b => ({
          name: `${b.name} - ${b.description}`,
          value: b.name,
        })),
      }]);
      benchmarkName = selectedBenchmark;
    }

    if (!options.models) {
      const allModels = modelsRegistry.getAllModels();
      const choices = allModels.slice(0, 15).map(m => ({
        name: `${m.provider}/${m.name}`,
        value: m.id,
      }));

      const { selectedModels } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedModels',
        message: 'Select models to benchmark (max 5):',
        choices,
        validate: (input) => input.length > 0 && input.length <= 5 || 'Please select 1-5 models',
      }]);

      modelIds = selectedModels;
    } else {
      modelIds = options.models.split(',').map((id: string) => id.trim());
    }

    console.log(`🏁 Running ${benchmarkName} benchmark on ${modelIds.length} models...\n`);

    const result = await modelBenchmarks.runBenchmark(
      benchmarkName, 
      modelIds,
      (current, total, model, prompt) => {
        console.log(`Progress: ${current}/${total} - Testing ${model}: ${prompt.substring(0, 50)}...`);
      }
    );

    if (!result) {
      console.error('❌ Benchmark failed to run');
      return;
    }

    console.log(`\n🏆 Benchmark Results: ${result.benchmark.name}\n`);

    // Sort models by average score
    const sortedResults = Object.entries(result.modelResults)
      .sort(([,a], [,b]) => b.averageScore - a.averageScore);

    sortedResults.forEach(([modelId, modelResult], index) => {
      const model = modelsRegistry.getAllModels().find(m => m.id === modelId);
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      
      console.log(`${medal} ${index + 1}. ${model?.name || modelId}`);
      console.log(`   Overall Score: ${modelResult.averageScore.toFixed(1)}/100`);
      console.log(`   Total Cost: $${modelResult.totalCost.toFixed(6)}`);
      console.log(`   Total Time: ${modelResult.totalTime}ms`);
      
      // Show individual criteria scores
      Object.entries(modelResult.scores).forEach(([criteria, score]) => {
        console.log(`   ${criteria}: ${score.toFixed(1)}/100`);
      });
      console.log();
    });

    // Show best performers in each category
    console.log('🏅 Category Leaders:');
    result.benchmark.evaluationCriteria.forEach(criteria => {
      const best = sortedResults.reduce((prev, curr) => {
        const prevScore = prev[1]?.scores[criteria] || 0;
        const currScore = curr[1]?.scores[criteria] || 0;
        return currScore > prevScore ? curr : prev;
      });
      const model = modelsRegistry.getAllModels().find(m => m.id === best[0]);
      console.log(`  ${criteria}: ${model?.name} (${best[1]?.scores[criteria]?.toFixed(1) || 0}/100)`);
    });
  });

modelsCommand
  .command('quick-compare')
  .description('Quick comparison of models with a single prompt')
  .option('-p, --prompt <prompt>', 'Test prompt', 'Explain quantum computing in simple terms')
  .option('-m, --models <models>', 'Comma-separated model IDs')
  .action(async (options) => {
    let modelIds: string[] = [];
    
    if (!options.models) {
      const freeModels = modelsRegistry.getFreeModels();
      const popularModels = [
        'openai/gpt-4o-mini',
        'anthropic/claude-3.5-haiku',
        'deepseek/deepseek-r1:free',
        'deepseek/deepseek-chat-v3.1',
        'mistralai/mistral-nemo:free',
      ].map(id => modelsRegistry.getAllModels().find(m => m.id === id)).filter(Boolean);

      const choices = [...popularModels, ...freeModels.slice(0, 10)].map((m: any) => ({
        name: `${m.provider}/${m.name} ${m.cost?.input === 0 ? '🆓' : '💰'}`,
        value: m.id,
      }));

      const { selectedModels } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedModels',
        message: 'Select models for quick comparison:',
        choices,
        default: choices.slice(0, 3).map(c => c.value),
      }]);

      modelIds = selectedModels;
    } else {
      modelIds = options.models.split(',').map((id: string) => id.trim());
    }

    console.log(`⚡ Quick comparison: "${options.prompt}"\n`);

    const result = await modelBenchmarks.quickComparison(modelIds, options.prompt);

    console.log(`📊 Results:\n`);

    result.results.forEach((r, index) => {
      const status = r.success ? '✅' : '❌';
      const model = modelsRegistry.getAllModels().find(m => m.id === r.modelId);
      
      console.log(`${index + 1}. ${status} ${model?.name || r.modelId}`);
      if (r.success) {
        console.log(`   Time: ${r.responseTime}ms | Cost: $${r.cost.toFixed(6)} | Length: ${r.response.length} chars`);
        console.log(`   Response: ${r.response.substring(0, 150)}${r.response.length > 150 ? '...' : ''}`);
      } else {
        console.log(`   Error: ${r.error}`);
      }
      console.log();
    });

    console.log(`🏆 Winners:`);
    console.log(`  ⚡ Fastest: ${result.fastest}`);
    console.log(`  💰 Cheapest: ${result.cheapest}`);
    console.log(`  📝 Most Detailed: ${result.longest}`);
  });

modelsCommand
  .command('update')
  .description('Update the models registry from Models.dev')
  .action(async () => {
    await modelsRegistry.updateRegistry();
  });