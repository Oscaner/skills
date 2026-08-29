# Add-Phase Protocol

Reference for adding a new phase to a multi-phase program inside `osuperpowers:brainstorming`. The overall spec is the single source of truth (SOT); a phase must be registered in the overall before its design is grilled.

## 1. Four-table sync checklist

When `sync-overall` runs, update all four tables in the parent overall spec and then verify consistency:

- **Issue inventory** — append a row per new issue: `| P<new> | [#NNN](url) | one-line summary |`. If an existing issue is merely re-owned, update its Phase column instead of adding a row.
- **Phase inventory** — append a row: `| P<new> | [scope] | [Pending]/link | [Pending]/link | [verifiable acceptance] | [hard block or soft, ref graph] |`. Fill Design spec / plan cells as the phase progresses.
- **Dependency graph** — add the edge(s): `P<pred> -> P<new>` (hard block) and `P<new> -> P<succ>` if successors depend on it. Use `-> (soft)` only for non-blocking ordering convenience.
- **Change history** — append one row: `- vX.Y · YYYY-MM-DD — <reason: user decision + scope boundary>`.

Consistency check (must all hold before `sync-overall` exits):
1. Every `#NNN` referenced by the new phase spec/plan exists in Issue inventory.
2. Every phase referenced by the Dependency graph exists in Phase inventory.
3. Every hard-dependency predecessor of the new phase has **Design spec column = `Done`** (not shipped → hard BLOCKED).

## 2. Anti-pattern (live example, v1.19c)

While writing v1.19c, P10 had only completed its design spec (not yet plan→dev→merge), yet this session parallel-expanded P14's design spec + 3-pass review — violating two disciplines at once:
- **Serial discipline**: started P14 before P10 shipped.
- **Register-before-grill**: grilled P14's design before the P14 phase row was stable in the overall.

Both are exactly the anti-patterns this protocol exists to block. The structural gates (claim-phase → sync-overall → re-explore → grilling) make the violation impossible at the tool level.

## 3. Flow

detect (explore-context probe) → claim-phase (inventory lookup = authority) → [if not registered] sync-overall (four-table sync + consistency check, hard BLOCKED on failure) → re-explore (claim-phase, now registered) → grilling.
