# Diagrams

Checked, standalone diagrams of the repository, in English and Chinese.

Open [`index.html`](index.html) for the language switcher; each diagram also opens directly:

| Diagram | English | 中文 |
|---|---|---|
| Architecture | [`architecture.en.html`](architecture.en.html) | [`architecture.zh-CN.html`](architecture.zh-CN.html) |
| Developer & engine journey | [`journey.en.html`](journey.en.html) | [`journey.zh-CN.html`](journey.zh-CN.html) |
| NEXT-loop — round judgment & the next hop | [`next-loop.en.html`](next-loop.en.html) | [`next-loop.zh-CN.html`](next-loop.zh-CN.html) |

The editable sources live in [`src/`](src/). Each `.json` is an Archify candidate and every artifact beside it is **generated** — change the source JSON, never the HTML. Daily regeneration is the repository's own emit, which renders all six artifacts in one batch:

```bash
pnpm run emit
```

`pnpm run emit:check` is the gate: it names the artifact whose bytes drifted, and it also flags an artifact whose source is gone.

### The manual full gate

When you want Archify's own validate / deliver / check / browser-check passes as well — a one-off rather than the daily path — run `finalize` for the source you touched:

```bash
pnpm exec archify finalize architecture docs/diagrams/src/architecture.en.json docs/diagrams/architecture.en.html --repo-root . --quality showcase --out-dir tmp/archify-gate --json
```

Repeat for `journey.*` (type `workflow`) and `next-loop.*` (type `lifecycle`). `--repo-root .` verifies every source citation against the pinned repository revision. `--out-dir` relocates that run's receipts and browser-check evidence into the named directory (`tmp/` is gitignored), so the artifact directory stays clean — the HTML itself still lands where the third argument points; remove the directory when done. The browser check drives a **host Chrome** over CDP, so this path needs one installed; the daily `pnpm run emit` does not, because it calls Archify's `render` alone.

The viewer's own theme toggle, motion, search and export controls are part of each artifact. The language switcher on `index.html` swaps between the two artifacts of the selected diagram.

Gate receipts (`*.finalize*.json`, `*.browser-check.json`, `*.delivery.json`) are machine evidence for that run: the artifact-adjacent paths are gitignored, `--out-dir` keeps them out of the artifact directory entirely, and none of them is ever committed or hand-edited.
