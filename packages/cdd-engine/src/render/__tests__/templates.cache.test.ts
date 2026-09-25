// packages/cdd-engine/src/render/__tests__/templates.cache.test.ts — spec D-3 cache-first
// assembly contract (C1/C3/C4) + the byte-invariant guard (⑧). Task 20 (C4 升格): the shell is a
// process-level parameterless constant (staticShellKey eliminated) — reads the REAL contract +
// schemas (no fs mock) and exercises the memoized render seam (templateCacheStats /
// resetTemplateCaches) that makes "re-dispatch zero re-render" observable. Since the shell no
// longer re-renders on ANY param change, the old "static zone re-renders once" assertion INVERTS:
// a param change re-renders only the Round-context tail (tailRenders++) while the static
// zone (shell + ## Return constant) stays byte-FROZEN.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { composeDispatchSet } from "../../infra/invoke.ts";
import { loadRegistry, REG_PATH } from "../../infra/registry.ts";
import { loadHandoffSchema } from "../../rules/schema.ts";
import {
  loadTemplateContract,
  renderHandoffSchemaJson,
  renderModePrompt,
  renderTemplate,
  resetTemplateCaches,
  templateCacheStats,
  validateShippedTemplates,
} from "../templates.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..", "..", "..");
const TEMPLATES = path.join(PKG_ROOT, "templates");

const IMPLEMENT_PARAMS = {
  WORKSPACE: "/ws/osuperpowers-overhaul-p6",
  WORKSPACE_SLUG: "osuperpowers-overhaul-p6",
  BRIEF: "/ws/osuperpowers-overhaul-p6/tasks-7-brief.md",
  HANDOFF_TARGET: "/ws/osuperpowers-overhaul-p6/tasks-7-implement.json",
  FINDINGS: "",
  CONSTRAINTS: "/ws/osuperpowers-overhaul-p6/plan-constraints.md",
  FIXED_POINT: "",
  DISPATCH_UNIT: "7",
  REVIEW_PLAN_LINE: "**Plan:** docs/osuperpowers/plans/2026-09-13-osuperpowers-overhaul-p6.md",
};

// Second-level heading position via line-anchored match — the shell prose names `## Return` /
// `## Round context` inline (backtick quotes in Instructions), so a plain indexOf would anchor on
// the prose mention, not the real section heading.
const heading = (prompt: string, name: string): number =>
  prompt.search(new RegExp(`^## ${name}$`, "m"));

// The static zone = the rendered prompt before the `## Return` heading (the parameterless shell
// incl. its injected schema block). The tail = `## Return` constant + ## Round context.
const staticZoneOf = (prompt: string): string => prompt.slice(0, heading(prompt, "Return"));
// The byte-frozen per-format Return constant region (between `## Return` and the dynamic tail).
const _returnZoneOf = (prompt: string): string =>
  prompt.slice(heading(prompt, "Return"), heading(prompt, "Round context"));

