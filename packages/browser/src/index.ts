/**
 * EchoAI Browser Control
 *
 * Browser automation via Playwright and Chrome DevTools Protocol:
 * - Page navigation and interaction
 * - Screenshots and visual snapshots
 * - Form filling and clicks
 * - DOM inspection
 * - Network interception
 * - Multi-tab management
 */

import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// =============================================================================
// Types
// =============================================================================

export interface BrowserConfig {
    /** Browser executable path */
    executablePath?: string;
    /** Run headless */
    headless?: boolean;
    /** User data directory */
    userDataDir?: string;
    /** Viewport width */
    viewportWidth?: number;
    /** Viewport height */
    viewportHeight?: number;
    /** Default timeout in ms */
    timeout?: number;
    /** Enable devtools */
    devtools?: boolean;
    /** Additional Chrome args */
    args?: string[];
}

export interface PageInfo {
    targetId: string;
    url: string;
    title: string;
    type: "page" | "background_page" | "service_worker" | "other";
}

export interface ScreenshotOptions {
    fullPage?: boolean;
    format?: "png" | "jpeg" | "webp";
    quality?: number;
    path?: string;
    selector?: string;
}

export interface ClickOptions {
    button?: "left" | "right" | "middle";
    clickCount?: number;
    delay?: number;
    modifiers?: Array<"Alt" | "Control" | "Meta" | "Shift">;
}

export interface TypeOptions {
    delay?: number;
    clear?: boolean;
}

export interface WaitOptions {
    timeout?: number;
    state?: "attached" | "detached" | "visible" | "hidden";
}

export interface ElementInfo {
    tagName: string;
    id?: string;
    className?: string;
    textContent?: string;
    attributes: Record<string, string>;
    rect: { x: number; y: number; width: number; height: number };
    isVisible: boolean;
}

export interface DOMSnapshot {
    title: string;
    url: string;
    elements: ElementInfo[];
    forms: FormInfo[];
    links: LinkInfo[];
}

export interface FormInfo {
    action: string;
    method: string;
    inputs: Array<{
        name: string;
        type: string;
        value?: string;
        placeholder?: string;
    }>;
}

export interface LinkInfo {
    href: string;
    text: string;
}

export interface CdpSession {
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
    on(event: string, handler: (params: unknown) => void): void;
    off(event: string, handler: (params: unknown) => void): void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_TIMEOUT = 30000;

// =============================================================================
// Chrome Path Detection
// =============================================================================

function findChromeExecutable(): string | undefined {
    const platform = os.platform();

    const paths: string[] = [];

    if (platform === "darwin") {
        paths.push(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        );
    } else if (platform === "win32") {
        paths.push(
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
        );
    } else {
        paths.push(
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
        );
    }

    for (const p of paths) {
        try {
            require("node:fs").accessSync(p);
            return p;
        } catch {
            // Continue
        }
    }

    return undefined;
}

// =============================================================================
// CDP Connection
// =============================================================================

export class CdpConnection extends EventEmitter {
    private ws: WebSocket | null = null;
    private nextId = 1;
    private pending = new Map<number, { resolve: Function; reject: Function }>();
    private sessionId?: string;

    constructor(private wsUrl: string) {
        super();
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => resolve();
            this.ws.onerror = (err) => reject(new Error(`CDP connection error: ${err}`));
            this.ws.onclose = () => this.emit("close");

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data.toString()) as Record<string, unknown>;

                if (data.id !== undefined) {
                    const pending = this.pending.get(data.id as number);
                    if (pending) {
                        this.pending.delete(data.id as number);
                        if (data.error) {
                            pending.reject(new Error((data.error as Record<string, string>).message));
                        } else {
                            pending.resolve(data.result);
                        }
                    }
                } else if (data.method) {
                    this.emit(data.method as string, data.params);
                }
            };
        });
    }

    async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
        if (!this.ws) throw new Error("Not connected");

        const id = this.nextId++;

        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });

            const message: Record<string, unknown> = { id, method, params };
            if (this.sessionId) {
                message.sessionId = this.sessionId;
            }

            this.ws!.send(JSON.stringify(message));

            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`CDP timeout: ${method}`));
                }
            }, 30000);
        });
    }

    setSession(sessionId: string): void {
        this.sessionId = sessionId;
    }

    close(): void {
        this.ws?.close();
        this.ws = null;
    }
}

// =============================================================================
// Browser Session
// =============================================================================

export class BrowserSession extends EventEmitter {
    private config: Required<BrowserConfig>;
    private process: ChildProcess | null = null;
    private cdp: CdpConnection | null = null;
    private targets: Map<string, PageInfo> = new Map();
    private activeTargetId?: string;

    constructor(config: BrowserConfig = {}) {
        super();
        this.config = {
            executablePath: config.executablePath || findChromeExecutable() || "google-chrome",
            headless: config.headless ?? true,
            userDataDir: config.userDataDir || "",
            viewportWidth: config.viewportWidth || DEFAULT_VIEWPORT.width,
            viewportHeight: config.viewportHeight || DEFAULT_VIEWPORT.height,
            timeout: config.timeout || DEFAULT_TIMEOUT,
            devtools: config.devtools ?? false,
            args: config.args || [],
        };
    }

