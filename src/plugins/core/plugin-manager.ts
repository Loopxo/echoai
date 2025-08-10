import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author: string;
    license?: string;
    homepage?: string;
    repository?: string;
    keywords?: string[];
    
    // Echo-specific metadata
    echoVersion: string;
    category: 'agent' | 'provider' | 'tool' | 'theme' | 'integration' | 'utility';
    capabilities: PluginCapability[];
    permissions: PluginPermission[];
    dependencies: Record<string, string>;
    peerDependencies?: Record<string, string>;
    
    // Entry points
    main: string;
    types?: string;
    activation: PluginActivation;
    
    // Configuration
    configuration?: PluginConfiguration;
    contributes?: PluginContributions;
    
    // Lifecycle
    engines: {
        echo: string;
        node: string;
    };
}

export interface PluginCapability {
    type: 'command' | 'agent' | 'provider' | 'language' | 'debugger' | 'formatter' | 'linter';
    identifier: string;
    title: string;
    description?: string;
}

export type PluginPermission = 
    | 'file:read' | 'file:write' | 'file:execute'
    | 'network:http' | 'network:ws' | 'network:tcp'
    | 'system:process' | 'system:env'
    | 'ai:generate' | 'ai:analyze'
    | 'workspace:read' | 'workspace:write'
    | 'ide:commands' | 'ide:ui';

export interface PluginActivation {
    events: PluginActivationEvent[];
    languages?: string[];
    filenamePatterns?: string[];
}

export type PluginActivationEvent = 
    | 'onStartup' | 'onWorkspaceOpen' | 'onFileOpen'
    | 'onCommand' | 'onLanguage' | 'onDebug'
    | 'onAiRequest' | 'onUserRequest';

export interface PluginConfiguration {
    title: string;
    properties: Record<string, PluginConfigProperty>;
}

export interface PluginConfigProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    default?: any;
    enum?: any[];
    minimum?: number;
    maximum?: number;
    pattern?: string;
}

export interface PluginContributions {
    commands?: PluginCommand[];
    agents?: PluginAgent[];
    providers?: PluginProvider[];
    themes?: PluginTheme[];
    languages?: PluginLanguageContribution[];
    debuggers?: PluginDebugger[];
}

export interface PluginCommand {
    command: string;
    title: string;
    category?: string;
    description?: string;
    icon?: string;
    when?: string;
}

export interface PluginAgent {
    id: string;
    name: string;
    description: string;
    intents: string[];
    capabilities: string[];
    priority: number;
}

export interface PluginProvider {
    id: string;
    name: string;
    description: string;
    apiType: 'openai' | 'anthropic' | 'custom';
    models: string[];
}

export interface PluginTheme {
    id: string;
    name: string;
    description: string;
    type: 'light' | 'dark' | 'high-contrast';
}

export interface PluginLanguageContribution {
    id: string;
    aliases: string[];
    extensions: string[];
    configuration?: string;
    grammar?: string;
}

export interface PluginDebugger {
    type: string;
    label: string;
    languages: string[];
    configurationAttributes?: Record<string, any>;
}

export interface LoadedPlugin {
    manifest: PluginManifest;
    instance: any;
    context: PluginContext;
    status: PluginStatus;
    loadTime: Date;
    activationEvents: Set<PluginActivationEvent>;
}

export type PluginStatus = 'loaded' | 'activated' | 'deactivated' | 'error';

export interface PluginContext {
    pluginPath: string;
    globalStoragePath: string;
    workspaceStoragePath?: string;
    extensionMode: 'production' | 'development';
    globalState: PluginStorage;
    workspaceState: PluginStorage;
    secrets: PluginSecrets;
    logger: PluginLogger;
}

export interface PluginStorage {
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: any): Promise<void>;
    keys(): readonly string[];
}

