# backport

[English](README.md) | **中文**

上游已修、但 vendor 这条 cordis 线尚未跟进的六个 bug，以补丁形式给出，针对
`@deepseek-ai/*@4.0.4` / `1.0.5` / `1.1.6`。

| 补丁 | 包 | hunk |
|---|---|---|
| `cordis-4.0.4.patch` | `@deepseek-ai/cordis@4.0.4` | 8 |
| `cordis-plugin-loader-1.0.5.patch` | `@deepseek-ai/cordis-plugin-loader@1.0.5` | 13 |
| `cordis-plugin-timer-1.1.6.patch` | `@deepseek-ai/cordis-plugin-timer@1.1.6` | 5 |

每个补丁**同时改了 `src/*.ts` 和 `lib/index.js`**。因为这些包的 `exports` 映射指向打包产物，
只改 `src` 不会改变实际运行行为。`src` 那一半是提交进仓库用的；`lib` 那一半是为了
**不重新构建就能验证**——我就是这么验的。`lib` 是 esbuild 产物、未压缩，可读可手改。

## 包含内容

| 上游 | 文件 | 补丁前 → 补丁后 |
|---|---|---|
| `2ceea23` (#109) | `cordis/src/fiber.ts` | `update()` 返回 `undefined`；被丢弃时产生 `unhandledRejection: 'boom'` → 返回 task、可被 await 捕获、不再泄漏 |
| `1b7d0f2` | `cordis-plugin-loader/src/config/{entry,group,isolate}.ts` | `await loader.update()` 返回时新子条目还没有 fiber → 返回时已协调完毕 |
| `5b195b3` (#44) | `cordis/src/events.ts` | 下游静默跑了 3 次 → 跑 2 次并抛 `next() called multiple times` |
| `cb77029` (#53) | `cordis-plugin-timer/src/index.ts` | 并发 2~3 个等待者全部超时 → 全部按序结算 |
| `1c1a10e` (#51) | `cordis/src/events.ts` | `ctx.on('toString', …)` 抛 `hooks[method] is not a function` → 正常注册 |
| `fd96b0a` (#36) | `cordis/src/logger.ts` | 外部持有的 `ctx.logger.buffer` 从 2 涨到 3 并持续增长 → 稳定在 2 |

每一行都是一次补丁前探针 + 一次补丁后探针；探针在 [`../probes`](../probes)。

## 那处看起来不像修复的改动

`1b7d0f2` 里包含这么一段，读起来像格式调整：

```diff
-    ctx.on('internal/update', (config) => {
-      this.update(config)
-    })
+    ctx.on('internal/update', config => this.update(config))
```

**它不是。** 前者返回 `undefined`，后者隐式返回了 promise，而 waterfall 会把监听器的
返回值一路传到 `Fiber.update` 的调用方。**等待链断裂的地方就在这里。**

只改 `entry.ts` 和 `isolate.ts` 时探针**仍然失败**；补上这一处才通过。
跨这两行做 cherry-pick 的同学请留意。

## 应用方式

```bash
cd <dsh 安装路径>/node_modules/@deepseek-ai

for f in cordis-4.0.4 cordis-plugin-loader-1.0.5 cordis-plugin-timer-1.1.6; do
  git apply --check /path/to/$f.patch && git apply /path/to/$f.patch
done
```

三个补丁均已验证能干净应用于**未改动的 4.0.4 源码**，应用结果与产出上面那些
前后对照数据的工作区**逐字节一致**。

## 适用范围

- 只针对 **4.0.4 这一版源码**。DSH 升级后需要重新对齐。
- **不含** `8abd903`（#35，caller 追踪）。`symbols.caller` 在本地完全不存在，
  属于加功能而非修 bug。
- **不含** `c594d1a`（#121）和 `c2835d8`（#123）。本地的 include 是**有意分叉**——
  它主动否决 fiber restart 并自行持久化配置，代码里有注释说明原因。要不要跟上游
  属于产品决策。
