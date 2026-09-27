# 设计文档阅读清单（52 篇，已全部读完）

语料：`deepseek-ai/deepseek-harness` 的 `.agents/notes/`，共 **2412 篇**。
本题材：`bug-fix` 类且涉及框架层的 **52 篇**。

筛选方法与结论见 [`doc-corpus-analysis.md`](doc-corpus-analysis.md) 与 [`findings/18-corpus-reading-complete.md`](findings/18-corpus-reading-complete.md)。

**结果：52 篇里只有 2 篇的缺陷真的在 vendored 框架层**，其余 50 篇是 DSH 应用层。

★ 标记的两篇见文末。链接指向 `master` 分支。

---

## 进程 / 信号 / 关闭（4 篇）

- · [2026-08-03-cli-signal-shutdown-escalation](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-08-03-cli-signal-shutdown-escalation.md)
- ★ [2026-08-03-hmr-initial-scan-boot-deadlock](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-03-hmr-initial-scan-boot-deadlock.md) — → findings/17：不是上游缺陷，两条线都收敛
- · [2026-09-03-hidden-windows-subprocess-windows](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-09-03-hidden-windows-subprocess-windows.md)
- · [2026-09-24-exited-holder-lock-takeover](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-24-exited-holder-lock-takeover.md)

## 会话 / 转录 / 恢复（6 篇）

- · [2026-07-29-human-transcript-append-origin](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-29-human-transcript-append-origin.md)
- · [2026-08-20-turn-error-survives-same-turn-retry-history](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-20-turn-error-survives-same-turn-retry-history.md)
- · [2026-08-26-question-drafts-survive-session-switch](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-26-question-drafts-survive-session-switch.md)
- · [2026-08-26-stable-turn-process-order](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-26-stable-turn-process-order.md)
- · [2026-09-05-session-reference-model-budget](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-05-session-reference-model-budget.md)
- · [2026-09-05-session-reference-spill-reuse](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-05-session-reference-spill-reuse.md)

## 工具 / 权限 / 沙箱（6 篇）

- · [2026-07-31-code-runtime-python-settlement-fixes](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-31-code-runtime-python-settlement-fixes.md)
- · [2026-07-31-fail-loud-releases-the-terminal](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-07-31-fail-loud-releases-the-terminal.md)
- · [2026-08-07-ptc-executor-collapse](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-08-07-ptc-executor-collapse.md)
- · [2026-08-12-fix-pwsh-terminal-overlay-dup](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-12-fix-pwsh-terminal-overlay-dup.md)
- · [2026-08-18-tool-row-file-open-failure](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-18-tool-row-file-open-failure.md)
- · [2026-08-29-code-runtime-python-call-backlog-and-binding-metadata-snapshot](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-29-code-runtime-python-call-backlog-and-binding-metadata-snapshot.md)

## preset / bundle 组合（6 篇）

- · [2026-08-09-broken-preset-roster-rows](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-09-broken-preset-roster-rows.md)
- · [2026-08-10-child-agents-join-their-parent-preset](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-08-10-child-agents-join-their-parent-preset.md)
- · [2026-08-10-minimal-preset-owns-rl-composition](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-10-minimal-preset-owns-rl-composition.md)
- · [2026-08-10-slash-catalog-follows-preset-switch](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-10-slash-catalog-follows-preset-switch.md)
- · [2026-08-11-preset-authoring-agent-validates-its-own-composition](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-11-preset-authoring-agent-validates-its-own-composition.md)
- · [2026-08-20-plugin-owned-shipped-preset-root](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-20-plugin-owned-shipped-preset-root.md)

## TUI / Web 交互（12 篇）

