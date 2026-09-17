// packages/cdd-engine/src/dispatch/hooks.ts — dispatch lifecycle hookable registration surface
// (Task 6; spec §2.12 第一部分 + §2.13 hookable row). One hookable (unjs) instance plus the FIXED
// hook-point enumeration — the anti-explosion device: external plugins may attach ONLY at the
// declared points (防钩子爆炸), engine-internal variants override via inheritance (Task 7 base.ts),
// never through this registry.
//
//   dispatch:before — fires once before any phase runs (dispatch start)
//   dispatch:after  — fires once after every phase completes (dispatch end)
//   commit:enter    — pre-commit ENTRY-gate point (pre-flight); Task 7 mounts entryGateCleanTree
//   commit:exit     — post-commit EXIT-gate point (post-flight); Task 7 mounts validateCommitContract
//
// Context threading: the lifecycle passes ONE DispatchHookContext through every callHook so
// handlers observe the dispatch mode and share scratch state via meta.
import { createHooks, type Hookable } from "hookable";

export const HOOK_POINTS = ["dispatch:before", "dispatch:after", "commit:enter", "commit:exit"] as const;
export type FixedHookPoint = (typeof HOOK_POINTS)[number];

const FIXED_POINT_SET = new Set<string>(HOOK_POINTS);

export interface DispatchHookContext {
  /** dispatch mode (implement / review / fix / base-branch / docs variants) */
  mode: string;
  /** cross-hook scratch state — one object threaded through every callHook */
  meta: Record<string, unknown>;
}

export type DispatchHookHandler = (ctx: DispatchHookContext) => void | Promise<void>;

export interface CddHookMap {
  "dispatch:before": DispatchHookHandler;
  "dispatch:after": DispatchHookHandler;
  "commit:enter": DispatchHookHandler;
  "commit:exit": DispatchHookHandler;
}

/** External plugin shape — a Partial<CddHookMap>: only fixed points are attachable. */
export type DispatchPlugin = Partial<CddHookMap>;

export type DispatchHooks = Hookable<CddHookMap>;

// Factory over a module singleton: each DispatchLifecycle (Task 7) owns its own hooks instance,
// so tests and concurrent dispatches never share registered handlers.
export function createDispatchHooks(): DispatchHooks {
  return createHooks<CddHookMap>();
}

// External plugin registration entry (future consumer face, spec §2.13). The registry reads ONLY
// the fixed points; unknown keys are rejected (not silently swallowed) so the enumeration has
// teeth. Returns the unregister function removing every attached handler.
export function registerDispatchPlugin(hooks: DispatchHooks, plugin: DispatchPlugin): () => void {
  for (const key of Object.keys(plugin)) {
    if (!FIXED_POINT_SET.has(key)) {
      throw new Error(`registerDispatchPlugin: unknown hook point "${key}" — fixed points: ${HOOK_POINTS.join(", ")}`);
    }
  }
  const unregisterFns: Array<() => void> = [];
  for (const point of HOOK_POINTS) {
    const handler = plugin[point];
    if (handler) unregisterFns.push(hooks.hook(point, handler));
  }
  return () => {
    for (const unregister of unregisterFns) unregister();
  };
}