import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { FileWorkspaceStore } from "./store";
import { createChatSession, appendUserMessage, runAssistantTurn } from "./runtime-service";
import { addIndexedFile, searchWorkspaceKnowledge } from "./knowledge-service";
import { completeWithGateway } from "./model-gateway-service";
import { putLocalObject, readLocalObject } from "./object-storage-service";
import { recordUsage } from "./operations-service";
import { productionReadiness } from "./readiness-service";
import { runSchedulerTick } from "./scheduler-service";
import { decryptSecret, upsertProviderKey } from "./vault-service";

async function testStore() {
  const dir = await mkdtemp(join(tmpdir(), "echoai-web-store-"));
  process.env.ECHOAI_WEB_DATA_DIR = dir;
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

  it("stores local objects and persists metadata", async () => {
    const store = await testStore();
    let storageKey = "";
    const state = await store.mutateAsync(async (draft) => {
      const object = await putLocalObject(draft, {
        name: "launch-notes.txt",
        content: "EchoAI local object storage is durable.",
        kind: "artifact",
      });
      storageKey = object.storageKey;
    });

    expect(state.storedObjects[0].name).toBe("launch-notes.txt");
    await expect(readLocalObject(storageKey)).resolves.toContain("durable");
    expect(state.auditEvents.some((event) => event.type === "storage.object_created")).toBe(true);
  });

  it("encrypts provider keys into local vault references", async () => {
    const store = await testStore();
    const state = await store.mutate((draft) => {
      upsertProviderKey(draft, {
        provider: "anthropic",
        label: "Anthropic BYOK",
        secret: "secret-test-key",
      });
    });

    const saved = state.providerKeys.find((key) => key.provider === "anthropic");
    expect(saved?.encryptedRef.startsWith("vault://local/")).toBe(true);
    expect(decryptSecret(saved!.encryptedRef.replace("vault://local/", ""))).toBe("secret-test-key");
  });

  it("queues scheduler ticks and records automation usage", async () => {
    const store = await testStore();
    let queued = 0;
    const state = await store.mutate((draft) => {
      const tick = runSchedulerTick(draft);
      queued = tick.queuedRuns.length;
    });

    expect(queued).toBeGreaterThan(0);
    expect(state.backgroundRuns[0].status).toBe("queued");
    expect(state.usageEvents.some((event) => event.source === "automation")).toBe(true);
  });

  it("routes local model gateway completions and reports readiness", async () => {
    const store = await testStore();
    let provider = "";
    const state = await store.mutate((draft) => {
      const chat = createChatSession(draft, { title: "Gateway test", modelId: "model_desktop_local" });
      const completion = completeWithGateway(draft, { session: chat, prompt: "Use the local route" });
      provider = completion.provider;
    });

    expect(provider).toBe("Local model gateway fallback");
    expect(state.usageEvents.some((event) => event.source === "model")).toBe(true);
    expect(productionReadiness().some((item) => item.id === "adapter_local_model_gateway" && item.status === "ready")).toBe(true);
  });
});
