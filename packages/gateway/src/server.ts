/**
 * EchoAI Gateway Server
 *
 * Central control plane for the EchoAI platform.
 * Handles WebSocket connections, HTTP API, and coordinates all components.
 *
 * Security model:
 *  - Public methods (health, authenticate, pairing completion) need no auth.
 *  - All other methods require an authenticated client.
 *  - A client authenticates with a shared token, a previously paired deviceId,
 *    or (only when no token is configured) by connecting over loopback.
 */

import http from "node:http";
import { Hono } from "hono";
import { WebSocketServer, WebSocket } from "ws";
import { loadConfig, type EchoAIConfig, generateId } from "@echoai/core";
import { createPairingManager, type PairingManager, type PairedDevice } from "@echoai/pairing";
import {
    type JsonRpcRequest,
    createResponse,
    createErrorResponse,
    createNotification,
    isRequest,
    ErrorCodes,
    GatewayMethods,
    GatewayEvents,
} from "./protocol/index.js";

// =============================================================================
// Types
// =============================================================================

/** Optional provider that lets the embedding app expose real session data. */
export interface GatewaySessionProvider {
    list(): Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>;
    get?(id: string): Promise<unknown> | unknown;
    delete?(id: string): Promise<boolean> | boolean;
    clear?(id: string): Promise<boolean> | boolean;
}

export interface GatewayServerOptions {
    port?: number;
    host?: string;
    /**
     * Shared secret clients must present to `auth.authenticate`. May also be set
     * via the GATEWAY_AUTH_TOKEN env var. When unset, loopback clients are
     * trusted (local-dev convenience) unless `allowLoopbackTrust` is false.
     */
    authToken?: string;
    /** Trust loopback connections without a token when no token is configured. Default true. */
    allowLoopbackTrust?: boolean;
    /** Pre-created pairing manager. If omitted, one is created and loaded on start. */
    pairingManager?: PairingManager;
    /** Optional real session data source for session.* methods. */
    sessionProvider?: GatewaySessionProvider;
    /** Custom handler for privileged methods not handled internally. */
    onMessage?: (clientId: string, message: JsonRpcRequest) => Promise<unknown>;
}

export interface ConnectedClient {
    id: string;
    ws: WebSocket;
    type: "cli" | "canvas" | "node" | "channel" | "mobile" | "desktop" | "browser";
    connectedAt: number;
    subscriptions: Set<string>;
    authenticated: boolean;
    isLoopback: boolean;
    deviceId?: string;
    name?: string;
}

export interface GatewayServer {
    port: number;
    host: string;
    clients: Map<string, ConnectedClient>;
    pairing: PairingManager;
    broadcast: (event: string, data: unknown, options?: { exclude?: string[] }) => void;
    send: (clientId: string, event: string, data: unknown) => void;
    close: () => Promise<void>;
}

/** Methods callable without authentication. */
const PUBLIC_METHODS = new Set<string>([
    GatewayMethods.HEALTH_CHECK,
    GatewayMethods.HEALTH_VERSION,
    GatewayMethods.AUTH_AUTHENTICATE,
    GatewayMethods.AUTH_PAIR_COMPLETE,
]);

function isLoopbackAddress(address: string | undefined): boolean {
    if (!address) return false;
    return (
        address === "127.0.0.1" ||
        address === "::1" ||
        address === "::ffff:127.0.0.1" ||
        address.startsWith("127.")
    );
}

// =============================================================================
// Server Implementation
// =============================================================================

