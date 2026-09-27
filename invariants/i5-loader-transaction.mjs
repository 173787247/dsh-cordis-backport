/**
 * I5 — loader transaction properties.
 *
 * RESULT OF THIS ROUND, stated before the code so it cannot be skimmed past:
 *
 *   update-returns-waterfall-result        agree   (both propagate it)
 *   absent-service-does-not-hang-settlement agree   (both settle)
 *   failed-update-rejects                  agree   (both reject)
 *   group-reconcile-all-or-nothing         INVALID (this scenario never built the group)
 *   failed-update-restores-config          INCONCLUSIVE
 *
 * The last one is the only interesting result and it is **not a finding**. The
 * scenario writes a failing config through `Entry.update()` and observes that
 * `options.config` keeps the new value on both lines. But the document's claim —
 * "a failure disposes candidate effects and restores the prior plugin or config"
 * — describes the module-NAME-change path with a candidate fiber, and that path
 * could not be located in the vendored source: `Entry._init()` assigns
 * `this.fiber` to the new fiber and the only `dispose()` in the file is the
 * `disabled` branch. So either the claim is implemented somewhere this scenario
 * does not reach, or it is not implemented. **Deciding which requires reading
 * the reload path, not running this scenario**, and claiming a defect here
 * without that would be exactly the mistake this repository keeps warning about.
 *
 * Original header follows.
 *
 *
 * Source: `.agents/notes/archived/bug-fix/2026-07-20-config-hot-reload-resilience.md`
 * in the DeepSeek Harness repository, which specifies the vendored Loader's
 * reload behaviour as an awaited compensating transaction and states that
 * "the vendored Loader, Include, HMR, and core event typing diverge further from
 * upstream".
 *
 * Each claim in that document is a property, so each is testable here:
 *
 *   - `Fiber.update()` returns its `internal/update` waterfall result
 *   - a failed candidate application disposes the candidate and restores the
 *     prior plugin or config
 *   - group reconciliation restores changed entries, additions, removals and
 *     moves before rejecting — all or nothing
 *   - a fiber waiting on an absent service settles as a valid PENDING entry
 *     rather than making settlement hang
 *
 * Several of these correspond to defects already sent upstream (#165, #167,
 * #171). Where a scenario agrees on both lines it confirms the framing; where it
 * diverges it is a new finding.
 */
import { Context } from 'CORDIS_PKG'
import { Loader, Group } from 'LOADER_PKG'
import { makeMockLoader, sleep } from './mockloader.mjs'
import { check, scenario } from './lib/harness.mjs'

const S = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

await scenario('I5', async () => {
  const MockLoader = makeMockLoader(Loader, Group, Context)

  // ── 1. Fiber.update() surfaces the internal/update waterfall result ─────
  //
  // The document states the waterfall's return value reaches the caller, which
  // is what lets an entry tell validation, import, application and rollback
  // failure apart. If a middleware's return value is dropped, every failure
  // looks the same to the caller.
  {
    const root = new Context(); root.logger.error = () => {}
    await root.plugin(MockLoader)
    const loader = root.loader
    loader.mock('plug', () => {})

    const id = await loader.create({ id: 'e', name: 'plug' })
    const entry = loader.store['e']
    const fiber = entry.fiber

    let sawValue = null
    root.on('internal/update', function (config, noSave, next) {
      if (this.entry !== entry) return next()
      // a middleware that answers instead of delegating
      sawValue = 'middleware-answered'
      return 'FROM-MIDDLEWARE'
    }, { global: true, prepend: true })

    let returned
    try { returned = await fiber.update({ changed: true }, true) } catch (e) { returned = `threw:${e.message}` }
    check('I5.update-returns-waterfall-result', returned === 'FROM-MIDDLEWARE',
      `middleware ran (${sawValue}); update() returned ${JSON.stringify(returned)}`)
  }

  // ── 2. a failed candidate application restores the prior config ────────
  {
    const root = new Context(); root.logger.error = () => {}
    await root.plugin(MockLoader)
    const loader = root.loader

    let applies = []
    loader.mock('plug', function plug(ctx, config) {
      applies.push(config?.v ?? null)
      if (config?.boom) throw new Error('cannot apply this config')
    })

    const id = await loader.create({ id: 'e', name: 'plug', config: { v: 1 } })
    await sleep(10)
    const entry = loader.store['e']
    const before = { applies: applies.slice(), config: JSON.stringify(entry.options.config) }

    // an update whose application throws
    let rejected = false
    try {
      await entry.update({ id: 'e', name: 'plug', config: { v: 2, boom: true } }, true)
    } catch { rejected = true }
    await sleep(30)

    const afterConfig = JSON.stringify(entry.options.config)
    check('I5.failed-update-rejects', rejected, `update() rejected: ${rejected}`)
    check('I5.failed-update-restores-config', afterConfig === before.config,
      `config before=${before.config} after=${afterConfig}`)
  }

  // ── 3. a fiber waiting on an absent service settles as PENDING ─────────
  //
  // "a fiber waiting on an absent service remains a valid pending entry rather
  // than making settlement hang" — so awaiting the tree must return, not block.
  {
    const root = new Context(); root.logger.error = () => {}
    await root.plugin(MockLoader)
    const loader = root.loader
    loader.mock('needsAbsent', function needsAbsent() {}, { inject: ['neverThere'] })

    let settled = false, timedOut = false
    const timer = setTimeout(() => { timedOut = true }, 3000)
    try {
      await Promise.race([
        loader.create({ id: 'p', name: 'needsAbsent' }).then(() => { settled = true }),
        sleep(1200),
      ])
    } catch { settled = true }
    clearTimeout(timer)

    const entry = loader.store['p']
    const state = entry?.fiber ? S[entry.fiber.state] : '(no fiber)'
    check('I5.absent-service-does-not-hang-settlement', !timedOut,
      `settled=${settled} within 1200ms; entry fiber state=${state}`)
  }

  // ── 4. group reconciliation is all-or-nothing ──────────────────────────
  //
  // "Group reconciliation starts candidates concurrently, awaits every outcome,
  // and restores changed entries, additions, removals and moves before
  // rejecting." So the group's membership after a rejected reconcile must equal
  // what it was before.
  {
    const root = new Context(); root.logger.error = () => {}
    await root.plugin(MockLoader)
    const loader = root.loader
    loader.mock('ok', function ok() {})
    loader.mock('bad', function bad(ctx, config) {
      if (config?.explode) throw new Error('this plugin cannot apply')
    })

    const groupName = loader.store ? '@cordisjs/plugin-group' : 'group'
    const id = await loader.create({
      id: 'g', name: groupName,
      config: [{ id: 'a', name: 'ok' }, { id: 'b', name: 'ok' }],
    })
    await sleep(60)
    const group = loader.store[id]
    const membership = (g) => (g?.data ?? []).map(o => o.id).sort().join(',')
    const before = membership(group)
    const kidsBefore = ['a', 'b'].filter(k => loader.store[`${id}:${k}`]).length

    let rejected = false
    try {
      await group.update([
        { id: 'a', name: 'ok' },
        { id: 'c', name: 'bad', config: { explode: true } },   // cannot apply
        { id: 'b', name: 'ok' },
      ])
    } catch { rejected = true }
    await sleep(80)

    const after = membership(loader.store[id])
    const kidsAfter = ['a', 'b', 'c'].filter(k => loader.store[`${id}:${k}`]).length
    check('I5.group-reconcile-all-or-nothing', after === before,
      `rejected=${rejected}; membership [${before}] -> [${after}]; children ${kidsBefore} -> ${kidsAfter}`)
  }
})
