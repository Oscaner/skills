// packages/cdd-engine/src-next/contract/__tests__/single-home.test.ts
// P41 T4 — one criterion, one home. The rule compares the judged document's decision
// face against every OTHER document under the three doc roots, and every arm here is a
// pair: the same sentence is reported in two different-slug documents and silent once it
// moves into a quote block, into a same-slug sibling, or shrinks below the length floor.
//
// The comparison is a character 3-gram Jaccard: it catches COPYING, not paraphrase. The
// right domain is deliberately not filtered by closure — a closed document is still a
// place a criterion may have been copied into.
//
// Zero module-level bare functions — the helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { describe, expect, it } from "vitest";
import type { DocFs } from "../invariants.ts";
import { SentenceIndex, SingleHomeInvariant } from "../invariants.ts";
import { Contract } from "../judge.ts";

/** The criterion the arms copy around — well above the normalized length floor. */
const CRITERION =
  "The contract gate refuses a round only when a declared rule reports a blocking finding.";

/** A sentence too short to compare — below the length floor by construction. */
const SHORT = "Short claim.";

/** A memory filesystem seam — the right domain's list/read face, keyed by absolute
 *  path so a case can place neighbours in any doc root. */
class MemoryFs implements DocFs {
  readonly #files: ReadonlyMap<string, string>;

  constructor(files: Readonly<Record<string, string>>) {
    this.#files = new Map(Object.entries(files));
  }

  exists(at: string): boolean {
    return this.#files.has(at);
  }

  read(at: string): string | null {
    return this.#files.get(at) ?? null;
  }

  list(at: string): readonly string[] {
    const prefix = at.endsWith("/") ? at : `${at}/`;
    const names = new Set<string>();
    for (const file of this.#files.keys()) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      if (rest.includes("/")) continue;
      names.add(rest);
    }
    return [...names];
  }
}

/** One spec document carrying `lines` in its decision face. */
const specDoc = (slug: string, lines: readonly string[]): string =>
  [
    "---",
    "title: Single Home Fixture",
    "doc-type: phase-spec",
    "version: v0.1",
    "date: 2026-11-20",
    `slug: ${slug}`,
    "program: x-program",
    "---",
    "",
    "## Design",
    "",
    "### 1. 条目",
    "",
    ...lines,
  ].join("\n");

/** One plan document carrying `lines` in its decision face (the task block). */
const planDoc = (slug: string, lines: readonly string[]): string =>
  [
    "---",
    "title: Single Home Plan",
    "doc-type: plan",
    "version: v0.1",
    "date: 2026-11-20",
    `slug: ${slug}`,
    "---",
    "",
    "## Constraints",
    "",
    ...lines,
  ].join("\n");

/** The judged document's path — a spec under the specs root. */
const JUDGED = "docs/kairos/specs/x-shape-design.md";

/** The single-home findings over one judged body + one neighbour set. */
const singleHomeFindings = (
  judged: string,
  neighbours: Readonly<Record<string, string>> = {},
): readonly { field: string; message: string }[] =>
  new Contract()
    .validate({
      docKey: "phase-spec",
      path: JUDGED,
      content: judged,
      root: "/repo",
      fs: new MemoryFs(neighbours),
    })
    .filter((finding) => finding.kind === new SingleHomeInvariant().name);

describe("P41 T4 — SentenceIndex splits prose into normalized sentences", () => {
  it("gives a table row and a list item one sentence each, and splits running prose", () => {
    const sentences = SentenceIndex.of(
      ["| a | b |", "- a list item", "", "第一句。第二句!第三句"].join("\n"),
    );
    expect(sentences.map((sentence) => sentence.text)).toEqual([
      "a b",
      "a list item",
      "第一句",
      "第二句",
      "第三句",
    ]);
  });

  it("splits a `.` only when a space follows it", () => {
    // `v1.2` carries a dot with no space after it, so the version token stays inside one
    // sentence; the `. ` after `token` is the terminator.
    const sentences = SentenceIndex.of("v1.2 stays one token. Then a new sentence.");
    expect(sentences.map((sentence) => sentence.text)).toEqual([
      "v1 2 stays one token",
      "then a new sentence",
    ]);
  });

  it("keeps a quoted line out of the split face", () => {
    expect(SentenceIndex.of(["> quoted claim", "prose claim"].join("\n"))).toEqual([
      { text: "prose claim", prose: 11, line: 2 },
    ]);
  });
});

