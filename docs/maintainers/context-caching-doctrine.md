# Context Caching Doctrine

Maintainer-only doctrine for how cdd-engine assembles agent prompts so that host-harness prompt caching can hit, across any harness. Derived from cross-provider research (primary sources: Anthropic platform docs for Claude-side mechanics) and codified as the C1–C7 dispatch-assembly contract.

## The six cross-provider axioms

Every provider's prompt cache is **exact byte-prefix matching** over the request; these six axioms hold across Anthropic/OpenAI/Gemini/DeepSeek-class systems:

| # | Axiom | Consequence |
|---|---|---|
| U1 | Static before dynamic | `[system/tools/static docs] → [variable payload]`; any byte change invalidates from that point onward |
| U2 | Byte stability is sacred | Deterministic serialization: fixed JSON key order, sorted tool/list arrays, fixed whitespace |
| U3 | Volatile content to the tail | timestamps / ids / round labels / absolute paths anywhere before the static zone are cache killers |
| U4 | Breakpoint surface is limited | explicit breakpoints (Anthropic ≤4, OpenAI GPT-5.6+, Gemini cachedContent) exist, but when text is passed through a harness CLI, the **harness places the breakpoints** — the engine cannot |
| U5 | Hit rate is a first-class metric | instrument reads; treat a hit-rate regression like an incident |
| U6 | Write economics | writes cost (Anthropic 1.25×, Gemini storage, newer OpenAI models); design static zones for ≥ 2 reuse |

## Engine contract (C1–C7)

