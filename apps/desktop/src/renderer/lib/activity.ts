import type { DesktopRuntimeEvent } from '@shared/ipc';
import type { IconName } from '@echoai/design';
import { basename, firstLine, pluralize, truncate } from './format';

/**
 * Runtime event stream -> timeline model.
 *
 * The desktop IPC layer forwards kernel events verbatim with `payload: unknown`,
 * so everything here narrows defensively. The output follows the convention
 * Codex and opencode both settled on: every agent action becomes one collapsed
 * line of `[icon] [verb] [dim detail] [state]`, consecutive read-only calls
 * collapse into a single "Explored" group, and output only appears on expand.
 */

export type ActivityCategory =
  | 'read'
  | 'search'
  | 'list'
  | 'edit'
  | 'shell'
  | 'symbol'
  | 'git'
  | 'todo'
  | 'snapshot'
  | 'mcp'
  | 'other';

export type ActivityState = 'running' | 'success' | 'error' | 'empty';

export interface ActivityEntry {
  id: string;
  tool: string;
  category: ActivityCategory;
  /** Present tense while running, past tense once settled. */
  verb: string;
  detail: string;
  state: ActivityState;
  icon: IconName;
  /** Expanded body: command echo, output, or serialized input. */
  output: string | null;
  /** Unified diff when the tool reports one, rendered inline. */
  diff: { unified: string; fileName: string } | null;
  startedAt: number;
  endedAt: number | null;
}

export interface TimelineMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  streaming: boolean;
}

export type TimelineRow =
  | { kind: 'message'; id: string; message: TimelineMessage }
  | { kind: 'activity'; id: string; entries: ActivityEntry[] }
  | {
      kind: 'approval';
      id: string;
      toolName: string;
      decision: 'approved' | 'denied';
      reason: string | null;
      createdAt: number;
    }
  | { kind: 'notice'; id: string; tone: 'info' | 'danger'; icon: IconName; text: string }
  | { kind: 'status'; id: string; startedAt: number };

export interface TimelineModel {
  rows: TimelineRow[];
  /** True while a run is in flight, i.e. the composer should offer Stop. */
  running: boolean;
  runStartedAt: number | null;
  sessionId: string | null;
}

/* ---------------------------- Tool metadata ---------------------------- */

interface ToolShape {
  category: ActivityCategory;
  present: string;
  past: string;
  icon: IconName;
  /** Input keys checked in order to build the dim detail text. */
  detailKeys: string[];
}

