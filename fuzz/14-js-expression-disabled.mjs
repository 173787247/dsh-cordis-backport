/**
 * `disabled: !!js <expr>` — the expression must be evaluated, not read as truthy.
 *
 *   upstream    { __jsExpr: 'false' } -> entry.disabled = true    apply ran 0 times
 *   as shipped  { __jsExpr: 'false' } -> entry.disabled = false   apply ran 1 time
 *
 * `Boolean({...})` is always true, so any `!!js` node in `disabled` disables the
 * entry whatever the expression says. See findings/16-js-disabled.md — the fix
 * for this one is drafted but NOT verified.
 */
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const MockLoader = makeMockLoader(Loader, Group, Context)
const root = new Context(); root.logger.error = () => {}
await root.plugin(MockLoader)
const loader = root.loader

let applied = 0
loader.mock('plug', function plug() { applied++; return () => {} })

// disabled 是一个 !!js 表达式节点，表达式求值为 false（= 不禁用）
await loader.create({ id: 'a', name: 'plug', disabled: { __jsExpr: 'false' } })
await sleep(20)
const e1 = loader.store['a']
console.log(`  disabled = { __jsExpr: 'false' }  →  entry.disabled = ${e1.disabled}   apply ${applied} 次`)

const appliedBefore = applied
// 对照：表达式求值为 true（= 禁用）
await loader.create({ id: 'b', name: 'plug', disabled: { __jsExpr: 'true' } })
await sleep(20)
const e2 = loader.store['b']
console.log(`  disabled = { __jsExpr: 'true'  }  →  entry.disabled = ${e2.disabled}   apply 增量 ${applied - appliedBefore}`)
console.log()
const ok = e1.disabled === false && e2.disabled === true
console.log(`  ${ok ? '✓ 表达式被求值' : '★ !!js 节点被当成真值 —— 两个条目都判为禁用'}`)