export async function startGatewayServer(
    options: GatewayServerOptions = {}
): Promise<GatewayServer> {
    const config = loadConfig();
    const port = options.port ?? config.gateway?.port ?? 18789;
    const host = options.host ?? "127.0.0.1";
    const authToken = options.authToken ?? process.env.GATEWAY_AUTH_TOKEN ?? undefined;
    const allowLoopbackTrust = options.allowLoopbackTrust ?? true;
    const pairing = options.pairingManager ?? (await createPairingManager());

    if (!authToken) {
        console.warn(
            "[gateway] No auth token configured. Only loopback clients will be trusted; " +
            "set GATEWAY_AUTH_TOKEN (or options.authToken) before exposing the gateway."
        );
    }

    const clients = new Map<string, ConnectedClient>();
    const app = new Hono();

    app.get("/health", (c) =>
        c.json({ status: "ok", version: "1.0.0", clients: clients.size, uptime: process.uptime() })
    );
    app.get("/version", (c) => c.json({ name: "echoai-gateway", version: "1.0.0" }));

    const httpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", `http://${host}:${port}`);
        const honoReq = new Request(url, {
            method: req.method,
            headers: Object.entries(req.headers).reduce((acc, [k, v]) => {
                if (v) acc[k] = Array.isArray(v) ? v[0]! : v;
                return acc;
            }, {} as Record<string, string>),
        });

        try {
            const response = await app.fetch(honoReq);
            res.statusCode = response.status;
            response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
            res.end(await response.text());
        } catch {
            res.statusCode = 500;
            res.end("Internal Server Error");
        }
    });

    const wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws, req) => {
        const clientId = generateId();
        const remoteAddress = req.socket.remoteAddress;
        const isLoopback = isLoopbackAddress(remoteAddress);

        const client: ConnectedClient = {
            id: clientId,
            ws,
            type: "cli",
            connectedAt: Date.now(),
            subscriptions: new Set(),
            // Trust loopback only when no token is configured.
            authenticated: isLoopback && allowLoopbackTrust && !authToken,
            isLoopback,
        };

        clients.set(clientId, client);
        console.log(`[gateway] Client connected: ${clientId} (${remoteAddress ?? "unknown"})`);

        ws.send(
            JSON.stringify(
                createNotification("welcome", {
                    clientId,
                    version: "1.0.0",
                    authenticated: client.authenticated,
                    authRequired: !client.authenticated,
                    methods: Object.values(GatewayMethods),
                    events: Object.values(GatewayEvents),
                })
            )
        );

        ws.on("message", async (data) => {
            let message: unknown;
            try {
                message = JSON.parse(data.toString());
            } catch {
                ws.send(JSON.stringify(createErrorResponse(0, ErrorCodes.PARSE_ERROR, "Invalid JSON")));
                return;
            }

            if (!isRequest(message)) {
                ws.send(JSON.stringify(createErrorResponse(0, ErrorCodes.INVALID_REQUEST, "Invalid JSON-RPC request")));
                return;
            }

            // Auth gate: reject privileged methods from unauthenticated clients.
            if (!client.authenticated && !PUBLIC_METHODS.has(message.method)) {
                ws.send(
                    JSON.stringify(
                        createErrorResponse(message.id, ErrorCodes.UNAUTHORIZED, "Authentication required")
                    )
                );
                return;
            }

            try {
                const result = await handleRequest(client, message, options, config, pairing, authToken);
                ws.send(JSON.stringify(createResponse(message.id, result)));
            } catch (error) {
                const code =
                    error instanceof GatewayRpcError ? error.code : ErrorCodes.INTERNAL_ERROR;
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                ws.send(JSON.stringify(createErrorResponse(message.id, code, errorMessage)));
            }
        });

        ws.on("close", () => {
            clients.delete(clientId);
            console.log(`[gateway] Client disconnected: ${clientId}`);
        });

        ws.on("error", (error) => {
            console.error(`[gateway] Client error: ${clientId}`, error);
            clients.delete(clientId);
        });
    });

    await new Promise<void>((resolve) => {
        httpServer.listen(port, host, () => {
            console.log(`[gateway] Server listening on ${host}:${port}`);
            resolve();
        });
    });

    function broadcast(event: string, data: unknown, opts?: { exclude?: string[] }) {
        const message = JSON.stringify(createNotification(event, data as Record<string, unknown>));
        for (const [id, c] of clients) {
            if (opts?.exclude?.includes(id)) continue;
            if (c.authenticated && c.ws.readyState === WebSocket.OPEN) c.ws.send(message);
        }
    }

    function send(clientId: string, event: string, data: unknown) {
        const c = clients.get(clientId);
        if (c && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify(createNotification(event, data as Record<string, unknown>)));
        }
    }

    async function close() {
        console.log("[gateway] Shutting down...");
        for (const c of clients.values()) c.ws.close();
        clients.clear();
        wss.close();
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
        console.log("[gateway] Server closed");
    }

    return { port, host, clients, pairing, broadcast, send, close };
}

// =============================================================================
// Request Handler
// =============================================================================

class GatewayRpcError extends Error {
    constructor(public code: number, message: string) {
        super(message);
    }
}

