// Session state management for file operations
export interface SessionState {
  autoApproveEdits: boolean;
  autoApproveCreations: boolean;
  sessionStartTime: number;
}

// Global session state - resets when CLI restarts
let sessionState: SessionState = {
  autoApproveEdits: false,
  autoApproveCreations: false,
  sessionStartTime: Date.now()
};

export function getSessionState(): SessionState {
  return { ...sessionState };
}

export function setAutoApproveEdits(enabled: boolean): void {
  sessionState.autoApproveEdits = enabled;
  if (enabled) {
    console.log('✅ Auto-approving file edits for this session');
  }
}

export function setAutoApproveCreations(enabled: boolean): void {
  sessionState.autoApproveCreations = enabled;
  if (enabled) {
    console.log('✅ Auto-approving file creations for this session');
  }
}

export function shouldAutoApprove(operationType: 'edit' | 'create'): boolean {
  return operationType === 'edit' 
    ? sessionState.autoApproveEdits 
    : sessionState.autoApproveCreations;
}

export function resetSession(): void {
  sessionState = {
    autoApproveEdits: false,
    autoApproveCreations: false,
    sessionStartTime: Date.now()
  };
}

export function getSessionDuration(): number {
  return Date.now() - sessionState.sessionStartTime;
}