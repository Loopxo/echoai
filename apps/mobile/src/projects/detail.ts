import type { MobileAutomationSummary, MobileFileSummary, MobileProjectContext, MobileSessionSummary } from "../protocol";

export interface MobileProjectNoteSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface MobileProjectMemorySummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface MobileProjectOutputSummary {
  id: string;
  title: string;
  kind: "file" | "link" | "artifact";
  updatedAt: string;
}

export interface GroupedProjectDetail {
  automations: MobileAutomationSummary[];
  chats: MobileSessionSummary[];
  files: MobileFileSummary[];
  memories: MobileProjectMemorySummary[];
  notes: MobileProjectNoteSummary[];
  outputs: MobileProjectOutputSummary[];
  project: MobileProjectContext["project"];
}

export function groupProjectDetail(
  context: MobileProjectContext,
  extras: Pick<GroupedProjectDetail, "memories" | "notes" | "outputs"> = { memories: [], notes: [], outputs: [] },
): GroupedProjectDetail {
  return {
    automations: context.automations,
    chats: context.sessions,
    files: context.files,
    memories: extras.memories,
    notes: extras.notes,
    outputs: extras.outputs,
    project: context.project,
  };
}
