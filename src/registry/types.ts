import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ModuleType = "tool" | "resource" | "prompt";

export interface RegisterableModule {
  type: ModuleType;
  name: string;
  description?: string;
  register(server: McpServer): void | Promise<void>;
}

export function isRegisterableModule(value: unknown): value is RegisterableModule {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj["type"] === "string" &&
    ["tool", "resource", "prompt"].includes(obj["type"] as string) &&
    typeof obj["name"] === "string" &&
    typeof obj["register"] === "function"
  );
}
