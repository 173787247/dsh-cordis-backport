# 设计文档阅读排期

来源与筛选方法见 [`doc-corpus-analysis.md`](doc-corpus-analysis.md)。
语料：`deepseek-ai/deepseek-harness` 的 `.agents/notes/`，共 2412 篇。

**目的不是找上游 bug**（判据已证明那里没有），**是读 DSH 的产品决策**。
每篇按同一模板处理：**它声称什么性质 → 那个性质可断言吗 → 断言它**。

进度记在 `reading-progress.json`，用 `node reading-status.mjs` 查看。

---

## 进程/信号/关闭（4 篇）

- [ ] `2026-08-03-cli-signal-shutdown-escalation`  — 57 行, score 50
- [ ] `2026-08-03-hmr-initial-scan-boot-deadlock` ★  — 43 行, score 16
- [ ] `2026-09-24-exited-holder-lock-takeover`  — 52 行, score 1
- [ ] `2026-09-03-hidden-windows-subprocess-windows`  — 31 行, score -35

## 会话/转录/恢复（6 篇）

- [ ] `2026-09-05-session-reference-spill-reuse`  — 42 行, score 13
- [ ] `2026-08-26-question-drafts-survive-session-switch`  — 41 行, score 11
- [ ] `2026-09-05-session-reference-model-budget`  — 26 行, score 6
- [ ] `2026-08-26-stable-turn-process-order`  — 31 行, score 4
- [ ] `2026-08-20-turn-error-survives-same-turn-retry-history`  — 33 行, score -5
- [ ] `2026-07-29-human-transcript-append-origin`  — 55 行, score -8

## 工具/权限/沙箱（6 篇）

- [ ] `2026-07-31-code-runtime-python-settlement-fixes`  — 153 行, score 48
- [ ] `2026-07-31-fail-loud-releases-the-terminal`  — 61 行, score 26
- [ ] `2026-08-07-ptc-executor-collapse`  — 47 行, score 21
- [ ] `2026-08-18-tool-row-file-open-failure`  — 35 行, score 15
- [ ] `2026-08-29-code-runtime-python-call-backlog-and-binding-metadata-snapshot`  — 72 行, score -5
- [ ] `2026-08-12-fix-pwsh-terminal-overlay-dup`  — 57 行, score -57

## preset/bundle 组合（6 篇）

- [ ] `2026-08-11-preset-authoring-agent-validates-its-own-composition`  — 75 行, score 105
- [ ] `2026-08-10-minimal-preset-owns-rl-composition`  — 41 行, score 54
- [ ] `2026-08-20-plugin-owned-shipped-preset-root`  — 35 行, score 28
- [ ] `2026-08-09-broken-preset-roster-rows`  — 35 行, score 27
- [ ] `2026-08-10-child-agents-join-their-parent-preset`  — 60 行, score 9
- [ ] `2026-08-10-slash-catalog-follows-preset-switch`  — 45 行, score 3

## TUI/Web 交互（12 篇）

- [ ] `2026-08-17-durable-web-queue-recovery`  — 54 行, score 20
- [ ] `2026-07-24-tui-turn-end-stop-reason-notices`  — 29 行, score 15
- [ ] `2026-07-30-tui-adapter-registration-race`  — 31 行, score 11
- [ ] `2026-08-06-host-backed-web-preferences`  — 44 行, score 9
- [ ] `2026-09-04-busy-send-button-follows-enter-setting`  — 36 行, score 9
- [ ] `2026-07-30-web-transcript-log-ordered-projection`  — 80 行, score 8
- [ ] `2026-07-27-tui-step-timing-trails-tool-cards`  — 30 行, score 2
- [ ] `2026-07-28-web-gui-feedback-loop`  — 41 行, score 1
- [ ] `2026-08-06-reader-scroll-attribution-observed-top-ledger`  — 39 行, score -4
- [ ] `2026-07-31-web-stop-preserves-queue`  — 39 行, score -5
- [ ] `2026-09-07-win32-picker-foreground-alt-key`  — 26 行, score -45
- [ ] `2026-08-10-pre-plugin-theme-bootstrap`  — 39 行, score -52

## 其他（18 篇）

- [ ] `2026-07-20-config-hot-reload-resilience` ★  — 43 行, score 109
- [ ] `2026-08-09-filesystem-absence-observation`  — 38 行, score 21
- [ ] `2026-08-24-system-prompt-section-order-ties`  — 29 行, score 18
- [ ] `2026-08-13-oauth-only-providers-withheld`  — 47 行, score 18
- [ ] `2026-09-03-user-owned-goal-pause-activation`  — 36 行, score 14
- [ ] `2026-08-13-bounded-cold-blank-verification`  — 37 行, score 11
- [ ] `2026-08-12-onboarding-reads-every-provider`  — 40 行, score 9
- [ ] `2026-08-02-goal-round-wrapup-message`  — 33 行, score 6
- [ ] `2026-08-06-onboarding-step-owned-takeover-chrome`  — 37 行, score 3
- [ ] `2026-07-24-empty-model-response-is-retryable`  — 38 行, score 2
- [ ] `2026-07-22-pi-ai-transport-truncation-classification`  — 37 行, score 1
- [ ] `2026-08-06-api-key-format-validation`  — 103 行, score -3
- [ ] `2026-08-11-owned-run-finish-reason`  — 35 行, score -5
- [ ] `2026-08-07-cancel-convergence-wake-latch`  — 30 行, score -5
- [ ] `2026-09-05-continuous-client-recovery`  — 38 行, score -5
- [ ] `2026-08-29-windows-atomic-replace-retry`  — 29 行, score -9
- [ ] `2026-09-16-movable-mandatory-update-window`  — 25 行, score -21
- [ ] `2026-09-22-windows-open-through-shell-resolution`  — 44 行, score -39

---

## 分四批

| 批次 | 范围 | 预计 |
|---|---|---|
| **第 1 批** | 进程/信号/关闭 + 会话/转录/恢复 | ~13 篇 |
| **第 2 批** | 工具/权限/沙箱 | ~8 篇 |
| **第 3 批** | preset/bundle 组合 | ~12 篇 |
| **第 4 批** | TUI/Web 交互 + 其他 | ~18 篇 |

**每次读 3~5 篇**，产出写进 `findings/`。批次之间不阻塞。

## 另外单列的一件事

`2026-08-03-hmr-initial-scan-boot-deadlock` **不是阅读任务，是验证任务**：
它陈述了 `EntryGroup.update` 不可重入这条不变量，而我没能复现。
要出结论，先读 `Group[Service.init]` → `this.update(this.config)` 弄清 `data` 为何为空。
**这条优先级高于所有阅读**——它可能是上游缺陷，且危害是静默退出。
