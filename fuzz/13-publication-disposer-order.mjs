/**
 * An observer may dispose the fiber from inside the publication notification.
 *
 *   main    typeof fiber.dispose at publication = 'undefined'
 *           after the notification              = apply ran 1 time, uid=1, state=ACTIVE
 *   fixed   typeof fiber.dispose at publication = 'function'
 *           after the notification              = apply ran 0 times, uid=null
 *
 * The constructor emits `internal/plugin` before assigning `this.dispose`, and
 * then runs `_checkImpl` + `_refresh`, so a fiber an observer wants gone at
 * publication activates anyway. Third item from the vendored line's local
 * modification log to turn out to be an upstream defect — see also #176, #177.
 */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

const root = new Context(); root.logger.error = () => {}
let applyRan = 0
let disposedAtPublish = false

// 观察者：在 fiber 刚发布（创建）时同步把它释放掉
root.on('internal/plugin', (fiber) => {
  if (fiber.uid === null) return          // 只看创建
  if (disposedAtPublish) return
  disposedAtPublish = true
  try { fiber.dispose() } catch {}
})

const fiber = root.inject([], async (ctx) => {
  applyRan++
  ctx.effect(() => () => {}, 'e')
  return () => {}
})
await sleep(30)

console.log(`  发布时被释放=${disposedAtPublish}`)
console.log(`  apply 执行了 ${applyRan} 次`)
console.log(`  最终 state=${S[fiber.state]}  uid=${fiber.uid}`)
console.log()
console.log(`  ${applyRan === 0 ? '✓ 重入释放后未执行插件' : '★ 插件在已被释放的 fiber 上仍然执行了 ' + applyRan + ' 次'}`)
