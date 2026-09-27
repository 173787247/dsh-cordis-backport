# dsh-wsl-new — 十个新插件的构建工作区

2026-09-27。为 `github.com/173787247` 建了 10 个 DeepSeek Harness 插件，
补上 WSL ↔ Windows 之间缺失的一层能力，并准备提交到
[awesome-dsh-plugin](https://awesome-dsh-plugin.com/)。

---

## 十个插件

### Windows 桌面操作（闭环）

| 仓库 | 工具 | 做什么 |
|---|---|---|
| `dsh-wsl-uia` | `uia_tree` | **观测**：列出顶层窗口；读取有界的 UI Automation 元素树，每个元素带 `name`/`controlType`/`rect`/`enabled`/`patterns` |
| `dsh-wsl-wininput` | `win_invoke` | **动作**：按元素**名**调用 UIA 元素；定向键盘；窗口内坐标点击 |
| `dsh-wsl-winshot` | `win_shot_window` | **抓屏**：按 pid 或前台窗口截图到 WSL 文件 |
| `dsh-wsl-winctl` | `win_windows` | **窗口生命周期**：枚举 / 激活 / 最小化 / 最大化 / 还原 / 移动 / 关闭 |

这四个合起来是 `Anionex/dsh-computer-use`（macOS）在 Windows 上的对应物。
**提交前查过：`UI Automation`、`screen capture`、`window control`、`keyboard input`
在 awesome 列表 4367 条里是零覆盖。**

### Windows 宿主能力

| 仓库 | 工具 | 做什么 |
|---|---|---|
| `dsh-wsl-perf` | `win_perf` | CPU / 内存 / 磁盘 / 占内存最高的进程 |
| `dsh-wsl-service` | `win_services` | Windows 服务状态（有 `systemd` 是 WSL 内视角，缺宿主侧） |
| `dsh-wsl-eventlog` | `win_eventlog` | 事件日志，按日志名与级别 |
| `dsh-wsl-registry` | `win_reg` | 注册表**只读**，白名单键前缀 |
| `dsh-wsl-defender` | `win_defender` | Defender 防病毒 + 防火墙各 profile |
| `dsh-wsl-power` | `win_power` | 电源方案 / 电池 / 睡眠设置 |

---

## ★ 真靶测试抓到 11 个单元测试抓不到的 bug

**这是本次最重要的产出，不是代码量。**

| # | bug | 后果 |
|---|---|---|
| 1 | PowerShell **展平嵌套数组**：`@(@('a',$x),…)` 变 12 个标量 | `TryGetCurrentPattern` 抛错被吞 → **元素树永远为空** |
| 2 | `Queue.Enqueue(@($a,$b))` **拆包** | `$item[0]` 拿到元素本身 → **BFS 一个节点都走不到** |
| 3 | 控制台代码页 | 非 ASCII 标题变 `��` |
| 4 | `[int]$rect.Width` 对**最小化窗口**抛错（±∞/NaN） | 被 catch 吞掉，窗口静默丢失 |
| 5 | `.replace("NAME")` **误匹配 `LOGNAME`** | 生成的脚本被改坏 |
| 6 | `$item.$'Name'` 不是合法 PowerShell | registry 完全不可用 |
| 7 | **registry 守卫漏放自启动项**：`\Run\` 要求尾部反斜杠 | `...\CurrentVersion\Run` **被放行** |
| 8 | `height = $h`（`$ht` 写成 `$h`，`$h` 是窗口句柄） | 报出 `1936x4915734` |
| 9 | **`$pid` 是 PowerShell 只读自动变量** | 拿它当参数名 → 函数无法调用，三个动作全挂 |
| 10 | ★ **index 作为元素标识在活动 UI 上不可靠** | 两次遍历同一棵树，同 index 指向不同元素 → **点到错的控件** |
| 11 | GitHub topics API 是**替换**不是追加 | 逐个 PUT 只剩最后一个 |

**#10 是设计缺陷**：原设计用 `epoch.index` 形式的 handle 定位元素。实测发现
两次独立遍历同一棵活动树，同一个 index 指向不同元素——**index 是"一张已经动过的
照片里的位置"**。改成**按身份查找**：调用方声明 `expectName`（必填）+ `expectType`
（可选），工具遍历查找并**要求唯一匹配**——0 个 = 元素没了，多个 = 名字不够具体，
**两种情况都拒绝**。

这与 `dsh-computer-use` 的纪律一致：

> **No blind replay: every action is tied to an exact, unexpired observation and returns fresh state.**

**两个（#1 #2）会让功能完全静默失效，一个（#7）是安全漏洞。**

---

## 测试

```
dsh-wsl-uia        25    dsh-wsl-wininput   10    dsh-wsl-winshot     9
dsh-wsl-winctl      8    dsh-wsl-perf        4    dsh-wsl-service     3
dsh-wsl-eventlog    3    dsh-wsl-registry    3    dsh-wsl-defender    4
dsh-wsl-power       8
─────────────────────────────────────────────────
合计 77，全部通过
```

单元测试覆盖纯逻辑（normalize / format / 守卫 / 句柄解析），**任何平台都能跑**。
`dsh-wsl-uia` 另有 3 个实时冒烟测试，WSL 之外自动跳过。

---

## 提交前的机械核对

`_shared/verify-entries.mjs` 逐条核对每个条目对代码的声明——因为收录评审明确说
**夸大是唯一会让好插件被打回的原因**：

```
✓ 条目文本 == package.json 的 description
✓ url 指向本仓库          ✓ category 是 wsl
✓ 声明了 dsh.bundle.patch ✓ 补丁文件存在
✓ 注册的工具名在代码里存在 ✓ README 用法里提到的工具都存在
✓ 无营销词                ✓ 未声称任何未经核实的数量
──────── all claims check out
```

---

## 提交排期

`_shared/submit-awesome.sh` —— 约束全部来自 `contributing.md`：

- 仓库**满 1 天**（他们的 CI 会查）
- **一个插件一个 PR**，只加一个文件 `data/plugins/173787247__<repo>.yml`
- 条目文本必须与该仓 `package.json` 的 description **逐字一致**

每天最多 3 个。脚本对已收录和未满 1 天的都会跳过，**重复运行是安全的**。

```
cron:  7 10 * * *  ~/.dsh/awesome-submit/run.sh
日志:  ~/.dsh/awesome-submit/log.md
```

10 个仓建于 2026-09-27，所以第一次真正提交在 **09-28**，之后每天 3 个，4 天完成。

---

## 收录规则里的两处更正

**① 你 k8s 仓里的 draft 注释过时了。** 它写着
*"submit after repo age >=1 day and **10+ commits**"*，但现行规则明确说：

> The repo is at least **1 day old**. (**There is no commit-count bar**: history
> length measures development habit, not quality — see #4196.)

**② "PR 要超过十个"不是现行规则。** 现行只要求一个插件一个 PR、只加一个文件。

---

## 目录

```
_shared/
  scaffold.mjs          生成 10 个仓的骨架
  gen-simple.mjs        6 个宿主能力插件的定义（含 PowerShell）
  gen-simple3.mjs       生成它们的 exec + index
  gen-docs.mjs          4 个桌面操作插件的 README
  gen-docs2.mjs         6 个宿主能力的 README
  gen-zh.mjs            中文版 README
  verify-entries.mjs    条目声明 vs 代码的机械核对
  push-all.sh           建仓 + 推送 + 设 topics
  fix-metadata.sh       修已有 73 个仓的 about 与 topics
  submit-awesome.sh     排期提交
```

---

## 顺带修的：已有仓库的元数据

审计了全部 **73 个 `dsh*` 仓**：

```
缺 topics:  19  →  0
占位 about: 21  →  0      （原来是 "DeepSeek Harness WSL plugin (dsh-wsl-x)"）
```

about 改成**已发布的 awesome 条目里的英文描述**——那是权威来源，措辞已过审并
对照过代码。

**一个 judgment call**：`dsh-wsl-common` 是共享库、`package.json` 里没有
`dsh.bundle`，所以**没给它 `dsh-plugin` topic**——给它打这个标签就是在声称它不是的
东西，而那正是评审会查的那类夸大。
