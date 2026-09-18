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
| C1 | Assembly order fixed — `[registry prefix] → [static template shell] → [variant payload all tailed]`; H1/task-number/round-label/gate-target never precede the static zone |
| C2 | Shell/clause structure single-sourced — byte-identity cannot drift by construction (one source, references, not four copies + equality test) |
| C3 | Deterministic serialization — canonical key order, no environment-dependent reordering, fixed whitespace |
| C4 | Re-dispatch byte reuse — static zone memoized per (op, type); retries re-dispatch exact bytes, never re-render |
| C5 | Dispatch-set constancy — same (harness, op, type) keeps byte-identical invoke string / model / cwd / env; a stable tree is a caching clause (dispatch never mutates the tree — the commit double-gate already enforces this) |
| C6 | Write economy — thinnest static zone that still serves reuse; do not grow the prefix for content nobody reuses |
| C7 | Per-harness observation — observable harnesses assert "consecutive same-type rounds read tokens > 0"; unobservable or below-threshold harnesses are honestly marked "not measured, not claimed" |

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

- Measure via `claude /cost` and `--debug` cache stats across consecutive same-type rounds; record before/after read-token values as acceptance evidence.
- Cache benefits accrue only within the TTL window across consecutive same-type dispatches (review/fix chains, task runs); cross-window or absolute hit rates are **not** claimed.
- CI has no live harness: the observation pass is a documented dev-side measurement, not a CI gate.