const TOOL_SHAPES: Record<string, ToolShape> = {
  read_file: { category: 'read', present: 'Reading', past: 'Read', icon: 'eye', detailKeys: ['path'] },
  list_directory: { category: 'list', present: 'Listing', past: 'List', icon: 'folder', detailKeys: ['path'] },
  glob_search: { category: 'search', present: 'Searching', past: 'Glob', icon: 'search', detailKeys: ['pattern', 'path'] },
  grep_search: { category: 'search', present: 'Searching', past: 'Search', icon: 'search', detailKeys: ['pattern', 'query', 'path'] },
  write_file: { category: 'edit', present: 'Writing', past: 'Wrote', icon: 'square-pen', detailKeys: ['path'] },
  apply_patch: { category: 'edit', present: 'Patching', past: 'Edited', icon: 'square-pen', detailKeys: ['path'] },
  multi_edit: { category: 'edit', present: 'Editing', past: 'Edited', icon: 'square-pen', detailKeys: ['path'] },
  revert: { category: 'edit', present: 'Reverting', past: 'Reverted', icon: 'rotate-ccw', detailKeys: ['path'] },
  git_status: { category: 'git', present: 'Checking', past: 'Git status', icon: 'branch', detailKeys: [] },
  git_diff: { category: 'git', present: 'Diffing', past: 'Git diff', icon: 'diff', detailKeys: ['path'] },
  run_shell: { category: 'shell', present: 'Running', past: 'Ran', icon: 'terminal', detailKeys: ['command'] },
  run_shell_task: { category: 'shell', present: 'Running', past: 'Ran', icon: 'terminal', detailKeys: ['command'] },
  run_tests: { category: 'shell', present: 'Running tests', past: 'Ran tests', icon: 'circle-check', detailKeys: ['command'] },
  run_lint: { category: 'shell', present: 'Linting', past: 'Linted', icon: 'circle-check', detailKeys: ['command'] },
  run_typecheck: { category: 'shell', present: 'Typechecking', past: 'Typechecked', icon: 'circle-check', detailKeys: ['command'] },
  symbol_search: { category: 'symbol', present: 'Searching', past: 'Symbols', icon: 'code', detailKeys: ['symbol', 'query'] },
  workspace_symbols: { category: 'symbol', present: 'Indexing', past: 'Symbols', icon: 'code', detailKeys: ['query'] },
  find_references: { category: 'symbol', present: 'Finding', past: 'References', icon: 'link', detailKeys: ['symbol', 'path'] },
  goto_definition: { category: 'symbol', present: 'Resolving', past: 'Definition', icon: 'code', detailKeys: ['symbol', 'path'] },
  snapshot: { category: 'snapshot', present: 'Snapshotting', past: 'Snapshot', icon: 'layers', detailKeys: ['label'] },
  todo_manage: { category: 'todo', present: 'Updating plan', past: 'Updated plan', icon: 'list', detailKeys: [] },
  todo_read: { category: 'todo', present: 'Reading plan', past: 'Plan', icon: 'list', detailKeys: [] },
  todo_write: { category: 'todo', present: 'Updating plan', past: 'Updated plan', icon: 'list', detailKeys: [] },
  write_note: { category: 'other', present: 'Noting', past: 'Note', icon: 'file-text', detailKeys: ['message'] },
};

/** Read-only categories collapse into a single "Explored" group. */
const EXPLORE_CATEGORIES = new Set<ActivityCategory>(['read', 'search', 'list', 'symbol']);

function shapeFor(tool: string): ToolShape {
  const known = TOOL_SHAPES[tool];
  if (known) {
    return known;
  }

  // MCP tools arrive namespaced, e.g. `server__tool` or `mcp__server__tool`.
  if (tool.includes('__')) {
    return { category: 'mcp', present: 'Calling', past: 'Called', icon: 'plug', detailKeys: [] };
  }

  return { category: 'other', present: 'Running', past: 'Ran', icon: 'wrench', detailKeys: [] };
}

/* ------------------------------ Narrowing ------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

interface ToolCallShape {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function readToolCall(value: unknown): ToolCallShape | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = str(value.name);
  if (!name) {
    return null;
  }
  return {
    id: str(value.id) ?? name,
    name,
    input: isRecord(value.input) ? value.input : {},
  };
}

interface ToolResultShape {
  success: boolean;
  output: string | null;
  error: string | null;
  summary: string | null;
  diff: { unified: string; fileName: string } | null;
}

function readToolResult(value: unknown): ToolResultShape | null {
  if (!isRecord(value)) {
    return null;
  }

  let diff: ToolResultShape['diff'] = null;
  const artifacts = value.artifacts;
  if (Array.isArray(artifacts)) {
    for (const artifact of artifacts) {
      if (!isRecord(artifact) || artifact.type !== 'diff') {
        continue;
      }
      const unified = str(artifact.content);
      if (unified) {
        diff = { unified, fileName: str(artifact.label) ?? str(artifact.path) ?? 'changes' };
        break;
      }
    }
  }

  return {
    success: value.success !== false,
    output: str(value.output),
    error: str(value.error),
    summary: str(value.summary),
    diff,
  };
}

/** Build the dim mono detail from the first populated input key. */
function detailFor(shape: ToolShape, input: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of shape.detailKeys) {
    const value = input[key];
    const text = str(value);
    if (text) {
      parts.push(key === 'path' ? basename(text) : text);
    }
  }

  if (parts.length > 0) {
    return truncate(parts.join(' · '), 160);
  }

  // Fall back to whatever scalar the tool was given, so an unknown tool still
  // shows something useful instead of a bare verb.
  for (const value of Object.values(input)) {
    const text = str(value);
    if (text) {
      return truncate(firstLine(text, 120), 160);
    }
  }
  return '';
}

