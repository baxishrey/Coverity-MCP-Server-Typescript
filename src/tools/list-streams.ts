import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";
import { logger } from "../logger.js";

const TAG = "tool:list_streams";

export default {
  type: "tool",
  name: "list-streams",
  description: "List Coverity streams for the configured project",

  register(server: McpServer) {
    server.registerTool(
      "list_streams",
      {
        description:
          "List Coverity streams for the configured project.",
        inputSchema: {},
      },
      async () => {
        const client = getCoverityClient();
        logger.info(TAG, `invoked (project="${client.projectName}")`);
        const streams = await client.listStreams();

        if (streams.length === 0) {
          logger.info(TAG, "returned 0 streams");
          return {
            content: [
              {
                type: "text",
                text: `No streams found for project "${client.projectName}".`,
              },
            ],
          };
        }

        const summary = streams.map((s) => ({
          name: s.name,
          language: s.language ?? "unknown",
          description: s.description ?? "",
          project: s.primaryProjectName ?? "",
        }));

        logger.info(TAG, `returning ${summary.length} stream(s)`);
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
