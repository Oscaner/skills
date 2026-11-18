// packages/cdd-engine/src-next/session/preflight.ts
// P4.1 T1 — the lifecycle pre-flight seam (design spec §1): the STRUCTURE gates
// converge into ONE single-entry gate a work command consults before ANY child
// dispatch — the clean-tree hard gate (tree-clean → BLOCKED with the commit/discard
// guidance, the skill-side claim `engine entry gate: dirty → BLOCKED` finally made
// real), then the in-flight gate, the plan read's own structure refusal (the
// un-gated plan-carrier leg, P35 §2.3), the graph validate, the plan/ledger
// structure gate (`plan-ledger`, P21 §3.1/§6.4) and the doc-side gate
// (Contract.validate over the target doc). The dispatch's own phase — the wave
// face's gate and the doc/branch line's — is NOT judged here: it belongs to the ONE
// dispatch authority (`session/dispatch-authority.ts`, P27 §2), the seam's single
// consumer.
//
// Gate order (the design's pinned sequence, judgeable on every verdict):
//   tree-clean → in-flight → plan-carrier → graph → plan-ledger →
//   (spec/plan faces) Contract.validate → the four pre-dispatch rows → dispatch
// The four pre-dispatch rows (`no-host` · `carrier` · `dispatch-input` · `artifact`,
// P40 T4) are the structure leg's 6th–9th rows: they judge every face, all four in one
// pass, and they live here — not in the dispatch body — because the input face's quality
// must be judged before the dispatch it would run exists (and before any write).
// The plan-carrier leg is the readable plan's OWN refusal (P35 §2.3): an UN-GATED
// judgment over `ctx.plan` — not a row of the doc-shape block — so the wave face
// (no doc target, `ctx.doc === null`) is judged too. It speaks the existing
// `doc-contract` gate id and reason token, so no token joins the table.
// The evidence/read-back gates stay at the dispatch child face (the seam never
// touches the round's produced artifacts — non-pre-flight by design).
//
// The verdict is the single BLOCK carrier: `gate` names the refusing gate, `reason`
// the named refusal row, `message` the CDD_BLOCKED wording (pinned rows), `details`
// the named issue/finding lines the renderer prints, `order` the gates that ran
// (the CLI never re-implements a gate — the seam owns the whole sequence) and
// `checked` the per-rule checked list (P21 §3.4) — derived from the SAME rule
// declaration surface the policy composition walks, so "which rule ran" and "what it
// judged" can never drift apart.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { ContextLine, SceneFacts } from "../contract/context-declarations.ts";
import { FrontMatterExtractor } from "../contract/frontmatter.ts";
import { type DocFs, type Finding, LedgerTaskSetRule, NodeFs } from "../contract/invariants.ts";
import { Contract, type ContractInput, type LedgerFacts } from "../contract/judge.ts";
import {
  type ArtifactSnapshot,
  PreFlightRows,
  type RowRefusal,
  type RowStation,
} from "../contract/preflight-rows.ts";
import type { DocKey } from "../contract/project.ts";
import type { Words } from "../face/words.ts";
import type { GitClient } from "../infra/git.ts";
import type { PlanRead } from "../infra/plan-source.ts";
import { type RepoPath, RepoRoot } from "../infra/root.ts";
import { SlugIndex } from "../infra/slug-index.ts";
import { TargetFaceTable, type TargetType } from "./faces.ts";
import { TaskGraph } from "./graph.ts";
import type { InFlight, InFlightState } from "./inflight.ts";
import type { Ledger, ProgressData } from "./ledger.ts";
import { RoundRecords } from "./ledger.ts";

/** The named gates the seam composes — the run evidence + the blocking gate label.
 *  Each name is also the structure leg's reason token in the ONE reason table
 *  (`DISPATCH_REASON`, §2.5), so the dispatch authority reuses this word list rather
 *  than spelling the gate ids a second time. The last four are the PRE-DISPATCH rows'
 *  own station words (`RowStation`): they join this set rather than form a second one,
 *  so the reason table's structure leg is this type and nothing else. */
