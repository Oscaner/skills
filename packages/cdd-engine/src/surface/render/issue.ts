// packages/cdd-engine/src/surface/render/issue.ts
// The aggregate issue body — one renderer, one input contract.
//
// INVARIANT — the stdin findings plane is validated and rendered in ONE place: the input
// shape's three failure classes (malformed JSON · a missing or mistyped key · a malformed
// `related` tail) and the body's bytes are this class's whole surface, so a shell only reads
// stdin and prints what it is handed.
//
// The three rejection shapes are DISTINCT on purpose:
//   · malformed JSON — one line, `cdd issue render: invalid input JSON — <message>`;
//   · a validation violation — `cdd issue render: invalid input:` then one two-space
//     indented line per violation;
//   · a shape that is not a violation at all — an EXTRA key is accepted. The contract is
//     about the fields the renderer reads, not about a closed object, so a payload that
//     carries more is still one the body renders.
// Every rejection exits 1: this family is a refusal, never a misuse (which exits 2).
//
// The finding-type vocabulary is the word table's own type set and the language set is
// derived from the label rows below, so a consumer's declared domain reads one source.
// The label rows are the renderer's data: the four segment titles per finding type, in the
// two shipped languages, and the machine face (status · next: · CDD_BLOCKED:) is
// deliberately absent — it is not a translation surface.
//
// Module-level exports are the types, the declared data and the class — zero bare functions.

import type { Words } from "../words/words.ts";

/** One locale-bearing label row: the canonical English face and its translation. */
export interface IssueLabelRow {
  readonly en: string;
  readonly zh: string;
}

/** The issue-body label rows, keyed `<type>.<segment>` — one row per finding type × segment. */
export const ISSUE_LABEL_ROWS: Readonly<Record<string, IssueLabelRow>> = {
  "bug.context": { en: "## Context", zh: "## 场景" },
  "bug.problem": { en: "## Problem", zh: "## 问题" },
  "bug.impact": { en: "## Impact", zh: "## 影响" },
  "bug.suggestedFix": { en: "## Suggested fix", zh: "## 建议修复" },
  "enhancement.context": { en: "## Context", zh: "## 场景" },
  "enhancement.problem": { en: "## Gap", zh: "## 差距" },
  "enhancement.impact": { en: "## Impact", zh: "## 影响" },
  "enhancement.suggestedFix": { en: "## Suggested direction", zh: "## 建议方向" },
  "chore.context": { en: "## Context", zh: "## 场景" },
  "chore.problem": { en: "## Gap", zh: "## 差距" },
  "chore.impact": { en: "## Impact", zh: "## 影响" },
  "chore.suggestedFix": { en: "## Suggested direction", zh: "## 建议方向" },
};

/** One finding row of the input contract. */
export interface ReportFindingInput {
  readonly type: string;
  readonly lang: string;
  readonly context: string;
  readonly problem: string;
  readonly impact: string;
  readonly suggestedFix: string;
  readonly meta: { readonly skill: string; readonly step: string };
}

/** The issue-report input contract — the stdin findings plane. */
export interface IssueReportInput {
  readonly harness: string;
  readonly findings: readonly ReportFindingInput[];
  readonly related?: {
    readonly open?: readonly {
      readonly issue: number;
      readonly component: string;
      readonly reason: string;
    }[];
    readonly closed?: readonly { readonly issue: number }[];
    readonly program?: { readonly issue: number };
  };
}

/** One command's reportable answer: which stream carries the bytes, the bytes, the code. */
export interface IssueReport {
  readonly stream: "stdout" | "stderr";
  readonly text: string;
  readonly exitCode: number;
}

/** The four text segments, in the render order. */
const SEGMENTS = ["context", "problem", "impact", "suggestedFix"] as const;

/**
 * IssueBodyRenderer — the aggregate issue body and its input contract. Invariant: one stdin
 * text answers exactly one report — the rendered body, or ONE of the two declared rejection
 * shapes — so a shell never decides which of the three it is looking at.
 */
