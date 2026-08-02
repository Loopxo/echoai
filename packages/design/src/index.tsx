/**
 * @echoai/design — shared design system.
 * Import tokens once at the app root: import "@echoai/design/tokens.css";
 */
export { Icon, ICON_NAMES, type IconName, type IconProps } from "./icons.js";
export { Markdown, type MarkdownProps } from "./markdown.js";
export { DiffView, type DiffViewProps, type DiffLine } from "./diff.js";
export {
  Button,
  type ButtonProps,
  Badge,
  type BadgeProps,
  Spinner,
  Skeleton,
  EmptyState,
  DesignKeyframes,
} from "./primitives.js";
