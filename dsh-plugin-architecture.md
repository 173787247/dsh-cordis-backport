# DSH 插件全集：分层架构与治理

> 生成时间 2026-09-28
> 数据来源：GitHub API 73 个仓 + profile node_modules 44 个已装包

## 一、三个结构性问题

### 1. 19 个仓建好了但没挂载

仓库存在、代码写完、但没有出现在 `~/.dsh/profiles/web/package.json` 的依赖里，
所以 agent 完全看不到它们。**不是没写完，是没接上。**

未挂载的 19 个：

| 层 | 未挂载 |
|---|---|
| L1 宿主观察 | systemd |
| L2 桌面观察 | playwright |
| L4 文件与检索 | pkg, rclone, tmux |
| L5 文档与媒体 | db |
| L6 模型推理 | llamacpp, vllm |
| L7 远程与协作 | cal, git, glab, mail |
| L8 云与编排 | compose, helm, terraform |
| L10 结构与治理 | kit, common, struct, cordis-backport |

### 2. 12 个核心插件挂在 Windows NTFS 上

```
github:173787247/*   32 个   ✓ 从 GitHub 装
link:/mnt/c/...      12 个   ★ 指向 /mnt/c/Users/rchua/Desktop/AIFullStackDevelopment/
```

**而这 12 个恰好是工具密度最高的**（media 9、obsidian 8、secret 7 …）。
NTFS 上的 node_modules 读写慢，且与它们的 git 仓分离——改代码和跑代码是两个地方。

改用 `github:173787247/<repo>` 即可，和其他 32 个一致。

### 3. 零个发布到 npm

`npm view dsh-wsl-systemd` → 404。全部走 GitHub 直装。
好处是不用维护发布流程；代价是安装需要 GitHub 凭据，且无法锁版本。

## 二、分层


共 **73** 个仓库 · 装入 profile **44** · 未装 **29**

## 分层

| 层 | 名称 | 仓库 | 工具 | 未装 |
|---|---|---:|---:|---:|
| L1 | 宿主观察 | 21 | 13 | 7 |
| L2 | 桌面观察 | 7 | 6 | 3 |
| L3 | 桌面操作 | 8 | 5 | 2 |
| L4 | 文件与检索 | 6 | 5 | 3 |
| L5 | 文档与媒体 | 4 | 21 | 1 |
| L6 | 模型推理 | 4 | 8 | 2 |
| L7 | 远程与协作 | 11 | 16 | 4 |
| L8 | 云与编排 | 4 | 5 | 3 |
| L9 | 密钥 | 1 | 7 | 0 |
| L10 | 结构与治理 | 7 | 1 | 4 |

## L1 · 宿主观察（21 仓 / 13 工具）

> 读 Windows 宿主的状态。全部只读，不改变系统。

- **dsh-wsl-clock** `1` — Detect WSL2 clock drift that breaks TLS and tokens after sleep.
- **dsh-wsl-distro** `1` — DeepSeek Harness plugin: current WSL distro facts and multi-distro warnings.
- **dsh-wsl-dns** `1` — Compare WSL vs Windows DNS resolution for common endpoints.
- **dsh-wsl-docker** `1` — Report Docker Desktop vs WSL docker context confusion.
- **dsh-wsl-encoding** `1` — Diagnose UTF-8 vs Windows code-page issues for cmd/PowerShell.
- **dsh-wsl-expose** `1` — Advise or apply allowlisted Windows portproxy for exposing a WSL port.
- **dsh-wsl-gpu** `1` — DeepSeek Harness tool: probe nvidia-smi / GPU visibility inside WSL.
- **dsh-wsl-hostsvc** `1` — Probe Windows-host services (Ollama, etc.) from WSL and suggest baseURL.
- **dsh-wsl-mnt** `1` — Warn when the workspace lives on slow /mnt/c and suggest a Linux home path.
- **dsh-wsl-net** `1` — DeepSeek Harness Tool: Diagnose WSL/Windows Proxy, Node 24 fetch, and DeepSeek/npm reachability.
- **dsh-wsl-path** `1` — DeepSeek Harness tool: convert WSL Linux and Windows paths with /mnt/c caveats.
- **dsh-wsl-port** `1` — DeepSeek Harness tool: diagnose WSL port listening and Windows localhost forwarding.
- **dsh-wsl-wslconfig** `1` — Read-only advice for .wslconfig memory/mirrored networking.
- **dsh-wsl-defender** · **未装** — Windows security posture from WSL: Defender antivirus status and firewall profile state.
- **dsh-wsl-env** — Inject WSL/Windows path and shell facts into the DeepSeek Harness system prompt.
- **dsh-wsl-eventlog** · **未装** — Read recent Windows event log entries from WSL, by log name and level.
- **dsh-wsl-perf** · **未装** — Windows host performance counters from WSL: CPU, memory, disk and top processes.
- **dsh-wsl-power** · **未装** — Windows power state from WSL: active power plan, battery status and sleep settings.
- **dsh-wsl-registry** · **未装** — Read-only Windows registry access from WSL, restricted to an allowlist of key prefixes.
- **dsh-wsl-service** · **未装** — Read Windows service state from WSL: list services and inspect one by name.
- **dsh-wsl-systemd** · **未装** — Read-only systemd --user list / show / journal.

