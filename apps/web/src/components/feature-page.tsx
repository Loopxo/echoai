import type { ReactNode } from "react";

export type Stat = {
  label: string;
  value: string | number;
  detail: string;
};

export type Row = Record<string, string | number | boolean | string[]>;

export function PageHeader({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <section className="page-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {children ? <div className="header-actions">{children}</div> : null}
    </section>
  );
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <section className="stat-grid">
      {stats.map((stat) => (
        <article className="stat" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <p>{stat.detail}</p>
        </article>
      ))}
    </section>
  );
}

export function DataTable({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return <EmptyState title="Nothing here yet" action="Create the first item" />;
  }

  const columns = Object.keys(rows[0]);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{Array.isArray(row[column]) ? (row[column] as string[]).join(", ") : String(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action: string }) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <button type="button">{action}</button>
    </section>
  );
}

export function LoadingSkeletons() {
  return (
    <div className="skeleton-grid" aria-label="Loading content">
      {Array.from({ length: 6 }, (_, index) => (
        <span className="skeleton" key={index} />
      ))}
    </div>
  );
}

export function FeaturePage({
  title,
  eyebrow,
  stats,
  rows,
  children,
}: {
  title: string;
  eyebrow: string;
  stats: Stat[];
  rows: Row[];
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} />
      <StatGrid stats={stats} />
      {children}
      <DataTable rows={rows} />
    </>
  );
}
