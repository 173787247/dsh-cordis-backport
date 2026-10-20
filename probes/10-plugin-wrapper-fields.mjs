// 752dbee (#40): plugin() returns an Object.create(fiber) wrapper; lifecycle fields
// assigned through it once landed on the wrapper instead of the real fiber, so the
// wrapper kept reading ACTIVE after the fiber unloaded.
import { Context } from '@deepseek-ai/cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))

const root = new Context()
const disposeDep = root.provide('dep', 1)
const wrapper = root.plugin({ inject: ['dep'], apply() {} })
await sleep(20)
const real = wrapper.ctx?.fiber ?? wrapper
console.log('  active:  wrapper.state =', wrapper.state, '| real =', real.state, '| same object =', wrapper === real)
disposeDep()
await sleep(20)
console.log('  withdrawn: wrapper.state =', wrapper.state, '| real =', real.state)
const agrees = wrapper.state === real.state
console.log(agrees
  ? '  ✓ wrapper and fiber agree — the fields are not shadowed'
  : '  ★ wrapper kept a stale copy (752dbee)')
