#!/usr/bin/env bash
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-Oscaner/skills}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

apply_ruleset() {
  local name="$1" file="$2"
  local id
  id="$(gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name==\"${name}\") | .id" | head -1)"
  if [ -n "$id" ]; then
    echo "Ruleset ${name} already exists (${id}) — delete and recreate, or PATCH manually"
    echo "  gh api repos/${REPO}/rulesets/${id} -X DELETE"
    echo "  gh api repos/${REPO}/rulesets -X POST --input ${file}"
    exit 1
  else
    gh api "repos/${REPO}/rulesets" -X POST --input "$file"
    echo "Created ruleset ${name}"
  fi
}

apply_ruleset protect-develop "${SCRIPT_DIR}/gh-branch-rulesets/develop.json"
apply_ruleset protect-main "${SCRIPT_DIR}/gh-branch-rulesets/main.json"
