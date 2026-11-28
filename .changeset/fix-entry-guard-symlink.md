---
"@oscaner-skills/cdd-engine": patch
---

Fix the entry guard so the published `cdd` bin actually runs.

A package bin is installed as a symlink — `node_modules/.bin/cdd` → `dist/bin.js` — so
`process.argv[1]` is the link while `import.meta.url` is its target. The guard compared
`path.resolve` of the two, answered "not the entry" for every consumer invocation, and the
process exited 0 having printed nothing at all. 4.21.0 shipped with that: `npx cdd-engine`
and `./node_modules/.bin/cdd` were both silent no-ops.

The question is now answered on resolved paths (`realpathSync` on both sides), so the link
and its target are the same entry.

`check:dist-smoke` grew the arm that would have caught it: it runs the built entry twice —
directly and through a symlink — and asserts both print the same non-empty skeleton. Exit
code alone was the reason the old arm stayed green while doing nothing.