/** Expanded body: command echo first, then output or error. */
function bodyFor(
  shape: ToolShape,
  input: Record<string, unknown>,
  result: ToolResultShape | null
): string | null {
  const sections: string[] = [];

  if (shape.category === 'shell') {
    const command = str(input.command);
    if (command) {
      sections.push(`$ ${command}`);
    }
  } else if (shape.category === 'mcp' || shape.category === 'other') {
    if (Object.keys(input).length > 0) {
      sections.push(JSON.stringify(input, null, 2));
    }
  }

  if (result?.error) {
    sections.push(result.error);
  } else if (result?.output) {
    sections.push(result.output);
  }

  const body = sections.join('\n\n').trim();
  return body.length > 0 ? body : null;
}

/* ------------------------------- Builder ------------------------------- */

/**
 * Fold the ordered event list into timeline rows.
 *
 * Derived rather than incrementally mutated so a late-arriving `tool.completed`
 * can retroactively settle its row, and so the whole view stays a pure function
 * of the events we have received.
 */
export function buildTimeline(events: DesktopRuntimeEvent[]): TimelineModel {
  const rows: TimelineRow[] = [];
  const entriesById = new Map<string, ActivityEntry>();
  const messagesById = new Map<string, TimelineMessage>();

  let running = false;
  let runStartedAt: number | null = null;
  let sessionId: string | null = null;
  let noticeSeq = 0;

  /** Append to the trailing activity group, or start a new one. */
  const pushEntry = (entry: ActivityEntry) => {
    entriesById.set(entry.id, entry);
    const last = rows[rows.length - 1];
    if (last && last.kind === 'activity') {
      last.entries.push(entry);
      return;
    }
    rows.push({ kind: 'activity', id: `activity-${entry.id}`, entries: [entry] });
  };

  for (const event of events) {
    const payload = event.payload;
    const eventAt = Date.parse(event.createdAt);
    const at = Number.isNaN(eventAt) ? Date.now() : eventAt;

    if (event.sessionId) {
      sessionId = event.sessionId;
    }

    switch (event.type) {
      case 'run.started': {
        running = true;
        runStartedAt = at;
        if (isRecord(payload) && isRecord(payload.session)) {
          sessionId = str(payload.session.id) ?? sessionId;
        }
        break;
      }

      case 'message.created': {
        if (!isRecord(payload) || !isRecord(payload.message)) {
          break;
        }
        const raw = payload.message;
        const role = raw.role;
        // Tool and system messages are represented by activity rows already.
        if (role !== 'user' && role !== 'assistant') {
          break;
        }
        const id = str(raw.id) ?? `${event.runId}-${at}`;
        const message: TimelineMessage = {
          id,
          role,
          content: typeof raw.content === 'string' ? raw.content : '',
          createdAt: num(raw.createdAt) ?? at,
          streaming: false,
        };

        const existing = messagesById.get(id);
        if (existing) {
          // The confirmed message supersedes whatever streamed in.
          existing.content = message.content || existing.content;
          existing.streaming = false;
          break;
        }

        messagesById.set(id, message);
        rows.push({ kind: 'message', id: `message-${id}`, message });
        break;
      }

      case 'assistant.delta': {
        if (!isRecord(payload)) {
          break;
        }
        const text = str(payload.text);
        if (!text) {
          break;
        }
        // Prefer the kernel's message id so the confirmed `message.created`
        // event lands on the same row instead of duplicating it.
        const id = str(payload.messageId) ?? `${event.runId}-stream`;
        const existing = messagesById.get(id);
        if (existing) {
          existing.content += text;
          break;
        }

        const message: TimelineMessage = {
          id,
          role: 'assistant',
          content: text,
          createdAt: at,
          streaming: true,
        };
        messagesById.set(id, message);
        rows.push({ kind: 'message', id: `message-${id}`, message });
        break;
      }

      case 'tool.started':
      case 'assistant.tool_call': {
        if (!isRecord(payload)) {
          break;
        }
        const call = readToolCall(payload.call);
        if (!call || entriesById.has(call.id)) {
          break;
        }
        const shape = shapeFor(call.name);
        pushEntry({
          id: call.id,
          tool: call.name,
          category: shape.category,
          verb: shape.present,
          detail: detailFor(shape, call.input),
          state: 'running',
          icon: shape.icon,
          output: bodyFor(shape, call.input, null),
          diff: null,
          startedAt: at,
          endedAt: null,
        });
        break;
      }

      case 'tool.batch.started': {
        if (!isRecord(payload) || !Array.isArray(payload.calls)) {
          break;
        }
        for (const rawCall of payload.calls) {
          const call = readToolCall(rawCall);
          if (!call || entriesById.has(call.id)) {
            continue;
          }
          const shape = shapeFor(call.name);
          pushEntry({
            id: call.id,
            tool: call.name,
            category: shape.category,
            verb: shape.present,
            detail: detailFor(shape, call.input),
            state: 'running',
            icon: shape.icon,
            output: bodyFor(shape, call.input, null),
            diff: null,
            startedAt: at,
            endedAt: null,
          });
        }
        break;
      }

      case 'tool.completed': {
        if (!isRecord(payload)) {
          break;
        }
        const call = readToolCall(payload.call);
        if (!call) {
          break;
        }
        const result = readToolResult(payload.result);
        const shape = shapeFor(call.name);
        const body = bodyFor(shape, call.input, result);
        const entry = entriesById.get(call.id);

        const settled: Omit<ActivityEntry, 'id' | 'startedAt'> = {
          tool: call.name,
          category: shape.category,
          verb: shape.past,
          detail: detailFor(shape, call.input),
          state: result?.success === false ? 'error' : body ? 'success' : 'empty',
          icon: shape.icon,
          output: body,
          diff: result?.diff ?? null,
          endedAt: at,
        };

        if (entry) {
          Object.assign(entry, settled);
        } else {
          pushEntry({ id: call.id, startedAt: at, ...settled });
        }
        break;
      }

      case 'approval.recorded': {
        if (!isRecord(payload) || !isRecord(payload.approval)) {
          break;
        }
        const approval = payload.approval;
        const decision = approval.decision === 'denied' ? 'denied' : 'approved';
        rows.push({
          kind: 'approval',
          id: `approval-${str(approval.id) ?? `${at}`}`,
          toolName: str(approval.toolName) ?? 'tool',
          decision,
          reason: str(approval.reason),
          createdAt: num(approval.createdAt) ?? at,
        });
        break;
      }

      case 'session.compacted': {
        const report = isRecord(payload) && isRecord(payload.report) ? payload.report : null;
        const removed = report ? num(report.removedMessages) ?? 0 : 0;
        rows.push({
          kind: 'notice',
          id: `notice-${noticeSeq++}`,
          tone: 'info',
          icon: 'layers',
          text:
            removed > 0
              ? `Context compacted, ${pluralize(removed, 'earlier message')} summarized`
              : 'Context compacted to stay within the model window',
        });
        break;
      }

      case 'run.completed': {
        running = false;
        runStartedAt = null;
        if (isRecord(payload) && isRecord(payload.result) && isRecord(payload.result.session)) {
          sessionId = str(payload.result.session.id) ?? sessionId;
        }
        break;
      }

      case 'run.cancelled': {
        running = false;
        runStartedAt = null;
        rows.push({
          kind: 'notice',
          id: `notice-${noticeSeq++}`,
          tone: 'info',
          icon: 'stop',
          text: 'Run stopped',
        });
        break;
      }

      case 'run.failed': {
        running = false;
        runStartedAt = null;
        const message = isRecord(payload) ? str(payload.error) : null;
        rows.push({
          kind: 'notice',
          id: `notice-${noticeSeq++}`,
          tone: 'danger',
          icon: 'alert-triangle',
          text: message ?? 'The run failed',
        });
        break;
      }

      default:
        break;
    }
  }

  // Any tool still marked running after the run ended never reported back.
  if (!running) {
    for (const entry of entriesById.values()) {
      if (entry.state === 'running') {
        entry.state = 'empty';
        entry.verb = shapeFor(entry.tool).past;
      }
    }
  }

  const collapsed = collapseExploreGroups(rows);

  if (running && runStartedAt !== null) {
    collapsed.push({ kind: 'status', id: 'status-working', startedAt: runStartedAt });
  }

  return { rows: collapsed, running, runStartedAt, sessionId };
}

