/**
 * EchoAI Security
 *
 * Comprehensive security audit and hardening utilities:
 * - Configuration auditing
 * - File permission checks
 * - Gateway/channel security analysis
 * - Secret detection
 * - Remediation suggestions
 */

import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

export type SecuritySeverity = "info" | "warn" | "critical";

export interface SecurityFinding {
    /** Unique check identifier */
    checkId: string;
    /** Severity level */
    severity: SecuritySeverity;
    /** Short title */
    title: string;
    /** Detailed explanation */
    detail: string;
    /** How to fix (optional) */
    remediation?: string;
}

export interface SecuritySummary {
    critical: number;
    warn: number;
    info: number;
}

export interface SecurityReport {
    /** Timestamp of audit */
    timestamp: number;
    /** Summary counts */
    summary: SecuritySummary;
    /** All findings */
    findings: SecurityFinding[];
    /** Duration in ms */
    durationMs: number;
}

export interface AuditOptions {
    /** State directory to check */
    stateDir?: string;
    /** Config file path */
    configPath?: string;
    /** Whether to check filesystem permissions */
    checkFilesystem?: boolean;
    /** Whether to check environment variables */
    checkEnvironment?: boolean;
    /** Custom config object to audit */
    config?: Record<string, unknown>;
}

export interface PathPermissions {
    ok: boolean;
    mode?: number;
    isSymlink: boolean;
    worldWritable: boolean;
    worldReadable: boolean;
    groupWritable: boolean;
    groupReadable: boolean;
    owner?: number;
    error?: string;
}

// =============================================================================
// Path Utilities
// =============================================================================

function resolveStateDir(): string {
    return process.env.ECHOAI_STATE_DIR?.trim() ||
        path.join(process.env.HOME || "~", ".echoai");
}

function resolveConfigPath(): string {
    return process.env.ECHOAI_CONFIG?.trim() ||
        path.join(resolveStateDir(), "config.json");
}

// =============================================================================
// Permission Checks
// =============================================================================

async function inspectPathPermissions(targetPath: string): Promise<PathPermissions> {
    try {
        const lstat = await fs.lstat(targetPath);
        const isSymlink = lstat.isSymbolicLink();

        const stat = await fs.stat(targetPath);
        const mode = stat.mode;

        // Unix permission bits
        const worldWritable = (mode & 0o002) !== 0;
        const worldReadable = (mode & 0o004) !== 0;
        const groupWritable = (mode & 0o020) !== 0;
        const groupReadable = (mode & 0o040) !== 0;

        return {
            ok: true,
            mode,
            isSymlink,
            worldWritable,
            worldReadable,
            groupWritable,
            groupReadable,
            owner: stat.uid,
        };
    } catch (err) {
        return {
            ok: false,
            isSymlink: false,
            worldWritable: false,
            worldReadable: false,
            groupWritable: false,
            groupReadable: false,
            error: String(err),
        };
    }
}

function formatPermissionOctal(mode: number): string {
    return `0o${(mode & 0o777).toString(8)}`;
}

// =============================================================================
// Environment Security
// =============================================================================

const SENSITIVE_ENV_PATTERNS = [
    /API_KEY/i,
    /SECRET/i,
    /TOKEN/i,
    /PASSWORD/i,
    /PRIVATE/i,
    /CREDENTIAL/i,
];

function isSensitiveEnvVar(name: string): boolean {
    return SENSITIVE_ENV_PATTERNS.some((pattern) => pattern.test(name));
}

function auditEnvironment(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const env = process.env;

    // Check for exposed sensitive vars
    for (const [key, value] of Object.entries(env)) {
        if (!value) continue;

        if (isSensitiveEnvVar(key)) {
            if (value.length < 16) {
                findings.push({
                    checkId: `env.${key.toLowerCase()}.short`,
                    severity: "warn",
                    title: `${key} looks short`,
                    detail: `Environment variable ${key} has only ${value.length} characters; prefer longer secrets.`,
                });
            }
        }
    }

    // Check for debug mode in production
    if (env.NODE_ENV === "production" && env.DEBUG) {
        findings.push({
            checkId: "env.debug_in_production",
            severity: "warn",
            title: "DEBUG enabled in production",
            detail: "DEBUG environment variable is set while NODE_ENV=production; this may expose sensitive info.",
            remediation: "Unset DEBUG in production environments.",
        });
    }

    return findings;
}

