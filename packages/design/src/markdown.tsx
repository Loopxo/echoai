import React, { useState } from "react";
import { Icon } from "./icons.js";

/**
 * Lightweight, dependency-free markdown renderer tuned for chat/agent output:
 * fenced code blocks (with language label + copy), inline code, bold/italic,
 * headings, ordered/unordered lists, blockquotes, links, and paragraphs.
 * Intentionally avoids heavy markdown/highlighter deps to keep bundles lean.
 */

type Block =
  | { type: "code"; lang: string; content: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "p"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code
    const fence = /^```(\w+)?\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) {
        buf.push(lines[i]!);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: "code", lang, content: buf.join("\n") });
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        buf.push(lines[i]!.replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: buf.join(" ") });
      continue;
    }

    // Lists
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      const matcher = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      while (i < lines.length && matcher.test(lines[i]!)) {
        items.push(matcher.exec(lines[i]!)![1]!);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (gather until blank or block start)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^```/.test(lines[i]!) &&
      !/^#{1,6}\s/.test(lines[i]!) &&
      !/^>\s?/.test(lines[i]!) &&
      !/^\s*[-*]\s+/.test(lines[i]!) &&
      !/^\s*\d+\.\s+/.test(lines[i]!)
    ) {
      buf.push(lines[i]!);
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }

  return blocks;
}

/** Render inline markdown (bold, italic, code, links) to React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = regex.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${n++}`;
    if (match[2]) nodes.push(<strong key={key}>{match[2]}</strong>);
    else if (match[4]) nodes.push(<code key={key} style={inlineCode}>{match[4]}</code>);
    else if (match[6]) nodes.push(<em key={key}>{match[6]}</em>);
    else if (match[8]) nodes.push(<a key={key} href={match[9]} style={linkStyle} target="_blank" rel="noreferrer">{match[8]}</a>);
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div style={codeWrap}>
      <div style={codeHeader}>
        <span style={codeLang}>{lang || "code"}</span>
        <button type="button" onClick={copy} style={copyBtn} aria-label="Copy code">
          <Icon name={copied ? "check" : "copy"} size={13} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={codePre}>
        <code style={{ fontFamily: "var(--ec-font-mono)" }}>{content}</code>
      </pre>
    </div>
  );
}

export interface MarkdownProps {
  content: string;
  style?: React.CSSProperties;
}

export function Markdown({ content, style }: MarkdownProps) {
  const blocks = parseBlocks(content ?? "");
  return (
    <div style={{ color: "var(--ec-text)", lineHeight: "var(--ec-leading)", ...style }}>
      {blocks.map((block, index) => {
        const key = `b-${index}`;
        switch (block.type) {
          case "code":
            return <CodeBlock key={key} lang={block.lang} content={block.content} />;
          case "heading": {
            const Tag = (`h${Math.min(block.level + 2, 6)}`) as keyof React.JSX.IntrinsicElements;
            return (
              <Tag key={key} style={{ margin: "12px 0 6px", fontWeight: 700 }}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case "list":
            return block.ordered ? (
              <ol key={key} style={listStyle}>
                {block.items.map((item, j) => <li key={j}>{renderInline(item, `${key}-${j}`)}</li>)}
              </ol>
            ) : (
              <ul key={key} style={listStyle}>
                {block.items.map((item, j) => <li key={j}>{renderInline(item, `${key}-${j}`)}</li>)}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={key} style={quoteStyle}>
                {renderInline(block.text, key)}
              </blockquote>
            );
          default:
            return (
              <p key={key} style={{ margin: "6px 0" }}>
                {renderInline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}

const inlineCode: React.CSSProperties = {
  fontFamily: "var(--ec-font-mono)",
  background: "var(--ec-code-bg)",
  borderRadius: 4,
  padding: "1px 5px",
  fontSize: "0.9em",
};
const linkStyle: React.CSSProperties = { color: "var(--ec-accent)", textDecoration: "underline" };
const listStyle: React.CSSProperties = { margin: "6px 0", paddingLeft: 20, display: "grid", gap: 3 };
const quoteStyle: React.CSSProperties = {
  margin: "8px 0",
  padding: "6px 12px",
  borderLeft: "3px solid var(--ec-accent)",
  color: "var(--ec-text-muted)",
};
const codeWrap: React.CSSProperties = {
  margin: "8px 0",
  border: "1px solid var(--ec-line)",
  borderRadius: "var(--ec-radius-md)",
  overflow: "hidden",
  background: "var(--ec-code-bg)",
};
const codeHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 10px",
  borderBottom: "1px solid var(--ec-line)",
  background: "var(--ec-surface-2)",
};
const codeLang: React.CSSProperties = {
  fontSize: "var(--ec-text-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--ec-text-subtle)",
  fontWeight: 700,
};
const copyBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "transparent",
  border: "1px solid var(--ec-line)",
  borderRadius: "var(--ec-radius-sm)",
  color: "var(--ec-text-muted)",
  padding: "3px 8px",
  fontSize: "var(--ec-text-xs)",
  cursor: "pointer",
};
const codePre: React.CSSProperties = {
  margin: 0,
  padding: "12px 14px",
  overflowX: "auto",
  fontSize: "var(--ec-text-sm)",
  lineHeight: 1.55,
};
