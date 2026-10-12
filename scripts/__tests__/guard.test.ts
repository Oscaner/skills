// scripts/__tests__/guard.test.ts — the guard tests (the checkables: guard
// tests green, the consumption-face asserts). The consumption-face assertions: the
// guard reads the typed engine exports (skill-anatomy contract · word-table ban
// vocabulary · the runtime/host planes) — the live faces pass, and an injected bad
// fixture trips the matching check (each check fires against its own axe).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SKILL_ANATOMY } from "../../packages/cdd-engine/src-next/contract/skill-anatomy.ts";
import { DISPATCH, type DispatchTable } from "../../packages/cdd-engine/src-next/face/host.ts";
import { CAPSULE_WORDS, GUARD_BAN_WORDS } from "../../packages/cdd-engine/src-next/face/words.ts";
import { GuardLibrary, guardLibrary } from "../lib/guard.ts";
import { scanToken } from "../lib/scan.ts";
import { analyticsSkillFixture } from "./helpers/anatomy-fixture.ts";

describe("checkAnatomy — the typed skill-anatomy contract consumption", () => {
  it("passes against the live kairos skills (the checkable's green face)", () => {
    const findings = guardLibrary.checkAnatomy();
    expect(
      findings.map((f) => f.label).join("\n"),
      `live anatomy findings:\n${findings.map((f) => `  ${f.file}: ${f.label}`).join("\n")}`,
    ).toBe("");
  });

  it("fires on an unregistered `## ` heading (the strict allowlist)", () => {
    const skill = analyticsSkillFixture({ unregistered: true });
    try {
      const findings = guardLibrary.checkAnatomy([{ name: "test-skill", path: skill.write() }]);
      const labels = findings.map((f) => f.label);
      expect(labels.some((l) => l.includes("unregistered"))).toBe(true);
      expect(labels.some((l) => l.includes("consumer-surface"))).toBe(false);
    } finally {
      skill.cleanup();
    }
  });

  it("passes the intact fixture (the four-public-section baseline)", () => {
    const skill = analyticsSkillFixture();
    try {
      const findings = guardLibrary.checkAnatomy([{ name: "test-skill", path: skill.write() }]);
      expect(findings).toEqual([]);
    } finally {
      skill.cleanup();
    }
  });

  it("reads the growth limits + registry from the contract (data, never a literal)", () => {
    expect(SKILL_ANATOMY.growthBoundary.nodeLimit).toBe(15);
    expect(SKILL_ANATOMY.growthBoundary.edgeLimit).toBe(17);
    expect(SKILL_ANATOMY.consumerPurity.forbiddenNarrativeHeads).toContain(
      "## Full Flow Refactor Rationale",
    );
    // The registered crossing — cdd-design carries the parameterized single-template
    // digraph (the double charter nodes + the merged spec/phase dispatch + the four
    // size-exits), which crosses the edge limit by definition; the rationale lives in
    // the contract, never inside the shipped skill.
    expect(Object.keys(SKILL_ANATOMY.growthBoundary.registry.crossings)).toEqual(["cdd-design"]);
  });

  it("the edge-condition word pin — the NEXT-LOOP phrases + status/route words derive from the engine word table (the word-table pin)", () => {
    const conditions = SKILL_ANATOMY.edgeConditionWords;
    // The three pinned NEXT-LOOP loop-condition phrases.
    for (const phrase of ["until next=done", "next=done", "no next"] as const) {
      expect(conditions).toContain(phrase);
    }
    // The decision status words ⊆ the engine's status vocabulary.
    for (const status of ["APPROVED", "CHANGES_REQUESTED", "REVIEW_FIX"] as const) {
      expect(conditions).toContain(status);
      expect(CAPSULE_WORDS.status).toContain(status);
    }
    // The Route-kind words ⊆ the engine's next: lexicon.
    for (const kind of ["done", "next-wave", "review", "fix", "soft-cap"] as const) {
      expect(conditions).toContain(kind);
    }
    // The retired `none` never rides the condition vocabulary.
    expect(conditions).not.toContain("none");
  });
});

