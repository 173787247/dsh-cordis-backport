# verify

[English](README.md) | **中文**

对这个代码库里**上游完全没有对应物**的那部分做的验证：`volatile` 配置机制——DeepSeek Harness 在 cordis 之上自己加的那套。

上游一样都没有：没有 volatile 的 schema 支持、没有 `cosmokit/src/volatile.ts`、没有 `cordis-plugin-loader/src/config/diff.ts`。所以和 [`../backport`](../backport) 里那些不同，**这部分从没被写它的人之外的人读过**。

## 验证了什么

`equalExceptVolatile(previous, next, schema)` 判断一次配置变更是否只涉及 volatile 字段。加载器把返回 `true` 读作**"不用重挂载"**——所以**一个假的 `true` 会静默吞掉真实的配置变更**。这是唯一值得较真的性质，也是 `diff-fuzz.mjs` 主要压的地方。

| | 结果 |
|---|---|
| 5000 组定种子随机配置对 —— 安全性 / 自反性 / 对称性 | 全部成立 |
| default、数组、未知键、嵌套（定向用例） | 全部正确 |
| 存在但没有 `~standard` 的 `Config` | 抛错 —— 见下 |

## 那一处缺陷，以及它为什么咬不到人

`isSchemastery` 守住了 `schema`，但没守住它穿过去的那一层：

```ts
function isSchemastery(schema: Plugin.Runtime['Config']): schema is Schema {
  return schema?.['~standard'].vendor === 'schemastery'
}
```

存在但缺 `~standard` 的 `Config` 会得到 `undefined.vendor`。但它**不可达**，原因值得写下来——因为这是**巧合，不是设计**：

- `equalExceptVolatile` 的调用被 `this.fiber.state === FiberState.ACTIVE` 短路守卫着（在 `Entry.update` 里）。
- 而 `Config` 缺 `~standard` 的插件**永远到不了 ACTIVE**：`cordis/src/fiber.ts` 的 `resolveConfig` 缺的是**同一个守卫**——

  ```ts
  if (!runtime.Config) return config
  const result = runtime.Config['~standard'].validate(config)
  ```

  所以这类插件在加载阶段就失败了，根本走不到这个函数。

**两处缺失的守卫互相遮蔽。** 只修任何一处，另一处立刻变成活的。这也是我把它写成文档而不是补丁的原因：要修就得两处一起修，而且这是个小的健壮性问题，不是谁正在踩的坑。

## 一处记录在案、但不作为断言的行为

`??` 把 `null` 和 `undefined` 一视同仁，所以对象缺省时会落到 schema 默认值，`null` 也会，而 `{}` 不会：

```
{}    vs 缺省（有默认值）  → false
null  vs 缺省（有默认值）  → true
```

当前代码树里没有任何地方依赖这个行为。插件是否应该能用 `null` 表达"显式清空"是个设计问题，所以这里只打印、不断言。

## 怎么跑

`diff.ts` 位于 `node_modules` 内，而 Node 拒绝对那里做类型剥离，所以需要先把源码拷出来、给它独立的模块树：

```bash
D=/path/to/dsh/node_modules
mkdir -p /tmp/dsh-src/node_modules/@deepseek-ai
cd /tmp/dsh-src
cp -r "$D/@deepseek-ai/cordis-plugin-loader/src" ./loader-src
printf '{"name":"dsh-src","type":"module","private":true}\n' > package.json
for p in cordis cosmokit schemastery; do
  ln -sfn "$D/@deepseek-ai/$p" "node_modules/@deepseek-ai/$p"
done
```

然后在 `/tmp/dsh-src` 下：

```bash
node /path/to/verify/diff-fuzz.mjs     # 默认 DSH_DIFF=./loader-src/config/diff.ts
node /path/to/verify/diff-edge.mjs
```

`DSH_DIFF` 可覆盖模块路径，`CASES` 可覆盖迭代次数。

## 同一类写法的其它位置

`resolveConfig` 和 `isSchemastery` 属于**同一类遗漏**，对应上游尚未合并的
[#141](https://github.com/cordiverse/cordis/pull/141)（*guard resolveConfig against Config without Standard Schema V1*，上游 issue #102，**至今 open**）。

实测对照：**上游 rc.10 的 `resolveConfig` 遇到这种 Config 会抛**
`TypeError: Cannot read properties of undefined (reading 'validate')`，
**而这条线恰好绕开了**——因为它把配置解析放在状态检查之后，而不是之前。