/**
 * Merge runs of read-only calls into one summary entry.
 *
 * A turn that reads eight files should be one "Explored" line, not eight rows
 * of noise. The individual calls stay available in the expanded body.
 */
function collapseExploreGroups(rows: TimelineRow[]): TimelineRow[] {
  return rows.map((row) => {
    if (row.kind !== 'activity' || row.entries.length < 3) {
      return row;
    }

    const allExplore = row.entries.every((entry) => EXPLORE_CATEGORIES.has(entry.category));
    if (!allExplore) {
      return row;
    }

    const anyRunning = row.entries.some((entry) => entry.state === 'running');
    const counts = new Map<ActivityCategory, number>();
    for (const entry of row.entries) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }

    const summary = [
      counts.get('read') ? pluralize(counts.get('read')!, 'read') : null,
      counts.get('search') ? pluralize(counts.get('search')!, 'search', 'searches') : null,
      counts.get('list') ? pluralize(counts.get('list')!, 'list') : null,
      counts.get('symbol') ? pluralize(counts.get('symbol')!, 'lookup') : null,
    ]
      .filter(Boolean)
      .join(', ');

    const body = row.entries
      .map((entry) => `${entry.verb} ${entry.detail}`.trim())
      .join('\n');

    const merged: ActivityEntry = {
      id: `${row.id}-explored`,
      tool: 'explore',
      category: 'read',
      verb: anyRunning ? 'Exploring' : 'Explored',
      detail: summary,
      state: anyRunning ? 'running' : 'success',
      icon: 'eye',
      output: body,
      diff: null,
      startedAt: row.entries[0]!.startedAt,
      endedAt: anyRunning ? null : row.entries[row.entries.length - 1]!.endedAt,
    };

    return { kind: 'activity', id: row.id, entries: [merged] };
  });
}

