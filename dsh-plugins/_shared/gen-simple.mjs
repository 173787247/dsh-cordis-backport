import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Six plugins that share one shape: run a read-only PowerShell probe, normalise
// the JSON, format it for the model. Each keeps its pure logic separate so the
// tests run without Windows.
export const SIMPLE = [
  {
    dir: "dsh-wsl-perf", tool: "win_perf", order: 214, mod: "perf",
    desc: "Windows host performance counters from WSL: CPU, memory, disk and top processes.",
    params: { top: "How many processes to list (default 8, max 40)." },
    ps: `
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$os = Get-CimInstance Win32_OperatingSystem
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  @{ drive = $_.DeviceID; freeGB = [math]::Round($_.FreeSpace/1GB,1); totalGB = [math]::Round($_.Size/1GB,1) }
}
$procs = Get-Process | Sort-Object -Property WorkingSet64 -Descending | Select-Object -First TOPN | ForEach-Object {
  @{ name = $_.ProcessName; pid = $_.Id; memMB = [math]::Round($_.WorkingSet64/1MB,1) }
}
ConvertTo-Json -Compress -Depth 5 @{
  cpuPercent = [math]::Round($cpu,1)
  memTotalMB = [math]::Round($os.TotalVisibleMemorySize/1KB,0)
  memFreeMB  = [math]::Round($os.FreePhysicalMemory/1KB,0)
  disks = @($disk)
  processes = @($procs)
}`,
    normalize: (raw) => ({
      cpuPercent: num(raw.cpuPercent),
      memTotalMB: num(raw.memTotalMB), memFreeMB: num(raw.memFreeMB),
      disks: (raw.disks || []).map((d) => ({ drive: String(d.drive ?? ""), freeGB: num(d.freeGB), totalGB: num(d.totalGB) })),
      processes: (raw.processes || []).map((p) => ({ name: String(p.name ?? ""), pid: num(p.pid), memMB: num(p.memMB) })),
    }),
    format: (v) => {
      const used = v.memTotalMB - v.memFreeMB;
      const l = [`win_perf ok=${v.ok} cpu=${v.cpuPercent}% mem=${used}/${v.memTotalMB}MB`];
      for (const d of v.disks || []) l.push(`  ${d.drive} ${d.freeGB}GB free of ${d.totalGB}GB`);
      for (const p of v.processes || []) l.push(`  ${p.name} (pid ${p.pid}) ${p.memMB}MB`);
      if (v.error) l.push(`error: ${v.error}`);
      return l.join("\n");
    },
  },
  {
    dir: "dsh-wsl-service", tool: "win_services", order: 215, mod: "service",
    desc: "Read Windows service state from WSL: list services and inspect one by name.",
    params: { name: "Inspect one service by name (optional).", state: "Filter: running, stopped, or all (default all).", limit: "Max services to list (default 40, max 400)." },
    ps: `
$svc = Get-Service
if (NAME) { $svc = $svc | Where-Object { $_.Name -eq NAME -or $_.DisplayName -eq NAME } }
elseif (STATE) { $svc = $svc | Where-Object { $_.Status -eq STATE } }
$list = $svc | Select-Object -First LIMIT | ForEach-Object {
  @{ name = $_.Name; displayName = $_.DisplayName; status = "$($_.Status)"; startType = "$($_.StartType)" }
}
ConvertTo-Json -Compress -Depth 4 @{ services = @($list); total = @($svc).Count }`,
    normalize: (raw) => ({
      total: num(raw.total),
      services: (raw.services || []).map((s) => ({
        name: String(s.name ?? ""), displayName: String(s.displayName ?? ""),
        status: String(s.status ?? ""), startType: String(s.startType ?? ""),
      })),
    }),
    format: (v) => {
      const l = [`win_services ok=${v.ok} listed=${(v.services || []).length} total=${v.total}`];
      for (const s of v.services || []) l.push(`  ${s.status === "Running" ? "RUN " : "    "} ${s.name} [${s.startType}] ${s.displayName}`);
      if (v.error) l.push(`error: ${v.error}`);
      return l.join("\n");
    },
  },
  {
    dir: "dsh-wsl-eventlog", tool: "win_eventlog", order: 216, mod: "eventlog",
    desc: "Read recent Windows event log entries from WSL, by log name and level.",
    params: { log: "Log name (default System).", level: "Minimum level: 1 critical, 2 error, 3 warning, 4 information (default 2).", count: "How many entries (default 20, max 200)." },
    ps: `
$entries = Get-WinEvent -FilterHashtable @{ LogName = LOGNAME; Level = 1..LEVEL } -MaxEvents COUNT -ErrorAction SilentlyContinue
$list = $entries | ForEach-Object {
  @{ time = $_.TimeCreated.ToString('o'); level = $_.LevelDisplayName; provider = $_.ProviderName; id = $_.Id; message = "$($_.Message)".Substring(0,[Math]::Min(300,"$($_.Message)".Length)) }
}
ConvertTo-Json -Compress -Depth 4 @{ entries = @($list) }`,
    normalize: (raw) => ({
      entries: (raw.entries || []).map((e) => ({
        time: String(e.time ?? ""), level: String(e.level ?? ""), provider: String(e.provider ?? ""),
        id: num(e.id), message: String(e.message ?? ""),
      })),
    }),
    format: (v) => {
      const l = [`win_eventlog ok=${v.ok} entries=${(v.entries || []).length}`];
      for (const e of v.entries || []) l.push(`  ${e.time.slice(0, 19)} [${e.level}] ${e.provider}(${e.id}) ${e.message.slice(0, 90)}`);
      if (v.error) l.push(`error: ${v.error}`);
      return l.join("\n");
    },
  },
  {
    dir: "dsh-wsl-registry", tool: "win_reg", order: 217, mod: "registry",
    desc: "Read-only Windows registry access from WSL, restricted to an allowlist of key prefixes.",
    params: { path: "Registry path, e.g. HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion.", name: "Read one value by name (optional; omit to list the key's values)." },
    ps: `
if (-not (Test-Path REGPATH)) { ConvertTo-Json -Compress @{ error = 'key not found' }; exit }
if (VALNAME) {
  $item = Get-ItemProperty -Path REGPATH -Name VALNAME -ErrorAction SilentlyContinue
  if ($null -eq $item) { ConvertTo-Json -Compress @{ error = 'value not found' }; exit }
  # $item.$VALNAME is not valid PowerShell once VALNAME is a quoted literal;
  # index the property bag instead.
  $v = $item.PSObject.Properties[VALNAME].Value
  ConvertTo-Json -Compress @{ path = REGPATH; values = @(@{ name = VALNAME; value = "$v" }) }
} else {
  $key = Get-Item -Path REGPATH
  $vals = $key.GetValueNames() | Select-Object -First 100 | ForEach-Object {
    @{ name = $_; kind = "$($key.GetValueKind($_))"; value = "$($key.GetValue($_))".Substring(0,[Math]::Min(400,"$($key.GetValue($_))".Length)) }
  }
  ConvertTo-Json -Compress -Depth 4 @{ path = REGPATH; values = @($vals) }
}`,
    normalize: (raw) => ({
      path: String(raw.path ?? ""),
      values: (raw.values || []).map((x) => ({ name: String(x.name ?? ""), kind: String(x.kind ?? ""), value: String(x.value ?? "") })),
    }),
    format: (v) => {
      const l = [`win_reg ok=${v.ok} path=${v.path} values=${(v.values || []).length}`];
      for (const x of v.values || []) l.push(`  ${x.name}${x.kind ? ` (${x.kind})` : ""} = ${x.value.slice(0, 100)}`);
      if (v.error) l.push(`error: ${v.error}`);
      return l.join("\n");
    },
    guard: "registry",
  },
  {
    dir: "dsh-wsl-defender", tool: "win_defender", order: 218, mod: "defender",
    desc: "Windows security posture from WSL: Defender antivirus status and firewall profile state.",
    params: {},
    ps: `
$av = $null
try { $av = Get-MpComputerStatus -ErrorAction Stop } catch {}
$fw = @()
try {
  $fw = Get-NetFirewallProfile -ErrorAction Stop | ForEach-Object { @{ profile = $_.Name; enabled = [bool]$_.Enabled } }
} catch {}
$out = @{ firewall = @($fw) }
if ($av) {
  $out.antivirus = @{
    realTime = [bool]$av.RealTimeProtectionEnabled
    sigAge = [int]$av.AntivirusSignatureAge
    sigVersion = "$($av.AntivirusSignatureVersion)"
    quickScanAge = [int]$av.QuickScanAge
  }
  $out.tamperProtected = [bool]$av.IsTamperProtected
}
ConvertTo-Json -Compress -Depth 5 $out`,
    normalize: (raw) => ({
      antivirus: raw.antivirus ? {
        realTime: Boolean(raw.antivirus.realTime),
        sigAge: num(raw.antivirus.sigAge),
        sigVersion: String(raw.antivirus.sigVersion ?? ""),
        quickScanAge: num(raw.antivirus.quickScanAge),
      } : null,
      tamperProtected: raw.tamperProtected === undefined ? null : Boolean(raw.tamperProtected),
      firewall: (raw.firewall || []).map((f) => ({ profile: String(f.profile ?? ""), enabled: Boolean(f.enabled) })),
    }),
    format: (v) => {
      const l = [`win_defender ok=${v.ok}`];
      if (v.antivirus) {
        l.push(`  real-time protection: ${v.antivirus.realTime ? "on" : "OFF"}`);
        l.push(`  signatures: ${v.antivirus.sigVersion} (${v.antivirus.sigAge} days old)`);
        l.push(`  last quick scan: ${v.antivirus.quickScanAge === 0 ? "today" : v.antivirus.quickScanAge + " days ago"}`);
      } else l.push("  antivirus: unavailable (Get-MpComputerStatus failed)");
      if (v.tamperProtected !== null) l.push(`  tamper protection: ${v.tamperProtected ? "on" : "off"}`);
      for (const f of v.firewall || []) l.push(`  firewall ${f.profile}: ${f.enabled ? "on" : "OFF"}`);
      if (v.error) l.push(`error: ${v.error}`);
      return l.join("\n");
    },
  },
  {
    dir: "dsh-wsl-power", tool: "win_power", order: 219, mod: "power",
    desc: "Windows power state from WSL: active power plan, battery status and sleep settings.",
    params: {},
    ps: `
$plan = powercfg /getactivescheme 2>$null
$bat = $null
try {
  $b = Get-CimInstance Win32_Battery -ErrorAction Stop | Select-Object -First 1
  if ($b) { $bat = @{ charge = [int]$b.EstimatedChargeRemaining; status = [int]$b.BatteryStatus } }
} catch {}
$sleep = $null
try {
  $v = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 2>$null | Select-String 'Current AC Power Setting Index' | Select-Object -First 1)
  if ($v) { $sleep = [Convert]::ToInt32(($v -split ':')[-1].Trim(), 16) }
} catch {}
ConvertTo-Json -Compress -Depth 4 @{ plan = "$plan"; battery = $bat; sleepAcSeconds = $sleep }`,
    normalize: (raw) => ({
      plan: String(raw.plan ?? "").trim(),
      battery: raw.battery ? { charge: num(raw.battery.charge), status: num(raw.battery.status) } : null,
      sleepAcSeconds: raw.sleepAcSeconds === null || raw.sleepAcSeconds === undefined ? null : num(raw.sleepAcSeconds),
    }),
    format: (v) => {
      const l = [`win_power ok=${v.ok}`];
      if (v.plan) l.push(`  plan: ${v.plan.replace(/^Power Scheme GUID:\s*/, "")}`);
      if (v.battery) l.push(`  battery: ${v.battery.charge}% (status code ${v.battery.status})`);
      else l.push("  battery: none (desktop or unavailable)");
      if (v.sleepAcSeconds !== null) l.push(`  sleep after: ${v.sleepAcSeconds === 0 ? "never (on AC)" : v.sleepAcSeconds + "s on AC"}`);
      if (v.error) l.push(`error: ${v.error}`);
      return l.join("\n");
    },
  },
];

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export function emit(SIMPLE, join, writeFileSync) {
for (const p of SIMPLE) {
  const js = `// Pure side of ${p.dir}: normalisation and formatting, testable without Windows.
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export function normalize(raw) {
  return (${p.normalize.toString()})(raw ?? {});
}

export function format(v) {
  return (${p.format.toString()})({ ok: true, ...v });
}

export function parameters() {
  return ${JSON.stringify({ type: "object", additionalProperties: false, properties: Object.fromEntries(Object.entries(p.params).map(([k, d]) => [k, { type: ["top","count","limit"].includes(k) ? "number" : "string", description: d }])) }, null, 2)};
}

export function outputSchema() {
  return { type: "object", additionalProperties: true };
}
`;
  writeFileSync(join(p.dir, "lib", `${p.mod}.js`), js);
  console.log("  ✓ " + p.dir + "/lib/" + p.mod + ".js");
}
}
