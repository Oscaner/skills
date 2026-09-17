// tests/dispatch.hooks.test.ts — Task 6 dispatch lifecycle registration surface
// (spec §2.12 第一部分 + §2.13 hookable row). Tests the hookable instance + the FIXED
// hook-point enumeration: callHook fires registered handlers at every declared point, plugins
// may only attach at the enum, and unregister removes a handler.
import { it, expect } from "vitest";

import {
  HOOK_POINTS,
  createDispatchHooks,
  registerDispatchPlugin,
  type DispatchHookContext,
  type DispatchPlugin,
} from "../src/dispatch/hooks.ts";

it("HOOK_POINTS declares the four fixed points (dispatch:before/after + commit gates)", () => {
  expect(HOOK_POINTS).toEqual(["dispatch:before", "dispatch:after", "commit:enter", "commit:exit"]);
});

it("createDispatchHooks: callHook('dispatch:before') fires a registered handler with the context", async () => {
  const hooks = createDispatchHooks();
  let seen: DispatchHookContext | null = null;
  hooks.hook("dispatch:before", (ctx) => {
    seen = ctx;
  });

  const ctx: DispatchHookContext = { mode: "implement", meta: { a: 1 } };
  await hooks.callHook("dispatch:before", ctx);

  expect(seen).toBe(ctx);
});

it("createDispatchHooks: async handlers are awaited (hookable async-first contract)", async () => {
  const hooks = createDispatchHooks();
  const order: string[] = [];
  hooks.hook("dispatch:before", async () => {
    await Promise.resolve();
    order.push("async-handler");
  });
  hooks.hook("dispatch:before", () => {
    order.push("sync-handler");
  });

  await hooks.callHook("dispatch:before", { mode: "review", meta: {} });

  expect(order).toEqual(["async-handler", "sync-handler"]);
});

it("every fixed point is a valid callHook target on a fresh instance", async () => {
  const hooks = createDispatchHooks();
  const fired: string[] = [];
  for (const point of HOOK_POINTS) {
    hooks.hook(point, (ctx) => {
      fired.push(`${point}:${ctx.mode}`);
    });
  }

  for (const point of HOOK_POINTS) {
    await hooks.callHook(point, { mode: "fix", meta: {} });
  }

  expect(fired).toEqual([
    "dispatch:before:fix",
    "dispatch:after:fix",
    "commit:enter:fix",
    "commit:exit:fix",
  ]);
});

it("registerDispatchPlugin attaches every provided fixed point and returns an unregister", async () => {
  const hooks = createDispatchHooks();
  const fired: string[] = [];
  const plugin: DispatchPlugin = {
    "dispatch:before": () => {
      fired.push("before");
    },
    "dispatch:after": () => {
      fired.push("after");
    },
    "commit:enter": () => {
      fired.push("enter");
    },
    "commit:exit": () => {
      fired.push("exit");
    },
  };

  const unregister = registerDispatchPlugin(hooks, plugin);
  await hooks.callHook("dispatch:before", { mode: "implement", meta: {} });
  await hooks.callHook("dispatch:after", { mode: "implement", meta: {} });
  await hooks.callHook("commit:enter", { mode: "implement", meta: {} });
  await hooks.callHook("commit:exit", { mode: "implement", meta: {} });
  expect(fired).toEqual(["before", "after", "enter", "exit"]);

  unregister();
  await hooks.callHook("dispatch:before", { mode: "implement", meta: {} });
  expect(fired).toEqual(["before", "after", "enter", "exit"]);
});

it("registerDispatchPlugin rejects unknown hook points (fixed enumeration has teeth)", () => {
  const hooks = createDispatchHooks();
  expect(() =>
    registerDispatchPlugin(hooks, { "not:a-point": () => {} } as DispatchPlugin),
  ).toThrow(/unknown hook point "not:a-point"/);
});