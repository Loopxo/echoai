/** Presentation formatters. Pure functions, no React. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Accepts either an ISO string or epoch millis; returns NaN-safe millis. */
export function toMillis(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const millis = typeof value === 'number' ? value : Date.parse(value);
  return Number.isNaN(millis) ? null : millis;
}

/** "now", "4m", "3h", "2d", then a short date. Compact enough for list rows. */
export function formatRelative(value: string | number | null | undefined, now = Date.now()): string {
  const millis = toMillis(value);
  if (millis === null) {
    return '';
  }

  const delta = now - millis;
  if (delta < MINUTE) {
    return 'now';
  }
  if (delta < HOUR) {
    return `${Math.floor(delta / MINUTE)}m`;
  }
  if (delta < DAY) {
    return `${Math.floor(delta / HOUR)}h`;
  }
  if (delta < 7 * DAY) {
    return `${Math.floor(delta / DAY)}d`;
  }
  return new Date(millis).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatClock(value: string | number | null | undefined): string {
  const millis = toMillis(value);
  if (millis === null) {
    return '';
  }
  return new Date(millis).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value: string | number | null | undefined): string {
  const millis = toMillis(value);
  if (millis === null) {
    return 'Unknown';
  }
  return new Date(millis).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** Compact elapsed time: 0s, 59s, 1m 04s, 1h 02m. Matches the Codex format. */
export function formatElapsed(millis: number): string {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function formatUsdMicros(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}`;
}

/** Last path segment, tolerant of both separators. */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function dirname(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  parts.pop();
  return parts.join('/');
}

/** Collapse a long absolute path to `…/parent/leaf` for narrow chrome. */
export function shortenPath(path: string, segments = 2): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= segments) {
    return path;
  }
  return `…/${parts.slice(-segments).join('/')}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

/** First line of a possibly multi-line string, with an ellipsis if truncated. */
export function firstLine(value: string, max = 120): string {
  const [first = ''] = value.replace(/\r/g, '').split('\n');
  const suffix = value.includes('\n') ? ' …' : '';
  return `${truncate(first, max)}${suffix}`;
}

export type DateBucket = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Previous 30 days' | 'Older';

const BUCKET_ORDER: DateBucket[] = [
  'Today',
  'Yesterday',
  'Previous 7 days',
  'Previous 30 days',
  'Older',
];

function startOfDay(millis: number): number {
  const date = new Date(millis);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dateBucket(value: string | number, now = Date.now()): DateBucket {
  const millis = toMillis(value);
  if (millis === null) {
    return 'Older';
  }

  const today = startOfDay(now);
  if (millis >= today) {
    return 'Today';
  }
  if (millis >= today - DAY) {
    return 'Yesterday';
  }
  if (millis >= today - 7 * DAY) {
    return 'Previous 7 days';
  }
  if (millis >= today - 30 * DAY) {
    return 'Previous 30 days';
  }
  return 'Older';
}

/**
 * Group items into Today / Yesterday / … buckets, newest first within each,
 * dropping empty buckets. This is the sidebar thread grouping.
 */
export function groupByDate<T>(
  items: T[],
  getTimestamp: (item: T) => string | number
): Array<{ label: DateBucket; items: T[] }> {
  const now = Date.now();
  const buckets = new Map<DateBucket, T[]>();

  for (const item of items) {
    const label = dateBucket(getTimestamp(item), now);
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(label, [item]);
    }
  }

  return BUCKET_ORDER.flatMap((label) => {
    const bucketItems = buckets.get(label);
    if (!bucketItems || bucketItems.length === 0) {
      return [];
    }
    bucketItems.sort((left, right) => (toMillis(getTimestamp(right)) ?? 0) - (toMillis(getTimestamp(left)) ?? 0));
    return [{ label, items: bucketItems }];
  });
}

/** Simple subsequence fuzzy match with a score, used by the command palette. */
export function fuzzyScore(haystack: string, needle: string): number | null {
  if (!needle) {
    return 0;
  }

  const target = haystack.toLowerCase();
  const query = needle.toLowerCase();

  // Exact substring wins, and earlier matches win over later ones.
  const direct = target.indexOf(query);
  if (direct >= 0) {
    return 1000 - direct;
  }

  let score = 0;
  let cursor = 0;
  let streak = 0;
  for (const char of query) {
    const index = target.indexOf(char, cursor);
    if (index < 0) {
      return null;
    }
    streak = index === cursor ? streak + 1 : 0;
    score += 10 + streak * 4 - Math.min(index - cursor, 8);
    cursor = index + 1;
  }
  return score;
}
