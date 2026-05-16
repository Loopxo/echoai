import { AppShell } from "@/components/app-shell";
import { getWorkspaceStore } from "@/lib/server/store";

export default async function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  const state = await getWorkspaceStore().read();
  return <AppShell state={state}>{children}</AppShell>;
}
