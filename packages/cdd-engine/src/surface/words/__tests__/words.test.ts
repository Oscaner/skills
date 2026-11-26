// packages/cdd-engine/src/surface/words/__tests__/words.test.ts
// The word table's pins, one group per fact it owns:
//
//   · the refusal sets — the four stations ARE the gate's own set (members of its row set,
//     never a set beside it), every named reason has its row, and the two rows that ARE an
//     in-flight word (`held`, `corrupt-record`) reference the family rather than repeat it;
//   · the `checked:` face — the five in-flight state rows, and the fourth state NOT among
//     them (it renders through the in-flight family instead);
//   · the capsule — three slots, the two line labels, the fixed slot order, and the
//     disposition summary template filling to its own shape;
//   · one spelling only — a sentence this table owns may appear NOWHERE else under `src/`
//     outside the table's own home, and the two legend tails differ by the scope word alone;
//   · the board's fact block and artifact rows — every label readable, and the two
//     continuation contracts (the board's and the gate's) kept apart;
//   · the issue type set and the word-table class — the types derived from ONE declaration,
//     and the in-flight rows computed through the INJECTED clock, so a frozen clock answers
//     the same bytes twice.
//
// Zero module-level bare functions — the helpers below are `const` arrows.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { specifiersIn } from "../../../../tests/support/module-specifiers.ts";
import { REGRADE_MARK, REGRADE_NOTE_SEPARATOR } from "../../../docs/judging/criteria.ts";
import { Clock } from "../../../env/process/clock.ts";
import { TARGET_FACTS } from "../../../run/dispatch/inflight.ts";
import {
  PRE_FLIGHT_GATE_NAMES,
  PRE_FLIGHT_REASONS,
  ROW_STATIONS,
} from "../../../run/gate/preflight.ts";
import { FIX_DISPOSITIONS_SUMMARY, ISSUE_TYPES, WORDS, Words } from "../words.ts";

/** The engine's `src` root — the scan set. */
const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** The word table's own home — the one place a word-table sentence may be written. */
const WORDS_HOME = path.join(SRC_DIR, "surface", "words", "words.ts");

/** A fixed instant — the injected clock's one reading. */
const FIXED_NOW = 1_700_000_000_000;

/** A fixed clock — the word table reads no wall clock of its own. */
const pinnedClock = (): Clock => new Clock(() => FIXED_NOW);

