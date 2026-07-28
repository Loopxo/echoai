import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  KernelSession,
  KernelTool,
  KernelToolCall,
  KernelPermissionRuleLayer,
  PermissionDecision,
} from "./types.js";

export type PermissionScope = "read" | "write" | "network" | "process";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface PermissionRule {
  id: string;
  scope: PermissionScope;
  pattern: string;
  decision: Exclude<PermissionDecision, "ask">;
  description: string;
  layer?: KernelPermissionRuleLayer;
}

export interface PermissionProfile {
  read: PermissionDecision;
  write: PermissionDecision;
  network: PermissionDecision;
  process: PermissionDecision;
}

export interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName: string;
  scope: PermissionScope;
  decision: PermissionDecision;
  risk: RiskLevel;
  reason: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionEvaluation {
  request: PermissionRequest;
  finalDecision: PermissionDecision;
  matchedRule?: PermissionRule;
  resolvedBy?: "rule" | "safe_path" | "default";
}

export interface PermissionResolverContext {
  session: KernelSession;
  tool: KernelTool;
  toolCall: KernelToolCall;
  permissionRequest: PermissionRequest;
  workspaceRoot?: string;
  abortSignal?: AbortSignal;
}

export interface PermissionResolverResult {
  decision: "approved" | "denied";
  reason?: string;
  source?: string;
  resolver?: string;
}

export interface PermissionResolver {
  name: string;
  resolve(context: PermissionResolverContext): Promise<PermissionResolverResult | null>;
}

export interface RuntimePermissionOptions {
  profile?: Partial<PermissionProfile>;
  rules?: PermissionRule[];
  layeredRules?: Partial<Record<KernelPermissionRuleLayer, PermissionRule[]>>;
  safeWriteGlobs?: RegExp[];
}

export const DEFAULT_PERMISSION_PROFILE: PermissionProfile = {
  read: "allow",
  write: "ask",
  network: "ask",
  process: "ask",
};

export class RuntimePermissionManager {
  private readonly profile: PermissionProfile;
  private readonly rules: PermissionRule[];
  private readonly safeWriteGlobs: RegExp[];

  constructor(options: RuntimePermissionOptions = {}) {
    this.profile = {
      ...DEFAULT_PERMISSION_PROFILE,
      ...options.profile,
    };
    this.rules = flattenRules(options.rules ?? [], options.layeredRules);
    this.safeWriteGlobs = options.safeWriteGlobs ?? DEFAULT_SAFE_WRITE_GLOBS;
  }

  evaluate(
    tool: KernelTool,
    call: KernelToolCall,
    session: KernelSession,
    workspaceRoot?: string
  ): PermissionEvaluation {
    const request = createPermissionRequest(tool, call, session, workspaceRoot, this.profile);
    const matchingRule = findMatchingRule(this.rules, request);

    // Free-form shell commands always require an explicit approval. A command
    // prefix is not a security boundary: `cat`, `find`, and `rg` can read
    // outside the workspace and shell composition can append arbitrary work.
    // Explicit denies remain absolute, but an allow rule cannot bypass the
    // per-invocation prompt for run_shell.
    if (tool.name === "run_shell") {
      const finalDecision = request.decision === "deny" || matchingRule?.decision === "deny"
        ? "deny"
        : "ask";
      return {
        request: { ...request, decision: finalDecision },
        finalDecision,
        matchedRule: matchingRule,
        resolvedBy: matchingRule?.decision === "deny" ? "rule" : "default",
      };
    }

    // An explicit `deny` from the active profile (for example plan mode's
    // `write: "deny"`) must never be widened by a safe-path heuristic. Only a
    // matching rule — which is an intentional, user-authored statement — can
    // override it. Ordering mirrors deny > ask > allow.
    const safePathDecision =
      request.decision === "deny"
        ? undefined
        : evaluateSafePathApproval(
            request,
            call.input,
            workspaceRoot,
            this.safeWriteGlobs
          );

    const finalDecision = matchingRule?.decision ?? safePathDecision ?? request.decision;
    return {
      request: {
        ...request,
        decision: finalDecision,
      },
      finalDecision,
      matchedRule: matchingRule,
      resolvedBy: matchingRule
        ? "rule"
        : safePathDecision
          ? "safe_path"
          : "default",
    };
  }
}

const RULE_LAYER_PRIORITY: KernelPermissionRuleLayer[] = [
  "policy",
  "flag",
  "local",
  "project",
  "user",
  "safe_path",
];

