/**
 * EchoAI Live Canvas
 *
 * Interactive browser-based UI host with:
 * - Static file serving from canvas root
 * - WebSocket-based live reload
 * - File watching with chokidar
 * - A2UI action bridge for native apps
 */

import type { Socket } from "node:net";
import type { Duplex } from "node:stream";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import * as fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import chokidar from "chokidar";
import { WebSocket, WebSocketServer } from "ws";

// =============================================================================
// Types
// =============================================================================

export interface CanvasHostOptions {
    /** Root directory for canvas files */
    rootDir?: string;
    /** Port to listen on (0 = random) */
    port?: number;
    /** Host to bind to */
    listenHost?: string;
    /** Enable live reload */
    liveReload?: boolean;
    /** Base path for canvas routes */
    basePath?: string;
    /** Logger function */
    log?: (message: string) => void;
    /** Error logger function */
    error?: (message: string) => void;
}

export interface CanvasHostServer {
    /** Bound port number */
    port: number;
    /** Canvas root directory */
    rootDir: string;
    /** Base URL path */
    basePath: string;
    /** Close the server */
    close: () => Promise<void>;
}

export interface CanvasHandlerOptions {
    rootDir: string;
    basePath: string;
    liveReload: boolean;
    log: (message: string) => void;
    error: (message: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const CANVAS_WS_PATH = "/__echoai_canvas_live_reload";
const DEFAULT_BASE_PATH = "/canvas";
const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
};

// =============================================================================
// Default Index HTML
// =============================================================================

function defaultIndexHTML(): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>EchoAI Canvas</title>
<style>
  :root {
    --bg: #0a0a0f;
    --card-bg: rgba(255,255,255,0.04);
    --card-border: rgba(255,255,255,0.08);
    --text: #e0e0e0;
    --accent: #6366f1;
    --accent-glow: rgba(99,102,241,0.3);
  }
  * { box-sizing: border-box; }
  html, body {
    height: 100%;
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .container {
    min-height: 100%;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .card {
    width: min(600px, 100%);
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 24px;
    backdrop-filter: blur(10px);
  }
  h1 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 600;
    background: linear-gradient(135deg, #fff 0%, #a5a5a5 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .subtitle {
    opacity: 0.6;
    font-size: 14px;
    margin-bottom: 20px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(99,102,241,0.1);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 12px;
    font-size: 14px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    flex-wrap: wrap;
  }
  button {
    appearance: none;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: #fff;
    padding: 10px 16px;
    border-radius: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  button:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
  }
  button:active {
    transform: translateY(1px);
  }
  .log {
    margin-top: 16px;
    padding: 12px;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    font: 13px/1.4 ui-monospace, 'SF Mono', monospace;
    color: rgba(255,255,255,0.7);
    max-height: 200px;
    overflow-y: auto;
  }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <h1>EchoAI Canvas</h1>
    <div class="subtitle">Interactive canvas with live reload</div>
    
    <div class="status">
      <div class="dot"></div>
      <span id="status-text">Connected</span>
    </div>
    
    <div class="actions">
      <button onclick="sendAction('hello')">Hello</button>
      <button onclick="sendAction('time')">Get Time</button>
      <button onclick="sendAction('photo')">Photo</button>
      <button onclick="sendAction('clear')">Clear Log</button>
    </div>
    
    <div class="log" id="log">Ready.</div>
  </div>
</div>
<script>
(() => {
  const logEl = document.getElementById('log');
  const statusEl = document.getElementById('status-text');
  
  function log(msg) {
    const time = new Date().toLocaleTimeString();
    logEl.textContent = \`[\${time}] \${msg}\\n\` + logEl.textContent;
  }
  
  window.sendAction = function(name) {
    if (name === 'clear') {
      logEl.textContent = '';
      return;
    }
    log(\`Action: \${name}\`);
  };
  
  // Live reload WebSocket
  const wsUrl = location.origin.replace(/^http/, 'ws') + '${CANVAS_WS_PATH}';
  let ws;
  
  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      statusEl.textContent = 'Connected (live reload)';
      log('Live reload connected');
    };
    ws.onmessage = (e) => {
      if (e.data === 'reload') {
        log('Reloading...');
        location.reload();
      }
    };
    ws.onclose = () => {
      statusEl.textContent = 'Disconnected';
      setTimeout(connect, 2000);
    };
  }
  connect();
})();
</script>
</body>
</html>`;
}

// =============================================================================
// Live Reload Script Injection
// =============================================================================

function injectLiveReloadScript(html: string): string {
    const script = `<script>
(function(){
  var ws;
  function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, 'ws') + '${CANVAS_WS_PATH}');
    ws.onmessage = function(e) { if (e.data === 'reload') location.reload(); };
    ws.onclose = function() { setTimeout(connect, 2000); };
  }
  connect();
})();
</script>`;

    if (html.includes("</body>")) {
        return html.replace("</body>", script + "</body>");
    }
    if (html.includes("</html>")) {
        return html.replace("</html>", script + "</html>");
    }
    return html + script;
}

// =============================================================================
// Path Utilities
// =============================================================================

function normalizeUrlPath(rawPath: string): string {
    const decoded = decodeURIComponent(rawPath || "/");
    const normalized = path.posix.normalize(decoded);
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeBasePath(rawPath: string | undefined): string {
    const trimmed = (rawPath ?? DEFAULT_BASE_PATH).trim();
    const normalized = normalizeUrlPath(trimmed || DEFAULT_BASE_PATH);
    return normalized === "/" ? "/" : normalized.replace(/\/+$/, "");
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || "application/octet-stream";
}

function resolveDefaultCanvasRoot(): string {
    const stateDir = process.env.ECHOAI_STATE_DIR?.trim() ||
        path.join(process.env.HOME || "~", ".echoai");
    return path.join(stateDir, "canvas");
}

// =============================================================================
// File Resolution
// =============================================================================

async function resolveFilePath(
    rootReal: string,
    urlPath: string
): Promise<{ filePath: string; data: Buffer } | null> {
    const normalized = normalizeUrlPath(urlPath);
    const rel = normalized.replace(/^\/+/, "");

    // Prevent directory traversal
    if (rel.split("/").some((p) => p === "..")) {
        return null;
    }

    const tryRead = async (relative: string): Promise<{ filePath: string; data: Buffer } | null> => {
        try {
            const fullPath = path.join(rootReal, relative);
            const realPath = await fs.realpath(fullPath);

            // Ensure path is within root
            if (!realPath.startsWith(rootReal)) {
                return null;
            }

            const stat = await fs.stat(realPath);
            if (!stat.isFile()) {
                return null;
            }

            const data = await fs.readFile(realPath);
            return { filePath: realPath, data };
        } catch {
            return null;
        }
    };

    // Try index.html for directory paths
    if (normalized.endsWith("/") || !rel.includes(".")) {
        const indexResult = await tryRead(path.posix.join(rel, "index.html"));
        if (indexResult) return indexResult;
    }

    return tryRead(rel);
}

// =============================================================================
// Canvas Handler
// =============================================================================

export async function createCanvasHandler(
    opts: CanvasHandlerOptions
): Promise<{
    handleHttpRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
    handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => boolean;
    close: () => Promise<void>;
}> {
    const { rootDir, basePath, liveReload, log, error } = opts;

    // Ensure root directory exists
    await fs.mkdir(rootDir, { recursive: true });
    const rootReal = await fs.realpath(rootDir);

    // Create default index.html if missing
    try {
        const indexPath = path.join(rootReal, "index.html");
        await fs.stat(indexPath);
    } catch {
        try {
            await fs.writeFile(path.join(rootReal, "index.html"), defaultIndexHTML(), "utf8");
        } catch {
            // Ignore
        }
    }

    // WebSocket server for live reload
    const wss = liveReload ? new WebSocketServer({ noServer: true }) : null;
    const sockets = new Set<WebSocket>();

    if (wss) {
        wss.on("connection", (ws) => {
            sockets.add(ws);
            ws.on("close", () => sockets.delete(ws));
        });
    }

    // File watcher for live reload
    let debounce: NodeJS.Timeout | null = null;

    const broadcastReload = () => {
        for (const ws of sockets) {
            try {
                ws.send("reload");
            } catch {
                // Ignore
            }
        }
    };

    const scheduleReload = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
            debounce = null;
            broadcastReload();
        }, 100);
    };

    const watcher = liveReload
        ? chokidar.watch(rootReal, {
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
            ignored: [/(^|[/\\])\../, /(^|[/\\])node_modules([/\\]|$)/],
        })
        : null;

    watcher?.on("all", scheduleReload);
    watcher?.on("error", (err) => {
        error(`Canvas watcher error: ${err}`);
    });

    // HTTP request handler
    const handleHttpRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
        const urlRaw = req.url;
        if (!urlRaw) return false;

        try {
            const url = new URL(urlRaw, "http://localhost");
            let urlPath = url.pathname;

            // Check if path matches base path
            if (basePath !== "/") {
                if (urlPath !== basePath && !urlPath.startsWith(`${basePath}/`)) {
                    return false;
                }
                urlPath = urlPath === basePath ? "/" : urlPath.slice(basePath.length) || "/";
            }

            // Only handle GET/HEAD
            if (req.method !== "GET" && req.method !== "HEAD") {
                res.statusCode = 405;
                res.setHeader("Content-Type", "text/plain");
                res.end("Method Not Allowed");
                return true;
            }

            const opened = await resolveFilePath(rootReal, urlPath);
            if (!opened) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "text/plain");
                res.end("Not Found");
                return true;
            }

            const { filePath, data } = opened;
            const mime = getMimeType(filePath);

            res.setHeader("Cache-Control", "no-store");

            if (mime === "text/html" && liveReload) {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(injectLiveReloadScript(data.toString("utf8")));
            } else {
                res.setHeader("Content-Type", mime);
                res.end(data);
            }

            return true;
        } catch (err) {
            error(`Canvas request error: ${err}`);
            res.statusCode = 500;
            res.end("Internal Server Error");
            return true;
        }
    };

