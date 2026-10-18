# Cache Doctrine

Maintainer-only doctrine for how cdd-engine assembles agent prompts so host-harness prompt caching can hit, across any harness. Where a rule is mechanically enforced (`validateTemplateStructure`, lifecycle memoization) the check is the source of truth.
## 1. The six cross-provider axioms

Every provider's prompt cache is **exact byte-prefix matching**; these hold across Anthropic/OpenAI/Gemini/DeepSeek-class systems:

| # | Axiom | Consequence |
|---|---|---|
| U1 | Static before dynamic | `[static docs] → [variable payload]`; any byte change invalidates onward |
| U2 | Byte stability is sacred | fixed JSON key order, sorted arrays, fixed whitespace |
| U3 | Volatile content to the tail | timestamps / ids / round labels / absolute paths before the static zone are cache killers |
| U4 | Breakpoint surface is limited | explicit breakpoints exist (Anthropic ≤4, Gemini cachedContent), but through a harness CLI the **harness places them** |
| U5 | Hit rate is a first-class metric | instrument reads; treat a hit-rate regression like an incident |
| U6 | Write economics | writes cost; design static zones for ≥ 2 reuse |

## 2. Engine contract (C1–C7)

| # | Contract |
|---|---|
| C1 | Assembly order fixed — `[## Instructions + ## Handoff (slot-free shell)] → [## Return (frozen constant)] → [## Round context (single dynamic zone)]`; the dynamic zone is always final, and the shell embeds zero slots by construction (`## Return` = the byte constant `RETURN_PROSE`) |
| C2 | Shell/clause structure single-sourced — byte-identity cannot drift by construction |
| C3 | Deterministic serialization — canonical key order, fixed whitespace, no env-dependent reordering |
| C4 | Re-dispatch byte reuse — the shell + `## Return` memoize per (family × return format); byte-identical re-dispatches hit the frozen frame with zero re-render, and only `## Round context` re-renders |
| C5 | Dispatch-set constancy — same (harness, op, type) keeps a byte-identical `{ cli, invoke-arg, cwd, env }`; the engine never decides `model` |
| C6 | Write economy — thinnest static zone that serves reuse; never grow the prefix for content nobody reuses |
| C7 | Per-harness observation — observable harnesses assert "consecutive same-type rounds read tokens > 0"; unobservable or below-threshold ones are marked "not measured" |
