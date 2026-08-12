"""Parse overrides.manifest.json targets for generators."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Target:
    name: str
    overrides: str
    source: str | None
    upstream_slug: str

    @property
    def plugin(self) -> str:
        """Target plugin from the qualified name (e.g. os-engineering)."""
        return self.name.split(":", 1)[0]

    @property
    def skill(self) -> str:
        """Target skill from the qualified name (e.g. os-brainstorming)."""
        return self.name.split(":", 1)[1]


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
        if ":" not in name:
            raise ValueError(f"name must be plugin-qualified (plugin:skill), got {name!r}")
        targets.append(
            Target(
                name=name,
                overrides=row["overrides"],
                source=row.get("source"),
                upstream_slug=upstream_slug,
            )
        )
    return targets


def target_skill_suffix(t: Target) -> str:
    """Repo-relative SKILL.md suffix for the target's own skill body.

    os-engineering targets carry a cross-plugin ``source``; submodule targets
    (mattpocock-skills:tdd) have ``source: null`` and are derived from the
    qualified name (mattpocock nests skills under ``skills/engineering/``).
    """
    if t.source:
        src = t.source
        if src.startswith("./"):
            src = src[2:]
        return f"{src}/SKILL.md" if not src.endswith(".md") else src
    if t.plugin == "mattpocock-skills":
        return f"skills/engineering/{t.skill}/SKILL.md"
    return f"skills/{t.skill}/SKILL.md"
