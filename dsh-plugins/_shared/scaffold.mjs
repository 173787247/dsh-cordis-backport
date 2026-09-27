import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);

export const PLUGINS = [
  { name: "dsh-wsl-uia",        tool: "uia_tree",      order: 210, about: "Windows UI Automation observation from WSL: enumerate top-level windows and read a bounded element tree with stable per-observation handles." },
  { name: "dsh-wsl-wininput",   tool: "win_invoke",    order: 211, about: "Targeted Windows input from WSL: invoke a UI Automation element, or send keys and clicks to a chosen window without stealing focus." },
  { name: "dsh-wsl-winshot",    tool: "win_shot_window", order: 212, about: "Capture a specific Windows window to a WSL file, by process id or window handle." },
  { name: "dsh-wsl-winctl",     tool: "win_windows",   order: 213, about: "Enumerate and control Windows top-level windows from WSL: activate, minimize, restore, move and resize." },
  { name: "dsh-wsl-perf",       tool: "win_perf",      order: 214, about: "Windows host performance counters from WSL: CPU, memory, disk and top processes." },
  { name: "dsh-wsl-service",    tool: "win_services",  order: 215, about: "Read Windows service state from WSL: list services and inspect one by name." },
  { name: "dsh-wsl-eventlog",   tool: "win_eventlog",  order: 216, about: "Read recent Windows event log entries from WSL, by log name and level." },
  { name: "dsh-wsl-registry",   tool: "win_reg",       order: 217, about: "Read-only Windows registry access from WSL, restricted to an allowlist of key prefixes." },
  { name: "dsh-wsl-defender",   tool: "win_defender",  order: 218, about: "Windows security posture from WSL: Defender antivirus status and firewall profile state." },
  { name: "dsh-wsl-power",      tool: "win_power",     order: 219, about: "Windows power state from WSL: active power plan, battery status and sleep settings." },
];

const pkg = (p) => ({
  name: p.name,
  version: "0.1.0",
  description: p.about,
  license: "MIT",
  repository: { type: "git", url: `https://github.com/173787247/${p.name}.git` },
  bugs: { url: `https://github.com/173787247/${p.name}/issues` },
  homepage: `https://github.com/173787247/${p.name}#readme`,
  type: "module",
  main: "index.js",
  engines: { node: ">=18" },
  scripts: { test: "node --test test/*.test.js" },
  files: ["index.js", "lib", "cordis.patch.yml", "README.md", "README.zh.md", "LICENSE"],
  keywords: ["dsh-plugin", "deepseek-harness", "wsl", "windows", ...p.name.split("-").slice(2)],
  dsh: { bundle: { patch: "./cordis.patch.yml" } },
});

const patch = (p) => `- insert:
    - id: ${p.name}
      name: ${p.name}
      config:
        timeoutMs: 30000
`;

for (const p of PLUGINS) {
  const dir = join(ROOT, p.name);
  for (const d of ["lib", "test", "docs"]) mkdirSync(join(dir, d), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg(p), null, 2) + "\n");
  writeFileSync(join(dir, "cordis.patch.yml"), patch(p));
  for (const f of ["LICENSE", "wsl-host.js"]) copyFileSync(join(HERE, f), join(dir, f === "wsl-host.js" ? "lib/wsl-host.js" : f));
  writeFileSync(join(dir, ".gitignore"), "node_modules/\n*.log\n");
  // awesome 条目草稿
  writeFileSync(join(dir, "docs/awesome-entry.yml"), `url: https://github.com/173787247/${p.name}
name: 173787247/${p.name}
category: wsl
description:
  en: '${p.about.replace(/'/g, "''")}'
`);
  console.log("  ✓ " + p.name);
}
console.log(`\n  ${PLUGINS.length} 个骨架已建`);
