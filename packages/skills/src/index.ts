/**
 * Skills Engine for EchoAI
 *
 * Skills are markdown files that extend agent capabilities with
 * specific instructions, prompts, and allowed tools.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { generateId } from "@echoai/core";

// =============================================================================
// Types
// =============================================================================

export interface SkillFrontmatter {
    name?: string;
    description: string;
    version?: string;
    author?: string;
    tags?: string[];
    tools?: string[];
    intents?: string[];
    priority?: number;
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    instructions: string;
    source: string;
    frontmatter: SkillFrontmatter;
    tools?: string[];
    intents?: string[];
    priority: number;
}

export interface SkillMatch {
    skill: Skill;
    score: number;
    matchedIntent?: string;
}

// =============================================================================
// Skill Parser
// =============================================================================

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/**
 * Parse a skill file content into a Skill object.
 */
export function parseSkill(content: string, source: string): Skill | null {
    const match = content.match(FRONTMATTER_REGEX);

    if (!match) {
        // No frontmatter, treat entire content as instructions
        return {
            id: generateId(),
            name: path.basename(source, ".md"),
            description: "No description provided",
            instructions: content.trim(),
            source,
            frontmatter: { description: "No description provided" },
            priority: 0,
        };
    }

    const [, frontmatterStr, instructions] = match;

    try {
        const frontmatter = yaml.load(frontmatterStr) as SkillFrontmatter;

        if (!frontmatter.description) {
            console.warn(`[skills] Skill ${source} missing required 'description' field`);
        }

        return {
            id: generateId(),
            name: frontmatter.name || path.basename(source, ".md"),
            description: frontmatter.description || "No description provided",
            instructions: instructions.trim(),
            source,
            frontmatter,
            tools: frontmatter.tools,
            intents: frontmatter.intents,
            priority: frontmatter.priority ?? 0,
        };
    } catch (error) {
        console.error(`[skills] Failed to parse frontmatter for ${source}:`, error);
        return null;
    }
}

// =============================================================================
// Skills Registry
// =============================================================================

export class SkillsRegistry {
    private skills = new Map<string, Skill>();
    private watchedDirs = new Set<string>();
    private watchers = new Map<string, fs.FSWatcher>();

    /**
     * Load skills from a directory.
     */
    loadFromDirectory(dirPath: string): number {
        const resolvedPath = dirPath.startsWith("~")
            ? path.join(os.homedir(), dirPath.slice(1))
            : path.resolve(dirPath);

        if (!fs.existsSync(resolvedPath)) {
            return 0;
        }

        let loaded = 0;
        const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile()) continue;
            if (!entry.name.endsWith(".md")) continue;

            const filePath = path.join(resolvedPath, entry.name);
            const content = fs.readFileSync(filePath, "utf-8");
            const skill = parseSkill(content, filePath);

