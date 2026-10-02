// scripts/lib/__tests__/contract-lexicon.test.ts — the ContractLexiconGuard regression surface
// (P3 T4): the converged check faces. checkAnatomy — the digraph-consistency assertion port
// (live skills green + the mkdtemp deliberate-break chains); checkResidue — the G2 cursor
// binary-name live-face collector (the migrated residue.test.ts G2 group: data-row release /
// non-data hits / anti-white-green / per-face dispositions / live-repo zero-hit); checkWording —
// the C7 shape-restate guard (banned names fail, modern referents pass, granularity ruling);
// checkConfig — the engine-config channel audit (whitelist + timeout facts, break injection);
// checkMarkers — the T3 three-way host-marker consistency guard (live three-way green + the
// single-side break chains). The README nominal-table ↔ markers-drift assertion does NOT live on
// this plane: the presentation surface is a package test (T5, nominal table == data derivation) —
// the lexicon test plane holds only the data-plane invariants.
// The scanned lexeme is NEVER written contiguously here (the test position is self-exempt from
// the scripts face scan — scripts/__tests__ is skipped by default — but the file stays
// zero-literal so a future scope extension cannot self-bite); it is built by concatenation.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ORCHESTRATOR_SKILLS } from "../../validate/residue.ts";
import {
  type AnatomyFinding,
  ContractLexiconGuard,
  G2_LIVE_FACES,
  ZERO_DEBT_FACES,
} from "../contract-lexicon.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
// The data-source constants the assertion helpers read (the repo config homes).
const LEXICON_SRC = path.join(REPO_ROOT, "packages/cdd-engine/config/contract-lexicon.json");
const CONTRACT_SRC = path.join(REPO_ROOT, "packages/cdd-engine/config/harness-contract.json");

const guard = new ContractLexiconGuard();

// T5 (P5): the guarded zero-debt tokens, built by concatenation — the test position stays
// zero-literal so a future scope extension (scripts tests included) cannot self-bite.
const T5_TS_IGNORE = "@ts" + "-ignore";
const T5_TS_EXPECT_ERROR = "@ts" + "-expect" + "-error";
const T5_MJS = "." + "mjs";
const T5_READBACK = "(read <" + "handoff> back to confirm)";

// ---------------------------------------------------------------------------
// The lexicon itself — five domains exist and agree with the engine facts
// ---------------------------------------------------------------------------

describe("contract-lexicon.json — the pure word-table domains + engine-facts consistency", () => {
  it("the lexicon carries zero harness domain — the harness contract is the unique harness-data source", () => {
    // The loaded lexicon data (JSON.parse boundary): the absence of a harness domain is the C8
    // re-home assertion — the harness contract is the unique harness-data source.
    const lexData = JSON.parse(readFileSync(LEXICON_SRC, "utf8")) as Record<string, unknown>;
    expect(lexData.harness).toBeUndefined();
    const contract = guard.contract();
    expect(Object.keys(contract).sort()).toEqual([
      "_doc",
      "claude",
      "cursor",
      "dispatch",
      "pi",
      "refs",
    ]);
    expect(Object.keys(contract.refs ?? {})).toContain("kairos:cdd-plan");
    expect(Object.keys(contract.dispatch ?? {})).toEqual(["implement", "fix", "review"]);
  });

  it("status domain: the five-value vocab + the dual-axis mapping (judgment three states / work COMPLETED)", () => {
    const lex = guard.lexicon();
    expect(lex.status.vocab.sort()).toEqual([
      "APPROVED",
      "BLOCKED",
      "CHANGES_REQUESTED",
      "REVIEW_FIX",
      "TIMEOUT",
    ]);
    // The judgment axis owns the review conclusion states; only COMPLETED is the work-axis fold.
    expect(lex.status.axes.judgment.includes("COMPLETED")).toBe(false);
    expect(lex.status.axes.work).toEqual(["COMPLETED"]);
  });

  it("stdout domain: the capsule tokens + route anchors present, banned shape names carry no cursor residue", () => {
    const lex = guard.lexicon();
    expect(lex.stdout.capsule).toEqual(["status", "blocker", "handoff"]);
    for (const tok of ["next:", "CDD_BLOCKED:", "findings"]) {
      expect(lex.stdout.routeTokens).toContain(tok);
    }
    for (const shape of ["3-line return block", "4th line counters", "return block"]) {
      expect(lex.stdout.bannedShapeNames).toContain(shape);
    }
  });

  it("residue domain: the data sources are the two config JSONs and the ban token is the cursor cli data value", () => {
    const lex = guard.lexicon();
    expect(lex.residue.dataSources.sort()).toEqual([
      "contract-lexicon.json",
      "harness-contract.json",
    ]);
    // C8: the ban token follows the harness contract's cursor cli (the unique cli source) — read
    // from the raw contract data (JSON.parse boundary).
    const contract = JSON.parse(readFileSync(CONTRACT_SRC, "utf8")) as {
      cursor: { cli: string };
    };
    expect(lex.residue.bannedToken).toBe(contract.cursor.cli);
  });

  it("anatomy domain: the skill-anatomy schema path resolves on disk", () => {
    const lex = guard.lexicon();
    const p = path.isAbsolute(lex.anatomy.schemaPath)
      ? lex.anatomy.schemaPath
      : path.join(REPO_ROOT, lex.anatomy.schemaPath);
    expectExists(p);
  });
});

