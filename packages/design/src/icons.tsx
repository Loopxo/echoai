import React from "react";

/**
 * Hand-authored 24x24 stroke icons in a Lucide-compatible style.
 *
 * Kept dependency-free on purpose: the desktop renderer runs under a strict CSP
 * that blocks remote assets, and an icon font or sprite sheet would be dead
 * weight next to a few hundred bytes of inline path data.
 */
export type IconName =
  // chrome + navigation
  | "sun"
  | "moon"
  | "search"
  | "command"
  | "plus"
  | "minus"
  | "x"
  | "check"
  | "chevron-right"
  | "chevron-down"
  | "chevron-left"
  | "chevron-up"
  | "chevrons-left"
  | "chevrons-right"
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "corner-down-left"
  | "more-horizontal"
  | "more-vertical"
  | "panel-left"
  | "panel-right"
  | "panel-bottom"
  | "maximize"
  | "minimize"
  | "square"
  | "external-link"
  // content + files
  | "file"
  | "file-text"
  | "file-code"
  | "folder"
  | "folder-open"
  | "layers"
  | "image"
  | "code"
  | "list"
  | "book"
  | "diff"
  | "branch"
  | "git-commit"
  // actions
  | "send"
  | "stop"
  | "copy"
  | "refresh"
  | "rotate-ccw"
  | "play"
  | "pause"
  | "trash"
  | "pencil"
  | "square-pen"
  | "paperclip"
  | "download"
  | "upload"
  | "pin"
  | "filter"
  | "link"
  | "eye"
  | "eye-off"
  // agent activity
  | "sparkles"
  | "terminal"
  | "wrench"
  | "hammer"
  | "zap"
  | "brain"
  | "bot"
  | "user"
  | "message-circle"
  | "globe"
  | "activity"
  | "loader"
  // status
  | "bell"
  | "alert-triangle"
  | "alert-circle"
  | "info"
  | "circle-check"
  | "clock"
  | "history"
  // system + settings
  | "settings"
  | "sliders"
  | "shield"
  | "lock"
  | "lock-open"
  | "key"
  | "plug"
  | "monitor"
  | "smartphone"
  | "calendar"
  | "cpu"
  | "database"
  | "cloud"
  | "cloud-off"
  | "log-out";

