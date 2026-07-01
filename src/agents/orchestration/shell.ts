import { spawn } from 'node:child_process';

export interface ShellCaptureResult {
  code: number;
  output: string;
}

/**
 * Run a shell command capturing combined stdout/stderr with a timeout.
 * Used by the orchestrator's verification step (build/test).
 */
export function runShellCapture(command: string, cwd: string, timeoutMs = 600_000): Promise<ShellCaptureResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
    });

    let output = '';
    const append = (chunk: Buffer) => {
      output += chunk.toString();
      // Bound memory: keep only the last ~64KB.
      if (output.length > 65_536) output = output.slice(-65_536);
    };

    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      output += `\n[timed out after ${timeoutMs}ms]`;
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: 1, output: output + `\n[spawn error: ${error.message}]` });
    });
  });
}
