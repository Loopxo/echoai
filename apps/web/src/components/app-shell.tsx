import type { ReactNode } from "react";
import { workspaceState } from "@/lib/data";
import { CommandPalette, GlobalSearch, NotificationCenter, ThemeToggle } from "./interactive-controls";

const navItems = [
  ["Command", "/app"],
  ["Chat", "/app/chat"],
  ["Projects", "/app/projects"],
  ["Knowledge", "/app/knowledge"],
  ["Notes", "/app/notes"],
  ["Memories", "/app/memories"],
  ["Outputs", "/app/outputs"],
  ["Tools", "/app/tools"],
  ["Automations", "/app/automations"],
  ["Devices", "/app/devices"],
  ["Settings", "/app/settings"],
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/app" aria-label="EchoAI Command">
          <span className="brand-mark">E</span>
          <span>
            EchoAI
            <small>Private Web</small>
          </span>
        </a>
        <nav>
          {navItems.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="main-frame">
        <header className="topbar">
          <GlobalSearch state={workspaceState} />
          <div className="topbar-actions">
            <CommandPalette />
            <NotificationCenter state={workspaceState} />
            <ThemeToggle />
            <a className="account-chip" href="/app/account">
              {workspaceState.session.email}
            </a>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
