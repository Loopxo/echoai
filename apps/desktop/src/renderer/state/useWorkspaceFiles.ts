import { useCallback, useEffect, useState } from 'react';
import type {
  DesktopArtifactEntry,
  DesktopFilePreview,
  DesktopWorkspaceDiagnostic,
  DesktopWorkspaceEntry,
  DesktopWorkspaceIndex,
  DesktopWorkspaceSearchResult,
  DesktopWorkspaceSymbol,
} from '@shared/ipc';

export interface WorkspaceFilesApi {
  entries: DesktopWorkspaceEntry[];
  recent: DesktopWorkspaceEntry[];
  artifacts: DesktopArtifactEntry[];
  index: DesktopWorkspaceIndex | null;
  diagnostics: DesktopWorkspaceDiagnostic[];
  preview: DesktopFilePreview | null;
  previewPath: string | null;
  searchResults: DesktopWorkspaceSearchResult[];
  symbols: DesktopWorkspaceSymbol[];
  loading: boolean;
  open: (relativePath: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearPreview: () => void;
}

/** Workspace file tree, preview, search and artifacts for the right panel. */
export function useWorkspaceFiles(
  workspacePath: string | null,
  onError: (title: string, body: string) => void
): WorkspaceFilesApi {
  const [entries, setEntries] = useState<DesktopWorkspaceEntry[]>([]);
  const [recent, setRecent] = useState<DesktopWorkspaceEntry[]>([]);
  const [artifacts, setArtifacts] = useState<DesktopArtifactEntry[]>([]);
  const [index, setIndex] = useState<DesktopWorkspaceIndex | null>(null);
  const [diagnostics, setDiagnostics] = useState<DesktopWorkspaceDiagnostic[]>([]);
  const [preview, setPreview] = useState<DesktopFilePreview | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DesktopWorkspaceSearchResult[]>([]);
  const [symbols, setSymbols] = useState<DesktopWorkspaceSymbol[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setEntries([]);
      setRecent([]);
      setIndex(null);
      setDiagnostics([]);
      return;
    }

    setLoading(true);
    try {
      const [files, workspaceIndex, workspaceDiagnostics, recentFiles, artifactList] =
        await Promise.all([
          window.echoaiDesktop.listWorkspaceFiles(workspacePath),
          window.echoaiDesktop.indexWorkspace(workspacePath),
          window.echoaiDesktop.listWorkspaceDiagnostics(workspacePath),
          window.echoaiDesktop.listRecentWorkspaceFiles(workspacePath),
          window.echoaiDesktop.listArtifacts(),
        ]);
      setEntries(files);
      setIndex(workspaceIndex);
      setDiagnostics(workspaceDiagnostics);
      setRecent(recentFiles);
      setArtifacts(artifactList);
    } catch (error) {
      onError('Could not read workspace', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [workspacePath, onError]);

  useEffect(() => {
    setPreview(null);
    setPreviewPath(null);
    setSearchResults([]);
    setSymbols([]);
    void refresh();
  }, [refresh]);

  const open = useCallback(
    async (relativePath: string) => {
      if (!workspacePath) {
        return;
      }
      try {
        setPreviewPath(relativePath);
        setPreview(await window.echoaiDesktop.previewWorkspaceFile(workspacePath, relativePath));
      } catch (error) {
        onError('Could not open file', error instanceof Error ? error.message : String(error));
      }
    },
    [workspacePath, onError]
  );

  const search = useCallback(
    async (query: string) => {
      if (!workspacePath) {
        return;
      }
      if (!query.trim()) {
        setSearchResults([]);
        setSymbols([]);
        return;
      }
      try {
        const [results, matchedSymbols] = await Promise.all([
          window.echoaiDesktop.searchWorkspace(workspacePath, query),
          window.echoaiDesktop.listWorkspaceSymbols(workspacePath, query),
        ]);
        setSearchResults(results);
        setSymbols(matchedSymbols.slice(0, 20));
      } catch (error) {
        onError('Search failed', error instanceof Error ? error.message : String(error));
      }
    },
    [workspacePath, onError]
  );

  return {
    entries,
    recent,
    artifacts,
    index,
    diagnostics,
    preview,
    previewPath,
    searchResults,
    symbols,
    loading,
    open,
    search,
    refresh,
    clearPreview: () => {
      setPreview(null);
      setPreviewPath(null);
    },
  };
}