export type PreFlightGateName =
  | "tree-clean"
  | "in-flight"
  | "graph"
  | "plan-ledger"
  | "doc-contract"
  | RowStation;

/** The four pre-dispatch rows in judgment order — the seam's 6th–9th rows, after the
 *  document gate (an input face's quality only means something once the document it
 *  belongs to is qualified). They are judged on EVERY face, all four in one pass. */
const DISPATCH_ROWS: readonly RowStation[] = ["no-host", "carrier", "dispatch-input", "artifact"];

/** The named refusal rows — the BLOCK reason the CDD_BLOCKED wording fills.
 *  Refusals exist only on the failure face (`ok: true` carries no `reason`), so the
 *  enum has zero dead values: "the plan leads the ledger" is a `checked` info row, and
 *  a missing ledger fact bundle is a `checked` skipped row — neither is a refusal. The
 *  four pre-dispatch rows carry NO word from this set: their wording is the row's own
 *  `RowRefusal.detail`, and the verdict's `gate` already names the station — a fourth
 *  vocabulary here would name one refusal twice.
 *  (P40 T4 keeps this enum at five values.) */
export type PreFlightReason = "dirty-tree" | "held" | "corrupt-record" | "graph" | "doc-contract";

/** The doc-scope judgment outcome of one dispatch — what the checked list renders.
 *  `layersUnavailable` marks the shape where the call site had no plan layers to inject
 *  (the wave-width rule then judged nothing): the checked list shows that degradation
 *  instead of a bare `passed`. A dispatch never reaches it — the plan face's graph gate
 *  always yields the layers (see the assignment site) — so the row serves a
 *  non-dispatch judgment face, where a missing fact bundle is rendered rather than
 *  refused. */
type DocOutcome =
  | {
      readonly kind: "judged";
      readonly findings: readonly Finding[];
      readonly layersUnavailable?: boolean;
    }
  | { readonly kind: "no-doc-target" }
  | { readonly kind: "unreadable" }
  | { readonly kind: "not-judged" };

/** The ledger-scope judgment outcome of one dispatch. */
type LedgerOutcome =
  | { readonly kind: "judged"; readonly findings: readonly Finding[] }
  | { readonly kind: "no-ledger-facts" };

/** One pre-flight verdict — the single BLOCK carrier of the dispatch gates. */
export interface PreFlightVerdict {
  /** Whether the dispatch is approved (the gates passed). */
  ok: boolean;
  /** The in-flight fact the gate judged — present only when the in-flight gate was
   *  the refusing gate. The `--dry-run` preview reads the holder facts from here
   *  (it never inspects, never acquires: zero write). */
  holding?: InFlightState;
  /** The refusing gate (absent when ok — no gate blocked). */
  gate?: PreFlightGateName;
  /** The named refusal row (absent when ok). */
  reason?: PreFlightReason;
  /** The rendered BLOCK wording — the CDD_BLOCKED channel carries it (the
   *  word-table rows). */
  message?: string;
  /** The named issue/finding lines the renderer prints under the message. */
  details?: readonly string[];
  /** The gates that ran, in order — the judgeable order (tree-clean → in-flight →
   *  plan-carrier → graph → plan-ledger → doc-contract → the four pre-dispatch rows,
   *  per the face's applicable set). The four pre-dispatch rows run on every face, so
   *  the row count is a function of the face (a plan dispatch reaches nine, a wave
   *  eight, a branch or spec/overall dispatch seven) — never "every dispatch carries
   *  nine rows"). */
  order: readonly PreFlightGateName[];
  /** The checked face — one row per gate (`${gate}`) and per declared rule
   *  (`${ruleId}: ${passed|failed|skipped (reason)|info (hint)}`), derived from the
   *  SAME rule declaration surface the strategy composition walks. */
  checked: readonly string[];
}

