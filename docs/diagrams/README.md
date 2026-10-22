# Diagrams

Checked, standalone diagrams of the repository, in English and Chinese.

Open [`index.html`](index.html) for the language switcher; each diagram also opens directly:

| Diagram | English | 中文 |
|---|---|---|
| Architecture | [`architecture.en.html`](architecture.en.html) | [`architecture.zh-CN.html`](architecture.zh-CN.html) |
| Developer & engine journey | [`journey.en.html`](journey.en.html) | [`journey.zh-CN.html`](journey.zh-CN.html) |
| NEXT-loop — findings judgment | [`next-loop.en.html`](next-loop.en.html) | [`next-loop.zh-CN.html`](next-loop.zh-CN.html) |

The editable sources live in [`src/`](src/). Each `.json` is an Archify candidate; regenerate an artifact with the Archify CLI from the repository root:

```bash
node <archify>/bin/archify.mjs finalize architecture docs/diagrams/src/architecture.en.json docs/diagrams/architecture.en.html --repo-root . --quality showcase --json
```

Repeat for `journey.*` (type `workflow`) and `next-loop.*` (type `lifecycle`). The `--repo-root .` flag verifies every source citation against the pinned repository revision. Do not hand-edit the generated HTML: change the source JSON and regenerate.

The viewer's own theme toggle, motion, search and export controls are part of each artifact. The language switcher on `index.html` swaps between the two artifacts of the selected diagram.