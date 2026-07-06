"use client";

import { useMemo, useState } from "react";
import type { EchoAIWorkspaceState } from "@echoai/contracts";
import { Icon } from "@echoai/design";

type InteractiveControlsProps = {
  state: EchoAIWorkspaceState;
};

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  return (
    <button
      className="icon-button"
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => {
        document.documentElement.dataset.theme = dark ? "light" : "dark";
        setDark(!dark);
      }}
    >
      <Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}

export function GlobalSearch({ state }: InteractiveControlsProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    return [
      ...state.chats.map((item) => ({ type: "Chat", title: item.title, href: `/app/chat/${item.id}` })),
      ...state.projects.map((item) => ({ type: "Project", title: item.name, href: `/app/projects/${item.id}` })),
      ...state.notes.map((item) => ({ type: "Note", title: item.title, href: "/app/notes" })),
      ...state.files.map((item) => ({ type: "File", title: item.name, href: "/app/files" })),
      ...state.memories.map((item) => ({ type: "Memory", title: item.text, href: "/app/memories" })),
    ].filter((item) => item.title.toLowerCase().includes(normalized));
  }, [query, state]);

  return (
    <div className="search">
      <span className="search-icon" aria-hidden>
        <Icon name="search" size={15} />
      </span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace" />
      {query ? (
        <div className="popover">
          {results.length ? (
            results.slice(0, 7).map((result) => (
              <a href={result.href} key={`${result.type}-${result.title}`}>
                <span>{result.type}</span>
                {result.title}
              </a>
            ))
          ) : (
            <p>No matching workspace items.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const commands = useMemo(
    () => [
      { label: "New chat", group: "Create", href: "/app/chat?new=1" },
      { label: "New project", group: "Create", href: "/app/projects?new=1" },
      { label: "New note", group: "Create", href: "/app/notes?new=1" },
      { label: "New automation", group: "Create", href: "/app/automations?new=1" },
      { label: "Go to Chat", group: "Navigate", href: "/app/chat" },
      { label: "Go to Projects", group: "Navigate", href: "/app/projects" },
      { label: "Go to Files", group: "Navigate", href: "/app/files" },
      { label: "Go to Memories", group: "Navigate", href: "/app/memories" },
      { label: "Go to Automations", group: "Navigate", href: "/app/automations" },
      { label: "Go to Models", group: "Navigate", href: "/app/models" },
      { label: "Go to Devices", group: "Navigate", href: "/app/devices" },
      { label: "Go to Billing", group: "Navigate", href: "/app/billing" },
      { label: "Go to Settings", group: "Navigate", href: "/app/settings" },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(normalized));
  }, [commands, query]);

  return (
    <div className="command">
      <button className="icon-button wide" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="command" size={15} />
        <span>K</span>
      </button>
      {open ? (
        <div className="popover right command-popover">
          <input
            autoFocus
            className="command-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command…"
          />
          <div className="command-results">
            {filtered.length ? (
              filtered.map((command) => (
                <a href={command.href} key={command.label}>
                  <span>{command.group}</span>
                  {command.label}
                </a>
              ))
            ) : (
              <p>No matching command.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationCenter({ state }: InteractiveControlsProps) {
  const [open, setOpen] = useState(false);
  const notifications = [
    { label: "Task complete", detail: "Launch readiness report is available." },
    { label: "Automation failed", detail: "Dependency watch needs repository access." },
    { label: "Pair request", detail: "Android mobile is waiting for trust approval." },
    { label: "Billing", detail: `${state.billing.creditsRemaining} credits remain on ${state.billing.plan}.` },
  ];

  return (
    <div className="command">
      <button className="icon-button" type="button" onClick={() => setOpen(!open)} aria-label="Notifications" title="Notifications">
        <Icon name="bell" size={16} />
      </button>
      {open ? (
        <div className="popover right">
          {notifications.map((notification) => (
            <div className="notice" key={notification.label}>
              <strong>{notification.label}</strong>
              <p>{notification.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
