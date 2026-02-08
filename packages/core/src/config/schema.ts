/**
 * EchoAI Configuration Schema
 *
 * A unified, Zod-based configuration system for the entire platform.
 * Supports agents, channels, tools, memory, and more.
 */

import { z } from "zod";

// =============================================================================
// Model Configuration
// =============================================================================

export const ModelConfigSchema = z.object({
    primary: z.string().describe("Primary model ID (e.g., 'claude-3-opus')"),
    fallbacks: z.array(z.string()).optional().describe("Ordered fallback models"),
});

export const ProviderConfigSchema = z.object({
    id: z.string(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    headers: z.record(z.string()).optional(),
});

// =============================================================================
// Agent Configuration
// =============================================================================

export const AgentIdentitySchema = z.object({
    name: z.string().optional().describe("Display name for the agent"),
    avatar: z.string().optional().describe("Avatar image path or URL"),
    prefix: z.string().optional().describe("Message prefix for this agent"),
});

export const AgentConfigSchema = z.object({
    id: z.string().describe("Unique agent identifier"),
    name: z.string().optional(),
    default: z.boolean().optional().describe("Is this the default agent?"),
    workspace: z.string().optional().describe("Agent workspace directory"),
    model: z.union([z.string(), ModelConfigSchema]).optional(),
    identity: AgentIdentitySchema.optional(),
    skills: z.array(z.string()).optional().describe("Allowed skills for this agent"),
    tools: z
        .object({
            profile: z.enum(["default", "elevated", "minimal"]).optional(),
            allow: z.array(z.string()).optional(),
            deny: z.array(z.string()).optional(),
        })
        .optional(),
});

export const AgentsConfigSchema = z.object({
    defaults: z
        .object({
            workspace: z.string().optional(),
            model: z.union([z.string(), ModelConfigSchema]).optional(),
            bootstrapMaxChars: z.number().optional(),
        })
        .optional(),
    list: z.array(AgentConfigSchema).optional(),
});

// =============================================================================
// Channel Configuration
// =============================================================================

export const DmPolicySchema = z.enum(["pairing", "allowFrom", "open"]);

export const ChannelBaseConfigSchema = z.object({
    enabled: z.boolean().optional(),
    dmPolicy: DmPolicySchema.optional(),
    allowFrom: z.array(z.string()).optional(),
});

export const WhatsAppConfigSchema = ChannelBaseConfigSchema.extend({
    selfChatMode: z.boolean().optional(),
    debounceMs: z.number().optional(),
});

export const TelegramConfigSchema = ChannelBaseConfigSchema.extend({
    botToken: z.string().optional(),
    streamMode: z.enum(["off", "partial", "block"]).optional(),
});

export const DiscordConfigSchema = ChannelBaseConfigSchema.extend({
    token: z.string().optional(),
    applicationId: z.string().optional(),
});

export const SlackConfigSchema = ChannelBaseConfigSchema.extend({
    botToken: z.string().optional(),
    appToken: z.string().optional(),
});

export const ChannelsConfigSchema = z.object({
    whatsapp: WhatsAppConfigSchema.optional(),
    telegram: TelegramConfigSchema.optional(),
    discord: DiscordConfigSchema.optional(),
    slack: SlackConfigSchema.optional(),
});

// =============================================================================
// Gateway Configuration
// =============================================================================

export const GatewayAuthConfigSchema = z.object({
    token: z.string().optional().describe("Authentication token for gateway access"),
    password: z.string().optional().describe("Password for remote access"),
});

export const GatewayConfigSchema = z.object({
    port: z.number().default(18789),
    bind: z.enum(["loopback", "lan", "tailnet", "auto"]).optional(),
    auth: GatewayAuthConfigSchema.optional(),
    controlUi: z
        .object({
            enabled: z.boolean().optional(),
            basePath: z.string().optional(),
        })
        .optional(),
    tls: z
        .object({
            enabled: z.boolean().optional(),
            certPath: z.string().optional(),
            keyPath: z.string().optional(),
        })
        .optional(),
});

// =============================================================================
// Memory / RAG Configuration
// =============================================================================

export const MemorySearchConfigSchema = z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(["openai", "gemini", "voyage", "local"]).optional(),
    model: z.string().optional(),
    sources: z.array(z.enum(["memory", "sessions"])).optional(),
    extraPaths: z.array(z.string()).optional(),
    store: z
        .object({
            path: z.string().optional(),
            vector: z
                .object({
                    enabled: z.boolean().optional(),
                    extensionPath: z.string().optional(),
                })
                .optional(),
        })
        .optional(),
});

// =============================================================================
// Tools Configuration
// =============================================================================

export const ToolsConfigSchema = z.object({
    profile: z.enum(["default", "elevated", "minimal"]).optional(),
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    exec: z
        .object({
            host: z.enum(["local", "sandbox", "node"]).optional(),
            pathPrepend: z.array(z.string()).optional(),
            safeBins: z.array(z.string()).optional(),
        })
        .optional(),
    web: z
        .object({
            search: z
                .object({
                    enabled: z.boolean().optional(),
                    provider: z.enum(["brave", "perplexity"]).optional(),
                    apiKey: z.string().optional(),
                })
                .optional(),
            fetch: z
                .object({
                    enabled: z.boolean().optional(),
                    maxChars: z.number().optional(),
                })
                .optional(),
        })
        .optional(),
});

// =============================================================================
// MCP Configuration
// =============================================================================

export const McpServerConfigSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    transport: z.enum(["stdio", "http"]),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    enabled: z.boolean().optional(),
});

export const McpConfigSchema = z.object({
    servers: z.array(McpServerConfigSchema).optional(),
});

// =============================================================================
// Root Configuration
// =============================================================================

export const EchoAIConfigSchema = z.object({
    $schema: z.string().optional(),
    meta: z
        .object({
            version: z.string().optional(),
            lastModified: z.string().optional(),
        })
        .optional(),
    gateway: GatewayConfigSchema.optional(),
    agents: AgentsConfigSchema.optional(),
    channels: ChannelsConfigSchema.optional(),
    tools: ToolsConfigSchema.optional(),
    memory: MemorySearchConfigSchema.optional(),
    mcp: McpConfigSchema.optional(),
    providers: z.array(ProviderConfigSchema).optional(),
});

export type EchoAIConfig = z.infer<typeof EchoAIConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type MemorySearchConfig = z.infer<typeof MemorySearchConfigSchema>;
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;