/** The doc-contract target of a spec/plan dispatch. */
export interface PreFlightDoc {
  /** The target doc type's registry key — read from the doc's front-matter
   *  `doc-type:` key (spec §12 · D34; both the spec and the plan faces key by
   *  the head key, zero command-type carve-out).
   *  null when a present doc carries no key OR carries a value outside the
   *  declared domain — the seam BLOCKs either way, with a distinct word per
   *  shape (zero filename-suffix fallback, one declaration reading face
   *  `BoardView.readDocType`). */
  docKey: DocKey | null;
  /** The target doc's path — the branded repoRoot-relative `RepoPath` (T4 §2.2: a
   *  bare `string` never reaches this read face; the caller feeds the funnel-shaped
   *  relative value). The seam erases it to the absolute syscall form through its
   *  OWN `RepoRoot(ctx.repoRoot)` just before the read — the brand is REAL (the
   *  absolute state is unrepresentable as a `RepoPath`), the same shape as
   *  `artifacts.readText(node, root, file: RepoPath)`). */
  path: RepoPath;
}

/** One dispatch's pre-flight inputs — the STRUCTURE facts the seam judges. The
 *  dispatch's own phase inputs (the verb, the requested task group) are the dispatch
 *  authority's, never this seam's. */
export interface PreFlightContext {
  /** The dispatch's target type (wave / branch / spec / plan). */
  type: TargetType;
  /** The repo root the tree-clean gate reads. */
  repoRoot: string;
  /** The plan read (the wave/plan faces' graph gate input and the plan-ledger fact
   *  source; the derived face's `undeclared` value elsewhere) — the ONE plan fact of
   *  this dispatch, read before the seam runs. */
  plan: PlanRead;
  /** The session ledger (the plan-ledger gate's fact source). */
  ledger: Ledger | null;
  /** The doc-contract target of a spec/plan dispatch (null on the other faces). */
  doc: PreFlightDoc | null;
  /** The in-flight fact's READ-ONLY face (P21 §2.2/§6.4). The gate only calls
   *  `inspect()` — it never acquires, steals or releases. Required: a dispatch
   *  whose gate was not wired cannot silently pass (no type-level default). */
  readonly inflight: InFlight;
  /** The explicit takeover flag: true lets the gate PASS a dead holder's record (or
   *  a corrupt record with its lock still on disk). The takeover itself is the real
   *  dispatch's `acquire(record, { recover })` — the gate only judges. Under
   *  `--dry-run` this flag is void (the preview never acquires). */
  readonly recover?: boolean;
  /** The host probe's ONE value (the composition root probes once; the seam judges, so
   *  no second probe can answer differently). The empty string is "no host harness". */
  readonly host: string;
  /** The dispatch's assembled value record — the SAME record the renderer renders. */
  readonly values: Readonly<Record<string, string>>;
  /** The round's resolved declaration row (`TemplateAssembler#layoutOf(values)`) — the
   *  judgment's definition of which cells are exigible. */
  readonly declarations: readonly ContextLine[];
  /** The two DECLARED scene facts (`program` / `doc-type:`), booleanized at the
   *  composition root: a declared program whose charter did not resolve and a program
   *  never declared are different facts. */
  readonly scene: SceneFacts;
  /** This dispatch's artifact judgment as the contract plane's snapshot — the ONE read
   *  the artifact and carrier rows judge (never a second read inside the seam). */
  readonly artifact: ArtifactSnapshot;
}

/**
 * PreFlight — the single pre-flight seam of the work dispatch. One `vet` call runs
 * the whole gate sequence in the pinned order and returns the verdict the CLI
 * renders (or approves): the seam owns the gates, the CLI only orchestrates the
 * call + the render — zero second implementation on the CLI face.
 */
export class PreFlight {
  /** The git seam the tree-clean gate reads. */
  readonly #git: GitClient;
  /** The doc-contract coordinator the doc faces judge through. */
  readonly #contract: Contract;
  /** The word table the BLOCK wording rides. */
  readonly #words: Words;
  /** The filesystem seam the doc-contract gate reads (defaults to node:fs). */
  readonly #fs: DocFs;

