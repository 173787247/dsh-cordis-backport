// #167 against the shipped line: reconciling two groups that share an entry id in
// the same turn. Upstream (without the fix) leaves a *stale* plugin running; the
// vendored loader drops the surviving entries instead — nothing is running at all.
//
// Upstream counterpart: packages/loader/tests/group-race.spec.ts
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const GROUP = '@cordisjs/plugin-group'
const e = (id, name) => ({ id, name })
const MockLoader = makeMockLoader(Loader, Group, Context)
const root = new Context()
await root.plugin(MockLoader)
const loader = root.loader
for (const n of ['foo', 'bar', 'baz']) loader.mock(n, () => {})

const active = () => ['foo', 'bar', 'baz'].filter(n => !!root.registry.get(loader.modules[n]))
const entries = () => [...loader.entries()]
  .map(entry => `${entry.options?.id}:${entry.options?.name}`)
const settle = async () => { for (let i = 0; i < 8; i++) { await loader.await(); await sleep(2) } }

await loader.create({ id: 'g1', name: GROUP, group: true, config: [e('1', 'foo'), e('2', 'baz')] })
await loader.create({ id: 'g2', name: GROUP, group: true, config: [e('2', 'bar')] })
await settle()
console.log('  initial   active =', JSON.stringify(active()), '| entries =', JSON.stringify(entries()))

await Promise.all([
  loader.update('g1', { config: [e('3', 'foo'), e('3', 'foo')] }),
  loader.update('g2', { config: [e('2', 'foo'), e('3', 'foo')] }),
])
await settle()
console.log('  round 1   active =', JSON.stringify(active()), '| entries =', JSON.stringify(entries()))

await Promise.all([
  loader.update('g1', { config: [e('3', 'baz'), e('2', 'baz')] }),
  loader.update('g2', { config: [] }),
])
await settle()
const result = active()
console.log('  final     active =', JSON.stringify(result), '| entries =', JSON.stringify(entries()))
console.log('  expected  active = ["baz"]  (both surviving entries ask for baz)')

if (result.length === 1 && result[0] === 'baz') console.log('  ✓ matches upstream with the fix')
else if (result.length > 1) console.log('  ★ stale plugin left running — the #167 shape')
else console.log('  ★ entries dropped — the shipped line\'s own, worse shape')