    // WebSocket upgrade handler
    const handleUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): boolean => {
        if (!wss) return false;

        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== CANVAS_WS_PATH) return false;

        wss.handleUpgrade(req, socket as Socket, head, (ws) => {
            wss.emit("connection", ws, req);
        });

        return true;
    };

    // Close handler
    const close = async (): Promise<void> => {
        if (debounce) clearTimeout(debounce);
        await watcher?.close();
        if (wss) {
            await new Promise<void>((resolve) => wss.close(() => resolve()));
        }
    };

    return { handleHttpRequest, handleUpgrade, close };
}

// =============================================================================
// Canvas Host Server
// =============================================================================

export async function startCanvasHost(opts: CanvasHostOptions = {}): Promise<CanvasHostServer> {
    const rootDir = opts.rootDir?.trim() || resolveDefaultCanvasRoot();
    const basePath = normalizeBasePath(opts.basePath);
    const bindHost = opts.listenHost?.trim() || "127.0.0.1";
    const listenPort = opts.port ?? 0;
    const liveReload = opts.liveReload !== false;
    const log = opts.log || console.log;
    const error = opts.error || console.error;

    const handler = await createCanvasHandler({
        rootDir,
        basePath,
        liveReload,
        log,
        error,
    });

    const server: Server = http.createServer((req, res) => {
        if (String(req.headers.upgrade ?? "").toLowerCase() === "websocket") {
            return;
        }

        handler.handleHttpRequest(req, res).catch((err) => {
            error(`Canvas request failed: ${err}`);
            res.statusCode = 500;
            res.end("error");
        });
    });

    server.on("upgrade", (req, socket, head) => {
        if (!handler.handleUpgrade(req, socket, head)) {
            socket.destroy();
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => {
            server.off("error", reject);
            resolve();
        });
        server.listen(listenPort, bindHost);
    });

    const addr = server.address();
    const boundPort = typeof addr === "object" && addr ? addr.port : 0;
    const rootReal = await fs.realpath(rootDir);

    log(`[canvas] Listening on http://${bindHost}:${boundPort}${basePath} (root: ${rootReal})`);

    return {
        port: boundPort,
        rootDir: rootReal,
        basePath,
        close: async () => {
            await handler.close();
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
        },
    };
}

// =============================================================================
// Exports
// =============================================================================

export { CANVAS_WS_PATH, DEFAULT_BASE_PATH };
