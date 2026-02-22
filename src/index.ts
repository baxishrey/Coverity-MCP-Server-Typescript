#!/usr/bin/env node
import { boot } from "./server/boot.js";

boot().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