async function handleRequest(
    client: ConnectedClient,
    request: JsonRpcRequest,
    options: GatewayServerOptions,
    config: EchoAIConfig,
    pairing: PairingManager,
    authToken: string | undefined
): Promise<unknown> {
    const { method, params = {} } = request;

    // --- Auth & pairing (handled internally even when onMessage is set) ---
    switch (method) {
        case GatewayMethods.AUTH_AUTHENTICATE: {
            const token = typeof params.token === "string" ? params.token : undefined;
            const deviceId = typeof params.deviceId === "string" ? params.deviceId : undefined;

            const tokenOk = authToken !== undefined && token === authToken;
            const deviceOk = deviceId !== undefined && pairing.isPaired(deviceId);
            const loopbackOk = authToken === undefined && client.isLoopback;

            if (!tokenOk && !deviceOk && !loopbackOk) {
                throw new GatewayRpcError(ErrorCodes.UNAUTHORIZED, "Invalid credentials");
            }

            client.authenticated = true;
            if (typeof params.type === "string") client.type = params.type as ConnectedClient["type"];
            if (typeof params.name === "string") client.name = params.name;
            if (deviceOk && deviceId) {
                client.deviceId = deviceId;
                pairing.updateLastSeen(deviceId);
            }
            return { authenticated: true, clientId: client.id };
        }

        case GatewayMethods.AUTH_PAIR_COMPLETE: {
            const code = typeof params.code === "string" ? params.code : "";
            const device = (params.device ?? {}) as Partial<PairedDevice>;
            const paired = await pairing.completePairing(code, {
                name: device.name ?? "Unnamed device",
                type: (device.type as PairedDevice["type"]) ?? "other",
                publicKey: device.publicKey ?? "",
                capabilities: device.capabilities,
            });
            if (!paired) {
                throw new GatewayRpcError(ErrorCodes.UNAUTHORIZED, "Invalid or expired pairing code");
            }
            // The completing client is now authenticated as the new device.
            client.authenticated = true;
            client.deviceId = paired.id;
            client.type = (paired.type as ConnectedClient["type"]) ?? client.type;
            client.name = paired.name;
            return { deviceId: paired.id, name: paired.name };
        }
    }

    // --- Everything below requires authentication (already gated above) ---

    switch (method) {
        case GatewayMethods.AUTH_PAIR_START: {
            const name = typeof params.name === "string" ? params.name : undefined;
            const code = pairing.createPairingCode(name);
            return { code: code.code, expiresAt: code.expiresAt };
        }

        case GatewayMethods.DEVICE_LIST:
            return { devices: pairing.listDevices() };

        case GatewayMethods.DEVICE_UNPAIR: {
            const deviceId = typeof params.deviceId === "string" ? params.deviceId : "";
            return { ok: await pairing.unpair(deviceId) };
        }

        case GatewayMethods.HEALTH_CHECK:
            return { status: "ok", uptime: process.uptime() };

        case GatewayMethods.HEALTH_VERSION:
            return { name: "echoai-gateway", version: "1.0.0" };

        case GatewayMethods.CONFIG_GET:
            return config;

        case GatewayMethods.AGENT_LIST:
            return { agents: config.agents?.list ?? [{ id: "default", default: true }] };

        case GatewayMethods.SESSION_LIST:
            return { sessions: options.sessionProvider ? await options.sessionProvider.list() : [] };

        case GatewayMethods.SESSION_GET: {
            const id = typeof params.id === "string" ? params.id : "";
            if (!options.sessionProvider?.get) throw new GatewayRpcError(ErrorCodes.METHOD_NOT_FOUND, "session.get not supported");
            return { session: await options.sessionProvider.get(id) };
        }

        case GatewayMethods.SESSION_DELETE: {
            const id = typeof params.id === "string" ? params.id : "";
            if (!options.sessionProvider?.delete) throw new GatewayRpcError(ErrorCodes.METHOD_NOT_FOUND, "session.delete not supported");
            return { ok: await options.sessionProvider.delete(id) };
        }

        case GatewayMethods.SESSION_CLEAR: {
            const id = typeof params.id === "string" ? params.id : "";
            if (!options.sessionProvider?.clear) throw new GatewayRpcError(ErrorCodes.METHOD_NOT_FOUND, "session.clear not supported");
            return { ok: await options.sessionProvider.clear(id) };
        }

        case GatewayMethods.CHANNEL_LIST:
            return {
                channels: [
                    { id: "cli", status: "connected" },
                    { id: "whatsapp", status: config.channels?.whatsapp?.enabled ? "ready" : "disabled" },
                    { id: "telegram", status: config.channels?.telegram?.enabled ? "ready" : "disabled" },
                    { id: "discord", status: config.channels?.discord?.enabled ? "ready" : "disabled" },
                    { id: "slack", status: config.channels?.slack?.enabled ? "ready" : "disabled" },
                ],
            };

        case GatewayMethods.NODE_LIST:
            return { nodes: pairing.listDevices().filter((d) => d.type === "mobile" || d.type === "desktop") };

        default:
            // Delegate any other privileged method to the embedding app if it
            // provided a handler; otherwise report method not found.
            if (options.onMessage) {
                return options.onMessage(client.id, request);
            }
            throw new GatewayRpcError(ErrorCodes.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
}

export default startGatewayServer;
