# dsh-cordis-backport

[English](README.md) | **中文**

对 DeepSeek Harness 里 vendor 的那条 cordis 线做的一次审计，以及它尚未跟进的上游修复的回移补丁。

**背景与讨论**：https://github.com/deepseek-ai/deepseek-harness/discussions/7922

## 这是什么

DeepSeek Harness 用的是 `@deepseek-ai/cordis@4.0.4` 及其插件包，而不是 npm 上公开的 `cordis`。**这条线不是把 `cordis@4.0.0-rc.10` 改了个版本号**——它是一条独立演进的线，有自己的 `config/diff.ts`、自己的 `volatile` 概念、自己对 `disabled` 里 `!!js` 的处理。两条线各有取舍。

由此带来一个后果，也是本仓库的主题：**上游修过的一些 bug，vendor 这条线里还在**，而这些代码 DSH 每天都在跑。

## 十二条，每条都复现过

每一行都用**同一份探针**在 vendor 包和上游 `cordis@4.0.0-rc.10` 上各跑一次得到，除此之外没有任何其他改动。探针在 [`probes/`](probes)。

| 上游 | 位置 | 补丁前 → 补丁后 |
|---|---|---|
| [`eb5604d`](https://github.com/cordiverse/cordis/commit/eb5604d) (#32) | `cordis/src/logger.ts` | `LoggerLevel` 里 `INFO` 和 `WARN` 顺序反了，而导出器的**默认阈值就是这个 `INFO`**——所以默认级别下 **`ctx.logger.warn()` 被静默丢弃** |
| [`be7d36e`](https://github.com/cordiverse/cordis/commit/be7d36e) (#37) + [`4cfd19a`](https://github.com/cordiverse/cordis/commit/4cfd19a) | `cordis/src/utils.ts`, `reflect.ts` | 可调用服务的 shadow 丢失，`ctx.foo.bar` 归属错上下文——服务能访问没声明的服务，声明了反而在嵌套上下文访问不到 |
| [`988df36`](https://github.com/cordiverse/cordis/commit/988df36) (#68) | `cordis/src/context.ts` | 可选属性没加 `| undefined`，开了 `exactOptionalPropertyTypes` 的使用者无法赋 `undefined`——纯类型层，无运行时变化 |
| [`10194de`](https://github.com/cordiverse/cordis/commit/10194de) (#98) | `cordis/src/fiber.ts` | `FAILED` 的 fiber 在依赖刷新时**重新进入生命周期**——已经抛过错的插件 `apply` 被反复执行 |
| [`752dbee`](https://github.com/cordiverse/cordis/commit/752dbee) (#40) | `cordis/src/fiber.ts` | `plugin()` 返回的是 `Object.create(fiber)` wrapper；通过 `this` 写生命周期字段会在 **wrapper 上多出一份**，遮蔽真 fiber 的那份——配置更新后两者分叉，卸载后 wrapper 仍报 `ACTIVE` |
| [`2ceea23`](https://github.com/cordiverse/cordis/commit/2ceea23) (#109) | `cordis/src/fiber.ts` | `Fiber.update()` 返回 `undefined`；被丢弃时产生 `unhandledRejection: 'boom'` → 返回 task，可被 await 捕获，不再泄漏 |
| [`1b7d0f2`](https://github.com/cordiverse/cordis/commit/1b7d0f2) | `loader/src/config/{entry,group,isolate}.ts` | `await loader.update()` 返回时新子条目**还没有 fiber** → 返回时已协调完毕 |
| [`5b195b3`](https://github.com/cordiverse/cordis/commit/5b195b3) (#44) | `cordis/src/events.ts` | 监听器二次 `next()` 会**静默**把下游整条链再跑一遍 → 抛 `next() called multiple times` |
| [`cb77029`](https://github.com/cordiverse/cordis/commit/cb77029) (#53) | `timer/src/index.ts` | 并发 2~3 个 `next()` 等待者**全部超时** → 全部按序结算 |
| [`1c1a10e`](https://github.com/cordiverse/cordis/commit/1c1a10e) (#51) | `cordis/src/events.ts` | `ctx.on('toString', …)` 抛 `hooks[method] is not a function` → 正常注册 |
| [`fd96b0a`](https://github.com/cordiverse/cordis/commit/fd96b0a) (#36) | `cordis/src/logger.ts` | 外部持有的 `ctx.logger.buffer` **持续增长**、超出上限 → 稳定在有界范围内 |

## 对上游没有的那部分代码的验证

[`verify/`](verify) 覆盖这个代码树里**唯一没有上游对应物**的部分：`volatile` 配置机制
（`cosmokit/src/volatile.ts`、schemastery 的支持、`loader/src/config/diff.ts`）。
上游一样都没有——所以和上面的回移补丁不同，**这部分从没被写它的人之外的人读过**。

简短结论：`equalExceptVolatile`——那个决定配置变更要不要重挂载的函数——经得起
5000 组定种子配置对加定向边界用例。发现一处缺失的守卫；它在
[`verify/README.zh.md`](verify/README.zh.md) 里被论证为不可达，而**这个论证比缺陷本身更重要**，
因为**两处缺失的守卫互相遮蔽**，只修任何一处都会让另一处变成活的。

## 对核心做模糊测试

[`fuzz/`](fuzz) 用定种子的随机生命周期驱动 fiber 状态机，检查那些无论如何都该成立的不变量：
静默后状态落定、effect 记账精确、`ctx.get()` 永不返回已死提供者的值、嵌套 fiber 的级联释放。
四个 fuzzer，最后一个**连发操作、中间不 settle**。

[#175](https://github.com/cordiverse/cordis/pull/175) 就是这么找到的——**在激活前被 dispose 的 fiber
永远不释放它的 disposables**，这是把两个版本对着读多少遍都看不出来的。
它也抓出了我自己两条不变量的错，记在 [`fuzz/README.md`](fuzz/README.md) 里。

## 回移补丁

[`backport/`](backport) 里有三个补丁——`cordis@4.0.4`、`cordis-plugin-loader@1.0.5`、`cordis-plugin-timer@1.1.6`——覆盖上面全部六条。它们能**干净应用于未改动的 4.0.4 源码**，验证方式与审计相同：补丁前跑一次探针，补丁后再跑一次。

注意每个补丁**同时改了 `src/*.ts` 和 `lib/index.js`**。因为这些包的 `exports` 指向打包产物，只改 `src` 不会改变实际运行行为；两半都给，**你们不重新构建就能直接验证**。

## 动手前值得知道的两件事

**① "看起来没变"的那几行，恰恰是关键。**

`1b7d0f2` 里有这样一处，读起来像格式调整：

```diff
-    ctx.on('internal/update', (config) => {
-      this.update(config)
-    })
+    ctx.on('internal/update', config => this.update(config))
```

**它不是。** 前者返回 `undefined`，后者隐式返回了 promise——而 waterfall 会把监听器的返回值一路传到 `Fiber.update` 的调用方。**等待链真正断裂的地方就在这里。**

我一开始把它当格式调整跳过了，结果只改 `entry.ts` 和 `isolate.ts` 时探针**仍然失败**；补上这一处才通。

**②"上游新增的行在本地找不到" ≠ "这个修复缺失"。**

两条线都经历过重构。我第一遍用行匹配扫上游提交日志，跑出**十二个**"基本全缺"；逐个核实后，有几个只是同一个功能换了个写法（`be7d36e` #37）。

**但其中一条我判错了：** `752dbee`（#40）被我标成"已有"，因为它涉及的标识符在本地全都能找到。**可它改的是赋值的*接收者***——`this.assertActive()` 变成 `const fiber = this.ctx.fiber; fiber.assertActive()`——**任何基于名字的检查都看不见。**

它最后是**靠模糊测试**找出来的，就是上面第七条。更正说明写在 [`backport/README.md`](backport/README.md)。所以这里每条都必须落到**可观测的行为差异**上才算数——这也是为什么每条都配探针，而不是只贴 diff。

**刻意没有包含的：**

- `8abd903`（#35，caller 追踪）——`symbols.caller` 在本地**完全不存在**，这属于加新功能而不是修 bug，不适合夹在回移里。
- `c594d1a`（#121）和 `c2835d8`（#123）——本地的 include 是**有意分叉**：它主动否决 fiber restart 并自行持久化配置，代码里有注释说明原因。要不要跟上游，属于产品决策，不是 bug 回移。

## 跑探针

探针需要两套模块树：一套解析 `@deepseek-ai/*`（vendor 包），一套解析 `cordis` / `@cordisjs/*`（上游）。搭建方式、以及让同一份探针跑在两边的模块名替换命令，见 [`probes/README.md`](probes/README.md)。
