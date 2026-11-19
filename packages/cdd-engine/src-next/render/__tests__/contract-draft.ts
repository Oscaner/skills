// packages/cdd-engine/src-next/render/__tests__/contract-draft.ts
// The declaration-contract fixtures shared by the two construction-time faces
// (`templates.test.ts` and `context-lines.test.ts`). Both faces mutate the same three
// declaration planes — the mode rows, the review rows and the token table — so the
// mutable draft and the cast that injects it back into `TemplateAssembler` are written
// once here: a contract-shape change edits one file rather than two copies that agree
// only by accident.

import {
  type ContextLine,
  type ModePromptRow,
  TEMPLATE_PROMPT,
  type TemplatePrompt,
} from "../templates.ts";

/** A mutable row — the layout as a push-able array, so a case can add or replace one cell. */
export interface MutableRow extends Omit<ModePromptRow, "roundContext"> {
  roundContext: ContextLine[];
}

/** A mutable copy of the declared contract — one row per key, its layout cloned, so a
 *  case can mutate one declaration without leaking into the module's own data. */
export interface ContractDraft {
  readonly modes: Record<string, MutableRow>;
  readonly reviews: Record<string, MutableRow>;
  readonly tokens: { name: string; zone: string }[];
}

/** One row with its layout cloned — the only place a row is copied for mutation. */
const cloneRow = (row: ModePromptRow): MutableRow => ({
  ...row,
  roundContext: [...row.roundContext],
});

/** The declared contract as a mutable draft. */
export const draftOf = (): ContractDraft => ({
  modes: Object.fromEntries(
    Object.entries(TEMPLATE_PROMPT.modes).map(([key, row]) => [key, cloneRow(row)]),
  ),
  reviews: Object.fromEntries(
    Object.entries(TEMPLATE_PROMPT.reviews).map(([key, row]) => [key, cloneRow(row)]),
  ),
  tokens: TEMPLATE_PROMPT.tokens.map((token) => ({ name: token.name, zone: token.zone })),
});

/** The mutated draft as the injected contract. */
export const contractOf = (draft: ContractDraft): TemplatePrompt =>
  ({ ...TEMPLATE_PROMPT, ...draft }) as unknown as TemplatePrompt;
