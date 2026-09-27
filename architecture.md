# Cordis 架构研究

调研于 2026-09-26/27。数据来自 GitHub API、各仓库 `package.json`、`cordiverse/paper` 与 `cordiverse/registry`。

---

## 一、先回答"上游在哪"

**`cordiverse/cordis` 是 canonical 上游。** 证据：

```
fork: false          创建: 2022-05-17        ⭐ 8837        forks: 549
默认分支: main        Issues: 启用           描述: Meta-Framework of Spatiotemporal Composability

贡献者:  shigma 548 · Hieuzest 8 · undefined-moe 3 · justkyriecai 2 · morluto 2 · cyans-nya 2 · …
```

**shigma 一人 548 个提交**——这个项目实质上是一个人的作品，其他人加起来不到 20 个提交。近 30 次提交里 shigma 14 次、Hieuzest 7 次，其余是零散的社区贡献。

> 注：**org 建于 2023-12-03，但仓库建于 2022-05-17**——仓库比组织早一年半，是先有项目后有组织。

### "上游"有三层，别混

| 层 | 仓库 | 性质 |
|---|---|---|
| **① 本体** | `cordiverse/cordis` | canonical，公开，549 个 fork 的源头 |
| **② DSH 的 fork** | `deepseek-harness/cordis` | **私有**。DSH 的 include/group/timer/hmr/logger-console 从这里取 |
| **③ 你的 fork** | `173787247/cordis` | 你提 PR 用的 |

DSH 的 `vendor/README.md` 里记录的 `cordis-workspace`（本地检出 `~/repos/cordis-workspace`）是把①②③和其它仓库组合成本地 workspace 的地方。

---

## 二、形式化基础 —— 这个架构有论文

