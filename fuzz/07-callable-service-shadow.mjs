/**
 * Ported from the test upstream added in `be7d36e` (#37, *apply shadows to
 * callable services*): a callable service reached through an extension must
 * still resolve its injected dependency.
 *
 *   as shipped   Error: cannot get property "dependency" without inject
 *   upstream     both calls return a Dependency instance
 *
 * Confirmed divergence, NOT patched. `Service.extend` is a supported protected
 * member in both lines and its purpose is for a subclass to expose it, so this
 * is a plugin-author-facing break rather than a live one: nothing in the
 * harness calls it, and the logger — which is itself callable — attributes to
 * the right fiber on both lines. The one-line-looking cause is in
 * `createShadow` — it uses `Reflect.getOwnPropertyDescriptor` where upstream
 * uses `getPropertyDescriptor`, and a class service's member lives on the
 * prototype, so the lookup finds nothing and drops the shadow. Changing that
 * alone does not fix it: the whole `get` trap in `createTraceable` is an
 * earlier shape here. That is a refactor of the shadow machinery, not a
 * backport, and half of it is worse than none.
 */
import { Context, Service } from '@deepseek-ai/cordis'

const inv = Service.invoke, ext = Service.extend

class Dependency extends Service {
  constructor(ctx) { super(ctx, 'dependency') }
}
class Callable extends Service {
  static inject = ['dependency']
  constructor(ctx) { super(ctx, 'callable') }
  [inv]() { return this.ctx['dependency'] }
  extend() { return this[ext]() }
}
class Outer extends Service {
  static inject = ['callable']
  constructor(ctx) { super(ctx, 'outer') }
  call() {
    const c = this.ctx['callable']
    return [c(), c.extend()()]
  }
}

const root = new Context(); root.logger.error = () => {}
await root.plugin(Dependency)
await root.plugin(Callable)
await root.plugin(Outer)

let result
await root.inject(['outer'], (ctx) => { result = ctx['outer'].call() })

const ok0 = result[0] instanceof Dependency
const ok1 = result[1] instanceof Dependency
console.log(`  直接调用       → ${ok0 ? 'Dependency 实例 ✓' : '★ ' + (result[0]?.constructor?.name ?? result[0])}`)
console.log(`  extend() 之后  → ${ok1 ? 'Dependency 实例 ✓' : '★ ' + (result[1]?.constructor?.name ?? result[1])}`)
console.log(`  ${ok0 && ok1 ? '✓ 可调用服务的 shadow 正确' : '★ shadow 在可调用扩展上丢失'}`)