// =============================================================================
// Filesystem Security
// =============================================================================

async function auditFilesystem(opts: AuditOptions): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const stateDir = opts.stateDir ?? resolveStateDir();
    const configPath = opts.configPath ?? resolveConfigPath();

    // Check state directory permissions
    const stateDirPerms = await inspectPathPermissions(stateDir);
    if (stateDirPerms.ok) {
        if (stateDirPerms.isSymlink) {
            findings.push({
                checkId: "fs.state_dir.symlink",
                severity: "warn",
                title: "State directory is a symlink",
                detail: `${stateDir} is a symlink; ensure you trust the target.`,
            });
        }

        if (stateDirPerms.worldWritable) {
            findings.push({
                checkId: "fs.state_dir.world_writable",
                severity: "critical",
                title: "State directory is world-writable",
                detail: `${stateDir} has mode ${formatPermissionOctal(stateDirPerms.mode!)}; anyone can modify your state.`,
                remediation: `chmod 700 "${stateDir}"`,
            });
        } else if (stateDirPerms.groupWritable) {
            findings.push({
                checkId: "fs.state_dir.group_writable",
                severity: "warn",
                title: "State directory is group-writable",
                detail: `${stateDir} has mode ${formatPermissionOctal(stateDirPerms.mode!)}; group members can modify state.`,
                remediation: `chmod 700 "${stateDir}"`,
            });
        }

        if (stateDirPerms.worldReadable) {
            findings.push({
                checkId: "fs.state_dir.world_readable",
                severity: "warn",
                title: "State directory is world-readable",
                detail: `${stateDir} is readable by all users; consider restricting to owner only.`,
                remediation: `chmod 700 "${stateDir}"`,
            });
        }
    }

    // Check config file permissions
    const configPerms = await inspectPathPermissions(configPath);
    if (configPerms.ok) {
        if (configPerms.worldWritable || configPerms.groupWritable) {
            findings.push({
                checkId: "fs.config.writable",
                severity: "critical",
                title: "Config file is writable by others",
                detail: `${configPath} can be modified by other users; this is a security risk.`,
                remediation: `chmod 600 "${configPath}"`,
            });
        }

        if (configPerms.worldReadable) {
            findings.push({
                checkId: "fs.config.world_readable",
                severity: "critical",
                title: "Config file is world-readable",
                detail: `${configPath} contains sensitive settings and may include tokens.`,
                remediation: `chmod 600 "${configPath}"`,
            });
        } else if (configPerms.groupReadable) {
            findings.push({
                checkId: "fs.config.group_readable",
                severity: "warn",
                title: "Config file is group-readable",
                detail: `${configPath} is readable by group; consider restricting to owner.`,
                remediation: `chmod 600 "${configPath}"`,
            });
        }
    }

    return findings;
}

// =============================================================================
// Configuration Security
// =============================================================================

