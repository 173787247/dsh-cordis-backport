# 判定：`EntryGroup.update` 的并发重入 **不是**上游缺陷

对应文档：`.agents/notes/archived/bug-fix/2026-08-03-hmr-initial-scan-boot-deadlock.md`

**结论：该文档描述的卡死无法归因于 `EntryGroup.update` 本身。两条线在并发重入下都正确收敛。** 不构成发现，不提上游。

---

## 文档声称什么

> **"The group's transactional `update` is not reentrant, so serialization is a correctness requirement, not a throughput choice."**
>
> Two concurrent `EntryGroup.update` calls on one group interleave create and rollback on the same entries, and the Include fiber never settles — `loader.create` hangs, `boot()` neither resolves nor rejects, and Node exits 13 with no diagnostic.

## 怎么测的

构造一个 group，成员 `[a]`；插件 `slow` 的 apply 睡 80ms 制造窗口。然后：

```js
const p1 = group.update([{id:'a'},{id:'s',name:'slow'}])   // 加入 s
await sleep(15)                                            // p1 已进入 slow 的 apply
const p2 = group.update([{id:'a'}])                        // 撤回 s，与 p1 并发
await Promise.all([p1, p2])
```

## 结果

```
              结果          group.data    store              slow apply
上游（纯净）  both-settled  [a]           a:ACTIVE g:ACTIVE  1 次
DSH 4.0.4     both-settled  [a]           a:ACTIVE g:ACTIVE  1 次
```

**两边都结算、都收敛到 `[a]`、都只 apply 一次。无分歧。**

## 为什么文档描述的卡死没复现

**因为它需要三层同时在场，而 `EntryGroup.update` 只是其中一层：**

1. `EntryGroup.update` 的并发（我测的这一层）
2. **`Include.refresh()` 与初始 apply 竞争**——`this.content`（去重键）只在 apply 之后提交
3. **HMR 的初始扫描**触发那个 refresh，且 HMR 拆解时要排空 refresh 任务

文档自己说卡死是 `rollback 等 HMR → HMR 等 refresh → refresh 等 apply` 的**环**。**只要没有第 2、3 层，环就不成立**——而我的场景里没有 Include，也没有 HMR。

## 顺带查到的两件事

**① 上游的 include 已经串行化了**，DSH 的机制不同：

```
上游 include    _draining / _drain() / _loop()           ← 串行队列
DSH include     writeQueue（写持久化用）                  ← 不同用途
```

所以"per-Include promise queue 串行化"这一条**不是 DSH 独有的修复**——上游有等价物。

**② DSH 这个版本根本没有 vendor hmr。** 实际装的是 5 个包：

```
cordis · cordis-plugin-loader · cordis-plugin-group · cordis-plugin-include · cordis-plugin-timer
```

`@deepseek-ai/cordis-plugin-hmr` **不在其中**——vendor 表里列了它（1.0.15），但当前安装版本（0.1.7-alpha.2）没有。**所以那篇文档的另一半修复对当前版本不适用。**

（DSH 有 `dsh-hmr`，但那是它自己的插件，不是 vendored 的 cordis 包。）

## 方法上的记录

**这次我先读代码再写场景**，因此一次就对。前面连续四个场景 bug，根因是我在读 `loader.store[id].data`——**而 group 对象挂在 `entry.subgroup` 上**（`EntryGroup` 构造器里 `entry.subgroup = this`）。

**"先读被测代码的构造路径，再写复现"这条，比任何调试技巧都省时间。**
