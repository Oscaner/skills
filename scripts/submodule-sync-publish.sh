#!/usr/bin/env bash
set -euo pipefail
NAME="$1"
BRANCH="chore/bump-${NAME}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

DRY=$(node scripts/bump-submodule.mjs "$NAME" --dry-run)
read -r UPDATED NEW_TAG OLD_LABEL < <(
  echo "$DRY" | node -e "
const j = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log([j.updated, j.newTag ?? '', j.oldTag ?? j.oldPinSha ?? ''].join('\t'));
"
)

if [[ "$UPDATED" != "true" ]]; then
  echo "skip $NAME"
  exit 0
fi

git fetch origin main
git fetch origin "$BRANCH" 2>/dev/null || true
OPEN_PR=$(gh pr list --search "head:${BRANCH} is:open" --json number,body --jq '.[0] // empty')

if [[ -n "$OPEN_PR" ]] && git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  git checkout -B "$BRANCH" "origin/${BRANCH}"
  git merge origin/main --no-edit
else
  git checkout -B "$BRANCH" origin/main
fi

node scripts/bump-submodule.mjs "$NAME"
git add -A
git commit -m "chore: bump ${NAME} submodule"
git push -u origin "$BRANCH"

ISSUE_NUM=""
if [[ -n "$OPEN_PR" ]]; then
  ISSUE_NUM=$(echo "$OPEN_PR" | jq -r '.body' | sed -n 's/.*Tracking Issue: #\([0-9]*\).*/\1/p')
fi
if [[ -z "$ISSUE_NUM" ]]; then
  ISSUES=$(gh issue list --search "Submodule bump: ${NAME} in:title" --state open --json number)
  COUNT=$(echo "$ISSUES" | jq 'length')
  if [[ "$COUNT" -gt 1 ]]; then
    echo "ERROR: ambiguous Issue search for ${NAME}" >&2
    exit 1
  fi
  ISSUE_NUM=$(echo "$ISSUES" | jq -r '.[0].number // empty')
fi
if [[ -z "$ISSUE_NUM" ]]; then
  ISSUE_NUM=$(gh issue create --title "Submodule bump: ${NAME}" --body "Automated submodule sync tracking." --json number --jq '.number')
fi
gh issue comment "$ISSUE_NUM" --body "Updated: ${OLD_LABEL} → ${NEW_TAG}"

ROLLBACK_NOTE=""
if [[ "$NAME" == "mattpocock-skills" ]]; then
  ROLLBACK_NOTE=$'\n\n> **Note:** Pin was not aligned to latest release tag; this PR syncs to `'"${NEW_TAG}"''`.'
fi

if [[ -z "$OPEN_PR" ]]; then
  gh pr create --head "$BRANCH" --base main \
    --title "chore: bump ${NAME} submodule" \
    --body "Tracking Issue: #${ISSUE_NUM}

Automated tag sync.${ROLLBACK_NOTE}" \
    --label submodule-bump --label automated
else
  gh pr comment "$(echo "$OPEN_PR" | jq -r '.number')" --body "Updated pointer: ${OLD_LABEL} → ${NEW_TAG}"
fi