export interface PluginSecrets {
    get(key: string): Promise<string | undefined>;
    store(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

export interface PluginLogger {
    trace(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}

export interface PluginAPI {
    // Core Echo API
    echo: {
        version: string;
        platform: string;
        config: any;
    };
    
    // Agent system
    agents: {
        register(agent: PluginAgent): void;
        unregister(agentId: string): void;
        list(): PluginAgent[];
    };
    
    // Provider system
    providers: {
        register(provider: PluginProvider): void;
        unregister(providerId: string): void;
        list(): PluginProvider[];
    };
    
    // Command system
    commands: {
        register(command: string, handler: (...args: any[]) => any): void;
        unregister(command: string): void;
        execute(command: string, ...args: any[]): Promise<any>;
    };
    
    // File system
    fs: {
        read(path: string): Promise<string>;
        write(path: string, content: string): Promise<void>;
        exists(path: string): Promise<boolean>;
        list(path: string): Promise<string[]>;
    };
    
    // Workspace
    workspace: {
        root: string | undefined;
        files: string[];
        getConfiguration(section?: string): any;
    };
    
    // Events
    events: {
        on(event: string, listener: (...args: any[]) => void): void;
        off(event: string, listener: (...args: any[]) => void): void;
        emit(event: string, ...args: any[]): void;
    };
    
    // UI (when available)
    ui?: {
        showMessage(message: string, type?: 'info' | 'warning' | 'error'): void;
        showProgress(title: string, task: (progress: any) => Promise<any>): Promise<any>;
        createStatusBarItem(): any;
    };
}

export class AdvancedPluginManager extends EventEmitter {
    private plugins = new Map<string, LoadedPlugin>();
    private pluginDirectories: string[] = [];
    private api: PluginAPI;
    private securityManager: PluginSecurityManager;
    
    constructor(
        private config: any,
        private workspaceRoot?: string
    ) {
        super();
        this.securityManager = new PluginSecurityManager();
        this.initializeAPI();
        this.initializePluginDirectories();
    }

    private initializeAPI(): void {
        this.api = {
            echo: {
                version: this.config.version || '1.0.0',
                platform: process.platform,
                config: this.config
            },
            
            agents: {
                register: (agent: PluginAgent) => {
                    this.emit('agent:register', agent);
                },
                unregister: (agentId: string) => {
                    this.emit('agent:unregister', agentId);
                },
                list: () => {
                    const agents: PluginAgent[] = [];
                    for (const plugin of this.plugins.values()) {
                        if (plugin.manifest.contributes?.agents) {
                            agents.push(...plugin.manifest.contributes.agents);
                        }
                    }
                    return agents;
                }
            },
            
            providers: {
                register: (provider: PluginProvider) => {
                    this.emit('provider:register', provider);
                },
                unregister: (providerId: string) => {
                    this.emit('provider:unregister', providerId);
                },
                list: () => {
                    const providers: PluginProvider[] = [];
                    for (const plugin of this.plugins.values()) {
                        if (plugin.manifest.contributes?.providers) {
                            providers.push(...plugin.manifest.contributes.providers);
                        }
                    }
                    return providers;
                }
            },
            
            commands: {
                register: (command: string, handler: (...args: any[]) => any) => {
                    this.emit('command:register', { command, handler });
                },
                unregister: (command: string) => {
                    this.emit('command:unregister', command);
                },
                execute: async (command: string, ...args: any[]) => {
                    return new Promise((resolve, reject) => {
                        this.emit('command:execute', { command, args, resolve, reject });
                    });
                }
            },
            
            fs: {
                read: async (filePath: string) => {
                    if (!this.securityManager.canAccessFile(filePath, 'read')) {
                        throw new Error(`Access denied: ${filePath}`);
                    }
                    return await fs.readFile(filePath, 'utf-8');
                },
                write: async (filePath: string, content: string) => {
                    if (!this.securityManager.canAccessFile(filePath, 'write')) {
                        throw new Error(`Access denied: ${filePath}`);
                    }
                    await fs.writeFile(filePath, content);
                },
                exists: async (filePath: string) => {
                    if (!this.securityManager.canAccessFile(filePath, 'read')) {
                        return false;
                    }
                    try {
                        await fs.access(filePath);
                        return true;
                    } catch {
                        return false;
                    }
                },
                list: async (dirPath: string) => {
                    if (!this.securityManager.canAccessFile(dirPath, 'read')) {
                        throw new Error(`Access denied: ${dirPath}`);
                    }
                    const entries = await fs.readdir(dirPath);
                    return entries;
                }
            },
            
            workspace: {
                root: this.workspaceRoot,
                files: [], // Would be populated with workspace files
                getConfiguration: (section?: string) => {
                    return this.config[section as keyof typeof this.config] || this.config;
                }
            },
            
            events: {
                on: (event: string, listener: (...args: any[]) => void) => {
                    this.on(event, listener);
                },
                off: (event: string, listener: (...args: any[]) => void) => {
                    this.off(event, listener);
                },
                emit: (event: string, ...args: any[]) => {
                    this.emit(event, ...args);
                }
            }
        };
    }

    private async initializePluginDirectories(): Promise<void> {
        const defaultDirs = [
            path.join(process.cwd(), 'plugins'),
            path.join(process.cwd(), 'node_modules', '@echo-plugins'),
            path.join(require.resolve('echo-ai'), '..', 'plugins')
        ];

        // Add user-specific plugin directory
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        if (homeDir) {
            defaultDirs.push(path.join(homeDir, '.echo', 'plugins'));
        }

        for (const dir of defaultDirs) {
            try {
                await fs.access(dir);
                this.pluginDirectories.push(dir);
            } catch {
                // Directory doesn't exist, skip
            }
        }
    }

    async discoverPlugins(): Promise<string[]> {
        const discovered: string[] = [];
        
        for (const directory of this.pluginDirectories) {
            try {
                const entries = await fs.readdir(directory);
                
                for (const entry of entries) {
                    const pluginPath = path.join(directory, entry);
                    const stat = await fs.stat(pluginPath);
                    
                    if (stat.isDirectory()) {
                        const manifestPath = path.join(pluginPath, 'package.json');
                        try {
                            await fs.access(manifestPath);
                            discovered.push(pluginPath);
                        } catch {
                            // No package.json, skip
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to scan plugin directory ${directory}:`, error);
            }
        }
        
        return discovered;
    }

    async loadPlugin(pluginPath: string): Promise<LoadedPlugin> {
        try {
            // Load and validate manifest
            const manifestPath = path.join(pluginPath, 'package.json');
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent) as PluginManifest;
            
            // Validate manifest
            this.validateManifest(manifest);
            
            // Check if plugin is already loaded
            if (this.plugins.has(manifest.name)) {
                throw new Error(`Plugin ${manifest.name} is already loaded`);
            }
            
            // Security check
            await this.securityManager.validatePlugin(manifest, pluginPath);
            
            // Create plugin context
            const context = await this.createPluginContext(manifest, pluginPath);
            
            // Load the plugin module
            const mainPath = path.resolve(pluginPath, manifest.main);
            delete require.cache[mainPath]; // Clear cache
            const PluginClass = require(mainPath);
            
            // Instantiate plugin
            let instance;
            if (typeof PluginClass === 'function') {
                instance = new PluginClass(context, this.api);
            } else if (typeof PluginClass.activate === 'function') {
                instance = PluginClass;
            } else {
                throw new Error(`Invalid plugin entry point in ${manifest.name}`);
            }
            
            const loadedPlugin: LoadedPlugin = {
                manifest,
                instance,
                context,
                status: 'loaded',
                loadTime: new Date(),
                activationEvents: new Set(manifest.activation.events)
            };
            
            this.plugins.set(manifest.name, loadedPlugin);
            this.emit('plugin:loaded', loadedPlugin);
            
            return loadedPlugin;
            
        } catch (error) {
            throw new Error(`Failed to load plugin from ${pluginPath}: ${error}`);
        }
    }

    async unloadPlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin ${pluginName} is not loaded`);
        }
        
        try {
            // Deactivate if activated
            if (plugin.status === 'activated') {
                await this.deactivatePlugin(pluginName);
            }
            
            // Call plugin's dispose method if available
            if (typeof plugin.instance.dispose === 'function') {
                await plugin.instance.dispose();
            }
            
            // Remove from registry
            this.plugins.delete(pluginName);
            this.emit('plugin:unloaded', plugin);
            
        } catch (error) {
            throw new Error(`Failed to unload plugin ${pluginName}: ${error}`);
        }
    }

    async activatePlugin(pluginName: string, event?: PluginActivationEvent): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin ${pluginName} is not loaded`);
        }
        
        if (plugin.status === 'activated') {
            return; // Already activated
        }
        
        try {
            // Check activation event
            if (event && !plugin.activationEvents.has(event)) {
                return; // Plugin should not activate for this event
            }
            
            // Activate plugin
            if (typeof plugin.instance.activate === 'function') {
                await plugin.instance.activate(plugin.context, this.api);
            }
            
            plugin.status = 'activated';
            this.emit('plugin:activated', plugin);
            
        } catch (error) {
            plugin.status = 'error';
            throw new Error(`Failed to activate plugin ${pluginName}: ${error}`);
        }
    }

    async deactivatePlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin ${pluginName} is not loaded`);
        }
        
        if (plugin.status !== 'activated') {
            return; // Not activated
        }
        
        try {
            // Deactivate plugin
            if (typeof plugin.instance.deactivate === 'function') {
                await plugin.instance.deactivate();
            }
            
            plugin.status = 'deactivated';
            this.emit('plugin:deactivated', plugin);
            
        } catch (error) {
            plugin.status = 'error';
            throw new Error(`Failed to deactivate plugin ${pluginName}: ${error}`);
        }
    }

    async activatePluginsForEvent(event: PluginActivationEvent): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const [pluginName, plugin] of this.plugins) {
            if (plugin.activationEvents.has(event) && plugin.status === 'loaded') {
                promises.push(this.activatePlugin(pluginName, event));
            }
        }
        
        await Promise.allSettled(promises);
    }

    private validateManifest(manifest: any): asserts manifest is PluginManifest {
        const requiredFields = ['name', 'version', 'description', 'main', 'echoVersion', 'category'];
        
        for (const field of requiredFields) {
            if (!manifest[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (!['agent', 'provider', 'tool', 'theme', 'integration', 'utility'].includes(manifest.category)) {
            throw new Error(`Invalid category: ${manifest.category}`);
        }
        
        if (!manifest.activation || !Array.isArray(manifest.activation.events)) {
            throw new Error('Invalid activation configuration');
        }
    }

    private async createPluginContext(manifest: PluginManifest, pluginPath: string): Promise<PluginContext> {
        const pluginDataDir = path.join(pluginPath, '.data');
        await fs.mkdir(pluginDataDir, { recursive: true });
        
        const globalStoragePath = path.join(pluginDataDir, 'global.json');
        const workspaceStoragePath = this.workspaceRoot ? 
            path.join(pluginDataDir, 'workspace.json') : undefined;
        
        return {
            pluginPath,
            globalStoragePath,
            workspaceStoragePath,
            extensionMode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
            globalState: new PluginStorageImpl(globalStoragePath),
            workspaceState: new PluginStorageImpl(workspaceStoragePath),
            secrets: new PluginSecretsImpl(path.join(pluginDataDir, 'secrets.enc')),
            logger: new PluginLoggerImpl(manifest.name)
        };
    }

    // Public API methods
    listPlugins(): LoadedPlugin[] {
        return Array.from(this.plugins.values());
    }

    getPlugin(name: string): LoadedPlugin | undefined {
        return this.plugins.get(name);
    }

    isPluginLoaded(name: string): boolean {
        return this.plugins.has(name);
    }

    getPluginsByCategory(category: PluginManifest['category']): LoadedPlugin[] {
        return Array.from(this.plugins.values()).filter(p => p.manifest.category === category);
    }

    async installPlugin(source: string): Promise<void> {
        // Implementation for installing plugins from various sources
        // (npm registry, git repos, local paths, etc.)
        throw new Error('Plugin installation not implemented yet');
    }

    async uninstallPlugin(name: string): Promise<void> {
        await this.unloadPlugin(name);
        // Additional cleanup (remove files, etc.)
    }

    async updatePlugin(name: string): Promise<void> {
        // Implementation for updating plugins
        throw new Error('Plugin updates not implemented yet');
    }
}

// Helper implementations
class PluginStorageImpl implements PluginStorage {
    private data: Record<string, any> = {};
    private loaded = false;

    constructor(private filePath?: string) {}

    private async ensureLoaded(): Promise<void> {
        if (this.loaded || !this.filePath) return;
        
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            this.data = JSON.parse(content);
        } catch {
            this.data = {};
        }
        this.loaded = true;
    }

    private async save(): Promise<void> {
        if (!this.filePath) return;
        await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
    }

    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.data[key] !== undefined ? this.data[key] : defaultValue;
    }

    async update(key: string, value: any): Promise<void> {
        await this.ensureLoaded();
        this.data[key] = value;
        await this.save();
    }

    keys(): readonly string[] {
        return Object.keys(this.data);
    }
}

class PluginSecretsImpl implements PluginSecrets {
    constructor(private filePath: string) {}

    async get(key: string): Promise<string | undefined> {
        // Implementation would use proper encryption
        return undefined;
    }

    async store(key: string, value: string): Promise<void> {
        // Implementation would use proper encryption
    }

    async delete(key: string): Promise<void> {
        // Implementation would use proper encryption
    }
}

class PluginLoggerImpl implements PluginLogger {
    constructor(private pluginName: string) {}

    trace(message: string, ...args: any[]): void {
        console.trace(`[${this.pluginName}]`, message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        console.debug(`[${this.pluginName}]`, message, ...args);
    }

    info(message: string, ...args: any[]): void {
        console.info(`[${this.pluginName}]`, message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        console.warn(`[${this.pluginName}]`, message, ...args);
    }

    error(message: string, ...args: any[]): void {
        console.error(`[${this.pluginName}]`, message, ...args);
    }
}

class PluginSecurityManager {
    async validatePlugin(manifest: PluginManifest, pluginPath: string): Promise<void> {
        // Implementation would include:
        // - Code signing verification
        // - Permission validation
        // - Malware scanning
        // - Dependency analysis
        
        // For now, basic validation
        if (manifest.permissions?.includes('system:process' as PluginPermission)) {
            console.warn(`Plugin ${manifest.name} requests dangerous system:process permission`);
        }
    }

    canAccessFile(filePath: string, operation: 'read' | 'write'): boolean {
        // Implementation would check:
        // - Plugin permissions
        // - File path restrictions
        // - Security policies
        
        // For now, allow access to workspace and plugin directories
        return true;
    }
}