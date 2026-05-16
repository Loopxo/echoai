import type { ReactElement } from 'react';
import type {
  DesktopCapabilityTicket,
  DesktopParityMetric,
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
  onRespondApproval: (approvalId: string, approved: boolean) => void | Promise<void>;
  onPinMemory: (memoryId: string, pinned: boolean) => void | Promise<void>;
}

export function MarketWorkbench({
  snapshot,
  onCreateProject,
  onAddMemory,
  onCreateApproval,
  onStartWorkflow,
  onRespondApproval,
  onPinMemory,
}: MarketWorkbenchProps): ReactElement {
  const capabilities = snapshot?.capabilities ?? [];
  const productionReady = capabilities.filter((ticket) => ticket.maturity === 'production-ready').length;
  const integrated = capabilities.filter((ticket) => ticket.maturity === 'integrated').length;
  const foundation = capabilities.filter((ticket) => ticket.maturity === 'foundation').length;
  const openApprovals = snapshot?.approvals.filter((approval) => approval.status === 'pending').length ?? 0;

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
            <WorkflowCard workflow={workflow} key={workflow.id} />
          ))}
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

function WorkflowCard({ workflow }: { workflow: DesktopWorkflowRun }): ReactElement {
  return (
    <article className="workflow-card">
      <header>
        <strong>{workflow.title}</strong>
        <span>{workflow.status}</span>
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