describe("checkWords — the guard-ban vocabulary from the word-table export", () => {
  it("passes against the live new-tree planes (zero hits)", () => {
    const findings = guardLibrary.checkWords();
    expect(
      findings.map((f) => f.label).join("\n"),
      `live word findings:\n${findings.map((f) => `  ${f.file}: ${f.label}`).join("\n")}`,
    ).toBe("");
  });

  it("fires when a live face carries a ban token (the release-mask semantics)", () => {
    // The ban token comes from the word-table data (the scan never restates it).
    const ban = GUARD_BAN_WORDS.stale[0]!.token;
    const dir = mkdtempSync(path.join(tmpdir(), "guard-words-"));
    const rel = path.join(dir, "sub", "bang.ts");
    try {
      mkdirSync(path.join(dir, "sub"), { recursive: true });
      writeFileSync(rel, `const v = "${ban}" + "x";\n`, "utf8");
      // Outside the release homes a quoted string still builds a hit (a code string
      // literal is a use, never a data release).
      const hits = scanToken([dir], ban, "/");
      expect(hits.some((h) => h.file.endsWith("bang.ts"))).toBe(true);
      // Inside the ban vocabulary's data home the quoted row IS the release form.
      const release = path.join(dir, "release.ts");
      writeFileSync(release, `{ token: "${ban}" },\n`, "utf8");
      const withRelease = scanToken([dir], ban, "/", {
        releaseFiles: [path.posix.relative("/", release)],
      });
      expect(withRelease.some((h) => h.file.endsWith("release.ts"))).toBe(false);
      expect(withRelease.some((h) => h.file.endsWith("bang.ts"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("excludes whole files by path prefix — the per-file skip never leaks mid-file hits", () => {
    const ban = GUARD_BAN_WORDS.stale[0]!.token;
    const dir = mkdtempSync(path.join(tmpdir(), "guard-exclude-"));
    try {
      const kept = path.join(dir, "kept.ts");
      const dropped = path.join(dir, "vendor", "drop.ts");
      mkdirSync(path.join(dir, "vendor"), { recursive: true });
      writeFileSync(kept, `const w = "${ban}" + "y";\n`, "utf8");
      // Multiple token-bearing lines inside an excluded path — the whole file must be
      // skipped (a mid-loop break would silently drop the lines past the first hit).
      writeFileSync(dropped, `const a = "${ban}" + "a";\nconst b = "${ban}" + "b";\n`, "utf8");
      const hits = scanToken([dir], ban, "/", {
        excludePaths: [path.posix.relative("/", path.join(dir, "vendor"))],
      });
      expect(hits.some((h) => h.file.endsWith("vendor/drop.ts"))).toBe(false);
      expect(hits.some((h) => h.file.endsWith("kept.ts"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exposes the ban families as exported data (the consumption-face assert)", () => {
    expect(GUARD_BAN_WORDS.stale.map((r) => r.token)).toContain(".mjs");
    expect(GUARD_BAN_WORDS.gate.map((r) => r.token)).toContain("CDD_GATE");
    expect(GUARD_BAN_WORDS.shape.map((r) => r.token)).toContain("return block");
  });
});

describe("checkChannels — the runtime/host export audit", () => {
  it("passes against the typed runtime + host planes (the channel closure green)", () => {
    const findings = guardLibrary.checkChannels();
    const labels = findings.map((f) => f.label);
    // The host-marker closure derives from the detect rows (never a second list).
    expect(labels.filter((l) => l.includes("marker")).join("\n"), "host-marker closure drift").toBe(
      "",
    );
    // The dispatch/refs derivation holds.
    expect(labels.filter((l) => l.includes("ref"))).toEqual([]);
    // The CLI channel closure holds.
    expect(labels.filter((l) => l.includes("channel key"))).toEqual([]);
  });

  it("triggers on a broken dispatch entry (an unregistered ref trips the refs audit)", () => {
    const broken = new GuardLibrary({ dispatch: { ...DISPATCH, implement: "kairos:nope" } });
    const labels = broken.checkChannels().map((f) => f.label);
    expect(labels.some((l) => l.includes("unregistered ref key"))).toBe(true);
  });

  it("a fix-less dispatch passes the refs audit — the T1 fix-face closure (zero push on an absent fix slot)", () => {
    // The T1 fail-first premise: the dispatch table's fix slot is gone (the fix
    // face carries no skill ref) — checkChannels must pass WITHOUT the
    // `pushRef(this.#dispatch.fix)` derived line tripping on an absent member.
    const fixless: DispatchTable = {
      implement: DISPATCH.implement,
      review: { ...DISPATCH.review },
    };
    const labels = new GuardLibrary({ dispatch: fixless }).checkChannels().map((f) => f.label);
    expect(labels).toEqual([]);
  });

  it("the dispatch supersede — implement names the upstream implement skill (P5)", () => {
    expect(DISPATCH.implement).toBe("mattpocock-skills:implement");
    // T1 — the fix face carries no skill ref: the dispatch's fix slot is gone (the
    // retired alias's absence is the zero-residue grep's surface, never re-asserted)
    expect("fix" in DISPATCH).toBe(false);
  });
});

describe("checkHandoffPlane — the handoff writable-subset audit (T3)", () => {
  /** The role-broken fake declaration pair — the work subset declares the findings
   *  exclusive + the findings subset declares a work exclusive (both ① axes), while
   *  staying projection-consistent (the ③ fakes align). */
  const roleBroken = {
    work: {
      type: "object",
      properties: {
        status: {},
        failure_category: {},
        artifacts: {},
        commits: {},
        changes: {},
        notes: {},
        findings: {},
      },
    },
    findings: {
      type: "object",
      properties: { findings: {}, artifacts: {}, commits: {}, notes: {}, status: {} },
    },
  };
  /** The projection-① fake for a given declared pair — the faithful fence generator
   *  (strips the engineOnly metadata exactly like the engine's projection ①, so the
   *  fakes' fences stay consistent with the declared-minus-engineOnly ruling). */
  const fenceOf =
    (declared: {
      work: { type?: string; properties?: Record<string, unknown>; engineOnly?: string[] };
      findings: { type?: string; properties?: Record<string, unknown>; engineOnly?: string[] };
    }) =>
    (face: "work" | "findings") =>
      `\`\`\`json\n${JSON.stringify(declared[face], (key, value) =>
        key === "engineOnly" ? undefined : value,
      )}\n\`\`\``;

  it("passes against the live handoff declarations (the checkable's green face)", () => {
    const findings = guardLibrary.checkHandoffPlane();
    expect(
      findings.map((f) => f.label).join("\n"),
      `live handoff-plane findings:\n${findings.map((f) => `  ${f.file}: ${f.label}`).join("\n")}`,
    ).toBe("");
  });

  it("fires when the declared subsets blur the face roles — a work-key in the findings subset breaks the exclusivity (①)", () => {
    const findings = guardLibrary.checkHandoffPlane({
      declared: roleBroken,
      schemaText: fenceOf(roleBroken),
    });
    const labels = findings.map((f) => f.label);
    expect(labels.join("\n")).toContain(
      "work writable subset declares the findings-face exclusive",
    );
    expect(labels.join("\n")).toContain(
      "findings writable subset declares the work-face exclusive",
    );
    // the fakes declare no engineOnly and the projection stays consistent — only the
    // two ① role findings fire
    expect(findings).toHaveLength(2);
  });

  it("fires when an engineOnly key also rides the declared writable subset — the engine-only key leaks into the child projection view (⑥)", () => {
    const leaked = {
      work: {
        type: "object",
        properties: { status: {}, artifacts: {}, commits: {}, notes: {} },
        engineOnly: [],
      },
      findings: {
        type: "object",
        properties: { findings: {}, artifacts: {}, commits: {}, notes: {}, status: {} },
        engineOnly: ["status"],
      },
    };
    const findings = guardLibrary.checkHandoffPlane({
      declared: leaked,
      schemaText: fenceOf(leaked),
    });
    const labels = findings.map((f) => f.label);
    // the declared engine-only status ALSO declares status as a writable property —
    // the key the child must never author shows up in the child's writable view
    expect(labels.join("\n")).toContain("leaks into the child projection view");
  });

  it("fires when a declared engineOnly key is consumed by no engine write path — dead authority metadata (⑥)", () => {
    const unconsumed = {
      work: {
        type: "object",
        properties: { status: {}, artifacts: {}, commits: {}, notes: {} },
        engineOnly: [],
      },
      findings: {
        type: "object",
        properties: { findings: {}, artifacts: {}, commits: {}, notes: {} },
        engineOnly: ["bogus"],
      },
    };
    const findings = guardLibrary.checkHandoffPlane({
      declared: unconsumed,
      schemaText: fenceOf(unconsumed),
    });
    const labels = findings.map((f) => f.label);
    // `bogus` stays out of the writable subset and the projection matches — the ONE
    // hygiene failure is the unconsumed declaration (no real carrier write site)
    expect(labels.join("\n")).toContain("no engine carrier write path consumes");
    expect(findings).toHaveLength(1);
  });

  it("fires when the projection-① fence differs from the declared node — the prompt shows an undeclared schema (③)", () => {
    const findings = guardLibrary.checkHandoffPlane({
      schemaText: () => '```json\n{"type":"object","properties":{"findings":{}}}\n```',
    });
    const labels = findings.map((f) => f.label);
    expect(labels.join("\n")).toContain(
      "parses to a different node than the declared writable subset minus engineOnly",
    );
    expect(findings).toHaveLength(2); // both faces drift from their declared nodes
  });
});
