import "dotenv/config";
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { autoLoadRegistry } from "../registry/auto-loader.js";
import { logger } from "../logger.js";

const TAG = "boot";

function createServer(): McpServer {
  return new McpServer({
    name: "coverity-mcp-server",
    version: "1.0.0",
  });
}

async function bootStdio(): Promise<void> {
  const server = createServer();
  await autoLoadRegistry(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(TAG, `server running on stdio (host: ${process.env["COVERITY_HOST"] ?? "unset"}, project: ${process.env["COVERITY_PROJECT"] ?? "unset"})`);
}

async function bootHttp(): Promise<void> {
  const server = createServer();
  await autoLoadRegistry(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await server.connect(transport);

  const port = parseInt(process.env["PORT"] ?? "3000", 10);

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(port, () => {
    logger.info(TAG, `HTTP server listening on port ${port} (host: ${process.env["COVERITY_HOST"] ?? "unset"}, project: ${process.env["COVERITY_PROJECT"] ?? "unset"})`);
    logger.info(TAG, `MCP endpoint: http://localhost:${port}/mcp`);
  });
}

export async function boot(): Promise<void> {
  const mode = process.env["TRANSPORT"] ?? "stdio";

  if (mode === "http") {
    await bootHttp();
  } else {
    await bootStdio();
  }
}
