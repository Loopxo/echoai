import type { MobileFileSummary } from "../protocol";

export type FileUploadKind = "photo" | "video" | "document" | "file";

export interface FileUploadProgress {
  file: MobileFileSummary;
  kind: FileUploadKind;
  progress: number;
}

export function updateFileUploadProgress(upload: FileUploadProgress, progress: number): FileUploadProgress {
  return {
    ...upload,
    progress: Math.max(0, Math.min(progress, 1)),
  };
}
