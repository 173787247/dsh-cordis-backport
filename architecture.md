# Cordis 的组织架构

调研于 2026-09-26。数据来自 GitHub API 与各仓库的 `package.json`。

---

## 一、组织

| | |
|---|---|
| **cordiverse** | 创建 2023-12-03 · 538 followers · **26 个公开仓库** · https://cordis.io |
| **deepseek-harness** | 创建 2026-05-26 · 51 followers · **0 个公开仓库**（vendor 表里链的 3 个是私有的） |
| **deepseek-ai/deepseek-harness** | DSH 本体，235,846⭐ |

cordiverse 的仓库按星标分两档，**断层很明显**：

```
cordis    8837★   Meta-Framework of Spatiotemporal Composability
paper     2999★   A Programming Paradigm for Spatiotemporal Composability
─────────────────────────────────────────────────────
database    46★   Type Driven Database Framework
yakumo      25★   Manage complex workspaces with ease
http        17★   HTTP / WebSocket client for Cordis
webui       11★   WebUI for Cordis App
…其余 20 个都是 1–5★
```

`cordis` + `paper` 是两个门面，其余是支撑它的基础设施。**`paper` 没有 package.json** ——它是论文仓库，不是代码。

---

## 二、多仓是怎么拼成一个 workspace 的

**这是整个架构里最关键的一点。**

`cordiverse/cordis` 的 `package.json`：

```json
{
  "name": "@root/cordis",
  "private": true,
  "workspaces": ["external/*", "packages/*"]
}
```

```
packages/     ← 本仓库自己的 9 个包（进版本控制）
external/     ← 其它仓库的本地检出（在 .gitignore 里）
```

**`/external` 被 gitignore** ——它是每个开发者本地创建、把兄弟仓库的检出软链/克隆进来、拼成一个 yarn workspace 的地方。

所有仓库的 `name` 都是 `@root/<仓库名>` + `private: true`，**真正的发布名在各自的 `packages/*/package.json` 里**。这是 monorepo-of-monorepos 的标准做法：每个仓库独立发布，但可以本地组合成一个 workspace 一起开发。

**DSH 的 `vendor/README.md` 记录的 `cordis-workspace`（本地检出 `~/repos/cordis-workspace`）就是这个机制**——他们维护了一份自己的组合。

---

## 三、9 个包与发布名

`cordiverse/cordis` 仓库的 `packages/`：

| 目录 | 发布名 | 版本（2026-09-26） |
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

**只有 `core` 叫 `cordis`**，其余都是 `@cordisjs/plugin-*` —— 所以 "cordis" 既是项目名，也是一个具体包（核心）。

---

## 四、工具链是自举的

**cordis 用自己构建自己**，而且不只是"用了自己的库"，是**闭环**：

```
cordiverse/cordis 的 package.json:
  "yakumo": "node --expose-internals --import tsx --import @cordisjs/unyaml node_modules/yakumo/lib/cli.js"
  "build":  "yarn yakumo esbuild && yarn yakumo tsc"
  "test":   "yarn yakumo vitest"
```

而 **`yakumo` 自己就是一个 cordis CLI 插件**——它的启动代码是：

```js
ctx.baseUrl = pathToFileURL(process.cwd()).href + "/"
await ctx.plugin(Loader)
await ctx.plugin(Include, { path: "./yakumo.yml", initial: [{ name: "yakumo" }] })
await ctx.plugin(Cli, { name: "yakumo" })
await ctx.cli.executeArgv()
```

**`yakumo` 用 cordis 的 loader + include 来挂载 `yakumo.yml`。** 所以：

> **cordis 的构建依赖 yakumo，而 yakumo 依赖 cordis 的 loader。**

这一条在实操中会咬人——我在这个会话里就踩过：改坏了 cordis 的 loader bundle（`src` 还原了但 `lib` 是构建产物、不受 git 跟踪），**结果 `yakumo` 也起不来了，报 "command esbuild not found"**，因为它自己就是靠那个 loader 挂载配置的。看起来像"构建工具坏了"，实际是被测代码坏了。

### 工具链成员

| 仓库 | 作用 | 谁在用 |
|---|---|---|
| **`yakumo`** | workspace 管理器（cordis CLI 插件） | **所有仓库** |
| `yakumo-esbuild` / `-tsc` / `-vitest` | 三条构建/测试流水线 | 全部 |
| **`dumble`** | 零配置打包器（TypeScript + esbuild） | `fetch-file`, `muon`, `unyaml` |
| **`unyaml`** | 通用 YAML 加载器（Node 的 import hook） | `yakumo` 启动时 `--import @cordisjs/unyaml` |
| **`tsx`**（fork） | `npm:@cordiverse/tsx@4.19.3-fix.3` —— **他们自己的 tsx 分支** | 所有仓库跑脚本时 |
| `eslint-config` | 共享 lint 配置 | 全部 |

