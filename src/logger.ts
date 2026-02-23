/**
 * Minimal structured logger — all output goes to stderr so stdout stays
 * clean for the MCP stdio transport.
 */

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(tag: string, msg: string): void {
    console.error(`${timestamp()} [INFO ] [${tag}] ${msg}`);
  },

  debug(tag: string, msg: string): void {
    if (process.env["COVERITY_DEBUG"] === "1") {
      console.error(`${timestamp()} [DEBUG] [${tag}] ${msg}`);
    }
  },

  warn(tag: string, msg: string): void {
    console.error(`${timestamp()} [WARN ] [${tag}] ${msg}`);
  },

  error(tag: string, msg: string, err?: unknown): void {
    const detail =
      err instanceof Error
        ? err.message
        : err != null
          ? String(err)
          : "";
    console.error(
      `${timestamp()} [ERROR] [${tag}] ${msg}${detail ? ` — ${detail}` : ""}`
    );
  },
};
