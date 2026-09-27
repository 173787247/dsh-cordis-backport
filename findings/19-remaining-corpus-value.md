# 剩下 2360 篇：哪些值得读

回答"扣掉那 52 篇之后，还有必要继续读吗"。

---

## 一、先把 2360 拆开

那 2412 篇的构成，减去 52 篇框架相关 bug-fix 之后：

| 类别 | 英文篇数 | 是什么 |
|---|---:|---|
| **`.zh.md` 中文译本** | **1204** | **纯重复，零新内容** |
| `archived/feature` | 217 | 功能决策 |
| `implemented/architecture` | 198 | 架构理由 |
| `implemented/feature` | 130 | 功能决策 |
| `archived/bug-fix` | 128 | 缺陷记录（应用层） |
| `archived/architecture` | 125 | 架构理由 |
| `archived/process` | 76 | 流程 |
| `archived/simplification` | 74 | 重构决策 |
| `implemented/process` | 68 | 流程 |
| `implemented/bug-fix` | 61 | 缺陷记录（应用层） |
| `implemented/simplification` | 27 | 重构决策 |
| `implemented/testing` + `archived/testing` | 45 | 测试策略 |
| **`proposed/*`** | **40** | **提案中** |
| **`rejected/*`** | **14** | **被否决的** |

**第一刀：1204 篇中文译本是 1:1 对照，不是新内容。** 真正的英文正文只有 1208 篇。

---

## 二、结论：不必通读，但有 **4 篇必须读**

**我原以为"设计文档"是一类东西。不是。** 那 52 篇是**缺陷记录**；剩下的多数是**决策记录**——**用途完全不同**。

而其中有一小撮，**恰好命中这场会话的元主题**：DSH 自己怎么看待 **vendor、依赖、测试方法**。

### ★★★ ① `proposed/process/2026-06-11-supply-chain-and-vendor-drift.md`（35 行）

**这篇是整份语料里和这场工作关联最强的一篇。**

> **Problem**: The vendor manifest is enforced at commit time in the *forward* direction (vendored change ⇒ manifest update) but **nothing verifies the manifest's *claims***: that `vendor/` actually equals upstream-at-SHA plus exactly the logged modifications.

**这正是本仓库存在的理由。** 他们的提案：

> **Proposal 1 — Vendor drift check（夜间 CI）**: clone the upstream repos at the manifest SHAs (shallow), copy the corresponding package sources, and diff against `vendor/*/src`. **The job fails unless the diff matches the logged local modifications — kept as a checked-in patch file per modification, so the log entries become verifiable artifacts rather than prose.**

验收标准：

> The nightly drift job **reconstructs `vendor/` from the manifest SHAs plus checked-in patch files** and fails on any unexplained diff.

**状态：`proposed`——尚未实施。**

**含义**：本仓库的 `backport/*.patch` 正是"每个改动一个签入的 patch 文件"这一条；`invariants/` 的差分运行器是它的雏形。**这场会话在手工执行一份 DSH 已经写下但没建的东西。**

他们当时点出的风险是"上游仓库是私有镜像，CI 凭据和可用性是主要摩擦"——**但 `cordiverse/cordis` 是公开的**，所以 vendor 的 core/loader 那一半**没有这个障碍**。

### ★★★ ② `implemented/architecture/2026-06-13-twin-llm-adapters.md`（29 行）

**这篇解释了我在 `dsh-vs-pi-verification.md` 里更正的那件事。**

> **Decision**: Ship **two** adapters against the one contract from the start, deliberately built on different internals:
> - `dsh-llm-deepseek` — direct `fetch` + in-repo translation
> - `dsh-llm-pi-ai` — the same endpoint through `@earendil-works/pi-ai`
>
> **The rule they enforce: anything the `StreamChunk` vocabulary cannot express for BOTH implementations is a core-vocabulary bug**, caught immediately rather than at the next provider.

> A vocabulary defined against a single adapter risks **baking that adapter's quirks into the "neutral" contract** … the abstraction is unverified until a second provider arrives — by which point the leak is expensive to fix.

