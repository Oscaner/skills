"""Load harness manifest metadata from package.json and .claude-plugin."""
from __future__ import annotations

import json
from pathlib import Path

EXPECTED_NAME = "superpowers-overrides"
DISPLAY_NAME = "Superpowers Overrides"


def repo_root_from_plugin(plugin_root: Path) -> Path:
    return plugin_root.parent.parent


def load_harness_metadata(plugin_root: Path) -> dict:
    claude_path = plugin_root / ".claude-plugin" / "plugin.json"
    pkg_path = plugin_root / "package.json"
    claude = json.loads(claude_path.read_text())
    pkg = json.loads(pkg_path.read_text())

    name = claude.get("name")
    if name != EXPECTED_NAME:
        raise ValueError(f".claude-plugin name must be {EXPECTED_NAME!r}, got {name!r}")
    if pkg.get("name") != name:
        raise ValueError(
            f"package.json name {pkg.get('name')!r} != .claude-plugin name {name!r}"
        )

    for field in ("version", "description", "author", "license"):
        if field not in pkg or pkg[field] in (None, ""):
            raise ValueError(f"package.json missing {field}")

    source_path = repo_root_from_plugin(plugin_root) / "marketplace" / "source.json"
    source = json.loads(source_path.read_text())
    overrides = next(p for p in source["plugins"] if p["name"] == EXPECTED_NAME)
    if pkg["description"] != overrides["description"]:
        raise ValueError(
            "package.json description must match marketplace/source.json overrides.description"
        )

    return {
        "name": name,
        "version": pkg["version"],
        "description": pkg["description"],
        "author": pkg["author"],
        "license": pkg["license"],
        "displayName": DISPLAY_NAME,
    }
