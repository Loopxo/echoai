import { createSignal, For } from "solid-js";
import style from "./Settings.module.css";

export default function Settings() {
  const [activeTab, setActiveTab] = createSignal("general");
  
  // General settings
  const [theme, setTheme] = createSignal("dark");
  const [autoSave, setAutoSave] = createSignal(true);
  const [shareAnalytics, setShareAnalytics] = createSignal(false);
  
  // Model settings
  const [defaultModel, setDefaultModel] = createSignal("gpt-4");
  const [maxTokens, setMaxTokens] = createSignal(4000);
  const [temperature, setTemperature] = createSignal(0.7);
  
  // API settings
  const [apiKeys, setApiKeys] = createSignal([
    { provider: "openai", key: "sk-..." + "*".repeat(20), status: "active" },
    { provider: "anthropic", key: "ant-..." + "*".repeat(20), status: "active" },
    { provider: "meta", key: "", status: "not_configured" }
  ]);

  const saveSettings = () => {
    alert("Settings saved successfully!");
  };

  const resetSettings = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      setTheme("dark");
      setAutoSave(true);
      setShareAnalytics(false);
      setDefaultModel("gpt-4");
      setMaxTokens(4000);
      setTemperature(0.7);
      alert("Settings reset to defaults");
    }
  };

  const exportSettings = () => {
    const settings = {
      general: { theme: theme(), autoSave: autoSave(), shareAnalytics: shareAnalytics() },
      models: { defaultModel: defaultModel(), maxTokens: maxTokens(), temperature: temperature() }
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "echo-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const addApiKey = (provider: string) => {
    const key = prompt(`Enter your ${provider} API key:`);
    if (key) {
      setApiKeys(keys => keys.map(k => 
        k.provider === provider ? {...k, key: key.substring(0, 6) + "*".repeat(20), status: "active"} : k
      ));
    }
  };

  const removeApiKey = (provider: string) => {
    if (confirm(`Remove ${provider} API key?`)) {
      setApiKeys(keys => keys.map(k => 
        k.provider === provider ? {...k, key: "", status: "not_configured"} : k
      ));
    }
  };

  return (
    <div class={style.container}>
      <div class={style.sidebar}>
        <div class={style.sidebarHeader}>
          <h2>Echo AI</h2>
          <nav class={style.nav}>
            <a href="/dashboard" class={style.navItem}>Dashboard</a>
            <a href="/models" class={style.navItem}>Models</a>
            <a href="/sessions" class={style.navItem}>Sessions</a>
            <a href="/analytics" class={style.navItem}>Analytics</a>
            <a href="/security" class={style.navItem}>Security</a>
            <a href="/settings" class={`${style.navItem} ${style.active}`}>Settings</a>
          </nav>
        </div>
      </div>

      <div class={style.main}>
        <div class={style.header}>
          <h1>Settings</h1>
          <p>Configure your Echo AI experience</p>
        </div>

        <div class={style.content}>
          <div class={style.tabBar}>
            <button
              class={activeTab() === "general" ? style.activeTab : style.tab}
              onClick={() => setActiveTab("general")}
            >
              General
            </button>
            <button
              class={activeTab() === "models" ? style.activeTab : style.tab}
              onClick={() => setActiveTab("models")}
            >
              Models
            </button>
            <button
              class={activeTab() === "api" ? style.activeTab : style.tab}
              onClick={() => setActiveTab("api")}
            >
              API Keys
            </button>
            <button
              class={activeTab() === "advanced" ? style.activeTab : style.tab}
              onClick={() => setActiveTab("advanced")}
            >
              Advanced
            </button>
          </div>

          <div class={style.tabContent}>
            {activeTab() === "general" && (
              <div class={style.settingsSection}>
                <h2>General Settings</h2>
                
                <div class={style.settingItem}>
                  <label class={style.settingLabel}>
                    Theme
                    <select
                      value={theme()}
                      onChange={(e) => setTheme(e.currentTarget.value)}
                      class={style.select}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </label>
                </div>

                <div class={style.settingItem}>
                  <label class={style.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={autoSave()}
                      onChange={(e) => setAutoSave(e.currentTarget.checked)}
                    />
                    Auto-save sessions
                  </label>
                  <p class={style.settingDescription}>
                    Automatically save your conversations as you chat
                  </p>
                </div>

                <div class={style.settingItem}>
                  <label class={style.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={shareAnalytics()}
                      onChange={(e) => setShareAnalytics(e.currentTarget.checked)}
                    />
                    Share anonymous usage analytics
                  </label>
                  <p class={style.settingDescription}>
                    Help improve Echo AI by sharing anonymous usage data
                  </p>
                </div>
              </div>
            )}

            {activeTab() === "models" && (
              <div class={style.settingsSection}>
                <h2>Model Settings</h2>
                
                <div class={style.settingItem}>
                  <label class={style.settingLabel}>
                    Default Model
                    <select
                      value={defaultModel()}
                      onChange={(e) => setDefaultModel(e.currentTarget.value)}
                      class={style.select}
                    >
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="claude-3-haiku">Claude 3 Haiku</option>
                      <option value="llama-3-8b">Llama 3 8B</option>
                    </select>
                  </label>
                </div>

                <div class={style.settingItem}>
                  <label class={style.settingLabel}>
                    Max Tokens
                    <input
                      type="number"
                      value={maxTokens()}
                      onChange={(e) => setMaxTokens(parseInt(e.currentTarget.value))}
                      min="100"
                      max="8000"
                      class={style.numberInput}
                    />
                  </label>
                  <p class={style.settingDescription}>
                    Maximum tokens per response (100-8000)
                  </p>
                </div>

                <div class={style.settingItem}>
                  <label class={style.settingLabel}>
                    Temperature: {temperature()}
                    <input
                      type="range"
                      value={temperature()}
                      onChange={(e) => setTemperature(parseFloat(e.currentTarget.value))}
                      min="0"
                      max="2"
                      step="0.1"
                      class={style.slider}
                    />
                  </label>
                  <p class={style.settingDescription}>
                    Controls randomness: 0 (focused) to 2 (creative)
                  </p>
                </div>
              </div>
            )}

            {activeTab() === "api" && (
              <div class={style.settingsSection}>
                <h2>API Key Management</h2>
                <p class={style.sectionDescription}>
                  Configure API keys for different model providers
                </p>
                
                <div class={style.apiKeyList}>
                  <For each={apiKeys()}>
                    {(apiKey) => (
                      <div class={style.apiKeyItem}>
                        <div class={style.apiKeyInfo}>
                          <div class={style.providerName}>{apiKey.provider}</div>
                          <div class={style.apiKeyValue}>
                            {apiKey.key || "Not configured"}
                          </div>
                          <div class={`${style.apiKeyStatus} ${style[apiKey.status]}`}>
                            {apiKey.status === "active" ? "✓ Active" : "Not configured"}
                          </div>
                        </div>
                        <div class={style.apiKeyActions}>
                          {apiKey.status === "not_configured" ? (
                            <button
                              class={style.addButton}
                              onClick={() => addApiKey(apiKey.provider)}
                            >
                              Add Key
                            </button>
                          ) : (
                            <>
                              <button
                                class={style.editButton}
                                onClick={() => addApiKey(apiKey.provider)}
                              >
                                Update
                              </button>
                              <button
                                class={style.removeButton}
                                onClick={() => removeApiKey(apiKey.provider)}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                <div class={style.securityNote}>
                  <h3>🔒 Security Note</h3>
                  <p>API keys are encrypted and stored locally. They are never sent to our servers or shared with third parties.</p>
                </div>
              </div>
            )}

            {activeTab() === "advanced" && (
              <div class={style.settingsSection}>
                <h2>Advanced Settings</h2>
                
                <div class={style.settingItem}>
                  <h3>Data Management</h3>
                  <div class={style.buttonGroup}>
                    <button class={style.secondaryButton} onClick={exportSettings}>
                      Export Settings
                    </button>
                    <button class={style.secondaryButton}>
                      Import Settings
                    </button>
                    <button class={style.secondaryButton}>
                      Export All Data
                    </button>
                  </div>
                </div>

                <div class={style.settingItem}>
                  <h3>Reset Options</h3>
                  <div class={style.buttonGroup}>
                    <button class={style.warningButton} onClick={resetSettings}>
                      Reset Settings
                    </button>
                    <button class={style.dangerButton}>
                      Clear All Data
                    </button>
                  </div>
                  <p class={style.settingDescription}>
                    Warning: These actions cannot be undone
                  </p>
                </div>

                <div class={style.settingItem}>
                  <h3>Debug Information</h3>
                  <div class={style.debugInfo}>
                    <div>Version: 2.2.1</div>
                    <div>Platform: Web</div>
                    <div>Node: 18.x</div>
                    <div>Database: SQLite</div>
                    <div>Models Available: 651</div>
                    <div>Providers: 43</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div class={style.footer}>
            <button class={style.primaryButton} onClick={saveSettings}>
              Save Changes
            </button>
            <button class={style.secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}