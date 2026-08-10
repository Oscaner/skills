# Cursor plugin wrappers (`cursor-plugins/`)

## Why this directory exists

Some plugins in the oscaner marketplace **do not** ship an upstream `.cursor-plugin/plugin.json`. For those plugins, oscaner **generates** a thin wrapper manifest under `cursor-plugins/<name>/.cursor-plugin/plugin.json` from fields in `marketplace/source.json` (`displayName`, `skills`, optional `hooks`).

Plugins that **already** have a Cursor manifest at their content root use **plugin-root** mode instead — no wrapper directory here.

See also [marketplace/README.md](../marketplace/README.md) for the edit/emit workflow.

## Hybrid emit rule

```
contentRoot/.cursor-plugin/plugin.json exists?
  YES → marketplace/source.json: { "cursor": { "emitMode": "plugin-root" } }
        Cursor Team Marketplace source → ./<contentRoot>
        Do NOT generate cursor-plugins/<name>/
  NO  → marketplace/source.json: cursor.displayName + cursor.skills (+ hooks?)
        emit → cursor-plugins/<name>/.cursor-plugin/plugin.json
        Cursor Team Marketplace source → cursor-plugins/<name>
```

After changing `source.json`, always run:

```bash
pnpm run emit && pnpm run validate
```

## Current plugin status

| Plugin | Mode | Notes |
|--------|------|-------|
| superpowers-overrides | plugin-root | pack — oscaner-generated manifest at plugin root |
| superpowers | plugin-root | pack-sp — upstream submodule manifest |
| mattpocock-skills | wrapper | no upstream `.cursor-plugin` |
| impeccable | wrapper | no upstream `.cursor-plugin` |
| os-engineering | wrapper | emit-generated wrapper; skills placeholder (`.keep`), skills land in later P1 tasks |

## Upgrade checklist (wrapper → plugin-root)

When upstream adds `.cursor-plugin/plugin.json` to a plugin's content root:

1. Verify `<contentRoot>/.cursor-plugin/plugin.json` exists and `skills` / `hooks` paths resolve relative to contentRoot.
2. Set `marketplace/source.json` → `"cursor": { "emitMode": "plugin-root" }` for that plugin.
3. Remove `cursor.displayName`, `cursor.skills`, `cursor.hooks` from that plugin entry.
4. Delete `cursor-plugins/<name>/` if it exists.
5. Run `pnpm run emit && pnpm run validate`.
6. Ask Cursor users to refresh the Team Marketplace.
7. Update this status table and [marketplace/README.md](../marketplace/README.md).
