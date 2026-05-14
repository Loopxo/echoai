import { randomUUID } from "node:crypto";
import { type KernelTool } from "./types.js";

interface TodoToolOptions {
  workspaceRoot?: string;
}

export function createTodoTool(options: TodoToolOptions = {}): KernelTool {
  return {
    name: "todo_manage",
    description: "Manage session-level todos. Read, add, or complete tasks.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "add", "complete"] },
        task: { type: "string", description: "The task text (required for 'add')" },
        taskId: { type: "string", description: "The task ID (required for 'complete')" },
      },
      required: ["action"],
    },
    permission: { read: "allow" },
    async execute(input, context) {
      if (input.action === "list") {
        return {
          success: true,
          output: "Todos:\n" + (context.session?.tasks?.map(t => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.detail} (ID: ${t.id})`).join("\n") || "No tasks."),
          summary: "Listed todos",
        };
      }
      
      if (input.action === "add" && typeof input.task === "string") {
        const newTask = {
          id: randomUUID(),
          kind: "other" as const,
          title: "Todo",
          detail: input.task,
          status: "pending" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        context.session?.tasks?.push(newTask);
        return {
          success: true,
          output: `Added task: ${input.task} (ID: ${newTask.id})`,
          summary: "Added todo",
        };
      }

      if (input.action === "complete" && typeof input.taskId === "string") {
        const task = context.session?.tasks?.find(t => t.id === input.taskId);
        if (task) {
          task.status = "completed";
          task.updatedAt = Date.now();
          return {
            success: true,
            output: `Completed task: ${task.detail}`,
            summary: "Completed todo",
          };
        }
        return { success: false, error: "Task not found" };
      }

      return { success: false, error: "Invalid action or missing parameters." };
    },
  };
}

export function createTodoReadTool(_options: TodoToolOptions = {}): KernelTool {
  return {
    name: "todo_read",
    description: "Read the current session todo list.",
    inputSchema: { type: "object", properties: {} },
    permission: { read: "allow" },
    renderer: { kind: "task", collapsible: false },
    async execute(_input, context) {
      return {
        success: true,
        output: formatTodos(context.session?.tasks ?? []),
        summary: "Read todos",
      };
    },
  };
}

export function createTodoWriteTool(_options: TodoToolOptions = {}): KernelTool {
  return {
    name: "todo_write",
    description: "Replace the current session todo list with explicit pending/in-progress/completed tasks.",
    inputSchema: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "running", "completed"] },
            },
            required: ["content", "status"],
          },
        },
      },
      required: ["todos"],
    },
    permission: { read: "allow" },
    renderer: { kind: "task", collapsible: false },
    async execute(input, context) {
      if (!Array.isArray(input.todos)) {
        return { success: false, error: "todos must be an array" };
      }

      context.session.tasks = input.todos.map((todo) => {
        const item = todo && typeof todo === "object" ? todo as Record<string, unknown> : {};
        const content = typeof item.content === "string" ? item.content.trim() : "";
        const status = item.status === "completed" || item.status === "running" ? item.status : "pending";
        if (!content) {
          throw new Error("Todo content must be a non-empty string");
        }
        const now = Date.now();
        return {
          id: typeof item.id === "string" && item.id ? item.id : randomUUID(),
          kind: "other" as const,
          title: content.length > 80 ? `${content.slice(0, 77)}...` : content,
          detail: content,
          status,
          createdAt: now,
          updatedAt: now,
        };
      });

      return {
        success: true,
        output: formatTodos(context.session.tasks),
        summary: `Updated ${context.session.tasks.length} todos`,
      };
    },
  };
}

function formatTodos(tasks: Array<{ id: string; status: string; detail?: string; title: string }>): string {
  if (tasks.length === 0) return "No todos.";
  return tasks
    .map((task) => {
      const marker = task.status === "completed" ? "x" : task.status === "running" ? ">" : " ";
      return `- [${marker}] ${task.detail || task.title} (ID: ${task.id})`;
    })
    .join("\n");
}
