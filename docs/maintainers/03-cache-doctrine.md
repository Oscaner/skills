# Cache Doctrine

Maintainer-only doctrine for how cdd-engine assembles agent prompts so that host-harness prompt caching can hit, across any harness. Derived from cross-provider research and codified as the six axioms plus the C1–C7 dispatch-assembly contract. Where a rule is mechanically enforced (`validateTemplateStructure`, the memoization in the lifecycle), the check is the source of truth and this document carries the judgment, not a mechanism map.

## 1. The six cross-provider axioms

Every provider's prompt cache is **exact byte-prefix matching** over the request; these six axioms hold across Anthropic/OpenAI/Gemini/DeepSeek-class systems:

| # | Axiom | Consequence |
|---|---|---|
| U1 | Static before dynamic | `[system/tools/static docs] → [variable payload]`; any byte change invalidates from that point onward |
| U2 | Byte stability is sacred | Deterministic serialization: fixed JSON key order, sorted tool/list arrays, fixed whitespace |
| U3 | Volatile content to the tail | timestamps / ids / round labels / absolute paths anywhere before the static zone are cache killers |
| U4 | Breakpoint surface is limited | explicit breakpoints exist (Anthropic ≤4, Gemini cachedContent), but when text is passed through a harness CLI, the **harness places the breakpoints** — the engine cannot |
| U5 | Hit rate is a first-class metric | instrument reads; treat a hit-rate regression like an incident |
| U6 | Write economics | writes cost; design static zones for ≥ 2 reuse |

## 2. Engine contract (C1–C7)

| # | Contract |
|---|---|
| C1 | Assembly order fixed — `[## Instructions + ## Handoff (slot-free shell)] → [## Return (frozen constant)] → [## Round context (single dynamic zone)]` — the dynamic zone is always final and never precedes the static shell. Per-dispatch values surface only as `## Round context` slots; the shell embeds zero slots by construction, and `## Return` is a byte constant (`RETURN_STDOUT_BLOCK`) |
| C2 | Shell/clause structure single-sourced — byte-identity cannot drift by construction (one source + references) |
| C3 | Deterministic serialization — canonical key order, no environment-dependent reordering, fixed whitespace |
| C4 | Re-dispatch byte reuse — the compiled shell + `## Return` constant memoize per (family × return format); byte-identical re-dispatches (retries, consecutive implement rounds) hit the frozen frame with zero re-render. Round-dependent `## Round context` slots re-render that zone only; the shell + `## Return` stay byte-frozen |
| C5 | Dispatch-set constancy — same (harness, op, type) keeps a byte-identical invoke string / cwd / env. The engine never decides `model` (harness-side); the asserted byte-constant set is `{ cli, invoke-arg string, cwd, env }`, and a stable tree (the commit double-gate) is a caching clause |
| C6 | Write economy — thinnest static zone that still serves reuse; never grow the prefix for content nobody reuses |
| C7 | Per-harness observation — observable harnesses assert "consecutive same-type rounds read tokens > 0"; unobservable or below-threshold harnesses are honestly marked "not measured, not claimed" |

## 3. Byte-plane over breakpoint-plane

The engine's only reliable lever is **bytes**, because prompt text arrives at the harness CLI as one user block and breakpoint placement is the CLI's decision — which is why C2/C3/C4 are structural (single source, canonical, memoized) rather than textual agreements. Cache benefits accrue only within the TTL window across consecutive same-type dispatches; cross-window or absolute hit rates are **not** claimed. The observation pass is a documented dev-side measurement, never a CI gate — a round yielding no cache fields is recorded honestly as "not measurable / below minTokens", never extrapolated.
