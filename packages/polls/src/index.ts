/**
 * EchoAI Polls - Interactive Polls and Voting
 */
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

export interface PollOption {
    id: string;
    text: string;
    votes: string[]; // User IDs
}

export interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    createdBy: string;
    createdAt: number;
    expiresAt?: number;
    multipleChoice: boolean;
    anonymous: boolean;
    closed: boolean;
    channelId?: string;
}

export interface PollResult {
    poll: Poll;
    totalVotes: number;
    results: Array<{
        option: PollOption;
        count: number;
        percentage: number;
    }>;
    winner?: PollOption;
}

export class PollManager extends EventEmitter {
    private polls: Map<string, Poll> = new Map();

    create(question: string, options: string[], createdBy: string, config?: {
        multipleChoice?: boolean;
        anonymous?: boolean;
        expiresInMs?: number;
        channelId?: string;
    }): Poll {
        const poll: Poll = {
            id: randomUUID().slice(0, 8),
            question,
            options: options.map((text, i) => ({ id: String(i + 1), text, votes: [] })),
            createdBy,
            createdAt: Date.now(),
            expiresAt: config?.expiresInMs ? Date.now() + config.expiresInMs : undefined,
            multipleChoice: config?.multipleChoice ?? false,
            anonymous: config?.anonymous ?? false,
            closed: false,
            channelId: config?.channelId,
        };

        this.polls.set(poll.id, poll);
        this.emit("created", poll);
        return poll;
    }

    vote(pollId: string, optionId: string, userId: string): { success: boolean; error?: string } {
        const poll = this.polls.get(pollId);
        if (!poll) return { success: false, error: "Poll not found" };
        if (poll.closed) return { success: false, error: "Poll is closed" };
        if (poll.expiresAt && Date.now() > poll.expiresAt) {
            poll.closed = true;
            return { success: false, error: "Poll has expired" };
        }

        const option = poll.options.find(o => o.id === optionId);
        if (!option) return { success: false, error: "Invalid option" };

        // Check for existing vote
        if (!poll.multipleChoice) {
            for (const opt of poll.options) {
                const idx = opt.votes.indexOf(userId);
                if (idx >= 0) opt.votes.splice(idx, 1);
            }
        } else if (option.votes.includes(userId)) {
            return { success: false, error: "Already voted for this option" };
        }

        option.votes.push(userId);
        this.emit("vote", poll, option, userId);
        return { success: true };
    }

    unvote(pollId: string, optionId: string, userId: string): boolean {
        const poll = this.polls.get(pollId);
        if (!poll || poll.closed) return false;
        const option = poll.options.find(o => o.id === optionId);
        if (!option) return false;
        const idx = option.votes.indexOf(userId);
        if (idx < 0) return false;
        option.votes.splice(idx, 1);
        return true;
    }

    close(pollId: string): boolean {
        const poll = this.polls.get(pollId);
        if (!poll) return false;
        poll.closed = true;
        this.emit("closed", poll);
        return true;
    }

    getResults(pollId: string): PollResult | null {
        const poll = this.polls.get(pollId);
        if (!poll) return null;

        const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
        const results = poll.options.map(option => ({
            option,
            count: option.votes.length,
            percentage: totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0,
        })).sort((a, b) => b.count - a.count);

        const winner = results[0]?.count > 0 ? results[0].option : undefined;
        return { poll, totalVotes, results, winner };
    }

    formatResults(pollId: string): string | null {
        const result = this.getResults(pollId);
        if (!result) return null;

        const lines = [
            `📊 **${result.poll.question}**`,
            "",
            ...result.results.map(r => {
                const bar = "█".repeat(Math.ceil(r.percentage / 5)) + "░".repeat(20 - Math.ceil(r.percentage / 5));
                return `${r.option.text}: ${bar} ${r.percentage}% (${r.count} votes)`;
            }),
            "",
            `Total votes: ${result.totalVotes}`,
        ];

        if (result.poll.closed) lines.push("🔒 Poll is closed");
        return lines.join("\n");
    }

    get(pollId: string): Poll | undefined { return this.polls.get(pollId); }
    list(channelId?: string): Poll[] {
        return [...this.polls.values()].filter(p => !channelId || p.channelId === channelId);
    }
    delete(pollId: string): boolean { return this.polls.delete(pollId); }
}

export function createPollManager(): PollManager { return new PollManager(); }
