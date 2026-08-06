#!/usr/bin/env bash
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-Oscaner/skills}"

git fetch --tags origin
tags=()
while IFS= read -r t; do tags+=("$t"); done < <(
  git tag -l 'superpowers-overrides@*' | grep -Ee '-overrides\.[0-9]+$' || true
)

if [ ${#tags[@]} -eq 0 ]; then
  echo "No legacy single-counter tags found."
  exit 0
fi

for tag in "${tags[@]}"; do
  echo "Deleting ${tag}..."
  gh release delete "$tag" -y --repo "$REPO" 2>/dev/null || true
  gh api -X DELETE "repos/${REPO}/git/refs/tags/${tag}" || git push origin ":refs/tags/${tag}"
done

echo "Done. Removed ${#tags[@]} legacy tag(s)."
