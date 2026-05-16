import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  EchoAIAuditEvent,
  EchoAIBackgroundRun,
  EchoAIChatSession,
  EchoAIDevice,
  EchoAIId,
  EchoAIWorkspaceState,
} from "@echoai/contracts";
import { workspaceState as seedWorkspaceState } from "@/lib/data";
import { createRunId } from "@/lib/observability";

const storeVersion = 1;

type PersistedWorkspace = {
  version: number;
  state: EchoAIWorkspaceState;
};

function cloneState(state: EchoAIWorkspaceState): EchoAIWorkspaceState {
  return structuredClone(state);
}

function defaultDataDir() {
  return process.env.ECHOAI_WEB_DATA_DIR || join(process.cwd(), ".echoai-web-data");
}

function defaultStorePath() {
  return join(defaultDataDir(), "workspace.json");
}

function now() {
  return new Date().toISOString();
}

export function makeId(prefix: string): EchoAIId {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createAuditEvent(
  type: EchoAIAuditEvent["type"],
  summary: string,
  state: EchoAIWorkspaceState,
  runId?: EchoAIId,
): EchoAIAuditEvent {
  return {
    id: makeId("audit"),
    type,
    actorId: state.session.userId,
    workspaceId: state.session.workspaceId,
    runId,
    summary,
    createdAt: now(),
  };
}

function ensureNewFields(state: EchoAIWorkspaceState): EchoAIWorkspaceState {
  return {
    ...state,
    usageEvents: state.usageEvents ?? [],
    providerKeys: state.providerKeys ?? [],
    externalAdapters: state.externalAdapters ?? [],
  };
}

export class FileWorkspaceStore {
  private cache: EchoAIWorkspaceState | null = null;

  constructor(private readonly path = defaultStorePath()) {}

  async read(): Promise<EchoAIWorkspaceState> {
    if (this.cache) {
      return cloneState(this.cache);
    }

    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as PersistedWorkspace;
      this.cache = ensureNewFields(parsed.state);
      return cloneState(this.cache);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      const seeded = ensureNewFields(cloneState(seedWorkspaceState));
      this.cache = seeded;
      await this.write(seeded);
      return cloneState(seeded);
    }
  }

  async write(state: EchoAIWorkspaceState): Promise<EchoAIWorkspaceState> {
    const next = ensureNewFields(cloneState(state));
    const payload: PersistedWorkspace = { version: storeVersion, state: next };
    await mkdir(dirname(this.path), { recursive: true });
    const tmpPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(tmpPath, this.path);
    this.cache = next;
    return cloneState(next);
  }

  async mutate(mutator: (state: EchoAIWorkspaceState) => void | EchoAIWorkspaceState): Promise<EchoAIWorkspaceState> {
    const state = await this.read();
    const maybeNext = mutator(state);
    return this.write(maybeNext ?? state);
  }

  async reset(): Promise<EchoAIWorkspaceState> {
    return this.write(ensureNewFields(cloneState(seedWorkspaceState)));
  }
}

let singleton: FileWorkspaceStore | null = null;

export function getWorkspaceStore(): FileWorkspaceStore {
  singleton ??= new FileWorkspaceStore();
  return singleton;
}

export function setWorkspaceStoreForTests(store: FileWorkspaceStore | null) {
  singleton = store;
}

export function findChat(state: EchoAIWorkspaceState, sessionId: string): EchoAIChatSession | undefined {
  return state.chats.find((chat) => chat.id === sessionId);
}

export function touchDevice(device: EchoAIDevice): EchoAIDevice {
  return {
    ...device,
    status: device.status === "offline" ? "pairing" : device.status,
    lastSeenAt: now(),
  };
}

export function createBackgroundRun(sessionId: string): EchoAIBackgroundRun {
  const runId = createRunId("run");
  return {
    id: runId,
    sessionId,
    status: "running",
    survivesRefresh: true,
    updatedAt: now(),
  };
}
