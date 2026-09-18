// packages/cdd-engine/src/infra/context.ts — TS port of context.mjs: the unique read entry for
// the canonical context contract (engine-config.json#contextContract, Task 5 单文件归并).
// Pure read, zero disk writes (channel audit ⑧ "runtime context zero-persist"). Keeps the
// .mjs guard contract: canonical fact names (argv flags / env vars / git derivations) are never
// hardcoded here — values come from the canonical JSON section via config.ts (单点消费) only.
import { loadContextContract } from "./config.ts";

export function loadContract(): ReturnType<typeof loadContextContract> {
  return loadContextContract();
}
