import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent.parent


def load(p: str) -> dict:
    return json.loads((ROOT / p).read_text())


def test_cursor_manifest():
    m = load(".cursor-plugin/plugin.json")
    assert m["name"] == "superpowers-overrides"
    assert m["displayName"] == "Superpowers Overrides"
    assert m["skills"] == "./skills/"
    assert m["hooks"] == "./hooks/hooks-cursor.json"
    assert "_generated" in m
    assert (ROOT / m["skills"]).is_dir()
    assert (ROOT / m["hooks"]).is_file()


def test_codex_manifest_minimal():
    m = load(".codex-plugin/plugin.json")
    assert m["name"] == "superpowers-overrides"
    assert m["skills"] == "./skills/"
    assert m["hooks"] == {}
    assert "interface" not in m
    assert "repository" not in m
    assert "_generated" in m


def test_metadata_matches_package_json():
    pkg = load("package.json")
    cursor = load(".cursor-plugin/plugin.json")
    codex = load(".codex-plugin/plugin.json")
    for m in (cursor, codex):
        assert m["version"] == pkg["version"]
        assert m["description"] == pkg["description"]
        assert m["author"] == pkg["author"]
        assert m["license"] == pkg["license"]


def test_description_matches_marketplace_source():
    source = json.loads((REPO / "marketplace/source.json").read_text())
    overrides = next(p for p in source["plugins"] if p["name"] == "superpowers-overrides")
    pkg = load("package.json")
    assert pkg["description"] == overrides["description"]


if __name__ == "__main__":
    test_cursor_manifest()
    test_codex_manifest_minimal()
    test_metadata_matches_package_json()
    test_description_matches_marketplace_source()
    print("OK")
