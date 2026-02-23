import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";
import { logger } from "../logger.js";

const TAG = "tool:list_projects";

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
        logger.info(TAG, "invoked");
        const client = getCoverityClient();
        const projects = await client.listProjects();

        if (projects.length === 0) {
          logger.info(TAG, "returned 0 projects");
          return {
            content: [{ type: "text", text: "No projects found." }],
          };
        }

        const summary = projects.map((p) => ({
          name: p.name,
          key: p.projectKey,
          description: p.description ?? "",
          streams: p.streams?.map((s) => s.name) ?? [],
        }));

        logger.info(TAG, `returning ${summary.length} project(s)`);
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
