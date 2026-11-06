// scripts/__tests__/journey-twin.test.ts — the repo-level twin pin for the developer &
// engine journey (P26 T2 · acceptance 5–6). The journey diagrams drew three
// load-bearing statements with no pin at all, so the picture could quietly disagree
// with the engine:
//   · the wave width — "a plan's wave is at most three tasks wide" must equal the
//     runtime constant `MAX_TASKS_PER_WAVE`;
//   · the `--type` vocabulary — the six `TargetType` words, the retired `spec`
//     spelling, and NO bare `spec` offered as a value (the union is read from
//     `session/faces.ts`, so the words and the runtime cannot drift apart);
//   · the log path — a round log lands under the runtime's workspace root
//     (`ENGINE_RUNTIME.handoffNamespace.workspaceRoot`) in `CliLifecycle.LOGS_DIR`.
// Each of the three legs carries a reverse case asserting that a WRONG value in a
// copied string is reported — the pin can go red, proven without touching the sources.
//
// Zero module-level bare functions — the reader is a class (the repo's zero-`function`
// discipline applies to `scripts/`).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_TASKS_PER_WAVE } from "../../packages/cdd-engine/src-next/contract/wave-width.ts";
import { CliLifecycle } from "../../packages/cdd-engine/src-next/face/lifecycle.ts";
import { ENGINE_RUNTIME } from "../../packages/cdd-engine/src-next/infra/runtime.ts";

/** The repo root — the diagram sources and the runtime sources both resolve under it. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIAGRAM_SRC = path.join(ROOT, "docs", "diagrams", "src");
const FACES = path.join(ROOT, "packages", "cdd-engine", "src-next", "session", "faces.ts");

/** The six target words the `--type` value domain must offer, in the engine's order. */
const TYPE_WORDS = ["phase-spec", "overall", "plan", "single-spec", "wave", "branch"] as const;

/** The numerals both locales write the wave width in — the only words the pin parses. */
const NUMERALS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

/** The wave-width sentence shapes — English cardinal, Chinese numeral + 个. */
const WAVE_WIDTH = [/at most (\w+) tasks? wide/i, /至多\s*([一二三四五六])个\s*任务/];

/** The retirement sentence — the `--type spec` spelling the diagram must call out. */
const RETIRED = [/--type spec[^.]*retired/i, /--type spec[^，。]*退役/];

/**
 * JourneyTwin — one journey source's three semantic legs. Pure reads over the
 * flattened string values; every leg returns the problems it found so a reverse case
 * can assert the leg is not vacuous.
 */
class JourneyTwin {
  /** The two shipped journey sources (the pair the pin covers). */
  static readonly SOURCES = ["journey.en", "journey.zh-CN"] as const;

  readonly name: string;
  readonly strings: readonly string[];

  private constructor(name: string, strings: readonly string[]) {
    this.name = name;
    this.strings = strings;
  }