describe("P41 T4 — the threshold is a 3-gram Jaccard over normalized sentences", () => {
  const normalize = (content: string): string => SentenceIndex.of(content)[0]?.text ?? "";

  it("reads 1.0 for the same sentence", () => {
    const grams = SentenceIndex.trigrams(normalize(CRITERION));
    expect(SentenceIndex.jaccard(grams, grams)).toBe(1);
  });

  it("reads 1.0 when only punctuation and whitespace differ", () => {
    const a = SentenceIndex.trigrams(normalize(`${CRITERION}`));
    const b = SentenceIndex.trigrams(normalize(`${CRITERION.replaceAll(" ", "  ")}!`));
    expect(SentenceIndex.jaccard(a, b)).toBe(1);
  });

  it("agrees with the threshold: the same sentence passes, an unrelated one fails", () => {
    const a = SentenceIndex.trigrams(normalize(CRITERION));
    const same = SentenceIndex.trigrams(normalize(`${CRITERION}`));
    const other = SentenceIndex.trigrams(
      normalize("昨天晚上把这份设计里的三处指针写成了点名持有者的句子。"),
    );
    expect(SentenceIndex.sameCriterion(a, same)).toBe(true);
    expect(SentenceIndex.sameCriterion(a, other)).toBe(false);
  });

  it("reads below 0.3 for two unrelated sentences", () => {
    const a = SentenceIndex.trigrams(normalize(CRITERION));
    const b = SentenceIndex.trigrams(
      normalize("昨天晚上把这份设计里的三处指针写成了点名持有者的句子。"),
    );
    expect(SentenceIndex.jaccard(a, b)).toBeLessThan(0.3);
  });
});

