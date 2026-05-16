import type { EchoAIKnowledgeFile, EchoAIWorkspaceState } from "@echoai/contracts";
import { detectFileType } from "@/lib/knowledge";
import { createAuditEvent, makeId } from "./store";

function tokenize(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function chunkText(text: string, maxLength = 900) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += maxLength) {
    chunks.push(text.slice(index, index + maxLength).trim());
  }
  return chunks.filter(Boolean);
}

function semanticScore(query: string, text: string) {
  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) return 0;
  const textTokens = new Set(tokenize(text));
  let matches = 0;
  queryTokens.forEach((token) => {
    if (textTokens.has(token)) matches += 1;
  });
  return matches / queryTokens.size;
}

export function createIndexedFile(input: {
  projectId: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  text?: string;
}): EchoAIKnowledgeFile {
  const id = makeId("file");
  const text = input.text ?? "";
  const chunks = chunkText(text || `${input.name} uploaded to EchoAI knowledge.`);
  return {
    id,
    projectId: input.projectId,
    name: input.name,
    path: `/uploads/${id}/${input.name}`,
    mimeType: input.mimeType ?? "text/plain",
    kind: detectFileType(input.name) as EchoAIKnowledgeFile["kind"],
    sizeBytes: input.sizeBytes ?? Buffer.byteLength(text || input.name),
    uploadProgress: 100,
    extractionStatus: chunks.length ? "indexed" : "skipped",
    chunks: chunks.map((chunk, index) => ({
      id: makeId("chunk"),
      fileId: id,
      text: chunk,
      lexicalScore: 1,
      semanticScore: 1,
      citation: `${input.name}#chunk-${index + 1}`,
    })),
  };
}

export function addIndexedFile(state: EchoAIWorkspaceState, input: Parameters<typeof createIndexedFile>[0]) {
  const file = createIndexedFile(input);
  state.files.push(file);
  const project = state.projects.find((candidate) => candidate.id === file.projectId);
  project?.fileIds.push(file.id);
  state.auditEvents.push(createAuditEvent("storage.object_created", `Indexed ${file.name}`, state));
  return file;
}

export function searchWorkspaceKnowledge(state: EchoAIWorkspaceState, query: string) {
  const normalized = query.toLowerCase();
  return state.files.flatMap((file) =>
    file.chunks
      .map((chunk) => ({
        file,
        chunk,
        lexicalScore: chunk.text.toLowerCase().includes(normalized) || file.name.toLowerCase().includes(normalized) ? 1 : 0,
        semanticScore: semanticScore(query, chunk.text),
      }))
      .filter((result) => result.lexicalScore > 0 || result.semanticScore > 0),
  );
}

export function hardDeleteFile(state: EchoAIWorkspaceState, fileId: string) {
  const file = state.files.find((candidate) => candidate.id === fileId);
  state.files = state.files.filter((candidate) => candidate.id !== fileId);
  state.projects = state.projects.map((project) => ({
    ...project,
    fileIds: project.fileIds.filter((id) => id !== fileId),
  }));
  state.auditEvents.push(createAuditEvent("storage.object_created", `Deleted file records, object, chunks, and embeddings for ${file?.name ?? fileId}`, state));
  return file;
}