| # | Contract |
|---|---|
| C1 | Assembly order fixed — `[## Instructions + ## Handoff (slot-free shell)] → [## Return (frozen per-format constant)] → [## Round context (single dynamic zone)]` — the dynamic zone is always the final part and never precedes the static shell. Per-dispatch values surface only as `## Round context` slots; the shell embeds zero slots by construction (`validateTemplateStructure`), and `## Return` is a byte constant per return format |
| C2 | Shell/clause structure single-sourced — byte-identity cannot drift by construction (one source, references, not four copies + equality test) |
| C3 | Deterministic serialization — canonical key order, no environment-dependent reordering, fixed whitespace |
| C4 | Re-dispatch byte reuse — compiled shell + `## Return` constant memoized per (family × return format); re-dispatches with byte-identical params (retries; consecutive implement rounds — `buildCtx`'s implement fixedPoint is always `""`) hit the frozen frame, zero re-render. Round-dependent `## Round context` slots (fix/review handoff target, fixed point, findings path) change those bytes per round: the `## Round context` zone re-renders, while the shell + `## Return` stay byte-frozen |
| C5 | Dispatch-set constancy — same (harness, op, type) keeps byte-identical invoke string / model / cwd / env; a stable tree is a caching clause (dispatch never mutates the tree — the commit double-gate already enforces this). The engine never decides `model` (harness-side); the asserted byte-constant set is what the engine actually spawns: `{ cli, invoke-arg string, cwd, env }` — pinning this keeps the C4 memo's input precondition. This narrowing of the plan's C5 acceptance wording ("invoke 串/model/cwd/env") is recorded against that item and accepted-noted per the plan-constraints §口径 cache dev-side measurement item (the phase's closing audit recorded it as a dev-side measurement, not a CI gate) |
| C6 | Write economy — thinnest static zone that still serves reuse; do not grow the prefix for content nobody reuses |
| C7 | Per-harness observation — observable harnesses assert "consecutive same-type rounds read tokens > 0"; unobservable or below-threshold harnesses are honestly marked "not measured, not claimed" |

## Static-zone segmentation semantics (C1/C4 reconciliation)

The landed T5.1 skeleton is sections `[## Instructions, ## Handoff, ## Return, ## Round context]` partitioned into segments `{shell: [Instructions, Handoff], return: [Return], round-context: [Round context]}`. The **shell is slot-free** — it embeds zero per-dispatch token moustaches (`{{> clause}}` partial refs are the only `{{…}}` shapes allowed, resolved once at load), and **`## Return` is a frozen per-format literal constant** (`RETURN_STDOUT_BLOCK` / `RETURN_JSON` / `DOCS_FIX`). The **only dynamic zone is `## Round context`**: all 17 round-context tokens render there — `HANDOFF_TARGET` · `HANDOFF_WRITE_GATE` · `TASK_FINDINGS` · `TASK_FIXED_POINT` · `REVIEW_REFERENCE` and the rest — so round-suffixed handoff targets, task numbers, gate strings, and findings/fixed-point values are **`## Round context` slots** that change the canonical cache key (C3), never the frozen shell bytes. All of this is mechanically enforced by `validateTemplateStructure`: shell zero moustache, return constants zero moustache, and each registry token rendering only inside its owning zone's source. The C4 frozen-bytes guarantee is scoped to **byte-identical re-dispatches**: retries, and consecutive rounds whose round-context params are identical — implement rounds in particular are byte-identical round to round (`buildCtx` implements a `""` fixed point, so consecutive implement rounds differ from each other only in constants). Consecutive fix/review rounds diverge at their round-dependent `## Round context` slots; the harness-side shared-prefix then covers `## Instructions` + `## Handoff` + `## Return` only, and a `read > 0` flip must be recorded honestly against that prefix (C7), never claimed as whole-prompt reuse.

## Byte-plane over breakpoint-plane

The engine's only reliable lever is **bytes**, because prompt text arrives at the harness CLI as one user block and breakpoint placement is the CLI's decision. This is why C2/C3/C4 are structural (single source, canonical, memoized) rather than textual agreements. The cacheability of the engine's own prompt tokens additionally depends on the CLI's block granularity — measured (C7), never assumed.

## Registry cache profile (capability as data)

`harness-registry.json` entries carry a `cache` profile so capability is data, not prose, and a new harness = a new registry row, zero contract changes:

- `mechanism`: `explicit` | `auto-prefix` | `implicit`
- `minTokens`: below this the model/cache does not engage (Anthropic Opus 5 / Fable 5.1 / Mythos 5.1 = 512; Sonnet 5 = 1024; Haiku 4.5 = 4096)
- `readMultiplier` / `writeMultiplier`: pricing shape (Claude 5-min: read 0.1× / write 1.25×; Fable/Mythos 5.1 reads 0.025×)
- `ttlMinutes`: default 5-min TTL, reads refresh free
- `observable`: whether usage fields exist (`cache_read_input_tokens` etc.)

Baseline entries: `claude` = explicit / 512 / 0.1 / 1.25 / 5 / true; `cursor-agent` = auto-prefix fallback, values pending measurement.

## Observation & honest boundaries

- Measure via the tool's appended flag across consecutive same-type rounds: `claude --debug` — the real non-interactive `claude -p` flag (emits usage/cache stats to stderr; the tool's default) — or the interactive REPL `/cost` command for manual sessions; record before/after read-token values as acceptance evidence.
- Tooling: `node scripts/observe-cache.ts [--rounds 2] [--cost|--debug] -- <workspace> <task> <mode>` runs ≥2 consecutive same-(harness, op, type) dispatch rounds with the measurement flag appended (default `--debug`; `--cost` is an explicit opt-in for harnesses that accept it; the harness entry is selected via the tool's own harness option, defaulting to `claude`) and extracts `{ readTokens, writeTokens }` per round (parse seam unit-tested at `scripts/__tests__/observe-cache.test.ts`). The run is measurement-only: no handoffs written, no workspace mutation — real rounds run through `cdd` (whose entry gate keeps the tree stable, C5). Fixed-point / findings params mirror `buildCtx`'s cross-phase read: implement rounds byte-identical; fix rounds read the same-round review handoff's `commits.base` when present, else document an approximation (see static-zone semantics).
- Cache benefits accrue only within the TTL window across consecutive same-type dispatches (review/fix chains, task runs); cross-window or absolute hit rates are **not** claimed.
- CI has no live harness: the observation pass is a documented dev-side measurement, not a CI gate. Actual measured values are recorded by the dev on a live harness as dev-side measurements (accepted-noted per the plan-constraints §口径 cache dev-side measurement item at the closing audit); a round that yields no cache fields is recorded honestly as "not measurable / below minTokens" — never extrapolated.
