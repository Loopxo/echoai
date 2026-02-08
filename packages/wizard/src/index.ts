/**
 * EchoAI Wizard - Setup and Configuration Wizard
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import * as readline from "node:readline";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const CONFIG_FILE = path.join(STATE_DIR, "config.json");

export interface WizardStep {
    id: string;
    title: string;
    description?: string;
    run: (context: WizardContext) => Promise<Record<string, unknown>>;
    validate?: (data: Record<string, unknown>) => Promise<boolean>;
    skip?: (context: WizardContext) => boolean;
}

export interface WizardContext {
    data: Record<string, unknown>;
    config: Record<string, unknown>;
    prompt: (question: string, defaultValue?: string) => Promise<string>;
    confirm: (question: string, defaultYes?: boolean) => Promise<boolean>;
    select: <T>(question: string, options: Array<{ label: string; value: T }>) => Promise<T>;
    log: (message: string) => void;
}

async function promptImpl(question: string, defaultValue?: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(`${question}${defaultValue ? ` [${defaultValue}]` : ""}: `, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || "");
        });
    });
}

async function confirmImpl(question: string, defaultYes = true): Promise<boolean> {
    const answer = await promptImpl(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"}`);
    if (!answer) return defaultYes;
    return answer.toLowerCase().startsWith("y");
}

async function selectImpl<T>(question: string, options: Array<{ label: string; value: T }>): Promise<T> {
    console.log(question);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt.label}`));
    const answer = await promptImpl("Select");
    const idx = parseInt(answer, 10) - 1;
    return options[Math.max(0, Math.min(idx, options.length - 1))].value;
}

export class SetupWizard {
    private steps: WizardStep[] = [];
    private config: Record<string, unknown> = {};

    addStep(step: WizardStep): this {
        this.steps.push(step);
        return this;
    }

    async loadConfig(): Promise<void> {
        try {
            const data = await fs.readFile(CONFIG_FILE, "utf8");
            this.config = JSON.parse(data);
        } catch { /* No existing config */ }
    }

    async saveConfig(): Promise<void> {
        await fs.mkdir(STATE_DIR, { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    }

    async run(): Promise<Record<string, unknown>> {
        await this.loadConfig();
        const context: WizardContext = {
            data: {},
            config: this.config,
            prompt: promptImpl,
            confirm: confirmImpl,
            select: selectImpl,
            log: console.log,
        };

        console.log("\n🚀 EchoAI Setup Wizard\n");

        for (const step of this.steps) {
            if (step.skip?.(context)) continue;

            console.log(`\n📋 ${step.title}`);
            if (step.description) console.log(`   ${step.description}\n`);

            const result = await step.run(context);

            if (step.validate && !(await step.validate(result))) {
                console.log("❌ Validation failed, please try again.");
                continue;
            }

            Object.assign(context.data, result);
            Object.assign(this.config, result);
        }

        await this.saveConfig();
        console.log("\n✅ Setup complete!\n");
        return this.config;
    }
}

export const providerStep: WizardStep = {
    id: "provider",
    title: "Choose AI Provider",
    description: "Select your preferred AI provider",
    run: async (ctx) => {
        const provider = await ctx.select("Which AI provider?", [
            { label: "Anthropic (Claude)", value: "anthropic" },
            { label: "OpenAI (GPT)", value: "openai" },
            { label: "Google (Gemini)", value: "google" },
            { label: "Ollama (Local)", value: "ollama" },
        ]);
        return { provider };
    },
};

export const apiKeyStep: WizardStep = {
    id: "apiKey",
    title: "Configure API Key",
    skip: (ctx) => ctx.data.provider === "ollama",
    run: async (ctx) => {
        const apiKey = await ctx.prompt("Enter your API key");
        return { apiKey };
    },
};

export const channelsStep: WizardStep = {
    id: "channels",
    title: "Select Channels",
    run: async (ctx) => {
        const channels: string[] = [];
        if (await ctx.confirm("Enable Discord?", false)) channels.push("discord");
        if (await ctx.confirm("Enable Slack?", false)) channels.push("slack");
        if (await ctx.confirm("Enable Telegram?", false)) channels.push("telegram");
        return { channels };
    },
};

export function createSetupWizard(): SetupWizard {
    return new SetupWizard()
        .addStep(providerStep)
        .addStep(apiKeyStep)
        .addStep(channelsStep);
}
