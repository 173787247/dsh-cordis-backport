export const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
export function makeMockLoader(Loader, Group, Context) {
  return class MockLoader extends Loader {
    data = []; changes = []; modules = Object.create(null)
    constructor(ctx) {
      super(ctx)
      ctx.on('internal/get', (ctx, prop, error, next) => {
        if (!ctx.fiber.runtime && prop === 'loader') return ctx.get(prop)
        return next()
      })
    }
    commit(change) { this.data = this.root.data; this.changes.push(change) }
    async read(data) { this.data = data; await this.root.update(data); await this.await() }
    async import(name) { if (name === '@cordisjs/plugin-group') return Group; return this.modules[name] }
    mock(name, plugin) {
      if (!plugin.name) Object.defineProperty(plugin, 'name', { value: name })
      return this.modules[name] = plugin
    }
    expectEnable(plugin) { return !!this.ctx.registry.get(plugin) }
    expectFiber(id) { return this.store[id]?.fiber }
  }
}
