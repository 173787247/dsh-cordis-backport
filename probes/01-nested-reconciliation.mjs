// 上游 packages/loader/tests/group.spec.ts 里
// "Group: awaited reconciliation > config update settles children" 的复刻
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const MockLoader = makeMockLoader(Loader, Group, Context)
const root = new Context()
await root.plugin(MockLoader)
const loader = root.loader
const foo = loader.mock('foo', function () {})
const bar = loader.mock('bar', function () {})

const group = await loader.create({
  name: '@cordisjs/plugin-group',
  group: true,
  config: [{ id: '1', name: 'foo' }],
})
await sleep(0)
console.log('  初始: foo 启用 =', loader.expectEnable(foo), '| bar 启用 =', loader.expectEnable(bar))

// 让 import 变慢，把「未等待」暴露出来
const load = loader.import
loader.import = async (name) => { await sleep(20); return load.call(loader, name) }

try {
  await loader.update(group, {
    config: [{ id: '1', name: 'foo' }, { id: '2', name: 'bar' }],
  })
} finally {
  loader.import = load
}

// 上游的断言：update() 返回时，新的子条目必须已经就绪
const fiber2 = loader.expectFiber('2')
console.log('  update() 返回后:')
console.log('    bar 已启用 =', !!root.registry.get(bar))
console.log('    条目 "2" 的 fiber =', fiber2 ? `存在(state=${fiber2.state})` : '不存在')
console.log('    ' + (root.registry.get(bar) ? '✓ 已同步 —— 与上游一致' : '★ 未同步 —— 复现了 DSH 的 bug'))
