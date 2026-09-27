#!/usr/bin/env node
/**
 * Check each awesome entry's description against the code it describes.
 *
 * The listing review reads a description as a claim and verifies it: "if you
 * write '46 tools across six domains', there should be 46 tools and six
 * domains". Overstating is the one thing that gets an otherwise-good plugin
 * sent back, so this walks every claim that can be checked mechanically.
 *
 * It cannot check that the work is *worth* doing — only that what is written is
 * what is there.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIRS = readdirSync(".").filter((n) => n.startsWith("dsh-wsl-") && existsSync(join(n, "package.json")));
let problems = 0;

const say = (ok, plugin, claim, detail) => {
  if (!ok) problems++;
  console.log(`  ${ok ? "✓" : "★"} ${plugin.padEnd(20)} ${claim}${detail ? "  — " + detail : ""}`);
};

for (const dir of DIRS.sort()) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const entry = readFileSync(join(dir, "docs", "awesome-entry.yml"), "utf8");
  const en = (entry.match(/^\s*en:\s*(.+)$/m) || [])[1]?.replace(/^'|'$/g, "") ?? "";
  const index = readFileSync(join(dir, "index.js"), "utf8");
  const libs = readdirSync(join(dir, "lib")).map((f) => readFileSync(join(dir, "lib", f), "utf8")).join("\n");
  const code = index + "\n" + libs;

  console.log(`\n── ${dir}`);

  // The entry text must be the package description, verbatim.
  say(en === pkg.description, dir, "entry text matches package.json description",
    en === pkg.description ? "" : `entry="${en.slice(0, 50)}" pkg="${pkg.description.slice(0, 50)}"`);

  // url / name / category shape
  const url = (entry.match(/^url:\s*(\S+)/m) || [])[1];
  say(url === `https://github.com/173787247/${dir}`, dir, "url points at this repository", url);
  const cat = (entry.match(/^category:\s*(\S+)/m) || [])[1];
  say(cat === "wsl", dir, "category is wsl", cat);

  // dsh.bundle must be declared, and the patch file must exist
  const patch = pkg.dsh?.bundle?.patch;
  say(Boolean(patch), dir, "declares dsh.bundle.patch", patch);
  if (patch) say(existsSync(join(dir, patch)), dir, "the patch file exists", patch);

  // The registered tool name must appear in the code, and the entry must not
  // promise a tool that is not registered.
  const tool = (index.match(/name:\s*"([a-z_]+)"/) || [])[1];
  say(Boolean(tool), dir, "registers a tool", tool);
  if (tool) say(code.includes(`"${tool}"`), dir, `the tool ${tool} is present in the code`);

  // No marketing words. The review asks for what it does, not how good it is.
  const marketing = /\b(powerful|seamless|best|ultimate|amazing|revolutionary|blazing|effortless|cutting-edge)\b/i;
  say(!marketing.test(en), dir, "no marketing words", marketing.test(en) ? en.match(marketing)[0] : "");

  // Every count stated in the description must be real. These plugins claim
  // none, and this guards against one being added carelessly later.
  const numbers = en.match(/\b(\d+)\s+(tools?|actions?|commands?|modes?|domains?)\b/gi);
  if (numbers) {
    for (const n of numbers) {
      const [count, what] = n.split(/\s+/);
      const registered = (index.match(/\btools\.register\(/g) || []).length;
      say(Number(count) === registered, dir, `the entry says "${n}"`, `code registers ${registered}`);
    }
  } else {
    say(true, dir, "states no counts (nothing to overstate)");
  }

  // A tool named in the README usage block must exist.
  const readme = readFileSync(join(dir, "README.md"), "utf8");
  const usage = readme.match(/## Usage\n+```\n([\s\S]*?)```/);
  if (usage) {
    const named = [...new Set((usage[1].match(/^([a-z_]+)\s/gm) || []).map((s) => s.trim()))];
    for (const n of named) {
      say(code.includes(`"${n}"`), dir, `README usage names ${n}, which exists`);
    }
  }
}

console.log(`\n──────── ${problems === 0 ? "all claims check out" : problems + " problem(s)"}`);
process.exitCode = problems ? 1 : 0;
