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
  safeCommands?: RegExp[];
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
  private readonly safeCommands: RegExp[];
  private readonly safeWriteGlobs: RegExp[];

  constructor(options: RuntimePermissionOptions = {}) {
    this.profile = {
      ...DEFAULT_PERMISSION_PROFILE,
      ...options.profile,
    };
    this.rules = flattenRules(options.rules ?? [], options.layeredRules);
    this.safeCommands = options.safeCommands ?? DEFAULT_SAFE_COMMANDS;
    this.safeWriteGlobs = options.safeWriteGlobs ?? DEFAULT_SAFE_WRITE_GLOBS;
  }

  evaluate(
    tool: KernelTool,
    call: KernelToolCall,
    session: KernelSession,
    workspaceRoot?: string
  ): PermissionEvaluation {
    const request = createPermissionRequest(tool, call, session, workspaceRoot);
    const matchingRule = findMatchingRule(this.rules, request);
    const safePathDecision = evaluateSafePathApproval(
      request,
      call.input,
      workspaceRoot,
      this.safeCommands,
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

const DEFAULT_SAFE_COMMANDS: RegExp[] = [
  /^pwd$/i,
  /^ls(?:\s|$)/i,
  /^find(?:\s|$)/i,
  /^cat(?:\s|$)/i,
  /^head(?:\s|$)/i,
  /^tail(?:\s|$)/i,
  /^wc(?:\s|$)/i,
  /^which(?:\s|$)/i,
  /^git\s+status(?:\s|$)/i,
  /^git\s+diff(?:\s|$)/i,
  /^git\s+log(?:\s|$)/i,
  /^rg(?:\s|$)/i,
];

const DEFAULT_CLASSIFIER_SAFE_COMMANDS: RegExp[] = [
  /^git\s+(status|diff|log|show)(?:\s|$)/i,
  /^npm\s+test(?:\s|$)/i,
  /^pnpm\s+test(?:\s|$)/i,
  /^pnpm\s+exec\s+(tsc|vitest)(?:\s|$)/i,
  /^tsc(?:\s|$)/i,
];

const DEFAULT_SAFE_WRITE_GLOBS: RegExp[] = [
  /\.md$/i,
  /\.txt$/i,
  /\.json$/i,
  /\.ya?ml$/i,
];

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
  input: Record<string, unknown>,
  workspaceRoot: string | undefined,
  safeCommands: RegExp[],
  safeWriteGlobs: RegExp[]
): PermissionDecision | undefined {
  if (request.scope === "read" && request.risk === "low") {
    return "allow";
  }

  if (request.scope === "process") {
    const command = String(input.command ?? request.resource ?? "").trim();
    if (request.risk === "low" && safeCommands.some((pattern) => pattern.test(command))) {
      return "allow";
    }
  }

  if (request.scope === "write" && workspaceRoot && request.resource && request.risk === "medium") {
    const resolved = resolveSafePath(request.resource, workspaceRoot);
    const inWorkspace = resolved.startsWith(path.resolve(workspaceRoot));
    if (inWorkspace && safeWriteGlobs.some((pattern) => pattern.test(resolved))) {
      return "allow";
    }
  }

  return undefined;
}

export function createPermissionRequest(
  tool: KernelTool,
  call: KernelToolCall,
  session: KernelSession,
  workspaceRoot?: string
): PermissionRequest {
  const scope = inferPermissionScope(tool, call);
  const resource = inferPermissionResource(call.input);
  const risk = classifyRisk(scope, resource, call.input, workspaceRoot);
  const baseDecision = DEFAULT_PERMISSION_PROFILE[scope];
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

      if (safeCommands.some((pattern) => pattern.test(command))) {
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
    if (this.resolvers.length === 0) {
      return undefined;
    }

    const controller = new AbortController();
    const abortListener = () => controller.abort();
    context.abortSignal?.addEventListener("abort", abortListener, { once: true });

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
      context.abortSignal?.removeEventListener("abort", abortListener);
    }
  }
}

function classifyFileRisk(resource: string | undefined, workspaceRoot?: string): RiskLevel {
  if (!resource) {
    return "medium";
  }

  if (!workspaceRoot) {
    return "medium";
  }

  const resolved = resolveSafePath(resource, workspaceRoot);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    return "high";
  }
  return "low";
}

function classifyWriteRisk(
  resource: string | undefined,
  input: Record<string, unknown>,
  workspaceRoot?: string
): RiskLevel {
  if (!resource) {
    return "high";
  }

  const resolved = workspaceRoot ? resolveSafePath(resource, workspaceRoot) : path.resolve(resource);
  const homeDir = os.homedir();
  if (resolved.startsWith(homeDir) && !resolved.startsWith(workspaceRoot ?? "")) {
    return "high";
  }

  const content = String(input.content ?? input.patch ?? "");
  if (content.length > 20000) {
    return "high";
  }

  return workspaceRoot && resolved.startsWith(path.resolve(workspaceRoot)) ? "medium" : "high";
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

export function ensurePathWithinWorkspace(targetPath: string, workspaceRoot: string): void {
  const resolvedWorkspace = path.resolve(workspaceRoot);
  const resolvedTarget = resolveSafePath(targetPath, workspaceRoot);

  if (resolvedTarget !== resolvedWorkspace && !resolvedTarget.startsWith(`${resolvedWorkspace}${path.sep}`)) {
    throw new Error(`Path ${targetPath} is outside the workspace root`);
  }
}

export function ensureParentDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
