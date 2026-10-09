// packages/cdd-engine/src-next/render/issue-body.ts
// T19 — IssueBodyRenderer (the P7 translation-system render landing): the aggregate
// issue body's steady renderer, relocated from face/cli.ts (T11's composition root
// only assembles it — the renderer owns no CLI). The language/label plane is
// data-driven:
//
//   · the finding-type vocabulary is the renderer's declared steady set (bug /
//     enhancement / chore — the input contract's type domain);
//   · the language vocabulary is the word table's locale key projection (the langs
//     derivation — localeKeys(), never a hardcoded list);
//   · every label the body emits rides the word table's locale rows through the
//     Translator (the bidirectional layer — localize(canonical, locale) renders the
//     locale-normalized output). The capsule machine face (status · next: ·
//     CDD_BLOCKED:) is deliberately NOT in the locale rows — English-constant, never
//     localized.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import type { Translator, WordLocaleFace } from "../contract/translate.ts";

/** One finding row of the issue-report input. */
export interface ReportFindingInput {
  type: string;
  lang: string;
  context: string;
  problem: string;
  impact: string;
  suggestedFix: string;
  meta: { skill: string; step: string };
}

/** The issue-report input contract — the stdin findings plane. */
export interface IssueReportInput {
  harness: string;
  findings: readonly ReportFindingInput[];
  related?: {
    open?: readonly { issue: number; component: string; reason: string }[];
    closed?: readonly { issue: number }[];
    program?: { issue: number };
  };
}

/**
 * The issue-body renderer — the aggregate issue body's steady renderer (the finding
 * type/lang vocabularies and the segment labels live on the declared data — the type
 * set on the renderer, the locale keys + label rows on the word table, never a second
 * source): Session block → per-finding four-segment blocks with attribution → Dedup
 * (open hits) → Related (closed hits + program). Pure deterministic text.
 */
export class IssueBodyRenderer {
  /** The finding-type vocabulary (the canonical type set). */
  readonly types: readonly string[] = ["bug", "enhancement", "chore"];
  /** The four text-segment keys, in the render order. */
  readonly #segments: readonly string[] = ["context", "problem", "impact", "suggestedFix"];
  /** The word table's locale face — the langs projection + the label rows. */
  readonly #words: WordLocaleFace;
  /** The translation layer — the label rows localize through it (locale-normalized render). */
  readonly #translator: Translator;

  constructor(words: WordLocaleFace, translator: Translator) {
    this.#words = words;
    this.#translator = translator;
  }

  /** The rendered language vocabulary — the word table's locale key projection (the
   *  langs derivation: a locale-key change in the word table re-projects this face). */
  langs(): readonly string[] {
    return this.#words.localeKeys();
  }

  /** The canonical `meta` bullet lines of one finding (the two attribution rows). */
  #metaOf(meta: { skill: string; step: string }): string {
    return `- Skill: ${meta.skill}\n- Step: ${meta.step}`;
  }

  /** One finding's segment label — the word table's label row localized to the
   *  finding's lang (localize(canonical, locale); an unknown row — impossible under
   *  the completeness pin — falls back to the canonical English face). */
  #labelOf(finding: ReportFindingInput, segment: string): string {
    const row = this.#words.localeRow(`${finding.type}.${segment}`);
    if (row === null) return segment;
    return this.#translator.localize(row.en, finding.lang) ?? row.en;
  }

  /** One finding's block — the four labeled segments plus the attribution. */
  #findingOf(finding: ReportFindingInput): string {
    const parts = this.#segments.map(
      (segment) =>
        `${this.#labelOf(finding, segment)}\n\n${String(finding[segment as keyof ReportFindingInput])}`,
    );
    return [...parts, this.#metaOf(finding.meta)].join("\n\n");
  }

  /** Render the aggregate issue body — deterministic: the Session block (harness
   *  line), the findings in input order, then the Dedup / Related tails. */
  renderBody(input: IssueReportInput): string {
    const parts: string[] = [`# CDD aggregate issue\n\n- Harness: ${input.harness}`];
    for (const finding of input.findings) parts.push(this.#findingOf(finding));
    const open = input.related?.open ?? [];
    if (open.length > 0) {
      parts.push(
        `## Dedup\n${open.map((hit) => `- Dedup → #${hit.issue} (open)：${hit.component} · ${hit.reason}`).join("\n")}`,
      );
    }
    const closed = input.related?.closed ?? [];
    const program = input.related?.program;
    if (closed.length > 0 || program !== undefined) {
      const lines: string[] = [];
      for (const hit of closed) lines.push(`- Regression / follow-up of #${hit.issue} (closed)`);
      if (program !== undefined) lines.push(`- Program: #${program.issue}`);
      parts.push(`## Related\n${lines.join("\n")}`);
    }
    return parts.join("\n\n");
  }

  /** Input-shape validation — the E-3 early-report contract (field paths, empty =
   *  pass). The canonical type set and the word-table locale projection are the single
   *  declared vocabularies. */
  validateInput(raw: unknown): string[] {
    const errors: string[] = [];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return ["input: expected an object with harness / findings / related?"];
    const input = raw as { harness?: unknown; findings?: unknown; related?: unknown };
    if (typeof input.harness !== "string" || input.harness.length === 0)
      errors.push("harness: non-empty string required");
    if (!Array.isArray(input.findings) || input.findings.length === 0) {
      errors.push("findings: non-empty array of findings required");
    } else {
      input.findings.forEach((rawFinding, i) => {
        const finding = rawFinding as Record<string, unknown> | null;
        const base = `findings[${i}]`;
        if (typeof finding !== "object" || finding === null) {
          errors.push(
            `${base}: object with type/lang/context/problem/impact/suggestedFix/meta expected`,
          );
          return;
        }
        if (!this.types.includes(String(finding.type)))
          errors.push(`${base}.type: must be one of ${this.types.join(" | ")}`);
        if (!this.langs().includes(String(finding.lang)))
          errors.push(`${base}.lang: must be one of ${this.langs().join(" | ")}`);
        for (const field of this.#segments) {
          if (typeof finding[field] !== "string" || (finding[field] as string).length === 0)
            errors.push(`${base}.${field}: non-empty string required`);
        }
        const meta = finding.meta as Record<string, unknown> | null | undefined;
        if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
          errors.push(`${base}.meta: object with skill / step required`);
        } else {
          if (typeof meta.skill !== "string" || meta.skill.length === 0)
            errors.push(`${base}.meta.skill: non-empty string required`);
          if (typeof meta.step !== "string" || meta.step.length === 0)
            errors.push(`${base}.meta.step: non-empty string required`);
        }
      });
    }
    return errors;
  }
}