  constructor(opts: { git: GitClient; contract: Contract; words: Words; fs?: DocFs }) {
    this.#git = opts.git;
    this.#contract = opts.contract;
    this.#words = opts.words;
    this.#fs = opts.fs ?? new NodeFs();
  }

  /** vet(ctx) — the single seam call: tree-clean → in-flight → plan-carrier → graph
   *  → plan-ledger → doc-contract → the four pre-dispatch rows. The existing five judge
   *  in sequence and the first violation refuses; the four pre-dispatch rows run after
   *  them, all four at once, and report every violation in one pass. The first refused
   *  row owns the verdict; the gates that ran precede it (the judgeable order). */
  async vet(ctx: PreFlightContext): Promise<PreFlightVerdict> {
    const gates: PreFlightGateName[] = [];
    const checked: string[] = [];
    // 1. tree-clean — the hard gate all three verbs share.
    gates.push("tree-clean");
    checked.push("tree-clean");
    if (!(await this.#git.isClean(ctx.repoRoot))) {
      return this.#refusal(
        {
          ok: false,
          gate: "tree-clean",
          reason: "dirty-tree",
          message: this.#words.preflightWords().dirtyTree,
        },
        gates,
        checked,
        this.#docOutcomeOf(ctx),
        { kind: "no-ledger-facts" },
      );
    }
    // 2. in-flight — the tree's dispatch fact (P21 §6.4). The gate judges ONLY: it
    //    inspects the record + the holder's liveness and never touches the lock or
    //    the record bytes. The acquire is the real dispatch path's write point (it
    //    runs after this gate), so the preview's zero-write discipline holds.
    gates.push("in-flight");
    const inFlight = await ctx.inflight.inspect();
    checked.push(this.#inFlightRow(inFlight));
    const held = this.#inFlightRefusal(inFlight, ctx.recover === true);
    if (held !== null) {
      return this.#refusal(
        {
          ok: false,
          gate: "in-flight",
          reason: held.reason,
          message: held.message,
          holding: inFlight,
        },
        gates,
        checked,
        this.#docOutcomeOf(ctx),
        { kind: "no-ledger-facts" },
      );
    }
    // 3. plan-carrier — the plan READ's own structure judgment (P35 §2.3): every face
    //    that carries a plan read (wave / plan / branch) asks the value whether the
    //    document it read may be dispatched. The source is `ctx.plan`, never `ctx.doc`
    //    — the wave face reaches this point with no doc target at all. The `io` cause
    //    never asks this leg: the scene stops at the usage seam before any workspace
    //    key exists, so only `syntax` and the `spec-absent` orphan arrive here.
    if (ctx.type === "wave" || ctx.type === "plan" || ctx.type === "branch") {
      const refusal = ctx.plan.refusal(this.#words);
      if (refusal !== null) {
        // The plan face's own gate set already holds `doc-contract`, so its refusal
        // accounts for the gate it PLANNED to run; the wave / branch faces never
        // planned it and must not claim they did.
        if (ctx.type === "plan") {
          gates.push("doc-contract");
          checked.push("doc-contract");
        }
        return this.#refusal(
          { ok: false, gate: refusal.gate, reason: refusal.reason, message: refusal.message },
          gates,
          checked,
          this.#docOutcomeOf(ctx),
          { kind: "no-ledger-facts" },
        );
      }
    }
    // 4. graph — the wave/plan faces' structural gate, on a READY plan only: a
    //    non-ready read never enters the gate plan, so the row is neither pushed nor
    //    reported (`checked`'s byte set stays the healthy one).
    let graph: TaskGraph | null = null;
    if ((ctx.type === "wave" || ctx.type === "plan") && ctx.plan.kind === "ready") {
      gates.push("graph");
      checked.push("graph");
      graph = ctx.plan.graph();
      if (graph !== null) {
        const issues = graph.validate();
        if (issues.length > 0) {
          return this.#refusal(
            {
              ok: false,
              gate: "graph",
              reason: "graph",
              message: this.#words.preflightWords().graph.replace("{count}", String(issues.length)),
              details: issues.map((issue) => `${issue.kind}@T${issue.task}: ${issue.message}`),
            },
            gates,
            checked,
            this.#docOutcomeOf(ctx),
            { kind: "no-ledger-facts" },
          );
        }
      }
    }
    // 5. plan-ledger — the ledger-scope rules (P21 §3.1/§6.4). Plan / wave / branch
    //    dispatches run it; the doc-scope rules never do (two scopes, two entries).
    //    A missing fact bundle is NOT a refusal: the rows render `skipped`.
    let ledgerOutcome: LedgerOutcome = { kind: "no-ledger-facts" };
    let ledgerInput: ContractInput | null = null;
    if (ctx.type === "plan" || ctx.type === "wave" || ctx.type === "branch") {
      gates.push("plan-ledger");
      checked.push("plan-ledger");
      const facts = this.#ledgerFactsOf(ctx, graph);
      if (facts !== null) {
        ledgerInput = this.#ledgerInputOf(ctx);
        const findings = this.#contract.validateLedger(ledgerInput, facts);
        ledgerOutcome = { kind: "judged", findings };
        const ahead = LedgerTaskSetRule.planAhead(facts);
        if (ahead > 0) {
          checked.push(this.#words.checkedWords().planAhead.replace("{count}", String(ahead)));
        }
        if (findings.length > 0) {
          return this.#refusal(
            {
              ok: false,
              gate: "plan-ledger",
              message: this.#words.preflightWords().planLedger,
              details: findings.map(
                (finding) => `${finding.kind}@${finding.field}: ${finding.message}`,
              ),
            },
            gates,
            checked,
            this.#docOutcomeOf(ctx),
            ledgerOutcome,
          );
        }
      }
    }
    // 6. doc-contract — the doc shapes' structural gate (the doc-scope rules).
    //    The four document shapes (`phase-spec` · `overall` · `plan` · `single-spec`)
    //    are judged by the SAME gate: the document's declared `doc-type:` picks the
    //    contract, never the command's `--type` spelling.
    let docOutcome: DocOutcome = this.#docOutcomeOf(ctx);
    if (TargetFaceTable.isDocShape(ctx.type)) {
      gates.push("doc-contract");
      checked.push("doc-contract");
      const doc = ctx.doc;
      const docAbsolute = doc === null ? null : new RepoRoot(ctx.repoRoot).resolve(doc.path);
      const content = docAbsolute === null ? null : this.#fs.read(docAbsolute);
      if (content !== null && doc !== null && docAbsolute !== null) {
        const { head } = FrontMatterExtractor.split(content);
        const parseError = head.parseError;
        if (parseError !== null) {
          return this.#refusal(
            {
              ok: false,
              gate: "doc-contract",
              reason: "doc-contract",
              message: this.#words
                .routeWord("frontmatterParse")
                .replace("{reason}", parseError.reason)
                .replace("{line}", String(parseError.line))
                .replace("{column}", String(parseError.column))
                .replace("{source}", parseError.source),
            },
            gates,
            checked,
            { kind: "not-judged" },
            ledgerOutcome,
          );
        }
        if (doc.docKey === null) {
          const message =
            head.docType === null
              ? this.#words.routeWord("docType")
              : this.#words.docTypeValueWord(head.docType);
          return this.#refusal(
            { ok: false, gate: "doc-contract", reason: "doc-contract", message },
            gates,
            checked,
            { kind: "not-judged" },
            ledgerOutcome,
          );
        }
        const index = SlugIndex.build(ctx.repoRoot, this.#fs);
        const verdict = index.slugVerdict(doc.path, head.slug);
        if (verdict.kind !== "accepted") {
          return this.#refusal(
            {
              ok: false,
              gate: "doc-contract",
              reason: "doc-contract",
              message: this.#words.slugRefusal(verdict),
            },
            gates,
            checked,
            { kind: "not-judged" },
            ledgerOutcome,
          );
        }
        // The plan's topological layers ride the graph gate's own derivation
        // (`TaskGraph#batches()` — the ONE width authority), so the plan-scope rules
        // judge exactly the layer set the wave gates will dispatch against.
        const taskLayers = graph?.batches();
        const findings = this.#contract.validate({
          docKey: doc.docKey,
          path: docAbsolute,
          content,
          root: ctx.repoRoot,
          slugIndex: index,
          fs: this.#fs,
          taskLayers,
        });
        docOutcome = {
          kind: "judged",
          findings,
          // The layer fact is absent only where the graph gate never ran, and on the
          // dispatch faces that cannot happen: `--type plan` REQUIRES `--plan` (a usage
          // rejection exits first), so a plan doc always has its graph and therefore its
          // layers; a phase-spec's docKey is `phase-spec`, never `plan`; and the wave /
          // branch faces judge no doc target (`no-doc-target`). The row therefore
          // describes a non-dispatch judgment face (a programmatic caller, a future
          // face) — a visible degradation, never a dispatch-time refusal.
          layersUnavailable: doc.docKey === "plan" && taskLayers === undefined,
        };
        if (findings.length > 0) {
          return this.#refusal(
            {
              ok: false,
              gate: "doc-contract",
              reason: "doc-contract",
              message: this.#words.preflightWords().docContract,
              details: findings.map(
                (finding) => `${finding.kind}@${finding.field}: ${finding.message}`,
              ),
            },
            gates,
            checked,
            docOutcome,
            ledgerOutcome,
          );
        }
      } else {
        docOutcome = { kind: "unreadable" };
      }
    }
    // 7–10. the four PRE-DISPATCH rows (P40 T4) — every face judges all four, in one
    //    pass: a refused round is repaired once instead of one row per dispatch. They
    //    sit AFTER the document gate on purpose (an input face is judged only once the
    //    document it belongs to is qualified) and therefore ahead of the line leg in the
    //    dispatch authority's chain: a dispatch that breaks a gate AND its line reports
    //    the gate's row.
    gates.push(...DISPATCH_ROWS);
    checked.push(...DISPATCH_ROWS);
    const rows = PreFlightRows.judge({
      facts: { type: ctx.type, host: ctx.host },
      values: ctx.values,
      declarations: ctx.declarations,
      scene: ctx.scene,
      artifact: ctx.artifact,
      // The path-basis value object: the existence reads resolve through it, so a
      // dispatch started from a subdirectory never reads every landed path as missing.
      repoRoot: new RepoRoot(ctx.repoRoot),
      // The seam hands down the port it was constructed with — the judgment constructs
      // no concrete fs (a recording fake pins the read).
      fs: this.#fs,
      wording: this.#words.preflightWording(),
      // The naming cell is the seam's OWN answer, never a context slot: the dispatch
      // path never asks it (only the preview's weaker arm does), so the dispatch answer
      // IS `answered: false`.
      naming: { answered: false },
    });
    if (rows.length > 0) {
      const first = rows[0]!;
      return this.#refusal(
        {
          ok: false,
          gate: first.station,
          message: this.#withoutStation(first),
          // `details` is "the rows under `message`" — the same meaning the graph and
          // plan-ledger rows already carry. Collecting all four would print the first
          // row's sentence twice in one block.
          details: rows.slice(1).map((row) => row.detail),
        },
        gates,
        checked,
        docOutcome,
        ledgerOutcome,
      );
    }
    return {
      ok: true,
      order: gates,
      checked: [...checked, ...this.#ruleRows(docOutcome, ledgerOutcome)],
    };
  }

  /** The verdict's `message`: the refusing row's detail with its OWN station word (and
   *  the separator behind it) stripped off the string's start. `gate` carries the
   *  station, and `DispatchAuthority#message` is the ONE place that puts it back — the
   *  command face and the preview therefore each have exactly one station head. A detail
   *  whose first word is not the station is left whole: `carrier` is the station while
   *  `carrier-mismatch` is that row's reason word, and `artifact-identity` is the
   *  artifact row's. */
  #withoutStation(row: RowRefusal): string {
    const join = this.#words.preflightWording().dispatchInput.stationJoin;
    const prefix = `${row.station}${join}`;
    return row.detail.startsWith(prefix) ? row.detail.slice(prefix.length) : row.detail;
  }

  /** The in-flight gate's refusal — the three-state judgment + the explicit takeover
   *  flag. A live holder is always refused (the flag never crosses "alive"); a dead
   *  holder or a corrupt-record-with-lock passes only under `recover`; a corrupt
   *  record with no lock behind it is no holder at all (pass, named on the row). */
  #inFlightRefusal(
    state: InFlightState,
    recover: boolean,
  ): { readonly reason: PreFlightReason; readonly message: string } | null {
    if (state.kind === "held") {
      if (state.alive) {
        return {
          reason: "held",
          message: this.#words.inFlightBlocked(state.record, true),
        };
      }
      if (recover) return null;
      return {
        reason: "held",
        message: this.#words.inFlightBlocked(state.record, false),
      };
    }
    if (state.kind === "corrupt" && state.locked && !recover) {
      return {
        reason: "corrupt-record",
        message: this.#words.inFlightWords().corruptLocked,
      };
    }
    return null;
  }

  /** The in-flight gate's checked row — `in-flight: <judged state>` (the ONE gate
   *  row that names its state; the takeover flag never rewrites the fact, it only
   *  lets the gate pass). */
  #inFlightRow(state: InFlightState): string {
    const rows = this.#words.checkedWords().inFlight;
    if (state.kind === "absent") return `in-flight: ${rows.free}`;
    if (state.kind === "corrupt")
      return `in-flight: ${state.locked ? rows.corruptLocked : rows.corruptUnlocked}`;
    return `in-flight: ${(state.alive ? rows.held : rows.stale).replace(
      "{pid}",
      String(state.record.pid),
    )}`;
  }

  /** Assemble the refusal verdict — the gates/checked rows accumulated so far, plus
   *  the per-rule rows of the judgment outcomes reached (one carrier shape). */
  #refusal(
    verdict: Omit<PreFlightVerdict, "order" | "checked">,
    gates: readonly PreFlightGateName[],
    checked: readonly string[],
    doc: DocOutcome,
    ledger: LedgerOutcome,
  ): PreFlightVerdict {
    return {
      ...verdict,
      order: gates,
      checked: [...checked, ...this.#ruleRows(doc, ledger)],
    };
  }

  /** The doc-scope outcome of a dispatch — "no doc target" on the doc-less faces
   *  (wave / branch), "not judged" when the doc-contract gate never ran. The `judged`
   *  outcome is assigned by the doc-contract gate itself (the one gate that judges). */
  #docOutcomeOf(ctx: PreFlightContext): DocOutcome {
    if (ctx.type === "wave" || ctx.type === "branch") return { kind: "no-doc-target" };
    return { kind: "not-judged" };
  }

  /** The checked rows of the rule declaration surface — one line per declaration,
   *  rendered ONCE (a rule crossing two gates never appears twice). */
  #ruleRows(doc: DocOutcome, ledger: LedgerOutcome): string[] {
    const words = this.#words.checkedWords();
    const rows: string[] = [];
    for (const declaration of Contract.ruleRows()) {
      if (declaration.scope === "doc") {
        if (doc.kind === "no-doc-target")
          rows.push(`${declaration.id}: ${words.skippedNoDocTarget}`);
        else if (doc.kind === "not-judged")
          rows.push(`${declaration.id}: ${words.skippedNotJudged}`);
        else if (doc.kind === "unreadable")
          rows.push(`${declaration.id}: ${words.skippedUnreadableDoc}`);
        else if (doc.layersUnavailable === true && declaration.id === "wave-width-at-most-three")
          rows.push(`${declaration.id}: ${words.planLayersUnavailable}`);
        else
          rows.push(
            `${declaration.id}: ${
              doc.findings.some((finding) => finding.kind === declaration.id)
                ? words.failed
                : words.passed
            }`,
          );
        continue;
      }
      if (ledger.kind === "no-ledger-facts") {
        rows.push(`${declaration.id}: ${words.skippedNoLedgerFacts}`);
      } else {
        rows.push(
          `${declaration.id}: ${
            ledger.findings.some((finding) => finding.kind === declaration.id)
              ? words.failed
              : words.passed
          }`,
        );
      }
    }
    return rows;
  }

  /** The ledger fact bundle of one dispatch — built from the ledger, the plan read
   *  and the plan's topological layers. Null when either fact source is absent (the
   *  gate then renders `skipped (no ledger facts)`). */
  #ledgerFactsOf(ctx: PreFlightContext, graph: TaskGraph | null): LedgerFacts | null {
    const ledger = ctx.ledger;
    const doc = ctx.plan.doc();
    if (ledger === null || doc === null) return null;
    const planTasks = doc.taskBlocks.map((block) => block.id);
    const layers = (graph ?? ctx.plan.graph() ?? new TaskGraph(doc)).batches();
    const data = ledger.readProgress();
    const recorded = this.#recordedTasksOf(data);
    const closed = ledger.closedWaves();
    const waves = (data?.waves ?? [])
      .map((row) => this.#taskIdsOf(row.wave))
      .filter((ids) => ids.length > 0);
    const closedWaves = waves.filter((ids) => ids.every((id) => closed.has(id)));
    const openWaves = waves.filter((ids) => ids.some((id) => !closed.has(id)));
    return {
      planTasks,
      recordedTasks: recorded,
      closedWaves,
      openWaves,
      // The wave rows' closure-time plan-task snapshots (P21 §5.1) — read from the
      // SAME ledger face the wave gate's append judgment reads (zero second source).
      snapshots: this.#snapshotsOf(data),
      layers,
    };
  }

  /** The wave rows' plan-task snapshots — one entry per TASK wave row carrying a
   *  snapshot (an absent snapshot is a historical row, not an empty set). The
   *  snapshot is read off the row already in hand: the same field `Ledger#planTasksOf`
   *  returns, one file read for the whole set instead of one per row. */
  #snapshotsOf(
    data: ProgressData | null,
  ): readonly { readonly wave: string; readonly planTasks: readonly number[] }[] {
    const snapshots: { wave: string; planTasks: readonly number[] }[] = [];
    for (const row of data?.waves ?? []) {
      if (this.#taskIdsOf(row.wave).length === 0) continue;
      const planTasks = row.planTasks;
      if (planTasks !== undefined) snapshots.push({ wave: row.wave, planTasks });
    }
    return snapshots;
  }

  /** The task ids the ledger recorded a COMPLETED round for (the recorded set of the
   *  plan/ledger agreement rule — the completion read, so a dispatched-but-failed
   *  round does not close the agreement). Only TASK waves count: a doc/branch line row
   *  (keyed `"plan"` / `"phase-spec"` / `"overall"` / `"single-spec"` / `"branch"`) is
   *  not a task id. */
  #recordedTasksOf(data: ProgressData | null): readonly number[] {
    const recorded: number[] = [];
    for (const row of data?.waves ?? []) {
      const completed = RoundRecords.of(row).some((record) => record.verdict.targetAction);
      if (!completed) continue;
      recorded.push(...this.#taskIdsOf(row.wave));
    }
    return recorded;
  }

  /** A wave key's task ids — the numeric-only reading (a non-numeric line key yields
   *  no task ids; the ledger rules judge TASK waves, never doc/branch line rows). */
  #taskIdsOf(waveKey: string): readonly number[] {
    const ids: number[] = [];
    for (const part of waveKey.split(",")) {
      const id = Number(part);
      if (Number.isInteger(id) && id > 0) ids.push(id);
    }
    return ids;
  }

  /** The ledger judgment's input document — the plan under judgment (the ledger rules
   *  are declared plan-only; the other facts ride `LedgerFacts`). */
  #ledgerInputOf(ctx: PreFlightContext): ContractInput {
    return {
      docKey: "plan",
      path: ctx.doc?.path ?? "",
      content: ctx.plan.text() ?? "",
      root: ctx.repoRoot,
      fs: this.#fs,
    };
  }
}
