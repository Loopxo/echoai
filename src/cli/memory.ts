/**
 * Memory CLI Command
 *
 * Manages the EchoAI memory/RAG system for semantic search.
 */

import { Command } from 'commander';
import path from 'node:path';
import os from 'node:os';

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
        new Command('add')
            .description('Add a memory directly')
            .argument('<content>', 'Content to remember')
            .option('-s, --source <source>', 'Source label', 'user')
            .action(async (content, options) => {
                try {
                    const { MemorySearch } = await import('@echoai/memory');

                    const memory = new MemorySearch();
                    const id = await memory.addMemory(content, options.source);

                    console.log(`✅ Memory added: ${id}`);
                    memory.close();
                } catch (error) {
                    console.error('❌ Failed to add memory:', error);
                    process.exit(1);
                }
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

export default memoryCommand;
