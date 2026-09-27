# 52 篇设计文档通读完毕

读完 2026-09-27。全部 52 篇框架相关 bug-fix 文档逐篇读过 Problem/Decision。

---

## 结果

| 类别 | 篇数 | 说明 |
|---|---:|---|
| **缺陷在 vendored 框架层** | **2** | 已单独处置，见下 |
| 会话 / 投影 / 转录 | 9 | DSH session 设计 |
| TUI / Web UI | 12 | 渲染、滚动、组件 |
| 工具 / 权限 / 沙箱 | 6 | 工具运行时、PTC、Python 后端 |
| preset / bundle 组合 | 6 | 组合所有权 |
| 进程 / 文件锁 / 平台 | 17 | 原子写、Windows 交互、遥测 |
| **合计** | **52** | |

**除了那 2 篇，其余 50 篇的缺陷都在 DSH 自己的代码里，不在 cordis。**

---

## 那 2 篇的处置

**① `2026-07-20-config-hot-reload-resilience`** —— 已采掘
产出 8 条可断言性质 → `invariants/i5-loader-transaction.mjs`。
其中 3 条在两条线上一致同意，1 条是我的场景 bug，1 条结论未定。

**② `2026-08-03-hmr-initial-scan-boot-deadlock`** —— 已判定，**不是上游缺陷**
→ `findings/17-group-reentrancy-verdict.md`
并发 `EntryGroup.update` 在两条线上都正确收敛。文档描述的卡死需要 Include + HMR 两层同时在场。

---

## 通读中记下的可断言性质（全部是 DSH 层，非上游）

这些不是发现，是**将来可以写成断言**的条目：

| 出处 | 性质 |
|---|---|
| `exited-holder-lock-takeover` | `withFileLock` 在信号探测返回 `ESRCH` 时接管锁，`EPERM` 时保留 |
| `human-transcript-append-origin` | append-origin 事件是转录的持久源；replacement 副本仅模型可见 |
| `ptc-executor-collapse` | 模式坍缩必须在**执行**边界生效，不能只做宣告面 |
| `windows-atomic-replace-retry` | Windows 上 `EACCES`/`EBUSY`/`EPERM` 最多重试 8 次、指数退避 |
| `api-key-format-validation` | 合法密钥：trim 后非空，且每个字符在 `[\x21-\x7E]` |
| `tui-adapter-registration-race` | **Cordis 按服务可用性激活插件，不按配置顺序**（这是正确的，非缺陷） |
| `plugin-owned-shipped-preset-root` | id 定向补丁**替换整个 `config` 值**，不是深合并 |

---

## 一个遗留的上游候选（未处置）

`2026-08-12-fix-pwsh-terminal-overlay-dup` 提到新版 DSH 会抛：

```
TypeError: duplicate loader entry id: tool-pwsh
```

**上游没有任何重复 id 检查。** `EntryTree.ensureId` 只在 id 缺失时生成，否则原样返回；`EntryGroup.create` 用 `store[id] ??= new Entry(...)`，所以**同 id 会静默复用已存在的条目**——用户写了两个同 id 的条目，得到的是合并行为而不是报错。

**没有做**：这是一个"应该报错"的改进，**不是有危害论证的缺陷**。按本仓库的标准（先证明危害再报），它不够格单独提 PR。**记在这里备查。**

---

## 整轮方法上的结论

**2412 篇 → 553 篇 → 52 篇 → 2 篇。** 两层筛选，两个数量级。

**读完之后可以确定：这份语料对"上游框架 bug"是采完的。** 不是因为读得不够，是因为**框架层的分歧 DSH 集中记在 `vendor/README.md` 的 22 条日志里**——而那份日志产出了全部 4 个反向发现。

**设计文档写的是"我们为什么这么做"，vendor 日志写的是"我们和上游哪里不同"。只有后者直接指向上游缺陷。**
