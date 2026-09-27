# 设计文档语料的采掘结论

调研于 2026-09-27。语料：`deepseek-ai/deepseek-harness` 仓库 `.agents/notes/`，**2412 篇**（26MB，稀疏检出）。

---

## 一、语料结构

```
implemented/architecture   396      archived/architecture   250
implemented/feature        260      archived/feature        434
implemented/bug-fix        122      archived/bug-fix        256
implemented/simplification  54      archived/simplification 148
implemented/process        136      archived/process        152
implemented/testing         50      archived/testing         40
```

英文正文 **1208 篇**，中文译本 **1204 篇**（`.zh.md`）。

---

## 二、逐层筛选的结果

| 筛法 | 命中 | 说明 |
|---|---|---|
| 全部文档 | 2412 | — |
| 去掉中文译本 | 1208 | 英文正文 |
| 提到框架层概念（cordis/fiber/effect/inject/dispose/waterfall/epoch/coeffect） | **553** | 太多——**提到不等于缺陷在那里** |
| `bug-fix` 类且提到框架层概念 | **52** | 描述"什么坏了"的 |
| **缺陷确在 vendored 框架层** | **2** | ★ 真正的判据 |

### 「确在框架层」用的锋利判据

匹配到 `fiber`、`cordis` 这些**词**不算数——大部分文档只是**用到**框架。真正的信号是文档**引用 vendored 代码本身**：

```
cites vendor/README.md                    +5
cites a local modification number          +5
names packages/{core,loader,include,group,timer,hmr}/src/...   +6
cites cordiverse/cordis                    +5
names core internals (Fiber.update, _setEpoch, internal/plugin) +4
```

**52 篇里只有 2 篇命中：**

| 文档 | 分数 | 状态 |
|---|---|---|
| `2026-07-20-config-hot-reload-resilience` | 23 | **已采掘**——产出 8 条可断言性质，见 `invariants/i5-loader-transaction.mjs` |
| `2026-08-03-hmr-initial-scan-boot-deadlock` | 9 | **未完成**——见下 |

---

## 三、剩下那一篇：`hmr-initial-scan-boot-deadlock`

它描述两个叠加的缺陷，其中一条**直接陈述了一条框架不变量**：

> **"The group's transactional `update` is not reentrant, so serialization is a correctness requirement, not a throughput choice."**
>
> Two concurrent `EntryGroup.update` calls on one group **interleave create and rollback on the same entries**, and the Include fiber never settles — `loader.create` hangs, `boot()` neither resolves nor rejects, and Node **exits 13 with no diagnostic**.

**上游的 `EntryGroup.update` 同样没有重入保护**——所以这条**可能**是上游缺陷。

**但我没能验证它。** 我的复现场景没能正确构造 group（`group.data` 始终为空），四次尝试都卡在场景本身而不是被测代码上。

**结论：未定，不是发现。** 要出结论需要先读 `EntryGroup` 的构造路径（`Group[Service.init]` → `this.update(this.config)`）弄清 `data` 为何为空，而不是继续改场景碰运气。

**这条值得单独排一次**：它陈述的性质是"并发 `update` 会交错 create 与 rollback"，**危害是静默退出、零诊断**——本仓库一切发现里最严重的一类。

---

## 四、结论：这份语料对"上游框架 bug"基本采完了

**2412 篇 → 2 篇相关 → 1 篇已采掘。**

这不是筛选太严——**是我一开始把规模估错了一个数量级。** 我之前说"2313 篇的规格池"，但实际上：

- 大部分文档是 **DSH 应用层**的（UI / TUI / web / bundle / 流程 / 工具）
- 它们**使用** cordis，但**缺陷不在 cordis 里**
- 真正"改 vendored 框架代码"的决策，DSH 集中记录在 **`vendor/README.md` 的 22 条改动日志**里

**而那份日志我早已全部核过**——4 个反向发现（#176–#179）就是从那里来的。

### 所以真正有效的规格来源，按产量排序

| 来源 | 规模 | 产出 |
|---|---|---|
| **`vendor/README.md` 改动日志** | 22 条 | **4 个发现** |
| **论文**（arXiv:2608.25512） | 2 条性质 | 不变量套件，独立复现 #175 |
| `.agents/notes/` 全语料 | 2412 篇 | 1 篇有价值（已采掘），**1 篇未定** |

**前两个是"差异清单"和"形式化定义"——都是紧凑的、声明式的规格。第三个是散文，信噪比低两个数量级。**

---

## 五、剩下的 51 篇该怎么用

**不为上游 bug 读它们**——判据已经证明那里没有。

**为 DSH 自己的改进读**——它们记录的是 DSH 的产品决策。按主题分：

| 主题 | 大概篇数 | 对谁有用 |
|---|---|---|
| preset / bundle 组合 | ~12 | DSH 配置层 |
| TUI / web 交互 | ~14 | DSH 前端 |
| 会话 / 转录 / 恢复 | ~9 | DSH session 设计 |
| 工具 / 权限 / 沙箱 | ~8 | DSH 工具层 |
| 进程 / 信号 / 关闭 | ~4 | DSH 运维 |
| 其他 | ~4 | — |

**排期见 `reading-plan.md`。**

---

## 六、方法上的收获

**这轮最重要的产出不是发现，是判据。**

"2313 篇规格"听起来很多，但**匹配关键词 ≠ 规格相关**。用"文档是否引用被测代码"这条判据，553 篇缩到 2 篇——**两个数量级**。

**同一课这个会话已经上过多次**：分诊器本身也要验证。第一次筛出 52 篇时我以为找到矿了；加一条判据后，矿只有 2 篇。


---

## 附：剩下 2360 篇的处置

见 [`findings/19-remaining-corpus-value.md`](findings/19-remaining-corpus-value.md)。

**要点**：

- **1204 篇是中文译本**（1:1 对照），零新内容，不必读
- 其余多数是**决策记录**（"我们为什么这么做"）——**用来查，不用来通读**
- **但有 4 篇必须读**，它们讲的是 DSH 怎么看待 **vendor / 依赖 / 测试**——正是本次工作的三个主题：
  1. `proposed/process/2026-06-11-supply-chain-and-vendor-drift` ★★★ —— **"没有任何东西验证 manifest 的声明"**，提案是"每个改动一个签入的 patch 文件 + 夜间重建 `vendor/`"。**状态仍是 proposed**——而本仓库正是它的手工雏形
  2. `implemented/architecture/2026-06-13-twin-llm-adapters` ★★★ —— 解释了为什么有两个 LLM 适配器
  3. `proposed/testing/2026-06-11-mutation-testing` ★★ —— **"覆盖率高不等于断言有效"**，本仓库每次修复的双向验证就是手工变异测试
  4. `implemented/process/2026-07-26-dependencies-over-hand-rolling` ★★ —— 依赖策略，解释了为什么 fork 了 7 个包

**最重要的结论**：本仓库的四条改善建议里，有三条 DSH 已经写在 `proposed/` 里了——**只是没建**。
