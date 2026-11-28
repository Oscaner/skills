// packages/cdd-engine/src/surface/commands/__tests__/channel-closure.guard.test.ts
// The channel-closure guard — four closure legs, each read off the engine's OWN typed single
// sources: `surface/commands/declare.ts` (the command declarations and the argv channel) and
// `env/process/host.ts` (the harness detect rows, the dispatch table and the ref table). The
// guard reads the surfaces the runtime consumes — never a parallel allowlist, which would be a
// second declaration of the very facts it claims to check.
//
//   1. the CLI channel closure: every declared key resolves in the channel, and every
//      non-program channel row is declared by a command;
//   2. the host-marker closure: the detect env keys plus `PATH` are the pinned three;
//   3. the dispatch/refs derivation: every ref-shaped dispatch slot is registered and derives
//      both per-harness forms;
//   4. the pipeline ref closure: every `PIPELINE_NEXT` ref entry is registered and derives
//      those same forms.
//
// Precedent: `precommit` pointed at the old tree's file of this name; the cutover retargets it
// here (T18).

import { describe, expect, it } from "vitest";
import { DISPATCH, HOSTS, REFS } from "../../../env/process/host.ts";
import { PIPELINE_NEXT } from "../../../run/advance/next.ts";
import { ARGV_CHANNEL, CLI_COMMANDS } from "../declare.ts";

/** Every key any command or leaf declares — the closure's forward leg's input. */
const declaredKeys = (): ReadonlySet<string> => {
  const keys = new Set<string>();
  const collect = (spec: { readonly keys: readonly { readonly key: string }[] }): void => {
    for (const declared of spec.keys) keys.add(declared.key);
  };
  for (const command of CLI_COMMANDS) {
    collect(command);
    for (const leaf of command.leaves ?? []) collect(leaf);
  }
  return keys;
};

/** The ref-shaped subset of a table's values — the closed `pkg:skill` spelling, so a prose
 *  literal is not mistaken for a reference. */
const refSpelling = /^[a-z][a-z-]*:[a-z][a-z-]*$/;

/** One ref's per-harness slash form. */
const formOf = (host: "claude" | "pi", ref: string): string =>
  host === "pi" ? `/skill:${ref.split(":")[1]}` : `/${ref}`;

describe("the CLI channel closure — command keys × the declared argv channel", () => {
  it("every declared key resolves in the channel, and every non-program channel row is declared", () => {
    const declared = declaredKeys();
    expect([...declared].filter((key) => ARGV_CHANNEL[key] === undefined)).toEqual([]);
    const orphan = Object.entries(ARGV_CHANNEL)
      .filter(([key, row]) => !declared.has(key) && row.scope !== "program")
      .map(([key]) => key);
    expect(orphan).toEqual([]);
  });

  it("keeps the `output` row on the schema get leaf — the two schema faces are one declaration", () => {
    const schema = CLI_COMMANDS.find((command) => command.name === "schema");
    const get = schema?.leaves?.find((leaf) => leaf.name === "get");
    expect(get?.keys.map((declared) => declared.key)).toContain("output");
    expect(ARGV_CHANNEL.output?.values).toEqual(["json", "skeleton"]);
  });
});

describe("the host-marker closure — the detect env keys plus PATH", () => {
  it("derives exactly the pinned three from the harness detect rows", () => {
    const markers = Object.values(HOSTS).map((row) => row.detect.env);
    expect([...markers, "PATH"].sort()).toEqual(
      ["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "PATH"].sort(),
    );
  });
});

describe("the dispatch and refs derivation", () => {
  it("registers every ref-shaped dispatch slot and derives both per-harness forms", () => {
    const refs: string[] = [];
    const push = (value: string | { readonly ref: string }): void => {
      const ref = typeof value === "string" ? value : value.ref;
      if (refSpelling.test(ref)) refs.push(ref);
    };
    push(DISPATCH.implement);
    for (const slot of Object.values(DISPATCH.review)) push(slot);
    // The shape is the closed pair, and both review slots name one ref key.
    expect([...new Set(refs)].sort()).toEqual([
      "mattpocock-skills:code-review",
      "mattpocock-skills:implement",
    ]);
    for (const ref of refs) {
      const form = (REFS as Readonly<Record<string, Record<string, string> | undefined>>)[ref];
      expect(form, `dispatch slot names the registered ref "${ref}"`).toBeDefined();
      for (const host of ["claude", "pi"] as const) {
        expect(form?.[host], `${ref} · ${host}`).toBe(formOf(host, ref));
      }
    }
  });

  it("closes the pipeline handoff table over the same ref table", () => {
    const refs = Object.values(PIPELINE_NEXT)
      .filter(
        (entry): entry is { readonly kind: "ref"; readonly ref: string } => entry.kind === "ref",
      )
      .map((entry) => entry.ref);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const form = (REFS as Readonly<Record<string, Record<string, string> | undefined>>)[ref];
      expect(form, `PIPELINE_NEXT names the registered ref "${ref}"`).toBeDefined();
      for (const host of ["claude", "pi"] as const) {
        expect(form?.[host], `${ref} · ${host}`).toBe(formOf(host, ref));
      }
    }
  });
});