`cordiverse/paper` 仓库（2999⭐）**只有一个 README**，指向 [arXiv:2608.25512](https://arxiv.org/abs/2608.25512)：

> **A Programming Paradigm for Spatiotemporal Composability**
> Shi, Yifan · Zhang, Wei · Cui, Tianyi（2026，cs.PL）

### 两个正交维度

论文把"动态组合"分解成两个独立问题：

| 维度 | 定义 | 机制 |
|---|---|---|
| **时间可组合性**<br>temporal | **完全回滚**一个组件被移除时的副作用 | **revertible effects** —— 每个 context 变换都带一个逆操作，由运行时持有 |
| **空间可组合性**<br>spatial | **声明并响应式管理**组件间的依赖 | **reactive coeffects** —— 每次 context 变化都对照组件的 coeffect 声明分类，驱动其激活/停用 |

两者**统一到同一个 context 类型**、所有 effect 和 coeffect 都经由它中介 → **context paradigm**。

论文的核心论断：

> 这种中介**诱导出一个观察等价**，在此等价下，不同组件的 effect **交错而不互相干扰**。

再加一个 **component** 的概念，就得到一套动态组合的演算，其元理论把时空可组合性**从单个组件推广到整个交错组件系统**。

### 对应到代码

| 论文概念 | cordis 里的实现 | 我在这场会话里找到的**违反** |
|---|---|---|
| **revertible effects** | `ctx.effect()` 返回 inverse、`_disposables` LIFO 执行、`ctx.effect` 的 owner 追踪 | #175 PENDING fiber 的 disposables 从不释放<br>#176 卸载期注册的 effect 逃出 unload 快照<br>#177 抛错的观察者中断整个 teardown |
| **reactive coeffects** | `inject` 声明、epoch 机制（`_setEpoch` / `_refresh`）、`ctx.reflect.notify` | `4cfd19a` def-site 注入泄漏（服务能访问没声明的服务）<br>`#37` 可调用服务的 shadow 丢失 |

**这不是巧合。** 论文说"每个 effect 都必须可回滚"——那么一个**从不被回滚的 effect** 就是对这个性质的违反，必然是 bug。同理"每次 context 变化都要对照 coeffect 声明分类"——那么**按错误的 def site 分类**也是违反。

**我这场是在经验层面撞到这些；论文给出了它们为什么必然是 bug 的理论依据。** 反过来，**论文也给出了一份"应该测什么"的清单**——这是后续最有价值的方向。

---

## 三、26 个仓库的定位

按角色分五层：

### 地基（shigma 个人库，不在 cordiverse）

| 包 | 仓库 | 作用 |
|---|---|---|
| **`cosmokit`** | github.com/shigma/cosmokit | 工具库。`deepEqual`、`defineProperty`、`Disposable` 等 |
| **`schemastery`** | github.com/shigma/schemastery | 配置 schema。cordis 的 `Config` 就是它 |
| `reggol` | — | 日志 |

**这两个是 cordis 的物理地基**，却不在 cordiverse 组织下——**DSH 为了 `volatile` 连它们都 fork 了**。

### 工具链（自举）

| 仓库 | ⭐ | 作用 |
|---|---|---|
| **`yakumo`** | 25 | workspace 管理器，**本身是 cordis CLI 插件** |
| `dumble` | 3 | 零配置打包器（TS + esbuild） |
| `unyaml` | 3 | 通用 YAML 加载器（Node import hook） |
| `tsx`（fork） | 1 | `@cordiverse/tsx@4.19.3-fix.3`——他们自己的 tsx 分支 |
| `eslint-config` | 1 | 共享 lint |
| `vitepress-theme` | 3 | 文档主题 |

### 核心（cordis 仓库自己的 9 个包）

| 目录 | 发布名 | 版本 |
|---|---|---|
| `core` | **`cordis`** | 4.0.0-rc.10 |
| `loader` | `@cordisjs/plugin-loader` | 1.0.0-rc.7 |
| `group` | `@cordisjs/plugin-group` | 1.0.0 |
| `include` | `@cordisjs/plugin-include` | 1.1.0 |
| `timer` | `@cordisjs/plugin-timer` | 1.1.3 |
| `hmr` | `@cordisjs/plugin-hmr` | 1.1.0 |
| `logger-console` | `@cordisjs/plugin-logger-console` | 1.0.0 |
| `create` | `create-cordis` | 0.3.0 |
| `utils` | `@cordisjs/utils` | 1.0.0 |

### 生态插件（独立仓库，20 个官方插件）

| 仓库 | 发布的插件 |
|---|---|
| `http` | `plugin-http`（axios 风格 fetch 客户端）、`plugin-http-socks` |
| `server` | `plugin-server`、`plugin-server-static`、`plugin-server-proxy` |
| `webui` | `plugin-webui`、`plugin-insight`、`plugin-notifier`、`plugin-manager`、`plugin-loader-webui`、`plugin-logger-webui` |
| `cli` | `plugin-cli-cordis`、`plugin-cli-help`、`plugin-env` |
| `database` | `plugin-database`（Type Driven Database Framework，46⭐） |
| `sso` / `sms` / `mail` | 对应服务 |
| `capability` / `element` / `muon` / `ponyfills` / `fetch-file` | 零散能力 |

`registry` 仓库是插件索引（`index.json` + `version.txt`，**每天更新**）：

```json
{ "version": 6, "total": 20, "objects": [ …20 个插件… ] }
```

全部 shigma 维护、MIT、**GitHub Actions OIDC 发布**（`npm-oidc-no-reply@github.com`）——没有人工 npm token。

### 应用/组合层

| 仓库 | 作用 |
|---|---|
| `boilerplate` | 项目模板（40 个依赖，最大） |
| `landscape` | 工作区组合（21 个依赖） |
| `docs` | 文档站 |
| `workflows` | 共享 GitHub Actions workflow |
| `paper` | 论文 |

---

## 四、多仓怎么拼成一个 workspace

**这是整个工程架构的关键机制。**

`cordiverse/cordis` 的 `package.json`：

```json
{
  "name": "@root/cordis",
  "private": true,
  "workspaces": ["external/*", "packages/*"]
}
```

```
packages/    ← 本仓库自己的 9 个包（进版本控制）
external/    ← 其它仓库的本地检出（在 .gitignore 里）
```

**所有仓库都叫 `@root/<仓库名>` + `private: true`**，真正的发布名在各自的 `packages/*/package.json`。这是 **monorepo-of-monorepos**：每个仓库独立发布、独立 CI，但可以本地组合成一个 workspace 一起开发。

---

## 五、工具链是自举的

```json
// cordiverse/cordis 的 scripts
"yakumo": "node --expose-internals --import tsx --import @cordisjs/unyaml node_modules/yakumo/lib/cli.js",
"build":  "yarn yakumo esbuild && yarn yakumo tsc",
"test":   "yarn yakumo vitest"
```

而 **`yakumo` 的启动代码**：

```js
ctx.baseUrl = pathToFileURL(process.cwd()).href + "/"
await ctx.plugin(Loader)                                        // ← cordis 的 loader
await ctx.plugin(Include, { path: "./yakumo.yml", initial: [{ name: "yakumo" }] })
await ctx.plugin(Cli, { name: "yakumo" })
await ctx.cli.executeArgv()
```

> **cordis 的构建依赖 yakumo，而 yakumo 依赖 cordis 的 loader —— 这是一个真实的环。**

### 这个环在实战中会咬人

我在这个会话里踩过：改坏了 cordis 的 loader bundle（`src` 用 `git checkout` 还原了，但 **`lib/index.js` 是构建产物、不受 git 跟踪**，坏的还在），结果：

```
$ yarn yakumo esbuild loader
Error: command "esbuild" not found
```

**看起来像构建工具坏了，实际是被测代码坏了**——因为 yakumo 自己就是靠那个 loader 挂载 `yakumo.yml` 的，loader 一坏，`yakumo.yml` 挂不上，就回落到 `initial` 里只有 `[{name:'yakumo'}]`，于是只剩 `help` 命令。

**排查了两轮才意识到方向从一开始就错了。**

---

## 六、DeepSeek Harness 的 vendor 形态

**DSH 不是简单 vendor —— 它 fork 了 9 个包里的 7 个。**

| vendor 目录 | 发布名 | 上游 | 上游版本 |
|---|---|---|---|
| `cordis/` | `@deepseek-ai/cordis` | **cordiverse/cordis** | 4.0.0-rc.7 |
| `loader/` | `@deepseek-ai/cordis-plugin-loader` | **cordiverse/cordis** | 1.0.0-rc.5 |
| `include/` | `@deepseek-ai/cordis-plugin-include` | **deepseek-harness/cordis** ← fork | 1.0.4 |
| `group/` | `@deepseek-ai/cordis-plugin-group` | **deepseek-harness/cordis** ← fork | 1.0.0 |
| `timer/` | `@deepseek-ai/cordis-plugin-timer` | **deepseek-harness/cordis** ← fork | 1.1.2 |
| `hmr/` | `@deepseek-ai/cordis-plugin-hmr` | **deepseek-harness/cordis** ← fork | 1.0.15 |
| `logger-console/` | `@deepseek-ai/cordis-plugin-logger-console` | **deepseek-harness/cordis** ← fork | 1.0.0 |
| `cosmokit/` | `@deepseek-ai/cosmokit` | **deepseek-harness/cosmokit** ← fork | 1.8.1 |
| `schemastery/` | `@deepseek-ai/schemastery` | **deepseek-harness/schemastery** ← fork | 3.18.0 |

两个 commit 基点：
- `56b3d4f`（2026-07-15）— `cordiverse/cordis`，用于 **core + loader**
- `abb0a30` — `deepseek-harness/cordis`，用于**其余 5 个包**

### 这解释了之前所有的困惑

- `@deepseek-ai/cordis` 是 **4.0.4** 而上游是 **4.0.0-rc.10**——**版本号根本不在同一序列**，它是独立发布的 fork
- 它有上游不存在的 `volatile` 机制、`config/diff.ts`、`disabledOf()`
- 那 22 条"本地改动"**是一份 fork 的差异清单，不是 vendor 的补丁清单**

### 分工策略（从 vendor 表读出来）

```
基础层  core · loader        → 跟随上游，保持可同步
插件层  include group timer  → 自己 fork（改动最多、最贴近产品）
        hmr logger-console
地基    cosmokit schemastery → 也 fork
```

**为什么连地基都 fork**：`volatile` 这个特性**横跨四个包**（cosmokit + schemastery + cordis + loader）——上游不可能为它改 cosmokit。

---

## 七、血统：cordis 来自 Koishi

`@cordisjs/plugin-webui` 的描述是：

> "Web User Interface for **Koishi**"

**Koishi 是 shigma 的另一个项目**（聊天机器人框架，也是插件化的）。cordis 是那套插件系统的**重构与理论化**——把 Koishi 里经验性的插件机制，提炼成论文里的"时空可组合性"。

所以 cordis 不是凭空设计的框架，它是**从一个真实运行的插件生态里长出来的**，然后形式化。

---

## 八、"DSH 修复自己"这个闭环的架构含义

你说"DSH 可以用来自己修复自己，这已经是一个创举"——从架构上看，这件事成立有**三个必要条件**：

1. **DSH vendor 了它的框架层**，而且是**源码级**的（不是 npm 依赖）——所以它**可以改**
2. **它有测试与构建**（yakumo + vitest 全套）——所以改完**能验证**
3. **上游是公开的、可比的**——所以能判断"这是我们的问题还是上游的问题"

**三者缺一，这个闭环就不成立。**

而 vendor 表里那句 *"so that the harness fully owns its framework layer (auditable, patchable, pinned)"* 正是这个闭环的**设计声明**——**auditable / patchable / pinned，三个词对应三个条件**。

再加一条这个会话证明了的：**vendor 表本身就是资产**。它记录了上游 commit、22 条本地改动、同步流程——**这份"差异清单"是可以反过来向上游贡献的**。我这场 15 个 PR 里有 4 个（#176–#179）就是从那份清单里挖出来的。

---

## 九、对后续工作的含义

1. **上游 PR 的收益面是 `core` + `loader`**——只有这两个包 DSH 跟随上游。其余 7 个它自己说了算。
   我 15 个 PR 里 **9 个**在这两个包（core #175–#178、loader #165 #166 #167 #172 #179），另外 6 个里 **3 个是 DSH 根本不发布的包**（hmr ×2、create ×1）。

2. **论文给出了一份"应该测什么"的清单**——revertible effects 和 reactive coeffects 是两条可形式化的性质，每一条都可以转成不变量测试。我这场 4 个反向发现全部落在这两条上，**说明这个方向是对的，而且远没测完**。

3. **自举环（yakumo ↔ cordis loader）是真实的脆弱点**——改 core/loader 时构建工具可能一起坏，症状会指向工具而不是代码。

4. **"DSH 用哪个版本"不能靠 npm 版本号回答**——得看 vendor 表里的 commit。