  /** Read one journey source and flatten every string value it carries. */
  static of(name: string): JourneyTwin {
    const text = readFileSync(path.join(DIAGRAM_SRC, `${name}.json`), "utf8");
    return new JourneyTwin(name, JourneyTwin.#stringsOf(JSON.parse(text)));
  }

  /** Wrap a copied string list — the reverse-injection entry (no repo file is touched). */
  static fromStrings(name: string, strings: readonly string[]): JourneyTwin {
    return new JourneyTwin(name, strings);
  }

  /** The strings matching any of the patterns. */
  carrying(patterns: readonly RegExp[]): readonly string[] {
    return this.strings.filter((text) => patterns.some((pattern) => pattern.test(text)));
  }

  /** The wave width the source states — null when the source states none. */
  waveWidth(): number | null {
    for (const text of this.carrying(WAVE_WIDTH)) {
      for (const pattern of WAVE_WIDTH) {
        const match = pattern.exec(text);
        const word = match?.[1]?.toLowerCase();
        if (word !== undefined && NUMERALS[word] !== undefined) return NUMERALS[word];
      }
    }
    return null;
  }

  /** The wave-width leg: the stated width must BE the runtime constant. */
  waveWidthProblems(): string[] {
    const width = this.waveWidth();
    if (width === null) return [`wave-width: ${this.name} states no wave width`];
    return width === MAX_TASKS_PER_WAVE
      ? []
      : [`wave-width: ${this.name} states ${width} ≠ MAX_TASKS_PER_WAVE ${MAX_TASKS_PER_WAVE}`];
  }

  /** The `--type` leg: all six words, the retirement sentence, no bare `spec` value. */
  targetVocabularyProblems(): string[] {
    const problems: string[] = [];
    const statements = this.carrying([/--type/]);
    if (statements.length === 0) return [`type-words: ${this.name} states no --type vocabulary`];
    const values = statements
      .flatMap((text) => (text.split("：").pop() ?? text).split(":").pop()?.split("·") ?? [])
      .map((word) => word.trim());
    for (const word of TYPE_WORDS) {
      if (!statements.some((text) => text.includes(word))) {
        problems.push(`type-words: ${this.name} misses "${word}"`);
      }
    }
    if (values.includes("spec")) problems.push(`type-words: ${this.name} still offers a bare spec`);
    if (this.carrying(RETIRED).length === 0) {
      problems.push(`type-words: ${this.name} states no --type spec retirement`);
    }
    return problems;
  }

  /** The log-path leg: the workspace root AND the logs directory are both named. */
  logPathProblems(): string[] {
    const root = ENGINE_RUNTIME.handoffNamespace.workspaceRoot;
    const logs = CliLifecycle.LOGS_DIR;
    const statements = this.carrying([new RegExp(`${root}[^ ]*${logs}`)]);
    if (statements.length === 0) {
      return [`log-path: ${this.name} names no ${root}/<slug>/${logs} path`];
    }
    return statements.some((text) => text.includes(root) && text.includes(logs))
      ? []
      : [`log-path: ${this.name} misses ${root} or ${logs}`];
  }

  /** Every string value, whichever field a statement was written in. */
  static #stringsOf(node: unknown): string[] {
    if (typeof node === "string") return [node];
    if (Array.isArray(node)) return node.flatMap((item) => JourneyTwin.#stringsOf(item));
    if (node !== null && typeof node === "object") {
      return Object.values(node).flatMap((value) => JourneyTwin.#stringsOf(value));
    }
    return [];
  }
}

/** The `TargetType` union members, read from the engine source (the words' runtime home). */
const targetUnion = (): readonly string[] => {
  const match = /export type TargetType =([^;]+);/.exec(readFileSync(FACES, "utf8"));
  expect(match, "session/faces.ts no longer declares TargetType").toBeTruthy();
  return (match?.[1] ?? "")
    .split("|")
    .map((member) => member.trim().replace(/^"|"$/g, ""))
    .filter((member) => member.length > 0);
};

const JOURNEY = JourneyTwin.SOURCES.map((name) => JourneyTwin.of(name));

describe("the journey diagrams and the engine agree (the twin pin)", () => {
  it("covers both locales", () => {
    expect(JOURNEY.length).toBe(2);
    for (const twin of JOURNEY) expect(twin.strings.length).toBeGreaterThan(0);
  });

  it("the stated wave width is MAX_TASKS_PER_WAVE", () => {
    for (const twin of JOURNEY) expect(twin.waveWidthProblems()).toEqual([]);
  });

  it("the --type vocabulary is the six TargetType words, with spec retired and never offered", () => {
    expect([...targetUnion()]).toEqual([...TYPE_WORDS]);
    for (const twin of JOURNEY) expect(twin.targetVocabularyProblems()).toEqual([]);
  });

  it("the log path names the runtime workspace root and the logs directory", () => {
    for (const twin of JOURNEY) expect(twin.logPathProblems()).toEqual([]);
  });
});

describe("the three legs can go red (reverse injection on copied strings)", () => {
  const source = JOURNEY[0];

  it("a wrong wave number is reported", () => {
    const drifted = JourneyTwin.fromStrings(
      "copied",
      source.strings.map((text) =>
        text.replace(/at most three tasks wide/i, "at most four tasks wide"),
      ),
    );
    expect(drifted.waveWidth()).toBe(4);
    expect(drifted.waveWidthProblems().join(" ")).toContain("wave-width:");
  });

  it("a missing target word or an offered bare spec is reported", () => {
    const words = JourneyTwin.fromStrings(
      "copied",
      source.strings.map((text) =>
        text.includes("phase-spec · overall") ? text.replace(" · wave", "") : text,
      ),
    );
    expect(words.targetVocabularyProblems().join(" ")).toContain(
      'type-words: copied misses "wave"',
    );
    const bare = JourneyTwin.fromStrings(
      "copied",
      source.strings.map((text) =>
        text.includes("phase-spec · overall")
          ? text.replace("phase-spec · overall", "phase-spec · overall · spec")
          : text,
      ),
    );
    expect(bare.targetVocabularyProblems().join(" ")).toContain("bare spec");
  });

  it("a log path missing the logs directory is reported", () => {
    const drifted = JourneyTwin.fromStrings(
      "copied",
      source.strings.map((text) => text.replace(`/${CliLifecycle.LOGS_DIR}/`, "/records/")),
    );
    expect(drifted.logPathProblems().join(" ")).toContain("log-path:");
  });
});
