# Add-Phase Protocol

Reference for adding a new phase to a multi-phase program inside `osuperpowers:brainstorming` (claim-phase · sync-overall), inherited by `writing-overall-spec` authoring. The overall spec is the single source of truth (SOT); a phase must be registered in the overall before its design is grilled.

> Register before grill: the design session consumes the registration, not the reverse — a design grilled before its phase row is stable in the overall re-does the flow (§2.6 E31).

## Header

Doc metadata — not an artifact section:

- **Class**: methodology-doc
- **Consumers**: `brainstorming` (claim-phase · sync-overall), inherited by `writing-overall-spec`
- **Skeleton**: `Header` + `Section 0–6` fixed order — `Section 0–4` protocol body (Purpose → Four-table sync → Issue-reference syntax → Anti-pattern → Flow) + `Section 5–6` template tails
- **Canonical**: the overall spec's four tables; enforcement = the mechanical guard `scripts/validate/overall-consistency.ts` (§2.6 A6)
- **Experience**: baked from the P6 design spec §2.6 list, condensed in `docs/maintainers/program-experience.md` (repo-internal pointer, maintainer-side). Citations inline as `§2.6 <item>`

---

## Section 0: Purpose

The protocol is the single mechanism for registering a new phase: every addition, split or re-assignment lands in the overall's four tables first, and that registration is what the design session reads (§2.6 A5 single-root authority · A8 session-call honesty). Its scope is deliberately bounded — issue-registration semantics, not phase drafting; drafting belongs to [phase-spec-template.md](../../writing-phase-spec/docs/phase-spec-template.md).

## Section 1: Four-table sync checklist

When `sync-overall` runs, update all four tables in the parent overall and verify consistency:

- **Issue inventory** — append a row per new issue: `| P<new> | #NNN | one-line summary |`. If an existing issue is merely re-owned, update its Phase column instead of adding a row.
- **Phase inventory** — append a row: `| P<new> | [scope] | [Pending]/link | [Pending]/link | [verifiable acceptance] | [hard or soft, ref graph] |`. Fill Design spec / plan cells as the phase progresses.
- **Dependency graph** — add the edge(s): `P<pred> -> P<new>` (hard block) and `P<new> -> P<succ>` if successors depend on it. Use `-> (soft)` only for non-blocking ordering convenience.
- **Change history** — append one row: `vX.Y · YYYY-MM-DD — <reason: user decision + scope boundary>`.

Consistency check — must all hold before `sync-overall` exits (§2.6 A6 mechanical guard, not intention):

1. Every `#NNN` referenced by the new phase spec / plan exists in the Issue inventory.
2. Every phase referenced by the Dependency graph exists in the Phase inventory.
3. Every hard-dependency predecessor of the new phase has its **Design spec** column = `Done` (not shipped → hard BLOCKED).

Run `pnpm run validate` against the committed baseline (clean-tree prerequisite, §2.6 B12) so the state you register is the state a reviewer reproduces. Numbers you have not counted are the ones you will get wrong — count the rows the guard counts (§2.6 E27).

## Section 2: Issue-reference syntax levels (registration domain)

The mechanical guard scans only **anchored-form** issue references:

- **Anchored form `#NNN#issuecomment-<digits>`** — canonical machine-checkable reference: whenever any document (overall / phase spec / plan) contains an anchor, `#NNN` must be registered in the Issue inventory (a new issue is registered, or `pnpm run validate` exits 1).
- **Bare `#NNN`** — ambiguous token (AC numbers / PR numbers / legacy references share `#`), not machine-disambiguable — membership judged by hand.
- **Issue inventory = the registration domain** — every issue the program touches (owned finding + related/follow-up + pre-consume + re-assign destination) appears in the table.
- **3 trigger scenarios**: ① a new issue discovered during phase execution → declare ownership + add a row; ② pre-consume → add a row + mark pre-consumed + note the actual fixing phase; ③ re-assign → update the Phase column.

The registration domain is the one chip the guard counts (§2.6 A6). Pre-consume exists because ownership and fixing phase are different facts — record both.

## Section 3: Anti-pattern (live example, v1.19c)

While writing v1.19c, P10 had completed only its design spec (not yet plan → dev → merge), yet that session parallel-expanded P14's design spec + 3-pass review — two disciplines violated at once:

- **Serial discipline**: P14 started before P10 shipped.
- **Register-before-grill**: P14's design was grilled before the P14 phase row was stable in the overall.

Both are exactly the anti-patterns this protocol exists to block. The structural gates (claim-phase → sync-overall → re-explore → grilling) make the violation impossible at the tool level — discipline enforced by flow, not by good intentions (§2.6 A6). Keep this example: it is the evidence that sinks the "just this once" argument.

## Section 4: Flow

detect (explore-context probe) → claim-phase (inventory lookup = authority) → [if not registered] sync-overall (four-table sync + consistency check, hard BLOCKED on failure) → re-explore (claim-phase, now registered) → grilling.

Each step is what a single session actually does (§2.6 A8 session-call semantics): `sync-overall` is one write to the overall, `grilling` is one fresh read in a new writing-phase-spec session. No step asserts a sub-session it does not perform; no design is drafted before its registration is stable.

---

## Section 5: Naming & placeholders

Placeholder vocabulary per the D1.4 naming plane (`docs/maintainers/naming-conventions.md`):

| Placeholder | Meaning |
|---|---|
| `P<new>` | the phase being added — same spelling as the Phase inventory id |
| `P<pred>` / `P<succ>` | dependency-graph predecessor / successor nodes |
| `#NNN` · `<digits>` | issue number · comment digits (anchored syntax, machine-checked) |
| `vX.Y` · `YYYY-MM-DD` | version + date of the registration row |

The four-table names — `Issue inventory` / `Phase inventory` / `Dependency graph` / `Change history` — are shared vocabulary between this protocol, the template, and the mechanical guard (§2.6 E34: doc word = code word = guard token). The protocol references those tables by their literal name; templates reference this protocol's sections by name, never by inlined copy.

## Section 6: Change history

Template-level, append-only — the artifact-side registration history is the overall's Change history (overall-spec-template Section 9), not this file.

- 2026-09-18 — D-2 systematization: unified `Header + Section 0–4` family skeleton + `Section 5–6` template tails; registration-domain clause renamed for stable reference (formerly `## 1.5`); §2.6 experience baking.
