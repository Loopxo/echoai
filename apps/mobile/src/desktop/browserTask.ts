export interface DesktopBrowserTask {
  currentUrl?: string;
  id: string;
  lastScreenshotUri?: string;
  status: "queued" | "running" | "waiting" | "completed" | "failed";
  title: string;
  updatedAt: string;
}
