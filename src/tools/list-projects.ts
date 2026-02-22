import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";

export default {
  type: "tool",
  name: "list-projects",
  description: "List all accessible Coverity projects",

  register(server: McpServer) {
    server.registerTool(
      "list_projects",
      {
        description:
          "List all Coverity projects the authenticated user can access",
      },
      async () => {
        const client = getCoverityClient();
        const projects = await client.listProjects();

        if (projects.length === 0) {
          return {
            content: [{ type: "text", text: "No projects found." }],
          };
        }

        const summary = projects.map((p) => ({
          name: p.id?.name ?? p.projectKey,
          key: p.projectKey,
          description: p.description ?? "",
          streams: p.streams?.map((s) => s.name) ?? [],
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }
    );
  },
} satisfies RegisterableModule;
