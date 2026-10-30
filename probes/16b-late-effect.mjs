/** #185 (2/4): effect creation while the owner is unloading. */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const root = new Context(); root.logger.error = () => {}
const dep = root.provide('dep', 1)
let late = 0, error
const fiber = root.inject(['dep'], async (ctx) => {
  ctx.effect(() => () => {
    try { ctx.effect(() => () => { late++ }, 'late') } catch (e) { error = e }
  }, 'outer')
})
await sleep(10)
dep()
await sleep(20)
console.log(`  late=${late} error=${error?.code || error?.message || 'none'} state=${fiber.state}`)
console.log(`  ${late === 0 ? '✓ 拒绝卸载期间注册' : '★ 卸载期间仍注册了 effect'}`)
