import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";

export default {
  type: "tool",
  name: "list-streams",
  description: "List Coverity streams, optionally filtered by project name",

  register(server: McpServer) {
    server.tool(
      "list_streams",
      "List Coverity streams. Optionally filter by project name.",
      {
        projectName: z
          .string()
          .optional()
          .describe("Filter streams by project name"),
      },
      async ({ projectName }) => {
        const client = getCoverityClient();
        const streams = await client.listStreams(projectName);

        if (streams.length === 0) {
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
          name: s.id?.name,
          language: s.language ?? "unknown",
          description: s.description ?? "",
          project: s.primaryProjectId?.name ?? "",
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
