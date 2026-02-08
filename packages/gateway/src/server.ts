/**
 * EchoAI Gateway Server
 *
 * Central control plane for the EchoAI platform.
 * Handles WebSocket connections, HTTP API, and coordinates all components.
 */

import http from "node:http";
import { Hono } from "hono";
import { WebSocketServer, WebSocket } from "ws";
import { loadConfig, type EchoAIConfig, generateId } from "@echoai/core";
import {
    type JsonRpcRequest,
    type JsonRpcResponse,
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

export interface GatewayServerOptions {
    port?: number;
    host?: string;
    onMessage?: (clientId: string, message: JsonRpcRequest) => Promise<unknown>;
}

export interface ConnectedClient {
    id: string;
    ws: WebSocket;
    type: "cli" | "canvas" | "node" | "channel";
    connectedAt: number;
    subscriptions: Set<string>;
}

export interface GatewayServer {
    port: number;
    host: string;
    clients: Map<string, ConnectedClient>;
    broadcast: (event: string, data: unknown, options?: { exclude?: string[] }) => void;
    send: (clientId: string, event: string, data: unknown) => void;
    close: () => Promise<void>;
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

    const clients = new Map<string, ConnectedClient>();
    const app = new Hono();

    // Health check endpoint
    app.get("/health", (c) => {
        return c.json({
            status: "ok",
            version: "1.0.0",
            clients: clients.size,
            uptime: process.uptime(),
        });
    });

    // Version endpoint
    app.get("/version", (c) => {
        return c.json({
            name: "echoai-gateway",
            version: "1.0.0",
        });
    });

    // Create HTTP server
    const httpServer = http.createServer(async (req, res) => {
        // Handle Hono requests
        const url = new URL(req.url ?? "/", `http://${host}:${port}`);
        const honoReq = new Request(url, {
            method: req.method,
            headers: Object.entries(req.headers).reduce((acc, [k, v]) => {
                if (v) acc[k] = Array.isArray(v) ? v[0] : v;
                return acc;
            }, {} as Record<string, string>),
        });

        try {
            const response = await app.fetch(honoReq);
            res.statusCode = response.status;
            response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
            const body = await response.text();
            res.end(body);
        } catch (error) {
            res.statusCode = 500;
            res.end("Internal Server Error");
        }
    });

    // Create WebSocket server
    const wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws) => {
        const clientId = generateId();
        const client: ConnectedClient = {
            id: clientId,
            ws,
            type: "cli",
            connectedAt: Date.now(),
            subscriptions: new Set(),
        };

        clients.set(clientId, client);
        console.log(`[gateway] Client connected: ${clientId}`);

        // Send welcome message
        ws.send(
            JSON.stringify(
                createNotification("welcome", {
                    clientId,
                    version: "1.0.0",
                    methods: Object.values(GatewayMethods),
                    events: Object.values(GatewayEvents),
                })
            )
        );

        ws.on("message", async (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (!isRequest(message)) {
                    ws.send(
                        JSON.stringify(
                            createErrorResponse(
                                0,
                                ErrorCodes.INVALID_REQUEST,
                                "Invalid JSON-RPC request"
                            )
                        )
                    );
                    return;
                }

                // Handle the request
                try {
                    const result = await handleRequest(client, message, options, config);
                    ws.send(JSON.stringify(createResponse(message.id, result)));
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : "Unknown error";
                    ws.send(
                        JSON.stringify(
                            createErrorResponse(
                                message.id,
                                ErrorCodes.INTERNAL_ERROR,
                                errorMessage
                            )
                        )
                    );
                }
            } catch {
                ws.send(
                    JSON.stringify(
                        createErrorResponse(0, ErrorCodes.PARSE_ERROR, "Invalid JSON")
                    )
                );
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

    // Start listening
    await new Promise<void>((resolve) => {
        httpServer.listen(port, host, () => {
            console.log(`[gateway] Server listening on ${host}:${port}`);
            resolve();
        });
    });

    // Broadcast to all clients
    function broadcast(
        event: string,
        data: unknown,
        options?: { exclude?: string[] }
    ) {
        const notification = createNotification(event, data as Record<string, unknown>);
        const message = JSON.stringify(notification);

        for (const [id, client] of clients) {
            if (options?.exclude?.includes(id)) continue;
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        }
    }

    // Send to specific client
    function send(clientId: string, event: string, data: unknown) {
        const client = clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
                JSON.stringify(createNotification(event, data as Record<string, unknown>))
            );
        }
    }

    // Close server
    async function close() {
        console.log("[gateway] Shutting down...");

        // Close all client connections
        for (const client of clients.values()) {
            client.ws.close();
        }
        clients.clear();

        // Close servers
        wss.close();
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));

        console.log("[gateway] Server closed");
    }

    return {
        port,
        host,
        clients,
        broadcast,
        send,
        close,
    };
}

// =============================================================================
// Request Handler
// =============================================================================

async function handleRequest(
    client: ConnectedClient,
    request: JsonRpcRequest,
    options: GatewayServerOptions,
    config: EchoAIConfig
): Promise<unknown> {
    const { method, params } = request;

    // If custom handler is provided, use it
    if (options.onMessage) {
        return options.onMessage(client.id, request);
    }

    // Built-in handlers
    switch (method) {
        case GatewayMethods.HEALTH_CHECK:
            return {
                status: "ok",
                uptime: process.uptime(),
            };

        case GatewayMethods.HEALTH_VERSION:
            return {
                name: "echoai-gateway",
                version: "1.0.0",
            };

        case GatewayMethods.CONFIG_GET:
            return config;

        case GatewayMethods.AGENT_LIST:
            return {
                agents: config.agents?.list ?? [{ id: "default", default: true }],
            };

        case GatewayMethods.SESSION_LIST:
            // Placeholder - will be implemented with session storage
            return { sessions: [] };

        case GatewayMethods.CHANNEL_LIST:
            return {
                channels: [
                    { id: "cli", status: "connected" },
                    { id: "whatsapp", status: config.channels?.whatsapp?.enabled ? "ready" : "disabled" },
                    { id: "telegram", status: config.channels?.telegram?.enabled ? "ready" : "disabled" },
                    { id: "discord", status: config.channels?.discord?.enabled ? "ready" : "disabled" },
                ],
            };

        default:
            throw new Error(`Method not found: ${method}`);
    }
}

export default startGatewayServer;
