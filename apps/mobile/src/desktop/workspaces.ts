export interface DesktopWorkspace {
  id: string;
  approved: boolean;
  lastOpenedAt?: string;
  name: string;
  path: string;
}

export function getApprovedDesktopWorkspaces(workspaces: DesktopWorkspace[]): DesktopWorkspace[] {
  return workspaces.filter((workspace) => workspace.approved);
}
