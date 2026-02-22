# Coverity MCP Server

A TypeScript [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that connects AI agents to [Black Duck Coverity Connect](https://www.blackduck.com/static-analysis-sast-coverity.html) for static analysis defect management.

Give your AI coding assistant direct access to Coverity projects, streams, and defect data — so it can find issues, understand their root cause via event traces, and fix them in your codebase.

## Features

- **List projects** — browse all Coverity projects you have access to
- **List streams** — view analysis streams, optionally filtered by project
- **Search issues** — find defects by stream with filters for checker, impact, status, and pagination
- **Get issue details** — retrieve full defect info including the event trace (code path leading to the defect) and triage data
- **Two transport modes** — stdio for Claude Desktop / CLI, HTTP for web-based integrations

## Prerequisites

- Node.js >= 20.11.0
- Access to a Coverity Connect instance with REST API enabled
- A Coverity authentication key (generated from your Coverity Connect user settings)

## Quick Start

```bash
git clone https://github.com/baxishrey/Coverity-MCP-Server-Typescript.git
cd Coverity-MCP-Server-Typescript
npm install
npm run build
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your Coverity Connect credentials:

```env
COVERITY_HOST=coverity.example.com
COVERITY_PORT=8443
COVERITY_SSL=true
COVERITY_USER=your_username
COVERITY_AUTH_KEY=your_auth_key
```

Run the server:

```bash
npm start          # stdio transport (default)
npm run start:http # HTTP transport on port 3000
```

## Claude Desktop Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "coverity": {
      "command": "node",
      "args": ["/path/to/Coverity-MCP-Server-Typescript/build/index.js"],
      "env": {
        "COVERITY_HOST": "coverity.example.com",
        "COVERITY_PORT": "8443",
        "COVERITY_SSL": "true",
        "COVERITY_USER": "your_username",
        "COVERITY_AUTH_KEY": "your_auth_key"
      }
    }
  }
}
```

For HTTP transport mode, use the MCP endpoint URL instead:

```json
{
  "mcpServers": {
    "coverity": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Tools

### `list_projects`

List all Coverity projects the authenticated user can access.

**Parameters:** none

**Returns:** project name, key, description, and associated streams.

---

### `list_streams`

List Coverity streams, optionally filtered by project name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectName` | string | no | Filter streams by project name |

**Returns:** stream name, language, description, and parent project.

---

### `search_issues`

Search for static analysis defects in a Coverity stream.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `streamId` | string | yes | Stream name or ID to search in |
| `checker` | string | no | Filter by checker (e.g. `RESOURCE_LEAK`, `NULL_RETURNS`) |
| `impact` | string | no | Filter by impact: `High`, `Medium`, `Low` |
| `status` | string | no | Filter by status: `New`, `Triaged`, `Fixed`, `Dismissed` |
| `limit` | number | no | Max results, 1–200 (default 25) |
| `offset` | number | no | Pagination offset (default 0) |

**Returns:** CID, checker, type, impact, status, file, and function for each defect.

---

### `get_issue_details`

Get full details for a specific defect, including the event trace that shows the code path leading to the issue.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cid` | number | yes | Coverity Issue ID |
| `streamId` | string | yes | Stream name or ID containing the issue |

**Returns:** complete defect information with triage data (action, classification, severity, owner) and event chain (step-by-step code path with file and line numbers).

## Resources

### `coverity://server-info`

Read-only resource showing the current Coverity server connection configuration (host, port, SSL, user). Does not expose the authentication key.

## Typical Workflow

A code agent using this server would typically:

1. **`list_projects`** — discover available projects
2. **`list_streams`** — find the relevant stream for the codebase
3. **`search_issues`** — find defects (filter by `impact: "High"` for critical ones)
4. **`get_issue_details`** — get the event trace for a specific defect
5. **Read the source file** at the reported location and **apply a fix** based on the event trace

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COVERITY_HOST` | yes | — | Coverity Connect server hostname |
| `COVERITY_PORT` | no | `8443` | Server port |
| `COVERITY_SSL` | no | `true` | Use HTTPS |
| `COVERITY_USER` | yes | — | Username |
| `COVERITY_AUTH_KEY` | yes | — | Authentication key |
| `TRANSPORT` | no | `stdio` | Transport mode: `stdio` or `http` |
| `PORT` | no | `3000` | HTTP server port (only with `TRANSPORT=http`) |

## Development

```bash
npm run dev          # run from source without compiling
npm run build        # compile TypeScript → build/
npm test             # run tests
npm run lint         # type-check without emitting
```

### Project Structure

```
src/
├── index.ts                    # Entry point
├── server/boot.ts              # MCP server init, transport selection
├── registry/                   # Auto-discovers modules in tools/resources/prompts
├── client/coverity-client.ts   # Coverity REST API client
├── tools/                      # MCP tool implementations
│   ├── list-projects.ts
│   ├── list-streams.ts
│   ├── search-issues.ts
│   └── get-issue-details.ts
└── resources/
    └── server-info.ts          # Server connection info resource
```

### Adding a New Tool

Create a file in `src/tools/` — it will be auto-discovered at startup:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";

export default {
  type: "tool",
  name: "my-tool",
  description: "Does something useful",
  register(server: McpServer) {
    server.tool("my_tool", "Description", {
      param: z.string().describe("A parameter"),
    }, async ({ param }) => {
      return { content: [{ type: "text", text: `Result: ${param}` }] };
    });
  },
} satisfies RegisterableModule;
```

## License

MIT
