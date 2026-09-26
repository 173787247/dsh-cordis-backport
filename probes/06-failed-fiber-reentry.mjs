/**
 * A FAILED fiber must not re-enter its lifecycle on a dependency refresh.
 *
 *   as shipped   after a withdraw/re-provide   apply called 2 times   state=FAILED
 *   fixed        after a withdraw/re-provide   apply called 1 time    state=FAILED
 *
 * `_setEpoch` lacked the `if (this._error) return` guard, so anything the
 * plugin did before throwing accumulated across attempts that could never
 * succeed.
 */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

const root = new Context(); root.logger.error = () => {}
let calls = 0
const apply = () => { calls++; throw new Error('boom') }

const dispose = root.provide('foo', 1)
const fiber = root.inject(['foo'], apply)
await sleep(8)
console.log(`  首次加载: apply 调用 ${calls} 次, state=${S[fiber.state]}`)

// 依赖刷新：撤销再重新提供
await dispose()
root.provide('foo', 2)
await sleep(15)
const ok = calls === 1 && fiber.state === 3
console.log(`  依赖刷新后: apply 调用 ${calls} 次, state=${S[fiber.state]}`)
console.log(`  ${ok ? '✓ 未重新进入生命周期' : '★ 失败的 fiber 被重新执行了（apply 多跑了 ' + (calls - 1) + ' 次）'}`)
