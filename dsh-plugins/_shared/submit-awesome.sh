#!/usr/bin/env bash
# Submit the next batch of plugins to the awesome list.
#
# Three constraints, all from contributing.md:
#   - a repository must be at least 1 day old (checked by their CI)
#   - one PR per plugin: the PR adds exactly one file, data/plugins/<owner>__<repo>.yml
#   - the description must be the same text the repository's package.json carries
#
# The daily cap of three is applied here rather than discovered by having a
# submission bounced. Re-running is safe: a plugin already submitted is skipped.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
export HTTP_PROXY=http://127.0.0.1:16006
export HTTPS_PROXY=$HTTP_PROXY

UPSTREAM=awesome-dsh-plugin/awesome-dsh-plugin
FORK=173787247/awesome-dsh-plugin
OWNER=173787247
PER_DAY=${PER_DAY:-3}
WORK=${WORK:-/tmp/awesome-submit}

PLUGINS=(dsh-wsl-uia dsh-wsl-wininput dsh-wsl-winshot dsh-wsl-winctl
         dsh-wsl-perf dsh-wsl-service dsh-wsl-eventlog dsh-wsl-registry
         dsh-wsl-defender dsh-wsl-power)

# ── which are already on the list ───────────────────────────────────────────
head=$(gh api "repos/$UPSTREAM/commits/main" --jq .sha)
gh api "repos/$UPSTREAM/git/trees/$head?recursive=1" \
  --jq '.tree[].path' 2>/dev/null | grep '^data/plugins/' > "$WORK.listed" || true

submitted=0
for p in "${PLUGINS[@]}"; do
  [ "$submitted" -ge "$PER_DAY" ] && break

  # already listed?
  if grep -q "${OWNER}__${p}\.yml" "$WORK.listed" 2>/dev/null; then
    echo "  = already listed  $p"
    continue
  fi

  # old enough? (their CI checks this, so there is no point opening early)
  created=$(gh api "repos/$OWNER/$p" --jq .created_at)
  age_h=$(( ( $(date +%s) - $(date -d "$created" +%s) ) / 3600 ))
  if [ "$age_h" -lt 24 ]; then
    echo "  · too young (${age_h}h)  $p"
    continue
  fi

  # the entry text must equal the package description, verbatim
  desc=$(gh api "repos/$OWNER/$p/contents/package.json" --jq .content \
    | base64 -d | python3 -c 'import json,sys; print(json.load(sys.stdin)["description"])')
  # a description containing ": " must be quoted or YAML reads it as a nested key
  case "$desc" in *": "*) desc="'${desc//\'/\'\'}'" ;; esac

  file="data/plugins/${OWNER}__${p}.yml"
  cat > "$WORK.yml" <<EOF
url: https://github.com/${OWNER}/${p}
name: ${OWNER}/${p}
category: wsl
description:
  en: ${desc}
EOF

  # branch off an up-to-date main, add exactly one file, open one PR
  gh repo sync "$FORK" --source "$UPSTREAM" --branch main >/dev/null 2>&1 || true
  gh api "repos/$FORK/git/refs" -f ref="refs/heads/submit-${p}" \
    -f sha="$head" >/dev/null 2>&1 || true

  blob=$(gh api "repos/$FORK/git/blobs" -f content="$(cat "$WORK.yml")" -f encoding=utf-8 --jq .sha)
  base=$(gh api "repos/$FORK/git/commits/submit-${p}" --jq .sha 2>/dev/null || echo "$head")
  tree=$(gh api "repos/$FORK/git/trees" -f base_tree="$base" \
    -f "tree[][path]=$file" -f "tree[][mode]=100644" \
    -f "tree[][type]=blob" -f "tree[][sha]=$blob" --jq .sha)
  commit=$(gh api "repos/$FORK/git/commits" -f message="Add ${OWNER}/${p}" \
    -f tree="$tree" -f parents[]="$head" --jq .sha)
  gh api -X PATCH "repos/$FORK/git/refs/heads/submit-${p}" -f sha="$commit" >/dev/null

  gh pr create --repo "$UPSTREAM" \
    --head "${FORK%%/*}:submit-${p}" --base main \
    --title "Add ${OWNER}/${p}" \
    --body "Adds one entry: \`${file}\`.

https://github.com/${OWNER}/${p} — ${desc}

\`package.json\` declares \`dsh.bundle.patch\` pointing at \`cordis.patch.yml\`, so the
plugin installs with \`dsh plugin add\`. Category \`wsl\`: it bridges to a Windows
host from WSL." 2>&1 | tail -1

  echo "  ✓ submitted  $p  (age ${age_h}h)"
  submitted=$((submitted + 1))
done

echo
echo "  submitted this run: $submitted / $PER_DAY"
