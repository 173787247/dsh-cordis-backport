/**
 * #234: `EntryGroup.remove()` drops the dispose task, so `loader.await()` and
 * `loader.update(group, …)` return before the removed plugin's teardown ends.
 */
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const MockLoader = makeMockLoader(Loader, Group, Context)
const root = new Context()
root.logger.error = () => {}
await root.plugin(MockLoader)
const loader = root.loader

const timeline = []
loader.mock('slow', () => async () => {
  timeline.push('start')
  await sleep(50)
  timeline.push('end')
})

const id = await loader.create({ name: 'slow' })
await loader.await()
const start = Date.now()
loader.remove(id)
await loader.await()
const elapsed = Date.now() - start
console.log(`  timeline=${JSON.stringify(timeline)} elapsed=${elapsed}ms`)
console.log(`  ${timeline.includes('end') && elapsed >= 50 ? '✓ await() 等到了卸载' : '★ await() 提前返回'}`)
