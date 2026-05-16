"use client";

import { useMemo, useState } from "react";
import type { EchoAIWorkspaceState } from "@echoai/contracts";

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
      {dark ? "☾" : "☼"}
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
  const commands = [
    { label: "New chat", href: "/app/chat?new=1" },
    { label: "New project", href: "/app/projects?new=1" },
    { label: "New note", href: "/app/notes?new=1" },
    { label: "New automation", href: "/app/automations?new=1" },
  ];

  return (
    <div className="command">
      <button className="icon-button wide" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        ⌘K
      </button>
      {open ? (
        <div className="popover right">
          {commands.map((command) => (
            <a href={command.href} key={command.label}>
              <span>Command</span>
              {command.label}
            </a>
          ))}
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
        ◇
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
