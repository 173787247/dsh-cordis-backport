// #165 against the shipped line: a listener vetoes the update, but the loader's
// prepend listener has already written `entry.options.config` and the tree.
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const MockLoader = makeMockLoader(Loader, Group, Context)
const root = new Context()
await root.plugin(MockLoader)
const loader = root.loader
loader.mock('foo', (ctx) => {
  ctx.on('internal/update', () => { throw new Error('vetoed') })
})
const id = await loader.create({ name: 'foo', config: { a: 1 } })
await sleep(20)
const entry = loader.store[id]
console.log('  初始: 条目 config =', JSON.stringify(entry.options.config))

let error
try { await entry.fiber.update({ a: 3 }) } catch (e) { error = e }
await sleep(20)

const tree = [...loader.entries()].find(e => e.options?.id === id)
console.log('  veto =', error?.message ?? '(没有抛错)')
console.log('  否决后: 条目 config =', JSON.stringify(tree?.options?.config), '| 运行时 applied =', JSON.stringify(entry.fiber?._config ?? null))
const persisted = tree?.options?.config?.a
console.log(persisted === 1
  ? '  ✓ 否决后没有落盘（与上游修复一致）'
  : '  ★ #165：更新被否决，落盘却已经是 ' + JSON.stringify(tree?.options?.config))
