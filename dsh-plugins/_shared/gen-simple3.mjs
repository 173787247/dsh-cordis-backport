import { SIMPLE } from "./gen-simple.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PRELUDE = `$ErrorActionPreference = 'Stop'
# The console codepage mangles non-ASCII output; force UTF-8.
[Console]::OutputEncoding = [Text.Encoding]::UTF8`;

/** Every parameter reaches PowerShell as a single-quoted literal. */
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const GUARDS = {
  registry: `
const ALLOWED = [
  "HKLM:\\\\SOFTWARE", "HKLM:\\\\SYSTEM\\\\CurrentControlSet\\\\Services",
  "HKCU:\\\\SOFTWARE", "HKLM:\\\\HARDWARE",
];
export function assertRegistryPath(path) {
  const p = String(path ?? "").trim();
  if (!p) throw new Error("path is required");
  const ok = ALLOWED.some((a) => p.toUpperCase().startsWith(a.toUpperCase()));
  if (!ok) throw new Error(\`registry path is outside the allowlist: \${p}\`);
  // Run / RunOnce as a whole path segment, wherever it appears — including at
  // the end of the path. A pattern that required a trailing separator let
  // "...\\\\CurrentVersion\\\\Run" through.
  const segments = p.split(/[\\\\/:]+/).filter(Boolean);
  if (segments.some((s) => /^Run(Once)?$/i.test(s))) throw new Error("autorun keys are outside the allowlist");
  return p;
}`,
};

for (const p of SIMPLE) {
  const guardBlock = p.guard ? GUARDS[p.guard] : "";
  const guardCall = p.guard ? "assertRegistryPath(args?.path)" : "undefined";

  writeFileSync(join(p.dir, "lib", `${p.mod}-exec.js`), `import { runPowerShell } from "./wsl-host.js";
import { normalize } from "./${p.mod}.js";
${guardBlock}

const PRELUDE = ${JSON.stringify(PRELUDE)};

/** Every parameter reaches PowerShell as a single-quoted literal. */
function q(s) {
  return "'" + String(s ?? "").replace(/'/g, "''") + "'";
}

function clamp(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

// Substitution runs on @@TOKEN@@ placeholders rather than bare words: a plain
// replace("NAME", ...) also matches inside LOGNAME, which silently corrupts the
// script. Each token appears at most once.
export function buildScript(a) {
  const values = {
    NAME: ${p.guard ? '""' : "q(a.name)"},
    STATE: q(a.state),
    LIMIT: String(a.limit),
    COUNT: String(a.count),
    LOGNAME: q(a.log),
    LEVEL: String(a.level),
    TOPN: String(a.top),
    REGPATH: q(a.path),
    VALNAME: q(a.name),
  };
  return PRELUDE + "\\n" + TEMPLATE.replace(/@@(\w+)@@/g, (_, k) => values[k] ?? "");
}

const TEMPLATE = \`
${p.ps.replace(/\b(NAME|STATE|LIMIT|COUNT|LOGNAME|LEVEL|TOPN|REGPATH|VALNAME)\b/g, '@@$1@@')}
\`;

export async function execute(args, config = {}) {
  const a = {
    name: typeof args?.name === "string" ? args.name : "",
    state: typeof args?.state === "string" ? args.state : "",
    log: typeof args?.log === "string" ? args.log : "System",
    path: typeof args?.path === "string" ? args.path : "",
    level: clamp(args?.level, 1, 5, 2),
    count: clamp(args?.count, 1, 200, 20),
    limit: clamp(args?.limit, 1, 400, 40),
    top: clamp(args?.top, 1, 40, 8),
  };
  ${p.guard ? "if (a.path) a.path = " + guardCall + ";" : ""}
  const timeoutMs = clamp(config.timeoutMs, 1000, 120000, 30000);
  const { stdout } = await runPowerShell(buildScript(a), { timeoutMs });
  const raw = JSON.parse(stdout.trim() || "{}");
  if (raw.error) return { ok: false, error: String(raw.error) };
  return { ok: true, ...normalize(raw) };
}
`);
  writeFileSync(join(p.dir, "index.js"), `import { detectWsl } from "./lib/wsl-host.js";
import * as core from "./lib/${p.mod}.js";
import { execute } from "./lib/${p.mod}-exec.js";

export const name = ${JSON.stringify(p.dir)};
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: ${JSON.stringify("tool:" + p.tool)},
    order: ${p.order},
    text: ${JSON.stringify("Use " + p.tool + " for WSL/Windows interop: " + p.desc)},
  });

  ctx.tools.register({
    name: ${JSON.stringify(p.tool)},
    description: ${JSON.stringify(p.desc)},
    parameters: core.parameters(),
    output: {
      schema: core.outputSchema(),
      render: (_args, value) => [{ type: "text", text: core.format(value) }],
    },
    timeoutMs: Number(config.timeoutMs) > 0 ? Number(config.timeoutMs) : 30_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!wsl) return { ok: false, error: "not running in WSL" };
      try {
        return await execute(args, config);
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error) };
      }
    },
    presentCall: () => ({ card: "generic", title: ${JSON.stringify(p.tool)} }),
    presentResult: (_args, result) => ({ card: "generic", title: ${JSON.stringify(p.tool)}, content: result?.content }),
  });
}
`);
  console.log("  ✓ " + p.dir);
}
