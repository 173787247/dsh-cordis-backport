/**
 * Effect registration while the owner is UNLOADING.
 *
 *   as shipped   registers; the effect outlives the teardown that should own it
 *   with guard   throws CordisError('INACTIVE_EFFECT')
 *
 * `_unload()` clears `_disposables` and drains it; a registration made from
 * inside one of those disposers lands after the clear, so this unload never
 * disposes it. Only swept by the *next* unload, and never if there is not one.
 *
 * This one runs the other way round from the rest of this directory: the
 * vendored line already carries the guard as a documented local lifecycle fix,
 * and upstream did not, so it became upstream PR #176.
 */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

const root = new Context(); root.logger.error = () => {}
const dispose1 = root.provide('dep', 1)

let duringUnload = null
let stateAtAttempt = null
let innerRan = false

const fiber = root.inject(['dep'], async (ctx) => {
  // 第一个 effect：它的 disposer 在 _unload() 期间运行，那时 state === UNLOADING
  ctx.effect(() => () => {
    stateAtAttempt = S[fiber.state]
    try {
      ctx.effect(() => { innerRan = true; return () => {} }, 'registered-during-unload')
      duringUnload = '注册成功'
    } catch (e) {
      duringUnload = '被拒绝: ' + e.message.slice(0, 46)
    }
  }, 'outer')
  return () => {}
})
await sleep(10)
console.log(`  建好后 state=${S[fiber.state]}`)

// 撤销依赖 → 触发 unload（不是 dispose）
dispose1()
await sleep(30)

console.log(`  尝试注册时 state=${stateAtAttempt}`)
console.log(`  结果: ${duringUnload}`)
console.log(`  内部 effect 执行了吗: ${innerRan}`)
const rejected = String(duringUnload).startsWith('被拒绝')
console.log()
console.log(`  ${rejected ? '✓ 清理期注册被拒绝' : '★ 清理期注册成功了 —— 它逃出了本次 unload 快照'}`)
