/** #235: format path used by exporters; call Logger.format directly. */
import { Logger } from '@deepseek-ai/cordis'
const circular = {}
circular.self = circular
const cases = [
  ['%o circular', ['%o', circular]],
  ['circular direct', [circular]],
  ['%d symbol', ['%d', Symbol('x')]],
]
let failed = 0
for (const [label, args] of cases) {
  try {
    const text = Logger.format({}, { name: 'probe', args: args.slice() })
    console.log(`  ✓ ${label} → ${text.slice(0, 40)}`)
  } catch (error) {
    failed++
    console.log(`  ★ ${label} → ${error.message}`)
  }
}
console.log(`  ${failed === 0 ? '✓ format 不抛错' : `★ ${failed} 个用例在 format 中抛错`}`)