describe("contract-lexicon.json — the T5 (P5) zero-debt / buildability / read-back domains", () => {
  it("escape domain: the two escape directives + the ban wording are present", () => {
    const lex = guard.lexicon();
    expect(lex.escape.tokens).toEqual([T5_TS_IGNORE, T5_TS_EXPECT_ERROR]);
    expect(lex.escape.wording.length).toBeGreaterThan(0);
  });

  it("zeroDebt domain: the prebuilt-module extension token rides the data", () => {
    expect(guard.lexicon().zeroDebt.mjsToken).toBe(T5_MJS);
    expect(guard.lexicon().zeroDebt.wording.length).toBeGreaterThan(0);
  });

  it("buildability domain: the dual-evidence wording carries the tsc + test tokens (T6 read-only consumption)", () => {
    const dual = guard.lexicon().buildability.dualEvidence;
    expect(dual.length).toBeGreaterThan(0);
    expect(dual).toContain("tsc");
    expect(dual).toContain("test");
    expect(guard.lexicon().buildability.wording.length).toBeGreaterThan(0);
  });

  it("stdout domain: the canonical read-back annotation (the T5 restate decision — zero restate on the orchestrator surface)", () => {
    expect(guard.lexicon().stdout.readbackAnnotation).toBe(T5_READBACK);
  });
});

function expectExists(p: string): void {
  if (!existsSync(p)) throw new Error(`missing expected file: ${p}`);
}

// ---------------------------------------------------------------------------
// checkAnatomy — the digraph-consistency assertion port
// ---------------------------------------------------------------------------

describe("ContractLexiconGuard.checkAnatomy — live skills (digraph-consistency port)", () => {
  it("all kairos skills pass every schema-driven check (the retired node:test surface)", () => {
    const findings = guard.checkAnatomy();
    expect(findings).toEqual([]);
  });
});

// mkdtemp deliberate-break chains: a minimal-but-valid synthetic skill (the control) and four
// broken variants — each break must be intercepted by the corresponding check (the anti-white-green
// proof that the schema-driven checks fire). Built in mkdtemp dirs (zero repo-product fixtures).
const BASE_SKILL = `# Synthetic Skill

## Flow Digraph

\`\`\`mermaid
flowchart TD
  A[run-thing] --> B{ok?}
  B -->|yes| C((APPROVED))
  B -->|no| D((BLOCKED: nope))
\`\`\`

## Node Definitions

### \`run-thing\`

- **Do**: Do the thing.
- **Read**: input
- **Exit**: ok? → \`ok?\`
- **Fail**: failure → fail-open

### \`ok?\`

- **Do**: Decide.
- **Read**: output
- **Exit**: yes → APPROVED; no → BLOCKED
- **Fail**: —

## Invariants

| # | Invariant |
|---|---|
| I1 | Keep it simple. |

## Failure Modes

| failure | behavior |
|---|---|
| nope | BLOCKED (no silent fallback) |
`;

interface BreakCase {
  kind: string;
  expect: RegExp;
  make: (src: string) => string;
}