## L2 · 桌面观察（7 仓 / 6 工具）

> 看得到窗口和控件。computer-use 的知觉层。

- **dsh-wsl-obscura** `3` — DeepSeek Harness tools: drive Obscura headless browser from WSL.
- **dsh-wsl-browser** `1` — DeepSeek Harness tool: open http(s) URLs in the Windows default browser from WSL.
- **dsh-wsl-picker** `1` — Browse WSL directories from / and /mnt drives for workspace picking.
- **dsh-wsl-shot** `1` — Save a Windows clipboard image into a WSL file for multimodal chat.
- **dsh-wsl-playwright** · **未装** — Headless Playwright fetch (title + body text) in WSL.
- **dsh-wsl-uia** · **未装** — Windows UI Automation observation from WSL: enumerate top-level windows and read a bounded element tree with per-observation handles.
- **dsh-wsl-winshot** · **未装** — Capture a specific Windows window to a WSL file, by process id or the foreground window.

## L3 · 桌面操作（8 仓 / 5 工具）

> 改变窗口与输入。computer-use 的运动层。写操作。

- **dsh-wsl-clipboard** `1` — DeepSeek Harness tool: read/write the Windows clipboard from WSL.
- **dsh-wsl-editor** `1` — Open a WSL Linux path in Windows Cursor/VS Code/Notepad.
- **dsh-wsl-launch** `1` — DeepSeek Harness tool: launch allowlisted Windows apps from WSL.
- **dsh-wsl-notify** `1` — DeepSeek Harness tool: Windows MessageBox notification from WSL.
- **dsh-wsl-tray** `1` — Install or report a Windows tray/shortcut launcher for dsh web in WSL.
- **dsh-wsl-open** — DeepSeek Harness plugin: open WSL Linux paths from chat in Windows.
- **dsh-wsl-winctl** · **未装** — Enumerate and control Windows top-level windows from WSL: activate, minimize, restore, move and resize.
- **dsh-wsl-wininput** · **未装** — Targeted Windows input from WSL: invoke a UI Automation element, or send keys and clicks to a chosen window without stealing focus.

## L4 · 文件与检索（6 仓 / 5 工具）

> 在本地找到东西、把东西搬来搬去。

- **dsh-wsl-search** `4` — Sandboxed ripgrep / fd / ast-grep under allowRoots.
- **dsh-wsl-download** `1` — Copy a file from the Windows Downloads folder into the WSL workspace.
- **dsh-wsl-fetch** — Proxy-aware web_fetch for WSL: official web_fetch through Windows HTTP_PROXY instead of a DNS-pinned public IP.
- **dsh-wsl-pkg** · **未装** — Dependency tree summaries: npm / pip / cargo.
- **dsh-wsl-rclone** · **未装** — Read-only rclone listremotes / lsf / about.
- **dsh-wsl-tmux** · **未装** — Read-only tmux list + capture-pane.

## L5 · 文档与媒体（4 仓 / 21 工具）

> 把非文本的东西变成可读的：PDF、音视频、图片、笔记。

