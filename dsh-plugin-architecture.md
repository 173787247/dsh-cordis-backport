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
26 个 dsh-wsl-* 插件的 lib/wsl-host.js   7ab22bf5be   ✓ 全部一致
```

**26 份副本，内容完全相同。** `dsh-wsl-common` 不是被依赖的包，是**源头**；
插件各持一份拷贝，靠脚本同步。只有 `dsh-device-bridge` 与 `dsh-mac-companion`
真正 `import` 了其中的 `companion_client`。

### 一处更正

早先的记录说 `dsh-wsl-obsidian` 的副本"漂移"了，因为 `md5` 不同
（`838a7bc691` vs `7ab22bf5be`）。**那是换行符差异，不是内容差异**：
obsidian 那份 1881 字节里有 57 个 CR，规范版 1824 字节有 0 个，
去掉 CR 后两份逐字节相同，5 个导出函数一个不差。

原因是 obsidian 装成 `link:` 指向 `/mnt/c/…`，Windows 侧的文件带 CRLF。

## 二·补、CRLF 的实际分布

`link:` 装的 12 个里有 5 个带 CRLF（也都是 `/mnt/c` 上的）：

| 插件 | 带 CRLF | 含 shell 脚本 | 会被插件执行 |
|---|---:|---|---|
| `dsh-wsl-jev` | 17/18 | 是，`scripts/` 下 8 个 | 否 |
| `dsh-wsl-im` | 14/33 | 是，6 个 | 否 |
| `dsh-remote-ssh` | 11/12 | 否 | — |
| `dsh-wsl-obsidian` | 9/9 | 否 | — |
| `dsh-device-bridge` | 8/8 | 否 | — |

**`.js` 带 CRLF 对 Node 无害**，这些插件都正常工作。
`scripts/*.sh` 里的 CRLF 只在你手动 `bash scripts/xxx.sh` 时才会失败
（`set -o pipefail\r` → `command not found`）。
两个插件都没有从 JS 里 spawn 这些脚本，package.json 也没挂。

**严重度低，影响面是运维脚本，不是插件运行时。**

### 测量方法的一处更正

判断"某插件有没有 .sh"时，`find "$P/$r" -name '*.sh'`、`grep -r --include='*.sh'`
都会给出错误的空结果或错误计数：**`link:` 装的包在 `node_modules` 里是符号链接，
`find` 默认不跟进，`grep -r` 的行为也不一致。** 需要 `find -L` 或
`readlink -f` 先解析真实路径。本节的数字来自 `_shared/crlf-survey.mjs`
（用 `readdirSync` + `statSync`，会跟进链接），并用 `find -L` 复核过。

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
