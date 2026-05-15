import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { LogSearchEntry } from '@shared/ipc';

type LogLevel = LogSearchEntry['level'];

export class DesktopLogger {
  private readonly mainLogFile: string;

  constructor(private readonly logsDir: string) {
    this.mainLogFile = join(logsDir, 'main.log');
  }

  async ready(): Promise<void> {
    await mkdir(this.logsDir, { recursive: true });
    await this.write('info', 'desktop logger ready');
  }

  debug(...values: unknown[]): void {
    void this.write('debug', ...values);
  }

  info(...values: unknown[]): void {
    void this.write('info', ...values);
  }

  warn(...values: unknown[]): void {
    void this.write('warn', ...values);
  }

  error(...values: unknown[]): void {
    void this.write('error', ...values);
  }

  async search(query: string, limit = 100): Promise<LogSearchEntry[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const files = await this.listLogFiles();
    const matches: LogSearchEntry[] = [];

    for (const file of files) {
      const content = await readFile(join(this.logsDir, file), 'utf8').catch(() => '');
      const lines = content.split(/\r?\n/);

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line) {
          continue;
        }

        if (normalizedQuery && !line.toLowerCase().includes(normalizedQuery)) {
          continue;
        }

        matches.push(this.parseLogLine(file, index + 1, line));
        if (matches.length >= limit) {
          return matches;
        }
      }
    }

    return matches;
  }

  private async write(level: LogLevel, ...values: unknown[]): Promise<void> {
    const timestamp = new Date().toISOString();
    const message = values.map(formatLogValue).join(' ');
    await appendFile(this.mainLogFile, `${timestamp} ${level.toUpperCase()} ${message}\n`).catch(
      () => undefined
    );
  }

  private async listLogFiles(): Promise<string[]> {
    const entries = await readdir(this.logsDir).catch(() => []);
    return entries.filter((entry) => entry.endsWith('.log')).sort();
  }

  private parseLogLine(file: string, line: number, value: string): LogSearchEntry {
    const match = value.match(/^(\S+)\s+(DEBUG|INFO|WARN|ERROR)\s+(.*)$/);
    if (!match) {
      return {
        file: basename(file),
        line,
        level: 'info',
        message: value,
        timestamp: '',
      };
    }

    return {
      file: basename(file),
      line,
      level: match[2].toLowerCase() as LogLevel,
      message: match[3],
      timestamp: match[1],
    };
  }
}

function formatLogValue(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}