- **dsh-wsl-media** `9` — Local media/doc pipeline: ffprobe, extract, thumbnail, PDF, ASR, pandoc, OCR, exif.
- **dsh-wsl-obsidian** `8` — DeepSeek Harness WSL bridge to a Windows Obsidian vault (status/open/read/write/search).
- **dsh-wsl-vecmem** `4` — Tiny local vector memory via Ollama embeddings and ~/.dsh/vecmem.
- **dsh-wsl-db** · **未装** — Read-only psql + redis-cli probes.

## L6 · 模型推理（4 仓 / 8 工具）

> 本地模型。与云端 Flash 并行的第二条推理路径。

- **dsh-wsl-jev** `4` — DeepSeek Harness WSL plugin: TypeSafe Jev / OpenRouter System One (jev_ask / check / rank)
- **dsh-wsl-ollama** `4` — Local Ollama status / list / chat / embed for dsh on WSL.
- **dsh-wsl-llamacpp** · **未装** — OpenAI-compatible client for llama.cpp / Unsloth Desktop (default :8080).
- **dsh-wsl-vllm** · **未装** — OpenAI-compatible vLLM client (default :8000).

## L7 · 远程与协作（11 仓 / 16 工具）

> 跨机器的读写，以及把消息送进送出。

- **dsh-mac-companion** `5` — DeepSeek Harness plugin: dsh-mac-companion
- **dsh-device-bridge** `3` — DeepSeek Harness plugin: dsh-device-bridge
- **dsh-remote-ssh** `3` — DeepSeek Harness plugin: dsh-remote-ssh
- **dsh-wsl-github** `2` — DeepSeek Harness: GitHub App status (open PRs + latest Actions) for WSL agents
- **dsh-wsl-cred** `1` — DeepSeek Harness tool: safe Git credential hints for Windows GCM from WSL.
- **dsh-wsl-im** `1` — dsh plugin: Feishu / WeCom aibot / DingTalk Stream / QQ Gateway bridge into dsh agents (WSL)
- **dsh-wsl-ssh-agent** `1` — Hint how to forward Windows OpenSSH agent into WSL.
- **dsh-wsl-cal** · **未装** — Read-only khal calendar list.
- **dsh-wsl-git** · **未装** — Capped Git status / diff --stat (no full patches).
- **dsh-wsl-glab** · **未装** — Read-only glab MR / issue / ci status.
- **dsh-wsl-mail** · **未装** — Mail list/search via himalaya / notmuch (no send).

## L8 · 云与编排（4 仓 / 5 工具）

> 集群和基础设施。只读为主。

- **dsh-wsl-k8s** `5` — Read-only kubectl get / describe / logs for dsh on WSL.
- **dsh-wsl-compose** · **未装** — Docker Compose ps/logs; up/down double-gated.
- **dsh-wsl-helm** · **未装** — Read-only Helm list / status / history.
- **dsh-wsl-terraform** · **未装** — Terraform/OpenTofu plan summary + state list (never apply).

## L9 · 密钥（1 仓 / 7 工具）

> 取值但不外泄。

- **dsh-wsl-secret** `7` — DeepSeek Harness WSL plugin: read-only pass/age secrets

## L10 · 结构与治理（7 仓 / 1 工具）

> 约束 agent 自己怎么做事，而不是它能碰到什么。

- **dsh-wsl-workspace** `1` — List WSL distros and validate a Linux workspace path for DSH.
- **dsh-cordis-backport** · **未装** — Backports for upstream cordis fixes missing from the DeepSeek Harness vendored line
- **dsh-repeat-stop** — Hard-stop consecutive identical DeepSeek Harness tool calls after a configurable streak.
- **dsh-tool-budget** — Hard-stop DeepSeek Harness tool use after a per-session call budget
- **dsh-wsl-common** · **未装** — Shared WSL/Windows helpers for dsh-wsl plugins
- **dsh-wsl-kit** · **未装** — DeepSeek Harness WSL kit (EN/ZH): docs + install.sh + cordis.patch for Windows browser + WSL agent plugins
- **dsh-wsl-struct** · **未装** — Sandboxed jq / yq / read-only sqlite3.