    async launch(): Promise<void> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "echoai-browser-"));
        const userDataDir = this.config.userDataDir || tempDir;

        const args = [
            `--remote-debugging-port=0`,
            `--user-data-dir=${userDataDir}`,
            `--window-size=${this.config.viewportWidth},${this.config.viewportHeight}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-sync",
            ...this.config.args,
        ];

        if (this.config.headless) {
            args.push("--headless=new");
        }

        if (this.config.devtools) {
            args.push("--auto-open-devtools-for-tabs");
        }

        this.process = spawn(this.config.executablePath, args, {
            stdio: ["pipe", "pipe", "pipe"],
        });

        // Wait for DevTools URL
        const wsUrl = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Browser launch timeout")), 30000);

            this.process!.stderr?.on("data", (data) => {
                const text = data.toString();
                const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
                if (match) {
                    clearTimeout(timeout);
                    resolve(match[1]);
                }
            });

            this.process!.on("error", (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        // Connect CDP
        this.cdp = new CdpConnection(wsUrl);
        await this.cdp.connect();

        // Enable required domains
        await this.cdp.send("Target.setDiscoverTargets", { discover: true });

        this.cdp.on("Target.targetCreated", (params: unknown) => {
            const info = (params as Record<string, unknown>).targetInfo as Record<string, string>;
            this.targets.set(info.targetId, {
                targetId: info.targetId,
                url: info.url,
                title: info.title || "",
                type: info.type as PageInfo["type"],
            });
        });

        this.cdp.on("Target.targetDestroyed", (params: unknown) => {
            const targetId = (params as Record<string, string>).targetId;
            this.targets.delete(targetId);
        });
    }

    async close(): Promise<void> {
        this.cdp?.close();
        this.process?.kill();
        this.cdp = null;
        this.process = null;
    }

    async newPage(url?: string): Promise<string> {
        if (!this.cdp) throw new Error("Browser not launched");

        const result = await this.cdp.send("Target.createTarget", {
            url: url || "about:blank",
        }) as { targetId: string };

        this.activeTargetId = result.targetId;

        // Attach to target
        const session = await this.cdp.send("Target.attachToTarget", {
            targetId: result.targetId,
            flatten: true,
        }) as { sessionId: string };

        this.cdp.setSession(session.sessionId);

        // Enable page domains
        await this.cdp.send("Page.enable");
        await this.cdp.send("DOM.enable");
        await this.cdp.send("Runtime.enable");

        return result.targetId;
    }

    async navigate(url: string): Promise<void> {
        if (!this.cdp) throw new Error("Browser not launched");
        await this.cdp.send("Page.navigate", { url });
        await this.waitForLoad();
    }

    async waitForLoad(): Promise<void> {
        const cdp = this.cdp;
        if (!cdp) return;

        return new Promise((resolve) => {
            const handler = () => {
                cdp.off("Page.loadEventFired", handler);
                resolve();
            };
            cdp.on("Page.loadEventFired", handler);

            // Timeout fallback
            setTimeout(resolve, this.config.timeout);
        });
    }

    async screenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
        if (!this.cdp) throw new Error("Browser not launched");

        const result = await this.cdp.send("Page.captureScreenshot", {
            format: options.format || "png",
            quality: options.quality,
            captureBeyondViewport: options.fullPage,
        }) as { data: string };

        const buffer = Buffer.from(result.data, "base64");

        if (options.path) {
            await fs.writeFile(options.path, buffer);
        }

        return buffer;
    }

    async click(selector: string, options: ClickOptions = {}): Promise<void> {
        if (!this.cdp) throw new Error("Browser not launched");

        const nodeId = await this.resolveSelector(selector);
        const box = await this.getElementBox(nodeId);

        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        await this.cdp.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x,
            y,
            button: options.button || "left",
            clickCount: options.clickCount || 1,
        });

        await this.cdp.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x,
            y,
            button: options.button || "left",
            clickCount: options.clickCount || 1,
        });
    }

    async type(selector: string, text: string, options: TypeOptions = {}): Promise<void> {
        if (!this.cdp) throw new Error("Browser not launched");

        await this.click(selector);

        if (options.clear) {
            await this.cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", modifiers: 2 });
            await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a" });
        }

        for (const char of text) {
            await this.cdp.send("Input.dispatchKeyEvent", {
                type: "char",
                text: char,
            });

            if (options.delay) {
                await new Promise(r => setTimeout(r, options.delay));
            }
        }
    }

    async evaluate<T>(expression: string): Promise<T> {
        if (!this.cdp) throw new Error("Browser not launched");

        const result = await this.cdp.send("Runtime.evaluate", {
            expression,
            returnByValue: true,
        }) as { result: { value: T } };

        return result.result.value;
    }

    async getPageContent(): Promise<string> {
        return this.evaluate<string>("document.documentElement.outerHTML");
    }

    async getTitle(): Promise<string> {
        return this.evaluate<string>("document.title");
    }

    async getUrl(): Promise<string> {
        return this.evaluate<string>("window.location.href");
    }

    async getDOMSnapshot(): Promise<DOMSnapshot> {
        if (!this.cdp) throw new Error("Browser not launched");

        const title = await this.getTitle();
        const url = await this.getUrl();

        // Get links
        const links = await this.evaluate<LinkInfo[]>(`
            Array.from(document.querySelectorAll('a[href]'))
                .slice(0, 100)
                .map(a => ({
                    href: a.href,
                    text: a.textContent?.trim().slice(0, 100) || ''
                }))
        `);

        // Get forms
        const forms = await this.evaluate<FormInfo[]>(`
            Array.from(document.querySelectorAll('form'))
                .slice(0, 20)
                .map(form => ({
                    action: form.action,
                    method: form.method || 'GET',
                    inputs: Array.from(form.querySelectorAll('input, textarea, select'))
                        .slice(0, 20)
                        .map(el => ({
                            name: el.name || '',
                            type: el.type || 'text',
                            value: el.value || '',
                            placeholder: el.placeholder || ''
                        }))
                }))
        `);

        // Get visible elements
        const elements = await this.evaluate<ElementInfo[]>(`
            Array.from(document.querySelectorAll('button, input, a, [role="button"]'))
                .slice(0, 50)
                .map(el => {
                    const rect = el.getBoundingClientRect();
                    return {
                        tagName: el.tagName.toLowerCase(),
                        id: el.id || undefined,
                        className: el.className || undefined,
                        textContent: el.textContent?.trim().slice(0, 100) || undefined,
                        attributes: Object.fromEntries(
                            Array.from(el.attributes).map(a => [a.name, a.value])
                        ),
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        isVisible: rect.width > 0 && rect.height > 0
                    };
                })
        `);

        return { title, url, elements, forms, links };
    }

    async waitForSelector(selector: string, options: WaitOptions = {}): Promise<void> {
        const timeout = options.timeout || this.config.timeout;
        const start = Date.now();

        while (Date.now() - start < timeout) {
            try {
                await this.resolveSelector(selector);
                return;
            } catch {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        throw new Error(`Timeout waiting for selector: ${selector}`);
    }

    getPages(): PageInfo[] {
        return Array.from(this.targets.values()).filter(t => t.type === "page");
    }

    private async resolveSelector(selector: string): Promise<number> {
        if (!this.cdp) throw new Error("Browser not launched");

        const doc = await this.cdp.send("DOM.getDocument") as { root: { nodeId: number } };
        const result = await this.cdp.send("DOM.querySelector", {
            nodeId: doc.root.nodeId,
            selector,
        }) as { nodeId: number };

        if (!result.nodeId) {
            throw new Error(`Element not found: ${selector}`);
        }

        return result.nodeId;
    }

    private async getElementBox(nodeId: number): Promise<{ x: number; y: number; width: number; height: number }> {
        if (!this.cdp) throw new Error("Browser not launched");

        const result = await this.cdp.send("DOM.getBoxModel", { nodeId }) as {
            model: { content: number[] }
        };

        const quad = result.model.content;
        return {
            x: quad[0],
            y: quad[1],
            width: quad[2] - quad[0],
            height: quad[5] - quad[1],
        };
    }
}

// =============================================================================
// High-Level Browser Tools
// =============================================================================

export class BrowserTools {
    private session: BrowserSession | null = null;

    async ensureSession(config?: BrowserConfig): Promise<BrowserSession> {
        if (!this.session) {
            this.session = new BrowserSession(config);
            await this.session.launch();
            await this.session.newPage();
        }
        return this.session;
    }

    async navigate(url: string): Promise<{ title: string; url: string }> {
        const session = await this.ensureSession();
        await session.navigate(url);
        return {
            title: await session.getTitle(),
            url: await session.getUrl(),
        };
    }

    async click(selector: string): Promise<{ success: boolean }> {
        const session = await this.ensureSession();
        await session.click(selector);
        return { success: true };
    }

    async type(selector: string, text: string): Promise<{ success: boolean }> {
        const session = await this.ensureSession();
        await session.type(selector, text);
        return { success: true };
    }

    async screenshot(options?: ScreenshotOptions): Promise<{ data: string }> {
        const session = await this.ensureSession();
        const buffer = await session.screenshot(options);
        return { data: buffer.toString("base64") };
    }

    async getSnapshot(): Promise<DOMSnapshot> {
        const session = await this.ensureSession();
        return session.getDOMSnapshot();
    }

    async evaluate(code: string): Promise<unknown> {
        const session = await this.ensureSession();
        return session.evaluate(code);
    }

    async close(): Promise<void> {
        await this.session?.close();
        this.session = null;
    }
}

// =============================================================================
// Exports
// =============================================================================

export function createBrowserSession(config?: BrowserConfig): BrowserSession {
    return new BrowserSession(config);
}

export function createBrowserTools(): BrowserTools {
    return new BrowserTools();
}

export { DEFAULT_VIEWPORT, DEFAULT_TIMEOUT };
