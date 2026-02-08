/**
 * EchoAI Commands
 *
 * Slash command routing and execution system:
 * - Command registration and discovery
 * - Argument parsing
 * - Permission checking
 * - Command aliases
 * - Help generation
 */

// =============================================================================
// Types
// =============================================================================

export interface CommandArgument {
    name: string;
    description: string;
    type: "string" | "number" | "boolean" | "user" | "channel";
    required?: boolean;
    default?: unknown;
    choices?: Array<{ name: string; value: string | number }>;
}

export interface CommandContext {
    senderId: string;
    channelId: string;
    sessionId: string;
    isGroup: boolean;
    rawText: string;
    args: Record<string, unknown>;
    reply: (text: string) => Promise<void>;
}

export interface CommandResult {
    success: boolean;
    message?: string;
    data?: unknown;
    ephemeral?: boolean;
}

export interface Command {
    name: string;
    description: string;
    aliases?: string[];
    arguments?: CommandArgument[];
    permissions?: string[];
    hidden?: boolean;
    execute: (context: CommandContext) => Promise<CommandResult>;
}

export interface CommandMatch {
    command: Command;
    name: string;
    args: Record<string, unknown>;
    rawArgs: string;
}

// =============================================================================
// Argument Parser
// =============================================================================

export function parseArguments(
    raw: string,
    definitions: CommandArgument[]
): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    const tokens = tokenize(raw);

    let positionalIndex = 0;
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];

        // Named argument: --name=value or --name value
        if (token.startsWith("--")) {
            const eqIndex = token.indexOf("=");
            let name: string;
            let value: string;

            if (eqIndex > 0) {
                name = token.slice(2, eqIndex);
                value = token.slice(eqIndex + 1);
            } else {
                name = token.slice(2);
                value = tokens[++i] || "";
            }

            const def = definitions.find(d => d.name === name);
            if (def) {
                args[name] = coerceValue(value, def.type);
            }
            i++;
            continue;
        }

        // Short flag: -n value
        if (token.startsWith("-") && token.length === 2) {
            const name = token.slice(1);
            const value = tokens[++i] || "";
            const def = definitions.find(d => d.name.startsWith(name));
            if (def) {
                args[def.name] = coerceValue(value, def.type);
            }
            i++;
            continue;
        }

        // Positional argument
        if (positionalIndex < definitions.length) {
            const def = definitions[positionalIndex];
            args[def.name] = coerceValue(token, def.type);
            positionalIndex++;
        }
        i++;
    }

    // Apply defaults
    for (const def of definitions) {
        if (args[def.name] === undefined && def.default !== undefined) {
            args[def.name] = def.default;
        }
    }

    return args;
}

function tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuote = false;
    let quoteChar = "";

    for (const char of input) {
        if (inQuote) {
            if (char === quoteChar) {
                inQuote = false;
                tokens.push(current);
                current = "";
            } else {
                current += char;
            }
        } else if (char === '"' || char === "'") {
            inQuote = true;
            quoteChar = char;
        } else if (char === " " || char === "\t") {
            if (current) {
                tokens.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }

    if (current) {
        tokens.push(current);
    }

    return tokens;
}

function coerceValue(value: string, type: CommandArgument["type"]): unknown {
    switch (type) {
        case "number":
            return parseFloat(value) || 0;
        case "boolean":
            return value === "true" || value === "1" || value === "yes";
        default:
            return value;
    }
}

// =============================================================================
// Command Registry
// =============================================================================

export class CommandRegistry {
    private commands: Map<string, Command> = new Map();
    private aliases: Map<string, string> = new Map();

    register(command: Command): void {
        this.commands.set(command.name, command);

        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias, command.name);
            }
        }
    }

    unregister(name: string): void {
        const command = this.commands.get(name);
        if (command?.aliases) {
            for (const alias of command.aliases) {
                this.aliases.delete(alias);
            }
        }
        this.commands.delete(name);
    }

    get(name: string): Command | undefined {
        const primaryName = this.aliases.get(name) || name;
        return this.commands.get(primaryName);
    }

    list(includeHidden = false): Command[] {
        return Array.from(this.commands.values()).filter(
            c => includeHidden || !c.hidden
        );
    }

    match(text: string): CommandMatch | null {
        // Check for command prefix
        if (!text.startsWith("/")) {
            return null;
        }

        const withoutPrefix = text.slice(1);
        const spaceIndex = withoutPrefix.indexOf(" ");
        const commandName = spaceIndex > 0 ? withoutPrefix.slice(0, spaceIndex) : withoutPrefix;
        const rawArgs = spaceIndex > 0 ? withoutPrefix.slice(spaceIndex + 1).trim() : "";

        const command = this.get(commandName);
        if (!command) {
            return null;
        }

        const args = parseArguments(rawArgs, command.arguments || []);

        return {
            command,
            name: commandName,
            args,
            rawArgs,
        };
    }

    generateHelp(commandName?: string): string {
        if (commandName) {
            const command = this.get(commandName);
            if (!command) {
                return `Unknown command: ${commandName}`;
            }

            const lines = [
                `**/${command.name}**`,
                command.description,
            ];

            if (command.aliases?.length) {
                lines.push(`Aliases: ${command.aliases.map(a => `/${a}`).join(", ")}`);
            }

            if (command.arguments?.length) {
                lines.push("", "Arguments:");
                for (const arg of command.arguments) {
                    const required = arg.required ? "(required)" : "(optional)";
                    lines.push(`  --${arg.name} ${required}: ${arg.description}`);
                }
            }

            return lines.join("\n");
        }

        // List all commands
        const lines = ["**Available Commands:**", ""];

        for (const command of this.list()) {
            lines.push(`/${command.name} - ${command.description}`);
        }

        lines.push("", "Use /help <command> for details.");
        return lines.join("\n");
    }
}

// =============================================================================
// Command Router
// =============================================================================

export class CommandRouter {
    private registry: CommandRegistry;
    private permissionChecker?: (userId: string, permissions: string[]) => Promise<boolean>;

    constructor(registry?: CommandRegistry) {
        this.registry = registry || new CommandRegistry();
    }

    setPermissionChecker(checker: (userId: string, permissions: string[]) => Promise<boolean>): void {
        this.permissionChecker = checker;
    }

    getRegistry(): CommandRegistry {
        return this.registry;
    }

    async execute(context: CommandContext): Promise<CommandResult | null> {
        const match = this.registry.match(context.rawText);
        if (!match) {
            return null;
        }

        // Check permissions
        if (match.command.permissions?.length && this.permissionChecker) {
            const allowed = await this.permissionChecker(
                context.senderId,
                match.command.permissions
            );
            if (!allowed) {
                return {
                    success: false,
                    message: "You don't have permission to use this command.",
                    ephemeral: true,
                };
            }
        }

        // Validate required arguments
        for (const arg of match.command.arguments || []) {
            if (arg.required && match.args[arg.name] === undefined) {
                return {
                    success: false,
                    message: `Missing required argument: ${arg.name}`,
                    ephemeral: true,
                };
            }
        }

        // Execute command
        context.args = match.args;
        return match.command.execute(context);
    }
}

// =============================================================================
// Built-in Commands
// =============================================================================

export const helpCommand: Command = {
    name: "help",
    description: "Show available commands",
    aliases: ["?", "commands"],
    arguments: [
        {
            name: "command",
            description: "Command to get help for",
            type: "string",
            required: false,
        },
    ],
    execute: async (context) => {
        // This will be overridden with registry access
        return {
            success: true,
            message: "Use /help to see available commands.",
        };
    },
};

export const pingCommand: Command = {
    name: "ping",
    description: "Check if the bot is responsive",
    execute: async () => ({
        success: true,
        message: "🏓 Pong!",
    }),
};

export const versionCommand: Command = {
    name: "version",
    description: "Show bot version",
    aliases: ["v"],
    execute: async () => ({
        success: true,
        message: "EchoAI v1.0.0",
    }),
};

// =============================================================================
// Exports
// =============================================================================

export function createCommandRegistry(): CommandRegistry {
    const registry = new CommandRegistry();
    registry.register(pingCommand);
    registry.register(versionCommand);
    return registry;
}

export function createCommandRouter(registry?: CommandRegistry): CommandRouter {
    return new CommandRouter(registry || createCommandRegistry());
}
