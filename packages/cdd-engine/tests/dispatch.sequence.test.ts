// tests/dispatch.sequence.test.ts — Task 6 integration: the documented dispatch hook-point
// firing order (spec §2.12 第一部分). Acceptance: before → phases → after — dispatch:before
// opens the dispatch, the PHASES table (pre-flight / dispatch / post-flight, gates anchored to
// the boundary phases) runs in between, dispatch:after closes it. Task 7's base.ts will drive
// exactly this walk from hooks.ts + phases.ts.
import { it, expect } from "vitest";

import { createDispatchHooks, type DispatchHookContext } from "../src/dispatch/hooks.ts";
import { PHASES } from "../src/dispatch/phases.ts";

it("hook points fire dispatch:before → phases (commit gates anchored) → dispatch:after", async () => {
  const hooks = createDispatchHooks();
  const order: string[] = [];
  hooks.hook("dispatch:before", () => {
    order.push("dispatch:before");
  });
  hooks.hook("dispatch:after", () => {
    order.push("dispatch:after");
  });
  hooks.hook("commit:enter", () => {
    order.push("commit:enter");
  });
  hooks.hook("commit:exit", () => {
    order.push("commit:exit");
  });

  const ctx: DispatchHookContext = { mode: "review", meta: {} };
  await hooks.callHook("dispatch:before", ctx);
  for (const phase of PHASES) {
    if (phase.commitGate === "enter") await hooks.callHook("commit:enter", ctx);
    order.push(phase.id);
    if (phase.commitGate === "exit") await hooks.callHook("commit:exit", ctx);
  }
  await hooks.callHook("dispatch:after", ctx);

  expect(order).toEqual([
    "dispatch:before",
    "commit:enter",
    "pre-flight",
    "dispatch",
    "post-flight",
    "commit:exit",
    "dispatch:after",
  ]);
});
