import { fileURLToPath } from "node:url";
import path from "node:path";
import fg from "fast-glob";
import type { ModuleType } from "./types.js";

export function getRootDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..");
}

export function getModuleType(filePath: string): ModuleType | null {
  const parts = filePath.split(path.sep).join("/").split("/");
  if (parts.includes("tools")) return "tool";
  if (parts.includes("resources")) return "resource";
  if (parts.includes("prompts")) return "prompt";
  return null;
}

export function getModuleName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export function filePathToUrl(filePath: string): string {
  const absolute = path.resolve(filePath);
  return `file:///${absolute.replace(/\\/g, "/")}`;
}

export function getModulePatterns(): string[] {
  const root = getRootDir().replace(/\\/g, "/");
  return [
    `${root}/tools/*.{ts,js}`,
    `${root}/resources/*.{ts,js}`,
    `${root}/prompts/*.{ts,js}`,
  ];
}

export async function findModuleFiles(): Promise<string[]> {
  const patterns = getModulePatterns();
  return fg(patterns, { absolute: true, ignore: ['**/*.d.ts'] });
}

export async function loadModule(filePath: string): Promise<unknown> {
  const url = filePathToUrl(filePath);
  const mod = await import(url) as { default?: unknown };
  return mod.default;
}
