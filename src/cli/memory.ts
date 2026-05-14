/**
 * Memory CLI Command
 *
 * Manages the EchoAI memory/RAG system for semantic search.
 */

import { Command } from 'commander';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

interface ProjectMemoryEntry {
    id: string;
    content: string;
    source: string;
    createdAt: string;
    tags?: string[];
}

export const memoryCommand = new Command('memory')
    .description('🧠 Manage memory and knowledge base')
    .addCommand(
        new Command('index')
            .description('Index files or directories into memory')
            .argument('<path>', 'Path to file or directory to index')
            .option('-s, --source <source>', 'Source label for indexed content')
            .action(async (targetPath, options) => {
                try {
                    const { MemorySearch } = await import('@echoai/memory');

                    const memory = new MemorySearch();
                    const resolvedPath = targetPath.startsWith('~')
                        ? path.join(os.homedir(), targetPath.slice(1))
                        : path.resolve(targetPath);

                    console.log(`📚 Indexing: ${resolvedPath}`);

                    const count = await memory.indexPath(resolvedPath, {
                        source: options.source || resolvedPath,
                    });

                    console.log(`✅ Indexed ${count} chunks`);
                    memory.close();
                } catch (error) {
                    console.error('❌ Indexing failed:', error);
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('search')
            .description('Search memory for relevant information')
            .argument('<query>', 'Search query')
            .option('-l, --limit <limit>', 'Max results', '5')
            .action(async (query, options) => {
                try {
                    const { MemorySearch } = await import('@echoai/memory');

                    const memory = new MemorySearch();
                    const results = await memory.search(query, {
                        limit: parseInt(options.limit, 10),
                        hybridSearch: true,
                    });

                    if (results.length === 0) {
                        console.log('No results found.');
                    } else {
                        console.log(`\n📖 Found ${results.length} results:\n`);

                        for (const result of results) {
                            console.log(`[Score: ${result.score.toFixed(2)}]`);
                            console.log(result.content.slice(0, 300));
                            if (result.content.length > 300) console.log('...');
                            if (result.source) console.log(`Source: ${result.source}`);
                            console.log('---\n');
                        }
                    }

                    memory.close();
                } catch (error) {
                    console.error('❌ Search failed:', error);
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('show')
            .description('Show project memory from .echoai/memory.jsonl')
            .option('-l, --limit <limit>', 'Maximum entries to show', '20')
            .option('--json', 'Print JSON')
            .action(async (options) => {
                const entries = await readProjectMemory(process.cwd());
                const limit = parseInt(options.limit, 10);
                const visible = entries.slice(Math.max(0, entries.length - limit));

                if (options.json) {
                    console.log(JSON.stringify(visible, null, 2));
                    return;
                }

                if (visible.length === 0) {
                    console.log('No project memory entries yet.');
                    return;
                }

                for (const entry of visible) {
                    const tags = entry.tags?.length ? ` [${entry.tags.join(', ')}]` : '';
                    console.log(`${entry.id}  ${entry.createdAt}  ${entry.source}${tags}`);
                    console.log(`  ${entry.content}`);
                    console.log('');
                }
            })
    )
    .addCommand(
        new Command('add')
            .description('Add project memory to .echoai/memory.jsonl')
            .argument('<content>', 'Content to remember')
            .option('-s, --source <source>', 'Source label', 'user')
            .option('-t, --tag <tags...>', 'Optional tags')
            .action(async (content, options) => {
                try {
                    const entry = await addProjectMemory(process.cwd(), content, options.source, options.tag);
                    console.log(`✅ Project memory added: ${entry.id}`);
                } catch (error) {
                    console.error('❌ Failed to add memory:', error);
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('forget')
            .description('Remove a project memory entry by id')
            .argument('<id>', 'Memory id')
            .action(async (id) => {
                const removed = await forgetProjectMemory(process.cwd(), id);
                if (!removed) {
                    console.error(`No project memory entry found for id: ${id}`);
                    process.exit(1);
                }
                console.log(`✅ Removed project memory: ${id}`);
            })
    )
    .addCommand(
        new Command('stats')
            .description('Show memory statistics')
            .action(async () => {
                try {
                    const { MemorySearch } = await import('@echoai/memory');

                    const memory = new MemorySearch();
                    const stats = memory.getStats();

                    console.log('\n📊 Memory Stats:');
                    console.log(`   Documents: ${stats.count}`);

                    memory.close();
                } catch (error) {
                    console.error('❌ Failed to get stats:', error);
                    process.exit(1);
                }
            })
    );

async function addProjectMemory(root: string, content: string, source: string, tags?: string[]): Promise<ProjectMemoryEntry> {
    const filePath = projectMemoryPath(root);
    await mkdir(path.dirname(filePath), { recursive: true });
    const entry: ProjectMemoryEntry = {
        id: createMemoryId(content),
        content,
        source,
        createdAt: new Date().toISOString(),
        tags: tags?.filter(Boolean),
    };
    const existing = await readProjectMemory(root);
    const next = [...existing.filter((item) => item.id !== entry.id), entry];
    await writeFile(filePath, `${next.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
    return entry;
}

async function readProjectMemory(root: string): Promise<ProjectMemoryEntry[]> {
    try {
        const content = await readFile(projectMemoryPath(root), 'utf8');
        return content
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line) as ProjectMemoryEntry);
    } catch {
        return [];
    }
}

async function forgetProjectMemory(root: string, id: string): Promise<boolean> {
    const filePath = projectMemoryPath(root);
    const entries = await readProjectMemory(root);
    const next = entries.filter((entry) => entry.id !== id);
    if (next.length === entries.length) {
        return false;
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, next.length > 0 ? `${next.map((entry) => JSON.stringify(entry)).join('\n')}\n` : '', 'utf8');
    return true;
}

function projectMemoryPath(root: string): string {
    return path.join(root, '.echoai', 'memory.jsonl');
}

function createMemoryId(content: string): string {
    return createHash('sha256')
        .update(content)
        .update(String(Date.now()))
        .digest('hex')
        .slice(0, 12);
}

export default memoryCommand;
