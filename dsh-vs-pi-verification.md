# DSH 与 Pi 的对比 —— 逐条核对

核对于 2026-09-27。方法：凡能在本机 DSH 安装里查证的，一律查证后引用原文；查不到的明确标出。

**结论先说**：这份分析准确度很高——引文一字不差、事件流全部核实、架构判断正确。**三处需要更正**，其中一处（LLM 层归属）是实质性的。**关于 Pi 本身的说法我无法核实**，本地没有 Pi 的代码。

---

## 一、逐条核对

### ✅ 1. "DSH 的骨架是 Cordis"

**成立。** DSH 的 `vendor/README.md` 记录 9 个 vendor 目录，全部是 cordis 生态包；`@deepseek-ai/cordis` 是 DSH 自己的 fork，发布版本 4.0.4。

### ✅ 2. "Cordis 强调两件事：可逆副作用 + 依赖声明"

**成立，而且比你说的更进一步——它有正式论文。**

`cordiverse/paper`（2999★）指向 [arXiv:2608.25512](https://arxiv.org/abs/2608.25512)，*A Programming Paradigm for Spatiotemporal Composability*（Shi, Zhang, Cui, 2026, cs.PL）：

| 你说的 | 论文术语 | 定义 |
|---|---|---|
| 可逆副作用（temporal composability） | **revertible effects** | 每个 context 变换都带一个逆操作，由运行时持有 |
| 依赖声明与空间组合（spatial composability） | **reactive coeffects** | 每次 context 变化都对照组件的 coeffect 声明分类，驱动激活/停用 |

论文把两者**统一到同一个 context 类型**，所有 effect 和 coeffect 经由它中介，得到 **context paradigm**；核心论断是这种中介*诱导出一个观察等价，在此等价下不同组件的 effect 交错而不互相干扰*。

### ✅ 3. "在 DSH 里：模型适配器 / 工具注册表 / session log / agent loop / UI 都是插件"

**成立，有硬数字。** `dsh --profile web --dump-config` 打出 **275 个挂载条目**（57 个 `disabled`）：

| 你说的 | dump 里的证据 |
|---|---|
| 模型适配器 | `id: llm-pi-ai`、`id: deepseek-flash` 等独立条目 |
| 工具注册表 | `@deepseek-ai/dsh-tools` |
| session log | `dsh-session` 相关条目 **14 个** |
| agent loop | `@deepseek-ai/dsh-agent-loop` |
| **UI** | **`dsh-client-ui-*` 共 47 个条目** |

### ✅ 4. "启动时是 Profile + Bundle 叠出来的"

**成立。** 实测的层叠顺序与你说的一致，`--dump-config` 输出的正是叠加后的最终树（文件头有 `# == @deepseek-ai/dsh-base` 这样的分区注释，标明每段来自哪个 bundle）。

### ✅ 5. "`dsh --profile web --dump-config` 能直接把当前实际挂载的树打出来"

**成立，实测可用**，输出 1729 行。

### ✅ 6. "Session 是 append-only 的事件流 / Model-visible means logged"

**成立，引文一字不差。** `dsh-session/README.md`：

> The package is built on event sourcing: a `Session` is an append-only log of typed `SessionEvent`s, and everything else — model history, transcripts, telemetry, titles, persistence — derives from that stream. […] **Model-visible means logged: anything that reaches a model request must be reconstructable from the log.**

同一段还说明：每次到达结算的模型尝试提交一个事件；`assistant/message` 携带组装后的模型可见消息 + 紧凑时序流，`assistant/attempt` 保留失败/重试/取消/流错误的尝试而不进模型历史。

**"这点比大多数 coding agent 做得更彻底"——判断合理**，`request/header` 还存了非历史请求信封的完整规范快照（`initial` / `resume` / `change` / `series` 四种原因），支持部分窗口渲染与精确重建。

### ✅ 7. Turn / Step 事件流

**成立，全部事件名核实存在：**

```
turn/start          ✓ (dsh-agent-loop)
agent/pre-step      ✓
step/start          ✓
llm/stream          ✓ (dsh-llm)
tool/call           ✓
tools/pre-execute   ✓ (dsh-tools)
tools/post-execute  ✓
step/end            ✓
turn/end            ✓
```

**你列的序列是准确的。** 补充几个 README 里列出、你没提的：`agent/request`、`agent/request-error`、`agent/turn-stopping`、`agent/created`、`request/header`、`request/context`、`session/created`、`session/disposed`、`session/event`、`session/flush`、`assistant/message`、`assistant/attempt`、`system/message`、`user/message`。

### ✅ 8. "waterfall，监听者必须显式 next() 才能往下传"

**成立。** 这是 cordis 的分发模式之一（emit / waterfall / parallel / serial / bail）。`agent/pre-step`、`request/header`、`tools/pre-execute` 等都是 waterfall。

---

## 二、★ 需要更正的三处

### ① "LLM 调用层：吃了 Pi 的基础设施" —— **不准确，且方向反了**

实际结构：

```
@deepseek-ai/dsh-llm            Provider-neutral LLM service interface for the DeepSeek Harness
├── @deepseek-ai/dsh-llm-deepseek   DeepSeek Messages adapter
└── @deepseek-ai/dsh-llm-pi-ai      pi-ai-backed adapter
                                    (design-verification twin of dsh-llm-deepseek)
```

**`dsh-llm-pi-ai` 的包描述明确写着它是 `dsh-llm-deepseek` 的 "design-verification twin"。**

实测两者在 web profile 里**都是 `启用`**，但覆盖的 provider 不同：

| 适配器 | 承载的 provider |
|---|---|
| `dsh-llm-deepseek` | `deepseek-flash`(V4.1)、`deepseek-v4-flash`、`deepseek-v4-pro`、`deepseek-v4-flash-vision-exp` |
| `dsh-llm-pi-ai` | `ollama`（`127.0.0.1:11434/v1`）、`glm53`、`ark-coding` |

**DeepSeek 自家模型走的是 DSH 自己的原生适配器，不经过 pi-ai。** 撰写本核对时所处的这个会话跑的就是 `deepseek-flash`，即由 `dsh-llm-deepseek` 提供服务。

**准确的表述**：

> DSH 自己定义了 provider-neutral 的 LLM seam（`dsh-llm`），DeepSeek 自家模型走原生适配器 `dsh-llm-deepseek`；pi-ai 是**同一个 seam 后面的第二个适配器**，承载第三方 provider（Ollama / GLM / Ark），并在包描述里被标记为设计验证孪生。

这比"吃了 Pi 的基础设施"更精确，也更能说明架构意图：**LLM 抽象层是 DSH 自己的，pi-ai 是可替换的实现之一。**

> "reasoning effort 映射、catalog 覆盖走 pi-ai 的能力"——**对 pi-ai 那个适配器而言成立**（其 lib 里确实处理 `reasoning` / `thinkingSignature` / `redacted`），但**不能推广到整个 LLM 层**。

### ② "Minimal 模式 / Standard 模式 / Code（PTC）模式" —— **三者不在同一层面**

| 你说的 | 实际是什么 | 规模 |
|---|---|---|
| Minimal | **`dsh-sdk-minimal`，独立 bundle** | **32 条** |
| Standard | ≈ `dsh-base` | **92 条** |
| Code（PTC） | **`dsh-tools` 的一个 config 字段** `mode: native \| ptc \| both` | 不是 profile |

`dsh-sdk-minimal/cordis.patch.yml` 的注释把这件事说得很死：

> Unlike the ordinary SDK profile, **this bundle does not layer over `dsh-base`: this insert is the complete Cordis tree.**

它的自我描述是：*"The standalone minimal SDK profile bundle: JSON-RPC, one DeepSeek adapter, persistent shell, and JSONL sessions"*。

而 `ptc` 是 `dsh-tools` 的 `mode`：

> The `mode` config decides what the model sees: `native` (every visible schema), `ptc` (only `run_code` plus a generated SDK), or `both`.

**所以"三种模式"实际是两种不同的东西**：两个 bundle（minimal / base）+ 一个工具呈现配置（ptc）。这两个 bundle 的规模差 **32 : 92**。

### ③ "Minimal 只留 shell + 文件编辑器" —— **工具只有两个，且都是 shell**

`dsh-sdk-minimal` 挂载的 32 条里，工具只有：

```
dsh-tool-bash-persistent
dsh-tool-pwsh-persistent
```

**没有独立的文件编辑器工具。** 文件操作应当是通过终端完成的。

---

## 三、⚠️ 无法核实的部分

**关于 Pi 本身的全部说法**，我一条都没法验证：

- "Pi 的目标是最小核心 + 用户自己拼"
- "Pi 默认的 4 工具"
- "Pi 是极简可扩展的 coding harness"
- "DSH 的 Minimal 模式才最接近 Pi 的默认体验"

**本地没有 Pi 的代码。** 唯一相关的是 npm 包 `@earendil-works/pi-ai`（DSH 依赖 `^0.85.1`），而 DSH 只用它的 **LLM 适配能力**，不是 harness 本体。**关于 Pi 的定位与默认工具数，我不替你背书。**

同理，"DSH 官方之前在 V4 的 agent 评测里用过 Minimal 模式"——**无法核实**。

---

## 四、核对结论

| 类别 | 条数 |
|---|---|
| **成立**（逐项查证） | 8 |
| **需更正** | 3（其中 1 处实质性） |
| **无法核实** | 5（全部关于 Pi 本身） |

**最值得记住的一条更正**：`dsh-llm-pi-ai` 是**孪生适配器**，不是基础设施。这不只是措辞问题——它意味着 **DSH 的 LLM 抽象层是可替换设计，pi-ai 是其中一个实现**。这个判断会直接影响"如果要换掉 pi-ai 需要做什么"这类决策。

**一个额外发现**：`dsh-llm-pi-ai` 自称 **"design-verification twin"** ——**用一个第三方库实现同一个 seam，来交叉验证自己 seam 设计是否成立**。这是个值得注意的工程实践：当你设计一个抽象层时，用第二个独立实现来证明这个抽象真的中立，而不是恰好贴合你自己的实现。
