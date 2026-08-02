/**
 * The EchoAI mark: an audio waveform inside a double ring.
 *
 * Drawn inline rather than loaded from assets/echo-logo.png so it inherits
 * `currentColor` and stays crisp at every size — the PNG is a flat black raster
 * and would disappear against the dark theme.
 */
export function EchoLogo({
  size = 20,
  strokeWidth = 1.5,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10.3" />
      <circle cx="12" cy="12" r="8.55" opacity="0.55" />
      {/* Symmetric bars, shortest at the edges and tallest at the centre. */}
      <path d="M6.35 10.6v2.8" />
      <path d="M8.2 8.5v7" />
      <path d="M10.1 7.2v9.6" />
      <path d="M12 6.1v11.8" />
      <path d="M13.9 7.2v9.6" />
      <path d="M15.8 8.5v7" />
      <path d="M17.65 10.6v2.8" />
    </svg>
  );
}

/** Filled badge variant for the dock-style brand mark and onboarding. */
export function EchoLogoBadge({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        flex: 'none',
        borderRadius: Math.round(size * 0.28),
        background: 'var(--primary)',
        color: 'var(--primary-fg)',
      }}
    >
      <EchoLogo size={Math.round(size * 0.72)} strokeWidth={1.7} />
    </span>
  );
}
