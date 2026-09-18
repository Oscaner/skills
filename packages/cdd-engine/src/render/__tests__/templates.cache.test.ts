// packages/cdd-engine/src/render/__tests__/templates.cache.test.ts — spec D-3 cache-first
// assembly contract (C1/C3/C4) + the byte-invariant guard (⑧). Reads the REAL templates and
// registry (no fs mock) and exercises the memoized render seam (templateCacheStats /
// resetTemplateCaches) that makes "re-dispatch zero re-render" observable.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadHandoffSchema } from "../../rules/schema.ts";
import { loadRegistry, REG_PATH } from "../../infra/registry.ts";
import { composeDispatchSet } from "../../infra/invoke.ts";
import {
  renderModePrompt,
  renderTemplate,
  renderHandoffSchemaJson,
  templateCacheStats,
  resetTemplateCaches,
  staticShellKey,
  loadTemplateContract,
  TEMPLATE_FILES,
} from "../templates.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..", "..", "..");
const TEMPLATES = path.join(PKG_ROOT, "templates");

const IMPLEMENT_PARAMS = {
  TASK_WORKSPACE: "/ws/osuperpowers-overhaul-p6",
  TASK_BRIEF: "/ws/osuperpowers-overhaul-p6/task-7-brief.md",
  HANDOFF_TARGET: "/ws/osuperpowers-overhaul-p6/task-7-implement.json",
  TASK_FINDINGS: "",
  TASK_CONSTRAINTS: "/ws/osuperpowers-overhaul-p6/plan-constraints.md",
  TASK_FIXED_POINT: "",
  TASK_NUMBER: "7",
  REVIEW_PLAN_LINE: "**Plan:** docs/osuperpowers/plans/2026-09-13-osuperpowers-overhaul-p6.md",
};

// The static zone = the rendered prompt before the `## Return` heading (variant payload is tailed).
const staticZoneOf = (prompt: string): string => prompt.slice(0, prompt.indexOf("## Return"));

describe("C1 — assembly order [static shell → variant payload tailed]", () => {
  it("rendered prompt keeps ## Handoff (last static section) before ## Return; the four-line H1 block only exists in the Return tail", () => {
    for (const mode of ["implement", "fix"] as const) {
      const out = renderModePrompt(mode, IMPLEMENT_PARAMS);
      const handoffIdx = out.indexOf("## Handoff");
      const retIdx = out.indexOf("## Return");
      expect(handoffIdx).toBeGreaterThan(-1);
      expect(retIdx).toBeGreaterThan(handoffIdx);
      // The shared H1 four-line return contract (RETURN_STDOUT_BLOCK body) must be tail-only.
      expect(out.indexOf("status: <APPROVED|BLOCKED>")).toBeGreaterThan(retIdx);
      expect(out.indexOf("status: <APPROVED|BLOCKED>")).toBeGreaterThan(handoffIdx);
      // The static zone excludes the Return section entirely (no variant heading leaks up).
      expect(staticZoneOf(out)).not.toContain("## Return");
    }
  });

  it("dispatch set assembly = [registry prefix] + prompt: the /mattpocock-skills prefix line precedes the template title", () => {
    const reg = loadRegistry(REG_PATH);
    const prompt = renderModePrompt("implement", IMPLEMENT_PARAMS);
    const set = composeDispatchSet(reg.claude, { op: "implement" }, prompt, "/ws", { PATH: "/usr/bin" });
    const promptArg = set.args.at(-1) as string;
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd"); // prefix line first
    const titleIdx = promptArg.indexOf("# CDD implement");
    expect(titleIdx).toBeGreaterThan(promptArg.indexOf("/mattpocock-skills:tdd")); // shell after prefix
    expect(promptArg).toContain("status: <APPROVED|BLOCKED>"); // variant payload present, tailed
  });
});

describe("C2/C3 — structural single source + deterministic serialization", () => {
  beforeEach(() => resetTemplateCaches());

  it("staticShellKey is canonical and env-independent: same params any key order → same key; values are order-stable", () => {
    const a = staticShellKey("implement", { B: "2", A: "1" });
    const b = staticShellKey("implement", { A: "1", B: "2" }); // different insertion order, same values
    expect(a).toBe(b);
    expect(staticShellKey("implement", { A: "1", B: "3" })).not.toBe(a);
  });

  it("schema injection is byte-deterministic and canonical-key-ordered (C3)", () => {
    const stub1 = renderHandoffSchemaJson(loadHandoffSchema("task"));
    const stub2 = renderHandoffSchemaJson(loadHandoffSchema("task"));
    expect(stub2).toBe(stub1); // byte-identical across calls — zero env/factor influence
    const body = stub1.replace(/^```json\n/, "").replace(/\n```$/, "");
    // Canonical key order: parse → re-serialize preserves the on-disk key order exactly.
    expect(JSON.stringify(JSON.parse(body))).toBe(body);
    expect(body).not.toContain("\n  "); // fixed whitespace: compact single-line (P5 E-8)
  });
});

