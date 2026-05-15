import type { EchoAIDesktopApi } from '@shared/ipc';

declare global {
  interface Window {
    echoaiDesktop: EchoAIDesktopApi;
  }
}

export {};
