import { createSignal, createResource, For } from "solid-js";
import style from "./Analytics.module.css";

interface UsageStats {
  period: string;
  total_sessions: number;
  total_messages: number;
  total_cost: number;
  avg_session_duration: number;
  most_used_model: string;
  free_vs_paid_ratio: number;
}

interface ModelUsage {
  model: string;
  provider: string;
  sessions: number;
  messages: number;
  cost: number;
  avg_response_time: number;
}

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = createSignal("week");
  const [selectedMetric, setSelectedMetric] = createSignal("sessions");

  // Mock analytics data
  const [stats] = createResource(() => {
    return Promise.resolve({
      daily: {
        period: "Last 7 days",
        total_sessions: 47,
        total_messages: 892,
        total_cost: 12.45,
        avg_session_duration: 18.5,
        most_used_model: "gpt-4",
        free_vs_paid_ratio: 0.34
      },
      weekly: {
        period: "Last 4 weeks",
        total_sessions: 203,
        total_messages: 3567,
        total_cost: 45.78,
        avg_session_duration: 22.1,
        most_used_model: "claude-3-haiku",
        free_vs_paid_ratio: 0.42
      },
      monthly: {
        period: "Last 6 months",
        total_sessions: 1247,
        total_messages: 21453,
        total_cost: 234.56,
        avg_session_duration: 19.8,
        most_used_model: "gpt-4",
        free_vs_paid_ratio: 0.38
      }
    });
  });

  const [modelUsage] = createResource(() => {
    return Promise.resolve([
      {
        model: "gpt-4",
        provider: "openai",
        sessions: 124,
        messages: 2341,
        cost: 87.42,
        avg_response_time: 2.3
      },
      {
        model: "claude-3-haiku",
        provider: "anthropic",
        sessions: 98,
        messages: 1567,
        cost: 23.45,
        avg_response_time: 1.8
      },
      {
        model: "llama-3-8b",
        provider: "meta",
        sessions: 156,
        messages: 2789,
        cost: 0.00,
        avg_response_time: 3.1
      },
      {
        model: "gemini-pro",
        provider: "google",
        sessions: 67,
        messages: 1234,
        cost: 15.67,
        avg_response_time: 2.1
      }
    ]);
  });

  const currentStats = () => {
    const data = stats();
    if (!data) return null;
    
    switch (selectedPeriod()) {
      case "day": return data.daily;
      case "week": return data.weekly;
      case "month": return data.monthly;
      default: return data.weekly;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatCost = (cost: number) => {
    return cost > 0 ? `$${cost.toFixed(2)}` : "Free";
  };

  const chartData = [
    { day: "Mon", sessions: 12, messages: 234, cost: 5.67 },
    { day: "Tue", sessions: 18, messages: 345, cost: 8.23 },
    { day: "Wed", sessions: 15, messages: 289, cost: 6.45 },
    { day: "Thu", sessions: 22, messages: 423, cost: 9.87 },
    { day: "Fri", sessions: 19, messages: 367, cost: 7.89 },
    { day: "Sat", sessions: 8, messages: 156, cost: 3.21 },
    { day: "Sun", sessions: 11, messages: 201, cost: 4.32 }
  ];

  const maxValue = () => {
    const metric = selectedMetric();
    return Math.max(...chartData.map(d => d[metric as keyof typeof d] as number));
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
            <a href="/analytics" class={`${style.navItem} ${style.active}`}>Analytics</a>
            <a href="/security" class={style.navItem}>Security</a>
            <a href="/settings" class={style.navItem}>Settings</a>
          </nav>
        </div>
      </div>

      <div class={style.main}>
        <div class={style.header}>
          <h1>Analytics Dashboard</h1>
          <p>Track your AI usage patterns and costs</p>
        </div>

        <div class={style.controls}>
          <div class={style.periodSelector}>
            <button
              class={selectedPeriod() === "day" ? style.active : ""}
              onClick={() => setSelectedPeriod("day")}
            >
              Daily
            </button>
            <button
              class={selectedPeriod() === "week" ? style.active : ""}
              onClick={() => setSelectedPeriod("week")}
            >
              Weekly
            </button>
            <button
              class={selectedPeriod() === "month" ? style.active : ""}
              onClick={() => setSelectedPeriod("month")}
            >
              Monthly
            </button>
          </div>
        </div>

        <div class={style.content}>
          <div class={style.statsGrid}>
            <div class={style.statCard}>
              <div class={style.statHeader}>
                <h3>Total Sessions</h3>
                <div class={style.statIcon}>📊</div>
              </div>
              <div class={style.statValue}>
                {currentStats()?.total_sessions || 0}
              </div>
              <div class={style.statLabel}>
                {currentStats()?.period}
              </div>
            </div>

            <div class={style.statCard}>
              <div class={style.statHeader}>
                <h3>Messages Sent</h3>
                <div class={style.statIcon}>💬</div>
              </div>
              <div class={style.statValue}>
                {currentStats()?.total_messages.toLocaleString() || 0}
              </div>
              <div class={style.statLabel}>
                Avg {Math.round((currentStats()?.total_messages || 0) / (currentStats()?.total_sessions || 1))} per session
              </div>
            </div>

            <div class={style.statCard}>
              <div class={style.statHeader}>
                <h3>Total Cost</h3>
                <div class={style.statIcon}>💰</div>
              </div>
              <div class={style.statValue}>
                {formatCost(currentStats()?.total_cost || 0)}
              </div>
              <div class={style.statLabel}>
                {Math.round((currentStats()?.free_vs_paid_ratio || 0) * 100)}% from free models
              </div>
            </div>

            <div class={style.statCard}>
              <div class={style.statHeader}>
                <h3>Avg Duration</h3>
                <div class={style.statIcon}>⏱️</div>
              </div>
              <div class={style.statValue}>
                {formatDuration(currentStats()?.avg_session_duration || 0)}
              </div>
              <div class={style.statLabel}>
                Per session
              </div>
            </div>
          </div>

          <div class={style.chartSection}>
            <div class={style.chartHeader}>
              <h2>Usage Trends</h2>
              <div class={style.metricSelector}>
                <button
                  class={selectedMetric() === "sessions" ? style.active : ""}
                  onClick={() => setSelectedMetric("sessions")}
                >
                  Sessions
                </button>
                <button
                  class={selectedMetric() === "messages" ? style.active : ""}
                  onClick={() => setSelectedMetric("messages")}
                >
                  Messages
                </button>
                <button
                  class={selectedMetric() === "cost" ? style.active : ""}
                  onClick={() => setSelectedMetric("cost")}
                >
                  Cost
                </button>
              </div>
            </div>

            <div class={style.chart}>
              <For each={chartData}>
                {(data) => {
                  const value = data[selectedMetric() as keyof typeof data] as number;
                  const percentage = (value / maxValue()) * 100;
                  return (
                    <div class={style.chartBar}>
                      <div
                        class={style.chartBarFill}
                        style={{ height: `${percentage}%` }}
                        title={`${data.day}: ${value}`}
                      />
                      <div class={style.chartLabel}>{data.day}</div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>

          <div class={style.modelUsageSection}>
            <h2>Model Usage Statistics</h2>
            <div class={style.modelUsageTable}>
              <div class={style.tableHeader}>
                <div>Model</div>
                <div>Sessions</div>
                <div>Messages</div>
                <div>Cost</div>
                <div>Avg Response</div>
              </div>
              <For each={modelUsage()}>
                {(model) => (
                  <div class={style.tableRow}>
                    <div class={style.modelInfo}>
                      <div class={style.modelName}>{model.model}</div>
                      <div class={style.providerName}>{model.provider}</div>
                    </div>
                    <div class={style.tableCell}>{model.sessions}</div>
                    <div class={style.tableCell}>{model.messages.toLocaleString()}</div>
                    <div class={style.tableCell}>
                      <span class={model.cost > 0 ? style.cost : style.free}>
                        {formatCost(model.cost)}
                      </span>
                    </div>
                    <div class={style.tableCell}>{model.avg_response_time}s</div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}