const PATHS: Record<IconName, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  command: <path d="M15 6a3 3 0 1 1 3 3h-3V6zM9 6a3 3 0 1 0-3 3h3V6zm0 12a3 3 0 1 1-3-3h3v3zm6 0a3 3 0 1 0 3-3h-3v3zM9 9h6v6H9z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-up": <path d="m18 15-6-6-6 6" />,
  "chevrons-left": <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />,
  "chevrons-right": <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />,
  "arrow-up": <path d="M12 19V5M5 12l7-7 7 7" />,
  "arrow-down": <path d="M12 5v14M19 12l-7 7-7-7" />,
  "arrow-left": <path d="M19 12H5M12 19l-7-7 7-7" />,
  "arrow-right": <path d="M5 12h14M12 5l7 7-7 7" />,
  "corner-down-left": <path d="M9 10 4 15l5 5M20 4v7a4 4 0 0 1-4 4H4" />,
  "more-horizontal": (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  "more-vertical": (
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  "panel-left": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  "panel-right": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </>
  ),
  "panel-bottom": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 15h18" />
    </>
  ),
  maximize: <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />,
  minimize: <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3" />,
  square: <rect x="5" y="5" width="14" height="14" rx="2" />,
  "external-link": <path d="M14 4h6v6M20 4l-8 8M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />,
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  "file-text": (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  "file-code": (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M10 12l-2 2.5L10 17M14 12l2 2.5L14 17" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  "folder-open": <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H6l-3 8zM3 19l3-8h16l-3 8z" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </>
  ),
  code: <path d="m9 17-5-5 5-5M15 7l5 5-5 5" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  book: <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2zM6 17h13" />,
  diff: <path d="M12 3v18M5 8h14M5 16h14" />,
  branch: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="8" r="2" />
      <path d="M6 8v8M18 10a6 6 0 0 1-6 6H8" />
    </>
  ),
  "git-commit": (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M3 12h5.5M15.5 12H21" />
    </>
  ),
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  refresh: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
  "rotate-ccw": <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
  play: <path d="M7 4l13 8-13 8V4z" />,
  pause: <path d="M9 5v14M15 5v14" />,
  trash: <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />,
  pencil: <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" />,
  "square-pen": <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6l-3 .6.6-3z" />,
  paperclip: <path d="M20.4 11.6 12 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" />,
  download: <path d="M12 3v12M7 11l5 5 5-5M4 19h16" />,
  upload: <path d="M12 17V5M7 9l5-5 5 5M4 21h16" />,
  pin: <path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3z" />,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  link: <path d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11.5 5.8M14 11a4 4 0 0 0-5.7 0l-3 3A4 4 0 1 0 11 19.7l1.5-1.5" />,
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  "eye-off": <path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.6M6.5 8.4A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 3.5-.6M9.5 9.7a3 3 0 0 0 4.2 4.2" />,
  sparkles: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />,
  terminal: (
    <>
      <path d="m4 17 6-6-6-6" />
      <path d="M12 19h8" />
    </>
  ),
  wrench: <path d="M14.5 6.5a4 4 0 1 0 5 5L21 10V4h-6zM12.5 8.5 4 17a2.8 2.8 0 0 0 4 4l8.5-8.5" />,
  hammer: <path d="m14 6 4-4 4 4-4 4zM15 9 4 20l-1.5-1.5L13.5 7.5M9.5 11.5 12.5 8.5" />,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  brain: <path d="M9 4a3 3 0 0 0-3 3 2.5 2.5 0 0 0-1 4.8A3 3 0 0 0 6.5 17 2.8 2.8 0 0 0 12 18V4.5A2.5 2.5 0 0 0 9 4zM15 4a3 3 0 0 1 3 3 2.5 2.5 0 0 1 1 4.8A3 3 0 0 1 17.5 17 2.8 2.8 0 0 1 12 18" />,
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M8 2.5h8" />
      <circle cx="9" cy="14" r="1.1" />
      <circle cx="15" cy="14" r="1.1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  "message-circle": <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-7 4 14L16 12h5" />,
  loader: <path d="M12 3v4M12 17v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M3 12h4M17 12h4M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  "alert-triangle": <path d="M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />,
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  "circle-check": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4.5l3.5 2" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.1 14a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2v.3a2 2 0 1 1-4 0V20a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.5 14H4a2 2 0 1 1 0-4h.4A1.7 1.7 0 0 0 5.6 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11 3.9V4a2 2 0 1 1 4 0v.4a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 .4 1.9h.3a2 2 0 1 1 0 4z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6z" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  "lock-open": (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.5-2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="4" />
      <path d="m10.8 11.2 8-8M17 4l3 3M14.5 6.5l3 3" />
    </>
  ),
  plug: <path d="M9 3v6M15 3v6M6 9h12v2a6 6 0 0 1-6 6 6 6 0 0 1-6-6zM12 17v4" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M10 10h4v4h-4zM10 2v4M14 2v4M10 18v4M14 18v4M2 10h4M2 14h4M18 10h4M18 14h4" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  cloud: <path d="M17.5 19H7a4 4 0 0 1-.7-7.9A5.5 5.5 0 0 1 17 9.5a4.75 4.75 0 0 1 .5 9.5z" />,
  "cloud-off": <path d="M3 3l18 18M8.5 8.2A5.5 5.5 0 0 1 17 9.5a4.75 4.75 0 0 1 2.9 8.2M15 19H7a4 4 0 0 1-.7-7.9" />,
  "log-out": <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
};

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "name" | "ref"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  title?: string;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = 16, color = "currentColor", strokeWidth = 1.8, title, ...rest },
  ref
) {
  return (
    <svg
      {...rest}
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
});

/** Every icon name, useful for gallery/debug surfaces and tests. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[];
