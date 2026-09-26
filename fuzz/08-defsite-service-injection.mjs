/**
 * Ported from the test upstream added in `4cfd19a` (*resolve def-site service
 * injection*): an access through `ctx.foo.bar` must be governed by the inject
 * scope of the service that runs the access, not by whoever called it.
 *
 *   as shipped   qux, which never injects `foo.bar`, still reaches it
 *                baz, which does inject it, cannot reach it from a nested context
 *   upstream     both behave as their `inject` declares
 *
 * Confirmed divergence, NOT patched — same gap as 07. `4cfd19a` and `be7d36e`
 * both land in `createShadow` and the `get` trap of `createTraceable`, and this
 * line has an earlier shape of both. Adjusting `createShadow` alone was tried
 * against each and fixes neither.
 *
 * The first line is the one that matters: a service reaching a service it never
 * declared breaks the inject declaration as a statement of what a plugin depends
 * on.
 */
import { Context, Service } from '@deepseek-ai/cordis'

class Foo extends Service {
  constructor(ctx) { super(ctx, 'foo') }
}
class FooBar extends Service {
  constructor(ctx) { super(ctx, 'foo.bar') }
  hello() { return 'bar' }
}
class Baz extends Service {
  static inject = ['foo', 'foo.bar']
  constructor(ctx) { super(ctx, 'baz') }
  probe() { return this.ctx.foo.bar.hello() }
}
class Qux extends Service {
  static inject = ['foo']            // 注入了 foo，但没有 foo.bar
  constructor(ctx) { super(ctx, 'qux') }
  probe() { return this.ctx.foo.bar.hello() }
}

const root = new Context(); root.logger.error = () => {}
await root.plugin(Foo); await root.plugin(FooBar)
await root.plugin(Baz); await root.plugin(Qux)

const check = (label, fn, expectThrow) => {
  let out
  try { out = fn(); out = `返回 ${JSON.stringify(out)}` }
  catch (e) { out = `抛错 ${e.message.slice(0, 46)}` }
  const threw = out.startsWith('抛错')
  const ok = threw === expectThrow
  console.log(`  ${ok ? '✓' : '★'} ${label.padEnd(34)} ${out}`)
  return ok
}

let all = true
// baz 注入了 foo.bar → 应该成功
all &= check('baz.probe() 直接调用', () => root.baz.probe(), false)
// qux 没注入 foo.bar → 应该抛错
all &= check('qux.probe() 直接调用', () => root.qux.probe(), true)
// 包一层注入后，管辖者仍应是执行访问的服务自己
await root.inject(['baz', 'qux'], (ctx) => {
  all &= check('baz.probe() 经注入上下文', () => ctx.baz.probe(), false)
  all &= check('qux.probe() 经注入上下文', () => ctx.qux.probe(), true)
})
console.log()
console.log(`  ${all ? '✓ 访问由执行访问的服务自身的 inject 管辖' : '★ def-site 归属错误'}`)
