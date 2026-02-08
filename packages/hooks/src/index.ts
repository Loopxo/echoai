/**
 * EchoAI Hooks - Lifecycle Hooks System
 */

export type HookPhase = "before" | "after";
export type HookPriority = "high" | "normal" | "low";

export interface HookHandler<T = unknown> {
    id: string;
    priority: HookPriority;
    handler: (data: T) => Promise<T | void>;
}

export interface HookOptions {
    priority?: HookPriority;
    once?: boolean;
}

const PRIORITY_ORDER: Record<HookPriority, number> = { high: 0, normal: 1, low: 2 };

export class HookRegistry {
    private hooks: Map<string, HookHandler[]> = new Map();
    private idCounter = 0;

    on<T>(event: string, handler: (data: T) => Promise<T | void>, options?: HookOptions): string {
        const id = `hook_${++this.idCounter}`;
        const entry: HookHandler<T> = {
            id,
            priority: options?.priority || "normal",
            handler: options?.once
                ? async (data: T) => { this.off(event, id); return handler(data); }
                : handler,
        };

        const handlers = this.hooks.get(event) || [];
        handlers.push(entry as HookHandler);
        handlers.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        this.hooks.set(event, handlers);
        return id;
    }

    off(event: string, id: string): void {
        const handlers = this.hooks.get(event);
        if (handlers) {
            const idx = handlers.findIndex(h => h.id === id);
            if (idx >= 0) handlers.splice(idx, 1);
        }
    }

    async trigger<T>(event: string, data: T): Promise<T> {
        const handlers = this.hooks.get(event) || [];
        let result = data;
        for (const h of handlers) {
            const ret = await h.handler(result);
            if (ret !== undefined) result = ret as T;
        }
        return result;
    }

    clear(event?: string): void {
        if (event) this.hooks.delete(event);
        else this.hooks.clear();
    }

    list(): string[] { return Array.from(this.hooks.keys()); }
}

// Built-in hook events
export const HOOK_EVENTS = {
    MESSAGE_RECEIVE: "message:receive",
    MESSAGE_SEND: "message:send",
    SESSION_START: "session:start",
    SESSION_END: "session:end",
    TOOL_BEFORE: "tool:before",
    TOOL_AFTER: "tool:after",
    AGENT_INIT: "agent:init",
    AGENT_DESTROY: "agent:destroy",
    CHANNEL_CONNECT: "channel:connect",
    CHANNEL_DISCONNECT: "channel:disconnect",
} as const;

export function createHookRegistry(): HookRegistry { return new HookRegistry(); }
