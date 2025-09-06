import { ModelsRegistry as ModelsRegistryType, Provider, ModelInfo, ModelCapabilities } from '../types/models.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class ModelsRegistry {
  private registry: ModelsRegistryType = {};
  private registryPath: string;
  private lastUpdate: Date | null = null;
  private updateInterval = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    const echoDir = join(homedir(), '.echo');
    this.registryPath = join(echoDir, 'models-registry.json');
  }

  async initialize(): Promise<void> {
    await this.loadRegistry();
    
    // Update registry if it's stale or empty
    if (this.shouldUpdate()) {
      await this.updateRegistry();
    }
  }

  async updateRegistry(): Promise<void> {
    try {
      console.log('🔄 Updating models registry from Models.dev...');
      
      const response = await fetch('https://models.dev/api.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      this.registry = this.transformModelsData(data);
      this.lastUpdate = new Date();

      await this.saveRegistry();
      console.log(`✅ Updated registry with ${this.getProviderCount()} providers and ${this.getModelCount()} models`);
    } catch (error) {
      console.error('❌ Failed to update models registry:', error);
      // Continue with existing registry if update fails
    }
  }

  private transformModelsData(data: any): ModelsRegistryType {
    const registry: ModelsRegistryType = {};

    Object.entries(data).forEach(([providerId, providerData]: [string, any]) => {
      const provider: Provider = {
        id: providerId,
        name: providerData.name,
        env: providerData.env,
        npm: providerData.npm,
        api: providerData.api,
        doc: providerData.doc,
        models: {},
      };

      Object.entries(providerData.models || {}).forEach(([modelId, modelData]: [string, any]) => {
        const model: ModelInfo = {
          id: modelId,
          name: modelData.name,
          provider: providerId,
          attachment: modelData.attachment,
          reasoning: modelData.reasoning,
          temperature: modelData.temperature,
          tool_call: modelData.tool_call,
          knowledge: modelData.knowledge,
          release_date: modelData.release_date,
          last_updated: modelData.last_updated,
          modalities: modelData.modalities,
          open_weights: modelData.open_weights,
          cost: modelData.cost,
          limit: modelData.limit,
        };

        provider.models[modelId] = model;
      });

      registry[providerId] = provider;
    });

    return registry;
  }

  getProviders(): Provider[] {
    return Object.values(this.registry);
  }

  getProvider(providerId: string): Provider | null {
    return this.registry[providerId] || null;
  }

  getModel(providerId: string, modelId: string): ModelInfo | null {
    const provider = this.getProvider(providerId);
    return provider?.models[modelId] || null;
  }

  getAllModels(): ModelInfo[] {
    const models: ModelInfo[] = [];
    
    Object.values(this.registry).forEach(provider => {
      Object.values(provider.models).forEach(model => {
        models.push(model);
      });
    });

    return models;
  }

  searchModels(query: string): ModelInfo[] {
    const searchTerm = query.toLowerCase();
    
    return this.getAllModels().filter(model => 
      model.id.toLowerCase().includes(searchTerm) ||
      model.name.toLowerCase().includes(searchTerm) ||
      model.provider.toLowerCase().includes(searchTerm)
    );
  }

  filterModels(filters: {
    provider?: string;
    supportsImages?: boolean;
    supportsTools?: boolean;
    supportsReasoning?: boolean;
    maxCost?: number;
    minContext?: number;
    openWeights?: boolean;
    free?: boolean;
  }): ModelInfo[] {
    return this.getAllModels().filter(model => {
      if (filters.provider && model.provider !== filters.provider) {
        return false;
      }

      if (filters.supportsImages && !model.modalities?.input.includes('image')) {
        return false;
      }

      if (filters.supportsTools && !model.tool_call) {
        return false;
      }

      if (filters.supportsReasoning && !model.reasoning) {
        return false;
      }

      if (filters.maxCost && model.cost?.output && model.cost.output > filters.maxCost) {
        return false;
      }

      if (filters.minContext && model.limit?.context && model.limit.context < filters.minContext) {
        return false;
      }

      if (filters.openWeights !== undefined && model.open_weights !== filters.openWeights) {
        return false;
      }

      if (filters.free && model.cost && ((model.cost.input || 0) > 0 || (model.cost.output || 0) > 0)) {
        return false;
      }

      return true;
    });
  }

  getModelCapabilities(model: ModelInfo): ModelCapabilities {
    return {
      supportsImages: model.modalities?.input.includes('image') || false,
      supportsTools: model.tool_call || false,
      supportsReasoning: model.reasoning || false,
      supportsAttachments: model.attachment || false,
      supportsTemperature: model.temperature || false,
      maxContext: model.limit?.context || 0,
      maxOutput: model.limit?.output || 0,
    };
  }

  getFreeModels(): ModelInfo[] {
    return this.filterModels({ free: true });
  }

  getOpenSourceModels(): ModelInfo[] {
    return this.filterModels({ openWeights: true });
  }

  getCheapestModels(limit = 10): ModelInfo[] {
    return this.getAllModels()
      .filter(model => model.cost?.output)
      .sort((a, b) => (a.cost?.output || Infinity) - (b.cost?.output || Infinity))
      .slice(0, limit);
  }

  getNewestModels(limit = 10): ModelInfo[] {
    return this.getAllModels()
      .filter(model => model.release_date)
      .sort((a, b) => new Date(b.release_date!).getTime() - new Date(a.release_date!).getTime())
      .slice(0, limit);
  }

  getProviderCount(): number {
    return Object.keys(this.registry).length;
  }

  getModelCount(): number {
    return this.getAllModels().length;
  }

  getRegistryStats(): {
    totalProviders: number;
    totalModels: number;
    freeModels: number;
    openSourceModels: number;
    modelsWithImages: number;
    modelsWithTools: number;
    modelsWithReasoning: number;
    lastUpdate: Date | null;
  } {
    const allModels = this.getAllModels();
    
    return {
      totalProviders: this.getProviderCount(),
      totalModels: allModels.length,
      freeModels: this.getFreeModels().length,
      openSourceModels: this.getOpenSourceModels().length,
      modelsWithImages: allModels.filter(m => m.modalities?.input.includes('image')).length,
      modelsWithTools: allModels.filter(m => m.tool_call).length,
      modelsWithReasoning: allModels.filter(m => m.reasoning).length,
      lastUpdate: this.lastUpdate,
    };
  }

  private shouldUpdate(): boolean {
    if (!this.lastUpdate) return true;
    return Date.now() - this.lastUpdate.getTime() > this.updateInterval;
  }

  private async loadRegistry(): Promise<void> {
    try {
      if (existsSync(this.registryPath)) {
        const data = await readFile(this.registryPath, 'utf8');
        const parsed = JSON.parse(data);
        this.registry = parsed.registry || {};
        this.lastUpdate = parsed.lastUpdate ? new Date(parsed.lastUpdate) : null;
      }
    } catch (error) {
      console.error('Failed to load models registry:', error);
      this.registry = {};
      this.lastUpdate = null;
    }
  }

  private async saveRegistry(): Promise<void> {
    try {
      const data = {
        registry: this.registry,
        lastUpdate: this.lastUpdate,
      };
      await writeFile(this.registryPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save models registry:', error);
    }
  }
}

// Global models registry instance
export const modelsRegistry = new ModelsRegistry();