import { createCliRuntimeKernel } from './cli-kernel.js';

const workflowKernel = createCliRuntimeKernel({ stateNamespace: 'cli' });

export function getWorkflowKernel() {
  return workflowKernel;
}

export async function ensureWorkflowSession(
  title: string,
  sessionId?: string
) {
  if (sessionId) {
    const session = await workflowKernel.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }
    return session;
  }

  return workflowKernel.createSession(title, 'system', 'workflow');
}
