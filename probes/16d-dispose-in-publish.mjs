/** #185 (4/4): an observer may dispose the fiber during publication. */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const root = new Context(); root.logger.error = () => {}
let applied = 0, disposed = false
root.on('internal/plugin', (fiber) => {
  if (fiber.uid === null || disposed) return
  disposed = true
  try { fiber.dispose() } catch {}
})
const fiber = root.inject([], async () => { applied++ })
await sleep(20)
console.log(`  disposed=${disposed} applied=${applied} uid=${fiber.uid}`)
console.log(`  ${applied === 0 ? '✓ 发布期间 dispose 阻止了激活' : '★ dispose 后仍然执行了插件'}`)
