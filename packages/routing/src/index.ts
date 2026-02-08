/**
 * EchoAI Routing - Message Routing and Dispatch
 */
import { EventEmitter } from "node:events";

export interface IncomingMessage { id: string; channel: string; senderId: string; content: string; timestamp: number; metadata?: Record<string, unknown>; }
export interface OutgoingMessage { channel: string; recipientId: string; content: string; replyTo?: string; metadata?: Record<string, unknown>; }
export type RouteHandler = (message: IncomingMessage) => Promise<OutgoingMessage | null>;
export type Middleware = (message: IncomingMessage, next: () => Promise<OutgoingMessage | null>) => Promise<OutgoingMessage | null>;

export interface Route { pattern: RegExp | string; handler: RouteHandler; priority: number; channels?: string[]; }

export class MessageRouter extends EventEmitter {
    private routes: Route[] = [];
    private middlewares: Middleware[] = [];
    private defaultHandler?: RouteHandler;

    use(middleware: Middleware): this { this.middlewares.push(middleware); return this; }

    route(pattern: RegExp | string, handler: RouteHandler, options?: { priority?: number; channels?: string[] }): this {
        this.routes.push({ pattern, handler, priority: options?.priority ?? 0, channels: options?.channels });
        this.routes.sort((a, b) => b.priority - a.priority);
        return this;
    }

    default(handler: RouteHandler): this { this.defaultHandler = handler; return this; }

    async dispatch(message: IncomingMessage): Promise<OutgoingMessage | null> {
        let idx = 0;
        const self = this;

        const runMiddleware = async (): Promise<OutgoingMessage | null> => {
            if (idx < this.middlewares.length) {
                const mw = this.middlewares[idx++];
                return mw(message, runMiddleware);
            }
            return self.matchAndHandle(message);
        };

        this.emit("incoming", message);
        const response = await runMiddleware();
        if (response) this.emit("outgoing", response);
        return response;
    }

    private async matchAndHandle(message: IncomingMessage): Promise<OutgoingMessage | null> {
        for (const route of this.routes) {
            if (route.channels?.length && !route.channels.includes(message.channel)) continue;
            const matches = typeof route.pattern === "string"
                ? message.content.includes(route.pattern)
                : route.pattern.test(message.content);
            if (matches) {
                this.emit("matched", message, route);
                return route.handler(message);
            }
        }
        if (this.defaultHandler) return this.defaultHandler(message);
        return null;
    }
}

// Middleware factories
export function rateLimitMiddleware(maxPerMinute: number): Middleware {
    const counts = new Map<string, { count: number; resetAt: number }>();
    return async (msg, next) => {
        const key = `${msg.channel}:${msg.senderId}`;
        const now = Date.now();
        let entry = counts.get(key);
        if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + 60000 };
        if (entry.count >= maxPerMinute) return null;
        entry.count++;
        counts.set(key, entry);
        return next();
    };
}

export function loggingMiddleware(log: (msg: string) => void): Middleware {
    return async (msg, next) => {
        log(`[${msg.channel}] ${msg.senderId}: ${msg.content.slice(0, 50)}`);
        return next();
    };
}

export function createMessageRouter(): MessageRouter { return new MessageRouter(); }
