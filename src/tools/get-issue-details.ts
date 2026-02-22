import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { getCoverityClient } from "../client/coverity-client.js";

export default {
  type: "tool",
  name: "get-issue-details",
  description:
    "Get detailed information about a specific Coverity defect including event path and triage data",

  register(server: McpServer) {
    server.registerTool(
      "get_issue_details",
      {
        description:
          "Get full details for a Coverity defect by CID, including the event trace (code path that leads to the defect), triage information, and file/line details useful for resolving the issue.",
        inputSchema: {
          cid: z.number().int().describe("The Coverity Issue ID (CID)"),
          streamId: z
            .string()
            .describe("The stream name or ID containing the issue"),
        },
      },
      async ({ cid, streamId }) => {
        const client = getCoverityClient();
        const detail = await client.getIssueDetails(cid, streamId);

        if (!detail) {
          return {
            content: [
              {
                type: "text",
                text: `No issue found with CID ${cid} in stream "${streamId}".`,
              },
            ],
          };
        }

        const result = {
          cid: detail.cid,
          checker: detail.checkerName,
          type: detail.displayType,
          impact: detail.displayImpact,
          status: detail.displayStatus,
          file: detail.displayFile,
          function: detail.displayFunction,
          firstDetected: detail.firstDetected,
          lastDetected: detail.lastDetected,
          occurrenceCount: detail.occurrenceCount,
          triage: detail.triage
            ? {
                action: detail.triage.action,
                classification: detail.triage.classification,
                severity: detail.triage.severity,
                owner: detail.triage.owner,
                comment: detail.triage.comment,
              }
            : null,
          events: (detail.events ?? []).map((e) => ({
            step: e.eventNumber,
            tag: e.eventTag,
            description: e.eventDescription,
            file: e.filePathname,
            line: e.lineNumber,
          })),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );
  },
} satisfies RegisterableModule;
