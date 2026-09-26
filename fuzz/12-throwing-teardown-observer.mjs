/**
 * A throwing teardown observer must not cancel the teardown.
 *
 *   main      seen=['first']  dispose() threw  state=ACTIVE    effect disposer ran 0 times
 *   patched   seen=['first','second']  resolved  state=DISPOSED  ran 1 time
 *
 * The emit is a bare loop, so the first throw starves the remaining observers and
 * aborts everything after the notification in the disposer: runtime bookkeeping,
 * the epoch change, the unload. The fiber is left reporting ACTIVE with every
 * effect it owned still registered, and dispose() rejects so the caller cannot
 * finish the job either.
 *
 * Second item from the vendored line's local modification log to turn out to be
 * an upstream defect rather than a local preference — see also 09/10 (#176).
 */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

const root = new Context(); root.logger.error = () => {}
const order = []

// 第一个观察者在「fiber 被释放」时抛错，第二个正常记录
root.on('internal/plugin', (fiber) => {
  if (fiber.uid !== null) return              // 只看 disposal 通知
  order.push('observer-1 抛错前')
  throw new Error('observer-1 boom')
})
root.on('internal/plugin', (fiber) => {
  if (fiber.uid !== null) return
  order.push('observer-2 运行了')
})

let cleanupRan = 0
const fiber = root.inject([], async (ctx) => {
  ctx.effect(() => () => { cleanupRan++ }, 'e')
  return () => {}
})
await sleep(10)

let disposeError = null
try { await fiber.dispose() } catch (e) { disposeError = e.message.slice(0, 50) }
await sleep(20)

console.log(`  观察者调用顺序: ${order.join(' → ') || '(无)'}`)
console.log(`  dispose 是否抛错: ${disposeError ?? '否'}`)
console.log(`  fiber.state=${S[fiber.state]}  cleanup 跑了 ${cleanupRan} 次`)
console.log()
const peerRan = order.includes('observer-2 运行了')
const cleanupOk = cleanupRan === 1 && fiber.state === 4
console.log(`  ${peerRan ? '✓ 第二个观察者仍运行' : '★ 第二个观察者被前一个的抛错饿死了'}`)
console.log(`  ${cleanupOk ? '✓ 释放流程未被打断' : '★ 释放被中断'}`)