export class IssueBodyRenderer {
  /** The finding-type vocabulary — the word table's ONE type set. */
  readonly types: readonly string[];
  readonly #rows: Readonly<Record<string, IssueLabelRow>>;

  constructor(words: Words, rows: Readonly<Record<string, IssueLabelRow>> = ISSUE_LABEL_ROWS) {
    this.types = words.issueTypes();
    this.#rows = rows;
  }

  /** The languages a finding may declare — derived from the label rows' columns. */
  langs(): readonly string[] {
    return Object.keys(this.#rows["bug.context"] ?? { en: "" });
  }

  /** The whole stdin contract: parse, validate, render. */
  report(stdin: string): IssueReport {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdin);
    } catch (raw) {
      const message = raw instanceof Error ? raw.message : String(raw);
      return {
        stream: "stderr",
        text: `${IssueBodyRenderer.#prefix} invalid input JSON — ${message}\n`,
        exitCode: 1,
      };
    }
    const violations = this.validateInput(parsed);
    if (violations.length > 0) {
      const rows = violations.map((violation) => `  ${violation}`).join("\n");
      return {
        stream: "stderr",
        text: `${IssueBodyRenderer.#prefix} invalid input:\n${rows}\n`,
        exitCode: 1,
      };
    }
    return {
      stream: "stdout",
      text: `${this.renderBody(parsed as IssueReportInput)}\n`,
      exitCode: 0,
    };
  }

  /** The command prefix both rejection shapes carry. */
  static readonly #prefix = "cdd issue render:";

  /** Render the aggregate body: the harness line, every finding, then the two tails. */
  renderBody(input: IssueReportInput): string {
    const parts: string[] = [`# CDD aggregate issue\n\n- Harness: ${input.harness}`];
    for (const finding of input.findings) parts.push(this.#findingOf(finding));
    const tails = [this.#dedupOf(input), this.#relatedOf(input)].filter(
      (tail): tail is string => tail !== null,
    );
    parts.push(...tails);
    return parts.join("\n\n");
  }

  /** One finding's block — its four labeled segments plus the two attribution rows. */
  #findingOf(finding: ReportFindingInput): string {
    const parts = SEGMENTS.map(
      (segment) =>
        `${this.#labelOf(finding, segment)}\n\n${String(finding[segment as keyof ReportFindingInput])}`,
    );
    return [...parts, `- Skill: ${finding.meta.skill}\n- Step: ${finding.meta.step}`].join("\n\n");
  }

  /** One segment's label, localized to the finding's own language (an unknown row — which
   *  the completeness pin excludes — falls back to the segment's own key). */
  #labelOf(finding: ReportFindingInput, segment: string): string {
    const row = this.#rows[`${finding.type}.${segment}`];
    if (row === undefined) return segment;
    const table = row as unknown as Readonly<Record<string, string | undefined>>;
    return table[finding.lang] ?? row.en;
  }

  /** The dedup tail — the open hits, or nothing at all. */
  #dedupOf(input: IssueReportInput): string | null {
    const open = input.related?.open ?? [];
    if (open.length === 0) return null;
    const rows = open.map(
      (hit) => `- Dedup → #${hit.issue} (open)：${hit.component} · ${hit.reason}`,
    );
    return `## Dedup\n${rows.join("\n")}`;
  }

  /** The related tail — the closed hits and the program row, or nothing at all. */
  #relatedOf(input: IssueReportInput): string | null {
    const rows: string[] = [];
    for (const hit of input.related?.closed ?? []) {
      rows.push(`- Regression / follow-up of #${hit.issue} (closed)`);
    }
    const program = input.related?.program;
    if (program !== undefined) rows.push(`- Program: #${program.issue}`);
    return rows.length === 0 ? null : `## Related\n${rows.join("\n")}`;
  }

  /** The input-shape violations — empty means the payload renders. An extra key is NOT a
   *  violation: the check reads the fields the body consumes. */
  validateInput(raw: unknown): readonly string[] {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return ["input: expected an object with harness / findings / related?"];
    }
    const input = raw as { harness?: unknown; findings?: unknown; related?: unknown };
    const errors: string[] = [];
    if (typeof input.harness !== "string" || input.harness.length === 0) {
      errors.push("harness: non-empty string required");
    }
    if (!Array.isArray(input.findings) || input.findings.length === 0) {
      errors.push("findings: non-empty array of findings required");
    } else {
      input.findings.forEach((rawFinding, index) => {
        errors.push(...this.#findingErrors(rawFinding, index));
      });
    }
    errors.push(...this.#relatedErrors(input.related));
    return errors;
  }

  /** One finding's violations, each naming its own field path. */
  #findingErrors(rawFinding: unknown, index: number): readonly string[] {
    const finding = rawFinding as Record<string, unknown> | null;
    const base = `findings[${index}]`;
    if (typeof finding !== "object" || finding === null) {
      return [`${base}: object with type/lang/context/problem/impact/suggestedFix/meta expected`];
    }
    const errors: string[] = [];
    if (!this.types.includes(String(finding.type))) {
      errors.push(`${base}.type: must be one of ${this.types.join(" | ")}`);
    }
    if (!this.langs().includes(String(finding.lang))) {
      errors.push(`${base}.lang: must be one of ${this.langs().join(" | ")}`);
    }
    for (const field of SEGMENTS) {
      const value = finding[field];
      if (typeof value !== "string" || value.length === 0) {
        errors.push(`${base}.${field}: non-empty string required`);
      }
    }
    errors.push(...IssueBodyRenderer.#metaErrors(finding.meta, `${base}.meta`));
    return errors;
  }

  /** One finding's attribution rows — the two non-empty strings the body prints. */
  static #metaErrors(raw: unknown, base: string): readonly string[] {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return [`${base}: object with skill / step required`];
    }
    const meta = raw as Record<string, unknown>;
    const errors: string[] = [];
    for (const field of ["skill", "step"]) {
      if (typeof meta[field] !== "string" || (meta[field] as string).length === 0) {
        errors.push(`${base}.${field}: non-empty string required`);
      }
    }
    return errors;
  }

  /** The `related` tail's shape — an absent tail stays legal; any other shape is refused
   *  with its field path instead of silently dropping the tail. */
  #relatedErrors(raw: unknown): readonly string[] {
    if (raw === undefined) return [];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return ["related: object with open / closed / program expected"];
    }
    const related = raw as Record<string, unknown>;
    return [
      ...IssueBodyRenderer.#hitErrors("open", related.open),
      ...IssueBodyRenderer.#hitErrors("closed", related.closed),
      ...(related.program === undefined
        ? []
        : IssueBodyRenderer.#issueErrors("related.program", related.program, false)),
    ];
  }

  /** The open / closed hit rows — the array shape plus every element's own shape. */
  static #hitErrors(kind: "open" | "closed", raw: unknown): readonly string[] {
    if (raw === undefined) return [];
    const base = `related.${kind}`;
    if (!Array.isArray(raw)) return [`${base}: array of ${kind} hits expected`];
    return raw.flatMap((hit, index) =>
      IssueBodyRenderer.#issueErrors(`${base}[${index}]`, hit, kind === "open"),
    );
  }

  /** One `{ issue: number }` row — `withContext` adds the open hit's two string rows. */
  static #issueErrors(base: string, raw: unknown, withContext: boolean): readonly string[] {
    const shape = withContext ? "issue / component / reason" : "issue";
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return [`${base}: object with ${shape} required`];
    }
    const row = raw as Record<string, unknown>;
    const errors: string[] = [];
    if (typeof row.issue !== "number") errors.push(`${base}.issue: number required`);
    if (!withContext) return errors;
    for (const field of ["component", "reason"]) {
      if (typeof row[field] !== "string" || (row[field] as string).length === 0) {
        errors.push(`${base}.${field}: non-empty string required`);
      }
    }
    return errors;
  }
}
