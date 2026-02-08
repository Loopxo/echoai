/**
 * EchoAI Web Channel - Web Chat Interface
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";

export interface WebChannelConfig { port?: number; apiPath?: string; staticDir?: string; }
export interface WebMessage { id: string; sessionId: string; content: string; role: "user" | "assistant"; timestamp: number; }
export interface WebSession { id: string; messages: WebMessage[]; createdAt: number; updatedAt: number; }

export class WebChannel extends EventEmitter {
    private config: WebChannelConfig;
    private server?: ReturnType<typeof createServer>;
    private sessions: Map<string, WebSession> = new Map();

    constructor(config: WebChannelConfig = {}) {
        super();
        this.config = { port: config.port || 3000, apiPath: config.apiPath || "/api/chat", ...config };
    }

    async start(): Promise<void> {
        this.server = createServer((req, res) => this.handleRequest(req, res));
        this.server.listen(this.config.port);
        this.emit("ready", this.config.port);
    }

    async stop(): Promise<void> { this.server?.close(); }

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

        const url = new URL(req.url || "/", `http://localhost:${this.config.port}`);

        if (url.pathname === this.config.apiPath && req.method === "POST") {
            await this.handleChat(req, res);
        } else if (url.pathname === "/api/sessions" && req.method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify([...this.sessions.values()]));
        } else if (url.pathname === "/" || url.pathname === "/index.html") {
            res.setHeader("Content-Type", "text/html");
            res.end(this.getDefaultHtml());
        } else {
            res.statusCode = 404;
            res.end("Not Found");
        }
    }

    private async handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString()) as { message: string; sessionId?: string };

        const sessionId = body.sessionId || randomUUID();
        let session = this.sessions.get(sessionId);
        if (!session) {
            session = { id: sessionId, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
            this.sessions.set(sessionId, session);
        }

        const userMsg: WebMessage = { id: randomUUID(), sessionId, content: body.message, role: "user", timestamp: Date.now() };
        session.messages.push(userMsg);
        session.updatedAt = Date.now();

        // Emit for handler to process
        const response = await new Promise<string>((resolve) => {
            const timeout = setTimeout(() => resolve("I'm processing your request..."), 30000);
            this.emit("message", userMsg, (reply: string) => { clearTimeout(timeout); resolve(reply); });
        });

        const assistantMsg: WebMessage = { id: randomUUID(), sessionId, content: response, role: "assistant", timestamp: Date.now() };
        session.messages.push(assistantMsg);

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ sessionId, message: assistantMsg }));
    }

    getSession(sessionId: string): WebSession | undefined { return this.sessions.get(sessionId); }
    clearSession(sessionId: string): boolean { return this.sessions.delete(sessionId); }

    private getDefaultHtml(): string {
        return `<!DOCTYPE html><html><head><title>EchoAI Chat</title><style>
body{font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#1a1a2e;color:#eee}
#messages{border:1px solid #333;border-radius:8px;height:400px;overflow-y:auto;padding:15px;margin-bottom:15px;background:#16213e}
.msg{padding:10px;margin:5px 0;border-radius:8px;max-width:80%}.user{background:#0f4c75;margin-left:auto;text-align:right}.assistant{background:#1b4d3e}
#input{display:flex;gap:10px}#msg{flex:1;padding:10px;border-radius:8px;border:none;background:#333;color:#fff}
button{padding:10px 20px;border-radius:8px;border:none;background:#00d9ff;cursor:pointer;font-weight:bold}
</style></head><body><h1>🤖 EchoAI</h1><div id="messages"></div><div id="input"><input id="msg" placeholder="Type a message..." onkeydown="if(event.key==='Enter')send()"><button onclick="send()">Send</button></div>
<script>let sid;async function send(){const m=msg.value;if(!m)return;msg.value='';add(m,'user');const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,sessionId:sid})}).then(r=>r.json());sid=r.sessionId;add(r.message.content,'assistant')}function add(t,r){const d=document.createElement('div');d.className='msg '+r;d.textContent=t;messages.appendChild(d);messages.scrollTop=messages.scrollHeight}</script></body></html>`;
    }
}

export function createWebChannel(config?: WebChannelConfig): WebChannel { return new WebChannel(config); }
