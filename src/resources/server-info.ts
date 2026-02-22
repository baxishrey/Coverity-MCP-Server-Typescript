import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";

export default {
  type: "resource",
  name: "server-info",
  description: "Coverity server connection information",

  register(server: McpServer) {
    server.registerResource(
      "server-info",
      "coverity://server-info",
      { description: "Coverity server connection info" },
      async () => {
        const host = process.env["COVERITY_HOST"] ?? "(not configured)";
        const port = process.env["COVERITY_PORT"] ?? "8443";
        const ssl = process.env["COVERITY_SSL"] ?? "true";
        const user = process.env["COVERITY_USER"] ?? "(not configured)";

        const info = {
          host,
          port: parseInt(port, 10),
          ssl: ssl.toLowerCase() !== "false",
          user,
          configured:
            !!process.env["COVERITY_HOST"] &&
            !!process.env["COVERITY_USER"] &&
            !!process.env["COVERITY_AUTH_KEY"],
        };

        return {
          contents: [
            {
              uri: "coverity://server-info",
              mimeType: "application/json",
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }
    );
  },
} satisfies RegisterableModule;
