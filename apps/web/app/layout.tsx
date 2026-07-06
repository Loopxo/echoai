import type { Metadata } from "next";
import "@echoai/design/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoAI Web",
  description: "Private EchoAI React app for chat, projects, knowledge, tools, automations, billing, and devices.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
