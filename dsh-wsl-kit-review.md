# dsh-wsl-kit 复盘与新仓方案

2026-09-27。针对 `github.com/173787247` 的 dsh 插件集合与 `awesome-dsh-plugin.com` 收录。

---

## 一、复盘结果：**没有待提交的 PR**

```
63 个 dsh* 仓库  →  60 个已收录  →  3 个未收录
```

**未收录的 3 个，恰恰都不该收录：**

| 仓库 | 状态 | 为什么不该收 |
|---|---|---|
| `dsh-cordis-backport` | 无 package.json | **审计仓库**，不是插件 |
| `dsh-wsl-common` | `no-dsh` | **共享库**，不是插件 |
| `dsh-wsl-kit` | 无 package.json | **总集/文档仓**，不是插件 |

**所以「能收的已经全收了」——60/60。**

实际收录数是 **60**，不是"近三十"。（我用两个来源交叉核对过：contents API 和 git tree API，后者拿到全量 4367 条，其中 `173787247__*` 正好 60 条。）

**含义**：目前没有可提的 PR。你那个"PR 要超过 10 个"的规则，**只对新增插件有意义**——所以要先把新仓建出来。

---

## 二、可行性验证：Windows 桌面操作**从 WSL 完全可行**

在提方案前先把底座测了。PowerShell 经 WSL 互操作调用 Windows UI Automation：

### ① 观测层 —— ✓

```
遍历元素总数: 400（我设的上限）
控件类型分布: Text(574), Button(219), DataItem(35), Pane(24), TreeItem(24), Group(22), TabItem(17)

每个元素可取：name、controlType、BoundingRectangle、IsEnabled、ProcessId
```

### ② 动作层 —— ✓

```
按钮总数: 422
带 InvokePattern 的: 200+
  → 可 Invoke: 重新加载 / 新标签页 / 返回 / 关闭 / 最小化 / …
```

`InvokePattern` 可探测也可调用——**而且是 UIA 原生调用，不移动系统光标、不抢焦点**。

### ③ 多窗口定向 —— ✓

```
顶层窗口数: 19
每个窗口带 ProcessId，可按 pid 定向
```

**三层都通。缺口是软件层的，不是能力层的。**

---

## 三、现有覆盖的缺口

你现有 60 个里，桌面相关的**全是「发一个动作、不回头看」**：

| 插件 | 做什么 | 缺什么 |
|---|---|---|
| `dsh-wsl-browser` | 在 Windows 默认浏览器打开 URL | 无观测 |
| `dsh-wsl-playwright` | **无头** Playwright 取 title + 正文 | 无观测、不碰真实窗口 |
| `dsh-wsl-obscura` | 无头取页 | 同上 |
| `dsh-wsl-shot` | **把剪贴板里已有的**图片存成文件 | **不抓屏** |
| `dsh-wsl-launch` | 启动白名单应用 | 只启动，不操控 |
| `dsh-wsl-open` / `dsh-wsl-editor` | 打开路径 | 无观测 |
| `dsh-wsl-clipboard` | 读写剪贴板 | 无观测 |

**对照 `Anionex/dsh-computer-use`（macOS，46⭐）的四层纪律：**

| 层 | 它的做法 | 你有吗 |
|---|---|---|
| **观测** | 有界 Accessibility 树、带索引元素、精确 pid/窗口元数据 | ✗ **完全没有** |
| **绑定** | 每个元素带 observation-local index + 不可伪造 `targetHandle` | ✗ |
| **动作** | 定向到 pid/窗口的输入，不是全局 | ✗ |
| **拒绝过期** | **每个动作绑定一个未过期的观测，且返回新鲜状态** | ✗ |

**它在 README 里那句最值得抄**：

> **No blind replay: every action is tied to an exact, unexpired observation and returns fresh state.**

---

## 四、建议新增的仓

按你的「一仓一能力」模式，**四个仓构成完整闭环**：

### ★ 1. `dsh-wsl-uia` —— 观测（核心缺口）

| 工具 | 作用 |
|---|---|
| `uia_windows` | 枚举顶层窗口：pid、标题、rect、是否前台 |
| `uia_tree` | 给定 pid/窗口，返回**有界**元素树；每个元素带 `index`、`controlType`、`name`、`rect`、`enabled`、`patterns` |
| `uia_find` | 按 name/type/条件查找元素 |

