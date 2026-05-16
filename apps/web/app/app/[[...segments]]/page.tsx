import { renderAppPage } from "@/lib/page-registry";

export default async function AppCatchAllPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments } = await params;
  return renderAppPage(segments ?? []);
}
