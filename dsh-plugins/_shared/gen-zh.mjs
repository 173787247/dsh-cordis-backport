import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const DESC = {
  "dsh-wsl-uia": "从 WSL 观测 Windows UI：列出顶层窗口，读取有界的 UI Automation 元素树，每个元素带本次观测的句柄。",
  "dsh-wsl-wininput": "从 WSL 定向操作 Windows：按元素名调用 UI Automation 元素，或向指定窗口发送按键与点击，不抢焦点。",
  "dsh-wsl-winshot": "把指定的 Windows 窗口截图存入 WSL 文件，可按进程号或窗口句柄指定。",
  "dsh-wsl-winctl": "从 WSL 枚举与控制 Windows 顶层窗口：激活、最小化、还原、移动与调整大小。",
  "dsh-wsl-perf": "从 WSL 读取 Windows 宿主性能计数器：CPU、内存、磁盘与占用最高的进程。",
  "dsh-wsl-service": "从 WSL 读取 Windows 服务状态：列出服务、按名查看单个服务。",
  "dsh-wsl-eventlog": "从 WSL 读取 Windows 事件日志，可按日志名与级别过滤。",
  "dsh-wsl-registry": "从 WSL 只读访问 Windows 注册表，限定在白名单键前缀内。",
  "dsh-wsl-defender": "从 WSL 读取 Windows 安全状态：Defender 防病毒状态与防火墙各配置文件状态。",
  "dsh-wsl-power": "从 WSL 读取 Windows 电源状态：当前电源方案、电池状态与睡眠设置。",
};

const PAIRS = [
  ["## Install", "## 安装"],
  ["## Usage", "## 用法"],
  ["## Notes", "## 说明"],
  ["## Requirements", "## 依赖"],
  ["## Tests", "## 测试"],
  ["## License", "## 许可"],
  ["DeepSeek Harness plugin: ", "DeepSeek Harness 插件："],
  [
    "Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.\n\n[中文说明 → README.zh.md](./README.zh.md)",
    "属于 **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)** 的一部分。\n\n[English → README.md](./README.md)",
  ],
  [
    "- Windows with WSL, and DeepSeek Harness running inside it.\n- PowerShell reachable at the standard path (the plugin finds it itself).",
    "- Windows + WSL，DeepSeek Harness 跑在 WSL 里。\n- PowerShell 位于标准路径（插件自己会找）。",
  ],
  ["- Windows with WSL, and DeepSeek Harness running inside it.", "- Windows + WSL，DeepSeek Harness 跑在 WSL 里。"],
  ["The unit tests run anywhere. The live tests are skipped outside WSL.", "单元测试在任何平台都能跑；实时测试在 WSL 之外自动跳过。"],
];

for (const d of readdirSync(".").filter((n) => n.startsWith("dsh-wsl-"))) {
  let zh = readFileSync(`${d}/README.md`, "utf8");
  for (const [en, cn] of PAIRS) zh = zh.split(en).join(cn);
  zh = zh.replace(`# ${d}`, `# ${d}\n\n> ${DESC[d]}`);
  writeFileSync(`${d}/README.zh.md`, zh);
  console.log("  ✓ " + d + "/README.zh.md");
}