- · [2026-07-24-tui-turn-end-stop-reason-notices](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-24-tui-turn-end-stop-reason-notices.md)
- · [2026-07-27-tui-step-timing-trails-tool-cards](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-27-tui-step-timing-trails-tool-cards.md)
- · [2026-07-28-web-gui-feedback-loop](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-28-web-gui-feedback-loop.md)
- · [2026-07-30-tui-adapter-registration-race](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-30-tui-adapter-registration-race.md)
- · [2026-07-30-web-transcript-log-ordered-projection](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-30-web-transcript-log-ordered-projection.md)
- · [2026-07-31-web-stop-preserves-queue](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-31-web-stop-preserves-queue.md)
- · [2026-08-06-host-backed-web-preferences](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-08-06-host-backed-web-preferences.md)
- · [2026-08-06-reader-scroll-attribution-observed-top-ledger](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-06-reader-scroll-attribution-observed-top-ledger.md)
- · [2026-08-10-pre-plugin-theme-bootstrap](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-10-pre-plugin-theme-bootstrap.md)
- · [2026-08-17-durable-web-queue-recovery](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-08-17-durable-web-queue-recovery.md)
- · [2026-09-04-busy-send-button-follows-enter-setting](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-04-busy-send-button-follows-enter-setting.md)
- · [2026-09-07-win32-picker-foreground-alt-key](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-07-win32-picker-foreground-alt-key.md)

## 其他（18 篇）

- ★ [2026-07-20-config-hot-reload-resilience](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-20-config-hot-reload-resilience.md) — → invariants/i5-loader-transaction.mjs
- · [2026-07-22-pi-ai-transport-truncation-classification](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-22-pi-ai-transport-truncation-classification.md)
- · [2026-07-24-empty-model-response-is-retryable](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-24-empty-model-response-is-retryable.md)
- · [2026-08-02-goal-round-wrapup-message](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-02-goal-round-wrapup-message.md)
- · [2026-08-06-api-key-format-validation](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-06-api-key-format-validation.md)
- · [2026-08-06-onboarding-step-owned-takeover-chrome](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-06-onboarding-step-owned-takeover-chrome.md)
- · [2026-08-07-cancel-convergence-wake-latch](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-08-07-cancel-convergence-wake-latch.md)
- · [2026-08-09-filesystem-absence-observation](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-09-filesystem-absence-observation.md)
- · [2026-08-11-owned-run-finish-reason](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-11-owned-run-finish-reason.md)
- · [2026-08-12-onboarding-reads-every-provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-12-onboarding-reads-every-provider.md)
- · [2026-08-13-bounded-cold-blank-verification](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-13-bounded-cold-blank-verification.md)
- · [2026-08-13-oauth-only-providers-withheld](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-13-oauth-only-providers-withheld.md)
- · [2026-08-24-system-prompt-section-order-ties](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-24-system-prompt-section-order-ties.md)
- · [2026-08-29-windows-atomic-replace-retry](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-29-windows-atomic-replace-retry.md)
- · [2026-09-03-user-owned-goal-pause-activation](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-03-user-owned-goal-pause-activation.md)
- · [2026-09-05-continuous-client-recovery](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-05-continuous-client-recovery.md)
- · [2026-09-16-movable-mandatory-update-window](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-09-16-movable-mandatory-update-window.md)
- · [2026-09-22-windows-open-through-shell-resolution](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/bug-fix/2026-09-22-windows-open-through-shell-resolution.md)

---

## ★ 标记的两篇

只有这两篇的缺陷在 vendored 框架代码里：

- **[2026-07-20-config-hot-reload-resilience](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-07-20-config-hot-reload-resilience.md)** —— 已采掘，产出 8 条可断言性质 → `invariants/i5-loader-transaction.mjs`
- **[2026-08-03-hmr-initial-scan-boot-deadlock](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/archived/bug-fix/2026-08-03-hmr-initial-scan-boot-deadlock.md)** —— 已判定**不是**上游缺陷 → `findings/17-group-reentrancy-verdict.md`

## 通读中记下的可断言性质

见 [`findings/18-corpus-reading-complete.md`](findings/18-corpus-reading-complete.md)。
