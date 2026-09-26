/**
 * Property tests for `equalExceptVolatile` — DSH-only code
 * (`cordis-plugin-loader/src/config/diff.ts`, no upstream counterpart).
 *
 * The safety property is the one that matters: this function returning `true`
 * means "the configs differ at most in volatile fields", and the loader reads
 * that as "no remount needed". A false `true` silently swallows a real config
 * change, so a single one of these failing would be worse than a crash.
 *
 * Deterministic and seeded, so a failure names a replayable seed.
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const src = process.env.DSH_DIFF ?? './loader-src/config/diff.ts'
// resolve against the working directory, not this file: ESM resolves a
// relative specifier from the importing module
const { equalExceptVolatile } = await import(pathToFileURL(resolve(src)).href)

const STD = { '~standard': { vendor: 'schemastery' } }
const leaf = (volatile = false) => ({ ...STD, meta: volatile ? { volatile: true } : {} })
const obj = (dict, meta = {}) => ({ ...STD, type: 'object', dict, meta })

// a is plain, b is volatile, nested.c is plain, nested.d is volatile
const schema = obj({
  a: leaf(false),
  b: leaf(true),
  nested: obj({ c: leaf(false), d: leaf(true) }),
})

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const CASES = Number(process.env.CASES ?? 5000)
const failures = []

for (let seed = 1; seed <= CASES; seed++) {
  const r = rng(seed)
  const pick = () => Math.floor(r() * 3)
  const mk = () => ({ a: pick(), b: pick(), nested: { c: pick(), d: pick() } })
  const x = mk(), y = mk()

  let got
  try {
    got = equalExceptVolatile(x, y, schema)
  } catch (e) {
    failures.push(`seed ${seed}: threw ${e.message}`)
    continue
  }

  // only the non-volatile leaves may decide the answer
  const expected = x.a === y.a && x.nested.c === y.nested.c
  if (got !== expected) {
    failures.push(`seed ${seed}: expected ${expected}, got ${got} — x=${JSON.stringify(x)} y=${JSON.stringify(y)}`)
  }

  // a config must never differ from itself
  if (equalExceptVolatile(x, x, schema) !== true) failures.push(`seed ${seed}: not reflexive`)

  // argument order must not matter
  if (equalExceptVolatile(x, y, schema) !== equalExceptVolatile(y, x, schema)) {
    failures.push(`seed ${seed}: not symmetric`)
  }

  if (failures.length > 5) break
}

if (failures.length) {
  console.log(`✗ ${failures.length} failure(s):`)
  for (const f of failures.slice(0, 5)) console.log('   ' + f)
  process.exit(1)
}
console.log(`✓ ${CASES} random config pairs: safety, reflexivity and symmetry all hold`)
