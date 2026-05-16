"use client";

import { useState } from "react";
import type { EchoAIChatSession, EchoAIModelRoute } from "@echoai/contracts";

export function ChatPanel({ session, models }: { session: EchoAIChatSession; models: EchoAIModelRoute[] }) {
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState(session.mode);
  const [modelId, setModelId] = useState(session.modelId);
  const [draft, setDraft] = useState("");
  const model = models.find((candidate) => candidate.id === modelId) ?? models[0];

  return (
    <section className="chat-grid">
      <div className="messages">
        {session.messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div>
              <strong>{message.role}</strong>
              <span>{message.createdAt}</span>
            </div>
            <p>{message.content}</p>
            {message.reasoningSummary ? (
              <details>
                <summary>Reasoning policy summary</summary>
                <p>{message.reasoningSummary}</p>
              </details>
            ) : null}
            {message.toolCalls?.map((tool) => (
              <div className="tool-call" key={tool.id}>
                <strong>{tool.title}</strong>
                <span>{tool.kind}</span>
                <p>{tool.summary}</p>
              </div>
            ))}
          </article>
        ))}
      </div>
      <aside className="composer">
        <label>
          Model
          <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
            {models.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.label} · {candidate.lane}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as EchoAIChatSession["mode"])}>
            {["ask", "act", "code", "research", "media", "automation"].map((candidate) => (
              <option value={candidate} key={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
        <div className="capabilities">
          {model.capabilities.map((capability) => (
            <span key={capability}>{capability}</span>
          ))}
        </div>
        <label>
          Attachments
          <input type="file" multiple accept="image/*,audio/*,.pdf,.docx,.csv,.txt,.md,.ts,.tsx,.js,.json" />
        </label>
        <label>
          Mentions
          <input placeholder="@project @file @note @memory @tool @device" />
        </label>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask EchoAI" />
        <div className="button-row">
          <button type="button" onClick={() => setRunning(true)}>
            Send
          </button>
          <button type="button" onClick={() => setRunning(false)} disabled={!running}>
            Stop
          </button>
          <button type="button">Retry</button>
          <button type="button">Fork</button>
        </div>
        <div className="button-row">
          <button type="button">Export MD</button>
          <button type="button">Export JSON</button>
          <button type="button">Export PDF</button>
          <button type="button">Share</button>
        </div>
        <div className="handoff">
          <button type="button">Desktop handoff</button>
          <button type="button">Mobile handoff</button>
        </div>
      </aside>
    </section>
  );
}