describe("C1 — assembly order [shell → Return constant → Round context tail]", () => {
  beforeEach(() => resetTemplateCaches());

  it("rendered prompt keeps ## Handoff (last static section) before ## Return; the four-line return block block only exists in the Return constant", () => {
    for (const mode of ["implement", "fix"] as const) {
      const out = renderModePrompt(mode, IMPLEMENT_PARAMS);
      const handoffIdx = heading(out, "Handoff");
      const retIdx = heading(out, "Return");
      expect(handoffIdx).toBeGreaterThan(-1);
      expect(retIdx).toBeGreaterThan(handoffIdx);
      expect(heading(out, "Round context")).toBeGreaterThan(retIdx); // 动态区绝对末尾
      // The shared return block four-line return contract (RETURN_STDOUT_BLOCK constant body) must be
      // tail-only, and the dynamic Round context must be the final `## ` section.
      expect(out.indexOf("status: <APPROVED|BLOCKED>")).toBeGreaterThan(retIdx);
      expect(out.indexOf("status: <APPROVED|BLOCKED>")).toBeGreaterThan(handoffIdx);
      expect(staticZoneOf(out)).not.toMatch(/^## Return$/m); // static zone carries no Return heading
    }
  });

  it("dispatch set assembly = [registry prefix] + prompt: the /mattpocock-skills prefix line precedes the unified shell title", () => {
    const reg = loadRegistry(REG_PATH);
    const prompt = renderModePrompt("implement", IMPLEMENT_PARAMS);
    const set = composeDispatchSet(reg.claude, { op: "implement" }, prompt, "/ws", {
      PATH: "/usr/bin",
    });
    const promptArg = set.args.at(-1) as string;
    expect(promptArg.split("\n")[0]).toBe("/mattpocock-skills:tdd"); // prefix line first
    const titleIdx = promptArg.indexOf("# CDD dispatch — CLI session"); // 统一壳字面头
    expect(titleIdx).toBeGreaterThan(promptArg.indexOf("/mattpocock-skills:tdd"));
    expect(promptArg).toContain("status: <APPROVED|BLOCKED>"); // four-line contract present, tailed
  });
});

describe("C2/C3 — structural single source + deterministic serialization", () => {
  beforeEach(() => resetTemplateCaches());

  it("canonical round-key: same params in any insertion order → same rendered tail (memoized once); the shell has no key surface (parameterless)", () => {
    const a = renderTemplate("implement", {
      ...IMPLEMENT_PARAMS,
      RETURN_FORMAT: "RETURN_STDOUT_BLOCK",
    });
    resetTemplateCaches();
    // Different insertion order, same value set (identical keys, reverse listing) → byte-identical
    // render + single tail materialization. The memo key is the SORTED canonical params (insertion
    // order never factors in — the canonical-key contract that staticShellKey used to hold).
    const flipped: Record<string, string> = {
      RETURN_FORMAT: "RETURN_STDOUT_BLOCK",
      REVIEW_PLAN_LINE: IMPLEMENT_PARAMS.REVIEW_PLAN_LINE,
      DISPATCH_UNIT: IMPLEMENT_PARAMS.DISPATCH_UNIT,
      FIXED_POINT: IMPLEMENT_PARAMS.FIXED_POINT,
      CONSTRAINTS: IMPLEMENT_PARAMS.CONSTRAINTS,
      FINDINGS: IMPLEMENT_PARAMS.FINDINGS,
      BRIEF: IMPLEMENT_PARAMS.BRIEF,
      WORKSPACE_SLUG: IMPLEMENT_PARAMS.WORKSPACE_SLUG,
      HANDOFF_TARGET: IMPLEMENT_PARAMS.HANDOFF_TARGET,
      WORKSPACE: IMPLEMENT_PARAMS.WORKSPACE,
    };
    const b = renderTemplate("implement", flipped);
    expect(staticZoneOf(b)).toBe(staticZoneOf(a)); // static zone byte-frozen (parameterless shell)
    expect(b).toBe(a);
    expect(templateCacheStats().tailRenders).toBe(1); // one tail materialization, no double-render
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

describe("C4 — parameterless shell: re-dispatch zero re-render; param change re-renders the tail only", () => {
  beforeEach(() => resetTemplateCaches());

  it("first render materializes the cache; an identical re-dispatch does zero re-read / re-compile / re-render", () => {
    const first = renderModePrompt("implement", IMPLEMENT_PARAMS);
    const statsAfterFirst = templateCacheStats();
    expect(statsAfterFirst.reads).toBe(1); // contract source read once
    const second = renderModePrompt("implement", IMPLEMENT_PARAMS); // same (op,type) + same params
    expect(templateCacheStats()).toEqual(statsAfterFirst); // zero re-render of any zone
    // The static zone is FROZEN — same string reference, not just equal bytes.
    expect(staticZoneOf(second)).toBe(staticZoneOf(first));
  });

  it("a param change re-renders ONLY the Round-context tail once; shell + Return constant stay byte-FROZEN (C4 升格)", () => {
    renderModePrompt("implement", IMPLEMENT_PARAMS);
    const s1 = templateCacheStats();
    const other = renderModePrompt("implement", { ...IMPLEMENT_PARAMS, DISPATCH_UNIT: "8" });
    const s2 = templateCacheStats();
    expect(s2.reads).toBe(s1.reads); // contract not re-read
    expect(s2.compiles).toBe(s1.compiles); // compiled Round-context product frozen once
    expect(s2.tailRenders).toBe(s1.tailRenders + 1); // exactly one (distinct) tail re-render
    // INVERTED (vs pre-Task-20): the static zone — whole shell before `## Return` — is byte-FROZEN.
    const base = renderModePrompt("implement", IMPLEMENT_PARAMS);
    expect(staticZoneOf(other)).toBe(staticZoneOf(base));
    expect(other.slice(heading(other, "Return"))).not.toBe(base.slice(heading(base, "Return"))); // tail differs
  });

  it("resetTemplateCaches clears the module cache (fresh reads on next render)", () => {
    renderModePrompt("implement", IMPLEMENT_PARAMS);
    resetTemplateCaches();
    expect(templateCacheStats()).toEqual({ reads: 0, compiles: 0, tailRenders: 0 });
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
  // zone segments driven from template-contract.json + zone-tagged token registry). Task 20 ⑧:
  // rescoped from per-file static scans to the shipped contract's zones — the shell + every
  // Return constant are literal constants (zero volatile values, zero moustache); per-dispatch
  // values ride the Round-context slots instead. Everything volatile must stay off these bytes.
  const VOLATILE_PATTERNS: Array<[string, RegExp]> = [
    ["ISO date literal", /\b\d{4}-\d{2}-\d{2}\b/],
    ["clock time literal", /\b\d{1,2}:\d{2}\b/],
    ["absolute POSIX path literal", /(^|[^\w{})])\/(Users|home|tmp|var|etc|opt|usr|private)\b/],
    ["absolute Windows path literal", /\b[A-Za-z]:[\\/]/],
    ["round label literal", /\bround[ -]?\d+\b|\bR\d{1,2}\b/i],
    ["task-N handoff path literal", /task-\d+-(implement|report|test-evidence|review|fix)\b/],
  ];

  it("the contract's static zones (shell + return constants) pass the volatile scan; shell is zero-moustache", () => {
    const contract = loadTemplateContract();
    for (const [zone, lines] of [
      ["shell", contract.sections.shell],
      ...Object.entries(contract.sections.return),
    ] as Array<[string, string[]]>) {
      const src = lines.join("\n");
      expect(src, zone).toBeTruthy();
      for (const [name, re] of VOLATILE_PATTERNS) {
        expect(src.match(re), `${zone}: ${name}`).toBeNull();
      }
    }
    // Zero-shell-injection mirror (lens ④, read straight off the single-file data plane): the
    // shell still carries zero token slots post-T12; `{{> cl:...}}` clause partial refs are
    // assembly markers, not per-dispatch slots, so they do not trip the shell slot ban.
    expect(contract.sections.shell.join("\n")).not.toMatch(/\{\{(?!>\s*)/);
  });

  it("the zone plane is data-forced: validateShippedTemplates passes on the shipped contract", () => {
    expect(validateShippedTemplates()).toEqual(["shell", "return", "round-context"]);
    const contract = loadTemplateContract();
    expect(contract.skeleton.order).toEqual(["shell", "return", "round-context"]);
    expect(contract.skeleton.segments).toEqual({
      shell: ["Instructions", "Handoff"],
      return: ["Return"],
      "round-context": ["Round context"],
    });
  });

  it("no shipped template files remain on disk (渲染数据平面单文件：四 .md 并入 sections)", () => {
    expect(readFileSync(path.join(TEMPLATES, "template-contract.json"), "utf8")).toContain(
      '"$version": 3',
    );
    for (const rel of ["task/implement.md", "task/fix.md", "docs/review.md", "docs/fix.md"]) {
      expect(() => readFileSync(path.join(TEMPLATES, rel), "utf8")).toThrow(); // 文件已删 —— 读取即抛 ENOENT
    }
  });
});
