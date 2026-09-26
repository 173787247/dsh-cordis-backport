/**
 * `registry.delete()` is synchronous but its disposal is not: it returns with
 * the fibers in `UNLOADING` and no handle to await.
 *
 *   both lines   returned runtime; fiber state=UNLOADING; cleanup completed later
 *
 * No divergence — recorded because a synchronous API that performs asynchronous
 * work without returning a handle is worth knowing about, not because anything
 * observably breaks. Confirmed separately that delete-then-immediately-replugin
 * behaves correctly on both lines: the old fiber reaches DISPOSED, the new one
 * reaches ACTIVE, and the cleanup count is 1.
 */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

const root = new Context(); root.logger.error = () => {}
let cleaned = 0

const plugin = function plug() {}
const fiber = root.plugin(plugin)
await fiber
// 给这个 fiber 挂一个**异步**清理
fiber.ctx.effect(() => () => new Promise(r => setTimeout(() => { cleaned++ ; r() }, 40)), 'async-cleanup')
await sleep(5)
console.log(`  建好后 state=${S[fiber.state]}, 清理跑了 ${cleaned} 次`)

// registry.delete() 是同步的 —— 它返回时清理完成了吗？
const removed = root.registry.delete(plugin)
console.log(`  registry.delete() 返回: ${removed ? 'runtime' : 'undefined(未找到)'}`)
console.log(`  返回后立刻: 清理跑了 ${cleaned} 次, fiber.state=${S[fiber.state]}`)

await sleep(80)
console.log(`  等 80ms 后: 清理跑了 ${cleaned} 次, fiber.state=${S[fiber.state]}`)
console.log()
console.log(`  ${cleaned === 0 ? '★ delete() 返回时清理尚未开始 —— 同步 API 掩盖了异步释放' : '（清理在返回前已开始）'}`)
console.log(`  注意 delete() 是同步签名，调用方没有可等待的句柄`)
