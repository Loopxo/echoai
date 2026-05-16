import { chats, files, memories, notes, projects } from "./data";

export function globalSearch(query: string) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  return [
    ...chats
      .filter((chat) => chat.title.toLowerCase().includes(normalized))
      .map((chat) => ({ type: "chat", id: chat.id, title: chat.title, href: `/app/chat/${chat.id}` })),
    ...projects
      .filter((project) => project.name.toLowerCase().includes(normalized))
      .map((project) => ({ type: "project", id: project.id, title: project.name, href: `/app/projects/${project.id}` })),
    ...notes
      .filter((note) => note.title.toLowerCase().includes(normalized) || note.markdown.toLowerCase().includes(normalized))
      .map((note) => ({ type: "note", id: note.id, title: note.title, href: "/app/notes" })),
    ...files
      .filter((file) => file.name.toLowerCase().includes(normalized))
      .map((file) => ({ type: "file", id: file.id, title: file.name, href: "/app/files" })),
    ...memories
      .filter((memory) => memory.text.toLowerCase().includes(normalized))
      .map((memory) => ({ type: "memory", id: memory.id, title: memory.text, href: "/app/memories" })),
  ];
}
