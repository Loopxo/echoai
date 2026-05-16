import { renderAppPage } from "@/lib/page-registry";
import { getWorkspaceStore } from "@/lib/server/store";

export default async function AppCatchAllPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments } = await params;
  const state = await getWorkspaceStore().read();
  return renderAppPage(segments ?? [], state);
}
