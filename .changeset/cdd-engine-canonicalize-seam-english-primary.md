---
"@oscaner-skills/cdd-engine": minor
---

The translation recognition face lands wired into the structure plane, and the first-generation osuperpowers program's literals are cleaned up:

1. **`Translator.canonicalize` recognition face** — a new pure recognition method maps registered Chinese alias spans to English canonical tokens (longest-match, non-overlapping span replacement — `组件` → `group件`, the trailing unregistered prose untouched; unregistered lines pass through byte-identical). The legacy single-token `normalize` face folds into it (a single-token check is `canonicalize` on a single-token line) and is removed; the translator's header comment recognizes the unified face.
2. **Charter word rows** — `charter.group-leaf` (`组` → `group`) and `charter.upstream-endorsements` (`上游先例背书` → `Upstream Endorsements`) join the word-table locale rows — the single home of Chinese aliases, zero code branches.
3. **Structure-plane seam** — `Contract.validate` canonicalizes every line once at the row source; the presence / domain / section-scoped / crosslink value-pattern judges match the normalized view (a matching view, never written back — documents stay byte-identical). The declare anchor registry turns English-primary (`#### [MFRBEN] group` · `#### Upstream Endorsements`), with matching preserved for the live doc-arch overall.
4. **osuperpowers literal cleanup** — the superseded osuperpowers program's 13-document spec/plan family is deleted, the `charter.goal-title` word row is retired, and the Goal facet returns to the pure `^### Goal` pattern. The live tree is 3 overalls, all green through the seam; the machine-recognizable faces (declare elements / schema descriptions / DOC_TOKENS) carry zero Chinese.
