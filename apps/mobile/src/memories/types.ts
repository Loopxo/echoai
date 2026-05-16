export interface MobileMemory {
  id: string;
  content: string;
  updatedAt: string;
  workspaceId: string;
}

export function upsertMemory(memories: MobileMemory[], memory: MobileMemory): MobileMemory[] {
  const existingIndex = memories.findIndex((item) => item.id === memory.id);
  if (existingIndex < 0) return [memory, ...memories];
  return memories.map((item) => item.id === memory.id ? memory : item);
}

export function deleteMemory(memories: MobileMemory[], memoryId: string): MobileMemory[] {
  return memories.filter((memory) => memory.id !== memoryId);
}
