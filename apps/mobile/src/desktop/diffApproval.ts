import type { DesktopChangedFile } from "./changedFiles";

export interface RemoteDiffApproval {
  changedFiles: DesktopChangedFile[];
  id: string;
  patchPreview: string;
  status: "pending" | "approved" | "rejected";
  title: string;
}

export function decideRemoteDiffApproval(
  approval: RemoteDiffApproval,
  decision: "approved" | "rejected",
): RemoteDiffApproval {
  return {
    ...approval,
    status: decision,
  };
}
