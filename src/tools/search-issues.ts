import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";
import { logger } from "../logger.js";

const TAG = "tool:search_issues";

export default {
  type: "tool",
  name: "search-issues",
  description: "Search for defects/issues in the configured Coverity project",

  register(server: McpServer) {
    server.registerTool(
      "search_issues",
      {
        description:
          "Search for static analysis defects in the configured Coverity project. Returns CID, checker, file, function, impact, and status for each issue.",
        inputSchema: {
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
          cid: z
            .number()
            .int()
            .optional()
            .describe("Filter by specific CID (Coverity Issue ID)"),
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
      async ({ checker, impact, status, cid, limit, offset }) => {
        const client = getCoverityClient();
        logger.info(
          TAG,
          `invoked (project="${client.projectName}", checker=${checker ?? "-"}, impact=${impact ?? "-"}, status=${status ?? "-"}, cid=${cid ?? "-"}, limit=${limit ?? 25}, offset=${offset ?? 0})`
        );
        const issues = await client.searchIssues({
          checker,
          impact,
          status,
          cid,
          limit,
          offset,
        });

        if (issues.length === 0) {
          logger.info(TAG, `returning 0 issues for project "${client.projectName}"`);
          return {
            content: [
              {
                type: "text",
                text: `No issues found in project "${client.projectName}" with the given filters.`,
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

        logger.info(TAG, `returning ${issues.length} issue(s) for project "${client.projectName}"`);
        return {
          content: [
            {
              type: "text",
              text: `Found ${issues.length} issue(s) in project "${client.projectName}":\n\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        };
      }
    );
  },
} satisfies RegisterableModule;