**注意 `tsx` 是 fork**，而且版本号带 `-fix.3`——上游 tsx 在他们的场景下有问题，他们自己修了一版。

### 基础库（不在 cordis 仓库里）

| 包 | 上游 | 被谁直接依赖 |
|---|---|---|
| **`cosmokit`** | github.com/shigma/cosmokit | `element`, `fetch-file`, `muon`, `vitepress-theme` |
| **`schemastery`** | github.com/shigma/schemastery | 通过 cordis 间接 |
| `reggol` | — | 日志 |

**`cosmokit` 和 `schemastery` 是 shigma 个人的库**，不隶属 cordiverse——它们是 cordis 的地基。

---

## 五、依赖层次

```
        cosmokit · schemastery            ← shigma 个人库，地基
                 │
        dumble（打包器）  unyaml          ← 工具层
                 │
        yakumo（workspace 管理器，本身是 cordis 插件）
                 │
        ┌────────┴────────┐
        │   cordis/core   │  ← 元框架本体
        └────────┬────────┘
                 │
   @cordisjs/plugin-{loader,group,include,timer,hmr,logger-console}
                 │
   @cordisjs/plugin-{http,server,webui,cli,database,mail,sms,sso,…}
                 │
   boilerplate · landscape · docs   ← 应用层
```

**每一层的构建都靠 yakumo，而 yakumo 在最底下那层之上**——所以严格说不是干净的 DAG，是**带自举环的**。

应用层仓库（`boilerplate` 依赖数 40、`landscape` 21）是把上面全部组合起来的模板/工作区。

---

## 六、DeepSeek Harness 的 vendor 形态

**DSH 不是简单 vendor——它 fork 了 9 个包里的 7 个。**

`deepseek-ai/deepseek-harness` 的 `vendor/README.md`：

| vendor 目录 | 发布名 | **上游仓库** | 上游版本 |
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

**`core` 和 `loader` 跟上游 `cordiverse/cordis`；其余 5 个包 + 两个基础库走 `deepseek-harness/*` 自己的 fork。**

两个 commit 基点：
- `56b3d4f`（2026-07-15）—— `cordiverse/cordis`，用于 core + loader
- `abb0a30` —— `deepseek-harness/cordis`，用于其余 5 个包

**这解释了我这个会话里观察到的一切**：

- DSH 的 `@deepseek-ai/cordis` 是 **4.0.4** 而上游是 **4.0.0-rc.10**——版本号不在同一个序列里，因为它是独立发布的 fork
- 它有自己的一整套 `volatile` 配置机制、`config/diff.ts`、`disabledOf()`——**这些在上游根本不存在**
- 它有 22 条编号的"本地改动"日志——**那是一份 fork 的差异清单，不是 vendor 的补丁清单**

### DSH 的分工策略

从 vendor 表读出来的：

- **基础层（core、loader）跟随上游** —— 保持可同步
- **插件层（include/group/timer/hmr/logger-console）自己 fork** —— 这里改动最多、最贴近产品需求
- **地基（cosmokit、schemastery）也 fork** —— 因为 `volatile` 需要 `cosmokit` 的不可变引用和 `schemastery` 的 `.volatile()` schema 支持

**`volatile` 这个特性横跨 4 个包**（cosmokit + schemastery + cordis + loader），这就是为什么 DSH 必须 fork 地基——**上游不可能为它改 cosmokit**。

---

## 七、对协作的实际含义

1. **往上游提 PR 的收益是有限的，但方向对。** DSH fork 了 7/9 个包，所以"上游合并"不影响 DSH 能不能用——**DSH 自己就能打补丁**。上游 PR 的价值在于**减少将来同步时的冲突**，以及**让修复被更多人验证**。

2. **`core` 和 `loader` 是唯一"跟随上游"的两个包**——**这两个包的上游 bug 对 DSH 最重要**，因为它们是 DSH 无法自行绕开的部分。我这个会话最终找到的 15 个 PR 里，**core 和 loader 占了绝大多数**，方向是对的。

3. **`external/*` 机制意味着本地组合是常态**——所以"Dsh 用的是哪个版本"这个问题，光看 npm 版本号是答不对的，得看 vendor 表里的 commit。

4. **自举环（yakumo ↔ cordis loader）是个真实的脆弱点**——改 core/loader 时，**构建工具本身可能一起坏掉**，而症状会指向工具而不是代码。
