import type { EchoAIMemory, EchoAINote } from "@echoai/contracts";
import { memories, notes } from "./data";

export function exportNote(note: EchoAINote, format: "markdown" | "pdf" | "docx") {
  return {
    noteId: note.id,
    format,
    fileName: `${note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format === "markdown" ? "md" : format}`,
    content: note.markdown,
  };
}

export function noteContext(noteId: string) {
  const note = notes.find((candidate) => candidate.id === noteId);
  return note ? `@note:${note.id}\n${note.markdown}` : "";
}

export function proposeMemory(sessionId: string): EchoAIMemory {
  return {
    id: `memory_proposed_${sessionId}`,
    scope: "workspace",
    text: "User prefers completing tickets with visible acceptance evidence and clean commits.",
    tags: ["workflow", "tickets"],
    status: "proposed",
    reason: "Extracted from the active chat session.",
  };
}

export function retrieveMemories(projectId: string, query: string) {
  const normalized = query.toLowerCase();
  return memories
    .filter((memory) => memory.status !== "disabled")
    .filter((memory) => memory.scope !== "project" || memory.projectId === projectId)
    .map((memory) => ({
      ...memory,
      retrievalReason: memory.text.toLowerCase().includes(normalized) ? "direct text match" : memory.reason,
    }));
}