/* --------------------------- Session rehydration --------------------------- */

/**
 * Rebuild timeline rows from an exported session.
 *
 * `exportRuntimeSession` is the only API that returns message history, so
 * opening a past thread parses that JSON rather than replaying events.
 */
export function timelineFromExport(json: string): TimelineRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.messages)) {
    return [];
  }

  const rows: TimelineRow[] = [];
  for (const raw of parsed.messages) {
    if (!isRecord(raw)) {
      continue;
    }

    const role = raw.role;
    const content = typeof raw.content === 'string' ? raw.content : '';
    const id = str(raw.id) ?? `${rows.length}`;
    const createdAt = num(raw.createdAt) ?? 0;

    if (role === 'user' || role === 'assistant') {
      if (!content.trim() && !Array.isArray(raw.toolCalls)) {
        continue;
      }
      if (content.trim()) {
        rows.push({
          kind: 'message',
          id: `history-${id}`,
          message: { id, role, content, createdAt, streaming: false },
        });
      }
      continue;
    }

    if (role === 'tool') {
      const name = str(raw.name) ?? 'tool';
      const shape = shapeFor(name);
      rows.push({
        kind: 'activity',
        id: `history-activity-${id}`,
        entries: [
          {
            id,
            tool: name,
            category: shape.category,
            verb: shape.past,
            detail: '',
            state: content.trim() ? 'success' : 'empty',
            icon: shape.icon,
            output: content.trim() ? content : null,
            diff: null,
            startedAt: createdAt,
            endedAt: createdAt,
          },
        ],
      });
    }
  }

  return rows;
}
