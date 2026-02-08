/**
 * EchoAI LINE Channel - LINE Messenger Integration
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import { EventEmitter } from "node:events";

const LINE_API = "https://api.line.me/v2/bot";

export interface LineConfig { channelAccessToken: string; channelSecret: string; port?: number; }
export interface LineMessage { id: string; type: string; text?: string; replyToken?: string; userId: string; groupId?: string; timestamp: number; }

export class LineChannel extends EventEmitter {
    private config: LineConfig;
    private server?: ReturnType<typeof createServer>;

    constructor(config: LineConfig) { super(); this.config = config; }

    async start(): Promise<void> {
        const port = this.config.port || 8080;
        this.server = createServer((req, res) => this.handleWebhook(req, res));
        this.server.listen(port);
        this.emit("ready", port);
    }

    async stop(): Promise<void> { this.server?.close(); }

    private async handleWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (req.method !== "POST" || req.url !== "/webhook") { res.statusCode = 404; res.end(); return; }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = Buffer.concat(chunks).toString();

        // Verify signature
        const signature = req.headers["x-line-signature"] as string;
        const hash = createHmac("sha256", this.config.channelSecret).update(body).digest("base64");
        if (signature !== hash) { res.statusCode = 401; res.end(); return; }

        const data = JSON.parse(body) as { events: Array<{ type: string; replyToken?: string; source: { userId: string; groupId?: string }; message?: { id: string; type: string; text?: string }; timestamp: number }> };

        for (const event of data.events) {
            if (event.type === "message" && event.message) {
                const msg: LineMessage = {
                    id: event.message.id, type: event.message.type, text: event.message.text,
                    replyToken: event.replyToken, userId: event.source.userId,
                    groupId: event.source.groupId, timestamp: event.timestamp
                };
                this.emit("message", msg);
            }
        }

        res.statusCode = 200;
        res.end();
    }

    async reply(replyToken: string, messages: Array<{ type: string; text: string }>): Promise<void> {
        await fetch(`${LINE_API}/message/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.channelAccessToken}` },
            body: JSON.stringify({ replyToken, messages }),
        });
    }

    async push(userId: string, messages: Array<{ type: string; text: string }>): Promise<void> {
        await fetch(`${LINE_API}/message/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.channelAccessToken}` },
            body: JSON.stringify({ to: userId, messages }),
        });
    }

    async getProfile(userId: string): Promise<{ displayName: string; userId: string; pictureUrl?: string }> {
        const res = await fetch(`${LINE_API}/profile/${userId}`, {
            headers: { Authorization: `Bearer ${this.config.channelAccessToken}` },
        });
        return res.json() as Promise<{ displayName: string; userId: string; pictureUrl?: string }>;
    }
}

export function createLineChannel(config: LineConfig): LineChannel { return new LineChannel(config); }
