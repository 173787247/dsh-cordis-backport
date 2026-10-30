/**
 * #234: `EntryGroup.remove()` drops the dispose task, so `loader.await()` and
 * `loader.update(group, …)` return before the removed plugin's teardown ends.
 */
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const MockLoader = makeMockLoader(Loader, Group, Context)
const GROUP = '@deepseek-ai/cordis-plugin-group'

async function boot() {
  const root = new Context()
  root.logger.error = () => {}
  await root.plugin(MockLoader)
  return root.loader
}

function slow(timeline) {
  return () => async () => {
    timeline.push('start')
    await sleep(50)
    timeline.push('end')
  }
}

// 1) loader.remove(id) then await()
{
  const loader = await boot()
  const timeline = []
  loader.mock('slow', slow(timeline))
  const id = await loader.create({ name: 'slow' })
  await loader.await()
  const start = Date.now()
  loader.remove(id)
  await loader.await()
  const elapsed = Date.now() - start
  console.log(`  ① remove+await: timeline=${JSON.stringify(timeline)} elapsed=${elapsed}ms`)
  console.log(`    ${timeline.includes('end') && elapsed >= 50 ? '✓ await() 等到了卸载' : '★ await() 提前返回'}`)
}

// 2) updating a group removes a child and must wait for its teardown
{
  const loader = await boot()
  const timeline = []
  loader.mock('slow', slow(timeline))
  await loader.create({ id: 'g', name: GROUP, group: true, config: [{ id: '1', name: 'slow' }] })
  await loader.await()
  const start = Date.now()
  await loader.update('g', { config: [] })
  const elapsed = Date.now() - start
  console.log(`  ② group update: timeline=${JSON.stringify(timeline)} elapsed=${elapsed}ms`)
  console.log(`    ${timeline.includes('end') && elapsed >= 50 ? '✓ update() 等到了卸载' : '★ update() 提前返回'}`)
}
