// packages/cdd-engine/src/infra/context.ts — TS port of context.mjs: the unique read entry for
// the canonical context contract (templates/context-contract.json). Pure read, zero disk writes
// (channel audit ⑧ "runtime context zero-persist"). Keeps the .mjs guard contract: canonical fact
// names (argv flags / env vars / git derivations) are never hardcoded here — values come from the
// canonical JSON only.
import { readFileSync } from "node:fs";

const CONTRACT = JSON.parse(
  readFileSync(new URL("../../templates/context-contract.json", import.meta.url), "utf8"),
);

export function loadContract(): any {
  return CONTRACT;
}