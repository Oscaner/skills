// scripts-next/__tests__/guard.test.ts — the T14 guard tests (the checkables: guard
// tests green, the consumption-face asserts). The consumption-face assertions: the
// guard reads the typed engine exports (skill-anatomy contract · word-table ban
// vocabulary · the runtime/host planes) — the live faces pass, and an injected bad
// fixture trips the matching check (each check fires against its own axe).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SKILL_ANATOMY } from "../../packages/cdd-engine/src-next/contract/skill-anatomy.ts";
import { DISPATCH } from "../../packages/cdd-engine/src-next/face/host.ts";
import { GUARD_BAN_WORDS } from "../../packages/cdd-engine/src-next/face/words.ts";
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
    // The contract carries zero registered crossings today.
    expect(Object.keys(SKILL_ANATOMY.growthBoundary.registry.crossings)).toEqual([]);
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

  it("the dispatch supersede — implement names the upstream implement skill (P5)", () => {
    expect(DISPATCH.implement).toBe("mattpocock-skills:implement");
  });
});
