import { useState, type ReactElement } from 'react';
import type {
  DesktopCapabilityTicket,
  DesktopMemorySearchResult,
  DesktopParityMetric,
  DesktopSandboxCommandPlan,
  DesktopSampleAudit,
  DesktopServiceHealth,
  DesktopWorkbenchApproval,
  DesktopWorkbenchMemory,
  DesktopWorkbenchSnapshot,
  DesktopWorkflowRun,
} from '@shared/ipc';

interface MarketWorkbenchProps {
  snapshot: DesktopWorkbenchSnapshot | null;
  onCreateProject: () => void | Promise<void>;
  onAddMemory: () => void | Promise<void>;
  onCreateApproval: () => void | Promise<void>;
  onStartWorkflow: () => void | Promise<void>;
  onAdvanceWorkflow: (runId: string) => void | Promise<void>;
  onPlanSandboxCommand: (command: string) => Promise<DesktopSandboxCommandPlan>;
  onSearchMemory: (query: string) => Promise<DesktopMemorySearchResult[]>;
  onRecordBrowserAction: (sessionId: string) => void | Promise<void>;
  onRespondApproval: (approvalId: string, approved: boolean) => void | Promise<void>;
  onPinMemory: (memoryId: string, pinned: boolean) => void | Promise<void>;
}

