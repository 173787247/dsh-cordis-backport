/**
 * Isolate realms: a service provided in one realm must not be visible in
 * another, and a withdrawal must wake only the realm that provided it.
 *
 * Both lines behave identically here — kept as a regression guard rather than a
 * finding. `notify`'s default filter is what implements it:
 *   ctx[symbols.isolate][name] === this.ctx[symbols.isolate][name]
 */
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

const root = new Context(); root.logger.error = () => {}
const A = root.isolate('svc')
const B = root.isolate('svc')

// 在 A 域里提供服务
const disposeA = A.provide('svc', { from: 'A' })

const fa = A.inject(['svc'], async () => { await sleep(1); return () => {} })
const fb = B.inject(['svc'], async () => { await sleep(1); return () => {} })
await sleep(25)

console.log(`  A 域提供 svc 后:`)
console.log(`    A 域的消费者 state=${S[fa.state]}`)
console.log(`    B 域的消费者 state=${S[fb.state]}`)
const isolated = fa.state === 2 && fb.state !== 2
console.log(`    ${isolated ? '✓ 跨域不可见' : '★ 隔离失效'}`)

// 撤销 A 域的提供者 —— 只应影响 A
disposeA()
await sleep(25)
console.log(`  撤销 A 域提供者后:`)
console.log(`    A 域消费者 state=${S[fa.state]}`)
console.log(`    B 域消费者 state=${S[fb.state]}`)
const aUnloaded = fa.state !== 2
console.log(`    ${aUnloaded ? '✓ A 域正确卸载' : '★ A 域未响应'}`)
console.log()
console.log(`  root 上能看到 svc 吗: ${root.get('svc') !== undefined}`)