**所以"design-verification twin"这个名字是字面意思**：孪生存在的目的是**验证 seam 设计**，不是备用实现。我那句更正（"pi-ai 是 seam 后面的第二个适配器，不是基础设施"）现在有了设计依据。

### ★★ ③ `proposed/testing/2026-06-11-mutation-testing.md`（36 行）

**这篇讲的是本仓库每一处修复都在用的验证方法。**

> **Problem**: The per-file 100% coverage gate proves every line *executes* under test — **not that any assertion would notice if the line were wrong**. **Under agent-written tests, coverage pressure can produce execution-without-assertion.**

> **Proposal**: Stryker over `packages/*/src` … **Surviving mutants are work items: an agent picks a survivor, writes the killing test, repeats — a well-shaped autonomous loop.**

**这正是我这场做的"双向验证"**——撤销修复、确认测试失败。**手工的变异测试。** 他们把它提案成了自动化循环，状态同样是 `proposed`。

**注意那句 "execution-without-assertion"**：这正是本仓库反复踩的坑（脏构建、空文件、错场景——都是"跑了但没断言对"）。

### ★★ ④ `implemented/process/2026-07-26-dependencies-over-hand-rolling.md`（36 行）

**这篇解释了为什么 DSH fork 了 7 个包。**

> Introducing an external dependency is a legitimate simplification … The bar for a new dependency: **Net deletion.** … subject to the same evidence standard as any other simplification: the swap must genuinely **shrink what we own — code, tests, and contract surface — rather than merely relocate complexity behind a wrapper.**

而且它自己就指向了 ①：

> The dependency list will grow, and with it the supply-chain surface; **the mitigations live in the supply-chain proposal, which this policy makes more urgent.**

---

## 三、所以：读什么，不读什么

### 必须读（4 篇，共 136 行）

上面那四篇。**它们不是关于缺陷的，是关于"DSH 怎么看 vendor、依赖、测试"的**——而这场会话做的正是这三件事。

### 值得按需查（不是通读）

| 类别 | 篇数 | 什么时候查 |
|---|---:|---|
| `rejected/*` | 14 | 想提一个"你们应该做 X"的建议之前——**先看 X 是不是已经被否决过** |
| `proposed/*`（其余 39） | 39 | 同上，以及想知道什么已经在路上 |
| `simplification/*` | 101 | 想理解"为什么这块代码长这样" |
| `architecture/*` | 323 | 想理解某个设计决定 |
| 应用层 `bug-fix` | 189 | 改 DSH 具体模块前，查该模块的历史 |
| `process/*`、`testing/*` | 189 | 想按他们的规矩做事 |

### 不必读

**1204 篇中文译本**——1:1 对照，零新内容。**要读就读英文正文。**

### 对找上游缺陷：不必

**已证明**（见 `doc-corpus-analysis.md`）：2412 → 553 → 52 → **2**。框架层的分歧集中在 `vendor/README.md` 的 22 条日志里。

---

## 四、这轮真正的收获

**我上一轮说"语料采完了"——那是对"找 bug"这个目的说的，是对的。**

**但换一个目的，同样的语料立刻变得有价值：** 我要提的四条改善建议（`improvement-opportunities.md`），**其中"自举护栏""上游同步监控""缩小 fork 面"三条，DSH 都写在 `proposed/` 里了**——只是没建。

**这不是巧合。** 两边面对的是同一个问题：**源码级 vendor 一个活跃上游，如何保证清单说的和实际一致。** 他们的提案是"签入 patch 文件 + 夜间 drift 重建"，我的做法是"签入 patch 文件 + 差分运行器"。

**差别在于我多了一样他们没有的东西：跑得起来的结果。** 15 个上游 PR、16 个回移修复、能复现的探针、以及那个独立复现 #175 的不变量套件。

**所以正确的下一步不是继续读书，是把这些交回去。**

---

## 五、一句话

> **2360 篇里，1204 篇是译本不用读；剩下的多数是"我们为什么这么做"，用来查、不用来通读；但其中 4 篇讲的是"我们怎么看待 vendor 和验证"——而那正是这场会话的全部内容。**