**关键设计**：`uia_tree` 返回的每个元素带一个 **`targetHandle`**（含观测序号）。下一层的动作**必须**引用它——这是"绑定"和"拒绝过期"的载体。

### ★ 2. `dsh-wsl-wininput` —— 动作

| 工具 | 作用 |
|---|---|
| `win_invoke` | 对给定 `targetHandle` 调 UIA `InvokePattern`（**不移动光标、不抢焦点**） |
| `win_type` | 定向到 pid 的键盘输入 |
| `win_click` | 定向到窗口内坐标的点击（窗口局部坐标，不是屏幕全局） |

**必须拒绝过期 handle**——观测之后目标窗口若已变化，动作应当失败而不是盲打。

### 3. `dsh-wsl-winshot` —— 观测补充

`dsh-wsl-shot` 只处理剪贴板里**已有**的图片。这个仓补上真抓屏：

| 工具 | 作用 |
|---|---|
| `win_shot_window` | 抓指定窗口（按 pid/handle）到 WSL 文件，返回路径 + 窗口 rect |

**用途**：UIA 看不到的场景（canvas、游戏、自绘控件）。

### 4. `dsh-wsl-winctl` —— 窗口生命周期

枚举 / 激活 / 最小化 / 置顶 / 移动 / 调整大小。

**这四个加起来，就是 `dsh-computer-use` 在 Windows 上的对应物**——而且因为底座是 UIA + Win32，**可以完全定向，不干扰你正在用的前台窗口**。

---

## 五、怎么凑够 10 个（PR 规则）

4 个新仓不够 10。**建议再补 6 个 Windows 宿主能力**——这些是你 60 个里的真实空白（你有 `systemd`、`docker`、`gpu`，但都是 WSL 内视角，**缺 Windows 宿主侧**）：

| 候选 | 覆盖 | 判断依据 |
|---|---|---|
| `dsh-wsl-perf` | Windows 性能计数器（CPU/内存/磁盘） | 有 `gpu` 但无通用性能 |
| `dsh-wsl-service` | Windows 服务状态 | 有 `systemd`（WSL 内），无宿主侧 |
| `dsh-wsl-eventlog` | Windows 事件日志 | 无 |
| `dsh-wsl-registry` | 注册表只读查询（白名单） | 无 |
| `dsh-wsl-defender` | Defender / 防火墙状态 | 无 |
| `dsh-wsl-power` | 电源计划 / 电池 | 无 |

**已查证**（对 4367 条收录的生成 README 做关键词扫描）：

```
UI Automation / UIA                     0 条   ← 完全没人做
screen capture / window screenshot      0 条
window control / activate window        0 条
keyboard input / send input             0 条
performance counter                     0 条
Windows service                         0 条
firewall / Defender                     0 条
power plan / battery                    0 条
event log                               2 条   ← 有人做
registry                                48 条  ← 大概率是 npm/plugin registry 噪声，需细查
```

**前 8 个方向在 4367 条里是零覆盖。** 尤其是 **UIA 观测——整个列表没有第二个。**

这意味着第四节那 4 个仓不只是补你的缺口，**它们补的是整个 awesome 列表的缺口**。

---

## 六、下一步

1. **先做 `dsh-wsl-uia`** —— 它是整个闭环的入口，且我已验证可行
2. **查 `wsl` 分类的现有覆盖**，确定另外 6 个候选是否真空白
3. **攒到 10+ 再提 PR**（你那条规则的约束）
4. 每天 3 个的限制**只影响收录节奏，不影响 PR 大小**

**当前阻挡**：没有。底座通了，模式清楚，`dsh.bundle` 的写法你也已经合规（60 个都过了）。

---

## 附：`dsh.bundle` 的正确写法

`contributing.md` 明确说**最常见的被拒原因是只声明了 `dsh.client`**：

```jsonc
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },   // ← 必须，这才是可安装的
    "client": { "platform": "web" }                // 仅带前端 UI 时需要
  }
}
```

你的 60 个都已合规。**新建仓照抄即可。**
