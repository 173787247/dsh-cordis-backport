# DSH 插件盘点（补充材料）

> **架构的权威来源是 [`dsh-wsl-kit`](https://github.com/173787247/dsh-wsl-kit) 自己的文档：**
> [README.md](https://github.com/173787247/dsh-wsl-kit/blob/main/README.md)（How the pieces fit / Install sets / 边界表）
> [docs/OPTIONAL_PLUGINS.md](https://github.com/173787247/dsh-wsl-kit/blob/main/docs/OPTIONAL_PLUGINS.md)
> [docs/CALL_CHAINS.zh.md](https://github.com/173787247/dsh-wsl-kit/blob/main/docs/CALL_CHAINS.zh.md)
> [docs/ENHANCEMENT_QUEUE.zh.md](https://github.com/173787247/dsh-wsl-kit/blob/main/docs/ENHANCEMENT_QUEUE.zh.md)
>
> 本文**不重复**那些内容。它只补三样 kit 里没有的：一份可核对的清点、
> 一次磁盘上的实测、以及一条撤回过的话。

## 一、清点（可核对）

判据是 `package.json` 的 `dsh.bundle` 字段，逐个查过 73 个 `dsh*` 仓：

| 类别 | 数量 |
|---|---:|
| 插件 | 70 |
| 共享库 `dsh-wsl-common` | 1 |
| 脚本/文档仓 `dsh-wsl-kit` | 1 |
| 审计文档仓 `dsh-cordis-backport` | 1 |

**70 个里有 5 个不新增工具**，它们包装既有能力：`dsh-repeat-stop`、
`dsh-tool-budget`（拦 `ctx.tools`）、`dsh-wsl-env`（只写 systemPrompt）、
`dsh-wsl-fetch`（替换 `ctx.web` provider）、`dsh-wsl-open`。

## 二、撤回过的话

本文早先写过三个"结构性问题"，**三个都不是问题**：

| 早先的说法 | 实际 |
|---|---|
| 「19 个仓建好没挂载」 | `OPTIONAL_PLUGINS.md` 开头即写明："These are **not** in `install.sh` / Daily. Install as needed." 可选就是可选。 |
| 「12 个插件挂在 Windows NTFS 上是隐患」 | 那正是 kit 的 `scripts/link-linux-plugins.sh` 与 `link-remote-bridges.sh` 的行为。浏览器在 Windows、agent 在 WSL，仓库检在 Windows 侧是有意的。 |
| 「零个发到 npm」 | 属实，但 `github:` 直装本来就是选定方案，不是缺口。 |

早先还写过 `dsh-wsl-obsidian` 的 `wsl-host.js`「漂移」了。**那是换行符差异：**
obsidian 那份 1881 字节含 57 个 CR，规范版 1824 字节含 0 个；去掉 CR 后两份
逐字节相同，5 个导出函数一个不差。原因就是它是 `link:` 到 `/mnt/c` 的安装。

## 三、共享代码是复制分发

kit 的 `docs/CALL_CHAINS.zh.md` 提到 `companion_client` 由 mac 与 device-bridge
共用。补一条实测：**分发方式是复制，不是 import。**

```
dsh-wsl-common/lib/wsl-host.js         1824 字节   ← 规范源
        │  dsh-wsl-kit/scripts/sync-wsl-common.mjs
        ▼
26 个 dsh-wsl-* 插件的 lib/wsl-host.js  1824 字节   ✓ 逐字节相同
```

26 份副本，**内容全同**，只有 obsidian 那份因 CRLF 而字节数不同、内容相同。
真正 `import` 了 common 的只有 `dsh-device-bridge` 与 `dsh-mac-companion`
（用其中的 `companion_client`）。

**新建插件时应继续自带一份 `wsl-host.js` 副本** —— 与现有 26 个一致。

## 四、磁盘上的 CRLF 实测

`link:` 装的 12 个里有 5 个带 CRLF，都在 `/mnt/c` 上：

| 插件 | 带 CRLF | 含 shell 脚本 | 会被插件执行 |
|---|---:|---|---|
| `dsh-wsl-jev` | 17/18 | 是，`scripts/` 下 8 个 | 否 |
| `dsh-wsl-im` | 14/33 | 是，6 个 | 否 |
| `dsh-remote-ssh` | 11/12 | 否 | — |
| `dsh-wsl-obsidian` | 9/9 | 否 | — |
| `dsh-device-bridge` | 8/8 | 否 | — |

**`.js` 带 CRLF 对 Node 无害**，这些插件都正常工作。
`scripts/*.sh` 的 CRLF 只在你手动 `bash scripts/xxx.sh` 时失败
（`set -o pipefail\r` → `command not found`）。两个插件都没从 JS spawn 它们，
`package.json` 也没挂。

**严重度低，影响面是运维脚本，不是运行时。** 要修就
`sed -i 's/\r$//' scripts/*.sh`。

## 五、测量方法上的一个坑

判断"某插件有没有 `.sh`"时，下面两条都会给出**错误的空结果**：

```sh
find "$P/$r" -name '*.sh'          # link: 装的包是符号链接，find 默认不跟进
grep -r --include='*.sh' "$P/$r"   # 行为不一致，计数不可信
```

需要 `find -L` 或先 `readlink -f` 解析。本文第四节的数字来自
`crlf-survey.mjs`（`readdirSync` + `statSync`，会跟进链接），
并用 `find -L` 复核过。
