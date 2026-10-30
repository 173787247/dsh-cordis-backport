/**
 * #235: bare `JSON.stringify` in `%o`/`%O` (and `%d` on a Symbol) throws out of
 * logger methods, which callers use as statements.
 */
import { Context } from '@deepseek-ai/cordis'

const ctx = new Context()
const circular = {}
circular.self = circular
const cases = [
  ['%o circular', () => ctx.logger.info('%o', circular)],
  ['circular direct', () => ctx.logger.info(circular)],
  ['%o ctx', () => ctx.logger.info('%o', ctx)],
  ['%d symbol', () => ctx.logger.info('%d', Symbol('x'))],
]
let failed = 0
for (const [label, run] of cases) {
  try {
    run()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    failed++
    console.log(`  ★ ${label} → ${error.message}`)
  }
}
console.log(`  ${failed === 0 ? '✓ 全部不抛错' : `★ ${failed} 个用例抛错`}`)
