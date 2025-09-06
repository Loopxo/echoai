import { createSignal, createResource, For, Show } from "solid-js";
import style from "./SessionManager.module.css";

interface Session {
  id: string;
  title: string;
  model: string;
  provider: string;
  created: string;
  updated: string;
  message_count: number;
  duration: number;
  cost: number;
  shared: boolean;
  tags: string[];
}

export default function SessionManager() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedModel, setSelectedModel] = createSignal("all");
  const [selectedTimeRange, setSelectedTimeRange] = createSignal("all");
  const [showSharedOnly, setShowSharedOnly] = createSignal(false);
  const [selectedSession, setSelectedSession] = createSignal<Session | null>(null);

  // Mock session data
  const [sessions] = createResource(() => {
    return Promise.resolve([
      {
        id: "sess_1",
        title: "React Performance Optimization",
        model: "gpt-4",
        provider: "openai",
        created: "2024-01-15T10:30:00Z",
        updated: "2024-01-15T11:45:00Z",
        message_count: 24,
        duration: 4500000,
        cost: 2.34,
        shared: true,
        tags: ["react", "performance", "optimization"]
      },
      {
        id: "sess_2",
        title: "Database Schema Design",
        model: "claude-3-haiku",
        provider: "anthropic",
        created: "2024-01-14T14:20:00Z",
        updated: "2024-01-14T15:10:00Z",
        message_count: 18,
        duration: 3000000,
        cost: 0.89,
        shared: false,
        tags: ["database", "schema", "sql"]
      },
      {
        id: "sess_3",
        title: "Python Data Analysis",
        model: "llama-3-8b",
        provider: "meta",
        created: "2024-01-13T09:15:00Z",
        updated: "2024-01-13T10:30:00Z",
        message_count: 32,
        duration: 4800000,
        cost: 0.00,
        shared: true,
        tags: ["python", "data", "analysis"]
      }
    ]);
  });

  const filteredSessions = () => {
    const sessionList = sessions() || [];
    return sessionList.filter(session => {
      const matchesSearch = session.title.toLowerCase().includes(searchQuery().toLowerCase()) ||
                          session.tags.some(tag => tag.toLowerCase().includes(searchQuery().toLowerCase()));
      const matchesModel = selectedModel() === "all" || session.model === selectedModel();
      const matchesShared = !showSharedOnly() || session.shared;
      return matchesSearch && matchesModel && matchesShared;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const exportSession = (sessionId: string) => {
    alert(`Exporting session ${sessionId}...`);
  };

  const shareSession = (sessionId: string) => {
    navigator.clipboard.writeText(`https://echo.ai/s/${sessionId}`);
    alert("Share link copied to clipboard!");
  };

  const deleteSession = (sessionId: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      alert(`Session ${sessionId} deleted`);
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
            <a href="/sessions" class={`${style.navItem} ${style.active}`}>Sessions</a>
            <a href="/analytics" class={style.navItem}>Analytics</a>
            <a href="/security" class={style.navItem}>Security</a>
            <a href="/settings" class={style.navItem}>Settings</a>
          </nav>
        </div>
      </div>

      <div class={style.main}>
        <div class={style.header}>
          <h1>Session Manager</h1>
          <p>Manage and explore your AI conversations</p>
        </div>

        <div class={style.filters}>
          <div class={style.searchBox}>
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class={style.searchInput}
            />
          </div>

          <select
            value={selectedModel()}
            onChange={(e) => setSelectedModel(e.currentTarget.value)}
            class={style.select}
          >
            <option value="all">All Models</option>
            <option value="gpt-4">GPT-4</option>
            <option value="claude-3-haiku">Claude 3 Haiku</option>
            <option value="llama-3-8b">Llama 3 8B</option>
          </select>

          <select
            value={selectedTimeRange()}
            onChange={(e) => setSelectedTimeRange(e.currentTarget.value)}
            class={style.select}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <label class={style.checkbox}>
            <input
              type="checkbox"
              checked={showSharedOnly()}
              onChange={(e) => setShowSharedOnly(e.currentTarget.checked)}
            />
            Shared only
          </label>
        </div>

        <div class={style.content}>
          <div class={style.sessionList}>
            <For each={filteredSessions()}>
              {(session) => (
                <div class={style.sessionCard}>
                  <div class={style.sessionHeader}>
                    <h3 class={style.sessionTitle}>{session.title}</h3>
                    <div class={style.sessionBadges}>
                      {session.shared && <span class={style.sharedBadge}>SHARED</span>}
                      <span class={style.modelBadge}>{session.model}</span>
                    </div>
                  </div>

                  <div class={style.sessionMeta}>
                    <span>Created: {formatDate(session.created)}</span>
                    <span>Updated: {formatDate(session.updated)}</span>
                    <span>{session.message_count} messages</span>
                    <span>{formatDuration(session.duration)}</span>
                    <span class={session.cost > 0 ? style.cost : style.free}>
                      {session.cost > 0 ? `$${session.cost.toFixed(2)}` : "Free"}
                    </span>
                  </div>

                  <div class={style.sessionTags}>
                    <For each={session.tags}>
                      {(tag) => <span class={style.tag}>{tag}</span>}
                    </For>
                  </div>

                  <div class={style.sessionActions}>
                    <button 
                      class={style.actionButton}
                      onClick={() => setSelectedSession(session)}
                    >
                      View
                    </button>
                    <button 
                      class={style.actionButton}
                      onClick={() => exportSession(session.id)}
                    >
                      Export
                    </button>
                    <button 
                      class={style.actionButton}
                      onClick={() => shareSession(session.id)}
                    >
                      Share
                    </button>
                    <button 
                      class={`${style.actionButton} ${style.danger}`}
                      onClick={() => deleteSession(session.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>

          <Show when={selectedSession()}>
            <div class={style.sessionDetail}>
              <div class={style.detailHeader}>
                <h2>{selectedSession()!.title}</h2>
                <button
                  class={style.closeButton}
                  onClick={() => setSelectedSession(null)}
                >
                  ×
                </button>
              </div>

              <div class={style.detailContent}>
                <div class={style.detailSection}>
                  <h3>Session Information</h3>
                  <div class={style.detailGrid}>
                    <div class={style.detailItem}>
                      <label>Model:</label>
                      <span>{selectedSession()!.model} ({selectedSession()!.provider})</span>
                    </div>
                    <div class={style.detailItem}>
                      <label>Messages:</label>
                      <span>{selectedSession()!.message_count}</span>
                    </div>
                    <div class={style.detailItem}>
                      <label>Duration:</label>
                      <span>{formatDuration(selectedSession()!.duration)}</span>
                    </div>
                    <div class={style.detailItem}>
                      <label>Cost:</label>
                      <span class={selectedSession()!.cost > 0 ? style.cost : style.free}>
                        {selectedSession()!.cost > 0 ? `$${selectedSession()!.cost.toFixed(2)}` : "Free"}
                      </span>
                    </div>
                    <div class={style.detailItem}>
                      <label>Created:</label>
                      <span>{formatDate(selectedSession()!.created)}</span>
                    </div>
                    <div class={style.detailItem}>
                      <label>Updated:</label>
                      <span>{formatDate(selectedSession()!.updated)}</span>
                    </div>
                  </div>
                </div>

                <div class={style.detailSection}>
                  <h3>Tags</h3>
                  <div class={style.sessionTags}>
                    <For each={selectedSession()!.tags}>
                      {(tag) => <span class={style.tag}>{tag}</span>}
                    </For>
                  </div>
                </div>

                <div class={style.detailSection}>
                  <h3>Actions</h3>
                  <div class={style.detailActions}>
                    <button class={style.detailActionButton}>
                      Continue Session
                    </button>
                    <button class={style.detailActionButton}>
                      Export JSON
                    </button>
                    <button class={style.detailActionButton}>
                      Export Markdown
                    </button>
                    <button class={`${style.detailActionButton} ${style.primary}`}>
                      Share Session
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