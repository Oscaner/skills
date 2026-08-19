# Bilingual Content Organization in a Claude Code Plugin Marketplace Repo

Date: 2026-08-18

## 1. How Claude Code Discovers Skills

Claude Code plugin.json supports two forms for the `skills` field:

### Directory form (engineering plugin uses this)
```json
{ "skills": "./skills/" }
```
Claude Code recursively scans the directory for subdirectories containing `SKILL.md`. Each immediate subdirectory with a `SKILL.md` becomes a discoverable skill. The scan is recursive into subdirectories of subdirectories.

### List form (mattpocock-skills uses this)
```json
{ "skills": ["./skills/engineering/tdd", "./skills/productivity/grilling"] }
```
Each entry is an explicit path to a skill directory (containing `SKILL.md`). The harness resolves each path individually. This is how mattpocock-skills organizes skills under category subdirs (`skills/engineering/`, `skills/productivity/`).

**Key difference**: The list form gives explicit control over which skills are discovered and at what paths. The directory form auto-discovers by scanning.

### What happens if skills move to `skills/en/`?

- **Directory form** (`"skills": "./skills/"`): Claude Code would still find skills at `skills/en/os-brainstorming/SKILL.md` — the recursive scan would discover them. However, if you also have `skills/zh-CN/` with duplicate skills, Claude Code would discover BOTH language variants as separate skills, which would be confusing (two skills with similar names/descriptions).

- **List form** (`"skills": [...]`): You'd list only the desired language's paths, e.g. `["./skills/en/os-brainstorming", ...]`. This gives explicit control — you choose which language is the primary discoverable set.

## 2. Emit Tool Scan Depth Limitation

The `emit.mjs` skill scanner (`emitOsEngineering`) only scans **immediate children** of `skills/`:

```javascript
const skillNames = readdirSync(skillsDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(skillsDir, d.name, "SKILL.md")))
  .map(d => d.name)
  .sort();
```

This is used by:
- **GEMINI.md generation** (`geminiMarkdown`): generates `@./skills/{name}/SKILL.md` imports — only immediate children.
- **Skill name list** for manifest generation.

**Impact**: If skills move to `skills/en/os-brainstorming/`, the emit scanner would NOT find them (it only checks `skills/os-brainstorming/SKILL.md`). The GEMINI.md would be empty.

The `.agents/skills/` copy uses `cpSync` recursively, so it WOULD preserve nested structures — but the scanner feeding GEMINI.md and manifest generation would miss them.

### Emit would need modification for `skills/en/` pattern

To support nested language dirs, the emit scanner would need to recurse deeper or the plugin would need to switch to the list form. Neither is currently built in.

## 3. Existing Bilingual Conventions in npm/Plugin Ecosystems

### README pattern
The most common pattern in npm packages is:
```
README.md          (English, primary)
README.zh-CN.md    (Chinese, secondary)
```
or
```
README.md          (English)
docs/README.zh-CN.md
```
GitHub automatically shows language alternatives if the filename matches `README.<lang>.md`.

### docs/ pattern
```
docs/
  en/
  zh-CN/
```
Common in larger projects (Vue.js, Element UI, Ant Design). Less common in plugin repos.

### SKILL.md pattern (Claude Code specific)
Claude Code only looks for `SKILL.md` (no language variant detection). There is no built-in `SKILL.zh-CN.md` discovery mechanism. The skill name comes from the directory name, and the `SKILL.md` content is the skill body.

## 4. Practical Options for Bilingual Skills

### Option A: Single SKILL.md with bilingual content (simplest)

Keep the current flat structure. Each `SKILL.md` contains both English and Chinese sections:

```markdown
---
name: os-brainstorming
description: "EN: Orchestrate brainstorm flow | ZH: 独立 brainstorm 流程编排器"
---

# OS Brainstorming

## English

[English content here]

## 中文

[Chinese content here]
```

**Pros**: Zero structural changes, zero emit changes, works with both directory and list forms.
**Cons**: SKILL.md files get larger; mixed languages in one file.

### Option B: Primary + companion file (moderate)

Keep the current `SKILL.md` as the primary language. Add `SKILL.zh-CN.md` as a companion:

```
skills/
  os-brainstorming/
    SKILL.md          (English, primary)
    SKILL.zh-CN.md    (Chinese, companion)
```

**Pros**: Clean separation, no emit changes needed, `SKILL.md` stays English-only.
**Cons**: Claude Code only auto-discovers `SKILL.md`; the Chinese version is a reference file that must be manually loaded. No auto-switching.

### Option C: List form with language subdirs (explicit control)

Switch to list form in plugin.json:

```json
{
  "skills": [
    "./skills/en/os-brainstorming",
    "./skills/en/os-writing-plans",
    ...
  ]
}
```

Structure:
```
skills/
  en/
    os-brainstorming/SKILL.md
    os-writing-plans/SKILL.md
    ...
  zh-CN/
    os-brainstorming/SKILL.md
    os-writing-plans/SKILL.md
    ...
```

**Pros**: Explicit control, clean separation, can swap primary language by editing the list.
**Cons**: Must switch from directory form to list form (breaking change for emit), every skill must be listed explicitly, GEMINI.md generation needs rework, two copies to maintain.

### Option D: Directory form with language prefix (not recommended)

```
skills/
  os-brainstorming/SKILL.md     (English)
  os-brainstorming.zh-CN/SKILL.md  (Chinese)
```

**Cons**: Ugly naming, Claude Code would discover both as separate skills, confusing descriptions in the skill list.

## 5. What the Plugin Spec Says About `skills` Field

From the mattpocock-skills plugin.json (the most complex example in this repo), the `skills` field accepts:
- A string: `"./skills/"` (directory form)
- An array of strings: `["./skills/engineering/tdd", ...]` (list form)

Both forms point to directories that must contain a `SKILL.md` file. There is no restriction on the path depth — `./skills/en/os-brainstorming` would be valid in the list form.

The Claude Code marketplace schema (`marketplace/source.schema.json`) does not constrain the `skills` field at the source level — it's a per-harness manifest concern. The Claude Code runtime handles the actual discovery.

## 6. Recommendation

**For this repo specifically**, given:

1. The emit tool only scans immediate children of `skills/` (not recursive into nested lang dirs)
2. The directory form is currently used (`"skills": "./skills/"`)
3. The `.agents/skills/` copy is recursive (works either way)
4. GEMINI.md generation depends on the shallow scan

**The most practical approach is Option B: primary + companion file.**

- Keep `skills/<name>/SKILL.md` as the English (or bilingual-primary) content
- Add `skills/<name>/SKILL.zh-CN.md` as a Chinese companion
- No emit changes needed
- No structural changes to plugin.json
- Chinese version is available for manual reference or could be loaded by a custom hook
- The `description` field in frontmatter can be bilingual: `"EN: ... | ZH: ..."`

If full language isolation is needed later (e.g., a user-facing toggle), switching to the list form (Option C) is the clean path — but it requires emit scanner rework and explicit skill listing.

## 7. If You Need Full Bilingual Isolation Later

To support `skills/en/` + `skills/zh-CN/` with the list form:

1. Switch `plugin.json` from `"skills": "./skills/"` to an explicit list
2. Modify `emitOsEngineering` in `scripts/emit.mjs` to generate the list from a config (or scan both lang subdirs)
3. Update `geminiMarkdown` to handle nested paths (prefix with lang dir)
4. Add a language selection mechanism (hook, env var, or user preference)
5. Ensure `pnpm run emit:check` validates both language trees

This is a significant refactor and should only be done if bilingual isolation is a hard requirement.
