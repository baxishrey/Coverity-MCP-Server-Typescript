import "dotenv/config";
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { autoLoadRegistry } from "../registry/auto-loader.js";

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
  console.error("[coverity-mcp] Server running on stdio");
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
    console.error(`[coverity-mcp] HTTP server listening on port ${port}`);
    console.error(`[coverity-mcp] MCP endpoint: http://localhost:${port}/mcp`);
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