export function MarketWorkbench({
  snapshot,
  onCreateProject,
  onAddMemory,
  onCreateApproval,
  onStartWorkflow,
  onAdvanceWorkflow,
  onPlanSandboxCommand,
  onSearchMemory,
  onRecordBrowserAction,
  onRespondApproval,
  onPinMemory,
}: MarketWorkbenchProps): ReactElement {
  const [sandboxCommand, setSandboxCommand] = useState('pnpm --filter @echoai/desktop test');
  const [sandboxPlan, setSandboxPlan] = useState<DesktopSandboxCommandPlan | null>(null);
  const [memoryQuery, setMemoryQuery] = useState('desktop');
  const [memoryResults, setMemoryResults] = useState<DesktopMemorySearchResult[]>([]);
  const capabilities = snapshot?.capabilities ?? [];
  const productionReady = capabilities.filter((ticket) => ticket.maturity === 'production-ready').length;
  const integrated = capabilities.filter((ticket) => ticket.maturity === 'integrated').length;
  const foundation = capabilities.filter((ticket) => ticket.maturity === 'foundation').length;
  const openApprovals = snapshot?.approvals.filter((approval) => approval.status === 'pending').length ?? 0;
  const firstBrowserSession = snapshot?.browserSessions[0] ?? null;

  async function planCommand(): Promise<void> {
    setSandboxPlan(await onPlanSandboxCommand(sandboxCommand));
  }

  async function searchMemory(): Promise<void> {
    setMemoryResults(await onSearchMemory(memoryQuery));
  }

  return (
    <section className="market-workbench">
      <header className="workbench-hero">
        <div>
          <div className="panel-kicker">Native Desktop Control Plane</div>
          <h2>Local-first agent workspace</h2>
          <p>{snapshot?.productPosture ?? 'Loading EchoAI desktop workbench posture.'}</p>
        </div>
        <div className="workbench-actions">
          <button onClick={onCreateProject} type="button">
            Project
          </button>
          <button onClick={onStartWorkflow} type="button">
            Workflow
          </button>
          <button onClick={onCreateApproval} type="button">
            Approval
          </button>
          <button onClick={onAddMemory} type="button">
            Memory
          </button>
        </div>
      </header>

      <div className="workbench-scoreboard">
        <Score label="Tickets" value={`${capabilities.length}/100`} />
        <Score label="Production" value={`${productionReady}`} />
        <Score label="Integrated" value={`${integrated}`} />
        <Score label="Foundation" value={`${foundation}`} />
        <Score label="Approvals" value={`${openApprovals}`} tone={openApprovals > 0 ? 'warn' : 'ok'} />
      </div>

      <div className="workbench-grid">
        <section className="workbench-section audit">
          <SectionHeader kicker="Sample Audit" title="Clean-room posture" />
          <p className="copy-policy">{snapshot?.copyPolicy ?? 'Reference-only copy policy is loading.'}</p>
          <div className="audit-list">
            {(snapshot?.sampleAudits ?? []).map((audit) => (
              <AuditCard audit={audit} key={audit.repo} />
            ))}
          </div>
        </section>

        <section className="workbench-section parity">
          <SectionHeader kicker="Parity Benchmark" title="Surpass targets" />
          <div className="parity-list">
            {(snapshot?.parityMetrics ?? []).map((metric) => (
              <ParityRow metric={metric} key={metric.id} />
            ))}
          </div>
        </section>

        <section className="workbench-section capability">
          <SectionHeader kicker="D-001-D-100" title="Capability matrix" />
          <div className="ticket-band">
            {groupTickets(capabilities).map((group) => (
              <div className="ticket-group" key={group.area}>
                <span>{group.area}</span>
                <strong>{group.count}</strong>
              </div>
            ))}
          </div>
          <div className="ticket-samples">
            {capabilities.slice(0, 8).map((ticket) => (
              <TicketChip ticket={ticket} key={ticket.id} />
            ))}
          </div>
        </section>

        <section className="workbench-section workflow">
          <SectionHeader kicker="Workflow" title="Agent run graph" />
          {(snapshot?.workflows ?? []).slice(0, 2).map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              onAdvanceWorkflow={onAdvanceWorkflow}
              workflow={workflow}
            />
          ))}
        </section>

        <section className="workbench-section sandbox">
          <SectionHeader kicker="Sandbox" title="Command planner" />
          <div className="workbench-compose">
            <input
              aria-label="Sandbox command"
              onChange={(event) => setSandboxCommand(event.target.value)}
              value={sandboxCommand}
            />
            <button onClick={planCommand} type="button">
              Plan
            </button>
          </div>
          {sandboxPlan ? (
            <div className={`sandbox-plan ${sandboxPlan.status}`}>
              <strong>{sandboxPlan.status}</strong>
              <span>{sandboxPlan.reason}</span>
              <small>{sandboxPlan.profileId} / {sandboxPlan.risk}</small>
            </div>
          ) : null}
          <div className="profile-list">
            {(snapshot?.sandboxProfiles ?? []).map((profile) => (
              <div className={`profile-row ${profile.status}`} key={profile.id}>
                <strong>{profile.label}</strong>
                <span>{profile.isolation} / {profile.pathPolicy}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="workbench-section mcp">
          <SectionHeader kicker="MCP" title="Runtime lifecycle" />
          <div className="mcp-list">
            {(snapshot?.mcpRuntimes ?? []).length === 0 ? (
              <span className="empty-inline">No MCP servers registered</span>
            ) : (
              snapshot?.mcpRuntimes.map((runtime) => (
                <div className={`mcp-row ${runtime.status}`} key={runtime.serverId}>
                  <strong>{runtime.name}</strong>
                  <span>{runtime.toolCount} tools / {runtime.transport}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="workbench-section terminal-depth">
          <SectionHeader kicker="Terminal" title="Production workspace" />
          <div className="terminal-depth-list">
            {(snapshot?.terminalWorkspaces ?? []).length === 0 ? (
              <span className="empty-inline">No terminal tasks yet</span>
            ) : (
              snapshot?.terminalWorkspaces.slice(0, 5).map((task) => (
                <div className={`terminal-depth-row ${task.status}`} key={task.id}>
                  <strong>{task.command}</strong>
                  <span>{task.status} / {task.risk}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="workbench-section browser-depth">
          <SectionHeader kicker="Browser" title="Agent workspace" />
          <div className="browser-session-list">
            {(snapshot?.browserSessions ?? []).slice(0, 3).map((session) => (
              <div className={`browser-session-row ${session.status}`} key={session.id}>
                <strong>{session.profileName}</strong>
                <span>{session.actionCount} actions / {session.currentUrl ?? 'no url'}</span>
                <button onClick={() => onRecordBrowserAction(session.id)} type="button">
                  Record
                </button>
              </div>
            ))}
            {!firstBrowserSession ? <span className="empty-inline">Start a workflow to create a browser session</span> : null}
          </div>
          <div className="browser-action-list">
            {(snapshot?.browserActions ?? []).slice(0, 4).map((action) => (
              <div className={`browser-action-row ${action.status}`} key={action.id}>
                <strong>{action.action}</strong>
                <span>{action.url ?? action.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="workbench-section approvals">
          <SectionHeader kicker="Approvals" title="Privileged gates" />
          <div className="approval-list">
            {(snapshot?.approvals ?? []).slice(0, 5).map((approval) => (
              <ApprovalRow
                approval={approval}
                key={approval.id}
                onRespondApproval={onRespondApproval}
              />
            ))}
          </div>
        </section>

        <section className="workbench-section memory">
          <SectionHeader kicker="Memory" title="Private context" />
          <div className="workbench-compose">
            <input
              aria-label="Memory search"
              onChange={(event) => setMemoryQuery(event.target.value)}
              value={memoryQuery}
            />
            <button onClick={searchMemory} type="button">
              Search
            </button>
          </div>
          <div className="memory-index">
            <span>{snapshot?.memoryIndex.total ?? 0} total</span>
            <span>{snapshot?.memoryIndex.pinned ?? 0} pinned</span>
            <span>{snapshot?.memoryIndex.tags.length ?? 0} tags</span>
          </div>
          {memoryResults.length > 0 ? (
            <div className="memory-results">
              {memoryResults.map((result) => (
                <div className="memory-result" key={result.memory.id}>
                  <strong>{result.score}</strong>
                  <span>{result.highlights[0] ?? result.memory.text}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="memory-list">
            {(snapshot?.memories ?? []).slice(0, 5).map((memory) => (
              <MemoryRow memory={memory} key={memory.id} onPinMemory={onPinMemory} />
            ))}
          </div>
        </section>

        <section className="workbench-section health">
          <SectionHeader kicker="Health" title="Services and release" />
          <div className="health-list">
            {(snapshot?.serviceHealth ?? []).map((service) => (
              <HealthRow health={service} key={service.id} />
            ))}
          </div>
        </section>

        <section className="workbench-section templates">
          <SectionHeader kicker="Templates" title="Operator modes" />
          <div className="template-list">
            {(snapshot?.workflowTemplates ?? []).map((template) => (
              <div className="template-row" key={template.id}>
                <strong>{template.name}</strong>
                <span>{template.stages.join(' -> ')}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }): ReactElement {
  return (
    <div className="section-heading">
      <span>{kicker}</span>
      <strong>{title}</strong>
    </div>
  );
}

function Score({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'warn';
}): ReactElement {
  return (
    <div className={`workbench-score ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuditCard({ audit }: { audit: DesktopSampleAudit }): ReactElement {
  return (
    <article className={`audit-card ${audit.copyPolicy}`}>
      <header>
        <strong>{audit.label}</strong>
        <span>{audit.copyPolicy}</span>
      </header>
      <p>{audit.strengths.slice(0, 3).join(', ')}</p>
      <small>{audit.risks[0]}</small>
    </article>
  );
}

function ParityRow({ metric }: { metric: DesktopParityMetric }): ReactElement {
  const width = `${Math.min(100, Math.round((metric.echoaiLevel / metric.targetLevel) * 100))}%`;
  return (
    <div className={`parity-row ${metric.status}`}>
      <div>
        <strong>{metric.label}</strong>
        <span>{metric.source}</span>
      </div>
      <div className="parity-meter" aria-label={`${metric.label} parity`}>
        <span style={{ width }} />
      </div>
      <small>{metric.echoaiLevel}/{metric.targetLevel}</small>
    </div>
  );
}

function TicketChip({ ticket }: { ticket: DesktopCapabilityTicket }): ReactElement {
  return (
    <div className={`ticket-chip ${ticket.maturity}`}>
      <strong>{ticket.id}</strong>
      <span>{ticket.maturity}</span>
    </div>
  );
}

function WorkflowCard({
  workflow,
  onAdvanceWorkflow,
}: {
  workflow: DesktopWorkflowRun;
  onAdvanceWorkflow: (runId: string) => void | Promise<void>;
}): ReactElement {
  return (
    <article className="workflow-card">
      <header>
        <strong>{workflow.title}</strong>
        <button onClick={() => onAdvanceWorkflow(workflow.id)} type="button">
          {workflow.status}
        </button>
      </header>
      <div className="workflow-nodes">
        {workflow.nodes.map((node) => (
          <div className={`workflow-node ${node.status}`} key={node.id}>
            <span>{node.label}</span>
            <small>{node.owner}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function ApprovalRow({
  approval,
  onRespondApproval,
}: {
  approval: DesktopWorkbenchApproval;
  onRespondApproval: (approvalId: string, approved: boolean) => void | Promise<void>;
}): ReactElement {
  return (
    <article className={`approval-row ${approval.status}`}>
      <div>
        <strong>{approval.title}</strong>
        <span>{approval.detail}</span>
      </div>
      {approval.status === 'pending' ? (
        <div>
          <button onClick={() => onRespondApproval(approval.id, true)} type="button">
            Approve
          </button>
          <button onClick={() => onRespondApproval(approval.id, false)} type="button">
            Reject
          </button>
        </div>
      ) : (
        <small>{approval.status}</small>
      )}
    </article>
  );
}

function MemoryRow({
  memory,
  onPinMemory,
}: {
  memory: DesktopWorkbenchMemory;
  onPinMemory: (memoryId: string, pinned: boolean) => void | Promise<void>;
}): ReactElement {
  return (
    <article className={`memory-row ${memory.pinned ? 'pinned' : ''}`}>
      <div>
        <strong>{memory.scope}</strong>
        <span>{memory.text}</span>
      </div>
      <button onClick={() => onPinMemory(memory.id, !memory.pinned)} type="button">
        {memory.pinned ? 'Pinned' : 'Pin'}
      </button>
    </article>
  );
}

function HealthRow({ health }: { health: DesktopServiceHealth }): ReactElement {
  return (
    <div className={`health-row ${health.status}`}>
      <strong>{health.label}</strong>
      <span>{health.detail}</span>
    </div>
  );
}

function groupTickets(tickets: DesktopCapabilityTicket[]): Array<{ area: string; count: number }> {
  const groups = new Map<string, number>();
  for (const ticket of tickets) {
    groups.set(ticket.area, (groups.get(ticket.area) ?? 0) + 1);
  }
  return [...groups.entries()].map(([area, count]) => ({ area, count }));
}
