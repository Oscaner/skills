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


def load_targets(plugin_root: Path) -> list[Target]:
    manifest_path = plugin_root / "overrides.manifest.json"
    data = json.loads(manifest_path.read_text())
    targets: list[Target] = []
    for row in data["targets"]:
        plugin, upstream_slug = row["overrides"].split(":", 1)
        if plugin != "superpowers":
            raise ValueError(f"expected superpowers: prefix, got {row['overrides']!r}")
        name = row["name"]
        if not name.endswith("-overrides"):
            raise ValueError(f"name must end with -overrides, got {name!r}")
        targets.append(
            Target(
                name=name,
                overrides=row["overrides"],
                source=row["source"],
                upstream_slug=upstream_slug,
            )
        )
    return targets
