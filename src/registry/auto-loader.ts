import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findModuleFiles } from "./helpers.js";
import { processModule } from "./module-processor.js";

export async function autoLoadRegistry(server: McpServer): Promise<void> {
  const files = await findModuleFiles();

  if (files.length === 0) {
    console.error("[registry] No modules found");
    return;
  }

  const results = await Promise.allSettled(
    files.map((f) => processModule(server, f))
  );

  let loaded = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.success) {
      loaded++;
    } else {
      failed++;
    }
  }

  console.error(`[registry] Loaded ${loaded} module(s), ${failed} failed`);
}
