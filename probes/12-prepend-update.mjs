/**
 * #232: `ctx.on('internal/update', cb, { prepend: true })` throws before the
 * listener is stored, because the per-fiber DisposableList has no `unshift`.
 */
import { Context } from '@deepseek-ai/cordis'

const ctx = new Context()
let result
try {
  ctx.on('internal/update', () => {}, { prepend: true })
  result = 'registered'
} catch (error) {
  result = `threw: ${error.message}`
}
console.log(`  internal/update + prepend → ${result}`)
console.log(`  ${result === 'registered' ? '✓ 可以注册' : '★ 注册直接抛错'}`)
