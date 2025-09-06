import { createSignal, createResource, For, Show } from "solid-js";
import style from "./ModelsExplorer.module.css";

interface Model {
  id: string;
  name: string;
  provider: string;
  pricing: {
    input: number;
    output: number;
  };
  context_length: number;
  free: boolean;
  description?: string;
  capabilities: string[];
}

interface Provider {
  name: string;
  models: Model[];
  free_models_count: number;
  total_models_count: number;
}

export default function ModelsExplorer() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedProvider, setSelectedProvider] = createSignal("all");
  const [showOnlyFree, setShowOnlyFree] = createSignal(false);
  const [selectedModel, setSelectedModel] = createSignal<Model | null>(null);
  const [testingModel, setTestingModel] = createSignal<string | null>(null);

  // Fetch models from API
  const [models] = createResource(
    () => [searchQuery(), selectedProvider(), showOnlyFree()],
    async ([search, provider, freeOnly]) => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (provider !== 'all') params.append('provider', provider);
      if (freeOnly) params.append('free_only', 'true');
      
      const response = await fetch(`http://localhost:3001/api/models?${params}`);
      return response.json();
    }
  );

  const filteredModels = () => models() || [];

  const providers = () => {
    const modelList = models() || [];
    const providerMap = new Map<string, Provider>();
    
    modelList.forEach(model => {
      if (!providerMap.has(model.provider)) {
        providerMap.set(model.provider, {
          name: model.provider,
          models: [],
          free_models_count: 0,
          total_models_count: 0
        });
      }
      const provider = providerMap.get(model.provider)!;
      provider.models.push(model);
      provider.total_models_count++;
      if (model.free) provider.free_models_count++;
    });
    
    return Array.from(providerMap.values());
  };

  const testModel = async (modelId: string) => {
    setTestingModel(modelId);
    try {
      const response = await fetch(`http://localhost:3001/api/models/${modelId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello, this is a test prompt!' })
      });
      const result = await response.json();
      alert(`Test completed for ${modelId}:\n${result.response}\n\nTokens: ${result.tokens_used}\nTime: ${result.response_time}ms`);
    } catch (error) {
      alert(`Test failed for ${modelId}: ${error.message}`);
    } finally {
      setTestingModel(null);
    }
  };

  return (
    <div class={style.container}>
      <div class={style.sidebar}>
        <div class={style.sidebarHeader}>
          <h2>Echo AI</h2>
          <nav class={style.nav}>
            <a href="/dashboard" class={style.navItem}>Dashboard</a>
            <a href="/models" class={`${style.navItem} ${style.active}`}>Models</a>
            <a href="/sessions" class={style.navItem}>Sessions</a>
            <a href="/analytics" class={style.navItem}>Analytics</a>
            <a href="/security" class={style.navItem}>Security</a>
            <a href="/settings" class={style.navItem}>Settings</a>
          </nav>
        </div>
      </div>

      <div class={style.main}>
        <div class={style.header}>
          <h1>Model Explorer</h1>
          <p>Discover and test 651+ AI models from 43+ providers</p>
        </div>

        <div class={style.filters}>
          <div class={style.searchBox}>
            <input
              type="text"
              placeholder="Search models or providers..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class={style.searchInput}
            />
          </div>

          <select
            value={selectedProvider()}
            onChange={(e) => setSelectedProvider(e.currentTarget.value)}
            class={style.select}
          >
            <option value="all">All Providers</option>
            <For each={providers()}>
              {(provider) => (
                <option value={provider.name}>
                  {provider.name} ({provider.total_models_count})
                </option>
              )}
            </For>
          </select>

          <label class={style.checkbox}>
            <input
              type="checkbox"
              checked={showOnlyFree()}
              onChange={(e) => setShowOnlyFree(e.currentTarget.checked)}
            />
            Free models only
          </label>
        </div>

        <div class={style.content}>
          <div class={style.modelGrid}>
            <For each={filteredModels()}>
              {(model) => (
                <div 
                  class={style.modelCard}
                  onClick={() => setSelectedModel(model)}
                >
                  <div class={style.modelHeader}>
                    <h3>{model.name}</h3>
                    <div class={style.badges}>
                      {model.free && <span class={style.freeBadge}>FREE</span>}
                      <span class={style.providerBadge}>{model.provider}</span>
                    </div>
                  </div>
                  
                  <p class={style.description}>{model.description}</p>
                  
                  <div class={style.modelStats}>
                    <div class={style.stat}>
                      <span class={style.statLabel}>Context:</span>
                      <span class={style.statValue}>{model.context_length.toLocaleString()}</span>
                    </div>
                    <div class={style.stat}>
                      <span class={style.statLabel}>Input:</span>
                      <span class={style.statValue}>
                        {model.free ? "Free" : `$${model.pricing.input}/1K`}
                      </span>
                    </div>
                    <div class={style.stat}>
                      <span class={style.statLabel}>Output:</span>
                      <span class={style.statValue}>
                        {model.free ? "Free" : `$${model.pricing.output}/1K`}
                      </span>
                    </div>
                  </div>

                  <div class={style.capabilities}>
                    <For each={model.capabilities}>
                      {(capability) => (
                        <span class={style.capability}>{capability}</span>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>

          <Show when={selectedModel()}>
            <div class={style.modelDetail}>
              <div class={style.detailHeader}>
                <h2>{selectedModel()!.name}</h2>
                <button
                  class={style.closeButton}
                  onClick={() => setSelectedModel(null)}
                >
                  ×
                </button>
              </div>

              <div class={style.detailContent}>
                <div class={style.detailSection}>
                  <h3>Overview</h3>
                  <p>{selectedModel()!.description}</p>
                  <div class={style.detailStats}>
                    <div>Provider: <strong>{selectedModel()!.provider}</strong></div>
                    <div>Context Length: <strong>{selectedModel()!.context_length.toLocaleString()}</strong></div>
                    <div>Pricing: <strong>
                      {selectedModel()!.free 
                        ? "Free" 
                        : `$${selectedModel()!.pricing.input}/$${selectedModel()!.pricing.output} per 1K tokens`
                      }
                    </strong></div>
                  </div>
                </div>

                <div class={style.detailSection}>
                  <h3>Test Model</h3>
                  <div class={style.testArea}>
                    <textarea
                      placeholder="Enter your test prompt here..."
                      class={style.testInput}
                      rows="4"
                    ></textarea>
                    <button
                      class={style.testButton}
                      disabled={testingModel() === selectedModel()!.id}
                      onClick={() => testModel(selectedModel()!.id)}
                    >
                      {testingModel() === selectedModel()!.id ? "Testing..." : "Test Model"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}