const DEFAULT_CLASSIFIER_SAFE_COMMANDS: RegExp[] = [
  /^git\s+(status|diff|log|show)(?:\s|$)/i,
  /^npm\s+test(?:\s|$)/i,
  /^pnpm\s+test(?:\s|$)/i,
  /^pnpm\s+exec\s+(tsc|vitest)(?:\s|$)/i,
  /^tsc(?:\s|$)/i,
];

// Documentation-shaped files only. `.json` and `.yaml` are deliberately absent:
// auto-approving them covers package.json `scripts`, tsconfig.json, and
// .github/workflows/*.yml, which turns a "safe" write into arbitrary code
// execution on the next build with no prompt and no approval record.
const DEFAULT_SAFE_WRITE_GLOBS: RegExp[] = [
  /\.md$/i,
  /\.txt$/i,
];

// Second layer, independent of the configurable globs above: these paths are
// never auto-approved, so a custom `safeWriteGlobs` cannot reintroduce the
// build-critical hole either.
const NEVER_AUTO_APPROVED_WRITES: RegExp[] = [
  /(^|[\\/])package\.json$/i,
  /(^|[\\/])package-lock\.json$/i,
  /(^|[\\/])pnpm-lock\.yaml$/i,
  /(^|[\\/])pnpm-workspace\.yaml$/i,
  /(^|[\\/])yarn\.lock$/i,
  /(^|[\\/])tsconfig(\..*)?\.json$/i,
  /(^|[\\/])\.npmrc$/i,
  /(^|[\\/])\.env(\..*)?$/i,
  /[\\/]\.github[\\/]/i,
  /[\\/]\.echoai[\\/]/i,
  /(^|[\\/])ECHOAI\.md$/i,
  /(^|[\\/])Dockerfile$/i,
  /(^|[\\/])docker-compose(\..*)?\.ya?ml$/i,
  /(^|[\\/])Makefile$/i,
  /(^|[\\/])\.git[\\/]/i,
];

export function isNeverAutoApprovedWrite(resolvedPath: string): boolean {
  return NEVER_AUTO_APPROVED_WRITES.some((pattern) => pattern.test(resolvedPath));
}

function flattenRules(
  rules: PermissionRule[],
  layeredRules?: Partial<Record<KernelPermissionRuleLayer, PermissionRule[]>>
): PermissionRule[] {
  const merged = [...rules];
  for (const layer of RULE_LAYER_PRIORITY) {
    for (const rule of layeredRules?.[layer] ?? []) {
      merged.push({
        ...rule,
        layer,
      });
    }
  }

  return merged.sort(
    (left, right) =>
      RULE_LAYER_PRIORITY.indexOf(left.layer ?? "user") -
      RULE_LAYER_PRIORITY.indexOf(right.layer ?? "user")
  );
}

function findMatchingRule(
  rules: PermissionRule[],
  request: PermissionRequest
): PermissionRule | undefined {
  return rules.find((rule) => {
    if (rule.scope !== request.scope) {
      return false;
    }

    const pattern = new RegExp(rule.pattern, "i");
    return pattern.test(request.resource ?? request.reason);
  });
}

function evaluateSafePathApproval(
  request: PermissionRequest,
  _input: Record<string, unknown>,
  workspaceRoot: string | undefined,
  safeWriteGlobs: RegExp[]
): PermissionDecision | undefined {
  if (request.scope === "read" && request.risk === "low") {
    return "allow";
  }

  if (request.scope === "write" && workspaceRoot && request.resource && request.risk === "medium") {
    let resolved: string;
    try {
      resolved = resolvePathWithinWorkspace(request.resource, workspaceRoot);
    } catch {
      return undefined;
    }
    if (
      !isNeverAutoApprovedWrite(resolved) &&
      safeWriteGlobs.some((pattern) => pattern.test(resolved))
    ) {
      return "allow";
    }
  }

  return undefined;
}

export function createPermissionRequest(
  tool: KernelTool,
  call: KernelToolCall,
  session: KernelSession,
  workspaceRoot?: string,
  profile: PermissionProfile = DEFAULT_PERMISSION_PROFILE
): PermissionRequest {
  const scope = inferPermissionScope(tool, call);
  const resource = inferPermissionResource(call.input);
  const risk = classifyRisk(scope, resource, call.input, workspaceRoot);
  const baseDecision = profile[scope];
  const toolDecision = tool.permission?.[scope];
  const decision = mergeDecision(baseDecision, toolDecision, risk);

  return {
    id: randomUUID(),
    sessionId: session.id,
    toolName: call.name,
    scope,
    decision,
    risk,
    resource,
    reason: buildReason(scope, risk, resource),
    metadata: {
      input: call.input,
    },
  };
}

