import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({ variant = "secondary", size = "md", style, children, ...rest }: ButtonProps) {
  return (
    <button {...rest} style={{ ...buttonBase(variant, size), ...style }}>
      {children}
    </button>
  );
}

export interface BadgeProps {
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge({ tone = "neutral", children, style }: BadgeProps) {
  const colors: Record<string, [string, string]> = {
    neutral: ["var(--ec-surface-3)", "var(--ec-text-muted)"],
    brand: ["rgba(16,185,129,0.16)", "var(--ec-accent)"],
    success: ["rgba(34,197,94,0.16)", "var(--ec-success)"],
    warning: ["rgba(245,158,11,0.16)", "var(--ec-warning)"],
    danger: ["rgba(239,68,68,0.16)", "var(--ec-danger)"],
  };
  const [bg, fg] = colors[tone]!;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: bg,
        color: fg,
        borderRadius: "var(--ec-radius-full)",
        padding: "2px 9px",
        fontSize: "var(--ec-text-xs)",
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-label="Loading"
      role="status"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid var(--ec-line)`,
        borderTopColor: "var(--ec-accent)",
        borderRadius: "50%",
        animation: "ec-spin 0.7s linear infinite",
      }}
    />
  );
}

export function Skeleton({ width = "100%", height = 14, radius = 6, style }: { width?: number | string; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, var(--ec-surface-2) 25%, var(--ec-surface-3) 37%, var(--ec-surface-2) 63%)",
        backgroundSize: "400% 100%",
        animation: "ec-shimmer 1.4s ease infinite",
        ...style,
      }}
    />
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 8,
        padding: "32px 16px",
        textAlign: "center",
        color: "var(--ec-text-muted)",
      }}
    >
      <strong style={{ color: "var(--ec-text)", fontSize: "var(--ec-text-md)" }}>{title}</strong>
      {description ? <span style={{ fontSize: "var(--ec-text-sm)", maxWidth: 360 }}>{description}</span> : null}
      {action}
    </div>
  );
}

/** Inject keyframes used by Spinner/Skeleton once. Mount near the app root. */
export function DesignKeyframes() {
  return (
    <style>{`
      @keyframes ec-spin { to { transform: rotate(360deg); } }
      @keyframes ec-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
    `}</style>
  );
}

function buttonBase(variant: Variant, size: "sm" | "md"): React.CSSProperties {
  const palette: Record<Variant, React.CSSProperties> = {
    primary: { background: "var(--ec-accent)", color: "var(--ec-accent-contrast)", border: "1px solid transparent" },
    secondary: { background: "var(--ec-surface-2)", color: "var(--ec-text)", border: "1px solid var(--ec-line)" },
    ghost: { background: "transparent", color: "var(--ec-text-muted)", border: "1px solid transparent" },
    danger: { background: "var(--ec-danger)", color: "#fff", border: "1px solid transparent" },
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "var(--ec-font-sans)",
    fontWeight: 600,
    fontSize: size === "sm" ? "var(--ec-text-sm)" : "var(--ec-text-base)",
    padding: size === "sm" ? "5px 10px" : "8px 14px",
    borderRadius: "var(--ec-radius-sm)",
    cursor: "pointer",
    transition: "background-color var(--ec-dur-fast) var(--ec-ease), transform var(--ec-dur-fast) var(--ec-ease)",
    ...palette[variant],
  };
}
