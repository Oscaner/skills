---
"@oscaner-skills/cdd-engine": minor
---

A dispatch now refuses a round whose declared inputs cannot stand (P38).

Every round-context row declares what it needs and what an absence means, and one pure
read judges the values about to be rendered — before the round exists:

- `ContextLine` replaces the plain layout string: `absent` (`drop` / `none`), `path`
  (the read cells whose value must exist on disk), `preview` (`value` / `satisfied`) and
  `requiredOn` (arms, conjoined per cell) ride the row they guard. `ModePromptRow.serves`
  is each row's real target-type set — the base the dead-cell criterion compares against,
  never the union of that row's own arms.
- `TemplateAssembler#assertDeclarations` judges those declarations once, at construction:
  a shell token no layout carries, a `requiredOn` naming a type the row does not serve, a
  layout slot no round-context token registers, or a registered round-context token that no
  row carries stops the assembler from being built. The post-render `#assertShellLayout`
  check is gone.
- `dispatch-input` is the new pre-dispatch gate. It reads the values, the two DECLARED
  scene cells (`program:` / `doc-type:` — never the resolved links, so a broken chain
  cannot read as an absence) and, for `path: true` cells only, the file system. It answers
  one `CDD_BLOCKED: dispatch-input · <row> · <TOKEN> · <reason>` line listing every
  offending cell, `; `-joined. The reason set is closed: `empty-value` ·
  `target-absent`. A refusal spawns no child, books no cycle and leaves no in-flight
  record.
- Four behaviours reverse, all named: a declared `program:` whose charter does not resolve
  is `target-absent`; a fix round whose review carrier is empty, or whose composed family
  name is not on disk, is `empty-value` / `target-absent`; `INPUT_RULINGS` renders the bare
  word `none` instead of dropping its line, and the fix and docs-fix shells say so in one
  half-sentence; a tree review with no `base.json` is `BASE_BRANCH · empty-value` (recover
  with `cdd base set`) instead of silently reviewing the working tree. Every other cell
  renders the bytes it rendered before.
- `--dry-run` asks the same judgment by name and prints the first refusal the real run
  would print, in the same order — carrier integrity, then dispatch input, then artifact
  identity. The one exception is the brief the preview does not write: `preview:
  satisfied` answers that cell from its naming line, without an existence read or a write.
- Every dispatch shell now carries the scratch discipline: round-local scratch goes under
  the round context's `WORKSPACE_DIR` in `scratch/<round-id>/`, never the workspace root,
  and nothing there is evidence. `TEMPLATE_PROMPT.$version` is 25.

The CDD methodology itself is unchanged — this is a consumer-visible change in rendered
bytes and in what a dispatch accepts, which is a `minor` under D74.