function auditConfig(config: Record<string, unknown>): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Check gateway configuration
    const gateway = config.gateway as Record<string, unknown> | undefined;
    if (gateway) {
        const bind = gateway.bind as string | undefined;
        const auth = gateway.auth as Record<string, unknown> | undefined;

        // Non-loopback binding without auth
        if (bind && bind !== "loopback" && bind !== "127.0.0.1" && bind !== "localhost") {
            const hasToken = auth?.token && String(auth.token).trim().length > 0;
            const hasPassword = auth?.password && String(auth.password).trim().length > 0;

            if (!hasToken && !hasPassword) {
                findings.push({
                    checkId: "gateway.bind_no_auth",
                    severity: "critical",
                    title: "Gateway binds beyond loopback without auth",
                    detail: `gateway.bind="${bind}" but no auth token/password configured.`,
                    remediation: "Set gateway.auth.token or bind to 127.0.0.1.",
                });
            }
        }

        // Short auth token
        if (auth?.token && String(auth.token).trim().length < 24) {
            findings.push({
                checkId: "gateway.token_short",
                severity: "warn",
                title: "Gateway auth token is short",
                detail: `Token length is ${String(auth.token).trim().length}; prefer 32+ character tokens.`,
            });
        }

        // Tailscale funnel warning
        const tailscale = gateway.tailscale as Record<string, unknown> | undefined;
        if (tailscale?.mode === "funnel") {
            findings.push({
                checkId: "gateway.tailscale_funnel",
                severity: "critical",
                title: "Tailscale Funnel exposes gateway publicly",
                detail: "Funnel mode makes your gateway internet-accessible.",
                remediation: "Use mode=\"serve\" for tailnet-only access.",
            });
        }

        // Control UI security
        const controlUi = gateway.controlUi as Record<string, unknown> | undefined;
        if (controlUi?.allowInsecureAuth === true) {
            findings.push({
                checkId: "gateway.control_ui.insecure_auth",
                severity: "critical",
                title: "Control UI allows insecure HTTP auth",
                detail: "This bypasses device identity verification.",
                remediation: "Set allowInsecureAuth=false or use HTTPS.",
            });
        }
    }

    // Check logging configuration
    const logging = config.logging as Record<string, unknown> | undefined;
    if (logging?.redactSensitive === "off") {
        findings.push({
            checkId: "logging.redact_off",
            severity: "warn",
            title: "Sensitive data redaction is disabled",
            detail: "logging.redactSensitive=\"off\" may leak secrets in logs.",
            remediation: "Set logging.redactSensitive=\"tools\".",
        });
    }

    // Check elevated tools configuration
    const tools = config.tools as Record<string, unknown> | undefined;
    const elevated = tools?.elevated as Record<string, unknown> | undefined;
    if (elevated?.enabled !== false) {
        const allowFrom = elevated?.allowFrom as Record<string, unknown> | undefined;
        if (allowFrom) {
            for (const [provider, list] of Object.entries(allowFrom)) {
                if (Array.isArray(list) && list.includes("*")) {
                    findings.push({
                        checkId: `tools.elevated.${provider}.wildcard`,
                        severity: "critical",
                        title: `Elevated access uses wildcard for ${provider}`,
                        detail: `tools.elevated.allowFrom.${provider} includes "*" - anyone can use elevated mode.`,
                        remediation: "Restrict to specific user IDs.",
                    });
                }
            }
        }
    }

    // Check channel defaults
    const channels = config.channels as Record<string, unknown> | undefined;
    const defaults = channels?.defaults as Record<string, unknown> | undefined;
    if (defaults?.groupPolicy === "open") {
        findings.push({
            checkId: "channels.defaults.group_policy_open",
            severity: "warn",
            title: "Default group policy is open",
            detail: "New channels will allow any group by default.",
            remediation: "Set groupPolicy=\"allowlist\" and configure explicitly.",
        });
    }

    return findings;
}

// =============================================================================
// Secret Detection
// =============================================================================

const SECRET_PATTERNS = [
    { name: "AWS Key", pattern: /AKIA[0-9A-Z]{16}/ },
    { name: "AWS Secret", pattern: /[0-9a-zA-Z/+]{40}/ },
    { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
    { name: "Slack Token", pattern: /xox[baprs]-[0-9A-Za-z-]+/ },
    { name: "OpenAI Key", pattern: /sk-[A-Za-z0-9]{48}/ },
    { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
];

function detectSecretsInString(text: string): string[] {
    const detected: string[] = [];
    for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(text)) {
            detected.push(name);
        }
    }
    return detected;
}

function auditSecretsInConfig(config: Record<string, unknown>): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const configStr = JSON.stringify(config);
    const detected = detectSecretsInString(configStr);

    for (const secret of detected) {
        findings.push({
            checkId: `secrets.config.${secret.toLowerCase().replace(/\s+/g, "_")}`,
            severity: "critical",
            title: `Potential ${secret} found in config`,
            detail: "Secrets should use environment variables, not config files.",
            remediation: "Move secrets to environment variables.",
        });
    }

    return findings;
}

// =============================================================================
// Main Audit Function
// =============================================================================

function countBySeverity(findings: SecurityFinding[]): SecuritySummary {
    let critical = 0;
    let warn = 0;
    let info = 0;

    for (const f of findings) {
        if (f.severity === "critical") critical++;
        else if (f.severity === "warn") warn++;
        else info++;
    }

    return { critical, warn, info };
}

