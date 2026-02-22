# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm install
npm run build        # tsc → build/
npm start            # run via stdio transport
npm run start:http   # run via HTTP transport (port 3000)
npm run dev          # run from source (--experimental-strip-types)
npm test             # node --test on tests/**/*.test.ts
npm run lint         # tsc --noEmit (type checking only)
```

## Architecture

This is an MCP (Model Context Protocol) server that exposes Coverity Connect static analysis data to AI agents. Supports stdio (default) and HTTP transports, controlled by the `TRANSPORT` env var.

### Auto-loading Registry
Modules in `src/tools/`, `src/resources/`, and `src/prompts/` are auto-discovered at startup by the registry system (`src/registry/`). Each module exports a default object satisfying `RegisterableModule` with `type`, `name`, and `register(server)`. No manual registration needed — just drop a file in the right directory.

### Coverity REST API Client
`src/client/coverity-client.ts` — singleton client (`getCoverityClient()`) that wraps the Coverity Connect REST API with Basic Auth. Tries v2 endpoints first, falls back to v1 view contents API. Configured via env vars.

### MCP Tools
- **list_projects** — all accessible projects with their streams
- **list_streams** — streams, optionally filtered by project name
- **search_issues** — defects in a stream with filtering (checker, impact, status) and pagination
- **get_issue_details** — full defect detail including event trace and triage data for a given CID

### MCP Resources
- **coverity://server-info** — connection status and configuration (no secrets)

## Environment Variables

Required in `.env` (see `.env.example`):
- `COVERITY_HOST` — Coverity Connect server hostname
- `COVERITY_PORT` — port (default 8443)
- `COVERITY_SSL` — use HTTPS (default true)
- `COVERITY_USER` — username
- `COVERITY_AUTH_KEY` — authentication key

Optional:
- `TRANSPORT` — `stdio` (default) or `http`
- `PORT` — HTTP server port (default 3000, only used with `TRANSPORT=http`)

## Adding New Tools

Create a file in `src/tools/` exporting a default `RegisterableModule`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";

export default {
  type: "tool",
  name: "my-tool",
  description: "...",
  register(server: McpServer) {
    server.tool("my_tool", "description", { param: z.string() }, async ({ param }) => {
      return { content: [{ type: "text", text: "result" }] };
    });
  },
} satisfies RegisterableModule;
```

## Key Conventions

- ESM (`"type": "module"` in package.json) — all imports use `.js` extensions
- TypeScript strict mode with `noUncheckedIndexedAccess`
- Node.js >= 20.11.0 (native fetch, --experimental-strip-types)
- Tool names use snake_case in MCP registration, file names use kebab-case
- All server logging goes to stderr (stdout is reserved for MCP stdio transport)
