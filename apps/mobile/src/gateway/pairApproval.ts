import type { MobilePairingChallenge } from "../protocol";

export type PairApprovalStatus = "waiting-for-desktop" | "approved" | "denied" | "expired" | "cancelled";

export interface PairApprovalState {
  challenge: MobilePairingChallenge;
  status: PairApprovalStatus;
  updatedAt: string;
}

export function createPendingPairApproval(challenge: MobilePairingChallenge, now: Date = new Date()): PairApprovalState {
  return {
    challenge,
    status: isChallengeExpired(challenge, now) ? "expired" : "waiting-for-desktop",
    updatedAt: now.toISOString(),
  };
}

export function isChallengeExpired(challenge: MobilePairingChallenge, now: Date = new Date()): boolean {
  const expiresAt = new Date(challenge.expiresAt).getTime();
  return Number.isNaN(expiresAt) || expiresAt <= now.getTime();
}
