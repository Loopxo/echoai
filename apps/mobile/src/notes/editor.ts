export interface MobileNoteDraft {
  body: string;
  id?: string;
  projectId?: string;
  title: string;
  updatedAt: string;
}

export function createNoteDraft(projectId?: string): MobileNoteDraft {
  return {
    body: "",
    projectId,
    title: "",
    updatedAt: new Date().toISOString(),
  };
}

export function updateNoteDraft(draft: MobileNoteDraft, patch: Partial<Pick<MobileNoteDraft, "body" | "title">>): MobileNoteDraft {
  return {
    ...draft,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}
