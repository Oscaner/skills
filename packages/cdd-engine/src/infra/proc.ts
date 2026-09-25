// packages/cdd-engine/src/infra/proc.ts — Process-Lifecycle Manager surface (TS port of proc.mjs;
// spec §2.13 proc row, execa retained). P4.4 Task 4 「CddRuntime 模块态收编」: the lifecycle
// implementation + all proc module-level state moved into infra/runtime.ts (the CddRuntime class
// owns registry/diskPath/idleTimer — the engine's single mutable-state surface); this file is now
// a thin re-export so every legacy `../infra/proc.ts` import (dispatch/CLI modules, tests) resolves
// through the runtime singleton unchanged. Same contract as the .mjs module (checked by
// lifecycle.proc.test.mjs): spawnManaged (detached group + run-scoped registry) / teardownAll
// (run-boundary root reaping) / reapDone (in-process idle reaping) / reapStale (cross-run orphan
// fallback). The pure stall/termination judges and the signal samplers stay module-level pure
// functions — stateless, exported from runtime.ts through here (the liveness probe page is
// enumerated in infra/runtime.ts).

export * from "./runtime.ts";
