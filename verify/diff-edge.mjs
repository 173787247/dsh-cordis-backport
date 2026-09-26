/**
 * Targeted edge cases for `equalExceptVolatile`, and the reachability check for
 * the one defect the reading turned up.
 *
 * Run alongside `diff-fuzz.mjs`; see `README.md` for the setup.
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

let bad = 0
const check = (label, got, expect) => {
  const ok = got === expect
  if (!ok) bad++
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(46)} = ${got}${ok ? '' : `   (expected ${expect})`}`)
}
/** Behaviour we are recording rather than asserting — prints, never fails. */
const note = (label, got) => console.log(`  ·  ${label.padEnd(46)} = ${got}`)

const schema = obj({ a: leaf(false), b: leaf(true) })

console.log('— basics —')
check('identical configs', equalExceptVolatile({ a: 1, b: 1 }, { a: 1, b: 1 }, schema), true)
check('only volatile differs', equalExceptVolatile({ a: 1, b: 1 }, { a: 1, b: 2 }, schema), true)
check('plain field differs', equalExceptVolatile({ a: 1, b: 1 }, { a: 2, b: 1 }, schema), false)

console.log('— schema defaults —')
const withDefault = obj({ a: leaf(false) }, { default: { a: 7 } })
check('absent vs equal-to-default', equalExceptVolatile(undefined, { a: 7 }, withDefault), true)
check('absent vs differs-from-default', equalExceptVolatile(undefined, { a: 8 }, withDefault), false)
// `??` treats null and undefined alike, so an empty object does not fall through
// to the default while null does. Recorded, not asserted: nothing relies on it
// today, and whether it should is a design question.
note('{} vs absent (default present)', equalExceptVolatile({}, undefined, withDefault))
note('null vs absent (default present)', equalExceptVolatile(null, undefined, withDefault))

console.log('— arrays (isRecord sends these back to raw comparison) —')
const arraySchema = obj({ list: leaf(false) })
check('same order', equalExceptVolatile({ list: [1, 2] }, { list: [1, 2] }, arraySchema), true)
check('different order', equalExceptVolatile({ list: [1, 2] }, { list: [2, 1] }, arraySchema), false)

console.log('— unknown keys (not in the dict, compared raw) —')
check('unknown key differs', equalExceptVolatile({ a: 1, zzz: 1 }, { a: 1, zzz: 2 }, schema), false)
check('unknown key same', equalExceptVolatile({ a: 1, zzz: 1 }, { a: 1, zzz: 1 }, schema), true)

console.log('— nested —')
const nested = obj({ inner: obj({ x: leaf(false), y: leaf(true) }) })
check('nested volatile differs', equalExceptVolatile({ inner: { x: 1, y: 1 } }, { inner: { x: 1, y: 2 } }, nested), true)
check('nested plain differs', equalExceptVolatile({ inner: { x: 1, y: 1 } }, { inner: { x: 2, y: 1 } }, nested), false)

console.log('— the missing guard in isSchemastery —')
for (const [label, value] of [
  ['undefined', undefined],
  ['null', null],
  ['a plain object', { type: 'object', meta: {} }],
]) {
  let outcome
  try {
    outcome = `returns ${equalExceptVolatile({ a: 1 }, { a: 2 }, value)}`
  } catch (e) {
    outcome = `throws ${e.constructor.name}: ${e.message.slice(0, 44)}`
  }
  console.log(`  ·  ${label.padEnd(46)} → ${outcome}`)
}
console.log(`
  A non-nullish Config without \`~standard\` throws, because the guard only
  covers \`schema\` itself:

      return schema?.['~standard'].vendor === 'schemastery'

  It is not reachable through the loader, and the reachability argument is in
  README.md — \`resolveConfig\` is missing the same guard, so a plugin with such
  a Config fails to activate, and this function is only called for an ACTIVE
  fiber.`)

process.exit(bad ? 1 : 0)
