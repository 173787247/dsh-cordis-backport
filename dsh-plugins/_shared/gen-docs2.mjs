import { SIMPLE } from "./gen-simple.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const USAGE = {
  "dsh-wsl-perf": `win_perf              # cpu, memory, disks, top processes
win_perf top=20       # more processes`,
  "dsh-wsl-service": `win_services                          # all services
win_services state=running limit=20
win_services name=Spooler             # one service`,
  "dsh-wsl-eventlog": `win_eventlog                              # System, errors+critical, 20 entries
win_eventlog log=Application level=3 count=50`,
  "dsh-wsl-registry": `win_reg path='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'
win_reg path='HKLM:\\SOFTWARE\\...' name=ProductName`,
  "dsh-wsl-defender": `win_defender          # antivirus + firewall posture`,
  "dsh-wsl-power": `win_power             # active plan, battery, sleep setting`,
};
const NOTES = {
  "dsh-wsl-perf": `Counters come from \`Get-CimInstance Win32_Processor\` and \`Win32_OperatingSystem\`.
Memory figures are the host's, not the WSL VM's.`,
  "dsh-wsl-service": `Read-only: this plugin lists and inspects services, it does not start or stop them.
\`total\` counts services matching the filter, which can exceed \`listed\`.`,
  "dsh-wsl-eventlog": `Reads by log name and minimum level. Level is 1 critical, 2 error, 3 warning,
4 information. Messages are truncated to 300 characters.`,
  "dsh-wsl-registry": `**Read-only, and restricted to an allowlist** of key prefixes:
\`HKLM:\\SOFTWARE\`, \`HKLM:\\SYSTEM\\CurrentControlSet\\Services\`, \`HKCU:\\SOFTWARE\`,
\`HKLM:\\HARDWARE\`. Keys under a \`Run\` or \`RunOnce\` segment are refused wherever they
appear — matched as a whole path segment, so \`...\\CurrentVersion\\Run\` is caught as
well as \`...\\Run\\Something\`. Values are truncated to 400 characters.`,
  "dsh-wsl-defender": `Uses \`Get-MpComputerStatus\` and \`Get-NetFirewallProfile\`. If Defender is
managed by a third party, or the cmdlets are unavailable, the antivirus section reports
unavailable rather than guessing.`,
  "dsh-wsl-power": `Reads the active scheme with \`powercfg\`. \`battery\` is absent on desktops.
\`sleepAcSeconds\` is the AC standby timeout; \`0\` means never.`,
};

for (const p of SIMPLE) {
  const d = p.dir;
  if (!USAGE[d]) continue;
  writeFileSync(join(d, "README.md"), `# ${d}

DeepSeek Harness plugin: ${p.desc}

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

## Install

\`\`\`sh
dsh plugin --profile web add github:173787247/${d}
\`\`\`

## Usage

\`\`\`
${USAGE[d]}
\`\`\`

## Notes

${NOTES[d]}

## Requirements

- Windows with WSL, and DeepSeek Harness running inside it.

## Tests

\`\`\`sh
npm test
\`\`\`

The unit tests run anywhere. The live tests are skipped outside WSL.

## License

MIT
`);
  console.log("  ✓ " + d + "/README.md");
}