export function inferPermissionScope(
  tool: KernelTool,
  call: KernelToolCall
): PermissionScope {
  const explicit = Object.entries(tool.permission ?? {}).find(([, value]) => value);
  if (explicit?.[0]) {
    return explicit[0] as PermissionScope;
  }

  const lowerName = call.name.toLowerCase();
  if (lowerName.includes("read") || lowerName.includes("list") || lowerName.includes("glob") || lowerName.includes("grep")) {
    return "read";
  }
  if (lowerName.includes("write") || lowerName.includes("patch") || lowerName.includes("edit")) {
    return "write";
  }
  if (lowerName.includes("web") || lowerName.includes("fetch") || lowerName.includes("search")) {
    return "network";
  }
  return "process";
}

export function classifyRisk(
  scope: PermissionScope,
  resource: string | undefined,
  input: Record<string, unknown>,
  workspaceRoot?: string
): RiskLevel {
  switch (scope) {
    case "read":
      return classifyFileRisk(resource, workspaceRoot);
    case "write":
      return classifyWriteRisk(resource, input, workspaceRoot);
    case "network":
      return classifyNetworkRisk(resource);
    case "process":
      return classifyCommandRisk(String(input.command ?? resource ?? ""));
    default:
      return "medium";
  }
}

export function classifyCommandRisk(command: string): RiskLevel {
  const normalized = command.trim().toLowerCase();
  if (!normalized) {
    return "medium";
  }

  const criticalPatterns = [
    /\brm\s+-rf\b/,
    /\bmkfs\b/,
    /\bdd\b/,
    /\bshutdown\b/,
    /\breboot\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\bgit\s+clean\s+-fd\b/,
  ];
  if (criticalPatterns.some((pattern) => pattern.test(normalized))) {
    return "critical";
  }

  const highPatterns = [
    />\s*\S+/,
    /\bchmod\b/,
    /\bchown\b/,
    /\bmv\b/,
    /\bcp\b/,
    /\bnpm\s+publish\b/,
    /\bgit\s+push\b/,
  ];
  if (highPatterns.some((pattern) => pattern.test(normalized))) {
    return "high";
  }

  const mediumPatterns = [
    /\bnpm\b/,
    /\bpnpm\b/,
    /\byarn\b/,
    /\bcurl\b/,
    /\bwget\b/,
    /\bnode\b/,
    /\bpython\b/,
    /\bpython3\b/,
  ];
  if (mediumPatterns.some((pattern) => pattern.test(normalized))) {
    return "medium";
  }

  return "low";
}

export function createSafetyClassifierResolver(
  safeCommands: RegExp[] = DEFAULT_CLASSIFIER_SAFE_COMMANDS
): PermissionResolver {
  return {
    name: "safety-classifier",
    async resolve(context) {
      const { permissionRequest, toolCall } = context;
      if (permissionRequest.scope !== "process") {
        return permissionRequest.risk === "critical"
          ? {
              decision: "denied",
              reason: permissionRequest.reason,
              source: "classifier",
              resolver: "safety-classifier",
            }
          : null;
      }

      const command = String(toolCall.input.command ?? permissionRequest.resource ?? "").trim();
      if (!command) {
        return null;
      }

      if (permissionRequest.risk === "critical") {
        return {
          decision: "denied",
          reason: `Denied by automated safety classifier: ${command}`,
          source: "classifier",
          resolver: "safety-classifier",
        };
      }

      // run_shell is intentionally never auto-approved. Even commands that
      // look read-only can target ~/.ssh, /, or append another shell command.
      if (permissionRequest.toolName === "run_shell") {
        return null;
      }

      if (safeCommands.some((pattern) => pattern.test(command)) && !containsShellComposition(command)) {
        return {
          decision: "approved",
          reason: `Approved by automated safety classifier: ${command}`,
          source: "classifier",
          resolver: "safety-classifier",
        };
      }

      return null;
    },
  };
}

export class PermissionResolverOrchestrator {
  constructor(private readonly resolvers: PermissionResolver[]) {}

