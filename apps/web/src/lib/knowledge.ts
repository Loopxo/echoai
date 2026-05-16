import { files } from "./data";

export function detectFileType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "text";
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "image";
  if (["md", "mdx"].includes(extension)) return "markdown";
  if (["ts", "tsx", "js", "jsx", "swift", "kt", "py", "go", "rs"].includes(extension)) return "code";
  if (extension === "csv") return "csv";
  if (extension === "docx") return "docx";
  return "text";
}

export function lexicalSearch(query: string) {
  const normalized = query.toLowerCase();
  return files.flatMap((file) =>
    file.chunks
      .filter((chunk) => chunk.text.toLowerCase().includes(normalized) || file.name.toLowerCase().includes(normalized))
      .map((chunk) => ({ file, chunk, score: chunk.lexicalScore })),
  );
}

export function semanticSearch(query: string) {
  const normalized = query.toLowerCase();
  return files.flatMap((file) =>
    file.chunks
      .filter((chunk) => chunk.semanticScore > 0.75 || chunk.text.toLowerCase().includes(normalized))
      .map((chunk) => ({ file, chunk, score: chunk.semanticScore, citation: chunk.citation })),
  );
}

export function deletionPlan(fileId: string) {
  const file = files.find((candidate) => candidate.id === fileId);
  return {
    fileId,
    fileName: file?.name ?? "unknown",
    steps: ["delete database record", "delete storage object", "delete text chunks", "delete embeddings", "write audit event"],
  };
}
