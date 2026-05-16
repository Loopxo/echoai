import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { FileWorkspaceStore } from "./store";
import { createChatSession, appendUserMessage, runAssistantTurn } from "./runtime-service";
import { addIndexedFile, searchWorkspaceKnowledge } from "./knowledge-service";
import { recordUsage } from "./operations-service";

async function testStore() {
  const dir = await mkdtemp(join(tmpdir(), "echoai-web-store-"));
  return new FileWorkspaceStore(join(dir, "workspace.json"));
}

describe("FileWorkspaceStore", () => {
  it("persists workspace mutations", async () => {
    const store = await testStore();
    const first = await store.read();
    const created = await store.mutate((state) => {
      createChatSession(state, { title: "Persistent test" });
    });
    expect(created.chats[0].title).toBe("Persistent test");

    const reread = await store.read();
    expect(reread.chats[0].title).toBe("Persistent test");
    expect(reread.chats.length).toBe(first.chats.length + 1);
  });

  it("indexes files and searches chunks", async () => {
    const store = await testStore();
    const state = await store.mutate((draft) => {
      addIndexedFile(draft, {
        projectId: "project_web",
        name: "overlay-gap.md",
        text: "EchoAI surpasses Overlay when desktop gateway and mobile approval are live.",
      });
    });

    expect(searchWorkspaceKnowledge(state, "desktop gateway")).toHaveLength(1);
  });

  it("records chat runs and usage", async () => {
    const store = await testStore();
    const state = await store.mutate((draft) => {
      const chat = createChatSession(draft, { title: "Runtime test" });
      appendUserMessage(draft, { sessionId: chat.id, content: "Run it" });
      runAssistantTurn(draft, chat.id);
      recordUsage(draft, { source: "browser", label: "smoke", units: 1, costUsd: 0.01 });
    });

    expect(state.backgroundRuns.some((run) => run.status === "complete")).toBe(true);
    expect(state.usageEvents.some((event) => event.source === "browser")).toBe(true);
  });
});
