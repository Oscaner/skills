#!/usr/bin/env python3
"""Rewrite SKILL.md frontmatter for flat-namespace Cursor output."""
import argparse
import re
import sys


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--slug", required=True)
    p.add_argument("--overrides", required=True)
    args = p.parse_args()
    flat_name = f"{args.slug}-overrides"
    text = sys.stdin.read()
    m = re.match(r"(?s)^---\n(.*?)\n---\n(.*)$", text)
    if not m:
        sys.exit("ERROR: no YAML frontmatter found")
    fm, body = m.group(1), m.group(2)
    fm = re.sub(r"^name:\s*.+$", f"name: {flat_name}", fm, flags=re.M)
    prefix = (
        f"MUST run BEFORE {args.overrides} as your FIRST tool call this turn — "
        f"Requires upstream superpowers plugin installed. "
        f"Cursor flat-namespace override (canonical slug: {args.slug}). "
    )
    fm = re.sub(
        r"^description:\s*(.+)$",
        lambda mo: f"description: {prefix}{mo.group(1).strip()}",
        fm,
        count=1,
        flags=re.M,
    )
    sys.stdout.write(f"---\n{fm}\n---\n{body}")


if __name__ == "__main__":
    main()
