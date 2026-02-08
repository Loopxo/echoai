/**
 * EchoAI Testing
 *
 * Comprehensive testing utilities and shared test helpers:
 * - Mock factories for channels, agents, and services
 * - Test harness for integration testing
 * - Assertion helpers
 * - Environment setup/teardown
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// =============================================================================
// Types
// =============================================================================

export interface MockMessage {
    id: string;
    text: string;
    senderId: string;
    channelId: string;
    timestamp: number;
    isGroup: boolean;
    groupId?: string;
    replyToId?: string;
    attachments?: MockAttachment[];
}

export interface MockAttachment {
    type: "image" | "audio" | "video" | "file";
    url: string;
    mimeType: string;
    size: number;
    name: string;
}

export interface MockChannel {
    id: string;
    name: string;
    type: "dm" | "group" | "channel";
    members: string[];
    messages: MockMessage[];
    sendMessage: (text: string) => MockMessage;
    getMessages: () => MockMessage[];
    clear: () => void;
}

export interface MockUser {
    id: string;
    name: string;
    email?: string;
    isBot: boolean;
}

export interface TestContext {
    tempDir: string;
    stateDir: string;
    cleanup: () => Promise<void>;
}

export interface MockGatewayClient {
    connected: boolean;
    messages: Array<{ method: string; params: unknown }>;
    send: (method: string, params?: unknown) => Promise<unknown>;
    subscribe: (event: string, handler: (data: unknown) => void) => void;
    disconnect: () => void;
}

// =============================================================================
// Temporary Directory Management
// =============================================================================

let tempDirs: string[] = [];

export async function createTempDir(prefix = "echoai-test"): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `${prefix}-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    tempDirs.push(tempDir);
    return tempDir;
}

export async function cleanupTempDirs(): Promise<void> {
    for (const dir of tempDirs) {
        try {
            await fs.rm(dir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
    tempDirs = [];
}

// =============================================================================
// Test Context
// =============================================================================

export async function createTestContext(): Promise<TestContext> {
    const tempDir = await createTempDir();
    const stateDir = path.join(tempDir, ".echoai");
    await fs.mkdir(stateDir, { recursive: true });

    // Create minimal state structure
    await fs.mkdir(path.join(stateDir, "settings"), { recursive: true });
    await fs.mkdir(path.join(stateDir, "sessions"), { recursive: true });
    await fs.mkdir(path.join(stateDir, "memory"), { recursive: true });

    return {
        tempDir,
        stateDir,
        cleanup: async () => {
            await fs.rm(tempDir, { recursive: true, force: true });
        },
    };
}

// =============================================================================
// Mock Factories
// =============================================================================

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
        id: randomUUID(),
        name: `User ${Math.random().toString(36).slice(2, 8)}`,
        isBot: false,
        ...overrides,
    };
}

export function createMockMessage(overrides: Partial<MockMessage> = {}): MockMessage {
    return {
        id: randomUUID(),
        text: "Hello, world!",
        senderId: randomUUID(),
        channelId: randomUUID(),
        timestamp: Date.now(),
        isGroup: false,
        ...overrides,
    };
}

export function createMockChannel(overrides: Partial<Omit<MockChannel, "sendMessage" | "getMessages" | "clear">> = {}): MockChannel {
    const messages: MockMessage[] = [];
    const channelId = overrides.id || randomUUID();

    return {
        id: channelId,
        name: `channel-${channelId.slice(0, 8)}`,
        type: "dm",
        members: [],
        messages,
        sendMessage: (text: string) => {
            const msg = createMockMessage({
                text,
                channelId,
                timestamp: Date.now(),
            });
            messages.push(msg);
            return msg;
        },
        getMessages: () => [...messages],
        clear: () => {
            messages.length = 0;
        },
        ...overrides,
    };
}

export function createMockGatewayClient(): MockGatewayClient {
    const handlers: Record<string, Array<(data: unknown) => void>> = {};
    const messages: Array<{ method: string; params: unknown }> = [];

    return {
        connected: true,
        messages,
        send: async (method: string, params?: unknown) => {
            messages.push({ method, params });
            return { ok: true };
        },
        subscribe: (event: string, handler: (data: unknown) => void) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        },
        disconnect: () => {
            // No-op for mock
        },
    };
}

// =============================================================================
// Environment Mocking
// =============================================================================

export function mockEnv(overrides: Record<string, string | undefined>): () => void {
    const original: Record<string, string | undefined> = {};

    for (const key of Object.keys(overrides)) {
        original[key] = process.env[key];
        if (overrides[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = overrides[key];
        }
    }

    return () => {
        for (const key of Object.keys(original)) {
            if (original[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = original[key];
            }
        }
    };
}

// =============================================================================
// Assertion Helpers
// =============================================================================

export function assertMessage(
    msg: unknown,
    expected: Partial<MockMessage>
): asserts msg is MockMessage {
    if (!msg || typeof msg !== "object") {
        throw new Error("Expected message to be an object");
    }

    const m = msg as Record<string, unknown>;

    if (expected.id !== undefined && m.id !== expected.id) {
        throw new Error(`Expected message id ${expected.id}, got ${m.id}`);
    }
    if (expected.text !== undefined && m.text !== expected.text) {
        throw new Error(`Expected message text "${expected.text}", got "${m.text}"`);
    }
    if (expected.senderId !== undefined && m.senderId !== expected.senderId) {
        throw new Error(`Expected senderId ${expected.senderId}, got ${m.senderId}`);
    }
}

export function assertContains(text: string, substring: string): void {
    if (!text.includes(substring)) {
        throw new Error(`Expected "${text}" to contain "${substring}"`);
    }
}

export function assertMatches(text: string, pattern: RegExp): void {
    if (!pattern.test(text)) {
        throw new Error(`Expected "${text}" to match ${pattern}`);
    }
}

export function assertThrows(fn: () => unknown, expectedMessage?: string | RegExp): void {
    try {
        fn();
        throw new Error("Expected function to throw");
    } catch (err) {
        if (expectedMessage) {
            const msg = err instanceof Error ? err.message : String(err);
            if (typeof expectedMessage === "string") {
                if (!msg.includes(expectedMessage)) {
                    throw new Error(`Expected error message to contain "${expectedMessage}", got "${msg}"`);
                }
            } else {
                if (!expectedMessage.test(msg)) {
                    throw new Error(`Expected error message to match ${expectedMessage}, got "${msg}"`);
                }
            }
        }
    }
}

export async function assertRejects(
    fn: () => Promise<unknown>,
    expectedMessage?: string | RegExp
): Promise<void> {
    try {
        await fn();
        throw new Error("Expected promise to reject");
    } catch (err) {
        if (expectedMessage) {
            const msg = err instanceof Error ? err.message : String(err);
            if (typeof expectedMessage === "string") {
                if (!msg.includes(expectedMessage)) {
                    throw new Error(`Expected error message to contain "${expectedMessage}", got "${msg}"`);
                }
            } else {
                if (!expectedMessage.test(msg)) {
                    throw new Error(`Expected error message to match ${expectedMessage}, got "${msg}"`);
                }
            }
        }
    }
}

// =============================================================================
// Timing Utilities
// =============================================================================

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    timeoutMs = 5000,
    intervalMs = 50
): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        if (await condition()) return;
        await delay(intervalMs);
    }

    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delayMs = 100
): Promise<T> {
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (i < maxRetries - 1) {
                await delay(delayMs * (i + 1));
            }
        }
    }

    throw lastError;
}

// =============================================================================
// Integration Test Harness
// =============================================================================

export interface TestSuite {
    name: string;
    tests: Array<{
        name: string;
        fn: () => Promise<void> | void;
    }>;
    beforeAll?: () => Promise<void> | void;
    afterAll?: () => Promise<void> | void;
    beforeEach?: () => Promise<void> | void;
    afterEach?: () => Promise<void> | void;
}

export interface TestResult {
    suite: string;
    test: string;
    passed: boolean;
    duration: number;
    error?: string;
}

export async function runTestSuite(suite: TestSuite): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
        await suite.beforeAll?.();
    } catch (err) {
        console.error(`[${suite.name}] beforeAll failed:`, err);
        return results;
    }

    for (const test of suite.tests) {
        const start = Date.now();
        let passed = false;
        let error: string | undefined;

        try {
            await suite.beforeEach?.();
            await test.fn();
            passed = true;
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        } finally {
            try {
                await suite.afterEach?.();
            } catch {
                // Ignore afterEach errors
            }
        }

        results.push({
            suite: suite.name,
            test: test.name,
            passed,
            duration: Date.now() - start,
            error,
        });
    }

    try {
        await suite.afterAll?.();
    } catch (err) {
        console.error(`[${suite.name}] afterAll failed:`, err);
    }

    return results;
}

export function formatTestResults(results: TestResult[]): string {
    const lines: string[] = [];
    let passed = 0;
    let failed = 0;

    for (const result of results) {
        const icon = result.passed ? "✓" : "✗";
        const status = result.passed ? "PASS" : "FAIL";
        lines.push(`  ${icon} [${status}] ${result.suite} > ${result.test} (${result.duration}ms)`);
        if (result.error) {
            lines.push(`      Error: ${result.error}`);
        }
        if (result.passed) passed++;
        else failed++;
    }

    lines.unshift("");
    lines.unshift(`Test Results: ${passed} passed, ${failed} failed, ${results.length} total`);
    lines.unshift("═══════════════════════════════════════════════════════════");
    lines.push("═══════════════════════════════════════════════════════════");

    return lines.join("\n");
}

// =============================================================================
// Exports
// =============================================================================

export { randomUUID };
