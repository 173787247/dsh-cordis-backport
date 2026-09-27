#!/usr/bin/env bash
# Bring repository metadata in line with what each project actually is.
#
#   about  — taken from the published awesome-list entry where one exists, since
#            that wording has already been reviewed against the code.
#   topics — one PUT carrying the whole set; the topics API replaces rather than
#            appends, so adding them one at a time leaves only the last.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
export HTTP_PROXY=http://127.0.0.1:16006
export HTTPS_PROXY=$HTTP_PROXY

AWESOME=173787247
TMP=$(mktemp -d)

# ── 1. real descriptions, from the published entries ────────────────────────
for r in dsh-wsl-cal dsh-wsl-compose dsh-wsl-db dsh-wsl-git dsh-wsl-glab \
         dsh-wsl-helm dsh-wsl-k8s dsh-wsl-llamacpp dsh-wsl-mail dsh-wsl-media \
         dsh-wsl-ollama dsh-wsl-pkg dsh-wsl-playwright dsh-wsl-rclone \
         dsh-wsl-search dsh-wsl-struct dsh-wsl-systemd dsh-wsl-terraform \
         dsh-wsl-tmux dsh-wsl-vecmem dsh-wsl-vllm; do
  body=$(curl -sS -x "$HTTP_PROXY" -m 30 \
    "https://raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/main/data/plugins/${AWESOME}__${r}.yml" 2>/dev/null || true)
  # `en: 'text'` or `en: text` — take everything after the colon on that line
  desc=$(printf '%s\n' "$body" | sed -n 's/^  en: //p' | head -1 \
         | sed "s/^'//; s/'$//; s/''/'/g")
  if [ -z "$desc" ]; then
    echo "  ? no published entry for $r — leaving about alone"
    continue
  fi
  gh repo edit "173787247/$r" --description "$desc" >/dev/null && echo "  ✓ about  $r"
done

# ── 2. topics ───────────────────────────────────────────────────────────────
# dsh-wsl-common is a shared library, not an installable plugin: it gets the two
# discovery topics but not `dsh-plugin`, because claiming plugin status for a
# package that declares no bundle manifest is exactly what the listing review
# checks for.
for r in dsh-device-bridge dsh-mac-companion dsh-remote-ssh dsh-wsl-clock \
         dsh-wsl-dns dsh-wsl-docker dsh-wsl-download dsh-wsl-editor \
         dsh-wsl-encoding dsh-wsl-expose dsh-wsl-hostsvc dsh-wsl-mnt \
         dsh-wsl-picker dsh-wsl-shot dsh-wsl-ssh-agent dsh-wsl-tray \
         dsh-wsl-workspace dsh-wsl-wslconfig; do
  gh api -X PUT "repos/173787247/$r/topics" \
    -f "names[]=dsh-plugin" -f "names[]=deepseek-harness" -f "names[]=wsl" >/dev/null \
    && echo "  ✓ topics $r"
done

gh api -X PUT "repos/173787247/dsh-wsl-common/topics" \
  -f "names[]=deepseek-harness" -f "names[]=wsl" >/dev/null \
  && echo "  ✓ topics dsh-wsl-common (library — no dsh-plugin)"
