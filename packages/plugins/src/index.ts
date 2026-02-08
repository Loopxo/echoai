/**
 * EchoAI Plugins - Plugin SDK and Management
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const PLUGINS_DIR = path.join(STATE_DIR, "plugins");

export interface PluginManifest {
    name: string;
    version: string;
    description?: string;
    author?: string;
    main: string;
    permissions?: string[];
    dependencies?: Record<string, string>;
}

export interface PluginContext {
    pluginId: string;
    dataDir: string;
    log: (message: string) => void;
    registerTool: (tool: PluginTool) => void;
    registerCommand: (command: PluginCommand) => void;
}

export interface PluginTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: unknown) => Promise<unknown>;
}

export interface PluginCommand {
    name: string;
    description: string;
    execute: (args: string[]) => Promise<string>;
}

export interface Plugin {
    manifest: PluginManifest;
    activate: (context: PluginContext) => Promise<void>;
    deactivate?: () => Promise<void>;
}

export interface LoadedPlugin {
    id: string;
    manifest: PluginManifest;
    instance: Plugin;
    enabled: boolean;
    tools: PluginTool[];
    commands: PluginCommand[];
}

export class PluginManager extends EventEmitter {
    private plugins: Map<string, LoadedPlugin> = new Map();

    async loadPlugin(pluginPath: string): Promise<LoadedPlugin> {
        const manifestPath = path.join(pluginPath, "manifest.json");
        const manifestData = await fs.readFile(manifestPath, "utf8");
        const manifest = JSON.parse(manifestData) as PluginManifest;

        const mainPath = path.join(pluginPath, manifest.main);
        const module = await import(mainPath);
        const instance = module.default as Plugin;
        instance.manifest = manifest;

        const id = manifest.name;
        const tools: PluginTool[] = [];
        const commands: PluginCommand[] = [];

        const context: PluginContext = {
            pluginId: id,
            dataDir: path.join(PLUGINS_DIR, id, "data"),
            log: (msg) => console.log(`[${id}] ${msg}`),
            registerTool: (tool) => tools.push(tool),
            registerCommand: (cmd) => commands.push(cmd),
        };

        await fs.mkdir(context.dataDir, { recursive: true });
        await instance.activate(context);

        const loaded: LoadedPlugin = { id, manifest, instance, enabled: true, tools, commands };
        this.plugins.set(id, loaded);
        this.emit("loaded", loaded);
        return loaded;
    }

    async unloadPlugin(id: string): Promise<boolean> {
        const plugin = this.plugins.get(id);
        if (!plugin) return false;
        await plugin.instance.deactivate?.();
        this.plugins.delete(id);
        this.emit("unloaded", id);
        return true;
    }

    async loadFromDirectory(dir?: string): Promise<void> {
        const pluginsDir = dir || PLUGINS_DIR;
        try {
            const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    try {
                        await this.loadPlugin(path.join(pluginsDir, entry.name));
                    } catch (err) {
                        console.error(`Failed to load plugin ${entry.name}:`, err);
                    }
                }
            }
        } catch { /* No plugins directory */ }
    }

    getPlugin(id: string): LoadedPlugin | undefined { return this.plugins.get(id); }
    listPlugins(): LoadedPlugin[] { return [...this.plugins.values()]; }
    getAllTools(): PluginTool[] { return this.listPlugins().flatMap(p => p.tools); }
    getAllCommands(): PluginCommand[] { return this.listPlugins().flatMap(p => p.commands); }
}

export function createPluginManager(): PluginManager { return new PluginManager(); }

export function createPluginTemplate(name: string): PluginManifest {
    return { name, version: "1.0.0", main: "index.js", description: `${name} plugin` };
}