/** One source file with its comments blanked — prose may name a byte, code may not. */
const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Every production source under `src`, the table's own home aside. */
const productionSources = (): readonly { readonly path: string; readonly text: string }[] =>
  readdirSync(SRC_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .filter((entry) => !entry.parentPath.includes("__tests__"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => file !== WORDS_HOME)
    .map((file) => ({
      path: file.slice(SRC_DIR.length + 1),
      text: stripComments(readFileSync(file, "utf8")),
    }));

/** The sources carrying one sentence — the single scan both the ban and its red arm use. */
const sourcesCarrying = (
  sources: readonly { readonly path: string; readonly text: string }[],
  sentence: string,
): readonly string[] =>
  sources.filter((source) => source.text.includes(sentence)).map((s) => s.path);

/** The sentences one fact is spelled with — each one a row this table owns. */
const OWNED_SENTENCES = (): readonly string[] => [
  WORDS.refusal.reasons["dirty-tree"],
  WORDS.refusal.reasons["doc-contract"],
  WORDS.inFlight.held,
  WORDS.inFlight.recovery[0],
  WORDS.inFlight.corruptLocked,
  WORDS.checked.skipped["no-doc-target"],
  WORDS.checked.skipped["no-ledger-facts"],
  WORDS.board.facts.orphan.unowned,
  WORDS.board.titles.waveBoard,
  WORDS.refusal.corrupt,
  WORDS.summary.fixDispositions,
];

describe("the refusal sets", () => {
  it("takes its station vocabulary from the gate's own set, never a set beside it", () => {
    expect(Object.keys(WORDS.refusal.stations)).toEqual([...ROW_STATIONS]);
    for (const station of ROW_STATIONS) {
      // Containment, never equality: the stations are members of the gate's row set.
      expect(PRE_FLIGHT_GATE_NAMES).toContain(station);
      expect(WORDS.refusal.stations[station].length).toBeGreaterThan(0);
    }
  });

  it("names every declared reason, one readable row each", () => {
    expect(Object.keys(WORDS.refusal.reasons)).toEqual([...PRE_FLIGHT_REASONS]);
    for (const reason of PRE_FLIGHT_REASONS) {
      expect(WORDS.refusal.reasons[reason].trim().length).toBeGreaterThan(0);
    }
  });

  it("spells the held refusal's detail as the held report, never a second sentence", () => {
    // The gate's `held` refusal carries the in-flight report filled from the record's OWN
    // cells — the recorded `f8.blocked.message` line is that report, and the parity pin
    // (`tests/parity/parity.test.ts`, the refusal face) measures it against the family's
    // template. So this row is the template, not a paraphrase: a sentence of its own here
    // would print without the holder's pid, command and uptime, a byte no face produces.
    expect(WORDS.refusal.reasons.held).toBe(WORDS.inFlight.held);
    // Same rule for the other in-flight-backed reason: the gate answers the family's row.
    expect(WORDS.refusal.reasons["corrupt-record"]).toBe(WORDS.inFlight.corruptLocked);
  });

  it("declares the blocked anchor and the station join once", () => {
    expect(WORDS.refusal.prefix).toBe("CDD_BLOCKED:");
    expect(WORDS.refusal.prefix).toBe(WORDS.capsule.stations.blocked);
    expect(WORDS.refusal.join).toBe(WORDS.capsule.separator);
  });
});

describe("the checked face", () => {
  it("carries the five in-flight state rows", () => {
    const rows = WORDS.checked.inFlight;
    expect(Object.keys(rows)).toEqual([
      "free",
      "held",
      "stale",
      "corruptLocked",
      "corruptUnlocked",
    ]);
    for (const row of Object.values(rows)) expect(row.length).toBeGreaterThan(0);
  });

  it("keeps the checked rows and the held block's rows apart — two faces, never one", () => {
    // The `checked:` rows and the held block's tail sentences are different byte contracts:
    // a corrupt record reads as a short row in the checked list and as an instruction in the
    // block, and neither may stand in for the other.
    expect(WORDS.checked.inFlight.corruptLocked).not.toBe(WORDS.inFlight.corruptLocked);
    expect(WORDS.checked.inFlight.corruptUnlocked).not.toBe(WORDS.inFlight.corruptUnlocked);
    expect(WORDS.checked.inFlight.corruptLocked).toBe("unreadable record — lock on disk");
    expect(WORDS.checked.inFlight.corruptUnlocked).toBe("unreadable record — no lock behind");
  });

  it("declares one yield row per reason the gate can render", () => {
    const words = new Words({ clock: pinnedClock() });
    for (const reason of [
      "no-doc-target",
      "doc-not-judged",
      "unreadable-doc",
      "closed-document",
      "no-plan-layers",
      "no-ledger-facts",
      "no-input-face",
    ] as const) {
      expect(words.checkedSkip(reason).length).toBeGreaterThan(0);
    }
  });
});

describe("the capsule", () => {
  it("carries three slots, the two line labels and the fixed slot order", () => {
    expect(WORDS.capsule.slots).toEqual({
      status: "status",
      handoff: "handoff",
      summary: "summary",
    });
    expect(WORDS.capsule.lines).toEqual({ next: "next:", reason: "reason:" });
    expect(WORDS.capsule.order).toEqual(["status", "summary", "next", "reason"]);
  });

  it("fills the disposition summary template to its own shape", () => {
    const words = new Words({ clock: pinnedClock() });
    expect(FIX_DISPOSITIONS_SUMMARY).toBe("fixed {fixed} · rejected {rejected}");
    expect(words.dispositionsSummary(3, 1)).toBe("fixed 3 · rejected 1");
    // The two slots are the template's, not a second pair of words.
    expect(WORDS.summary.fixDispositions).toBe(FIX_DISPOSITIONS_SUMMARY);
  });

  it("keeps the re-grade note out of the table — its composition belongs to the criteria", () => {
    const text = readFileSync(WORDS_HOME, "utf8");
    // The note is not a word row: its mark, its fold and its synthesis are the criteria's,
    // so this module neither imports them nor declares any of their bytes.
    expect(text).not.toContain(REGRADE_MARK);
    expect(stripComments(text)).not.toContain("downgraded");
    expect(stripComments(text)).not.toContain("notes +");
    expect(specifiersIn(text)).not.toContain("../../../docs/judging/criteria.ts");
    expect(REGRADE_NOTE_SEPARATOR.length).toBeGreaterThan(0);
    // …while the status vocabulary does carry the three conclusions the roll-up derives.
    for (const conclusion of ["APPROVED", "CHANGES_REQUESTED", "REVIEW_FIX"]) {
      expect(WORDS.capsule.statuses).toContain(conclusion);
    }
  });
});

describe("one spelling only", () => {
  it("writes no owned sentence anywhere but the table", () => {
    const sources = productionSources();
    expect(sources.length).toBeGreaterThan(10);
    for (const sentence of OWNED_SENTENCES()) {
      expect(sourcesCarrying(sources, sentence)).toEqual([]);
    }
  });

  it("sees a second copy when there is one — the scan cannot pass on a spelling mismatch", () => {
    // The red arm: the very sentence, written into a renderer the way a hand-rolled board
    // would. The scan reads the code (comments are blanked), so a quoted literal is a hit.
    const sentence = WORDS.board.facts.orphan.unowned;
    const renderer = [
      { path: "surface/render/board.ts", text: `rows.push(\`  orphan: \${name} — ${sentence}\`);` },
    ];
    expect(sourcesCarrying(renderer, sentence)).toEqual(["surface/render/board.ts"]);
    // …and prose is not a byte: a comment naming the sentence is blanked before the scan.
    expect(
      sourcesCarrying([{ path: "x.ts", text: stripComments(`// ${sentence}`) }], sentence),
    ).toEqual([]);
  });

  it("carries the three progress markers once, and two legend tails one word apart", () => {
    const { markers, legend, scopes } = WORDS.board.progress;
    expect(Object.values(markers)).toEqual(["✔", "▶", "○"]);
    for (const scope of ["board", "graph"] as const) {
      expect(legend[scope]).toContain(markers.done);
      expect(legend[scope]).toContain(markers.current);
      expect(legend[scope]).toContain(markers.pending);
      expect(legend[scope]).toContain(scopes[scope]);
    }
    // ONE template, one scope word: the board's tail is the graph's tail with its scope
    // narrowed — a renderer that wrote a whole `progress:` tail itself would break this.
    expect(legend.graph.replace(scopes.graph, scopes.board)).toBe(legend.board);
    expect(WORDS.board.titles.progress).toBe("progress:");
  });
});

describe("the board's fact block and artifact rows", () => {
  it("reads every label of the tree fact block", () => {
    expect(WORDS.board.facts.orphan.label).toBe("orphan:");
    expect(WORDS.board.facts.orphan.unowned).toBe("no recorded round owns it");
    expect(WORDS.board.facts.crashed.label).toBe("crashed:");
    expect(WORDS.board.reads.label).toBe("reads:");
    expect(WORDS.board.reads.orphanDrafts).toBe(" · orphan drafts: ");
    expect(WORDS.board.reads.join).toBe(" · ");
  });

  it("composes each row with its OWN join — the two shipped lines, byte for byte", () => {
    // The two rows do not share a join: the orphan row separates its name from the sentence
    // with an em dash, the crashed row joins its tokens with a middle dot. A table holding
    // one join for both would render one of these two lines wrong.
    const { orphan, crashed } = WORDS.board.facts;
    expect(orphan.join).toBe(" — ");
    expect(crashed.join).toBe(" · ");
    const orphanRow = (name: string): string =>
      `  ${orphan.label} ${name}${orphan.join}${orphan.unowned}`;
    expect(orphanRow("tasks-1-1.json")).toBe(
      "  orphan: tasks-1-1.json — no recorded round owns it",
    );
    const crashedRow = (tokens: readonly string[]): string =>
      `  ${crashed.label} ${tokens.join(crashed.join)}`;
    expect(crashedRow(["implement 1·a1 child-exit", "review 2·a1 stalled"])).toBe(
      "  crashed: implement 1·a1 child-exit · review 2·a1 stalled",
    );
    // Zero crashed rounds render no line at all — the row is absent, never an empty label.
    // That arm belongs to the renderer (the production function answers `[]`); this table
    // owns only the join that composes a row which is present.
  });

  it("reads the `art:` label and its four state words", () => {
    const words = new Words({ clock: pinnedClock() });
    expect(WORDS.artifacts.label).toBe("art:");
    expect(Object.keys(WORDS.artifacts.states)).toEqual(["ok", "absent", "misplaced", "invalid"]);
    // The two anomalous states carry the prefix; health and absence carry none — the healthy
    // round's cell is the plain artifact-read member name.
    expect(words.artifactState("ok")).toBe("ok");
    expect(words.artifactState("absent")).toBe("absent");
    expect(words.artifactState("misplaced")).toBe("! misplaced");
    expect(words.artifactState("invalid")).toBe("! invalid");
  });

  it("keeps the board's continuation labels and the gate's rows apart — two byte contracts", () => {
    expect(WORDS.artifacts.continuation).toEqual({
      derived: "derived",
      found: "found",
      reason: "reason",
    });
    // The gate's rows are the colon form with the two-space column; the board's carry no
    // colon. One label source could not serve both, which is why they are two rows.
    expect(WORDS.refusal.artifact.derived).toContain("derived:");
    expect(WORDS.refusal.artifact.derived).toContain("  derived:  {derived}");
    expect(WORDS.artifacts.continuation.derived).not.toContain(":");
    expect(WORDS.refusal.artifact.repair).toHaveLength(2);
  });

  it("casts the artifact coordinate and the row's joins once", () => {
    expect(WORDS.artifacts.coordinate).toBe("c{cycle}·a{attempt}");
    expect(WORDS.artifacts.join).toBe(WORDS.capsule.separator);
    expect(WORDS.board.facts.crashed.join).toBe(WORDS.capsule.separator);
    expect(WORDS.artifacts.gap).toBe("   ");
    expect(WORDS.artifacts.anomalyPrefix).toBe("! ");
  });
});

describe("the in-flight family", () => {
  it("renders the held report through the injected clock", () => {
    const words = new Words({ clock: pinnedClock() });
    const facts = {
      pid: 4242,
      command: "cdd implement --tasks 1",
      startedAt: FIXED_NOW - 5 * 60_000,
      wave: "1",
      slug: "p9",
    };
    const held = words.inFlightHeld(facts);
    expect(held).toBe(
      `a dispatch is already in flight — pid 4242 · command: cdd implement --tasks 1 · started: ${pinnedClock().isoOf(facts.startedAt)} · running for 5m · wave: 1 · slug: p9`,
    );
    // The same row twice is the same byte: no wall clock enters the row.
    expect(words.inFlightHeld(facts)).toBe(held);
  });

  it("renders the fourth state's naked line from the cells that read out missing", () => {
    const words = new Words({ clock: pinnedClock() });
    expect(words.inFlightTargetGone([])).toContain(WORDS.inFlight.targetGone.lead);
    expect(words.inFlightTargetGone(["plan"])).toContain(WORDS.inFlight.targetGone.cells.plan);
    expect(words.inFlightTargetGone(["plan"])).not.toContain(
      WORDS.inFlight.targetGone.cells.workspace,
    );
    // The takeover hint: the naked line when a fact is gone, the ordinary sentence otherwise.
    expect(words.inFlightTakeoverHint(TARGET_FACTS)).toBe(words.inFlightTargetGone(TARGET_FACTS));
    expect(words.inFlightTakeoverHint([])).toBe(WORDS.inFlight.stealable);
    expect(words.inFlightTakeoverHint([])).toContain("--recover");
  });

  it("renders the lock row and the free row from the same family", () => {
    const words = new Words({ clock: pinnedClock() });
    const lock = words.inFlightLock({
      pid: 4242,
      command: "cdd review",
      startedAt: FIXED_NOW,
      wave: null,
      slug: "p9",
    });
    expect(lock).toContain("held by pid 4242");
    expect(lock).toContain("wave: none");
    expect(WORDS.inFlight.free).toBe("free — no dispatch holds this tree");
    expect(WORDS.inFlight.recovery).toHaveLength(3);
  });
});

describe("the issue type set and the word-table class", () => {
  it("declares the issue types once and serves them from the table", () => {
    const words = new Words({ clock: pinnedClock() });
    expect(words.issueTypes()).toBe(ISSUE_TYPES);
    expect(new Set(ISSUE_TYPES).size).toBe(ISSUE_TYPES.length);
    for (const type of ISSUE_TYPES) expect(type.length).toBeGreaterThan(0);
  });

  it("answers the same bytes twice for the same row under a frozen clock", () => {
    const words = new Words({ clock: pinnedClock() });
    expect(words.statusVocab()).toEqual(words.statusVocab());
    expect(words.capsuleKeys("APPROVED", false)).toEqual(["status", "handoff"]);
    expect(words.capsuleKeys("BLOCKED", false)).toEqual(["status"]);
    expect(words.capsuleKeys("BLOCKED", true)).toEqual(["status", "handoff"]);
    expect(words.routeWord("done")).toBe("done");
    expect(words.handoffRefWord("/skill:x")).toBe("route to /skill:x skill");
  });

  it("reads `run/` through types only — the table calls no round verb", () => {
    const text = readFileSync(WORDS_HOME, "utf8");
    const blocks = text.match(/^import[\s\S]*?from\s+"[^"]+";$/gm) ?? [];
    const runBlocks = blocks.filter((block) => block.includes('"../../run/'));
    // The two vocabularies (`TargetFact`, the gate's row and reason sets) are the reason the
    // table reads `run/` at all — and each is a TYPE read, so no round verb is callable here.
    expect(runBlocks.length).toBeGreaterThan(0);
    for (const block of runBlocks) expect(block.startsWith("import type ")).toBe(true);
    expect(text).not.toContain("new Run(");
  });

  it("hands out the guard-ban vocabulary from one home", () => {
    const words = new Words({ clock: pinnedClock() });
    expect(words.guardBanTokens()).toContain("CDD_GATE");
    expect(words.guardBanWords("gate").map((row) => row.token)).toContain("gateDecide");
    // The three families are declared, and the shape family rides the table as data even
    // though no engine scan reads it.
    expect(["stale", "gate", "shape"]).toEqual(["stale", "gate", "shape"]);
    for (const family of ["stale", "gate", "shape"] as const) {
      expect(words.guardBanWords(family).length).toBeGreaterThan(0);
    }
  });
});
