// packages/cdd-engine/src/infra/registry.ts — TS port of registry.mjs: CDD harness registry
// (ship gate + op×type prefix/suffix injection + CLI PATH preflight). Same behavior contract as
// the .mjs module (checked by registry.test.mjs); this is the rebuilt-layer dependency point.
// The only env read here is the canonical whitelisted PATH key (channel audit ②) — see cliInPath.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REG_PATH = fileURLToPath(new URL("harness-registry.json", import.meta.url));

export class CddBlockedError extends Error {
  exitCode: number;
  kind: string;
  constructor(message: string, { exitCode = 1, kind = "blocked" }: { exitCode?: number; kind?: string } = {}) {
    super(message);
    this.name = "CddBlockedError";
    this.exitCode = exitCode;
    this.kind = kind;
  }
}

export function loadRegistry(regPath: string): any {
  return JSON.parse(readFileSync(regPath, "utf8"));
}

export function registryField(reg: any, harness: string, field: string): string {
  const entry = reg?.[harness];
  if (!entry) return "";
  return entry[field] ?? "";
}

function resolveInjectionField(entry: any, field: string, op: string, type?: string): string {
  const v = entry?.[field]?.[op] ?? "";
  if (v && typeof v === "object") return type ? (v[type] ?? "") : "";
  return typeof v === "string" ? v : "";
}

export function resolveInjection(entry: any, op: string, type?: string): string {
  return resolveInjectionField(entry, "prefix", op, type);
}

export function resolveSuffix(entry: any, op: string, type?: string): string {
  return resolveInjectionField(entry, "suffix", op, type);
}

export function cliInPath(cli: string): boolean {
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter);
  for (const dir of pathDirs) {
    if (!dir) continue;
    try {
      const st = statSync(path.join(dir, cli));
      if (st.isFile() && (st.mode & 0o111) !== 0) return true;
    } catch {
      // dir has no such binary — keep scanning
    }
  }
  return false;
}

export function checkHarness(reg: any, harness: string, opts: { dryRun?: boolean } = {}): any {
  const { dryRun = false } = opts ?? {};
  const entry = reg?.[harness];
  if (!entry) throw new CddBlockedError(`unknown harness: ${harness}`, { exitCode: 1 });
  if (entry.ship !== "full") throw new CddBlockedError(`harness not supported: ${harness}`, { exitCode: 1 });
  const cli = entry.cli;
  if (!cli) throw new CddBlockedError(`unknown harness: ${harness}`, { exitCode: 1 });
  if (!dryRun && !cliInPath(cli)) {
    throw new CddBlockedError(`${cli} not found in PATH`, { exitCode: 2, kind: "cli-missing" });
  }
  return entry;
}