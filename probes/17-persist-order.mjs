/**
 * #165: a vetoed update still writes `entry.options.config`.
 */
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const MockLoader = makeMockLoader(Loader, Group, Context)
const root = new Context()
root.logger.error = () => {}
await root.plugin(MockLoader)
const loader = root.loader

loader.mock('veto', (ctx) => {
  ctx.on('internal/update', () => {
    throw new Error('vetoed')
  })
})

const id = await loader.create({ name: 'veto', config: { a: 1 } })
await sleep(10)
let caught
try {
  await loader.expectFiber(id).update({ a: 3 })
} catch (error) {
  caught = error
}
const persisted = loader.store[id]?.options?.config
console.log(`  veto error=${caught?.message} persisted=${JSON.stringify(persisted)}`)
console.log(`  ${persisted?.a === 1 ? '✓ 未持久化' : '★ veto 后仍然持久化'}`)
