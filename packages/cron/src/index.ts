/**
 * EchoAI Cron - Scheduled Tasks
 */
import { EventEmitter } from "node:events";

export interface CronJob {
    id: string;
    name: string;
    schedule: string; // Cron expression
    handler: () => Promise<void>;
    enabled: boolean;
    lastRun?: number;
    nextRun?: number;
}

export interface ParsedCron {
    minute: number[];
    hour: number[];
    dayOfMonth: number[];
    month: number[];
    dayOfWeek: number[];
}

function parseField(field: string, min: number, max: number): number[] {
    if (field === "*") return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    if (field.includes("/")) {
        const [range, step] = field.split("/");
        const stepNum = parseInt(step, 10);
        const values = parseField(range === "*" ? `${min}-${max}` : range, min, max);
        return values.filter((_, i) => i % stepNum === 0);
    }
    if (field.includes("-")) {
        const [start, end] = field.split("-").map(Number);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    if (field.includes(",")) return field.split(",").map(Number);
    return [parseInt(field, 10)];
}

export function parseCronExpression(expr: string): ParsedCron {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) throw new Error(`Invalid cron: ${expr}`);
    return {
        minute: parseField(parts[0], 0, 59),
        hour: parseField(parts[1], 0, 23),
        dayOfMonth: parseField(parts[2], 1, 31),
        month: parseField(parts[3], 1, 12),
        dayOfWeek: parseField(parts[4], 0, 6),
    };
}

export function getNextRun(parsed: ParsedCron, from = new Date()): Date {
    const next = new Date(from);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);

    for (let i = 0; i < 366 * 24 * 60; i++) {
        const m = next.getMinutes(), h = next.getHours();
        const dom = next.getDate(), mon = next.getMonth() + 1, dow = next.getDay();
        if (parsed.minute.includes(m) && parsed.hour.includes(h) &&
            parsed.dayOfMonth.includes(dom) && parsed.month.includes(mon) &&
            parsed.dayOfWeek.includes(dow)) {
            return next;
        }
        next.setMinutes(next.getMinutes() + 1);
    }
    throw new Error("Could not find next run time");
}

export class CronScheduler extends EventEmitter {
    private jobs: Map<string, CronJob> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private running = false;

    add(job: Omit<CronJob, "lastRun" | "nextRun">): void {
        const parsed = parseCronExpression(job.schedule);
        const nextRun = getNextRun(parsed).getTime();
        this.jobs.set(job.id, { ...job, nextRun });
        if (this.running && job.enabled) this.scheduleJob(job.id);
    }

    remove(id: string): void {
        this.jobs.delete(id);
        const timer = this.timers.get(id);
        if (timer) { clearTimeout(timer); this.timers.delete(id); }
    }

    start(): void {
        this.running = true;
        for (const job of this.jobs.values()) {
            if (job.enabled) this.scheduleJob(job.id);
        }
    }

    stop(): void {
        this.running = false;
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
    }

    private scheduleJob(id: string): void {
        const job = this.jobs.get(id);
        if (!job || !job.enabled) return;

        const parsed = parseCronExpression(job.schedule);
        const nextRun = getNextRun(parsed);
        job.nextRun = nextRun.getTime();
        const delay = Math.max(0, nextRun.getTime() - Date.now());

        const timer = setTimeout(async () => {
            job.lastRun = Date.now();
            this.emit("run", job);
            try {
                await job.handler();
                this.emit("complete", job);
            } catch (err) {
                this.emit("error", job, err);
            }
            if (this.running && job.enabled) this.scheduleJob(id);
        }, delay);

        this.timers.set(id, timer);
    }

    list(): CronJob[] { return Array.from(this.jobs.values()); }
}

export function createCronScheduler(): CronScheduler { return new CronScheduler(); }
