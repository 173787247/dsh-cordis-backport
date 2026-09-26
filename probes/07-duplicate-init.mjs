/**
 * Duplicate init: the plugin is imported and applied twice.
 *
 *   main / DSH 4.0.4   import called 2 times   apply ran 2 times
 *
 * `Entry._init()` clears `_initTask` in the `finally` on the **import** step,
 * but continues afterwards with `unwrapExports`, `_patchContext` and the
 * registry call. A second `init()` arriving in that window sees no task in
 * flight and starts another `_init`.
 *
 * Fixed upstream in #166. Checked against the vendored line while looking for
 * the same defect there — it has it too, along with three more of the same
 * origin (#165, #167, #172).
 */
import { Context } from '@deepseek-ai/cordis'
import { Loader, Group } from '@deepseek-ai/cordis-plugin-loader'
import { makeMockLoader, sleep } from './mockloader.mjs'

const MockLoader = makeMockLoader(Loader, Group, Context)
const root = new Context(); root.logger.error = () => {}
await root.plugin(MockLoader)
const loader = root.loader

let applies = 0
let imports = 0
loader.mock('slow', function slow() { applies++; return () => {} })
// 让 import 慢下来，制造 _init 还在进行中的窗口
const realImport = loader.import.bind(loader)
loader.import = async (name) => { imports++; await sleep(20); return realImport(name) }

const entryId = await loader.create({ id: 'e', name: 'slow' })
await sleep(5)                      // _init 仍在 import 阶段
// 在 import 尚未返回时再次触发 init
try { await loader.store['e'].init() } catch {}
await sleep(60)

console.log(`  import 被调用 ${imports} 次`)
console.log(`  插件 apply 执行 ${applies} 次`)
console.log()
console.log(`  ${applies <= 1 ? '✓ 未重复初始化' : '★ 插件被初始化了 ' + applies + ' 次（import ' + imports + ' 次）'}`)
