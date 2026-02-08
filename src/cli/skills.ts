/**
 * Skills CLI Command
 *
 * Manages EchoAI skills for agent customization.
 */

import { Command } from 'commander';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export const skillsCommand = new Command('skills')
    .description('⚡ Manage agent skills')
    .addCommand(
        new Command('list')
            .description('List loaded skills')
            .action(async () => {
                try {
                    const { SkillsRegistry } = await import('@echoai/skills');

                    const registry = new SkillsRegistry();
                    registry.loadDefaults();

                    const skills = registry.getAll();

                    if (skills.length === 0) {
                        console.log('\nNo skills loaded.');
                        console.log('\nSkill locations:');
                        console.log(`  User:      ~/.echoai/skills/`);
                        console.log(`  Workspace: .agent/skills/`);
                    } else {
                        console.log(`\n⚡ Loaded ${skills.length} skills:\n`);

                        for (const skill of skills) {
                            console.log(`  ${skill.name.padEnd(20)} - ${skill.description}`);
                            if (skill.frontmatter.tags?.length) {
                                console.log(`                         Tags: ${skill.frontmatter.tags.join(', ')}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ Failed to list skills:', error);
                }
            })
    )
    .addCommand(
        new Command('create')
            .description('Create a new skill')
            .argument('<name>', 'Name of the skill')
            .option('-d, --description <desc>', 'Skill description')
            .option('-g, --global', 'Create in user directory instead of workspace')
            .action(async (name, options) => {
                const skillsDir = options.global
                    ? path.join(os.homedir(), '.echoai', 'skills')
                    : path.join(process.cwd(), '.agent', 'skills');

                // Ensure directory exists
                if (!fs.existsSync(skillsDir)) {
                    fs.mkdirSync(skillsDir, { recursive: true });
                }

                const filename = `${name.toLowerCase().replace(/\s+/g, '-')}.md`;
                const filePath = path.join(skillsDir, filename);

                if (fs.existsSync(filePath)) {
                    console.log(`❌ Skill already exists: ${filePath}`);
                    return;
                }

                const content = `---
name: ${name}
description: ${options.description || 'A custom skill'}
version: 1.0.0
tags: []
intents:
  - ${name.toLowerCase()}
tools: []
priority: 0
---

## Instructions

Add your skill instructions here. These will be added to the agent's
system prompt when this skill is activated.

## Guidelines

- Be specific about what the agent should do
- List any constraints or requirements
- Include example outputs if helpful
`;

                fs.writeFileSync(filePath, content, 'utf-8');
                console.log(`✅ Created skill: ${filePath}`);
                console.log('\nEdit the file to customize your skill.');
            })
    )
    .addCommand(
        new Command('show')
            .description('Show skill details')
            .argument('<name>', 'Skill name to show')
            .action(async (name) => {
                try {
                    const { SkillsRegistry } = await import('@echoai/skills');

                    const registry = new SkillsRegistry();
                    registry.loadDefaults();

                    const skills = registry.find(name);

                    if (skills.length === 0) {
                        console.log(`❌ No skill found matching: ${name}`);
                        return;
                    }

                    const skill = skills[0];
                    console.log(`\n⚡ ${skill.name}\n`);
                    console.log(`Description: ${skill.description}`);
                    console.log(`Source:      ${skill.source}`);
                    console.log(`Priority:    ${skill.priority}`);

                    if (skill.intents?.length) {
                        console.log(`Intents:     ${skill.intents.join(', ')}`);
                    }
                    if (skill.tools?.length) {
                        console.log(`Tools:       ${skill.tools.join(', ')}`);
                    }

                    console.log('\n--- Instructions ---\n');
                    console.log(skill.instructions);
                } catch (error) {
                    console.error('❌ Failed to show skill:', error);
                }
            })
    );

export default skillsCommand;
