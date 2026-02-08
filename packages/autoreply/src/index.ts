/**
 * EchoAI AutoReply - Automated Message Responses
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const RULES_FILE = path.join(STATE_DIR, "autoreply-rules.json");

export type MatchType = "exact" | "contains" | "regex" | "startsWith" | "endsWith";

export interface AutoReplyRule {
    id: string;
    name: string;
    enabled: boolean;
    trigger: {
        type: MatchType;
        pattern: string;
        caseSensitive?: boolean;
    };
    response: string | ((match: RegExpMatchArray | null, message: string) => string);
    cooldownMs?: number;
    channels?: string[];
    users?: string[];
    excludeUsers?: string[];
    lastTriggered?: number;
}

export interface IncomingMessage {
    text: string;
    senderId: string;
    channelId: string;
}

function matchRule(rule: AutoReplyRule, text: string): boolean {
    const pattern = rule.trigger.caseSensitive ? rule.trigger.pattern : rule.trigger.pattern.toLowerCase();
    const input = rule.trigger.caseSensitive ? text : text.toLowerCase();

    switch (rule.trigger.type) {
        case "exact": return input === pattern;
        case "contains": return input.includes(pattern);
        case "startsWith": return input.startsWith(pattern);
        case "endsWith": return input.endsWith(pattern);
        case "regex": return new RegExp(pattern, rule.trigger.caseSensitive ? "" : "i").test(text);
        default: return false;
    }
}

export class AutoReplyManager {
    private rules: Map<string, AutoReplyRule> = new Map();

    async load(): Promise<void> {
        try {
            const data = await fs.readFile(RULES_FILE, "utf8");
            const arr = JSON.parse(data) as AutoReplyRule[];
            for (const r of arr) this.rules.set(r.id, r);
        } catch { /* No existing rules */ }
    }

    async save(): Promise<void> {
        await fs.mkdir(STATE_DIR, { recursive: true });
        const arr = [...this.rules.values()].map(r => ({
            ...r,
            response: typeof r.response === "function" ? r.response.toString() : r.response,
        }));
        await fs.writeFile(RULES_FILE, JSON.stringify(arr, null, 2));
    }

    addRule(rule: AutoReplyRule): void { this.rules.set(rule.id, rule); }
    removeRule(id: string): boolean { return this.rules.delete(id); }
    enableRule(id: string): void { const r = this.rules.get(id); if (r) r.enabled = true; }
    disableRule(id: string): void { const r = this.rules.get(id); if (r) r.enabled = false; }
    getRule(id: string): AutoReplyRule | undefined { return this.rules.get(id); }
    listRules(): AutoReplyRule[] { return [...this.rules.values()]; }

    check(message: IncomingMessage): string | null {
        for (const rule of this.rules.values()) {
            if (!rule.enabled) continue;
            if (rule.channels?.length && !rule.channels.includes(message.channelId)) continue;
            if (rule.users?.length && !rule.users.includes(message.senderId)) continue;
            if (rule.excludeUsers?.includes(message.senderId)) continue;
            if (rule.cooldownMs && rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownMs) continue;

            if (matchRule(rule, message.text)) {
                rule.lastTriggered = Date.now();
                if (typeof rule.response === "function") {
                    const match = rule.trigger.type === "regex"
                        ? message.text.match(new RegExp(rule.trigger.pattern, rule.trigger.caseSensitive ? "" : "i"))
                        : null;
                    return rule.response(match, message.text);
                }
                return rule.response;
            }
        }
        return null;
    }
}

export async function createAutoReplyManager(): Promise<AutoReplyManager> {
    const mgr = new AutoReplyManager();
    await mgr.load();
    return mgr;
}

export function createSimpleRule(id: string, trigger: string, response: string): AutoReplyRule {
    return { id, name: id, enabled: true, trigger: { type: "contains", pattern: trigger }, response };
}
