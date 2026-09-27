# DSH 插件全集：架构

> 数据来源：GitHub API 73 个仓 + profile `node_modules` 44 个已装包
> 判据：`package.json` 的 `dsh.bundle` 字段

## 一、先纠正一个前提

**不是所有 `dsh*` 仓都是插件。** 73 个里：

| 类别 | 数量 | 判据 |
|---|---:|---|
| **插件** | **70** | `package.json` 有 `dsh.bundle` |
| 共享库 | 1 | `dsh-wsl-common` —— 无 `dsh` 字段 |
| 脚本/文档仓 | 1 | `dsh-wsl-kit` —— 无 `package.json` |
| 审计文档仓 | 1 | `dsh-cordis-backport` —— 无 `package.json` |

70 个插件里还有 5 个**不新增工具**，它们包装现有能力：
`dsh-repeat-stop` / `dsh-tool-budget`（拦 `ctx.tools`）、
`dsh-wsl-env`（只写 systemPrompt）、
`dsh-wsl-fetch`（替换 `ctx.web` provider）、
`dsh-wsl-open`。

## 二、共享代码是复制分发，不是 import

这是整套架构里最要紧的一条，因为它决定了改一个 helper 要动多少地方。

```
dsh-wsl-common/lib/wsl-host.js          7ab22bf5be   ← 规范源
        │
        │  dsh-wsl-kit/scripts/sync-wsl-common.mjs
        ▼
25 个 dsh-wsl-* 插件的 lib/wsl-host.js   7ab22bf5be   ✓ 一致
 dsh-wsl-obsidian/lib/wsl-host.js        838a7bc691   ★ 已漂移
```

26 份副本，**2 个版本**。`dsh-wsl-common` 不是被依赖的包，是**源头**；
插件各持一份拷贝，靠脚本同步。只有 `dsh-device-bridge` 与 `dsh-mac-companion`
真正 `import` 了其中的 `companion_client`。

**`dsh-wsl-obsidian` 那一份没同步上** —— 它的头注释仍写着
"Canonical copy — sync to plugins via dsh-wsl-kit/scripts/sync-wsl-common.mjs"，
说明它是从源头拷出来的，但之后源头变了而它没跟上。

## 三、装入方式

```json
"github:173787247/dsh-repeat-stop"                      32 个
"link:/mnt/c/Users/rchua/Desktop/AIFullStackDevelopment/<repo>"   12 个
```

零个发布到 npm（`npm view dsh-wsl-systemd` → 404）。全部走 GitHub 或本地链接。

## 四、未挂载

19 个仓有 `dsh.bundle`，但不在 profile 依赖里 —— 代码写完，agent 看不到：

| 层 | 未挂载 |
|---|---|
| 宿主观察 | `dsh-wsl-systemd` |
| 桌面观察 | `dsh-wsl-playwright` |
| 文件与检索 | `dsh-wsl-pkg` `dsh-wsl-rclone` `dsh-wsl-tmux` |
| 文档与媒体 | `dsh-wsl-db` |
| 模型推理 | `dsh-wsl-llamacpp` `dsh-wsl-vllm` |
| 远程与协作 | `dsh-wsl-cal` `dsh-wsl-git` `dsh-wsl-glab` `dsh-wsl-mail` |
| 云与编排 | `dsh-wsl-compose` `dsh-wsl-helm` `dsh-wsl-terraform` |
| 结构治理 | `dsh-wsl-struct` |

（`dsh-wsl-common` 与 `dsh-wsl-kit` 不是插件，不该按插件挂载。）

## 五、可动的三件事

1. **同步 `dsh-wsl-obsidian` 的 `wsl-host.js`** —— 一份文件，消除唯一的副本漂移
2. **把 12 个 `link:` 改成 `github:`** —— 与其他 32 个一致，且脱离 Windows NTFS
3. **补挂 19 个已完成插件** —— 逐个验证 `dsh.bundle` 生效再装

第 1 件无风险。第 2、3 件动 profile 的 `package.json` 并重装依赖，
**会短暂影响正在跑的服务**，所以时机要挑。
