import { Linking } from "react-native";

export interface WebHandoffTarget {
  baseUrl: string;
  sessionId: string;
  workspaceId?: string;
}

export function createWebHandoffUrl(target: WebHandoffTarget): string {
  const query = target.workspaceId ? `?workspaceId=${encodeURIComponent(target.workspaceId)}` : "";
  return `${target.baseUrl.replace(/\/$/, "")}/app/sessions/${encodeURIComponent(target.sessionId)}${query}`;
}

export async function openWebHandoff(target: WebHandoffTarget): Promise<void> {
  await Linking.openURL(createWebHandoffUrl(target));
}
