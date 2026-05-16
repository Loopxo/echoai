export interface DesktopChangedFile {
  additions: number;
  deletions: number;
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
}

export function summarizeChangedFiles(files: DesktopChangedFile[]): string {
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  return `${files.length} files, +${additions} -${deletions}`;
}
