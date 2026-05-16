export interface MobileNoteSummary {
  id: string;
  projectId?: string;
  title: string;
  updatedAt: string;
}

export function searchNotes(notes: MobileNoteSummary[], query: string): MobileNoteSummary[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return notes;
  return notes.filter((note) => note.title.toLowerCase().includes(normalizedQuery));
}