            if (skill) {
                this.skills.set(skill.id, skill);
                loaded++;
            }
        }

        this.watchedDirs.add(resolvedPath);
        return loaded;
    }

    /**
     * Load skills from default locations.
     */
    loadDefaults(): number {
        let total = 0;

        // User skills directory
        const userSkillsDir = path.join(os.homedir(), ".echoai", "skills");
        total += this.loadFromDirectory(userSkillsDir);

        // Workspace skills directory (if in a project)
        const workspaceSkillsDir = path.join(process.cwd(), ".agent", "skills");
        total += this.loadFromDirectory(workspaceSkillsDir);

        return total;
    }

    /**
     * Watch directories for skill changes.
     */
    startWatching(): void {
        for (const dir of this.watchedDirs) {
            if (this.watchers.has(dir)) continue;

            try {
                const watcher = fs.watch(dir, (event, filename) => {
                    if (!filename?.endsWith(".md")) return;

                    const filePath = path.join(dir, filename);

                    if (event === "rename" && !fs.existsSync(filePath)) {
                        // File deleted - remove any skills from this file
                        for (const [id, skill] of this.skills) {
                            if (skill.source === filePath) {
                                this.skills.delete(id);
                                console.log(`[skills] Removed skill: ${skill.name}`);
                            }
                        }
                    } else {
                        // File added or changed
                        try {
                            const content = fs.readFileSync(filePath, "utf-8");
                            const skill = parseSkill(content, filePath);

                            if (skill) {
                                // Remove old version of this skill
                                for (const [id, existing] of this.skills) {
                                    if (existing.source === filePath) {
                                        this.skills.delete(id);
                                    }
                                }

                                this.skills.set(skill.id, skill);
                                console.log(`[skills] Loaded/updated skill: ${skill.name}`);
                            }
                        } catch {
                            // File might not be readable yet
                        }
                    }
                });

                this.watchers.set(dir, watcher);
            } catch (error) {
                console.warn(`[skills] Failed to watch directory ${dir}:`, error);
            }
        }
    }

    /**
     * Stop watching for changes.
     */
    stopWatching(): void {
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
    }

    /**
     * Get all loaded skills.
     */
    getAll(): Skill[] {
        return Array.from(this.skills.values()).sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get a skill by ID.
     */
    get(id: string): Skill | undefined {
        return this.skills.get(id);
    }

    /**
     * Find skills by name or tag.
     */
    find(query: string): Skill[] {
        const lowerQuery = query.toLowerCase();

        return this.getAll().filter((skill) => {
            if (skill.name.toLowerCase().includes(lowerQuery)) return true;
            if (skill.description.toLowerCase().includes(lowerQuery)) return true;
            if (skill.frontmatter.tags?.some((t) => t.toLowerCase().includes(lowerQuery)))
                return true;
            return false;
        });
    }

    /**
     * Match skills based on user intent.
     */
    matchIntent(message: string): SkillMatch[] {
        const lowerMessage = message.toLowerCase();
        const matches: SkillMatch[] = [];

        for (const skill of this.skills.values()) {
            let score = 0;
            let matchedIntent: string | undefined;

            // Check intents
            if (skill.intents) {
                for (const intent of skill.intents) {
                    const lowerIntent = intent.toLowerCase();

                    // Direct match
                    if (lowerMessage.includes(lowerIntent)) {
                        score = Math.max(score, 1.0);
                        matchedIntent = intent;
                    }
                    // Word overlap
                    else {
                        const intentWords = lowerIntent.split(/\s+/);
                        const messageWords = lowerMessage.split(/\s+/);
                        const overlap = intentWords.filter((w) => messageWords.includes(w)).length;

                        if (overlap > 0) {
                            const overlapScore = overlap / intentWords.length;
                            if (overlapScore > score) {
                                score = overlapScore;
                                matchedIntent = intent;
                            }
                        }
                    }
                }
            }

            // Check description keywords
            const descWords = skill.description.toLowerCase().split(/\s+/);
            const messageWords = lowerMessage.split(/\s+/);
            const descOverlap = descWords.filter((w) => messageWords.includes(w)).length;

            if (descOverlap > 0) {
                score = Math.max(score, descOverlap / descWords.length * 0.5);
            }

            if (score > 0) {
                matches.push({ skill, score, matchedIntent });
            }
        }

        return matches
            .sort((a, b) => {
                // Sort by score first, then priority
                if (Math.abs(a.score - b.score) > 0.1) {
                    return b.score - a.score;
                }
                return b.skill.priority - a.skill.priority;
            });
    }

    /**
     * Get the number of loaded skills.
     */
    count(): number {
        return this.skills.size;
    }

    /**
     * Clear all skills.
     */
    clear(): void {
        this.skills.clear();
    }
}

// =============================================================================
// Skill Application
// =============================================================================

/**
 * Apply a skill to a system prompt.
 */
export function applySkillToPrompt(basePrompt: string, skill: Skill): string {
    return `${basePrompt}

## Active Skill: ${skill.name}
${skill.description}

### Instructions
${skill.instructions}`;
}

/**
 * Get tools allowed by a skill.
 */
export function getSkillTools(skill: Skill, allTools: string[]): string[] {
    if (!skill.tools) {
        return allTools;
    }

    const allowed = new Set<string>();

    for (const toolSpec of skill.tools) {
        if (toolSpec === "*") {
            // Allow all tools
            return allTools;
        }

        if (toolSpec.startsWith("!")) {
            // Deny pattern
            const pattern = toolSpec.slice(1);
            for (const tool of allTools) {
                if (!tool.includes(pattern)) {
                    allowed.add(tool);
                }
            }
        } else {
            // Allow pattern
            for (const tool of allTools) {
                if (tool.includes(toolSpec) || tool === toolSpec) {
                    allowed.add(tool);
                }
            }
        }
    }

    return Array.from(allowed);
}

// =============================================================================
// Default Export
// =============================================================================

export function createSkillsRegistry(): SkillsRegistry {
    const registry = new SkillsRegistry();
    registry.loadDefaults();
    return registry;
}

export default SkillsRegistry;
