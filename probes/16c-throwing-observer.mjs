/** #185 (3/4): a throwing teardown observer must not starve peers or abort dispose. */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const root = new Context()
let logged = 0
root.logger.error = () => { logged++ }
const seen = []
root.on('internal/plugin', (fiber) => {
  if (fiber.uid !== null) return
  seen.push('first')
  throw new Error('observer boom')
})
root.on('internal/plugin', (fiber) => {
  if (fiber.uid !== null) return
  seen.push('second')
})
let cleaned = 0
const fiber = root.inject([], async (ctx) => { ctx.effect(() => () => { cleaned++ }, 'e') })
await sleep(10)
let threw
try { await fiber.dispose() } catch (e) { threw = e.message }
console.log(`  seen=${JSON.stringify(seen)} cleaned=${cleaned} logged=${logged} threw=${threw || 'none'}`)
console.log(`  ${seen.length === 2 && cleaned === 1 ? '✓ 隔离了抛错的 observer' : '★ observer 抛错影响了 dispose'}`)
