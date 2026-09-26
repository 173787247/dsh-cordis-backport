/**
 * The harm case for the unloading-registration guard (upstream PR #176).
 *
 *   main      state=PENDING   ping captured 3 times   leaf disposer never ran
 *   guarded   state=PENDING   ping captured 0 times   refused at registration
 *
 * A fiber that has been unloaded — dependency gone, back to PENDING — still has
 * the subscription it registered during that unload, and it still fires. The
 * same shape with a timer keeps ticking while the fiber is inactive.
 *
 * Read this together with 09-unloading-effect-registration.mjs: that one shows
 * the mechanism, this one shows why it matters. Neither is sufficient alone,
 * which is what the first version of the PR got wrong.
 */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

const root = new Context(); root.logger.error = () => {}
const disposeDep = root.provide('dep', 1)

let leaked = 0        // 迟注册 effect 捕获到的、卸载后发生的事件
let leafDisposed = 0
let fiber

fiber = root.inject(['dep'], async (ctx) => {
  ctx.effect(() => () => {
    // 卸载时"重新武装"一个监听器
    try {
      ctx.effect(() => {
        ctx.on('ping', () => { leaked++ })
        return () => { leafDisposed++ }
      }, 'rearmed-listener')
    } catch {}
  }, 'outer')
  return () => {}
})
await sleep(15)
disposeDep()
await sleep(30)
console.log(`  撤销依赖后 state=${S[fiber.state]}`)

// fiber 已 PENDING —— 此时发事件，看那个本应随卸载消失的监听器还在不在
for (let i = 0; i < 3; i++) { root.emit('ping'); await sleep(2) }
console.log(`  fiber 已 PENDING，发出 3 次 ping，被那个监听器捕获 ${leaked} 次`)
console.log(`  该监听器是否已被释放: ${leafDisposed ? '是' : '否'}`)
console.log()
console.log(`  ${leaked > 0 ? '★ 一个已卸载的 fiber，它卸载时注册的监听器仍在响应事件' : '✓ 没有残留监听器'}`)
