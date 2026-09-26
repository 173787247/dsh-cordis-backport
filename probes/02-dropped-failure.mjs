import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))

const unhandled = []
process.on('unhandledRejection', (e) => { unhandled.push(e?.message ?? String(e)) })

const root = new Context()
root.logger.error = () => {}
let boom = false
const apply = () => { if (boom) throw new Error('boom') }
const fiber = root.plugin(apply)
await fiber

// ① 让下一次 reload 抛错，看 update() 返回什么
boom = true
const ret = fiber.update({})
console.log('  ① update() 返回:', ret === undefined ? 'undefined（不是 Promise）' : `Promise（${typeof ret.then === 'function' ? 'thenable' : '?'}）`)
if (ret && typeof ret.then === 'function') {
  try { await ret; console.log('     await 结果: 正常') }
  catch (e) { console.log('     await 结果: reject →', e.message) }
} else {
  console.log('     → 调用方无法等待，也无法捕获失败')
}
await sleep(20)

// ② 再触发一次，故意不 await，看会不会变成 unhandled rejection
boom = true
fiber.update({})
await sleep(30)

console.log('  ② 未 await 时产生的 unhandled rejection:', unhandled.length ? unhandled : '无')
console.log('     ' + (unhandled.length ? '★ 泄漏了 —— 进程可能因此崩溃' : '✓ 没有泄漏'))
