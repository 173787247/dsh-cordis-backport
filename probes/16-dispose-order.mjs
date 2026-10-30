/**
 * #185 (first of four): a fiber that never activated still owns effects
 * registered by an `internal/plugin` observer; disposing it must drain them.
 */
import { Context } from '@deepseek-ai/cordis'

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))
const root = new Context()
root.logger.error = () => {}
let unloaded = 0

root.on('internal/plugin', (fiber) => {
  if (!fiber.uid) return
  try {
    fiber.ctx.effect(() => () => { unloaded++ }, 'observer')
  } catch {}
})

const fiber = root.inject(['missing'], () => {})
await sleep(10)
const before = unloaded
await fiber.dispose()
console.log(`  unloaded before=${before} after=${unloaded} state=${fiber.state} uid=${fiber.uid}`)
console.log(`  ${unloaded > before ? '✓ dispose 清掉了 observer 的 effect' : '★ 未清理'}`)
