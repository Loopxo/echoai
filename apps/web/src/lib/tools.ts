import { integrations, mcpServers, skills, toolPolicies } from "./data";

export const browserAutomationTool = {
  id: "tool_browser_session",
  sandbox: "hosted browser session",
  quotas: { minutes: 30, screenshots: 100 },
  events: ["open", "click", "type", "screenshot", "extract"],
};

export const codeSandboxTool = {
  id: "tool_code_sandbox",
  sandbox: "hosted code runner",
  quotas: { cpuSeconds: 120, memoryMb: 1024 },
  languages: ["typescript", "python", "bash"],
};

export function exposedIntegrationTools(integrationId: string) {
  const integration = integrations.find((candidate) => candidate.id === integrationId);
  return integration?.exposedTools ?? [];
}

export function toolPolicyMatrix() {
  return toolPolicies.map((policy) => ({
    ...policy,
    editable: true,
  }));
}

export function mcpToolBrowser() {
  return mcpServers.flatMap((server) =>
    server.tools.map((tool) => ({
      server: server.name,
      status: server.status,
      tool,
      inspectable: true,
    })),
  );
}

export function skillLibrary() {
  return skills;
}
