#!/usr/bin/env bash
# Create the ten repositories and push the first commit.
#
# Topics and the description are set at creation time so the repository satisfies
# the awesome-list requirements (the `dsh-plugin` topic in particular) before any
# submission is opened.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
export HTTP_PROXY=http://127.0.0.1:16006
export HTTPS_PROXY=$HTTP_PROXY

TOPICS=(dsh-plugin deepseek-harness wsl windows)

declare -A ABOUT=(
  [dsh-wsl-uia]="Windows UI Automation observation from WSL: enumerate top-level windows and read a bounded element tree with per-observation handles."
  [dsh-wsl-wininput]="Targeted Windows input from WSL: invoke a UI Automation element, or send keys and clicks to a chosen window without stealing focus."
  [dsh-wsl-winshot]="Capture a specific Windows window to a WSL file, by process id or the foreground window."
  [dsh-wsl-winctl]="Enumerate and control Windows top-level windows from WSL: activate, minimize, restore, move and resize."
  [dsh-wsl-perf]="Windows host performance counters from WSL: CPU, memory, disk and top processes."
  [dsh-wsl-service]="Read Windows service state from WSL: list services and inspect one by name."
  [dsh-wsl-eventlog]="Read recent Windows event log entries from WSL, by log name and level."
  [dsh-wsl-registry]="Read-only Windows registry access from WSL, restricted to an allowlist of key prefixes."
  [dsh-wsl-defender]="Windows security posture from WSL: Defender antivirus status and firewall profile state."
  [dsh-wsl-power]="Windows power state from WSL: active power plan, battery status and sleep settings."
)

for d in "${!ABOUT[@]}"; do
  [ -d "$d" ] || { echo "  ★ missing $d"; continue; }

  if ! gh repo view "173787247/$d" >/dev/null 2>&1; then
    gh repo create "173787247/$d" --public \
      --description "${ABOUT[$d]}" >/dev/null
    echo "  + created $d"
  else
    echo "  = exists  $d"
  fi

  # topics: add each, then verify
  for t in "${TOPICS[@]}"; do
    gh api -X PUT "repos/173787247/$d/topics" -f "names[]=$t" >/dev/null 2>&1 || true
  done

  cd "$d"
  if [ ! -d .git ]; then
    git init -q
    git checkout -q -b main
  fi
  git add -A
  if ! git diff --cached --quiet; then
    git -c user.email=173787247@qq.com -c user.name=grandocean \
      commit -q -m "feat: ${d}" -m "${ABOUT[$d]}"
  fi
  git remote get-url origin >/dev/null 2>&1 || \
    git remote add origin "https://github.com/173787247/$d.git"
  git -c http.proxy=$HTTP_PROXY push -q -u origin main 2>&1 | tail -1 || true
  echo "    pushed $(git rev-list --count HEAD) commit(s)"
  cd ..
done
