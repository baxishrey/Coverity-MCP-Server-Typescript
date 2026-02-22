import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isRegisterableModule } from "./types.js";
import { getModuleName, loadModule } from "./helpers.js";

export async function processModule(
  server: McpServer,
  filePath: string
): Promise<{ name: string; success: boolean }> {
  const name = getModuleName(filePath);
  try {
    const mod = await loadModule(filePath);
    if (!isRegisterableModule(mod)) {
      console.error(`[registry] ${name}: invalid module format, skipping`);
      return { name, success: false };
    }
    await mod.register(server);
    return { name, success: true };
  } catch (err) {
    console.error(`[registry] ${name}: failed to load -`, err);
    return { name, success: false };
  }
}
