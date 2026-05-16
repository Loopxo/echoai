import type { MobileEntityId, MobileRunStatus } from "../protocol";

export interface MobileRunTraceSummary {
  id: MobileEntityId;
  sessionId: MobileEntityId;
  status: MobileRunStatus;
  title: string;
  updatedAt: string;
  toolCallCount: number;
}

export function sortRunsByUpdatedAt(runs: MobileRunTraceSummary[]): MobileRunTraceSummary[] {
  return [...runs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
