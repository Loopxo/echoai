export interface MemorySuggestion {
  id: string;
  content: string;
  reason?: string;
  status: "pending" | "approved" | "dismissed";
}

export function approveMemorySuggestion(suggestion: MemorySuggestion): MemorySuggestion {
  return { ...suggestion, status: "approved" };
}

export function dismissMemorySuggestion(suggestion: MemorySuggestion): MemorySuggestion {
  return { ...suggestion, status: "dismissed" };
}
