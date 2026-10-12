// packages/cdd-engine/src-next/face/__tests__/channel-closure.guard.test.ts
// P5 — the engine-side channel-closure pin, colocated after the D17 six-premise
// ownership-migration (the root guard's checkChannels assertion face re-homed into the engine
// test plane — every check lives in its owning package's suite, zero root
// validation implementation). The three closure legs read the engine's OWN typed
// single sources — `face/declare.ts` (CLI_COMMANDS + ARGV_CHANNEL) and
// `face/host.ts` (HOSTS detect rows · DISPATCH · REFS) — the same surfaces the
// runtime consumes, never a parallel allowlist:
//
//   1. the CLI channel closure — every command-declared key resolves in the
//      declare argv channel, and every non-program channel key is declared by a
//      command (the single-surface closure);
//   2. the host-marker closure — the detect env keys ∪ PATH match the pinned
//      four, derived from the harness detect rows as the live single source;
//   3. the dispatch/refs derivation — every dispatch-slot ref is registered and
//      every per-harness slash form derives (`pi` /skill:<bare>, claude/cursor
//      /<ref>).
//
// Zero module-level bare functions — the assertions read the typed exports with
// `const` helpers only (the P5 zero-`function`-declaration discipline).

import { describe, expect, it } from "vitest";

import { ARGV_CHANNEL, CLI_COMMANDS } from "../declare.ts";
import { DISPATCH, HOSTS, REFS } from "../host.ts";

describe("the CLI channel closure — command keys × the declare argv channel (the single-surface closure)", () => {
  it("every command/leaf declared key resolves in ARGV_CHANNEL — and every non-program channel key is declared by a command", () => {
    // The declared aggregate — every key any command/leaf declares (the guard's
    // collect face: keys only — positionals are arguments, never channel flags).
    const declaredKeys = new Set<string>();
    const collect = (spec: { keys: readonly { key: string }[] }): void => {
      for (const declared of spec.keys) declaredKeys.add(declared.key);
    };
    for (const command of CLI_COMMANDS) {
      collect(command);
      for (const leaf of command.leaves ?? []) collect(leaf);
    }
    // Forward leg — a declared key absent from the channel is a broken closure.
    const missing: string[] = [];
    for (const key of declaredKeys) {
      if (!(key in ARGV_CHANNEL)) missing.push(key);
    }
    expect(missing).toEqual([]);
    // Reverse leg — a channel key declared by no command and not program-scoped
    // (dry-run/help) is a broken closure.
    const orphan: string[] = [];
    for (const [key, row] of Object.entries(ARGV_CHANNEL)) {
      if (declaredKeys.has(key) || ("scope" in row && row.scope === "program")) continue;
      orphan.push(key);
    }
    expect(orphan).toEqual([]);
  });

  it("the D19 schema merge keeps the closure — the `output` key is the get leaf's declared channel row", () => {
    // The merged single leaf declares `--output` (json|skeleton): the closure
    // leg reads the leaf's declared keys, so the new row is covered exactly like
    // every other declared key (a drag of the D19 deliberate change).
    const schema = CLI_COMMANDS.find((command) => command.name === "schema")!;
    const get = schema.leaves!.find((leaf) => leaf.name === "get")!;
    expect(get.keys.map((declared) => declared.key)).toContain("output");
    expect(ARGV_CHANNEL.output.values).toEqual(["json", "skeleton"]);
  });
});

describe("the host-marker closure — the detect env keys ∪ PATH (single-sourced at the harness detect rows)", () => {
  it("every HOSTS detect env key + PATH equals the pinned four (the deliberate half-update oracle)", () => {
    const markerKeys = Object.values(HOSTS).map((row) => row.detect.env);
    const expectedClosure = [...markerKeys, "PATH"].sort();
    const pinned = ["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"].sort();
    expect(expectedClosure).toEqual(pinned);
  });
});

describe("the dispatch/refs derivation — every dispatch-slot ref registered + every per-harness form derived", () => {
  it("the dispatch table's ref-shaped slots derive their per-harness slash forms", () => {
    // The ref-shaped slots (`pkg:skill`, lowercase) are the table entries; a
    // non-ref literal (the URC prose — spaces/uppercase) has no per-harness form.
    const refKeys: string[] = [];
    const pushRef = (value: string | { ref: string }): void => {
      const ref = typeof value === "string" ? value : value.ref;
      if (/^[a-z][a-z-]*:[a-z][a-z-]*$/.test(ref)) refKeys.push(ref);
    };
    pushRef(DISPATCH.implement);
    for (const slot of Object.values(DISPATCH.review)) pushRef(slot);
    // The shape is the closed pair — implement + the review rows (never vacuous);
    // both review slots name the same ref key — deduped before the derivation.
    expect([...new Set(refKeys)].sort()).toEqual([
      "mattpocock-skills:code-review",
      "mattpocock-skills:implement",
    ]);
    for (const ref of refKeys) {
      const form = REFS[ref as keyof typeof REFS];
      expect(form, `dispatch slot names the registered ref key "${ref}"`).toBeDefined();
      if (form === undefined) continue;
      for (const id of ["claude", "cursor", "pi"] as const) {
        const expected = id === "pi" ? `/skill:${ref.split(":")[1]}` : `/${ref}`;
        expect(form[id], `ref "${ref}" per-harness form for ${id}`).toBe(expected);
      }
    }
  });
});
