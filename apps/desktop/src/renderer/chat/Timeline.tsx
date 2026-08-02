import { useRef, useState, type ReactNode } from 'react';
import { DiffView, Icon, Markdown } from '@echoai/design';
import type { ActivityEntry, TimelineRow } from '../lib/activity';
import { formatClock, formatElapsed } from '../lib/format';
import { useCopy, useStickToBottom, useTicker } from '../lib/hooks';
import { IconButton, Spinner, Tooltip } from '../ui';

/**
 * Chat timeline.
 *
 * Layout follows the convention every current agent client uses: the assistant
 * writes full-width with no bubble or avatar, the user gets a right-aligned
 * bubble, and tool work collapses to one dim line per action that expands on
 * demand. Message actions stay hidden until hover so the transcript reads clean.
 */
export function Timeline({
  rows,
  loading,
  onRetry,
  emptyState,
}: {
  rows: TimelineRow[];
  loading: boolean;
  onRetry: (content: string) => void;
  emptyState: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { pinned, scrollToBottom } = useStickToBottom(scrollRef, rows);

  if (rows.length === 0 && !loading) {
    return (
      <div className="timeline" ref={scrollRef}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className="timeline scroll-y" ref={scrollRef}>
      <div className="timeline-inner">
        {loading ? (
          <div className="timeline-row" style={{ display: 'grid', gap: 10, paddingTop: 8 }}>
            <span className="skeleton" style={{ width: '38%', height: 12 }} />
            <span className="skeleton" style={{ width: '86%', height: 12 }} />
            <span className="skeleton" style={{ width: '64%', height: 12 }} />
          </div>
        ) : null}

        {rows.map((row) => (
          <div className="timeline-row" data-kind={row.kind} key={row.id}>
            <TimelineRowContent row={row} onRetry={onRetry} />
          </div>
        ))}
      </div>

      {!pinned ? (
        <button
          type="button"
          className="btn"
          data-variant="default"
          data-size="sm"
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 8,
            zIndex: 'var(--z-sticky)' as unknown as number,
          }}
        >
          <Icon name="arrow-down" size={13} />
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}

function TimelineRowContent({
  row,
  onRetry,
}: {
  row: TimelineRow;
  onRetry: (content: string) => void;
}) {
  switch (row.kind) {
    case 'message':
      return row.message.role === 'user' ? (
        <UserMessage content={row.message.content} createdAt={row.message.createdAt} onRetry={onRetry} />
      ) : (
        <AssistantMessage
          content={row.message.content}
          createdAt={row.message.createdAt}
          streaming={row.message.streaming}
        />
      );
    case 'activity':
      return <ActivityGroup entries={row.entries} />;
    case 'approval':
      return (
        <ApprovalNotice
          toolName={row.toolName}
          decision={row.decision}
          reason={row.reason}
          createdAt={row.createdAt}
        />
      );
    case 'notice':
      return <Notice tone={row.tone} icon={row.icon} text={row.text} />;
    case 'status':
      return <WorkingIndicator startedAt={row.startedAt} />;
    default:
      return null;
  }
}

/* --------------------------- User message --------------------------- */

function UserMessage({
  content,
  createdAt,
  onRetry,
}: {
  content: string;
  createdAt: number;
  onRetry: (content: string) => void;
}) {
  const { copied, copy } = useCopy();

  return (
    <div className="msg-user">
      <div className="msg-user-bubble">{content}</div>
      <div className="msg-meta">
        <span className="tabular">{formatClock(createdAt)}</span>
        <Tooltip content="Send again">
          <IconButton icon="rotate-ccw" label="Send again" size="sm" onClick={() => onRetry(content)} />
        </Tooltip>
        <Tooltip content={copied ? 'Copied' : 'Copy'}>
          <IconButton
            icon={copied ? 'check' : 'copy'}
            label="Copy message"
            size="sm"
            onClick={() => copy(content)}
          />
        </Tooltip>
      </div>
    </div>
  );
}

/* ------------------------- Assistant message ------------------------- */

function AssistantMessage({
  content,
  createdAt,
  streaming,
}: {
  content: string;
  createdAt: number;
  streaming: boolean;
}) {
  const { copied, copy } = useCopy();

  return (
    <div className="msg-assistant">
      <div className="msg-assistant-body">
        {content.trim().length > 0 ? (
          <Markdown content={content} />
        ) : streaming ? (
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Thinking…
          </span>
        ) : (
          <span className="subtle" style={{ fontSize: 'var(--text-sm)' }}>
            No response
          </span>
        )}
      </div>
      {!streaming ? (
        <div className="msg-meta">
          <Tooltip content={copied ? 'Copied' : 'Copy response'}>
            <IconButton
              icon={copied ? 'check' : 'copy'}
              label="Copy response"
              size="sm"
              onClick={() => copy(content)}
            />
          </Tooltip>
          <span className="tabular">{formatClock(createdAt)}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------- Activity rows ---------------------------- */

function ActivityGroup({ entries }: { entries: ActivityEntry[] }) {
  return (
    <section
      className="activity-group"
      aria-label={entries.length === 1 ? '1 tool call' : `${entries.length} tool calls`}
    >
      {entries.map((entry) => (
        <ActivityRow entry={entry} key={entry.id} />
      ))}
    </section>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(entry.output || entry.diff);
  const tone = entry.state === 'error' ? 'danger' : undefined;

  return (
    <div
      className="activity"
      data-expandable={expandable ? 'true' : undefined}
      data-open={open ? 'true' : undefined}
      data-tone={tone}
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
      aria-expanded={expandable ? open : undefined}
      onClick={expandable ? () => setOpen((current) => !current) : undefined}
      onKeyDown={
        expandable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setOpen((current) => !current);
              }
            }
          : undefined
      }
    >
      <div className="activity-line">
        <span className="activity-icon">
          {entry.state === 'running' ? <Spinner size={12} /> : <Icon name={entry.icon} size={13} />}
        </span>
        <span className="activity-text">
          <span className="activity-verb">{entry.verb}</span>
          {entry.detail ? <span className="activity-detail">{entry.detail}</span> : null}
        </span>
        <span className="activity-state">
          {expandable ? (
            <Icon name="chevron-down" size={12} className="activity-chevron" />
          ) : null}
          <ActivityStateGlyph state={entry.state} />
        </span>
      </div>

      {open && expandable ? (
        <div
          className="activity-body"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {entry.diff ? (
            <DiffView unified={entry.diff.unified} fileName={entry.diff.fileName} />
          ) : null}
          {entry.output ? <pre className="activity-output">{entry.output}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

function ActivityStateGlyph({ state }: { state: ActivityEntry['state'] }) {
  if (state === 'error') {
    return (
      <Tooltip content="Failed">
        <span style={{ display: 'grid', placeItems: 'center', width: 16, height: 16 }}>
          <Icon name="x" size={12} color="var(--danger)" strokeWidth={2.4} />
        </span>
      </Tooltip>
    );
  }
  if (state === 'success') {
    return (
      <Tooltip content="Completed">
        <span style={{ display: 'grid', placeItems: 'center', width: 16, height: 16 }}>
          <Icon name="check" size={12} strokeWidth={2.4} />
        </span>
      </Tooltip>
    );
  }
  if (state === 'empty') {
    return (
      <Tooltip content="No output">
        <span style={{ display: 'grid', placeItems: 'center', width: 16, height: 16 }}>
          <Icon name="minus" size={12} />
        </span>
      </Tooltip>
    );
  }
  return <span style={{ width: 16, height: 16 }} />;
}

/* ------------------------------- Notices ------------------------------- */

function Notice({
  tone,
  icon,
  text,
}: {
  tone: 'info' | 'danger';
  icon: ActivityEntry['icon'];
  text: string;
}) {
  if (tone === 'danger') {
    return (
      <div className="msg-error">
        <Icon name={icon} size={14} />
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className="working" style={{ color: 'var(--fg-faint)' }}>
      <Icon name={icon} size={13} />
      <span>{text}</span>
    </div>
  );
}

function ApprovalNotice({
  toolName,
  decision,
  reason,
  createdAt,
}: {
  toolName: string;
  decision: 'approved' | 'denied';
  reason: string | null;
  createdAt: number;
}) {
  const approved = decision === 'approved';
  return (
    <div className="working" style={{ color: approved ? 'var(--fg-subtle)' : 'var(--danger)' }}>
      <Icon name={approved ? 'circle-check' : 'x'} size={13} />
      <span>
        {approved ? 'You approved' : 'You denied'} <strong style={{ fontWeight: 600 }}>{toolName}</strong>
        {reason ? ` — ${reason}` : ''}
      </span>
      <span className="tabular" style={{ color: 'var(--fg-faint)' }}>
        {formatClock(createdAt)}
      </span>
    </div>
  );
}

/* --------------------------- Working indicator --------------------------- */

function WorkingIndicator({ startedAt }: { startedAt: number }) {
  // Self-contained ticker so only this row re-renders each second.
  const now = useTicker(true, 1000);

  return (
    <div className="working">
      <span className="working-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span>Working for {formatElapsed(Math.max(0, now - startedAt))}</span>
    </div>
  );
}
