import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";

export default {
  type: "tool",
  name: "search-issues",
  description: "Search for defects/issues in a Coverity stream",

  register(server: McpServer) {
    server.registerTool(
      "search_issues",
      {
        description:
          "Search for static analysis defects in a Coverity stream. Returns CID, checker, file, function, impact, and status for each issue.",
        inputSchema: {
          streamId: z
            .string()
            .describe("The project name to search in (maps to the project filter in the v2 API)"),
          checker: z
            .string()
            .optional()
            .describe(
              "Filter by checker name (e.g. RESOURCE_LEAK, NULL_RETURNS)"
            ),
          impact: z
            .string()
            .optional()
            .describe("Filter by impact: High, Medium, or Low"),
          status: z
            .string()
            .optional()
            .describe("Filter by status: New, Triaged, Fixed, Dismissed"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(200)
            .optional()
            .describe("Maximum number of results (default 25, max 200)"),
          offset: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Pagination offset (default 0)"),
        },
      },
      async ({ streamId, checker, impact, status, limit, offset }) => {
        const client = getCoverityClient();
        const issues = await client.searchIssues(streamId, {
          checker,
          impact,
          status,
          limit,
          offset,
        });

        if (issues.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No issues found in stream "${streamId}" with the given filters.`,
              },
            ],
          };
        }

        const summary = issues.map((i) => ({
          cid: i.cid,
          checker: i.checkerName,
          type: i.displayType,
          impact: i.displayImpact,
          status: i.displayStatus,
          file: i.displayFile,
          function: i.displayFunction,
        }));

        return {
          content: [
            {
              type: "text",
              text: `Found ${issues.length} issue(s) in stream "${streamId}":\n\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        };
      }
    );
  },
} satisfies RegisterableModule;
