import { AppShell } from "@/components/app-shell";

export default function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
