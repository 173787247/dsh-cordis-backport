import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
const { SIMPLE } = await import("./gen-simple.mjs").catch(() => ({}));
