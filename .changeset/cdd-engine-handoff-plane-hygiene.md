---
"@oscaner-skills/cdd-engine": minor
---

feat: engine handoff-plane hygiene — facet-typed carriers, claim→pin gating, draft whitelist, declaration-derived value parsing, and the split composition root.

- **Facet-typed handoff carriers** — handoff carriers are now shaped per face: a `work` carrier is built without a `findings` key (compile-time refusal — `CarrierOf<F>` derives the field set from the declared schema properties), while a `findings` carrier keeps `findings` required. The work read/write paths no longer touch `findings`, so a persisted work carrier is guaranteed `findings`-free end to end (dry-run dispatch → finalized carrier JSON carries zero `findings` key).
- **Claim→pin lint + handoff-plane audit** — the guard suite now lints every claimed `path:line` pin in plan/spec claims (the referenced file must exist and carry test-assertion literals) and audits the handoff writable subset against the declarations: role-exclusive faces and the prompt-facing schema fence derive from one source. Both run inside `pnpm run validate` and precommit.
- **Draft-shell whitelist** — the work and findings draft instruction shells each carry a single-sentence directive that defers to the injected `## Handoff schema` (no hand-enumerated field lists, no stray key literals), so a child draft's top-level fields come from the schema declaration alone.
- **Declaration-derived value parsing** — value-domain parsing is unified behind a generic `parseArg` executor driven by the declared `VALUE_SHAPES` rule table; the hand-written per-method `#parse*` replicas are gone. Error bytes and exit codes are byte-identical (pinned).
- **Split composition root** — the `Cli` composition root is split into lifecycle / gate / artifacts facets, cutting the monolith's per-method assignment surface without changing any public CLI surface, help/usage/error bytes, command tree, or value-domain behavior.
- **Wave gate plan-revision awareness** — a wave review records the reviewed plan revision; when the plan file drifts after review, an open wave holding a pending fix re-opens at `review` on the current revision (findings regenerate against the revised plan), while an unchanged revision with a pending fix still blocks (anti-spin preserved). The gate takes no new parameters — the plan path derives from the wave's recorded review.