describe("P41 T4 — one criterion in two different-slug documents", () => {
  const OTHER = "docs/kairos/specs/x-other-design.md";
  const judged = specDoc("x-shape", [CRITERION]);

  it("reports one finding that names both files and both openings", () => {
    const findings = singleHomeFindings(judged, {
      [`/repo/${OTHER}`]: specDoc("x-other", [CRITERION]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(OTHER);
    expect(findings[0]?.message).toContain(CRITERION.slice(0, 30).toLowerCase());
  });

  it("reports nothing once the neighbour states it in a quote block (the pair)", () => {
    const findings = singleHomeFindings(judged, {
      [`/repo/${OTHER}`]: specDoc("x-other", [`> ${CRITERION}`]),
    });
    expect(findings).toEqual([]);
  });
});

describe("P41 T4 — the same slug is one document, and never reported against itself", () => {
  const planPath = "docs/kairos/plans/x-shape.md";

  it("reports nothing for a plan carrying the same sentence under the same slug", () => {
    const findings = singleHomeFindings(specDoc("x-shape", [CRITERION]), {
      [`/repo/${planPath}`]: planDoc("x-shape", [CRITERION]),
    });
    expect(findings).toEqual([]);
  });

  it("reports the same sentence once the plan's slug differs (the pair)", () => {
    const findings = singleHomeFindings(specDoc("x-shape", [CRITERION]), {
      [`/repo/${planPath}`]: planDoc("x-other", [CRITERION]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(planPath);
  });
});

describe("P41 T4 — the right domain is not filtered by closure", () => {
  const CLOSED = "docs/kairos/plans/x-closed.md";
  const neighbour = planDoc("x-closed", [CRITERION]);

  it("names a closed document sitting on the right side", () => {
    // The judged document is the OPEN one; `closed` is the caller's proven-closure fact
    // and the right domain reads none of it — a closed document still names a place the
    // criterion was copied into.
    const findings = singleHomeFindings(specDoc("x-shape", [CRITERION]), {
      [`/repo/${CLOSED}`]: neighbour,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("x-closed.md");
  });

  it("reports nothing once the closed document states it in a quote block (the pair)", () => {
    const findings = singleHomeFindings(specDoc("x-shape", [CRITERION]), {
      [`/repo/${CLOSED}`]: planDoc("x-closed", [`> ${CRITERION}`]),
    });
    expect(findings).toEqual([]);
  });
});

describe("P41 T4 — short sentences stay out of the comparison domain", () => {
  it("ignores a sentence below the normalized length floor", () => {
    const findings = singleHomeFindings(specDoc("x-shape", [SHORT]), {
      "/repo/docs/kairos/specs/x-other-design.md": specDoc("x-other", [SHORT]),
    });
    expect(findings).toEqual([]);
  });

  it("compares the same claim once it clears the floor (the pair)", () => {
    const findings = singleHomeFindings(specDoc("x-shape", [CRITERION]), {
      "/repo/docs/kairos/specs/x-other-design.md": specDoc("x-other", [CRITERION]),
    });
    expect(findings).toHaveLength(1);
  });
});

describe("P41 T4 — a work item line yields no criterion", () => {
  const OTHER = "docs/kairos/plans/x-other.md";

  /** The same work item in two plans: a `- Modify:` line whose path sits in a code span
   *  and whose prose clears the floor, so ONLY the list marker can keep it out. */
  const WORK_ITEM =
    "- Modify: `packages/cdd-engine/src-next/contract/judge.ts` 承载判据面切行的唯一实现，故这一行只点名位置而不陈述任何可评审的判据。";

  it("reports nothing for the same `- Modify:` line in two different-slug plans", () => {
    const findings = singleHomeFindings(planDoc("x-shape", [WORK_ITEM]), {
      [`/repo/${OTHER}`]: planDoc("x-other", [WORK_ITEM]),
    });
    expect(findings).toEqual([]);
  });

  it("reports the same line once its list marker is gone (the pair)", () => {
    const criterion = WORK_ITEM.replace(/^- /, "");
    const findings = singleHomeFindings(planDoc("x-shape", [criterion]), {
      [`/repo/${OTHER}`]: planDoc("x-other", [criterion]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(OTHER);
  });
});

describe("P41 T4 — the length floor measures the prose, not the paths it names", () => {
  const OTHER = "docs/kairos/specs/x-other-design.md";
  const path = "`packages/cdd-engine/src-next/contract/judge.ts`";

  it("keeps a pointer sentence that only names a path out of the domain", () => {
    const findings = singleHomeFindings(specDoc("x-shape", [`见 ${path} 的指针。`]), {
      [`/repo/${OTHER}`]: specDoc("x-other", [`见 ${path} 的指针。`]),
    });
    expect(findings).toEqual([]);
  });

  it("compares the same pointer once each side carries forty characters of prose (the pair)", () => {
    const criterion = `见 ${path} 一节：判据面的每一节都写下能够成立的条件句而不是此刻的形状，故这一节本身是一条可评审的判断。`;
    const findings = singleHomeFindings(specDoc("x-shape", [criterion]), {
      [`/repo/${OTHER}`]: specDoc("x-other", [criterion]),
    });
    expect(findings).toHaveLength(1);
  });
});

describe("P41 T4 — both domains read one normalized face", () => {
  const OTHER = "docs/kairos/specs/x-other-design.md";

  it("reports a copy that a registered alias spells differently on each side", () => {
    // The judged body arrives canonicalized; the neighbour is read through the same
    // translator, so a registered alias (`上游先例背书` → `Upstream Endorsements`) cannot
    // hold the two sides of one criterion below the threshold.
    const aliased =
      "上游先例背书一节列出三份先例与各自的落地位置，判据面只判能够成立的条件句而不是此刻的形状。";
    const findings = singleHomeFindings(specDoc("x-shape", [aliased]), {
      [`/repo/${OTHER}`]: specDoc("x-other", [aliased]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(OTHER);
  });
});

describe("P41 T4 — the printed neighbour coordinate is a file line", () => {
  const OTHER = "docs/kairos/specs/x-other-design.md";

  it("names the line a reader lands on when opening the neighbour", () => {
    // The head is real lines of the file, so a body-relative number would send the
    // reader into the front matter.
    const neighbour = specDoc("x-other", ["占位正文。", CRITERION]);
    const fileLine = neighbour.split("\n").indexOf(CRITERION) + 1;
    const findings = singleHomeFindings(specDoc("x-shape", [CRITERION]), {
      [`/repo/${OTHER}`]: neighbour,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(`(line ${fileLine})`);
  });
});

describe("P41 T4 — the sentence face is the body, never the front-matter head", () => {
  it("does not read a head line as a sentence", () => {
    const headOnly = [
      "---",
      "title: Single Home Fixture",
      "doc-type: phase-spec",
      "version: v0.1",
      "date: 2026-11-20",
      "slug: x-shape",
      "program: x-program",
      `note: ${CRITERION}`,
      "---",
      "",
      "## Design",
      "",
      "### 1. 条目",
      "",
      "判据面正文。",
    ].join("\n");
    const findings = singleHomeFindings(headOnly, {
      "/repo/docs/kairos/specs/x-other-design.md": specDoc("x-other", [CRITERION]),
    });
    expect(findings).toEqual([]);
  });
});
