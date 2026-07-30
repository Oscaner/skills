"""Parse overrides.manifest.json targets for generators."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Target:
    name: str
    overrides: str
    source: str
    upstream_slug: str


def load_plugin_version(plugin_root: Path) -> str:
    plugin_json = plugin_root / ".claude-plugin" / "plugin.json"
    data = json.loads(plugin_json.read_text())
    version = data.get("version")
    if not version:
        raise ValueError(f"missing version in {plugin_json}")
    return version


def load_targets(plugin_root: Path) -> list[Target]:
    manifest_path = plugin_root / "overrides.manifest.json"
    data = json.loads(manifest_path.read_text())
    targets: list[Target] = []
    for row in data["targets"]:
        plugin, upstream_slug = row["overrides"].split(":", 1)
        if plugin != "superpowers":
            raise ValueError(f"expected superpowers: prefix, got {row['overrides']!r}")
        name = row["name"]
        if not name.startswith("spor-"):
            raise ValueError(f"name must start with spor-, got {name!r}")
        targets.append(
            Target(
                name=name,
                overrides=row["overrides"],
                source=row["source"],
                upstream_slug=upstream_slug,
            )
        )
    return targets
