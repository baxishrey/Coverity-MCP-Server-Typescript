import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";
import { logger } from "../logger.js";

const TAG = "tool:list_streams";

export default {
  type: "tool",
  name: "list-streams",
  description: "List Coverity streams, optionally filtered by project name",

  register(server: McpServer) {
    server.registerTool(
      "list_streams",
      {
        description:
          "List Coverity streams. Optionally filter by project name.",
        inputSchema: {
          projectName: z
            .string()
            .optional()
            .describe("Filter streams by project name"),
        },
      },
      async ({ projectName }) => {
        logger.info(TAG, `invoked (projectName=${projectName ?? "*"})`);
        const client = getCoverityClient();
        const streams = await client.listStreams(projectName);

        if (streams.length === 0) {
          logger.info(TAG, "returned 0 streams");
          return {
            content: [
              {
                type: "text",
                text: projectName
                  ? `No streams found for project "${projectName}".`
                  : "No streams found.",
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