const BREAK_CASES: BreakCase[] = [
  {
    kind: "deleted-node",
    expect: /^digraph-(dangling-node|orphan-section)$/,
    make: (s) => s.replace(/### `run-thing`[\s\S]*?(?=\n### |\n## )/, "\n"),
  },
  {
    kind: "broken-four-elements",
    expect: /^node-missing-/,
    make: (s) => s.replace("- **Do**: Do the thing.\n", ""),
  },
  {
    kind: "unregistered-section",
    expect: /^registry-/,
    make: (s) => `${s}\n## Flow size note\n\nNarration that never ships.\n`,
  },
  {
    kind: "digraph-prose",
    expect: /^digraph-prose-after-mermaid$/,
    make: (s) =>
      s.replace(
        "```\n\n## Node Definitions",
        "```\n\n7 process steps / 2 nodes.\n\n## Node Definitions",
      ),
  },
];

describe("ContractLexiconGuard.checkAnatomy — mkdtemp deliberate-break chains", () => {
  // The interception surface = the per-skill anatomy categories (the original
  // interceptingFindings union). The family/growth findings (skeleton-deltas-missing — the spec
  // writers are absent from a single synthetic-file list, growth-crossing-unregistered /
  // consumer-purity-heading / skeleton-shape) are the family-level checks and never fired by the
  // per-skill break chains.
  const PER_SKILL_SURFACE = (f: AnatomyFinding): boolean =>
    ![
      "skeleton-deltas-missing",
      "growth-crossing-unregistered",
      "consumer-purity-heading",
      "skeleton-shape",
    ].includes(f.category);

  it("the synthetic base skill passes every check (control)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-anatomy-ctrl-"));
    try {
      const file = path.join(dir, "control.md");
      writeFileSync(file, BASE_SKILL, "utf8");
      expect(
        guard.checkAnatomy([{ name: "synthetic-control", path: file }]).filter(PER_SKILL_SURFACE),
      ).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("deleted node / broken four elements / unregistered section / digraph prose are each intercepted", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-anatomy-break-"));
    try {
      for (const c of BREAK_CASES) {
        const file = path.join(dir, `${c.kind}.md`);
        writeFileSync(file, c.make(BASE_SKILL), "utf8");
        const findings = guard
          .checkAnatomy([{ name: `synthetic-${c.kind}`, path: file }])
          .filter(PER_SKILL_SURFACE);
        const matching = findings.filter((f) => c.expect.test(f.category));
        expect(
          matching.length,
          `synthetic-${c.kind}: expected the ${c.expect} check to intercept the deliberate break — none fired`,
        ).toBeGreaterThan(0);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// checkResidue — the G2 cursor binary-name live-face collector (migrated group)
// ---------------------------------------------------------------------------

describe("ContractLexiconGuard.checkResidue — G2 cursor live-face guard (P3 T2/T4)", () => {
  const CURSOR_BINARY = "cursor" + "-agent";
  const registryText = (cliValue: string) => `{ "cursor": { "cli": "${cliValue}" } }\n`;
  const pathDir = (label: string) => mkdtempSync(path.join(tmpdir(), label));

  it("(a) data-source data-value rows are green (the release form)", () => {
    const dir = pathDir("g2-a-");
    writeFileSync(path.join(dir, "harness-contract.json"), registryText(CURSOR_BINARY), "utf8");
    try {
      expect(guard.checkResidue([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b) a non-data hit fails (plain prose; a junk data-source row key is not a release form)", () => {
    const dir = pathDir("g2-b-");
    writeFileSync(path.join(dir, "note.md"), `the ${CURSOR_BINARY} rename\n`, "utf8");
    writeFileSync(
      path.join(dir, "harness-contract.json"),
      `{ "${CURSOR_BINARY}": { "cli": "sora" } }\n`,
      "utf8",
    );
    try {
      const hits = guard.checkResidue([dir]);
      expect(hits).toHaveLength(2); // note.md + the junk row key
      expect(hits[0].label).toMatch(/G2/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(a2) an adjacent JSON scalar field does not defeat the structural-purity mask", () => {
    const dir = pathDir("g2-a2-");
    writeFileSync(
      path.join(dir, "harness-contract.json"),
      `{ "cli": "${CURSOR_BINARY}", "port": 9000, "ratio": -1.5e3, "flag": true, "extra": null }\n`,
      "utf8",
    );
    try {
      expect(guard.checkResidue([dir])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b2) a ','-preceded non-first mapping key is not a value position (right-context rule)", () => {
    const dir = pathDir("g2-b2-");
    writeFileSync(
      path.join(dir, "harness-contract.json"),
      `{ "clis": { "cursor": "sora" }, "${CURSOR_BINARY}": "retired" }\n`,
      "utf8",
    );
    try {
      const hits = guard.checkResidue([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0].file).toContain("harness-contract.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b-comp) lexicon-typed data rows release (clis mapping / ban-table rows green); out-of-domain residue still fails", () => {
    const dir = pathDir("g2-le-");
    writeFileSync(path.join(dir, "harness-contract.json"), registryText(CURSOR_BINARY), "utf8");
    // contract-lexicon.json is the T4 data source; its harness clis mapping / residue ban-table
    // rows carry the cli value as data and mask under the same data-row form.
    writeFileSync(
      path.join(dir, "contract-lexicon.json"),
      `{ "clis": { "cursor": "${CURSOR_BINARY}" }, "banned": ["${CURSOR_BINARY}"] }\n`,
      "utf8",
    );
    writeFileSync(path.join(dir, "note.md"), `${CURSOR_BINARY} outside the data domain\n`, "utf8");
    try {
      const hits = guard.checkResidue([dir]);
      expect(hits).toHaveLength(1); // note.md only — both data rows are green
      expect(hits[0].file).toContain("note.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(c) the allowance follows registry data (anti-white-green): after the cli value moves, the retired name on a live position fails", () => {
    const dir = pathDir("g2-c-");
    writeFileSync(path.join(dir, "harness-contract.json"), registryText("sora-agent"), "utf8");
    writeFileSync(path.join(dir, "note.md"), `the ${CURSOR_BINARY} name retired\n`, "utf8");
    try {
      const hits = guard.checkResidue([dir]);
      expect(hits).toHaveLength(1); // the retired name on a live (non-data) position fails
      expect(hits[0].file).toContain("note.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("per-face __tests__ dispositions: engine src scans test sites (includeTests ON), scripts exempts them", () => {
    const engineDir = pathDir("g2-engine-");
    mkdirSync(path.join(engineDir, "__tests__"), { recursive: true });
    writeFileSync(
      path.join(engineDir, "__tests__", "x.test.ts"),
      `const c = "${CURSOR_BINARY}";\n`,
      "utf8",
    );
    try {
      const engineHits = guard.checkResidue(undefined, [
        { targets: [engineDir], includeTests: true },
      ]);
      expect(engineHits).toHaveLength(1);
    } finally {
      rmSync(engineDir, { recursive: true, force: true });
    }
    const scriptsDir = pathDir("g2-scripts-");
    mkdirSync(path.join(scriptsDir, "validate", "__tests__"), { recursive: true });
    writeFileSync(
      path.join(scriptsDir, "validate", "__tests__", "residue.test.ts"),
      `// ${CURSOR_BINARY} assertion site\n`,
      "utf8",
    );
    writeFileSync(
      path.join(scriptsDir, "validate", "residue.ts"),
      `const t = "${CURSOR_BINARY}";\n`,
      "utf8",
    );
    try {
      const scriptsHits = guard.checkResidue(undefined, [
        { targets: [scriptsDir], includeTests: false },
      ]);
      expect(scriptsHits).toHaveLength(1); // the live residue.ts only; __tests__ exempt
      expect(scriptsHits[0].file).toContain("residue.ts");
    } finally {
      rmSync(scriptsDir, { recursive: true, force: true });
    }
  });

  it("G2_LIVE_FACES pins the three faces and the engine includeTests opt-in (scope shrink = fail)", () => {
    expect(G2_LIVE_FACES.map((f) => f.targets[0])).toEqual([
      "packages/cdd-engine/src",
      "scripts",
      "docs/maintainers",
    ]);
    const engine = G2_LIVE_FACES.find((f) => f.targets[0] === "packages/cdd-engine/src");
    expect(engine?.includeTests).toBe(true);
    for (const f of G2_LIVE_FACES.filter((x) => x.targets[0] !== "packages/cdd-engine/src")) {
      expect(f.includeTests).toBe(false);
    }
  });

  it("live repo: the three faces zero-hit + the real lexicon data rows release", () => {
    expect(guard.checkResidue()).toEqual([]);
    expect(guard.checkResidue(["packages/cdd-engine/src/infra"])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// checkEscape / checkMjs — the T5 zero-debt source faces (five faces, ZERO_DEBT_FACES)
// ---------------------------------------------------------------------------

describe("ContractLexiconGuard.checkEscape — T5 escape-directive zero-hit (the source faces)", () => {
  it("live repo: the zero-debt faces carry zero escape directives (incl. engine + kairos test sites)", () => {
    expect(guard.checkEscape()).toEqual([]);
  });

  it("an escape directive on a temp source file fails (engine face disposition: test sites included)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-escape-"));
    try {
      mkdirSync(path.join(dir, "__tests__"), { recursive: true });
      writeFileSync(path.join(dir, "mech.ts"), `// ${T5_TS_IGNORE} restate\n`, "utf8");
      writeFileSync(
        path.join(dir, "__tests__", "m.test.ts"),
        `// ${T5_TS_EXPECT_ERROR} restate\n`,
        "utf8",
      );
      const hits = guard.checkEscape([{ targets: [dir], includeTests: true }]);
      expect(hits.map((h) => h.file).join(" | ")).toContain("mech.ts");
      expect(hits.map((h) => h.file).join(" | ")).toContain(path.join("__tests__", "m.test.ts"));
      expect(hits[0].label).toContain("T5");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the scripts disposition exempts its __tests__ (the guard's own regression position); a live file fails", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-escape-ts-"));
    try {
      mkdirSync(path.join(dir, "__tests__"), { recursive: true });
      writeFileSync(path.join(dir, "mech.ts"), `// ${T5_TS_IGNORE} restate\n`, "utf8");
      writeFileSync(
        path.join(dir, "__tests__", "t.test.ts"),
        `// ${T5_TS_IGNORE} assertion site\n`,
        "utf8",
      );
      const hits = guard.checkEscape([{ targets: [dir], includeTests: false }]);
      expect(hits).toHaveLength(1);
      expect(hits[0].file).toContain("mech.ts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the lexicon config data rows release (the directives ride data values); an out-of-data line fails", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-escape-rl-"));
    try {
      writeFileSync(
        path.join(dir, "contract-lexicon.json"),
        `{ "tokens": ["${T5_TS_IGNORE}", "${T5_TS_EXPECT_ERROR}"] }\n`,
        "utf8",
      );
      writeFileSync(
        path.join(dir, "note.ts"),
        `// ${T5_TS_IGNORE} outside the data domain\n`,
        "utf8",
      );
      const hits = guard.checkEscape([{ targets: [dir], includeTests: true }]);
      expect(hits).toHaveLength(1);
      expect(hits[0].file).toContain("note.ts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ZERO_DEBT_FACES pins the five source faces + the engine includeTests opt-in (scope shrink = fail)", () => {
    expect(ZERO_DEBT_FACES.map((f) => f.targets[0])).toEqual([
      "packages/cdd-engine/src",
      "scripts",
      "packages/kairos/tests",
      "packages/cdd-engine/config",
      "vitest.config.ts",
    ]);
    expect(ZERO_DEBT_FACES[0].includeTests).toBe(true); // engine src zeroing held in test sites
    expect(ZERO_DEBT_FACES[1].includeTests).toBe(false); // scripts self-exempts its __tests__
    for (const f of ZERO_DEBT_FACES.slice(2)) expect(Array.isArray(f.targets)).toBe(true);
    // the source-config face = the T3-migrated config plane (the three .ts config files the
    // whole-repo .mjs→.ts migration moved) — pinned in full so a config-target change also fails.
    expect(ZERO_DEBT_FACES[4].targets).toEqual([
      "vitest.config.ts",
      "packages/cdd-engine/vitest.config.ts",
      "lint-staged.config.ts",
    ]);
    expect(ZERO_DEBT_FACES[4].includeTests).toBe(false);
  });
});

describe("ContractLexiconGuard.checkMjs — T5 whole-repo source-plane prebuilt-module zero-hit", () => {
  it("live repo: the zero-debt faces carry zero prebuilt-module files", () => {
    expect(guard.checkMjs()).toEqual([]);
  });

  it("a file of the banned extension fails by extension (never a content scan); test-site disposition rides the face", () => {
    const root = mkdtempSync(path.join(tmpdir(), "lex-mjs-"));
    try {
      const src = path.join(root, "src");
      mkdirSync(path.join(src, "__tests__"), { recursive: true });
      // The product dist tree sits OUTSIDE the faces (a sibling of the scanned src face) and stays
      // exempt — the published package ships real built artifacts there.
      mkdirSync(path.join(root, "dist"), { recursive: true });
      writeFileSync(path.join(src, `bin${T5_MJS}`), "console.log(1)\n", "utf8");
      writeFileSync(path.join(src, "__tests__", `node${T5_MJS}`), "// retired plane\n", "utf8");
      writeFileSync(path.join(root, "dist", `out${T5_MJS}`), "// built artifact\n", "utf8");
      const engineHits = guard.checkMjs([{ targets: [src], includeTests: true }]);
      expect(engineHits.map((h) => h.file).join(" | ")).toContain(`bin${T5_MJS}`);
      expect(engineHits.map((h) => h.file).join(" | ")).toContain(
        path.join("__tests__", `node${T5_MJS}`),
      );
      expect(engineHits.map((h) => h.file).join(" | ")).not.toContain("dist");
      const scriptsHits = guard.checkMjs([{ targets: [src], includeTests: false }]);
      expect(scriptsHits).toHaveLength(1);
      expect(scriptsHits[0].file).toContain(`bin${T5_MJS}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// checkWording — the C7 shape-restate guard
// ---------------------------------------------------------------------------

describe("ContractLexiconGuard.checkWording — C7 shape-restate (P3 T4)", () => {
  it("live orchestrator skills carry zero engine-shape restates", () => {
    expect(guard.checkWording(ORCHESTRATOR_SKILLS)).toEqual([]);
  });

  it("each banned shape name is intercepted on a temp file; 3-line return block is reported under its own name", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-wording-"));
    try {
      const cases = [
        { line: "the 3-line return block contract", expect: "3-line return block" },
        { line: "the engine's 4th line counters", expect: "4th line counters" },
        {
          line: "an APPROVED stub handoff plus the return block contract only",
          expect: "return block",
        },
      ];
      for (const [i, c] of cases.entries()) {
        const file = path.join(dir, `t${i}.md`);
        writeFileSync(file, `line with ${c.line}\n`, "utf8");
        const hits = guard.checkWording([file]);
        expect(hits).toHaveLength(1);
        expect(hits[0].label).toContain(c.expect);
        expect(hits[0].line).toBe(1);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("modern contract referents pass: output contract / handoff / findings / standalone counters", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-wording-pass-"));
    try {
      const file = path.join(dir, "ok.md");
      writeFileSync(
        file,
        [
          "- **Read**: output contract — the status capsule and the `next:` suggestion",
          "- the counters recorded in the handoff and its `findings`",
          "- reduce prose after the counters report",
          "",
        ].join("\n"),
        "utf8",
      );
      expect(guard.checkWording([file])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // T5 (P5): the zero-debt restate guard — the escape directives / the prebuilt-module extension /
  // the engine read-back annotation carry zero literal restates on the orchestrator skills (the
  // read-back hint rides the actual command output; the restate decision = zero restate).
  it("live orchestrator skills carry zero zero-debt restates (T5)", () => {
    expect(guard.checkWording(ORCHESTRATOR_SKILLS)).toEqual([]);
  });

  it("each zero-debt token is intercepted on a temp file with the zero-debt label", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-zd-"));
    try {
      const cases = [
        { line: `the ${T5_TS_IGNORE} restate`, expect: T5_TS_IGNORE },
        { line: `run the ${T5_MJS} plane`, expect: T5_MJS },
        { line: `dispatch ${T5_READBACK}`, expect: T5_READBACK },
      ];
      for (const [i, c] of cases.entries()) {
        const file = path.join(dir, `t${i}.md`);
        writeFileSync(file, `${c.line}\n`, "utf8");
        const hits = guard.checkWording([file]);
        const zeroDebt = hits.filter((h) => h.label.includes("zero-debt"));
        expect(zeroDebt.length).toBeGreaterThan(0);
        expect(zeroDebt.map((h) => h.label).join(" | ")).toContain(c.expect);
        expect(zeroDebt[0].line).toBe(1);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("neutral zero-debt behavior prose passes — the bans target the literal restates only (T5)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-zd-pass-"));
    try {
      const file = path.join(dir, "ok.md");
      writeFileSync(
        file,
        [
          "- read the `next:` suggestion for routing and dispatch per it when continuing directly",
          "- the plan keeps the source plane fully typed; escaped directives stay banned in the repo",
          "- read the handoff back to confirm before dispatching the fix",
          "",
        ].join("\n"),
        "utf8",
      );
      expect(guard.checkWording([file])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// checkConfig — the engine-config channel audit
// ---------------------------------------------------------------------------

describe("ContractLexiconGuard.checkConfig — engine-config channel audit (P3 T4)", () => {
  it("live engine-config: the env whitelist is exactly the four pinned keys + timeout defaults", () => {
    expect(guard.checkConfig()).toEqual([]);
  });

  it("a config on the wrong channel whitelist fires (host-marker closure broken)", () => {
    const cfg = {
      channels: {
        env: {
          hostHarness: { markers: ["CURSOR_TRACE_ID", "CLAUDE_CODE_SESSION_ID", "AI_AGENT"] },
          path: { var: "PATH" },
          extra: { var: "EXTRA_KEY" },
        },
      },
      timeouts: { defaults: { implement: 21_600_000, review: 10_800_000, fix: 21_600_000 } },
    };
    const hits = guard.checkConfig(cfg);
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toContain("env-channel whitelist");
  });

  it("a config missing the canonical timeout defaults fires", () => {
    const cfg = {
      channels: { env: { path: { var: "PATH" }, hostHarness: { markers: ["AI_AGENT"] } } },
      timeouts: { defaults: { implement: 42 } },
    };
    const hits = guard.checkConfig(cfg);
    const labels = hits.map((h) => h.label).join(" | ");
    expect(labels).toContain("defaults.review");
    expect(labels).toContain("defaults.fix");
  });
});

// ---------------------------------------------------------------------------
// checkMarkers / checkHarness — the harness-contract guard (C8; checkMarkers = detect direction)
// ---------------------------------------------------------------------------

const MARKERS_HARNESS_SRC = path.join(REPO_ROOT, "packages/cdd-engine/src/infra/harness.ts");

/** The event-row surface of config/harness-contract.json the break helpers read/mutate (the
 *  parsed harness-contract.json — a JSON.parse boundary; other row keys ride the index). */
interface HarnessContractRow {
  detect?: { env?: string; aiAgentPrefix?: string; value?: string };
  install?: Record<string, string[]>;
  [key: string]: unknown;
}
/** The harness-contract.json top-level surface the prefix-direction tests mutate. */
interface HarnessContractSurface {
  dispatch: Record<string, unknown>;
  refs: Record<string, Record<string, string>>;
  claude: HarnessContractRow;
  cursor: HarnessContractRow;
  pi: HarnessContractRow;
}
type DetectRow = { env?: string; aiAgentPrefix?: string; value?: string };

// Temp-contract break helper: write a harness-contract.json with a harness-row detect mutated and
// run checkMarkers against it. The detect() source and the engine-config faces stay live — a hit
// can only come from the contract face.
function detectHitsWithContract(mutate: (detect: Record<string, DetectRow>) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "lex-detect-"));
  try {
    const contract = JSON.parse(readFileSync(CONTRACT_SRC, "utf8")) as HarnessContractSurface;
    const detect: Record<string, DetectRow> = {};
    for (const id of ["claude", "cursor", "pi"] as const) {
      // The live contract always carries a detect row on every harness (JSON data).
      const detectRow = contract[id].detect;
      assert.ok(detectRow, `live ${id} harness row missing its detect slot`);
      detect[id] = detectRow;
    }
    mutate(detect);
    // Write the mutated detect rows back — the id set seeded above is exactly the detected
    // harness ids (no caller in the break cases adds or removes an id).
    for (const id of ["claude", "cursor", "pi"] as const) contract[id].detect = detect[id];
    const file = path.join(dir, "harness-contract.json");
    writeFileSync(file, JSON.stringify(contract, null, 2), "utf8");
    return new ContractLexiconGuard({ registryPath: file }).checkMarkers();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("ContractLexiconGuard.checkMarkers — the detect direction of checkHarness (T3, C8 re-home)", () => {
  it("live repo: contract detect rows ↔ detect() predicates ↔ engine-config env whitelist agree", () => {
    expect(guard.checkMarkers()).toEqual([]);
  });

  it("a contract detect value the detect() predicate does not match fires (contract face)", () => {
    const hits = detectHitsWithContract((detect) => {
      detect.pi.value = "pi-dev";
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].file).toContain("harness.ts");
  });

  it("a contract detect aiAgentPrefix the detect() predicate does not carry fires (contract face)", () => {
    const hits = detectHitsWithContract((detect) => {
      detect.claude.aiAgentPrefix = "claude";
    });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("a detect() predicate value drift fires (detect face)", () => {
    const src = readFileSync(MARKERS_HARNESS_SRC, "utf8");
    const broken = src.replace('env.AI_AGENT === "pi"', 'env.AI_AGENT === "pi-dev"');
    const hits = guard.checkMarkers({ harnessSrc: broken });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("a detect() predicate reading an env key the contract does not declare fires (detect face)", () => {
    const src = readFileSync(MARKERS_HARNESS_SRC, "utf8");
    const broken = src.replace(
      "return Boolean(env.CURSOR_TRACE_ID);",
      "return Boolean(env.CURSOR_TRACE_ID) || Boolean(env.CURSOR_SESSION_ID);",
    );
    const hits = guard.checkMarkers({ harnessSrc: broken });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("a harness class id the detect set does not declare fires (identity closure)", () => {
    const src = readFileSync(MARKERS_HARNESS_SRC, "utf8");
    const broken = src.replace(
      'readonly id = "claude" as const;',
      'readonly id = "claude-x" as const;',
    );
    const hits = guard.checkMarkers({ harnessSrc: broken });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("an engine-config env whitelist dropping a detect key fires (config face)", () => {
    const cfg = {
      channels: {
        env: {
          hostHarness: { markers: ["CURSOR_TRACE_ID", "CLAUDE_CODE_SESSION_ID"] },
          path: { var: "PATH" },
        },
      },
    };
    const hits = guard.checkMarkers({ engineConfig: cfg });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].file).toContain("engine-config.json");
  });

  it("the env whitelist exactly-4-key pin: a 5th key fires (config face)", () => {
    const cfg = {
      channels: {
        env: {
          hostHarness: { markers: ["CURSOR_TRACE_ID", "CLAUDE_CODE_SESSION_ID", "AI_AGENT"] },
          path: { var: "PATH" },
          extra: { var: "EXTRA_KEY" },
        },
      },
    };
    const hits = guard.checkMarkers({ engineConfig: cfg });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].file).toContain("engine-config.json");
  });
});

// ---------------------------------------------------------------------------
// checkHarness — the four-direction harness-contract guard (C8)
// ---------------------------------------------------------------------------

describe("ContractLexiconGuard.checkHarness — the four directions (C8)", () => {
  it("live repo: detect / refs / prefix / install all green", () => {
    expect(guard.checkHarness()).toEqual([]);
  });

  it("the refs direction: a bare namespace skill reference (no pi dual form) fires", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-refs-"));
    try {
      const file = path.join(dir, "SKILL.md");
      writeFileSync(
        file,
        [
          "# Synthetic",
          "",
          "- **Do**: Import `/superpowers:brainstorming` — flow baseline",
          "",
        ].join("\n"),
        "utf8",
      );
      const hits = guard.checkHarness({ skills: [{ name: "synthetic", path: file }] });
      const refLabel = hits.map((h) => h.label).join(" | ");
      expect(refLabel).toMatch(/no pi dual form/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the refs direction: a `<pkg>:<skill>` pair outside the refs table fires", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-refs2-"));
    try {
      const file = path.join(dir, "SKILL.md");
      writeFileSync(
        file,
        [
          "- **Do**: Import `/superpowers:not-a-registered-skill`（pi：/skill:not-a-registered-skill）",
          "",
        ].join("\n"),
        "utf8",
      );
      const hits = guard.checkHarness({ skills: [{ name: "synthetic", path: file }] });
      const refLabel = hits.map((h) => h.label).join(" | ");
      expect(refLabel).toMatch(/not a registered ref key/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the prefix direction: a dispatch slot naming an unregistered ref key fires", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-prefix-"));
    try {
      const contract = JSON.parse(readFileSync(CONTRACT_SRC, "utf8")) as HarnessContractSurface;
      contract.dispatch.implement = "superpowers:not-registered";
      const file = path.join(dir, "harness-contract.json");
      writeFileSync(file, JSON.stringify(contract, null, 2), "utf8");
      const hits = new ContractLexiconGuard({ registryPath: file }).checkHarness();
      const labels = hits.map((h) => h.label).join(" | ");
      expect(labels).toMatch(/unregistered ref key/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the prefix direction: a ref form that diverges from the derived per-harness shape fires", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-prefix2-"));
    try {
      const contract = JSON.parse(readFileSync(CONTRACT_SRC, "utf8")) as HarnessContractSurface;
      contract.refs["kairos:cdd-plan"].claude = "/kairos:WRONG";
      const file = path.join(dir, "harness-contract.json");
      writeFileSync(file, JSON.stringify(contract, null, 2), "utf8");
      const hits = new ContractLexiconGuard({ registryPath: file }).checkHarness();
      const labels = hits.map((h) => h.label).join(" | ");
      expect(labels).toMatch(/prefix derivation drift/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the install direction: a harness install row missing a referenced package fires", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-install-"));
    try {
      const contract = JSON.parse(readFileSync(CONTRACT_SRC, "utf8")) as HarnessContractSurface;
      // The live claude row always declares its install table (JSON data).
      const install = contract.claude.install;
      assert.ok(install, "live claude harness row missing its install table");
      delete install.superpowers;
      const file = path.join(dir, "harness-contract.json");
      writeFileSync(file, JSON.stringify(contract, null, 2), "utf8");
      const hits = new ContractLexiconGuard({ registryPath: file }).checkHarness();
      const labels = hits.map((h) => h.label).join(" | ");
      expect(labels).toMatch(/install row missing package/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the install direction: a README upstream table cell diverging from the install data fires", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lex-install2-"));
    try {
      const readme = path.join(dir, "README.md");
      writeFileSync(
        readme,
        [
          "| Package | Claude Code | Cursor Agent | Pi |",
          "|---|---|---|---|",
          "| kairos | `claude plugin marketplace add oscaner/skills；claude plugin install kairos@oscaner-skills` | pending | `pi install npm:@oscaner-skills/kairos` |",
          "| superpowers | `claude plugin marketplace add obra/superpowers-marketplace；claude plugin install superpowers@superpowers-marketplace` | pending | `pi install git:github.com/obra/superpowers` |",
          "| mattpocock-skills | `claude plugin marketplace add mattpocock/skills；claude plugin install mattpocock-skills@mattpocock` | pending | `pi install git:github.com/mattpocock/skills` |",
          "| impeccable | `claude plugin marketplace add pbakaus/impeccable；claude plugin install impeccable@impeccable` | pending | `npx impeccable install --providers=pi --scope=global -y` |",
          "",
        ].join("\n"),
        "utf8",
      );
      const brokenReadme = path.join(dir, "broken-README.md");
      writeFileSync(
        brokenReadme,
        [
          "| Package | Claude Code | Cursor Agent | Pi |",
          "|---|---|---|---|",
          "| kairos | A DIFFERENT COMMAND | pending | `pi install npm:@oscaner-skills/kairos` |",
          "| superpowers | `claude plugin marketplace add obra/superpowers-marketplace；claude plugin install superpowers@superpowers-marketplace` | pending | `pi install git:github.com/obra/superpowers` |",
          "| mattpocock-skills | `claude plugin marketplace add mattpocock/skills；claude plugin install mattpocock-skills@mattpocock` | pending | `pi install git:github.com/mattpocock/skills` |",
          "| impeccable | `claude plugin marketplace add pbakaus/impeccable；claude plugin install impeccable@impeccable` | pending | `npx impeccable install --providers=pi --scope=global -y` |",
          "",
        ].join("\n"),
        "utf8",
      );
      // the matching README stays green; the drifted cell fires.
      expect(guard.checkHarness({ readmes: [readme] })).toEqual([]);
      const hits = guard.checkHarness({ readmes: [brokenReadme] });
      const labels = hits.map((h) => h.label).join(" | ");
      expect(labels).toMatch(/install render drift/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