export async function runSecurityAudit(opts: AuditOptions = {}): Promise<SecurityReport> {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];

    // Environment checks
    if (opts.checkEnvironment !== false) {
        findings.push(...auditEnvironment());
    }

    // Filesystem checks
    if (opts.checkFilesystem !== false) {
        findings.push(...await auditFilesystem(opts));
    }

    // Config checks
    if (opts.config) {
        findings.push(...auditConfig(opts.config));
        findings.push(...auditSecretsInConfig(opts.config));
    } else {
        // Try to load config from disk
        try {
            const configPath = opts.configPath ?? resolveConfigPath();
            const configData = await fs.readFile(configPath, "utf8");
            const config = JSON.parse(configData) as Record<string, unknown>;
            findings.push(...auditConfig(config));
            findings.push(...auditSecretsInConfig(config));
        } catch {
            // Config file doesn't exist, skip config checks
        }
    }

    // Sort by severity (critical first)
    const severityOrder: Record<SecuritySeverity, number> = {
        critical: 0,
        warn: 1,
        info: 2,
    };
    findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
        timestamp: Date.now(),
        summary: countBySeverity(findings),
        findings,
        durationMs: Date.now() - startTime,
    };
}

// =============================================================================
// Remediation Helpers
// =============================================================================

export async function fixPermissions(targetPath: string, mode: number): Promise<boolean> {
    try {
        await fs.chmod(targetPath, mode);
        return true;
    } catch {
        return false;
    }
}

export async function autoRemediate(findings: SecurityFinding[]): Promise<{
    fixed: string[];
    failed: string[];
}> {
    const fixed: string[] = [];
    const failed: string[] = [];

    for (const finding of findings) {
        if (!finding.remediation) continue;

        // Auto-fix permission issues
        if (finding.checkId.startsWith("fs.") && finding.remediation.startsWith("chmod")) {
            const match = finding.remediation.match(/chmod\s+(\d+)\s+"([^"]+)"/);
            if (match) {
                const [, modeStr, targetPath] = match;
                const mode = parseInt(modeStr, 8);
                const success = await fixPermissions(targetPath, mode);
                if (success) {
                    fixed.push(finding.checkId);
                } else {
                    failed.push(finding.checkId);
                }
            }
        }
    }

    return { fixed, failed };
}

// =============================================================================
// Report Formatting
// =============================================================================

export function formatReportText(report: SecurityReport): string {
    const lines: string[] = [];
    const { summary, findings, durationMs } = report;

    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("                    EchoAI Security Audit                   ");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");

    // Summary
    const total = summary.critical + summary.warn + summary.info;
    lines.push(`Summary: ${total} findings (${durationMs}ms)`);
    if (summary.critical > 0) lines.push(`  ❌ Critical: ${summary.critical}`);
    if (summary.warn > 0) lines.push(`  ⚠️  Warning:  ${summary.warn}`);
    if (summary.info > 0) lines.push(`  ℹ️  Info:     ${summary.info}`);
    lines.push("");

    if (findings.length === 0) {
        lines.push("✅ No security issues found!");
        return lines.join("\n");
    }

    // Findings
    lines.push("───────────────────────────────────────────────────────────");
    lines.push("                         Findings                          ");
    lines.push("───────────────────────────────────────────────────────────");

    for (const finding of findings) {
        const icon =
            finding.severity === "critical" ? "❌" :
                finding.severity === "warn" ? "⚠️" : "ℹ️";

        lines.push("");
        lines.push(`${icon} [${finding.severity.toUpperCase()}] ${finding.title}`);
        lines.push(`   ID: ${finding.checkId}`);
        lines.push(`   ${finding.detail}`);
        if (finding.remediation) {
            lines.push(`   Fix: ${finding.remediation}`);
        }
    }

    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════");

    return lines.join("\n");
}

export function formatReportJSON(report: SecurityReport): string {
    return JSON.stringify(report, null, 2);
}

// =============================================================================
// CLI Command
// =============================================================================

export async function runSecurityAuditCLI(args: string[]): Promise<number> {
    const format = args.includes("--json") ? "json" : "text";
    const fix = args.includes("--fix");

    try {
        const report = await runSecurityAudit({
            checkFilesystem: true,
            checkEnvironment: true,
        });

        if (fix && report.findings.length > 0) {
            const result = await autoRemediate(report.findings);
            console.log(`Auto-remediation: ${result.fixed.length} fixed, ${result.failed.length} failed`);
        }

        if (format === "json") {
            console.log(formatReportJSON(report));
        } else {
            console.log(formatReportText(report));
        }

        // Exit code based on critical findings
        return report.summary.critical > 0 ? 1 : 0;
    } catch (err) {
        console.error("Security audit failed:", err);
        return 2;
    }
}

// =============================================================================
// Exports
// =============================================================================

export {
    inspectPathPermissions,
    resolveStateDir,
    resolveConfigPath,
    detectSecretsInString,
    isSensitiveEnvVar,
};
