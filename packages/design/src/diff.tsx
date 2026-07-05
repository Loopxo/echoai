import React from "react";

/**
 * Dependency-free diff viewer. Accepts either a unified-diff string or an
 * { oldText, newText } pair (LCS line diff). Renders add/remove/context lines
 * with gutter line numbers — the core review surface for a coding agent.
 */

export type DiffLine = {
  type: "add" | "remove" | "context" | "hunk";
  text: string;
  oldNo?: number;
  newNo?: number;
};

function lcsDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.replace(/\r\n/g, "\n").split("\n");
  const b = newText.replace(/\r\n/g, "\n").split("\n");
  const n = a.length;
  const m = b.length;
  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: "context", text: a[i]!, oldNo: oldNo++, newNo: newNo++ });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      lines.push({ type: "remove", text: a[i]!, oldNo: oldNo++ });
      i++;
    } else {
      lines.push({ type: "add", text: b[j]!, newNo: newNo++ });
      j++;
    }
  }
  while (i < n) lines.push({ type: "remove", text: a[i++]!, oldNo: oldNo++ });
  while (j < m) lines.push({ type: "add", text: b[j++]!, newNo: newNo++ });
  return lines;
}

function parseUnified(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of diff.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.startsWith("@@")) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (m) {
        oldNo = parseInt(m[1]!, 10);
        newNo = parseInt(m[2]!, 10);
      }
      lines.push({ type: "hunk", text: raw });
    } else if (raw.startsWith("+") && !raw.startsWith("+++")) {
      lines.push({ type: "add", text: raw.slice(1), newNo: newNo++ });
    } else if (raw.startsWith("-") && !raw.startsWith("---")) {
      lines.push({ type: "remove", text: raw.slice(1), oldNo: oldNo++ });
    } else if (raw.startsWith("diff ") || raw.startsWith("index ") || raw.startsWith("+++") || raw.startsWith("---")) {
      // file headers — skip from the rendered body
    } else {
      lines.push({ type: "context", text: raw.replace(/^ /, ""), oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return lines;
}

export interface DiffViewProps {
  unified?: string;
  oldText?: string;
  newText?: string;
  fileName?: string;
  style?: React.CSSProperties;
}

export function DiffView({ unified, oldText, newText, fileName, style }: DiffViewProps) {
  const lines = unified !== undefined ? parseUnified(unified) : lcsDiff(oldText ?? "", newText ?? "");
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "remove").length;

  return (
    <div style={{ border: "1px solid var(--ec-line)", borderRadius: "var(--ec-radius-md)", overflow: "hidden", ...style }}>
      <div style={header}>
        <span style={{ fontFamily: "var(--ec-font-mono)", fontSize: "var(--ec-text-sm)", color: "var(--ec-text)" }}>
          {fileName ?? "changes"}
        </span>
        <span style={{ display: "inline-flex", gap: 8, fontSize: "var(--ec-text-xs)", fontWeight: 700 }}>
          <span style={{ color: "var(--ec-success)" }}>+{added}</span>
          <span style={{ color: "var(--ec-danger)" }}>-{removed}</span>
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        {lines.map((line, index) => (
          <div key={index} style={rowStyle(line.type)}>
            <span style={gutter}>{line.oldNo ?? ""}</span>
            <span style={gutter}>{line.newNo ?? ""}</span>
            <span style={sign}>{line.type === "add" ? "+" : line.type === "remove" ? "-" : line.type === "hunk" ? "" : " "}</span>
            <span style={code}>{line.text || "\u00a0"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  background: "var(--ec-surface-2)",
  borderBottom: "1px solid var(--ec-line)",
};
function rowStyle(type: DiffLine["type"]): React.CSSProperties {
  const bg =
    type === "add"
      ? "rgba(34,197,94,0.12)"
      : type === "remove"
        ? "rgba(239,68,68,0.12)"
        : type === "hunk"
          ? "var(--ec-surface-3)"
          : "transparent";
  return {
    display: "grid",
    gridTemplateColumns: "44px 44px 16px 1fr",
    fontFamily: "var(--ec-font-mono)",
    fontSize: "var(--ec-text-sm)",
    lineHeight: 1.6,
    background: bg,
    color: type === "hunk" ? "var(--ec-text-subtle)" : "var(--ec-text)",
  };
}
const gutter: React.CSSProperties = {
  textAlign: "right",
  padding: "0 8px",
  color: "var(--ec-text-subtle)",
  userSelect: "none",
  borderRight: "1px solid var(--ec-line)",
};
const sign: React.CSSProperties = { textAlign: "center", color: "var(--ec-text-muted)" };
const code: React.CSSProperties = { padding: "0 10px", whiteSpace: "pre" };