  async resolve(context: PermissionResolverContext): Promise<PermissionResolverResult | undefined> {
    if (this.resolvers.length === 0 || context.abortSignal?.aborted) {
      return undefined;
    }

    const controller = new AbortController();
    let abortListener: (() => void) | undefined;

    try {
      return await new Promise<PermissionResolverResult | undefined>((resolve) => {
        let remaining = this.resolvers.length;
        let claimed = false;

        const finish = (result: PermissionResolverResult | undefined) => {
          if (claimed) {
            return;
          }
          claimed = true;
          controller.abort();
          resolve(result);
        };

        abortListener = () => finish(undefined);
        context.abortSignal?.addEventListener("abort", abortListener, { once: true });

        for (const resolver of this.resolvers) {
          void resolver.resolve({
            ...context,
            abortSignal: controller.signal,
          }).then((result) => {
            if (claimed) {
              return;
            }

            if (result) {
              finish(result);
              return;
            }

            remaining -= 1;
            if (remaining === 0) {
              finish(undefined);
            }
          }).catch(() => {
            remaining -= 1;
            if (!claimed && remaining === 0) {
              finish(undefined);
            }
          });
        }
      });
    } finally {
      if (abortListener) {
        context.abortSignal?.removeEventListener("abort", abortListener);
      }
    }
  }
}

function containsShellComposition(command: string): boolean {
  return /[;&|<>`$()\r\n]/.test(command);
}

function classifyFileRisk(resource: string | undefined, workspaceRoot?: string): RiskLevel {
  if (!resource || !workspaceRoot) {
    return "medium";
  }

  try {
    resolvePathWithinWorkspace(resource, workspaceRoot);
    return "low";
  } catch {
    return "high";
  }
}

function classifyWriteRisk(
  resource: string | undefined,
  input: Record<string, unknown>,
  workspaceRoot?: string
): RiskLevel {
  if (!resource) {
    return "high";
  }

  if (workspaceRoot) {
    try {
      resolvePathWithinWorkspace(resource, workspaceRoot);
    } catch {
      return "high";
    }
  } else {
    const resolved = path.resolve(resource);
    if (isPathWithin(resolved, os.homedir())) {
      return "high";
    }
  }

  const content = String(input.content ?? input.patch ?? "");
  if (content.length > 20000) {
    return "high";
  }

  return workspaceRoot ? "medium" : "high";
}

function classifyNetworkRisk(resource: string | undefined): RiskLevel {
  if (!resource) {
    return "high";
  }

  try {
    const url = new URL(resource);
    if (url.protocol !== "https:") {
      return "high";
    }
    return "medium";
  } catch {
    return "high";
  }
}

function inferPermissionResource(input: Record<string, unknown>): string | undefined {
  const candidates = [
    input.path,
    input.directory,
    input.basePath,
    input.cwd,
    input.url,
    input.command,
  ];

  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function mergeDecision(
  baseDecision: PermissionDecision,
  toolDecision: PermissionDecision | undefined,
  risk: RiskLevel
): PermissionDecision {
  // Deny is absolute and is never downgraded to a prompt. Without this, a
  // profile that denies a scope (plan mode denying writes) silently became
  // "ask" for every high-risk call, which is the opposite of the intent.
  if (baseDecision === "deny" || toolDecision === "deny") {
    return "deny";
  }
  if (risk === "critical") {
    return "ask";
  }
  if (risk === "high" && toolDecision !== "allow") {
    return "ask";
  }
  return toolDecision ?? baseDecision;
}

function buildReason(scope: PermissionScope, risk: RiskLevel, resource?: string): string {
  const target = resource ? ` for ${resource}` : "";
  return `${scope} access classified as ${risk}${target}`;
}

export function resolveSafePath(targetPath: string, workspaceRoot: string): string {
  if (path.isAbsolute(targetPath)) {
    return path.resolve(targetPath);
  }
  return path.resolve(workspaceRoot, targetPath);
}

export function resolvePathWithinWorkspace(targetPath: string, workspaceRoot: string): string {
  const resolvedWorkspace = path.resolve(workspaceRoot);
  const resolvedTarget = resolveSafePath(targetPath, workspaceRoot);

  if (!isPathWithin(resolvedTarget, resolvedWorkspace)) {
    throw new Error(`Path ${targetPath} is outside the workspace root`);
  }

  const canonicalWorkspace = fs.realpathSync.native(resolvedWorkspace);
  const canonicalTarget = canonicalizeFromExistingAncestor(resolvedTarget);
  if (!isPathWithin(canonicalTarget, canonicalWorkspace)) {
    throw new Error(`Path ${targetPath} resolves outside the workspace root`);
  }

  return resolvedTarget;
}

export function ensurePathWithinWorkspace(targetPath: string, workspaceRoot: string): void {
  resolvePathWithinWorkspace(targetPath, workspaceRoot);
}

function canonicalizeFromExistingAncestor(targetPath: string): string {
  let existing = targetPath;
  const missingSegments: string[] = [];

  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      throw new Error(`No existing ancestor for ${targetPath}`);
    }
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }

  return path.resolve(fs.realpathSync.native(existing), ...missingSegments);
}

function isPathWithin(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function ensureParentDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