describe("C4 — re-dispatch byte reuse (static zone memoized; memoize assertion)", () => {
  beforeEach(() => resetTemplateCaches());

  it("first render materializes the cache; an identical re-dispatch does zero re-read / re-compile / re-render", () => {
    const first = renderModePrompt("implement", IMPLEMENT_PARAMS);
    const statsAfterFirst = templateCacheStats();
    expect(statsAfterFirst.reads).toBe(1); // template source read once
    const second = renderModePrompt("implement", IMPLEMENT_PARAMS); // same (op,type) + same params
    expect(templateCacheStats()).toEqual(statsAfterFirst); // zero re-render of the static zone
    // The static zone is FROZEN — same string reference, not just equal bytes.
    expect(staticZoneOf(second)).toBe(staticZoneOf(first));
  });

  it("a param change re-renders the static zone once but reuses the frozen read + compiled product", () => {
    renderModePrompt("implement", IMPLEMENT_PARAMS);
    const s1 = templateCacheStats();
    const other = renderModePrompt("implement", { ...IMPLEMENT_PARAMS, TASK_NUMBER: "8" });
    const s2 = templateCacheStats();
    expect(s2.reads).toBe(s1.reads); // file not re-read
    expect(s2.compiles).toBe(s1.compiles); // compiled product frozen per (op,type)
    expect(s2.staticShellRenders).toBe(s1.staticShellRenders + 1); // exactly one re-render
    expect(staticZoneOf(other)).not.toBe(staticZoneOf(renderModePrompt("implement", IMPLEMENT_PARAMS)));
  });

  it("resetTemplateCaches clears the module cache (fresh reads on next render)", () => {
    renderModePrompt("implement", IMPLEMENT_PARAMS);
    resetTemplateCaches();
    expect(templateCacheStats()).toEqual({ reads: 0, compiles: 0, staticShellRenders: 0 });
    renderModePrompt("implement", IMPLEMENT_PARAMS);
    expect(templateCacheStats().reads).toBe(1);
  });

  it("dispatch determinism: identical render inputs → byte-identical full prompt (C5 input side)", () => {
    resetTemplateCaches();
    const a = renderModePrompt("fix", IMPLEMENT_PARAMS);
    const b = renderModePrompt("fix", IMPLEMENT_PARAMS);
    expect(b).toBe(a);
  });
});

describe("⑧ — byte-invariant guard: static zones carry zero volatile literals", () => {
  // Degenerate guardrail — the primary mechanism is structural single-source (C2: skeleton/
  // segments driven from template-contract.json + token registry). This test scans the STATIC
  // segment (before `## Return`) of each shipped template for hardcoded volatile values:
  // time/date literals, absolute paths, round labels, task-N handoff paths. Everything volatile
  // must ride a {{TOKEN}} (the token registry keeps that contract).
  const VOLATILE_PATTERNS: Array<[string, RegExp]> = [
    ["ISO date literal", /\b\d{4}-\d{2}-\d{2}\b/],
    ["clock time literal", /\b\d{1,2}:\d{2}\b/],
    ["absolute POSIX path literal", /(^|[^\w{})])\/(Users|home|tmp|var|etc|opt|usr|private)\b/],
    ["absolute Windows path literal", /\b[A-Za-z]:[\\/]/],
    ["round label literal", /\bround[ -]?\d+\b|\bR\d{1,2}\b/i],
    ["task-N handoff path literal", /task-\d+-(implement|report|test-evidence|review|fix)\b/],
  ];

  it("every shipped template's static zone passes the volatile-literal scan", () => {
    for (const rel of Object.values(TEMPLATE_FILES)) {
      const src = readFileSync(path.join(TEMPLATES, rel), "utf8");
      const i = src.indexOf("## Return");
      const staticZone = i < 0 ? src : src.slice(0, i);
      expect(staticZone, rel).toContain("## Handoff"); // sanity: static zone includes Instructions+Handoff
      for (const [name, re] of VOLATILE_PATTERNS) {
        expect(staticZone.match(re), `${rel}: ${name}`).toBeNull();
      }
    }
  });

  it("the two-part structure is data-forced: skeleton.segments.static|variant matches the byte plane", () => {
    const contract = loadTemplateContract();
    expect(contract.skeleton.order).toEqual(["title", "context", "instructions", "handoff", "return"]);
    expect(contract.skeleton.segments.variant).toEqual(["return"]); // variant payload = the Return segment
    for (const rel of Object.values(TEMPLATE_FILES)) {
      const src = readFileSync(path.join(TEMPLATES, rel), "utf8");
      const retIdx = src.indexOf("## Return");
      expect(retIdx).toBeGreaterThan(src.indexOf("## Handoff")); // Return is the final section
    }
  });
});